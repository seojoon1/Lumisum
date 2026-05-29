/**
 * 이터널리턴 결과 점수 계산 (순수 로직 — 브라우저/Node 공용, 외부 의존성 없음)
 *
 * 개인 점수 = 본인 순위점 + 본인 킬점 + 소속팀 터미네이트 보너스
 *   - 터미네이트: 한 팀이 상대 팀 '전원'을 처치하면 1.5점 (팀 전원에게 부여)
 */

export interface PlayerData {
  nickname: string;
  killer: string; // 해당 플레이어를 처치한 유저 닉네임 (마지막 생존자는 빈 값)
  teamName: string; // 소속 팀
  rankScore: number; // 순위 점수 (보통 팀 공통 값)
  killScore: number; // 킬 점수 (보통 개인 값)
}

export interface PlayerScore extends PlayerData {
  terminateBonus: number; // 소속 팀이 획득한 터미네이트 보너스 합
  totalScore: number; // 최종 개인 점수
}

export const TERMINATE_BONUS = 1.5;
/** 탈출 1회당 추가 점수 (CSV에 없으므로 수동 입력) */
export const ESCAPE_BONUS = 2;

/**
 * CSV 헤더 → 내부 필드 매핑. 각 필드의 별칭은 "우선순위 순서"로 나열한다(앞쪽이 먼저 매칭).
 * 이터널리턴 공식 CSV처럼 `rank`(순위)와 `tournament rank score`(순위점수)가
 * 동시에 존재하는 경우를 위해, 점수 컬럼의 정식 명칭을 맨 앞에 둔다.
 */
export const COLUMN_ALIASES: Record<keyof PlayerData, string[]> = {
  nickname: ["nickname", "닉네임", "유저", "이름", "name", "playername", "player"],
  killer: ["killer", "처치자", "킬러", "killernickname", "lasthitby", "deathcause"],
  teamName: ["teamname", "팀명", "소속팀", "팀", "team"],
  rankScore: ["tournament rank score", "rankscore", "순위점수", "순위점", "placementscore", "rank", "순위", "placement"],
  killScore: ["tournament kill score", "killscore", "킬점수", "킬점", "killpoint", "kills", "킬", "kill"],
};

/** 따옴표/콤마/CRLF를 처리하는 최소 CSV 파서.
 *  이터널리턴 CSV는 ", " (콤마+공백) 구분자라, 따옴표 없는 필드는 자동 트림한다. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let wasQuoted = false;

  const pushField = () => {
    row.push(wasQuoted ? field : field.trim());
    field = "";
    wasQuoted = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
      wasQuoted = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushField();
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    pushField();
    if (row.some((v) => v !== "")) rows.push(row);
  }
  return rows;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_-]/g, "");

/** 헤더 행을 보고 각 내부 필드가 몇 번째 컬럼인지 찾아낸다 */
function resolveColumns(header: string[]): Record<keyof PlayerData, number> {
  const normHeader = header.map(normalize);
  const result = {} as Record<keyof PlayerData, number>;

  for (const field of Object.keys(COLUMN_ALIASES) as (keyof PlayerData)[]) {
    const aliases = COLUMN_ALIASES[field].map(normalize);
    let idx = -1;
    for (const alias of aliases) {
      idx = normHeader.indexOf(alias);
      if (idx !== -1) break;
    }
    if (idx === -1) {
      throw new Error(
        `CSV에서 '${field}' 컬럼을 찾을 수 없습니다.\n헤더=[${header.join(", ")}]`
      );
    }
    result[field] = idx;
  }
  return result;
}

/** CSV 텍스트 → PlayerData[] */
export function parsePlayers(csvText: string): PlayerData[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error("CSV에 데이터 행이 없습니다.");

  const cols = resolveColumns(rows[0]);
  return rows.slice(1).map((r, i) => {
    const num = (v: string, name: string) => {
      const n = Number(v);
      if (Number.isNaN(n)) throw new Error(`${i + 2}행 '${name}' 값이 숫자가 아닙니다: "${v}"`);
      return n;
    };
    return {
      nickname: r[cols.nickname],
      killer: r[cols.killer],
      teamName: r[cols.teamName],
      rankScore: num(r[cols.rankScore], "rankScore"),
      killScore: num(r[cols.killScore], "killScore"),
    };
  });
}

