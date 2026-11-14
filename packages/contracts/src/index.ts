import { z } from "zod";

export const assetTypes = [
  "PLATFORM",
  "PIPELINE",
  "RISER",
  "VALVE",
  "MANIFOLD",
  "CONNECTOR",
  "PUMP",
  "EQUIPMENT",
] as const;

export const assetHealthStatuses = [
  "UNKNOWN",
  "HEALTHY",
  "ATTENTION",
  "CRITICAL",
] as const;

export const assetCriticalities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const assetOperationalStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const userRoles = ["ADMIN", "ENGINEER", "INSPECTOR", "VIEWER"] as const;
export const inspectionTypes = [
  "GENERAL",
  "CORROSION",
  "CATHODIC_PROTECTION",
  "VIBRATION",
  "FUNCTIONAL",
] as const;
export const inspectionStatuses = [
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export const checklistOutcomes = ["OPEN", "PASS", "FAIL", "NOT_APPLICABLE"] as const;
export const anomalyTypes = [
  "CORROSION",
  "CATHODIC_PROTECTION",
  "VIBRATION",
  "LEAK",
  "INSTRUMENTATION",
  "OTHER",
] as const;
export const anomalySeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const anomalyStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const riskCategories = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export const workOrderPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const workOrderStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "VERIFIED",
  "CANCELLED",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional();
const dateTime = z.string().datetime({ offset: true });

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(200),
  })
  .strict();

export const userSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.enum(userRoles),
});

export const authSessionSchema = z.object({
  token: z.string().min(32),
  expiresAt: dateTime,
  user: userSummarySchema,
});

export const inspectionChecklistItemSchema = z.object({
  id: z.string(),
  position: z.number().int().nonnegative(),
  prompt: z.string(),
  outcome: z.enum(checklistOutcomes),
  observation: z.string().nullable(),
  measurement: z.number().nullable(),
  unit: z.string().nullable(),
  evidenceReference: z.string().nullable(),
  updatedAt: dateTime,
});

