/**
 * 이터널리턴 게임 결과 CSV → 점수 계산기
 *
 * 사용법:
 *   npx tsx scripts/calculate-er-scores.ts <입력.csv> [출력.csv]
 *   (tsx 없으면: node --experimental-strip-types scripts/calculate-er-scores.ts <입력.csv>)
 *
 * 동작:
 *   1) CSV를 파싱해 PlayerData[] 로 변환 (헤더 자동 매핑, 아래 COLUMN_ALIASES 참고)
 *   2) 팀 단위 터미네이트(상대 팀 전원 처치) 보너스를 계산
 *   3) 각 플레이어 개인 점수( = 본인 순위점 + 본인 킬점 + 소속팀 터미네이트 보너스 )를 부여
 *   4) 콘솔에 표로 출력하고, 출력 경로를 주면 CSV로 저장
 */

import { readFileSync, writeFileSync } from "node:fs";

interface PlayerData {
  nickname: string;
  killer: string; // 해당 플레이어를 처치한 유저 닉네임 (마지막 생존자는 빈 값)
  teamName: string; // 소속 팀
  rankScore: number; // 순위 점수 (보통 팀 공통 값)
  killScore: number; // 킬 점수 (보통 개인 값)
}

interface PlayerScore extends PlayerData {
  terminateBonus: number; // 소속 팀이 획득한 터미네이트 보너스 합
  totalScore: number; // 최종 개인 점수
}

// --- 설정 ----------------------------------------------------------------

/** 한 팀의 인원 수. "전원 처치"(터미네이트) 판정 기준.
 *  CSV에서 팀별 실제 인원으로 자동 계산하므로 보통 손댈 필요 없음. */
const TERMINATE_BONUS = 1.5;

/**
 * CSV 헤더 → 내부 필드 매핑.
 * 각 필드의 별칭은 "우선순위 순서"로 나열한다(앞쪽이 먼저 매칭).
 * 이터널리턴 공식 CSV처럼 `rank`(순위)와 `tournament rank score`(순위점수)가
 * 동시에 존재하는 경우를 위해, 점수 컬럼의 정식 명칭을 맨 앞에 둔다.
 * 실제 헤더가 다르면 여기에 추가만 하면 됩니다. (소문자/공백 무시 비교)
 */
const COLUMN_ALIASES: Record<keyof PlayerData, string[]> = {
  nickname: ["nickname", "닉네임", "유저", "이름", "name", "playername", "player"],
  killer: ["killer", "처치자", "킬러", "killernickname", "lasthitby", "deathcause"],
  teamName: ["teamname", "팀명", "소속팀", "팀", "team"],
  rankScore: ["tournament rank score", "rankscore", "순위점수", "순위점", "placementscore", "rank", "순위", "placement"],
  killScore: ["tournament kill score", "killscore", "킬점수", "킬점", "killpoint", "kills", "킬", "kill"],
};

// --- CSV 파싱 ------------------------------------------------------------

/** 따옴표/콤마/CRLF를 처리하는 최소 CSV 파서 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

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
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
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
    // 별칭을 우선순위 순서로 훑어 가장 먼저 매칭되는 컬럼을 사용한다.
    let idx = -1;
    for (const alias of aliases) {
      idx = normHeader.indexOf(alias);
      if (idx !== -1) break;
    }
    if (idx === -1) {
      throw new Error(
        `CSV에서 '${field}' 컬럼을 찾을 수 없습니다. 헤더=[${header.join(", ")}]\n` +
          `→ scripts/calculate-er-scores.ts 의 COLUMN_ALIASES.${field} 에 실제 헤더명을 추가하세요.`
      );
    }
    result[field] = idx;
  }
  return result;
}

function loadPlayers(csvPath: string): PlayerData[] {
  const rows = parseCsv(readFileSync(csvPath, "utf-8"));
  if (rows.length < 2) throw new Error("CSV에 데이터 행이 없습니다.");

  const cols = resolveColumns(rows[0]);
  return rows.slice(1).map((r, i) => {
    const num = (v: string, name: string) => {
      const n = Number(String(v).trim());
      if (Number.isNaN(n)) throw new Error(`${i + 2}행 '${name}' 값이 숫자가 아닙니다: "${v}"`);
      return n;
    };
    return {
      nickname: r[cols.nickname].trim(),
      killer: r[cols.killer].trim(),
      teamName: r[cols.teamName].trim(),
      rankScore: num(r[cols.rankScore], "rankScore"),
      killScore: num(r[cols.killScore], "killScore"),
    };
  });
}

// --- 점수 계산 -----------------------------------------------------------

/**
 * 원본 calculateTeamScores 로직을 기반으로 하되, 개인 점수 산출용으로 정리한 버전.
 *
 * 원본 대비 변경/주의점:
 *  (1) 원본은 teamDeathLog[target][killer] === 3 으로 "3인 전원 처치"를 가정했지만,
 *      팀 인원이 3이 아닐 수도 있으므로 CSV에서 팀별 실제 인원수를 계산해 그 값과 비교한다.
 *  (2) 원본 finalScores 는 팀의 '첫 번째' 플레이어 rankScore+killScore 만 합산해
 *      나머지 팀원의 킬 점수가 누락되는 버그가 있었다. 여기서는 개인별로 본인 점수를
 *      그대로 부여하므로 그 문제가 없다. (팀 합계가 필요하면 개인 점수를 합산하면 됨)
 */
