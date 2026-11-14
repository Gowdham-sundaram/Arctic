import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { UserSummary } from "@arctic/contracts";
import type { PrismaClient } from "./generated/prisma/client.ts";
import type { AuthRepository } from "./auth-repository.ts";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const PASSWORD_KEY_LENGTH = 64;

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, PASSWORD_KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex, extra] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !saltHex ||
    !keyHex ||
    extra !== undefined ||
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{128}$/i.test(keyHex)
  ) {
    throw new Error("Stored password hash has an unsupported format.");
  }

  const expected = Buffer.from(keyHex, "hex");
  const actual = await derivePasswordKey(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}

function toUserSummary(user: {
  id: string;
  email: string;
  displayName: string;
  role: UserSummary["role"];
}): UserSummary {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
      await derivePasswordKey(password, Buffer.alloc(16));
      return null;
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches || !user.isActive) return null;

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt,
      },
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: toUserSummary(user),
    };
  }

  async resolve(token: string): Promise<UserSummary | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
      return null;
    }
    return toUserSummary(session.user);
  }

  async logout(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
}
