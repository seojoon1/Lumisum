import { Link, useFetcher, type SubmitTarget } from "react-router";
import type { GameRecord } from "../lib/er-scores";

/**
 * 현재 세션(오늘 내전)을 서버 DB에 저장한다.
 * 같은 sessionId 로 다시 저장하면 덮어쓰므로, 판을 추가한 뒤 다시 눌러도 중복되지 않는다.
 */
export default function SaveToDb({
  ensureSessionId,
  games,
  escapes,
}: {
  /** 저장 시점에 이번 내전의 세션 ID를 발급/반환 */
  ensureSessionId: () => string;
  games: GameRecord[];
  escapes: Record<string, number>;
}) {
  const fetcher = useFetcher<{ ok: boolean; games?: number; removed?: number; error?: string }>();
  const busy = fetcher.state !== "idle";

  const send = (intent: "save" | "delete") =>
    fetcher.submit(
      // 인터페이스 타입이라 JsonValue 로 좁혀지지 않을 뿐, 실제로는 순수 JSON
      { intent, sessionId: ensureSessionId(), games, escapes } as unknown as SubmitTarget,
      { action: "/stats", method: "post", encType: "application/json" }
    );

  return (
    <section className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">전적 DB</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            이번 내전 {games.length}판을 서버에 저장하면 인원별 평균 점수가 통산 전적에 쌓입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/stats"
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            통산 전적 보기
          </Link>
          <button
            onClick={() => send("save")}
            disabled={busy || games.length === 0}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {busy ? "저장 중…" : "전적 DB에 저장"}
          </button>
        </div>
      </div>

      {fetcher.data?.ok && fetcher.data.games !== undefined && (
        <p className="mt-3 text-xs text-green-600 dark:text-green-400">
          {fetcher.data.games}판을 저장했습니다.{" "}
          <button onClick={() => send("delete")} className="underline hover:no-underline">
            이 내전 기록 삭제
          </button>
        </p>
      )}
      {fetcher.data?.ok && fetcher.data.removed !== undefined && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          이 내전 기록을 DB에서 삭제했습니다.
        </p>
      )}
      {fetcher.data?.ok === false && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">저장 실패: {fetcher.data.error}</p>
      )}
    </section>
  );
}
