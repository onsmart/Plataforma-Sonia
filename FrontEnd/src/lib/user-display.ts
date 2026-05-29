const BOGUS_NAME_VALUES = new Set(["mail", "email", "admin", "admin user", "user"]);

function capitalizeToken(token: string): string {
  if (!token) return "";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function isBogusProfileName(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return true;
  return BOGUS_NAME_VALUES.has(normalized);
}

export function sanitizeProfileName(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (isBogusProfileName(trimmed)) return "";
  return trimmed;
}

export function parseNamesFromEmail(email: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const local = String(email ?? "").split("@")[0]?.trim() ?? "";
  if (!local) return { firstName: "", lastName: "" };

  const parts = local.split(/[._-]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: capitalizeToken(parts[0]),
      lastName: parts.slice(1).map(capitalizeToken).join(" "),
    };
  }

  return { firstName: capitalizeToken(parts[0] ?? local), lastName: "" };
}

export function resolveUserProfileNames(input: {
  dbName?: string | null;
  dbLastName?: string | null;
  metaFirstName?: string | null;
  metaLastName?: string | null;
  email?: string | null;
}): { firstName: string; lastName: string } {
  const dbFirst = sanitizeProfileName(input.dbName);
  const dbLast = sanitizeProfileName(input.dbLastName);
  if (dbFirst || dbLast) {
    return { firstName: dbFirst, lastName: dbLast };
  }

  const metaFirst = sanitizeProfileName(input.metaFirstName);
  const metaLast = sanitizeProfileName(input.metaLastName);
  if (metaFirst || metaLast) {
    return { firstName: metaFirst, lastName: metaLast };
  }

  return parseNamesFromEmail(input.email);
}

export function buildDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = ""
): string {
  const full = [sanitizeProfileName(firstName), sanitizeProfileName(lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || fallback;
}

export function buildInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email?: string | null
): string {
  const first = sanitizeProfileName(firstName);
  const last = sanitizeProfileName(lastName);

  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first.length >= 2) return first.substring(0, 2).toUpperCase();
  if (first) return first[0].toUpperCase();

  const emailInitials = String(email ?? "").substring(0, 2).toUpperCase();
  return emailInitials || "?";
}
