import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loginSchema, type AuthSession } from "@arctic/contracts";
import { ApiError, login } from "../lib/api.ts";
import { useAuth } from "../lib/auth-context.tsx";

export function LoginPage() {
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (session: AuthSession) => {
      saveSession(session);
      void navigate("/dashboard", { replace: true });
    },
  });
  const input = loginSchema.safeParse({ email, password });

  return (
    <main className="login-page">
      <section className="panel login-panel" aria-labelledby="login-heading">
        <div className="topbar-brand-mark" aria-hidden="true">
          A
        </div>
        <p className="eyebrow">ASSET RELIABILITY PLATFORM</p>
        <h1 id="login-heading">Sign in to ARCTIC</h1>
        <p className="page-description">
          Use a seeded demo account to access the synthetic asset workspace.
        </p>
        {import.meta.env.VITE_DEMO_VIEWER_PASSWORD && (
          <p className="data-notice">
            Public read-only demo login: viewer@arctic.demo /{" "}
            {import.meta.env.VITE_DEMO_VIEWER_PASSWORD}
          </p>
        )}
        <form
          className="asset-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.success) mutation.mutate(input.data);
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {mutation.error && (
            <div className="form-error" role="alert">
              {mutation.error instanceof ApiError && mutation.error.status === 401
                ? "Email or password is incorrect."
                : mutation.error.message}
            </div>
          )}
          <button
            type="submit"
            className="button-primary"
            disabled={!input.success || mutation.isPending}
          >
            {mutation.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="data-notice">
          Demo data is synthetic and not intended for operational decisions.
        </p>
      </section>
    </main>
  );
}
