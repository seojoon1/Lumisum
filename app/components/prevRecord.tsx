import { type GameRecord } from "../lib/er-scores";
export default function prevRecord(
  {games, resetAllGames, resetGame}:{games: GameRecord[]; resetAllGames: () => void; resetGame: (id: string) => void}
) 
{
  return (
      <section className="mt-4 flex flex-wrap items-center gap-2">
        {games.map((g) => (
          <span
            key={g.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 dark:bg-gray-800 py-1 pl-3 pr-1.5 text-xs"
          >
            {g.name} · {g.scores.length}명
            <button
              onClick={() => resetGame(g.id)}
              className="rounded-full px-1 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-red-600"
              title="이 판 삭제"
            >
              ✕
            </button>
          </span>
        ))}
        <button
          onClick={() => {
            if (confirm("모든 판 기록을 지울까요?")) {
              resetAllGames();
            }
          }}
          className="ml-auto text-xs text-gray-500 hover:text-red-600"
        >
          전체 초기화
        </button>
      </section>
  )
}