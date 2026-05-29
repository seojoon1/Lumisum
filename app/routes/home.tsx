import { useMemo, useState } from "react";
import type { Route } from "./+types/home";
import {
  calculatePlayerScores,
  parsePlayers,
  type PlayerScore,
} from "../lib/er-scores";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "루미섬 내전용 점수 계산기" },
    { name: "description", content: "게임결과 csv 파일을 업로드하면 루미섬 내전 점수를 계산합니다." },
  ];
}

type Result =
  | { ok: true; scores: PlayerScore[] }
  | { ok: false; error: string }
  | null;

export default function Home() {
  const [csv, setCsv] = useState("");

  const result: Result = useMemo(() => {
    if (!csv.trim()) return null;
    try {
      const scores = calculatePlayerScores(parsePlayers(csv));
      scores.sort((a, b) => b.totalScore - a.totalScore);
      return { ok: true, scores };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, [csv]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setCsv);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">루미섬 내전용 점수 계산기</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          게임 결과 CSV를 붙여넣거나 파일을 올리면 순위·닉네임·점수를 계산합니다.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <label className="cursor-pointer rounded-md bg-gray-200 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-700">
            CSV 파일 열기
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          {csv && (
            <button
              onClick={() => setCsv("")}
              className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
            >
              지우기
            </button>
          )}
        </div>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="여기에 CSV 내용을 붙여넣으세요 (헤더 포함)…"
          spellCheck={false}
          className="mt-3 h-48 w-full resize-y rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {result?.ok === false && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
            {result.error}
          </div>
        )}

        {result?.ok && <Ranking scores={result.scores} />}
      </div>
    </main>
  );
}

function Ranking({ scores }: { scores: PlayerScore[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-900 text-left text-gray-500 dark:text-gray-400">
          <tr>
            <th className="w-16 px-4 py-2.5 font-medium">순위</th>
            <th className="px-4 py-2.5 font-medium">닉네임</th>
            <th className="px-4 py-2.5 font-medium">팀</th>
            <th className="px-4 py-2.5 text-right font-medium">점수</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {scores.map((s, i) => (
            <tr
              key={s.nickname + i}
              className={i < 3 ? "bg-amber-50/60 dark:bg-amber-500/5" : ""}
            >
              <td className="px-4 py-2.5 font-semibold tabular-nums">{i + 1}</td>
              <td className="px-4 py-2.5 font-medium">{s.nickname}</td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{s.teamName}</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {s.totalScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
