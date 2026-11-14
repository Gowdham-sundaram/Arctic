import type { Request, RequestHandler } from "express";
import type { UserSummary, UserRole } from "@arctic/contracts";
import type { AuthRepository } from "./auth-repository.ts";

declare module "express-serve-static-core" {
  interface Request {
    user?: UserSummary;
  }
}

export function requireUser(auth: AuthRepository): RequestHandler {
  return (request, response, next) => {
    const token = extractBearerToken(request);
    if (!token) {
      response.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Sign in to continue." },
      });
      return;
    }
    void auth
      .resolve(token)
      .then((user) => {
        if (!user) {
          response.status(401).json({
            error: { code: "UNAUTHENTICATED", message: "Session is invalid or expired." },
          });
          return;
        }
        request.user = user;
        next();
      })
      .catch(next);
  };
}

export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.authorization;
  if (!authorization) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{40,})$/.exec(authorization);
  return match?.[1] ?? null;
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, response, next) => {
    if (!request.user) {
      response.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Sign in to continue." },
      });
      return;
    }
    if (!roles.includes(request.user.role)) {
      response.status(403).json({
        error: { code: "FORBIDDEN", message: "Your role cannot perform this action." },
      });
      return;
    }
    next();
  };
}
