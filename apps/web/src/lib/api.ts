import type {
  AnomalyRecord,
  AuditEventRecord,
  AssetHealthSummary,
  AssetRecord,
  AuthSession,
  CreateAnomalyInput,
  CreateAssetInput,
  CreateInspectionInput,
  CreateWorkOrderInput,
  InspectionRecord,
  ListAssetsQuery,
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
import {
  anomalyRecordSchema,
  auditEventSchema,
  assetHealthSummarySchema,
  assetRecordSchema,
  authSessionSchema,
  createAnomalySchema,
  createInspectionSchema,
  createWorkOrderSchema,
  inspectionRecordSchema,
  loginSchema,
  listAssetsResponseSchema,
  riskAssessmentInputSchema,
  riskAssessmentRecordSchema,
  updateAssetSchema,
  updateAnomalySchema,
  updateChecklistItemSchema,
  updateInspectionSchema,
  updateWorkOrderSchema,
  userSummarySchema,
  workflowSummarySchema,
  workOrderRecordSchema,
} from "@arctic/contracts";
import { z } from "zod";
import { readAuthSession } from "./auth-storage.ts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

const apiErrorBodySchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});
const assetRecordEnvelopeSchema = z.object({ data: assetRecordSchema });
const apiHealthSchema = z.object({ status: z.string() });
const userListSchema = z.object({ data: z.array(userSummarySchema) });
const inspectionListSchema = z.object({ data: z.array(inspectionRecordSchema) });
const anomalyListSchema = z.object({ data: z.array(anomalyRecordSchema) });
const riskAssessmentListSchema = z.object({
  data: z.array(riskAssessmentRecordSchema),
});
const workOrderListSchema = z.object({ data: z.array(workOrderRecordSchema) });
const auditEventListSchema = z.object({ data: z.array(auditEventSchema) });
const inspectionEnvelopeSchema = z.object({ data: inspectionRecordSchema });
const anomalyEnvelopeSchema = z.object({ data: anomalyRecordSchema });
const riskAssessmentEnvelopeSchema = z.object({ data: riskAssessmentRecordSchema });
const workOrderEnvelopeSchema = z.object({ data: workOrderRecordSchema });

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const session = readAuthSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const parsedBody = apiErrorBodySchema.safeParse(await response.json());
    const body = parsedBody.success ? parsedBody.data : undefined;
    throw new ApiError(
      body?.error?.message ?? "The request could not be completed.",
      response.status,
      body?.error?.code,
    );
  }

  return schema.parse(await response.json());
}

