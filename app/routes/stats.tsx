import { useSearchParams } from "react-router";
import type { Route } from "./+types/stats";
import { ESCAPE_BONUS, TERMINATE_BONUS } from "../lib/er-scores";
import {
  deleteSession,
  getPlayerStats,
  getSummary,
  saveSession,
} from "../db/stats.server";
import StatsTable from "../components/statsTable";
import Footer from "../components/footer";
import Tabs from "../components/tabs";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "루미섬 내전 통산 전적" },
    { name: "description", content: "저장된 내전 기록으로 인원별 평균 점수와 통산 전적을 봅니다." },
  ];
}

/** 배점은 쿼리스트링으로 받아 조회 시점에 다시 계산한다 (?tb=1.5&eb=2) */
export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const num = (key: string, fallback: number) => {
    const v = Number(url.searchParams.get(key));
    return Number.isFinite(v) && v >= 0 && url.searchParams.has(key) ? v : fallback;
  };
  const terminateBonus = num("tb", TERMINATE_BONUS);
  const escapeBonus = num("eb", ESCAPE_BONUS);

  return {
    stats: getPlayerStats(terminateBonus, escapeBonus),
    summary: getSummary(),
    terminateBonus,
    escapeBonus,
  };
}

/** 홈 화면에서 fetcher 로 호출하는 저장/삭제 엔드포인트 */
export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  try {
    if (body.intent === "delete") {
      return { ok: true, ...deleteSession(body.sessionId) };
    }
    const result = saveSession(body.sessionId, body.games ?? [], body.escapes ?? {});
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function Stats({ loaderData }: Route.ComponentProps) {
  const { stats, summary, terminateBonus, escapeBonus } = loaderData;
  const [params, setParams] = useSearchParams();

  const setBonus = (key: "tb" | "eb", value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold">통산 전적</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          저장된 내전 {summary.sessions}회 · {summary.games}판 · {summary.players}명 · 평균 점수 순
        </p>
        <Tabs />

        {/* 배점 (조회 시점에 다시 계산 — 저장된 원본 기록은 그대로) */}
        <section className="mt-6 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <h2 className="text-sm font-semibold">배점</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            DB에는 순위점·킬점·터미네이트 횟수·탈출 횟수만 저장됩니다. 배점을 바꾸면 전체 전적이 즉시 다시 계산됩니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="tb" className="text-sm font-medium text-gray-600 dark:text-gray-300">
                터미네이트 점수
              </label>
              <input
                id="tb"
                type="number"
                step="0.1"
                min="0"
                value={terminateBonus}
                onChange={(e) => setBonus("tb", e.target.value)}
                className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="eb" className="text-sm font-medium text-gray-600 dark:text-gray-300">
                탈출 점수
              </label>
              <input
                id="eb"
                type="number"
                step="0.1"
                min="0"
                value={escapeBonus}
                onChange={(e) => setBonus("eb", e.target.value)}
                className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {stats.length > 0 ? (
          <StatsTable stats={stats} />
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            아직 저장된 기록이 없습니다. 계산기에서 판을 추가한 뒤 <b>전적 DB에 저장</b>을 눌러주세요.
          </p>
        )}
        <Footer />
      </div>
    </main>
  );
}
