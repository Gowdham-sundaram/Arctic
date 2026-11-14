import { authSessionSchema, type AuthSession } from "@arctic/contracts";

const STORAGE_KEY = "arctic-auth-session";

export function readAuthSession(): AuthSession | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
  const parsed = authSessionSchema.safeParse(value);
  if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now()) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return parsed.data;
}

export function writeAuthSession(session: AuthSession): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}
