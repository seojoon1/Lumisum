/**
 * 인원별 누적 전적 DB (libSQL / Turso)
 *
 * 저장하는 것은 "계산된 점수"가 아니라 **원본 지표**(순위점/킬점/터미네이트 횟수/탈출 횟수)다.
 * 점수 설정(터미네이트·탈출 배점)은 언제든 바뀔 수 있으므로, 조회 시점에 다시 곱해서 계산한다.
 *
 * 접속 정보
 *  - TURSO_DATABASE_URL : libsql://... (없으면 로컬 파일 data/lumisum.db 사용)
 *  - TURSO_AUTH_TOKEN   : 원격일 때만 필요
 */
import { createClient } from "@libsql/client";
import {
  calculatePlayerScores,
  ESCAPE_BONUS,
  TERMINATE_BONUS,
  type GameRecord,
  type PlayerStats,
} from "../lib/er-scores";

export type { PlayerStats };

const db = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:data/lumisum.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS match_players (
    session_id      TEXT    NOT NULL,
    game_id         TEXT    NOT NULL,
    game_no         INTEGER NOT NULL,
    nickname        TEXT    NOT NULL,
    team_name       TEXT    NOT NULL DEFAULT '',
    rank_score      REAL    NOT NULL,
    kill_score      REAL    NOT NULL,
    terminate_count INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL,
    PRIMARY KEY (game_id, nickname)
  );
  CREATE INDEX IF NOT EXISTS idx_match_players_nickname ON match_players (nickname);
  CREATE INDEX IF NOT EXISTS idx_match_players_session  ON match_players (session_id);

  CREATE TABLE IF NOT EXISTS session_escapes (
    session_id TEXT    NOT NULL,
    nickname   TEXT    NOT NULL,
    escapes    INTEGER NOT NULL,
    PRIMARY KEY (session_id, nickname)
  );
`;

// 스키마 준비는 프로세스당 한 번만. 모든 쿼리가 이 프라미스를 먼저 기다린다.
const g = globalThis as unknown as { __lumisumReady?: Promise<void> };
const ready = (g.__lumisumReady ??= db.executeMultiple(SCHEMA));

/**
 * 한 세션(오늘 내전) 전체를 DB에 반영한다.
 * 같은 session_id 는 지우고 다시 넣으므로, 판을 추가한 뒤 다시 저장해도 중복되지 않는다.
 * batch("write") 는 원자적이라 중간에 실패하면 통째로 롤백된다.
 */
export async function saveSession(
  sessionId: string,
  games: GameRecord[],
  escapes: Record<string, number>
) {
  await ready;
  const now = new Date().toISOString();

  const stmts = [
    { sql: "DELETE FROM match_players WHERE session_id = ?", args: [sessionId] },
    { sql: "DELETE FROM session_escapes WHERE session_id = ?", args: [sessionId] },
  ];

  games.forEach((game, i) => {
    // 보너스 1점으로 다시 계산하면 terminateBonus 값이 곧 "터미네이트 횟수"가 된다
    for (const s of calculatePlayerScores(game.scores, 1)) {
      stmts.push({
        sql: `INSERT INTO match_players
                (session_id, game_id, game_no, nickname, team_name, rank_score, kill_score, terminate_count, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [sessionId, game.id, i + 1, s.nickname, s.teamName, s.rankScore, s.killScore, s.terminateBonus, now],
      });
    }
  });

  for (const [nickname, count] of Object.entries(escapes)) {
    if (count > 0) {
      stmts.push({
        sql: "INSERT INTO session_escapes (session_id, nickname, escapes) VALUES (?, ?, ?)",
        args: [sessionId, nickname, count],
      });
    }
  }

  await db.batch(stmts, "write");
  return { games: games.length };
}

/** 세션 기록을 DB에서 제거 (잘못 저장했을 때 되돌리기) */
export async function deleteSession(sessionId: string) {
  await ready;
  const [players] = await db.batch(
    [
      { sql: "DELETE FROM match_players WHERE session_id = ?", args: [sessionId] },
      { sql: "DELETE FROM session_escapes WHERE session_id = ?", args: [sessionId] },
    ],
    "write"
  );
  return { removed: Number(players.rowsAffected) };
}

/** 이 세션이 이미 DB에 몇 판 저장돼 있는지 */
export async function sessionSaved(sessionId: string) {
  await ready;
  const rs = await db.execute({
    sql: "SELECT COUNT(DISTINCT game_id) AS n FROM match_players WHERE session_id = ?",
    args: [sessionId],
  });
  return Number(rs.rows[0].n);
}

/**
 * 인원별 누적 전적. 배점은 조회 시점 값으로 다시 계산한다.
 * 한 판 점수 = 순위점 + 킬점 + 터미네이트횟수 × terminateBonus
 */
export async function getPlayerStats(
  terminateBonus: number = TERMINATE_BONUS,
  escapeBonus: number = ESCAPE_BONUS
): Promise<PlayerStats[]> {
  await ready;
  const rs = await db.execute({
    sql: `
      WITH per_game AS (
        SELECT nickname,
               rank_score,
               kill_score,
               terminate_count,
               created_at,
               rank_score + kill_score + terminate_count * ? AS game_score
          FROM match_players
      ),
      agg AS (
        SELECT nickname,
               COUNT(*)             AS games,
               SUM(rank_score)      AS sum_rank,
               SUM(kill_score)      AS sum_kill,
               SUM(terminate_count) AS terminates,
               MAX(game_score)      AS best_raw,
               MAX(created_at)      AS last_played_at
          FROM per_game
         GROUP BY nickname
      ),
      esc AS (
        SELECT nickname, SUM(escapes) AS escapes FROM session_escapes GROUP BY nickname
      )
      SELECT agg.*, COALESCE(esc.escapes, 0) AS escapes
        FROM agg LEFT JOIN esc USING (nickname)
    `,
    args: [terminateBonus],
  });

  const round = (n: number) => Math.round(n * 100) / 100;

  const stats = rs.rows
    .map((r) => {
      const games = Number(r.games);
      const sumRank = Number(r.sum_rank);
      const sumKill = Number(r.sum_kill);
      const terminates = Number(r.terminates);
      const escapeCount = Number(r.escapes);
      const totalScore = sumRank + sumKill + terminates * terminateBonus + escapeCount * escapeBonus;
      return {
        nickname: String(r.nickname),
        games,
        totalScore: round(totalScore),
        avgScore: round(totalScore / games),
        bestScore: round(Number(r.best_raw)),
        avgRankScore: round(sumRank / games),
        avgKillScore: round(sumKill / games),
        terminates,
        escapes: escapeCount,
        lastPlayedAt: String(r.last_played_at),
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore || b.games - a.games);

  // 동점은 같은 순위 (1, 2, 2, 4 …)
  let lastScore = Number.NaN;
  let lastRank = 0;
  return stats.map((s, i) => {
    const rank = s.avgScore === lastScore ? lastRank : i + 1;
    lastScore = s.avgScore;
    lastRank = rank;
    return { rank, ...s };
  });
}

/** DB 전체 요약 (헤더 표시용) */
export async function getSummary() {
  await ready;
  const rs = await db.execute(
    `SELECT COUNT(DISTINCT game_id)   AS games,
            COUNT(DISTINCT nickname)  AS players,
            COUNT(DISTINCT session_id) AS sessions
       FROM match_players`
  );
  const r = rs.rows[0];
  return { games: Number(r.games), players: Number(r.players), sessions: Number(r.sessions) };
}
