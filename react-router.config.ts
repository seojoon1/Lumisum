import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  // SSR 사용 (전적 DB를 loader/action 에서 조회하므로 필수)
  ssr: true,
  // 버셀이 인식하는 산출물(.vercel/output)로 빌드
  presets: [vercelPreset()],
} satisfies Config;
