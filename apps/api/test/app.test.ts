import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type {
  AssetHealthSummary,
  AssetRecord,
  AuthSession,
  AnomalyRecord,
  AuditEventRecord,
  InspectionRecord,
  CreateAssetInput,
  ListAssetsQuery,
  RiskAssessmentRecord,
  UpdateAssetInput,
  UserSummary,
  WorkflowSummary,
  WorkOrderRecord,
} from "@arctic/contracts";
import { createApp } from "../src/app.ts";
import type { AuthRepository } from "../src/auth-repository.ts";
import type { AssetRepository } from "../src/asset-repository.ts";
import type { WorkflowRepository } from "../src/workflow-repository.ts";

const token = "a".repeat(43);

function makeAsset(id: string, input: CreateAssetInput): AssetRecord {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id,
    assetCode: input.assetCode,
    name: input.name,
    type: input.type,
    description: input.description ?? null,
    parentId: input.parentId || null,
    location: input.location,
    offshoreField: input.offshoreField ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    installationDate: input.installationDate ?? null,
    health: input.health ?? "UNKNOWN",
    criticality: input.criticality,
    status: "ACTIVE",
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    serialNumber: input.serialNumber ?? null,
    isArchived: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

class MemoryAssetRepository implements AssetRepository {
  private readonly records: AssetRecord[] = [];

  async list(query: ListAssetsQuery): Promise<{ data: AssetRecord[]; total: number }> {
    const matching = this.records.filter(
      (asset) =>
        (!asset.isArchived || query.status === "ARCHIVED") &&
        (!query.status || asset.status === query.status) &&
        (!query.type || asset.type === query.type) &&
        (!query.q ||
          `${asset.assetCode} ${asset.name} ${asset.location}`
            .toLowerCase()
            .includes(query.q.toLowerCase())),
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      data: matching.slice(start, start + query.pageSize),
      total: matching.length,
    };
  }

  async findById(id: string): Promise<AssetRecord | null> {
    return this.records.find((asset) => asset.id === id) ?? null;
  }

  async create(input: CreateAssetInput): Promise<AssetRecord> {
    const asset = makeAsset(`asset-${this.records.length + 1}`, input);
    this.records.push(asset);
    return asset;
  }

  async update(id: string, input: UpdateAssetInput): Promise<AssetRecord | null> {
    const index = this.records.findIndex((asset) => asset.id === id);
    const current = this.records[index];
    if (!current) return null;
    const updated: AssetRecord = { ...current, updatedAt: new Date().toISOString() };
    for (const [field, value] of Object.entries(input)) {
      if (value !== undefined) Object.assign(updated, { [field]: value });
    }
    this.records[index] = updated;
    return updated;
  }

  async archive(id: string): Promise<AssetRecord | null> {
    const index = this.records.findIndex((asset) => asset.id === id);
    const current = this.records[index];
    if (!current) return null;
    const archived = {
      ...current,
      isArchived: true,
      archivedAt: new Date().toISOString(),
      status: "ARCHIVED" as const,
      updatedAt: new Date().toISOString(),
    };
    this.records[index] = archived;
    return archived;
  }

  async ping(): Promise<void> {}

  async healthSummary(): Promise<AssetHealthSummary> {
    const byHealth: AssetHealthSummary["byHealth"] = {
      UNKNOWN: 0,
      HEALTHY: 0,
      ATTENTION: 0,
      CRITICAL: 0,
    };
    for (const asset of this.records) byHealth[asset.health] += 1;
    return { total: this.records.length, byHealth };
  }
}

class MemoryAuthRepository implements AuthRepository {
  private revoked = false;

  constructor(private readonly role: UserSummary["role"] = "ADMIN") {}

  async login(email: string, password: string): Promise<AuthSession | null> {
    if (email !== "demo@arctic.test" || password !== "correct-password") return null;
    this.revoked = false;
    return {
      token,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "demo-user",
        email,
        displayName: "Demo User",
        role: this.role,
      },
    };
  }

  async resolve(candidate: string): Promise<UserSummary | null> {
    return candidate === token && !this.revoked
      ? {
          id: "demo-user",
          email: "demo@arctic.test",
          displayName: "Demo User",
          role: this.role,
        }
      : null;
  }

  async logout(): Promise<void> {
    this.revoked = true;
  }
}

