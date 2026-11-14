import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "./generated/prisma/client.ts";
import type {
  AnomalyRecord,
  AuditEventRecord,
  CreateAnomalyInput,
  CreateInspectionInput,
  CreateWorkOrderInput,
  InspectionRecord,
  RiskAssessmentInput,
  RiskAssessmentRecord,
  UpdateAnomalyInput,
  UpdateChecklistItemInput,
  UpdateInspectionInput,
  UpdateWorkOrderInput,
  UserSummary,
  WorkflowSummary,
  WorkOrderRecord,
} from "@arctic/contracts";
import { calculateIllustrativeRisk } from "./risk-assessment.ts";
import { WorkflowRuleError, type WorkflowRepository } from "./workflow-repository.ts";

const checklistInclude = { checklist: { orderBy: { position: "asc" as const } } };

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function toInspectionRecord(
  inspection: Prisma.InspectionGetPayload<{ include: typeof checklistInclude }>,
): InspectionRecord {
  return {
    id: inspection.id,
    inspectionCode: inspection.inspectionCode,
    assetId: inspection.assetId,
    type: inspection.type,
    status: inspection.status,
    plannedAt: iso(inspection.plannedAt),
    startedAt: iso(inspection.startedAt),
    completedAt: iso(inspection.completedAt),
    notes: inspection.notes,
    createdById: inspection.createdById,
    assignedToId: inspection.assignedToId,
    checklist: inspection.checklist.map((item) => ({
      id: item.id,
      position: item.position,
      prompt: item.prompt,
      outcome: item.outcome,
      observation: item.observation,
      measurement: item.measurement,
      unit: item.unit,
      evidenceReference: item.evidenceReference,
      updatedAt: item.updatedAt.toISOString(),
    })),
    createdAt: inspection.createdAt.toISOString(),
    updatedAt: inspection.updatedAt.toISOString(),
  };
}

function toAnomalyRecord(anomaly: Prisma.AnomalyGetPayload<object>): AnomalyRecord {
  return {
    id: anomaly.id,
    reference: anomaly.reference,
    assetId: anomaly.assetId,
    inspectionId: anomaly.inspectionId,
    type: anomaly.type,
    severity: anomaly.severity,
    status: anomaly.status,
    title: anomaly.title,
    description: anomaly.description,
    detectionDetails: anomaly.detectionDetails,
    assignedToId: anomaly.assignedToId,
    resolutionNotes: anomaly.resolutionNotes,
    verificationNotes: anomaly.verificationNotes,
    verifiedById: anomaly.verifiedById,
    verifiedAt: iso(anomaly.verifiedAt),
    closedAt: iso(anomaly.closedAt),
    createdById: anomaly.createdById,
    createdAt: anomaly.createdAt.toISOString(),
    updatedAt: anomaly.updatedAt.toISOString(),
  };
}

function toRiskAssessmentRecord(
  assessment: Prisma.RiskAssessmentGetPayload<object>,
): RiskAssessmentRecord {
  const factors = assessment.factors;
  if (typeof factors !== "object" || factors === null || Array.isArray(factors)) {
    throw new Error("Stored risk assessment factors are not a JSON object.");
  }
  return {
    id: assessment.id,
    anomalyId: assessment.anomalyId,
    version: assessment.version,
    likelihood: assessment.likelihood,
    consequence: assessment.consequence,
    exposure: assessment.exposure,
    score: assessment.score,
    category: assessment.category,
    factors,
    explanation: assessment.explanation,
    assessedById: assessment.assessedById,
    createdAt: assessment.createdAt.toISOString(),
  };
}

function toWorkOrderRecord(
  workOrder: Prisma.WorkOrderGetPayload<object>,
): WorkOrderRecord {
  return {
    id: workOrder.id,
    number: workOrder.number,
    assetId: workOrder.assetId,
    anomalyId: workOrder.anomalyId,
    title: workOrder.title,
    description: workOrder.description,
    priority: workOrder.priority,
    status: workOrder.status,
    plannedAt: iso(workOrder.plannedAt),
    dueAt: iso(workOrder.dueAt),
    completedAt: iso(workOrder.completedAt),
    completionNotes: workOrder.completionNotes,
    verifiedById: workOrder.verifiedById,
    verifiedAt: iso(workOrder.verifiedAt),
    verificationNotes: workOrder.verificationNotes,
    createdById: workOrder.createdById,
    assignedToId: workOrder.assignedToId,
    createdAt: workOrder.createdAt.toISOString(),
    updatedAt: workOrder.updatedAt.toISOString(),
  };
}

