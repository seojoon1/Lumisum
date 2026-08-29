import type { PlayerStats } from "../lib/er-scores";

export default function StatsTable({ stats }: { stats: PlayerStats[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-gray-100 dark:bg-gray-900 text-left text-gray-500 dark:text-gray-400">
          <tr>
            <th className="w-14 px-3 py-2.5 font-medium">순위</th>
            <th className="px-3 py-2.5 font-medium">닉네임</th>
            <th className="w-16 px-3 py-2.5 text-right font-medium">판수</th>
            <th className="w-24 px-3 py-2.5 text-right font-medium">평균 점수</th>
            <th className="w-20 px-3 py-2.5 text-right font-medium">총점</th>
            <th className="w-24 px-3 py-2.5 text-right font-medium" title="탈출 제외 한 판 최고 점수">
              최고 한 판
            </th>
            <th className="w-24 px-3 py-2.5 text-right font-medium">평균 순위점</th>
            <th className="w-20 px-3 py-2.5 text-right font-medium">평균 킬점</th>
            <th className="w-20 px-3 py-2.5 text-right font-medium">터미</th>
            <th className="w-16 px-3 py-2.5 text-right font-medium">탈출</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {stats.map((s) => (
            <tr key={s.nickname} className={s.rank <= 3 ? "bg-amber-50/60 dark:bg-amber-500/5" : ""}>
              <td className="px-3 py-2.5 font-semibold tabular-nums">{s.rank}</td>
              <td className="px-3 py-2.5 font-medium">{s.nickname}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{s.games}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{s.avgScore}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{s.totalScore}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{s.bestScore}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{s.avgRankScore}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{s.avgKillScore}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{s.terminates}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{s.escapes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
