import { Loader2, LogOut } from "lucide-react";
import LineWaves from "./LineWaves";
import { AUTH_LINE_WAVES_PROPS } from "./auth-theme";
import "./WelcomeSplash.css";

export function LogoutOverlay() {
  return (
    <div
      className="auth-session-overlay fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden bg-zinc-950 text-zinc-50"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LineWaves {...AUTH_LINE_WAVES_PROPS} />

      <div className="auth-session-overlay__content relative z-10 flex flex-col items-center gap-4 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900/80 ring-1 ring-zinc-800">
          <LogOut className="h-5 w-5 text-blue-400" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="text-base font-medium text-zinc-100 sm:text-lg">Encerrando sessão…</p>
          <p className="text-sm text-zinc-400">Aguarde um instante</p>
        </div>
        <Loader2 className="h-7 w-7 animate-spin text-blue-500/90" aria-hidden />
      </div>
    </div>
  );
}