function toAuditEventRecord(
  event: Prisma.AuditEventGetPayload<object>,
): AuditEventRecord {
  const metadata = event.metadata;
  if (metadata !== null && (typeof metadata !== "object" || Array.isArray(metadata))) {
    throw new Error("Stored audit-event metadata is not a JSON object.");
  }
  return {
    id: event.id,
    actorId: event.actorId,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    summary: event.summary,
    metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

function makeReference(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

function cleanText(value: string | undefined): string | null {
  return value?.trim() || null;
}

async function writeAudit(
  prisma: Prisma.TransactionClient,
  data: {
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    summary: string;
  },
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorId: data.actorId,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus ?? null,
      summary: data.summary,
    },
  });
}

export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listUsers(): Promise<UserSummary[]> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, displayName: true, role: true },
      orderBy: [{ role: "asc" }, { displayName: "asc" }],
    });
    return users;
  }

  async summary(): Promise<WorkflowSummary> {
    const now = new Date();
    const [
      planned,
      inProgress,
      overdueInspections,
      openAnomalies,
      criticalAnomalies,
      openWorkOrders,
      overdueWorkOrders,
      latestRiskAssessments,
    ] = await this.prisma.$transaction([
      this.prisma.inspection.count({ where: { status: "PLANNED" } }),
      this.prisma.inspection.count({ where: { status: "IN_PROGRESS" } }),
      this.prisma.inspection.count({
        where: {
          status: { in: ["PLANNED", "IN_PROGRESS"] },
          plannedAt: { lt: now },
        },
      }),
      this.prisma.anomaly.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      this.prisma.anomaly.count({
        where: {
          severity: "CRITICAL",
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      this.prisma.workOrder.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      this.prisma.workOrder.count({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          dueAt: { lt: now },
        },
      }),
      this.prisma.riskAssessment.findMany({
        where: {
          anomaly: { status: { in: ["OPEN", "IN_PROGRESS", "RESOLVED"] } },
        },
        distinct: ["anomalyId"],
        orderBy: [{ anomalyId: "asc" }, { createdAt: "desc" }],
        select: { category: true },
      }),
    ]);
    const risk = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
    for (const assessment of latestRiskAssessments) {
      risk[assessment.category] += 1;
    }
    return {
      inspections: {
        PLANNED: planned,
        IN_PROGRESS: inProgress,
        OVERDUE: overdueInspections,
      },
      anomalies: { OPEN: openAnomalies, CRITICAL: criticalAnomalies },
      risk,
      workOrders: { OPEN: openWorkOrders, OVERDUE: overdueWorkOrders },
    };
  }

  async listInspections(assetId?: string): Promise<InspectionRecord[]> {
    const inspections = await this.prisma.inspection.findMany({
      ...(assetId ? { where: { assetId } } : {}),
      include: checklistInclude,
      orderBy: [{ plannedAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return inspections.map(toInspectionRecord);
  }

  async createInspection(
    actorId: string,
    input: CreateInspectionInput,
  ): Promise<InspectionRecord> {
    await this.requireActiveAsset(input.assetId);
    if (input.assignedToId) {
      await this.requireUser(input.assignedToId, ["INSPECTOR", "ENGINEER", "ADMIN"]);
    }
    const inspection = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inspection.create({
        data: {
          inspectionCode: makeReference("INSP"),
          assetId: input.assetId,
          type: input.type,
          status: input.plannedAt ? "PLANNED" : "DRAFT",
          plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
          notes: cleanText(input.notes),
          createdById: actorId,
          assignedToId: input.assignedToId ?? null,
          checklist: {
            create: input.checklistPrompts.map((prompt, position) => ({
              prompt,
              position,
            })),
          },
        },
        include: checklistInclude,
      });
      await writeAudit(tx, {
        actorId,
        entityType: "INSPECTION",
        entityId: created.id,
        action: "CREATED",
        toStatus: created.status,
        summary: `Created inspection ${created.inspectionCode}.`,
      });
      return created;
    });
    return toInspectionRecord(inspection);
  }

  async updateInspection(
    actorId: string,
    id: string,
    input: UpdateInspectionInput,
  ): Promise<InspectionRecord | null> {
    const existing = await this.prisma.inspection.findUnique({
      where: { id },
      include: checklistInclude,
    });
    if (!existing) return null;
    if (input.assignedToId) {
      await this.requireUser(input.assignedToId, ["INSPECTOR", "ENGINEER", "ADMIN"]);
    }
    const nextStatus = input.status;
    const allowed = this.canTransitionInspection(existing.status, nextStatus);
    if (!allowed) {
      throw new WorkflowRuleError(
        "INVALID_INSPECTION_TRANSITION",
        `Inspection cannot transition from ${existing.status} to ${nextStatus}.`,
      );
    }
    const plannedAt = input.plannedAt
      ? new Date(input.plannedAt)
      : input.plannedAt === null
        ? null
        : existing.plannedAt;
    if (nextStatus === "PLANNED" && !plannedAt) {
      throw new WorkflowRuleError(
        "INSPECTION_SCHEDULE_REQUIRED",
        "A planned date is required before scheduling an inspection.",
      );
    }
    if (
      nextStatus === "COMPLETED" &&
      existing.checklist.some((item) => item.outcome === "OPEN")
    ) {
      throw new WorkflowRuleError(
        "CHECKLIST_INCOMPLETE",
        "Complete or mark not applicable every checklist item before completing the inspection.",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.inspection.update({
        where: { id },
        data: {
          status: nextStatus,
          plannedAt,
          notes: input.notes === undefined ? existing.notes : cleanText(input.notes),
          assignedToId:
            input.assignedToId === undefined ? existing.assignedToId : input.assignedToId,
          startedAt:
            nextStatus === "IN_PROGRESS" && !existing.startedAt
              ? new Date()
              : existing.startedAt,
          completedAt:
            nextStatus === "COMPLETED" && existing.status !== "COMPLETED"
              ? new Date()
              : existing.completedAt,
        },
        include: checklistInclude,
      });
      if (existing.status !== nextStatus) {
        await writeAudit(tx, {
          actorId,
          entityType: "INSPECTION",
          entityId: id,
          action: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: nextStatus,
          summary: `Inspection ${existing.inspectionCode} changed to ${nextStatus}.`,
        });
      }
      return record;
    });
    return toInspectionRecord(updated);
  }

  async updateChecklistItem(
    actorId: string,
    inspectionId: string,
    itemId: string,
    input: UpdateChecklistItemInput,
  ): Promise<InspectionRecord | null> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { status: true, inspectionCode: true },
    });
    if (!inspection) return null;
    if (inspection.status !== "IN_PROGRESS") {
      throw new WorkflowRuleError(
        "INSPECTION_NOT_IN_PROGRESS",
        "Checklist items can only be updated while an inspection is in progress.",
      );
    }
    const item = await this.prisma.checklistItem.findFirst({
      where: { id: itemId, inspectionId },
      select: { id: true },
    });
    if (!item) return null;
    await this.prisma.$transaction(async (tx) => {
      await tx.checklistItem.update({
        where: { id: itemId },
        data: {
          outcome: input.outcome,
          ...(input.observation !== undefined
            ? { observation: cleanText(input.observation) }
            : {}),
          ...("measurement" in input ? { measurement: input.measurement ?? null } : {}),
          ...(input.unit !== undefined ? { unit: cleanText(input.unit) } : {}),
          ...(input.evidenceReference !== undefined
            ? { evidenceReference: cleanText(input.evidenceReference) }
            : {}),
        },
      });
      await writeAudit(tx, {
        actorId,
        entityType: "INSPECTION",
        entityId: inspectionId,
        action: "CHECKLIST_UPDATED",
        summary: `Updated checklist item for inspection ${inspection.inspectionCode}.`,
      });
    });
    const updated = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: checklistInclude,
    });
    return updated ? toInspectionRecord(updated) : null;
  }

  async listAnomalies(assetId?: string): Promise<AnomalyRecord[]> {
    const anomalies = await this.prisma.anomaly.findMany({
      ...(assetId ? { where: { assetId } } : {}),
      orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });
    return anomalies.map(toAnomalyRecord);
  }

  async createAnomaly(
    actorId: string,
    input: CreateAnomalyInput,
  ): Promise<AnomalyRecord> {
    await this.requireActiveAsset(input.assetId);
    if (input.assignedToId) {
      await this.requireUser(input.assignedToId, ["ENGINEER", "INSPECTOR", "ADMIN"]);
    }
    if (input.inspectionId) {
      const inspection = await this.prisma.inspection.findUnique({
        where: { id: input.inspectionId },
        select: { assetId: true },
      });
      if (!inspection || inspection.assetId !== input.assetId) {
        throw new WorkflowRuleError(
          "INVALID_INSPECTION_LINK",
          "The selected inspection does not belong to this asset.",
        );
      }
    }
    const anomaly = await this.prisma.$transaction(async (tx) => {
      const created = await tx.anomaly.create({
        data: {
          reference: makeReference("ANOM"),
          assetId: input.assetId,
          inspectionId: input.inspectionId ?? null,
          type: input.type,
          severity: input.severity,
          title: input.title.trim(),
          description: input.description.trim(),
          detectionDetails: cleanText(input.detectionDetails),
          assignedToId: input.assignedToId ?? null,
          createdById: actorId,
        },
      });
      await writeAudit(tx, {
        actorId,
        entityType: "ANOMALY",
        entityId: created.id,
        action: "CREATED",
        toStatus: created.status,
        summary: `Created anomaly ${created.reference}.`,
      });
      return created;
    });
    return toAnomalyRecord(anomaly);
  }

  async updateAnomaly(
    actorId: string,
    id: string,
    input: UpdateAnomalyInput,
  ): Promise<AnomalyRecord | null> {
    const existing = await this.prisma.anomaly.findUnique({ where: { id } });
    if (!existing) return null;
    if (input.assignedToId) {
      await this.requireUser(input.assignedToId, ["ENGINEER", "INSPECTOR", "ADMIN"]);
    }
    const nextStatus = input.status;
    if (!this.canTransitionAnomaly(existing.status, nextStatus)) {
      throw new WorkflowRuleError(
        "INVALID_ANOMALY_TRANSITION",
        `Anomaly cannot transition from ${existing.status} to ${nextStatus}.`,
      );
    }
    const resolutionNotes =
      input.resolutionNotes === undefined
        ? existing.resolutionNotes
        : cleanText(input.resolutionNotes);
    if (nextStatus === "RESOLVED" && !resolutionNotes) {
      throw new WorkflowRuleError(
        "RESOLUTION_NOTES_REQUIRED",
        "Resolution notes are required before resolving an anomaly.",
      );
    }
    if (nextStatus === "CLOSED") {
      await this.requireUser(actorId, ["ENGINEER", "ADMIN"]);
      const workOrder = await this.prisma.workOrder.findUnique({
        where: { anomalyId: id },
        select: { status: true },
      });
      const verificationNotes =
        input.verificationNotes === undefined
          ? existing.verificationNotes
          : cleanText(input.verificationNotes);
      if (workOrder?.status !== "VERIFIED" || !verificationNotes) {
        throw new WorkflowRuleError(
          "CORRECTIVE_ACTION_NOT_VERIFIED",
          "Close the anomaly only after its work order is engineer-verified and verification notes are recorded.",
        );
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.anomaly.update({
        where: { id },
        data: {
          status: nextStatus,
          assignedToId:
            input.assignedToId === undefined ? existing.assignedToId : input.assignedToId,
          resolutionNotes:
            input.resolutionNotes === undefined
              ? existing.resolutionNotes
              : cleanText(input.resolutionNotes),
          verificationNotes:
            input.verificationNotes === undefined
              ? existing.verificationNotes
              : cleanText(input.verificationNotes),
          verifiedById:
            nextStatus === "CLOSED" && existing.status !== "CLOSED"
              ? actorId
              : existing.verifiedById,
          verifiedAt:
            nextStatus === "CLOSED" && existing.status !== "CLOSED"
              ? new Date()
              : existing.verifiedAt,
          closedAt:
            nextStatus === "CLOSED" && existing.status !== "CLOSED"
              ? new Date()
              : existing.closedAt,
        },
      });
      if (existing.status !== nextStatus) {
        await writeAudit(tx, {
          actorId,
          entityType: "ANOMALY",
          entityId: id,
          action: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: nextStatus,
          summary: `Anomaly ${existing.reference} changed to ${nextStatus}.`,
        });
      }
      return record;
    });
    return toAnomalyRecord(updated);
  }

  async assessRisk(
    actorId: string,
    anomalyId: string,
    input: RiskAssessmentInput,
  ): Promise<RiskAssessmentRecord | null> {
    const anomaly = await this.prisma.anomaly.findUnique({
      where: { id: anomalyId },
      select: { id: true, status: true },
    });
    if (!anomaly) return null;
    if (anomaly.status === "CLOSED") {
      throw new WorkflowRuleError(
        "ANOMALY_CLOSED",
        "Risk cannot be reassessed for a closed anomaly.",
      );
    }
    const calculated = calculateIllustrativeRisk(input);
    const assessment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.riskAssessment.create({
        data: {
          anomalyId,
          version: calculated.version,
          likelihood: input.likelihood,
          consequence: input.consequence,
          exposure: input.exposure,
          score: calculated.score,
          category: calculated.category,
          factors: input.factors,
          explanation: calculated.explanation,
          assessedById: actorId,
        },
      });
      await writeAudit(tx, {
        actorId,
        entityType: "ANOMALY",
        entityId: anomalyId,
        action: "RISK_ASSESSED",
        summary: `Recorded ${calculated.category} illustrative risk assessment (${calculated.version}).`,
      });
      return created;
    });
    return toRiskAssessmentRecord(assessment);
  }

  async listRiskAssessments(anomalyId: string): Promise<RiskAssessmentRecord[]> {
    const assessments = await this.prisma.riskAssessment.findMany({
      where: { anomalyId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return assessments.map(toRiskAssessmentRecord);
  }

  async listWorkOrders(assetId?: string): Promise<WorkOrderRecord[]> {
    const workOrders = await this.prisma.workOrder.findMany({
      ...(assetId ? { where: { assetId } } : {}),
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return workOrders.map(toWorkOrderRecord);
  }

  async createWorkOrder(
    actorId: string,
    input: CreateWorkOrderInput,
  ): Promise<WorkOrderRecord> {
    await this.requireActiveAsset(input.assetId);
    if (input.assignedToId) {
      await this.requireUser(input.assignedToId, ["ENGINEER", "INSPECTOR", "ADMIN"]);
    }
    if (input.anomalyId) {
      const anomaly = await this.prisma.anomaly.findUnique({
        where: { id: input.anomalyId },
        select: { assetId: true, status: true },
      });
      if (!anomaly || anomaly.assetId !== input.assetId || anomaly.status === "CLOSED") {
        throw new WorkflowRuleError(
          "INVALID_ANOMALY_LINK",
          "The selected anomaly is missing, closed, or belongs to a different asset.",
        );
      }
    }
    const workOrder = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workOrder.create({
        data: {
          number: makeReference("WO"),
          assetId: input.assetId,
          anomalyId: input.anomalyId ?? null,
          title: input.title.trim(),
          description: cleanText(input.description),
          priority: input.priority,
          plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          assignedToId: input.assignedToId ?? null,
          createdById: actorId,
        },
      });
      await writeAudit(tx, {
        actorId,
        entityType: "WORK_ORDER",
        entityId: created.id,
        action: "CREATED",
        toStatus: created.status,
        summary: `Created work order ${created.number}.`,
      });
      return created;
    });
    return toWorkOrderRecord(workOrder);
  }

  async updateWorkOrder(
    actorId: string,
    id: string,
    input: UpdateWorkOrderInput,
  ): Promise<WorkOrderRecord | null> {
    const existing = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!existing) return null;
    const nextStatus = input.status;
    if (!this.canTransitionWorkOrder(existing.status, nextStatus)) {
      throw new WorkflowRuleError(
        "INVALID_WORK_ORDER_TRANSITION",
        `Work order cannot transition from ${existing.status} to ${nextStatus}.`,
      );
    }
    if (input.assignedToId) {
      await this.requireUser(input.assignedToId, ["ENGINEER", "INSPECTOR", "ADMIN"]);
    }
    const completionNotes =
      input.completionNotes === undefined
        ? existing.completionNotes
        : cleanText(input.completionNotes);
    if (nextStatus === "COMPLETED" && !completionNotes) {
      throw new WorkflowRuleError(
        "COMPLETION_NOTES_REQUIRED",
        "Completion notes are required before completing a work order.",
      );
    }
    const verificationNotes =
      input.verificationNotes === undefined
        ? existing.verificationNotes
        : cleanText(input.verificationNotes);
    if (nextStatus === "VERIFIED" && existing.status !== "VERIFIED") {
      await this.requireUser(actorId, ["ENGINEER", "ADMIN"]);
      if (!existing.completedAt || !verificationNotes) {
        throw new WorkflowRuleError(
          "VERIFICATION_REQUIRED",
          "An engineer must verify a completed work order and record verification notes.",
        );
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.workOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          assignedToId:
            input.assignedToId === undefined ? existing.assignedToId : input.assignedToId,
          completionNotes:
            input.completionNotes === undefined
              ? existing.completionNotes
              : cleanText(input.completionNotes),
          verificationNotes: verificationNotes,
          completedAt:
            nextStatus === "COMPLETED" && existing.status !== "COMPLETED"
              ? new Date()
              : existing.completedAt,
          verifiedById:
            nextStatus === "VERIFIED" && existing.status !== "VERIFIED"
              ? actorId
              : existing.verifiedById,
          verifiedAt:
            nextStatus === "VERIFIED" && existing.status !== "VERIFIED"
              ? new Date()
              : existing.verifiedAt,
        },
      });
      if (existing.status !== nextStatus) {
        await writeAudit(tx, {
          actorId,
          entityType: "WORK_ORDER",
          entityId: id,
          action: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: nextStatus,
          summary: `Work order ${existing.number} changed to ${nextStatus}.`,
        });
      }
      return record;
    });
    return toWorkOrderRecord(updated);
  }

  async listAuditEvents(entityId?: string): Promise<AuditEventRecord[]> {
    const events = await this.prisma.auditEvent.findMany({
      ...(entityId ? { where: { entityId } } : {}),
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return events.map(toAuditEventRecord);
  }

  private async requireActiveAsset(id: string): Promise<void> {
    const asset = await this.prisma.asset.findFirst({
      where: { id, isArchived: false },
      select: { id: true },
    });
    if (!asset) {
      throw new WorkflowRuleError(
        "ASSET_NOT_FOUND",
        "The selected active asset was not found.",
      );
    }
  }

  private async requireUser(id: string, roles: UserSummary["role"][]): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: { role: true },
    });
    if (!user || !roles.includes(user.role)) {
      throw new WorkflowRuleError(
        "INVALID_ASSIGNEE",
        "The selected user is inactive or does not have an eligible role.",
      );
    }
  }

  private canTransitionInspection(
    from: InspectionRecord["status"],
    to: InspectionRecord["status"],
  ): boolean {
    if (from === to) return true;
    const transitions: Record<InspectionRecord["status"], InspectionRecord["status"][]> =
      {
        DRAFT: ["PLANNED", "CANCELLED"],
        PLANNED: ["IN_PROGRESS", "CANCELLED"],
        IN_PROGRESS: ["COMPLETED", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: [],
      };
    return transitions[from].includes(to);
  }

  private canTransitionAnomaly(
    from: AnomalyRecord["status"],
    to: AnomalyRecord["status"],
  ): boolean {
    if (from === to) return true;
    const transitions: Record<AnomalyRecord["status"], AnomalyRecord["status"][]> = {
      OPEN: ["IN_PROGRESS"],
      IN_PROGRESS: ["RESOLVED"],
      RESOLVED: ["CLOSED"],
      CLOSED: [],
    };
    return transitions[from].includes(to);
  }

  private canTransitionWorkOrder(
    from: WorkOrderRecord["status"],
    to: WorkOrderRecord["status"],
  ): boolean {
    if (from === to) return true;
    const transitions: Record<WorkOrderRecord["status"], WorkOrderRecord["status"][]> = {
      OPEN: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED"],
      COMPLETED: ["VERIFIED"],
      VERIFIED: [],
      CANCELLED: [],
    };
    return transitions[from].includes(to);
  }
}
