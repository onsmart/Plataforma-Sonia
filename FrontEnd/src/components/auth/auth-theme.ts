import type { ComponentProps } from "react";
import type LineWaves from "./LineWaves";

/** Props compartilhados entre AuthPage, WelcomeSplash e LogoutOverlay. */
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

/** Curva suave para entradas/saídas (ease-out natural). */
export const AUTH_EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

export const WELCOME_ENTER_MS = 900;
export const WELCOME_HOLD_MS = 2100;
export const WELCOME_EXIT_MS = 1100;
/** App começa a aparecer antes da splash sumir (crossfade). */
export const WELCOME_APP_ENTER_OVERLAP_MS = 450;
export const WELCOME_NAME_WAIT_MS = 400;

export const APP_SHELL_ENTER_MS = 1100;

export const LOGOUT_MIN_MS = 900;
export const LOGOUT_ENTER_MS = 400;

export const WELCOME_TOTAL_MS =
  WELCOME_ENTER_MS + WELCOME_HOLD_MS + WELCOME_EXIT_MS;

export function getReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getWelcomeTimings() {
  const reduced = getReducedMotion();
  return {
    enterMs: reduced ? 0 : WELCOME_ENTER_MS,
    holdMs: reduced ? 700 : WELCOME_HOLD_MS,
    exitMs: reduced ? 0 : WELCOME_EXIT_MS,
    appOverlapMs: reduced ? 0 : WELCOME_APP_ENTER_OVERLAP_MS,
    appEnterMs: reduced ? 0 : APP_SHELL_ENTER_MS,
  };
}

export function getLogoutTimings() {
  const reduced = getReducedMotion();
  return {
    minMs: reduced ? 400 : LOGOUT_MIN_MS,
    enterMs: reduced ? 0 : LOGOUT_ENTER_MS,
  };
}
