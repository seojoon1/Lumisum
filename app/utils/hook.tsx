
import { useMemo, useRef, useEffect,useState } from "react";
import type { GameRecord } from "../lib/er-scores";

type LeaderRow = { rank: number; nickname: string; totalScore: number };

export function useAnnouncement(leaderboard: LeaderRow[], games: GameRecord[]) {
  return useMemo(() => {
    if (leaderboard.length === 0) return "";
    const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`);
    const fmt = (n: number) => String(Math.round(n * 100) / 100);
    const lines = leaderboard.map((r) => `${medal(r.rank)} ${r.nickname} - ${fmt(r.totalScore)}점`);
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
  const loaded = useRef(false);

  // 복원 (마운트 시 1회)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(deserialize(raw));
    } catch {
      /* 무시 */
    }
    loaded.current = true;
  }, [key]);

  // 변경 시 저장 (복원 끝난 뒤에만)
  useEffect(() => {
    if (loaded.current) localStorage.setItem(key, serialize(value));
  }, [key, value]);

  return [value, setValue] as const;
}
