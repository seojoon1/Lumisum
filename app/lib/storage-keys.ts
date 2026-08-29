/** 브라우저 localStorage 키. 계산기와 통산 전적이 같은 값을 공유한다. */
export const STORAGE_KEYS = {
  games: "lumi-scrim-games",
  escapes: "lumi-scrim-escapes",
  /** 터미네이트 배점 (두 탭 공용) */
  terminateScore: "lumi-scrim-terminate-score",
  /** 탈출 배점 (두 탭 공용) */
  escapeScore: "lumi-scrim-escape-score",
  sessionId: "lumi-scrim-session-id",
} as const;
