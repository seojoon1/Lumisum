/**
 * 이터널리턴 게임 결과 CSV → 점수 계산기 (CLI)
 *
 * 사용법:
 *   npx tsx scripts/calculate-er-scores.ts <입력.csv> [출력.csv]
 *
 * 점수 계산 로직은 app/lib/er-scores.ts(브라우저/Node 공용)를 그대로 사용한다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { calculatePlayerScores, parsePlayers, type PlayerScore } from "../app/lib/er-scores";

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
    sorted.map((s, i) => ({
      순위: i + 1,
      닉네임: s.nickname,
      팀: s.teamName,
      순위점: s.rankScore,
      킬점: s.killScore,
      터미네이트: s.terminateBonus,
      합계: s.totalScore,
    }))
  );

  const teamTotals: Record<string, number> = {};
  scores.forEach((s) => (teamTotals[s.teamName] = (teamTotals[s.teamName] || 0) + s.totalScore));
  console.log("\n=== 팀 합계 (높은 순) ===");
  console.table(
    Object.entries(teamTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([팀, 합계]) => ({ 팀, 합계 }))
  );
}

function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath) {
    console.error("사용법: npx tsx scripts/calculate-er-scores.ts <입력.csv> [출력.csv]");
    process.exit(1);
  }

  const players = parsePlayers(readFileSync(inputPath, "utf-8"));
  const scores = calculatePlayerScores(players);

  printTable(scores);

  if (outputPath) {
    writeFileSync(outputPath, "﻿" + toCsv(scores), "utf-8"); // BOM: 엑셀 한글 깨짐 방지
    console.log(`\n저장됨 → ${outputPath}`);
  }
}

main();