export async function login(input: z.infer<typeof loginSchema>): Promise<AuthSession> {
  return request("/auth/login", authSessionSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser() {
  return request("/auth/me", userSummarySchema);
}

export async function logout() {
  return request("/auth/logout", z.object({ status: z.literal("ok") }), {
    method: "POST",
  });
}

export async function listAssets(
  query: Partial<Pick<ListAssetsQuery, "page" | "pageSize" | "q" | "type" | "status">>,
): Promise<{ data: AssetRecord[]; total: number }> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request(`/assets${suffix}`, listAssetsResponseSchema);
}

export async function getAsset(id: string): Promise<AssetRecord> {
  const response = await request(
    `/assets/${encodeURIComponent(id)}`,
    assetRecordEnvelopeSchema,
  );
  return response.data;
}

export async function createAsset(input: CreateAssetInput): Promise<AssetRecord> {
  const response = await request("/assets", assetRecordEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateAsset(
  id: string,
  input: z.infer<typeof updateAssetSchema>,
): Promise<AssetRecord> {
  const response = await request(
    `/assets/${encodeURIComponent(id)}`,
    assetRecordEnvelopeSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function archiveAsset(id: string): Promise<AssetRecord> {
  const response = await request(
    `/assets/${encodeURIComponent(id)}`,
    assetRecordEnvelopeSchema,
    { method: "DELETE" },
  );
  return response.data;
}

export async function getApiHealth(): Promise<{ status: string }> {
  return request("/health", apiHealthSchema);
}

export async function getAssetHealthSummary(): Promise<AssetHealthSummary> {
  return request("/dashboard/asset-health", assetHealthSummarySchema);
}

export async function getWorkflowSummary(): Promise<WorkflowSummary> {
  return request("/dashboard/workflow", workflowSummarySchema);
}

export async function listUsers(): Promise<UserSummary[]> {
  const response = await request("/users", userListSchema);
  return response.data;
}

function listQuery(path: string, assetId?: string): string {
  return assetId ? `${path}?assetId=${encodeURIComponent(assetId)}` : path;
}

export async function listInspections(assetId?: string): Promise<InspectionRecord[]> {
  const response = await request(
    listQuery("/inspections", assetId),
    inspectionListSchema,
  );
  return response.data;
}

export async function createInspection(
  input: CreateInspectionInput,
): Promise<InspectionRecord> {
  const data = createInspectionSchema.parse(input);
  const response = await request("/inspections", inspectionEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function updateInspection(
  id: string,
  input: UpdateInspectionInput,
): Promise<InspectionRecord> {
  const data = updateInspectionSchema.parse(input);
  const response = await request(
    `/inspections/${encodeURIComponent(id)}`,
    inspectionEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify(data) },
  );
  return response.data;
}

export async function updateChecklistItem(
  inspectionId: string,
  itemId: string,
  input: UpdateChecklistItemInput,
): Promise<InspectionRecord> {
  const data = updateChecklistItemSchema.parse(input);
  const response = await request(
    `/inspections/${encodeURIComponent(inspectionId)}/checklist/${encodeURIComponent(itemId)}`,
    inspectionEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify(data) },
  );
  return response.data;
}

export async function listAnomalies(assetId?: string): Promise<AnomalyRecord[]> {
  const response = await request(listQuery("/anomalies", assetId), anomalyListSchema);
  return response.data;
}

export async function createAnomaly(input: CreateAnomalyInput): Promise<AnomalyRecord> {
  const data = createAnomalySchema.parse(input);
  const response = await request("/anomalies", anomalyEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function updateAnomaly(
  id: string,
  input: UpdateAnomalyInput,
): Promise<AnomalyRecord> {
  const data = updateAnomalySchema.parse(input);
  const response = await request(
    `/anomalies/${encodeURIComponent(id)}`,
    anomalyEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify(data) },
  );
  return response.data;
}

export async function listRiskAssessments(
  anomalyId: string,
): Promise<RiskAssessmentRecord[]> {
  const response = await request(
    `/anomalies/${encodeURIComponent(anomalyId)}/risk-assessments`,
    riskAssessmentListSchema,
  );
  return response.data;
}

export async function assessRisk(
  anomalyId: string,
  input: RiskAssessmentInput,
): Promise<RiskAssessmentRecord> {
  const data = riskAssessmentInputSchema.parse(input);
  const response = await request(
    `/anomalies/${encodeURIComponent(anomalyId)}/risk-assessments`,
    riskAssessmentEnvelopeSchema,
    { method: "POST", body: JSON.stringify(data) },
  );
  return response.data;
}

export async function listWorkOrders(assetId?: string): Promise<WorkOrderRecord[]> {
  const response = await request(listQuery("/work-orders", assetId), workOrderListSchema);
  return response.data;
}

export async function createWorkOrder(
  input: CreateWorkOrderInput,
): Promise<WorkOrderRecord> {
  const data = createWorkOrderSchema.parse(input);
  const response = await request("/work-orders", workOrderEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function updateWorkOrder(
  id: string,
  input: UpdateWorkOrderInput,
): Promise<WorkOrderRecord> {
  const data = updateWorkOrderSchema.parse(input);
  const response = await request(
    `/work-orders/${encodeURIComponent(id)}`,
    workOrderEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify(data) },
  );
  return response.data;
}

export async function listAuditEvents(entityId?: string): Promise<AuditEventRecord[]> {
  const path = entityId
    ? `/audit-events?entityId=${encodeURIComponent(entityId)}`
    : "/audit-events";
  const response = await request(path, auditEventListSchema);
  return response.data;
}

export type ReportKind =
  "assets" | "health" | "inspections" | "anomalies" | "risk" | "work-orders";

export async function downloadReport(
  report: ReportKind,
  assetId?: string,
): Promise<void> {
  const session = readAuthSession();
  const path = listQuery(`/reports/${report}.csv`, assetId);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  });
  if (!response.ok) {
    const parsedBody = apiErrorBodySchema.safeParse(await response.json());
    const body = parsedBody.success ? parsedBody.data : undefined;
    throw new ApiError(
      body?.error?.message ?? "The report could not be downloaded.",
      response.status,
      body?.error?.code,
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report}-report.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
