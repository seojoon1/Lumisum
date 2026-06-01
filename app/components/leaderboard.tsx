import {type GameRecord} from "../lib/er-scores";
export default function Leaderboard(
  { leaderboard, games, escapeScore, changeEscape, copyResult, copied }: {
    leaderboard: { nickname: string; games: number; escapes: number; totalScore: number; rank: number }[];
    games: GameRecord[];
    escapeScore: number;
    changeEscape: (nickname: string, delta: number) => void;
    copyResult: () => void;
    copied: boolean;
  }
) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-900 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
              <span>누적 순위 · 총 {games.length}판 · 탈출 +{escapeScore}점/회</span>
              <button
                onClick={copyResult}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {copied ? "복사됨 ✓" : "공지용 복사"}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-900 text-left text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="w-16 px-4 py-2.5 font-medium">순위</th>
                  <th className="px-4 py-2.5 font-medium">닉네임</th>
                  <th className="w-20 px-4 py-2.5 text-right font-medium">판수</th>
                  <th className="px-4 py-2.5 text-center font-medium">탈출</th>
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
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => changeEscape(r.nickname, -1)}
                          disabled={r.escapes === 0}
                          className="h-6 w-6 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                          title="탈출 -1"
                        >
                          −
                        </button>
                        <span className="w-5 text-center tabular-nums">{r.escapes}</span>
                        <button
                          onClick={() => changeEscape(r.nickname, 1)}
                          className="h-6 w-6 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          title="탈출 +1"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {Math.round(r.totalScore * 100) / 100}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
    </div>
  );
}