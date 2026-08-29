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
import type { Client, InStatement } from "@libsql/client";
import {
  calculatePlayerScores,
  ESCAPE_BONUS,
  TERMINATE_BONUS,
  type GameRecord,
  type PlayerStats,
} from "../lib/er-scores";

export type { PlayerStats };

const DB_URL = process.env.TURSO_DATABASE_URL ?? "file:data/lumisum.db";
const IS_LOCAL_FILE = DB_URL.startsWith("file:");
/** 버셀 등 서버리스 환경인지 (파일 쓰기가 막혀 있다) */
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

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

/**
 * 클라이언트는 **첫 쿼리 때** 만든다.
 * 모듈 로드 시점에 만들면 실패했을 때 서버 함수 자체가 죽어(FUNCTION_INVOCATION_FAILED)
 * 전적과 무관한 페이지까지 500 이 된다.
 *
 * 로컬 파일(file:)은 네이티브 바인딩이 필요한 node 엔트리를, 원격은 네이티브가 필요 없는
 * web 엔트리를 쓴다. 서버리스에서는 web 엔트리만 로드되므로 네이티브 모듈 문제가 없다.
 */
let clientPromise: Promise<Client> | null = null;

function getDb(): Promise<Client> {
  return (clientPromise ??= (async () => {
    if (IS_LOCAL_FILE && IS_SERVERLESS) {
      throw new Error(
        "TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 설정되지 않았습니다. " +
          "서버리스 환경에서는 로컬 파일 DB를 쓸 수 없습니다. " +
          "버셀 Settings → Environment Variables 에 두 값을 등록하고 다시 배포하세요."
      );
    }
    const { createClient } = IS_LOCAL_FILE
      ? await import("@libsql/client")
      : await import("@libsql/client/web");
    const client = createClient({ url: DB_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    await client.executeMultiple(SCHEMA);
    return client;
  })().catch((e) => {
    clientPromise = null; // 다음 요청에서 다시 시도할 수 있게 캐시를 비운다
    throw e;
  }));
}

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
  const db = await getDb();
  const now = new Date().toISOString();

  // 첫 두 문장만 보고 args 를 string[] 로 좁히지 않도록 명시적으로 타입을 준다
  const stmts: InStatement[] = [
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
  const db = await getDb();
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
  const db = await getDb();
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
  const db = await getDb();
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
  const db = await getDb();
  const rs = await db.execute(
    `SELECT COUNT(DISTINCT game_id)   AS games,
            COUNT(DISTINCT nickname)  AS players,
            COUNT(DISTINCT session_id) AS sessions
       FROM match_players`
  );
  const r = rs.rows[0];
  return { games: Number(r.games), players: Number(r.players), sessions: Number(r.sessions) };
}
