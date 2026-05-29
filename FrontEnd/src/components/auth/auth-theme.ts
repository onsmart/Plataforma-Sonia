import type { ComponentProps } from "react";
import type LineWaves from "./LineWaves";

/** Props compartilhados entre AuthPage e WelcomeSplash (visual login). */
export const AUTH_LINE_WAVES_PROPS: ComponentProps<typeof LineWaves> = {
  speed: 0.3,
  innerLineCount: 32,
  outerLineCount: 36,
  warpIntensity: 1,
  rotation: -45,
  edgeFadeWidth: 0,
  colorCycleSpeed: 1,
  brightness: 0.2,
  color1: "#000000",
  color2: "#2563eb",
  color3: "#4f46e5",
  enableMouseInteraction: true,
  mouseInfluence: 2,
};

export const WELCOME_ENTER_MS = 600;
export const WELCOME_HOLD_MS = 1800;
export const WELCOME_EXIT_MS = 900;
export const WELCOME_NAME_WAIT_MS = 400;

export const WELCOME_TOTAL_MS =
  WELCOME_ENTER_MS + WELCOME_HOLD_MS + WELCOME_EXIT_MS;
