import {
  Prisma,
  PrismaClient,
  type Asset as PrismaAsset,
} from "./generated/prisma/client.ts";
import type {
  AssetHealthSummary,
  AssetRecord,
  CreateAssetInput,
  ListAssetsQuery,
  UpdateAssetInput,
} from "@arctic/contracts";
import type { AssetRepository } from "./asset-repository.ts";

function toAssetRecord(asset: PrismaAsset): AssetRecord {
  return {
    ...asset,
    installationDate: asset.installationDate?.toISOString() ?? null,
    archivedAt: asset.archivedAt?.toISOString() ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function nullableText(value: string | undefined): string | null {
  return value?.trim() || null;
}

export class InvalidAssetParentError extends Error {
  constructor() {
    super("Parent asset does not exist or is archived.");
    this.name = "InvalidAssetParentError";
  }
}

export class CircularAssetHierarchyError extends Error {
  constructor() {
    super("Parent selection would create a circular asset hierarchy.");
    this.name = "CircularAssetHierarchyError";
  }
}

export class PrismaAssetRepository implements AssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListAssetsQuery): Promise<{ data: AssetRecord[]; total: number }> {
    const where: Prisma.AssetWhereInput = {
      isArchived: query.status === "ARCHIVED" ? true : false,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.q
        ? {
            OR: [
              { assetCode: { contains: query.q, mode: "insensitive" } },
              { name: { contains: query.q, mode: "insensitive" } },
              { location: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [assets, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        orderBy: { assetCode: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return { data: assets.map(toAssetRecord), total };
  }

  async findById(id: string): Promise<AssetRecord | null> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    return asset ? toAssetRecord(asset) : null;
  }

  async create(input: CreateAssetInput): Promise<AssetRecord> {
    await this.assertValidParent(nullableText(input.parentId));
    const asset = await this.prisma.asset.create({
      data: {
        assetCode: input.assetCode,
        name: input.name,
        type: input.type,
        description: nullableText(input.description),
        parentId: nullableText(input.parentId),
        location: input.location,
        offshoreField: nullableText(input.offshoreField),
        health: input.health ?? "UNKNOWN",
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        installationDate: input.installationDate
          ? new Date(`${input.installationDate}T00:00:00.000Z`)
          : null,
        criticality: input.criticality,
        manufacturer: nullableText(input.manufacturer),
        model: nullableText(input.model),
        serialNumber: nullableText(input.serialNumber),
      },
    });
    return toAssetRecord(asset);
  }

  async update(id: string, input: UpdateAssetInput): Promise<AssetRecord | null> {
    const existing = await this.prisma.asset.findFirst({
      where: { id, isArchived: false },
      select: { id: true },
    });
    if (!existing) return null;

    if ("parentId" in input) {
      await this.assertValidParent(nullableText(input.parentId ?? undefined), id);
    }

    const data: Prisma.AssetUncheckedUpdateInput = {};
    if (input.assetCode !== undefined) data.assetCode = input.assetCode;
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if ("description" in input)
      data.description = nullableText(input.description ?? undefined);
    if ("parentId" in input) data.parentId = nullableText(input.parentId ?? undefined);
    if (input.location !== undefined) data.location = input.location;
    if ("offshoreField" in input)
      data.offshoreField = nullableText(input.offshoreField ?? undefined);
    if ("latitude" in input) data.latitude = input.latitude ?? null;
    if ("longitude" in input) data.longitude = input.longitude ?? null;
    if ("installationDate" in input)
      data.installationDate = input.installationDate
        ? new Date(`${input.installationDate}T00:00:00.000Z`)
        : null;
    if (input.health !== undefined) data.health = input.health;
    if (input.criticality !== undefined) data.criticality = input.criticality;
    if (input.status !== undefined) data.status = input.status;
    if ("manufacturer" in input)
      data.manufacturer = nullableText(input.manufacturer ?? undefined);
    if ("model" in input) data.model = nullableText(input.model ?? undefined);
    if ("serialNumber" in input)
      data.serialNumber = nullableText(input.serialNumber ?? undefined);

    const asset = await this.prisma.asset.update({ where: { id }, data });
    return toAssetRecord(asset);
  }

  async archive(id: string): Promise<AssetRecord | null> {
    const existing = await this.prisma.asset.findFirst({
      where: { id, isArchived: false },
      select: { id: true },
    });
    if (!existing) return null;

    const asset = await this.prisma.asset.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        status: "ARCHIVED",
      },
    });
    return toAssetRecord(asset);
  }

  private async assertValidParent(
    parentId: string | null,
    currentAssetId?: string,
  ): Promise<void> {
    const visited = new Set<string>();
    let cursorId = parentId;
    while (cursorId) {
      if (cursorId === currentAssetId || visited.has(cursorId)) {
        throw new CircularAssetHierarchyError();
      }
      visited.add(cursorId);
      const parent = await this.prisma.asset.findUnique({
        where: { id: cursorId },
        select: { id: true, parentId: true, isArchived: true },
      });
      if (!parent || parent.isArchived) throw new InvalidAssetParentError();
      cursorId = parent.parentId;
    }
  }

  async healthSummary(): Promise<AssetHealthSummary> {
    const activeAssets: Prisma.AssetWhereInput = { isArchived: false };
    const [total, healthy, attention, critical, unknown] = await this.prisma.$transaction(
      [
        this.prisma.asset.count({ where: activeAssets }),
        this.prisma.asset.count({ where: { ...activeAssets, health: "HEALTHY" } }),
        this.prisma.asset.count({ where: { ...activeAssets, health: "ATTENTION" } }),
        this.prisma.asset.count({ where: { ...activeAssets, health: "CRITICAL" } }),
        this.prisma.asset.count({ where: { ...activeAssets, health: "UNKNOWN" } }),
      ],
    );

    return {
      total,
      byHealth: {
        HEALTHY: healthy,
        ATTENTION: attention,
        CRITICAL: critical,
        UNKNOWN: unknown,
      },
    };
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isInvalidRelationError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}
