/**
 * 인원별 누적 전적 DB (SQLite)
 *
 * 저장하는 것은 "계산된 점수"가 아니라 **원본 지표**(순위점/킬점/터미네이트 횟수/탈출 횟수)다.
 * 점수 설정(터미네이트·탈출 배점)은 언제든 바뀔 수 있으므로, 조회 시점에 다시 곱해서 계산한다.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  calculatePlayerScores,
  ESCAPE_BONUS,
  TERMINATE_BONUS,
  type GameRecord,
  type PlayerStats,
} from "../lib/er-scores";

const DB_PATH = process.env.LUMISUM_DB ?? path.join(process.cwd(), "data", "lumisum.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
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
  `);
  return db;
}

// 서버 재시작 없이 코드가 리로드되는 개발 모드에서 연결이 계속 늘어나지 않도록 전역에 캐시
const g = globalThis as unknown as { __lumisumDb?: Database.Database };
const db = (g.__lumisumDb ??= open());

export type { PlayerStats };

/**
 * 한 세션(오늘 내전) 전체를 DB에 반영한다.
 * 같은 session_id / game_id 는 덮어쓰므로, 판을 지우고 다시 저장해도 중복되지 않는다.
 */
export function saveSession(
  sessionId: string,
  games: GameRecord[],
  escapes: Record<string, number>
) {
  const now = new Date().toISOString();

  const wipe = db.transaction(() => {
    db.prepare("DELETE FROM match_players WHERE session_id = ?").run(sessionId);
    db.prepare("DELETE FROM session_escapes WHERE session_id = ?").run(sessionId);

    const insertPlayer = db.prepare(`
      INSERT INTO match_players
        (session_id, game_id, game_no, nickname, team_name, rank_score, kill_score, terminate_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    games.forEach((game, i) => {
      // 보너스 1점으로 다시 계산하면 terminateBonus 값이 곧 "터미네이트 횟수"가 된다
      for (const s of calculatePlayerScores(game.scores, 1)) {
        insertPlayer.run(
          sessionId, game.id, i + 1, s.nickname, s.teamName,
          s.rankScore, s.killScore, s.terminateBonus, now
        );
      }
    });

    const insertEscape = db.prepare(
      "INSERT INTO session_escapes (session_id, nickname, escapes) VALUES (?, ?, ?)"
    );
    for (const [nickname, count] of Object.entries(escapes)) {
      if (count > 0) insertEscape.run(sessionId, nickname, count);
    }
  });

  wipe();
  return { games: games.length };
}

/** 세션 기록을 DB에서 제거 (잘못 저장했을 때 되돌리기) */
export function deleteSession(sessionId: string) {
  const del = db.transaction(() => {
    const r = db.prepare("DELETE FROM match_players WHERE session_id = ?").run(sessionId);
    db.prepare("DELETE FROM session_escapes WHERE session_id = ?").run(sessionId);
    return r.changes;
  });
  return { removed: del() };
}

/** 이 세션이 이미 DB에 저장돼 있는지 */
export function sessionSaved(sessionId: string) {
  const row = db
    .prepare("SELECT COUNT(DISTINCT game_id) AS n FROM match_players WHERE session_id = ?")
    .get(sessionId) as { n: number };
  return row.n;
}

interface StatsRow {
  nickname: string;
  games: number;
  sum_rank: number;
  sum_kill: number;
  terminates: number;
  best_raw: number;
  last_played_at: string;
  escapes: number;
}

/**
 * 인원별 누적 전적. 배점은 조회 시점 값으로 다시 계산한다.
 * 한 판 점수 = 순위점 + 킬점 + 터미네이트횟수 × terminateBonus
 */
export function getPlayerStats(
  terminateBonus: number = TERMINATE_BONUS,
  escapeBonus: number = ESCAPE_BONUS
): PlayerStats[] {
  const rows = db
    .prepare(
      `
      WITH per_game AS (
        SELECT nickname,
               rank_score,
               kill_score,
               terminate_count,
               created_at,
               rank_score + kill_score + terminate_count * @tb AS game_score
          FROM match_players
      ),
      agg AS (
        SELECT nickname,
               COUNT(*)               AS games,
               SUM(rank_score)        AS sum_rank,
               SUM(kill_score)        AS sum_kill,
               SUM(terminate_count)   AS terminates,
               MAX(game_score)        AS best_raw,
               MAX(created_at)        AS last_played_at
          FROM per_game
         GROUP BY nickname
      ),
      esc AS (
        SELECT nickname, SUM(escapes) AS escapes FROM session_escapes GROUP BY nickname
      )
      SELECT agg.*, COALESCE(esc.escapes, 0) AS escapes
        FROM agg LEFT JOIN esc USING (nickname)
      `
    )
    .all({ tb: terminateBonus }) as StatsRow[];

  const round = (n: number) => Math.round(n * 100) / 100;

  const stats = rows
    .map((r) => {
      const totalScore =
        r.sum_rank + r.sum_kill + r.terminates * terminateBonus + r.escapes * escapeBonus;
      return {
        nickname: r.nickname,
        games: r.games,
        totalScore: round(totalScore),
        avgScore: round(totalScore / r.games),
        bestScore: round(r.best_raw),
        avgRankScore: round(r.sum_rank / r.games),
        avgKillScore: round(r.sum_kill / r.games),
        terminates: r.terminates,
        escapes: r.escapes,
        lastPlayedAt: r.last_played_at,
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
export function getSummary() {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT game_id) AS games,
              COUNT(DISTINCT nickname) AS players,
              COUNT(DISTINCT session_id) AS sessions
         FROM match_players`
    )
    .get() as { games: number; players: number; sessions: number };
  return row;
}
