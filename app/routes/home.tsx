import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/home";
import {
  buildLeaderboard,
  calculatePlayerScores,
  ESCAPE_BONUS,
  parsePlayers,
  TERMINATE_BONUS,
  type GameRecord,
} from "../lib/er-scores";
import Footer from "../components/footer";
import LBC from "../components/leaderboard"; // 리더보드 컴포넌트 분리
import PrevRecord from "../components/prevRecord"; // 이전 기록 관리 컴포넌트 분리
import SaveToDb from "../components/saveToDb"; // 서버 전적 DB 저장
import { useAnnouncement, useLocalStorage } from "../utils/hook"; // 공지용 텍스트 훅

export function meta({}: Route.MetaArgs) {
  return [
    { title: "루미섬 내전용 점수 계산기" },
    { name: "description", content: "게임결과 csv 파일을 업로드하면 루미섬 내전 점수를 계산합니다." },
  ];
}

const STORAGE_KEY = "lumi-scrim-games";
const ESCAPE_KEY = "lumi-scrim-escapes";
const TERMINATE_SCORE_KEY = "lumi-scrim-terminate-score";
const ESCAPE_SCORE_KEY = "lumi-scrim-escape-score";
// 이번 내전을 서버 DB에서 식별하는 키. 전체 초기화 = 새 내전 시작이라 새로 발급한다.
const SESSION_KEY = "lumi-scrim-session-id";

export default function Home() {
  const [games, setGames] = useLocalStorage<GameRecord[]>(STORAGE_KEY, []);
  const [escapes, setEscapes] = useLocalStorage<Record<string, number>>(ESCAPE_KEY, {});
  const [sessionId, setSessionId] = useLocalStorage(SESSION_KEY, "");
  const [csv, setCsv] = useState("");
  // 전역 점수 설정 (localStorage 저장, 모든 판에 소급 적용)
  const [terminateScore, setTerminateScore] = useLocalStorage(TERMINATE_SCORE_KEY, TERMINATE_BONUS);
  const [escapeScore, setEscapeScore] = useLocalStorage(ESCAPE_SCORE_KEY, ESCAPE_BONUS);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // 저장된 이전 판 기록 불러오기 (브라우저 전용)
  const leaderboard = useMemo(
    () => buildLeaderboard(games, escapes, terminateScore, escapeScore),
    [games, escapes, terminateScore, escapeScore]
  );

  const changeEscape = (nickname: string, delta: number) => {
    setEscapes((prev) => {
      const next = { ...prev };
      const v = (next[nickname] || 0) + delta;
      if (v <= 0) delete next[nickname];
      else next[nickname] = v;
      return next;
    });
  };

  /** 세션 ID는 첫 저장 시점에 발급한다 (마운트 시 만들면 localStorage 복원값을 덮어씀) */
  const ensureSessionId = () => {
    if (sessionId) return sessionId;
    const id = crypto.randomUUID();
    setSessionId(id);
    return id;
  };

  const addGame = () => {
    if (!csv.trim()) return;
    try {
      // 원본 점수만 저장. 터미네이트/탈출 점수는 순위표에서 전역 설정으로 다시 계산됨
      const scores = calculatePlayerScores(parsePlayers(csv));
      setGames((g) => [...g, { id: crypto.randomUUID(), name: `${g.length + 1}판`, scores }]);
      setCsv("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // 공지용 텍스트 만들기
const announcement = useAnnouncement(leaderboard, games);


  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(announcement);
    } catch {
      // 클립보드 권한 실패 시 폴백
      const ta = document.createElement("textarea");
      ta.value = announcement;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setCsv);
    e.target.value = "";
  };

  const resetGame = (id: string) => {
    setGames((all) => all.filter((x) => x.id !== id));
  };
  const resetAllGames = () => {
    setGames([]);
    setEscapes({});
    setSessionId(""); // 다음 저장 때 새 세션 ID를 발급해 이전 내전 기록을 덮어쓰지 않게 한다

    setEscapeScore(ESCAPE_BONUS);
    setTerminateScore(TERMINATE_BONUS);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">루미섬 내전 점수 계산기</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          판마다 결과 CSV를 추가하면 닉네임 기준으로 점수를 누적합니다.
        </p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
          정보를 원한다면? <a href="/info" className="text-blue-600 hover:underline">
            여기
          </a>를 클릭하세요.
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

        {/* 점수 설정 (전역 · 저장됨 · 모든 판에 소급 적용) */}
        <section className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <h2 className="text-sm font-semibold">점수 설정</h2>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            바꾸면 저장되어 모든 판의 순위에 즉시 반영됩니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="terminate" className="text-sm font-medium text-gray-600 dark:text-gray-300">
                터미네이트 점수
              </label>
              <input
                id="terminate"
                type="number"
                step="0.1"
                min="0"
                value={terminateScore}
                onChange={(e) => setTerminateScore(Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="escape" className="text-sm font-medium text-gray-600 dark:text-gray-300">
                탈출 점수
              </label>
              <input
                id="escape"
                type="number"
                step="0.1"
                min="0"
                value={escapeScore}
                onChange={(e) => setEscapeScore(Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {/* 추가된 판 목록 */}
        {games.length > 0 && <PrevRecord games={games} resetAllGames={resetAllGames} resetGame={resetGame} />}
        {/* 누적 순위표 */}
        {games.length > 0 && (
          <SaveToDb ensureSessionId={ensureSessionId} games={games} escapes={escapes} />
        )}
        {leaderboard.length > 0 && <LBC leaderboard={leaderboard} games={games} escapeScore={escapeScore} changeEscape={changeEscape} copyResult={copyResult} copied={copied} />}
        <Footer />
      </div>
    </main>
  );
}