class EmptyWorkflowRepository implements WorkflowRepository {
  async listUsers(): Promise<UserSummary[]> {
    return [];
  }
  async summary(): Promise<WorkflowSummary> {
    return {
      inspections: { PLANNED: 0, IN_PROGRESS: 0, OVERDUE: 0 },
      anomalies: { OPEN: 0, CRITICAL: 0 },
      risk: { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 },
      workOrders: { OPEN: 0, OVERDUE: 0 },
    };
  }
  async listInspections(): Promise<InspectionRecord[]> {
    return [];
  }
  async createInspection(): Promise<InspectionRecord> {
    throw new Error("Not implemented by the test repository.");
  }
  async updateInspection(): Promise<InspectionRecord | null> {
    return null;
  }
  async updateChecklistItem(): Promise<InspectionRecord | null> {
    return null;
  }
  async listAnomalies(): Promise<AnomalyRecord[]> {
    return [];
  }
  async createAnomaly(): Promise<AnomalyRecord> {
    throw new Error("Not implemented by the test repository.");
  }
  async updateAnomaly(): Promise<AnomalyRecord | null> {
    return null;
  }
  async assessRisk(): Promise<RiskAssessmentRecord | null> {
    return null;
  }
  async listRiskAssessments(): Promise<RiskAssessmentRecord[]> {
    return [];
  }
  async listWorkOrders(): Promise<WorkOrderRecord[]> {
    return [];
  }
  async createWorkOrder(): Promise<WorkOrderRecord> {
    throw new Error("Not implemented by the test repository.");
  }
  async updateWorkOrder(): Promise<WorkOrderRecord | null> {
    return null;
  }
  async listAuditEvents(): Promise<AuditEventRecord[]> {
    return [];
  }
}

function makeApp(role: UserSummary["role"] = "ADMIN") {
  return createApp(
    new MemoryAssetRepository(),
    new MemoryAuthRepository(role),
    new EmptyWorkflowRepository(),
    pino({ level: "silent" }),
  );
}

function apiGet(app: ReturnType<typeof makeApp>, path: string) {
  return request(app).get(path).set("Authorization", `Bearer ${token}`);
}

function apiPost(app: ReturnType<typeof makeApp>, path: string) {
  return request(app).post(path).set("Authorization", `Bearer ${token}`);
}

function apiPatch(app: ReturnType<typeof makeApp>, path: string) {
  return request(app).patch(path).set("Authorization", `Bearer ${token}`);
}

function apiDelete(app: ReturnType<typeof makeApp>, path: string) {
  return request(app).delete(path).set("Authorization", `Bearer ${token}`);
}

const validAsset = {
  assetCode: "PIPE-B12",
  name: "Pipeline B-12",
  type: "PIPELINE",
  location: "Synthetic Field",
  criticality: "HIGH",
};

