import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/home";
import {
  buildLeaderboard,
  calculatePlayerScores,
  parsePlayers,
  type GameRecord,
} from "../lib/er-scores";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "루미섬 내전용 점수 계산기" },
    { name: "description", content: "게임결과 csv 파일을 업로드하면 루미섬 내전 점수를 계산합니다." },
  ];
}

const STORAGE_KEY = "lumi-scrim-games";

export default function Home() {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 저장된 이전 판 기록 불러오기 (브라우저 전용)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setGames(JSON.parse(raw));
    } catch {
      /* 무시 */
    }
    setLoaded(true);
  }, []);

  // 변경 시 저장
  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  }, [games, loaded]);

  const leaderboard = useMemo(() => buildLeaderboard(games), [games]);

  const addGame = () => {
    if (!csv.trim()) return;
    try {
      const scores = calculatePlayerScores(parsePlayers(csv));
      setGames((g) => [...g, { id: crypto.randomUUID(), name: `${g.length + 1}판`, scores }]);
      setCsv("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setCsv);
    e.target.value = "";
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">루미섬 내전 점수 계산기</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          판마다 결과 CSV를 추가하면 닉네임 기준으로 점수를 누적합니다.
        </p>

        {/* 판 추가 */}
        <section className="mt-6 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">새 판 추가</h2>
            <label className="cursor-pointer rounded-md bg-gray-200 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-700">
              CSV 파일 열기
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
          </div>

          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="이번 판 CSV 내용을 붙여넣으세요 (헤더 포함)…"
            spellCheck={false}
            className="mt-3 h-36 w-full resize-y rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {error && (
            <div className="mt-2 rounded-md border border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-2.5 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <button
            onClick={addGame}
            disabled={!csv.trim()}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            이 판 추가하기
          </button>
        </section>

        {/* 추가된 판 목록 */}
        {games.length > 0 && (
          <section className="mt-4 flex flex-wrap items-center gap-2">
            {games.map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 dark:bg-gray-800 py-1 pl-3 pr-1.5 text-xs"
              >
                {g.name} · {g.scores.length}명
                <button
                  onClick={() => setGames((all) => all.filter((x) => x.id !== g.id))}
                  className="rounded-full px-1 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-red-600"
                  title="이 판 삭제"
                >
                  ✕
                </button>
              </span>
            ))}
            <button
              onClick={() => {
                if (confirm("모든 판 기록을 지울까요?")) setGames([]);
              }}
              className="ml-auto text-xs text-gray-500 hover:text-red-600"
            >
              전체 초기화
            </button>
          </section>
        )}

        {/* 누적 순위표 */}
        {leaderboard.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="bg-gray-100 dark:bg-gray-900 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
              누적 순위 · 총 {games.length}판
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-900 text-left text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="w-16 px-4 py-2.5 font-medium">순위</th>
                  <th className="px-4 py-2.5 font-medium">닉네임</th>
                  <th className="w-20 px-4 py-2.5 text-right font-medium">판수</th>
                  <th className="w-24 px-4 py-2.5 text-right font-medium">점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {leaderboard.map((r) => (
                  <tr key={r.nickname} className={r.rank <= 3 ? "bg-amber-50/60 dark:bg-amber-500/5" : ""}>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">{r.rank}</td>
                    <td className="px-4 py-2.5 font-medium">{r.nickname}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {r.games}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {Math.round(r.totalScore * 100) / 100}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
