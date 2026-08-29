import { useEffect, useMemo, useState } from "react";
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
import SearchBar from "../components/searchBar";
import { useLocalStorage } from "../utils/hook";
import { STORAGE_KEYS } from "../lib/storage-keys";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "루미섬 내전 통산 전적" },
    { name: "description", content: "저장된 내전 기록으로 인원별 평균 점수와 통산 전적을 봅니다." },
  ];
}

/** 배점은 쿼리스트링으로 받아 조회 시점에 다시 계산한다 (?tb=1.5&eb=2) */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const num = (key: string, fallback: number) => {
    const v = Number(url.searchParams.get(key));
    return Number.isFinite(v) && v >= 0 && url.searchParams.has(key) ? v : fallback;
  };
  const terminateBonus = num("tb", TERMINATE_BONUS);
  const escapeBonus = num("eb", ESCAPE_BONUS);

  // DB가 안 붙어도 페이지는 떠야 한다. 여기서 던지면 서버 함수째로 500 이 된다.
  try {
    // 조회 두 건은 서로 독립적이라 병렬로
    const [stats, summary] = await Promise.all([
      getPlayerStats(terminateBonus, escapeBonus),
      getSummary(),
    ]);
    return { stats, summary, terminateBonus, escapeBonus, dbError: null };
  } catch (e) {
    console.error("[stats] DB 조회 실패:", e);
    return {
      stats: [],
      summary: { games: 0, players: 0, sessions: 0 },
      terminateBonus,
      escapeBonus,
      dbError: e instanceof Error ? e.message : String(e),
    };
  }
}

/** 홈 화면에서 fetcher 로 호출하는 저장/삭제 엔드포인트 */
export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  try {
    if (body.intent === "delete") {
      return { ok: true, ...(await deleteSession(body.sessionId)) };
    }
    const result = await saveSession(body.sessionId, body.games ?? [], body.escapes ?? {});
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function Stats({ loaderData }: Route.ComponentProps) {
  // 배점은 loaderData 가 아니라 localStorage 값을 화면에 쓴다 (loader 는 계산에만 사용)
  const { stats, summary, dbError } = loaderData;
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");

  // 배점의 원본은 localStorage 다 (계산기 탭과 공유). 서버 loader 는 이 값을 읽을 수 없으므로
  // 아래 effect 로 URL 에 실어 보내고, loader 가 그 값으로 다시 계산한다.
  const [tScore, setTScore, tLoaded] = useLocalStorage(STORAGE_KEYS.terminateScore, TERMINATE_BONUS);
  const [eScore, setEScore, eLoaded] = useLocalStorage(STORAGE_KEYS.escapeScore, ESCAPE_BONUS);

  useEffect(() => {
    if (!tLoaded || !eLoaded) return; // 복원 전에는 기본값이라 URL 을 건드리지 않는다
    if (params.get("tb") === String(tScore) && params.get("eb") === String(eScore)) return;
    setParams({ tb: String(tScore), eb: String(eScore) }, { replace: true, preventScrollReset: true });
  }, [tScore, eScore, tLoaded, eLoaded, params, setParams]);

  // 검색어로 걸러낸 전적표. 순위 번호는 전체 기준이라 필터해도 실제 등수가 유지된다.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter((s) => s.nickname.toLowerCase().includes(q));
  }, [stats, query]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold">통산 전적</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          저장된 내전 {summary.sessions}회 · {summary.games}판 · {summary.players}명 · 평균 점수 순
        </p>
        <Tabs />

        {stats.length > 0 && (
          <SearchBar
            query={query}
            setQuery={setQuery}
            matched={visible.length}
            total={stats.length}
          />
        )}

        {/* 배점 (조회 시점에 다시 계산 — 저장된 원본 기록은 그대로) */}
        <section className="mt-6 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <h2 className="text-sm font-semibold">배점</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            DB에는 순위점·킬점·터미네이트 횟수·탈출 횟수만 저장됩니다. 배점을 바꾸면 전체 전적이 즉시 다시 계산되고, 점수 계산기 탭과 같은 값을 씁니다.
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
                value={tScore}
                onChange={(e) => setTScore(Number(e.target.value))}
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
                value={eScore}
                onChange={(e) => setEScore(Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {dbError && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold">전적 DB에 연결하지 못했습니다.</p>
            <p className="mt-1 whitespace-pre-wrap text-xs">{dbError}</p>
          </div>
        )}

        {stats.length > 0 ? (
          visible.length > 0 && <StatsTable stats={visible} />
        ) : (
          !dbError && <p className="mt-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            아직 저장된 기록이 없습니다. 계산기에서 판을 추가한 뒤 <b>전적 DB에 저장</b>을 눌러주세요.
          </p>
        )}
        <Footer />
      </div>
    </main>
  );
}
