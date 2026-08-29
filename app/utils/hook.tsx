
import { useMemo, useRef, useEffect,useState } from "react";
import type { GameRecord } from "../lib/er-scores";

type LeaderRow = { rank: number; nickname: string; totalScore: number };

export function useAnnouncement(leaderboard: LeaderRow[], games: GameRecord[]) {
  return useMemo(() => {
    if (leaderboard.length === 0) return "";
    const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`);
    const fmt = (n: number) => String(Math.round(n * 100) / 100);
    const seed = (rank: number) => (rank <= 8 ? "1st" : rank >= 17 ? "3rd" : "2nd");
    const lines = leaderboard.map((r) => `${medal(r.rank)} ${r.nickname} - ${fmt(r.totalScore)}점 (${seed(r.rank)})`);
    return [`📢 루미섬 내전 결과 (총 ${games.length}판)`, "", ...lines].join("\n");
  }, [leaderboard, games.length]);
}

export function useLocalStorage<T>(
  key: string,
  initial: T,
  serialize: (v: T) => string = JSON.stringify,
  deserialize: (s: string) => T = JSON.parse
) {
  const [value, setValue] = useState<T>(initial);
  // 복원이 끝났는지. ref 가 아니라 state 인 이유는, 복원 완료를 기다리는
  // 바깥 effect(예: 배점을 URL 로 동기화)가 이 값의 변화로 다시 돌아야 하기 때문.
  const [loaded, setLoaded] = useState(false);

  // 복원 (마운트 시 1회)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(deserialize(raw));
    } catch {
      /* 무시 */
    }
    setLoaded(true);
  }, [key]);

  // 변경 시 저장 (복원 끝난 뒤에만 — 안 그러면 초기값이 저장된 값을 덮어쓴다)
  useEffect(() => {
    if (loaded) localStorage.setItem(key, serialize(value));
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}
