import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import {
  CircularAssetHierarchyError,
  InvalidAssetParentError,
  PrismaAssetRepository,
} from "../src/prisma-asset-repository.ts";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

function createClient(connectionString: string | undefined): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

integrationDescribe("Prisma asset repository (PostgreSQL)", () => {
  let prisma: PrismaClient | undefined;
  let repository: PrismaAssetRepository | undefined;
  const assetCode = `TEST-${randomUUID()}`;
  const createdIds: string[] = [];

  beforeAll(() => {
    prisma = createClient(databaseUrl);
    repository = new PrismaAssetRepository(prisma);
  });

  afterAll(async () => {
    if (createdIds.length > 0 && prisma) {
      await prisma.asset.updateMany({
        where: { id: { in: createdIds } },
        data: { parentId: null },
      });
      await prisma.asset.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma?.$disconnect();
  });

  it("persists an asset and reads it back by ID and through search", async () => {
    if (!repository) {
      throw new Error("PostgreSQL repository was not initialized.");
    }
    const created = await repository.create({
      assetCode,
      name: "Synthetic persistence test asset",
      type: "PIPELINE",
      location: "Test-only synthetic location",
      criticality: "LOW",
    });
    createdIds.push(created.id);

    await expect(repository.findById(created.id)).resolves.toMatchObject({
      id: created.id,
      assetCode,
      name: "Synthetic persistence test asset",
    });
    await expect(
      repository.list({ q: assetCode, page: 1, pageSize: 10 }),
    ).resolves.toMatchObject({
      total: 1,
      data: [{ id: created.id }],
    });
  });

  it("rejects invalid and circular parents and retains archived assets", async () => {
    if (!repository) {
      throw new Error("PostgreSQL repository was not initialized.");
    }
    const root = await repository.create({
      assetCode: `${assetCode}-ROOT`,
      name: "Synthetic hierarchy root",
      type: "PLATFORM",
      location: "Test-only synthetic location",
      criticality: "LOW",
    });
    createdIds.push(root.id);
    const child = await repository.create({
      assetCode: `${assetCode}-CHILD`,
      name: "Synthetic hierarchy child",
      type: "PUMP",
      location: "Test-only synthetic location",
      criticality: "LOW",
      parentId: root.id,
    });
    createdIds.push(child.id);

    await expect(
      repository.create({
        assetCode: `${assetCode}-INVALID`,
        name: "Invalid parent sample",
        type: "EQUIPMENT",
        location: "Test-only synthetic location",
        criticality: "LOW",
        parentId: "missing-parent-id",
      }),
    ).rejects.toBeInstanceOf(InvalidAssetParentError);
    await expect(
      repository.update(root.id, { parentId: child.id }),
    ).rejects.toBeInstanceOf(CircularAssetHierarchyError);

    await expect(repository.archive(root.id)).resolves.toMatchObject({
      id: root.id,
      isArchived: true,
      status: "ARCHIVED",
    });
    await expect(repository.list({ page: 1, pageSize: 10 })).resolves.toMatchObject({
      data: expect.not.arrayContaining([expect.objectContaining({ id: root.id })]),
    });
    const archivedAssets = await repository.list({
      status: "ARCHIVED",
      page: 1,
      pageSize: 100,
    });
    expect(archivedAssets.data.some((asset) => asset.id === root.id)).toBe(true);
    await expect(repository.findById(root.id)).resolves.toMatchObject({
      id: root.id,
      isArchived: true,
    });
  });
});