function calculatePlayerScores(matchData: PlayerData[]): PlayerScore[] {
  // 1) 닉네임 → 팀 매핑
  const playerToTeam = new Map<string, string>();
  matchData.forEach((p) => playerToTeam.set(p.nickname, p.teamName));

  // 팀별 인원 수
  const teamSize: Record<string, number> = {};
  matchData.forEach((p) => (teamSize[p.teamName] = (teamSize[p.teamName] || 0) + 1));

  // 2) 어떤 팀이 어떤 팀에게 죽었는지 카운팅
  const teamDeathLog: Record<string, Record<string, number>> = {};
  matchData.forEach((p) => {
    if (!p.killer) return; // 최후 생존자 등 처치자 없음
    const killerTeam = playerToTeam.get(p.killer);
    if (!killerTeam) return; // 알 수 없는 처치자(외부/봇 등)
    if (killerTeam === p.teamName) return; // 자살/팀킬은 터미네이트 제외

    (teamDeathLog[p.teamName] ??= {})[killerTeam] =
      (teamDeathLog[p.teamName][killerTeam] || 0) + 1;
  });

  // 3) 터미네이트 보너스: 특정 팀이 상대 팀 '전원'을 처치한 경우
  const terminateScores: Record<string, number> = {};
  for (const targetTeam in teamDeathLog) {
    for (const killerTeam in teamDeathLog[targetTeam]) {
      if (teamDeathLog[targetTeam][killerTeam] >= teamSize[targetTeam]) {
        terminateScores[killerTeam] = (terminateScores[killerTeam] || 0) + TERMINATE_BONUS;
      }
    }
  }

  // 4) 개인 점수 = 본인 순위점 + 본인 킬점 + 소속팀 터미네이트 보너스
  return matchData.map((p) => {
    const terminateBonus = terminateScores[p.teamName] || 0;
    return {
      ...p,
      terminateBonus,
      totalScore: p.rankScore + p.killScore + terminateBonus,
    };
  });
}

// --- 출력 ----------------------------------------------------------------

function toCsv(scores: PlayerScore[]): string {
  const header = ["nickname", "teamName", "rankScore", "killScore", "terminateBonus", "totalScore"];
  const lines = scores.map((s) =>
    [s.nickname, s.teamName, s.rankScore, s.killScore, s.terminateBonus, s.totalScore]
      .map((v) => {
        const str = String(v);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function printTable(scores: PlayerScore[]) {
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
  console.log("\n=== 개인 점수 (높은 순) ===");
  console.table(
    sorted.map((s) => ({
      닉네임: s.nickname,
      팀: s.teamName,
      순위점: s.rankScore,
      킬점: s.killScore,
      터미네이트: s.terminateBonus,
      합계: s.totalScore,
    }))
  );

  // 팀 합계도 함께 (개인 점수 합산)
  const teamTotals: Record<string, number> = {};
  scores.forEach((s) => (teamTotals[s.teamName] = (teamTotals[s.teamName] || 0) + s.totalScore));
  console.log("\n=== 팀 합계 (높은 순) ===");
  console.table(
    Object.entries(teamTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([팀, 합계]) => ({ 팀, 합계 }))
  );
}

// --- 진입점 --------------------------------------------------------------

function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath) {
    console.error("사용법: npx tsx scripts/calculate-er-scores.ts <입력.csv> [출력.csv]");
    process.exit(1);
  }

  const players = loadPlayers(inputPath);
  const scores = calculatePlayerScores(players);

  printTable(scores);

  if (outputPath) {
    writeFileSync(outputPath, "﻿" + toCsv(scores), "utf-8"); // BOM: 엑셀 한글 깨짐 방지
    console.log(`\n저장됨 → ${outputPath}`);
  }
}

main();

export { calculatePlayerScores, type PlayerData, type PlayerScore };
