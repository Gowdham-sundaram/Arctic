import type { AuthSession, UserSummary } from "@arctic/contracts";

export interface AuthRepository {
  login(email: string, password: string): Promise<AuthSession | null>;
  resolve(token: string): Promise<UserSummary | null>;
  logout(token: string): Promise<void>;
}
