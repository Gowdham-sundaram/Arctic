import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import { z } from "zod";
import { createApp } from "./app.ts";
import { PrismaAssetRepository } from "./prisma-asset-repository.ts";
import { PrismaAuthRepository } from "./prisma-auth-repository.ts";
import { PrismaWorkflowRepository } from "./prisma-workflow-repository.ts";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});
const environment = environmentSchema.parse(process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: environment.DATABASE_URL }),
});
const app = createApp(
  new PrismaAssetRepository(prisma),
  new PrismaAuthRepository(prisma),
  new PrismaWorkflowRepository(prisma),
);
const port = environment.PORT ?? environment.API_PORT;
const server = app.listen(port, "0.0.0.0", () => {
  console.info(`ARCTIC API listening on port ${port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`Received ${signal}; shutting down ARCTIC API.`);
  server.close(async (error) => {
    if (error) {
      console.error("API server shutdown failed.", error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