export const inspectionRecordSchema = z.object({
  id: z.string(),
  inspectionCode: z.string(),
  assetId: z.string(),
  type: z.enum(inspectionTypes),
  status: z.enum(inspectionStatuses),
  plannedAt: dateTime.nullable(),
  startedAt: dateTime.nullable(),
  completedAt: dateTime.nullable(),
  notes: z.string().nullable(),
  createdById: z.string(),
  assignedToId: z.string().nullable(),
  checklist: z.array(inspectionChecklistItemSchema),
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const createInspectionSchema = z
  .object({
    assetId: z.string().min(1).max(64),
    type: z.enum(inspectionTypes),
    plannedAt: dateTime.optional(),
    assignedToId: z.string().min(1).max(64).optional(),
    notes: optionalText(4000),
    checklistPrompts: z.array(z.string().trim().min(2).max(300)).min(1).max(50),
  })
  .strict();

export const updateChecklistItemSchema = z
  .object({
    outcome: z.enum(checklistOutcomes),
    observation: optionalText(2000),
    measurement: z.number().finite().nullable().optional(),
    unit: optionalText(40),
    evidenceReference: optionalText(500),
  })
  .strict();

export const updateInspectionSchema = z
  .object({
    status: z.enum(inspectionStatuses),
    plannedAt: dateTime.nullable().optional(),
    assignedToId: z.string().min(1).max(64).nullable().optional(),
    notes: optionalText(4000),
  })
  .strict();

export const anomalyRecordSchema = z.object({
  id: z.string(),
  reference: z.string(),
  assetId: z.string(),
  inspectionId: z.string().nullable(),
  type: z.enum(anomalyTypes),
  severity: z.enum(anomalySeverities),
  status: z.enum(anomalyStatuses),
  title: z.string(),
  description: z.string(),
  detectionDetails: z.string().nullable(),
  assignedToId: z.string().nullable(),
  resolutionNotes: z.string().nullable(),
  verificationNotes: z.string().nullable(),
  verifiedById: z.string().nullable(),
  verifiedAt: dateTime.nullable(),
  closedAt: dateTime.nullable(),
  createdById: z.string(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const createAnomalySchema = z
  .object({
    assetId: z.string().min(1).max(64),
    inspectionId: z.string().min(1).max(64).optional(),
    type: z.enum(anomalyTypes),
    severity: z.enum(anomalySeverities),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(3).max(4000),
    detectionDetails: optionalText(2000),
    assignedToId: z.string().min(1).max(64).optional(),
  })
  .strict();

export const updateAnomalySchema = z
  .object({
    status: z.enum(anomalyStatuses),
    assignedToId: z.string().min(1).max(64).nullable().optional(),
    resolutionNotes: optionalText(4000),
    verificationNotes: optionalText(2000),
  })
  .strict();

export const riskAssessmentInputSchema = z
  .object({
    likelihood: z.number().int().min(1).max(5),
    consequence: z.number().int().min(1).max(5),
    exposure: z.number().int().min(1).max(5),
    factors: z.record(
      z.string(),
      z.union([z.string().max(300), z.number(), z.boolean()]),
    ),
  })
  .strict();

export const riskAssessmentRecordSchema = z.object({
  id: z.string(),
  anomalyId: z.string(),
  version: z.string(),
  likelihood: z.number().int(),
  consequence: z.number().int(),
  exposure: z.number().int(),
  score: z.number().int(),
  category: z.enum(riskCategories),
  factors: z.record(z.string(), z.unknown()),
  explanation: z.string(),
  assessedById: z.string(),
  createdAt: dateTime,
});

export const workOrderRecordSchema = z.object({
  id: z.string(),
  number: z.string(),
  assetId: z.string(),
  anomalyId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(workOrderPriorities),
  status: z.enum(workOrderStatuses),
  plannedAt: dateTime.nullable(),
  dueAt: dateTime.nullable(),
  completedAt: dateTime.nullable(),
  completionNotes: z.string().nullable(),
  verifiedById: z.string().nullable(),
  verifiedAt: dateTime.nullable(),
  verificationNotes: z.string().nullable(),
  createdById: z.string(),
  assignedToId: z.string().nullable(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const createWorkOrderSchema = z
  .object({
    assetId: z.string().min(1).max(64),
    anomalyId: z.string().min(1).max(64).optional(),
    title: z.string().trim().min(3).max(160),
    description: optionalText(4000),
    priority: z.enum(workOrderPriorities),
    plannedAt: dateTime.optional(),
    dueAt: dateTime.optional(),
    assignedToId: z.string().min(1).max(64).optional(),
  })
  .strict();

export const updateWorkOrderSchema = z
  .object({
    status: z.enum(workOrderStatuses),
    completionNotes: optionalText(4000),
    verificationNotes: optionalText(2000),
    assignedToId: z.string().min(1).max(64).nullable().optional(),
  })
  .strict();

export const auditEventSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  fromStatus: z.string().nullable(),
  toStatus: z.string().nullable(),
  summary: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: dateTime,
});

export const workflowSummarySchema = z.object({
  inspections: z.object({
    PLANNED: z.number().int().nonnegative(),
    IN_PROGRESS: z.number().int().nonnegative(),
    OVERDUE: z.number().int().nonnegative(),
  }),
  anomalies: z.object({
    OPEN: z.number().int().nonnegative(),
    CRITICAL: z.number().int().nonnegative(),
  }),
  risk: z.object({
    LOW: z.number().int().nonnegative(),
    MODERATE: z.number().int().nonnegative(),
    HIGH: z.number().int().nonnegative(),
    CRITICAL: z.number().int().nonnegative(),
  }),
  workOrders: z.object({
    OPEN: z.number().int().nonnegative(),
    OVERDUE: z.number().int().nonnegative(),
  }),
});

export const createAssetSchema = z
  .object({
    assetCode: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    name: z.string().trim().min(2).max(120),
    type: z.enum(assetTypes),
    description: optionalText(2000),
    parentId: optionalText(64),
    location: z.string().trim().min(2).max(160),
    offshoreField: optionalText(120),
    health: z.enum(assetHealthStatuses).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    installationDate: z.string().date().nullable().optional(),
    criticality: z.enum(assetCriticalities),
    manufacturer: optionalText(120),
    model: optionalText(120),
    serialNumber: optionalText(120),
  })
  .strict();

export const updateAssetSchema = createAssetSchema
  .partial()
  .extend({
    description: z.string().trim().max(2000).nullable().optional(),
    parentId: z.string().trim().max(64).nullable().optional(),
    offshoreField: z.string().trim().max(120).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    installationDate: z.string().date().nullable().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    manufacturer: z.string().trim().max(120).nullable().optional(),
    model: z.string().trim().max(120).nullable().optional(),
    serialNumber: z.string().trim().max(120).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one asset field must be provided.",
  });

export const assetRecordSchema = z.object({
  id: z.string(),
  assetCode: z.string(),
  name: z.string(),
  type: z.enum(assetTypes),
  description: z.string().nullable(),
  parentId: z.string().nullable(),
  location: z.string(),
  offshoreField: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  installationDate: z.string().nullable(),
  health: z.enum(assetHealthStatuses),
  criticality: z.enum(assetCriticalities),
  status: z.enum(assetOperationalStatuses),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  isArchived: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listAssetsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.enum(assetTypes).optional(),
  status: z.enum(assetOperationalStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listAssetsResponseSchema = z.object({
  data: z.array(assetRecordSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const assetHealthSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  byHealth: z.object({
    UNKNOWN: z.number().int().nonnegative(),
    HEALTHY: z.number().int().nonnegative(),
    ATTENTION: z.number().int().nonnegative(),
    CRITICAL: z.number().int().nonnegative(),
  }),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type AssetRecord = z.infer<typeof assetRecordSchema>;
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
export type AssetHealthSummary = z.infer<typeof assetHealthSummarySchema>;
export type UserRole = (typeof userRoles)[number];
export type UserSummary = z.infer<typeof userSummarySchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type InspectionRecord = z.infer<typeof inspectionRecordSchema>;
export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type AnomalyRecord = z.infer<typeof anomalyRecordSchema>;
export type CreateAnomalyInput = z.infer<typeof createAnomalySchema>;
export type UpdateAnomalyInput = z.infer<typeof updateAnomalySchema>;
export type RiskAssessmentInput = z.infer<typeof riskAssessmentInputSchema>;
export type RiskAssessmentRecord = z.infer<typeof riskAssessmentRecordSchema>;
export type WorkOrderRecord = z.infer<typeof workOrderRecordSchema>;
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
export type AuditEventRecord = z.infer<typeof auditEventSchema>;
export type WorkflowSummary = z.infer<typeof workflowSummarySchema>;
