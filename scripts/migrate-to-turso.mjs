/**
 * 로컬 파일 DB(data/lumisum.db)에 쌓인 전적을 Turso 로 옮긴다.
 * Turso CLI 없이 동작한다.
 *
 *   node --env-file=.env scripts/migrate-to-turso.mjs
 *
 * .env 에 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 이 채워져 있어야 한다.
 * 여러 번 돌려도 같은 행은 덮어쓰므로 중복되지 않는다.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  console.error("TURSO_DATABASE_URL 이 비어 있습니다. .env 를 확인하세요.");
  process.exit(1);
}

const local = createClient({ url: "file:data/lumisum.db" });
const remote = createClient({ url, authToken });

// 원격에 테이블이 없을 수 있으니 스키마부터 맞춘다 (앱 서버가 만드는 것과 동일)
await remote.executeMultiple(`
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

const players = await local.execute("SELECT * FROM match_players");
const escapes = await local.execute("SELECT * FROM session_escapes");

if (players.rows.length === 0) {
  console.log("옮길 기록이 없습니다. (data/lumisum.db 가 비어 있음)");
  process.exit(0);
}

const stmts = [
  ...players.rows.map((r) => ({
    sql: `INSERT OR REPLACE INTO match_players
            (session_id, game_id, game_no, nickname, team_name, rank_score, kill_score, terminate_count, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [r.session_id, r.game_id, r.game_no, r.nickname, r.team_name, r.rank_score, r.kill_score, r.terminate_count, r.created_at],
  })),
  ...escapes.rows.map((r) => ({
    sql: "INSERT OR REPLACE INTO session_escapes (session_id, nickname, escapes) VALUES (?, ?, ?)",
    args: [r.session_id, r.nickname, r.escapes],
  })),
];

await remote.batch(stmts, "write");

const after = await remote.execute(
  "SELECT COUNT(DISTINCT session_id) s, COUNT(DISTINCT game_id) g, COUNT(*) rows FROM match_players"
);
const { s, g, rows } = after.rows[0];
console.log(`옮겼습니다 → 내전 ${s}회 · ${g}판 · ${rows}행 (탈출 ${escapes.rows.length}건)`);