/**
 * 개인 점수 계산.
 *  - 터미네이트는 팀 인원수를 CSV에서 세어 "전원 처치"인 경우만 부여.
 *  - 팀킬/자살은 제외.
 */
export function calculatePlayerScores(matchData: PlayerData[]): PlayerScore[] {
  const playerToTeam = new Map<string, string>();
  matchData.forEach((p) => playerToTeam.set(p.nickname, p.teamName));

  const teamSize: Record<string, number> = {};
  matchData.forEach((p) => (teamSize[p.teamName] = (teamSize[p.teamName] || 0) + 1));

  const teamDeathLog: Record<string, Record<string, number>> = {};
  matchData.forEach((p) => {
    if (!p.killer) return;
    const killerTeam = playerToTeam.get(p.killer);
    if (!killerTeam || killerTeam === p.teamName) return;
    (teamDeathLog[p.teamName] ??= {})[killerTeam] =
      (teamDeathLog[p.teamName][killerTeam] || 0) + 1;
  });

  const terminateScores: Record<string, number> = {};
  for (const targetTeam in teamDeathLog) {
    for (const killerTeam in teamDeathLog[targetTeam]) {
      if (teamDeathLog[targetTeam][killerTeam] >= teamSize[targetTeam]) {
        terminateScores[killerTeam] = (terminateScores[killerTeam] || 0) + TERMINATE_BONUS;
      }
    }
  }

  return matchData.map((p) => {
    const terminateBonus = terminateScores[p.teamName] || 0;
    return { ...p, terminateBonus, totalScore: p.rankScore + p.killScore + terminateBonus };
  });
}

/** 한 판의 점수를 한 줄에 담는 기록 */
export interface GameRecord {
  id: string;
  name: string;
  scores: PlayerScore[];
}

/** 누적 순위표 한 줄 (닉네임 기준) */
export interface CumulativeRow {
  rank: number; // 동점은 같은 순위 (1,2,2,4 …)
  nickname: string;
  totalScore: number; // 탈출 보너스까지 포함한 최종 점수
  games: number; // 참여 판 수
  escapes: number; // 탈출 횟수 (수동 입력)
}

/**
 * 여러 판(GameRecord[])을 닉네임 기준으로 누적 합산해 순위표를 만든다.
 * 루미섬 내전은 판마다 팀이 바뀌므로, 팀이 아니라 닉네임이 기준이 된다.
 *
 * @param escapes 닉네임별 탈출 횟수 (수동 입력). 1회당 ESCAPE_BONUS 점 추가.
 */
export function buildLeaderboard(
  games: GameRecord[],
  escapes: Record<string, number> = {}
): CumulativeRow[] {
  const acc = new Map<string, { totalScore: number; games: number }>();
  for (const g of games) {
    for (const s of g.scores) {
      const cur = acc.get(s.nickname) ?? { totalScore: 0, games: 0 };
      cur.totalScore += s.totalScore;
      cur.games += 1;
      acc.set(s.nickname, cur);
    }
  }

  const rows = [...acc.entries()]
    .map(([nickname, v]) => {
      const escapeCount = escapes[nickname] || 0;
      return {
        nickname,
        games: v.games,
        escapes: escapeCount,
        totalScore: v.totalScore + escapeCount * ESCAPE_BONUS,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  // 동점 처리: 표준 순위(앞 등수 인원만큼 건너뜀)
  let lastScore = Number.NaN;
  let lastRank = 0;
  return rows.map((r, i) => {
    const rank = r.totalScore === lastScore ? lastRank : i + 1;
    lastScore = r.totalScore;
    lastRank = rank;
    return { rank, ...r };
  });
}
