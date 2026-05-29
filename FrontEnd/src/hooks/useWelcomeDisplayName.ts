import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { buildDisplayName, resolveUserProfileNames } from "../lib/user-display";
import { WELCOME_NAME_WAIT_MS } from "../components/auth/auth-theme";

/**
 * Resolve o nome exibido na splash de boas-vindas (AuthContext → metadata → e-mail).
 */
export function useWelcomeDisplayName(enabled: boolean): string {
  const { firstName, lastName, user, loading } = useAuth();
  const [nameReady, setNameReady] = useState(false);

  const resolved = useMemo(() => {
    const fromContext = buildDisplayName(firstName, lastName);
    if (fromContext) return fromContext;

    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const fromMeta = resolveUserProfileNames({
      metaFirstName: typeof meta.first_name === "string" ? meta.first_name : null,
      metaLastName: typeof meta.last_name === "string" ? meta.last_name : null,
      email: user?.email ?? null,
    });
    const fromMetaFull = buildDisplayName(fromMeta.firstName, fromMeta.lastName);
    if (fromMetaFull) return fromMetaFull;

    return buildDisplayName(null, null, "visitante");
  }, [firstName, lastName, user]);

  useEffect(() => {
    if (!enabled) {
      setNameReady(false);
      return;
    }

    const hasRealName = Boolean(buildDisplayName(firstName, lastName));
    if (hasRealName || !loading) {
      setNameReady(true);
      return;
    }

    const timer = window.setTimeout(() => setNameReady(true), WELCOME_NAME_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, firstName, lastName, loading]);

  if (!enabled || !nameReady) {
    return buildDisplayName(firstName, lastName) || "…";
  }

  return resolved;
}
