import { Sparkles } from "lucide-react";
import LineWaves from "./LineWaves";
import { AUTH_LINE_WAVES_PROPS } from "./auth-theme";
import { useWelcomeDisplayName } from "../../hooks/useWelcomeDisplayName";
import "./WelcomeSplash.css";

type WelcomeSplashProps = {
  visible: boolean;
  exiting?: boolean;
};

export function WelcomeSplash({ visible, exiting = false }: WelcomeSplashProps) {
  const displayName = useWelcomeDisplayName(visible);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`welcome-splash fixed inset-0 z-[9999] overflow-hidden bg-zinc-950 text-zinc-50 ${
        exiting ? "welcome-splash--exit pointer-events-none" : ""
      }`}
      aria-hidden={exiting}
    >
      <LineWaves {...AUTH_LINE_WAVES_PROPS} />

      <div
        className="welcome-splash-glow pointer-events-none fixed left-1/2 top-1/2 z-[60] h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.4) 0%, rgba(99,102,241,0.22) 42%, transparent 72%)",
        }}
      />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <div
          className={`mx-auto max-w-2xl space-y-4 ${
            exiting ? "welcome-splash-text--exit" : "welcome-splash-text"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            Plataforma Sonia
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-4xl md:text-5xl">
            Olá, {displayName}
          </h1>

          <p className="welcome-headline-gradient text-xl font-semibold sm:text-2xl md:text-3xl">
            Seja bem-vindo à plataforma da Sonia!
          </p>
        </div>
      </div>
    </div>
  );
}