describe("asset API", () => {
  it("authenticates, resolves, and revokes sessions", async () => {
    const app = makeApp();
    const invalid = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "demo@arctic.test", password: "wrong" })
      .expect(401);
    expect(invalid.body.error.code).toBe("INVALID_CREDENTIALS");

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "demo@arctic.test", password: "correct-password" })
      .expect(200);
    await apiGet(app, "/api/v1/auth/me").expect(200, {
      id: "demo-user",
      email: "demo@arctic.test",
      displayName: "Demo User",
      role: "ADMIN",
    });
    await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .expect(200, { status: "ok" });
    await apiGet(app, "/api/v1/auth/me").expect(401);
  });

  it("creates an asset and returns it in the paginated list", async () => {
    const app = makeApp();
    const created = await apiPost(app, "/api/v1/assets").send(validAsset).expect(201);

    expect(created.body.data).toMatchObject({
      assetCode: "PIPE-B12",
      name: "Pipeline B-12",
      type: "PIPELINE",
    });

    const listed = await apiGet(app, "/api/v1/assets?page=1").expect(200);
    expect(listed.body).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      data: [{ id: created.body.data.id }],
    });
    await apiGet(app, "/api/v1/dashboard/asset-health").expect(200, {
      total: 1,
      byHealth: { UNKNOWN: 1, HEALTHY: 0, ATTENTION: 0, CRITICAL: 0 },
    });
  });

  it("rejects malformed asset data and invalid pagination", async () => {
    const app = makeApp();
    const invalidAsset = await apiPost(app, "/api/v1/assets")
      .send({ ...validAsset, assetCode: "invalid code" })
      .expect(400);

    expect(invalidAsset.body.error.code).toBe("VALIDATION_ERROR");
    await apiGet(app, "/api/v1/assets?page=0").expect(400);
  });

  it("accepts an initial health classification and includes it in the summary", async () => {
    const app = makeApp();
    const created = await apiPost(app, "/api/v1/assets")
      .send({ ...validAsset, health: "ATTENTION" })
      .expect(201);

    expect(created.body.data.health).toBe("ATTENTION");
    await apiGet(app, "/api/v1/dashboard/asset-health").expect(200, {
      total: 1,
      byHealth: { UNKNOWN: 0, HEALTHY: 0, ATTENTION: 1, CRITICAL: 0 },
    });
  });

  it("returns an asset detail or a clear not-found error", async () => {
    const app = makeApp();
    const created = await apiPost(app, "/api/v1/assets").send(validAsset).expect(201);

    await apiGet(app, `/api/v1/assets/${created.body.data.id}`).expect(200);
    const missing = await apiGet(app, "/api/v1/assets/missing").expect(404);
    expect(missing.body.error.code).toBe("ASSET_NOT_FOUND");
  });

  it("updates and archives assets without deleting their history", async () => {
    const app = makeApp();
    const created = await apiPost(app, "/api/v1/assets").send(validAsset).expect(201);
    const id = created.body.data.id as string;

    await apiPatch(app, `/api/v1/assets/${id}`)
      .send({ health: "ATTENTION", description: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.health).toBe("ATTENTION");
        expect(body.data.description).toBeNull();
      });

    await apiPatch(app, `/api/v1/assets/${id}`).send({}).expect(400);
    await apiDelete(app, `/api/v1/assets/${id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.isArchived).toBe(true);
        expect(body.data.status).toBe("ARCHIVED");
      });
    await apiGet(app, `/api/v1/assets/${id}`).expect(200);
    await apiGet(app, "/api/v1/assets?status=ARCHIVED")
      .expect(200)
      .expect(({ body }) => {
        expect(body.total).toBe(1);
        expect(body.data[0].id).toBe(id);
      });
  });

  it("exports authenticated CSV reports with spreadsheet-formula values escaped", async () => {
    const app = makeApp();
    await apiPost(app, "/api/v1/assets")
      .send({ ...validAsset, name: "=SUM(1,1)" })
      .expect(201);

    await apiGet(app, "/api/v1/reports/assets.csv")
      .expect(200)
      .expect("Content-Type", /text\/csv/)
      .expect(({ text }) => {
        expect(text).toContain("'=SUM(1,1)");
      });
    await request(app).get("/api/v1/reports/assets.csv").expect(401);
    await apiGet(app, "/api/v1/reports/not-a-report.csv").expect(404);
  });

  it("exposes health and readiness separately", async () => {
    const app = makeApp();
    await request(app).get("/api/v1/health").expect(200, { status: "ok" });
    await request(app).get("/api/v1/ready").expect(200, { status: "ready" });
  });

  it("returns an empty asset-health summary before assets exist", async () => {
    const app = makeApp();
    await apiGet(app, "/api/v1/dashboard/asset-health").expect(200, {
      total: 0,
      byHealth: { UNKNOWN: 0, HEALTHY: 0, ATTENTION: 0, CRITICAL: 0 },
    });
  });

  it("requires a valid session and role for protected operations", async () => {
    const app = makeApp();
    await request(app).get("/api/v1/assets").expect(401);
    await request(app)
      .get("/api/v1/assets")
      .set("Authorization", `Bearer ${"b".repeat(43)}`)
      .expect(401);
    await request(app).get("/api/v1/inspections").expect(401);

    await apiPost(makeApp("VIEWER"), "/api/v1/assets").send(validAsset).expect(403);
    await apiPost(makeApp("VIEWER"), "/api/v1/inspections").send({}).expect(403);
    await apiDelete(makeApp("INSPECTOR"), "/api/v1/assets/asset-1").expect(403);
  });
});
