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

export class WorkflowRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkflowRuleError";
  }
}

export interface WorkflowRepository {
  listUsers(): Promise<UserSummary[]>;
  summary(): Promise<WorkflowSummary>;
  listInspections(assetId?: string): Promise<InspectionRecord[]>;
  createInspection(
    actorId: string,
    input: CreateInspectionInput,
  ): Promise<InspectionRecord>;
  updateInspection(
    actorId: string,
    id: string,
    input: UpdateInspectionInput,
  ): Promise<InspectionRecord | null>;
  updateChecklistItem(
    actorId: string,
    inspectionId: string,
    itemId: string,
    input: UpdateChecklistItemInput,
  ): Promise<InspectionRecord | null>;
  listAnomalies(assetId?: string): Promise<AnomalyRecord[]>;
  createAnomaly(actorId: string, input: CreateAnomalyInput): Promise<AnomalyRecord>;
  updateAnomaly(
    actorId: string,
    id: string,
    input: UpdateAnomalyInput,
  ): Promise<AnomalyRecord | null>;
  assessRisk(
    actorId: string,
    anomalyId: string,
    input: RiskAssessmentInput,
  ): Promise<RiskAssessmentRecord | null>;
  listRiskAssessments(anomalyId: string): Promise<RiskAssessmentRecord[]>;
  listWorkOrders(assetId?: string): Promise<WorkOrderRecord[]>;
  createWorkOrder(actorId: string, input: CreateWorkOrderInput): Promise<WorkOrderRecord>;
  updateWorkOrder(
    actorId: string,
    id: string,
    input: UpdateWorkOrderInput,
  ): Promise<WorkOrderRecord | null>;
  listAuditEvents(entityId?: string): Promise<AuditEventRecord[]>;
}
