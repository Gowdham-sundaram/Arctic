import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/prisma-auth-repository.ts";
import { PrismaWorkflowRepository } from "../src/prisma-workflow-repository.ts";
import { WorkflowRuleError } from "../src/workflow-repository.ts";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
const databaseUrl = process.env.DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;

function createClient(connectionString: string | undefined): PrismaClient {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for PostgreSQL workflow integration tests.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

integrationDescribe("ARCTIC flagship workflow (PostgreSQL)", () => {
  let prisma: PrismaClient | undefined;
  let repository: PrismaWorkflowRepository | undefined;
  const suffix = randomUUID();
  const userIds: string[] = [];
  let assetId: string | undefined;
  let inspectionId: string | undefined;
  let anomalyId: string | undefined;
  let workOrderId: string | undefined;

  beforeAll(() => {
    prisma = createClient(databaseUrl);
    repository = new PrismaWorkflowRepository(prisma);
  });

  afterAll(async () => {
    if (prisma) {
      if (userIds.length > 0) {
        await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
        await prisma.riskAssessment.deleteMany({
          where: { assessedById: { in: userIds } },
        });
        await prisma.workOrder.deleteMany({ where: { createdById: { in: userIds } } });
        await prisma.anomaly.deleteMany({ where: { createdById: { in: userIds } } });
        await prisma.inspection.deleteMany({ where: { createdById: { in: userIds } } });
      }
      if (workOrderId) await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
      if (anomalyId) await prisma.anomaly.deleteMany({ where: { id: anomalyId } });
      if (inspectionId)
        await prisma.inspection.deleteMany({ where: { id: inspectionId } });
      if (assetId) await prisma.asset.deleteMany({ where: { id: assetId } });
      if (userIds.length > 0)
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });

  it("completes inspection to verified work order before anomaly closure", async () => {
    if (!prisma || !repository) {
      throw new Error("PostgreSQL workflow repository was not initialized.");
    }
    const passwordHash = await hashPassword("test-only-password");
    const inspector = await prisma.user.create({
      data: {
        email: `inspector-${suffix}@arctic.test`,
        displayName: "Integration Inspector",
        passwordHash,
        role: "INSPECTOR",
      },
    });
    const engineer = await prisma.user.create({
      data: {
        email: `engineer-${suffix}@arctic.test`,
        displayName: "Integration Engineer",
        passwordHash: await hashPassword("test-only-password"),
        role: "ENGINEER",
      },
    });
    userIds.push(inspector.id, engineer.id);
    const asset = await prisma.asset.create({
      data: {
        assetCode: `TEST-WF-${suffix}`,
        name: "Synthetic workflow test asset",
        type: "PIPELINE",
        location: "Test-only synthetic location",
        criticality: "LOW",
      },
    });
    assetId = asset.id;

    const inspection = await repository.createInspection(engineer.id, {
      assetId: asset.id,
      type: "CORROSION",
      plannedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      assignedToId: inspector.id,
      checklistPrompts: ["Inspect coating sample"],
    });
    inspectionId = inspection.id;
    expect(inspection.status).toBe("PLANNED");
    expect(inspection.checklist).toHaveLength(1);
    const checklistItem = inspection.checklist[0];
    if (!checklistItem) throw new Error("The generated test checklist item is missing.");

    await repository.updateInspection(engineer.id, inspection.id, {
      status: "IN_PROGRESS",
    });
    const executed = await repository.updateChecklistItem(
      inspector.id,
      inspection.id,
      checklistItem.id,
      {
        outcome: "FAIL",
        observation: "Synthetic coating damage recorded.",
        evidenceReference: "DEMO-EVIDENCE-01",
      },
    );
    expect(executed?.checklist[0]).toMatchObject({
      outcome: "FAIL",
      evidenceReference: "DEMO-EVIDENCE-01",
    });
    const completedInspection = await repository.updateInspection(
      engineer.id,
      inspection.id,
      {
        status: "COMPLETED",
      },
    );
    expect(completedInspection?.completedAt).toBeTruthy();

    const anomaly = await repository.createAnomaly(engineer.id, {
      assetId: asset.id,
      inspectionId: inspection.id,
      type: "CORROSION",
      severity: "HIGH",
      title: "Synthetic coating breakdown",
      description: "Test-only finding from an illustrative inspection.",
    });
    anomalyId = anomaly.id;
    const risk = await repository.assessRisk(engineer.id, anomaly.id, {
      likelihood: 3,
      consequence: 4,
      exposure: 2,
      factors: { environment: "synthetic" },
    });
    expect(risk).toMatchObject({
      version: "ARCTIC-ILLUSTRATIVE-1",
      score: 24,
      category: "MODERATE",
    });

    await repository.updateAnomaly(engineer.id, anomaly.id, { status: "IN_PROGRESS" });
    await repository.updateAnomaly(engineer.id, anomaly.id, {
      status: "RESOLVED",
      resolutionNotes: "Synthetic repair recorded.",
    });
    const workOrder = await repository.createWorkOrder(engineer.id, {
      assetId: asset.id,
      anomalyId: anomaly.id,
      title: "Repair coating sample",
      priority: "HIGH",
      assignedToId: inspector.id,
    });
    workOrderId = workOrder.id;
    await repository.updateWorkOrder(inspector.id, workOrder.id, {
      status: "IN_PROGRESS",
    });
    await repository.updateWorkOrder(inspector.id, workOrder.id, {
      status: "COMPLETED",
      completionNotes: "Synthetic repair completed.",
    });
    await expect(
      repository.updateAnomaly(engineer.id, anomaly.id, {
        status: "CLOSED",
        verificationNotes: "Verification is not yet available.",
      }),
    ).rejects.toMatchObject<Partial<WorkflowRuleError>>({
      code: "CORRECTIVE_ACTION_NOT_VERIFIED",
    });
    await repository.updateWorkOrder(engineer.id, workOrder.id, {
      status: "VERIFIED",
      verificationNotes: "Synthetic independent verification completed.",
    });
    const closedAnomaly = await repository.updateAnomaly(engineer.id, anomaly.id, {
      status: "CLOSED",
      verificationNotes: "Corrective action verified in this synthetic test.",
    });
    expect(closedAnomaly?.status).toBe("CLOSED");

    const history = await repository.listAuditEvents(anomaly.id);
    expect(history.map((event) => event.toStatus)).toContain("CLOSED");
  });
});
