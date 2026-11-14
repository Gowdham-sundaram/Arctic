import { randomUUID } from "node:crypto";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import pino from "pino";
import { pinoHttp } from "pino-http";
import {
  assetHealthSummarySchema,
  anomalyRecordSchema,
  auditEventSchema,
  authSessionSchema,
  createAnomalySchema,
  createAssetSchema,
  createInspectionSchema,
  createWorkOrderSchema,
  inspectionRecordSchema,
  loginSchema,
  listAssetsQuerySchema,
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
import type { AssetRepository } from "./asset-repository.ts";
import type { AuthRepository } from "./auth-repository.ts";
import { extractBearerToken, requireRole, requireUser } from "./auth-middleware.ts";
import {
  CircularAssetHierarchyError,
  InvalidAssetParentError,
  isInvalidRelationError,
  isUniqueConstraintError,
} from "./prisma-asset-repository.ts";
import { WorkflowRuleError, type WorkflowRepository } from "./workflow-repository.ts";

type AsyncHandler = (request: Request, response: Response) => Promise<void>;

function asyncHandler(handler: AsyncHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

function validationDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

function routeId(request: Request): string | undefined {
  const id = request.params.id;
  return typeof id === "string" && id.length > 0 && id.length <= 64 ? id : undefined;
}

function optionalQueryId(
  request: Request,
  key: "assetId" | "entityId",
): string | undefined | false {
  const value = request.query[key];
  if (value === undefined) return undefined;
  return typeof value === "string" && value.trim().length > 0 && value.length <= 64
    ? value
    : false;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function sendCsv(
  response: Response,
  filename: string,
  headers: string[],
  rows: unknown[][],
): void {
  const content = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  response
    .type("text/csv")
    .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    .send(`\uFEFF${content}`);
}

export function createApp(
  assets: AssetRepository,
  auth: AuthRepository,
  workflows: WorkflowRepository,
  logger = pino({ level: process.env.LOG_LEVEL ?? "info" }),
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    pinoHttp({
      logger,
      genReqId: (request, response) => {
        const incomingId = request.headers["x-request-id"];
        const requestId =
          typeof incomingId === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            incomingId,
          )
            ? incomingId
            : randomUUID();
        response.setHeader("x-request-id", requestId);
        return requestId;
      },
    }),
  );
  app.use(
    cors({
      origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/v1/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get(
    "/api/v1/ready",
    asyncHandler(async (_request, response) => {
      await assets.ping();
      response.json({ status: "ready" });
    }),
  );

  app.post(
    "/api/v1/auth/login",
    asyncHandler(async (request, response) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Login data is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const session = await auth.login(parsed.data.email, parsed.data.password);
      if (!session) {
        response.status(401).json({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Email or password is incorrect.",
          },
        });
        return;
      }
      response.json(authSessionSchema.parse(session));
    }),
  );

  app.get("/api/v1/auth/me", requireUser(auth), (request, response) => {
    response.json(userSummarySchema.parse(request.user));
  });

  app.post(
    "/api/v1/auth/logout",
    requireUser(auth),
    asyncHandler(async (request, response) => {
      const token = extractBearerToken(request);
      if (!token) {
        response.status(401).json({
          error: { code: "UNAUTHENTICATED", message: "Sign in to continue." },
        });
        return;
      }
      await auth.logout(token);
      response.json({ status: "ok" });
    }),
  );

  app.use("/api/v1/dashboard", requireUser(auth));
  app.get(
    "/api/v1/dashboard/workflow",
    asyncHandler(async (_request, response) => {
      response.json(workflowSummarySchema.parse(await workflows.summary()));
    }),
  );
  app.get(
    "/api/v1/dashboard/asset-health",
    asyncHandler(async (_request, response) => {
      const summary = await assets.healthSummary();
      response.json(assetHealthSummarySchema.parse(summary));
    }),
  );

  app.get(
    "/api/v1/users",
    requireUser(auth),
    asyncHandler(async (_request, response) => {
      response.json({ data: await workflows.listUsers() });
    }),
  );

  app.get(
    "/api/v1/inspections",
    requireUser(auth),
    asyncHandler(async (request, response) => {
      const assetId = optionalQueryId(request, "assetId");
      if (assetId === false) {
        response.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Asset ID query is invalid." },
        });
        return;
      }
      const records = await workflows.listInspections(assetId);
      response.json({
        data: records.map((record) => inspectionRecordSchema.parse(record)),
      });
    }),
  );

  app.post(
    "/api/v1/inspections",
    requireUser(auth),
    requireRole("ADMIN", "ENGINEER", "INSPECTOR"),
    asyncHandler(async (request, response) => {
      const parsed = createInspectionSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Inspection data is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const record = await workflows.createInspection(request.user!.id, parsed.data);
      response.status(201).json({ data: inspectionRecordSchema.parse(record) });
    }),
  );

  app.patch(
    "/api/v1/inspections/:id",
    requireUser(auth),
    requireRole("ADMIN", "ENGINEER", "INSPECTOR"),
    asyncHandler(async (request, response) => {
      const id = routeId(request);
      if (!id) {
        response.status(400).json({
          error: { code: "INVALID_INSPECTION_ID", message: "Inspection ID is invalid." },
        });
        return;
      }
      const parsed = updateInspectionSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Inspection update is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const record = await workflows.updateInspection(request.user!.id, id, parsed.data);
      if (!record) {
        response.status(404).json({
          error: { code: "INSPECTION_NOT_FOUND", message: "Inspection was not found." },
        });
        return;
      }
      response.json({ data: inspectionRecordSchema.parse(record) });
    }),
  );

  app.patch(
    "/api/v1/inspections/:id/checklist/:itemId",
    requireUser(auth),
    requireRole("ADMIN", "ENGINEER", "INSPECTOR"),
    asyncHandler(async (request, response) => {
      const id = routeId(request);
      const itemId =
        typeof request.params.itemId === "string" ? request.params.itemId : undefined;
      if (!id || !itemId) {
        response.status(400).json({
          error: { code: "INVALID_CHECKLIST_ID", message: "Checklist ID is invalid." },
        });
        return;
      }
      const parsed = updateChecklistItemSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Checklist update is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const record = await workflows.updateChecklistItem(
        request.user!.id,
        id,
        itemId,
        parsed.data,
      );
      if (!record) {
        response.status(404).json({
          error: {
            code: "CHECKLIST_ITEM_NOT_FOUND",
            message: "Checklist item was not found.",
          },
        });
        return;
      }
      response.json({ data: inspectionRecordSchema.parse(record) });
    }),
  );

  app.get(
    "/api/v1/anomalies",
    requireUser(auth),
    asyncHandler(async (request, response) => {
      const assetId = optionalQueryId(request, "assetId");
      if (assetId === false) {
        response.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Asset ID query is invalid." },
        });
        return;
      }
      const records = await workflows.listAnomalies(assetId);
      response.json({ data: records.map((record) => anomalyRecordSchema.parse(record)) });
    }),
  );

  app.post(
    "/api/v1/anomalies",
    requireUser(auth),
    requireRole("ADMIN", "ENGINEER", "INSPECTOR"),
    asyncHandler(async (request, response) => {
      const parsed = createAnomalySchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Anomaly data is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const record = await workflows.createAnomaly(request.user!.id, parsed.data);
      response.status(201).json({ data: anomalyRecordSchema.parse(record) });
    }),
  );

  app.patch(
    "/api/v1/anomalies/:id",
    requireUser(auth),
    requireRole("ADMIN", "ENGINEER", "INSPECTOR"),
    asyncHandler(async (request, response) => {
      const id = routeId(request);
      if (!id) {
        response.status(400).json({
          error: { code: "INVALID_ANOMALY_ID", message: "Anomaly ID is invalid." },
        });
        return;
      }
      const parsed = updateAnomalySchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Anomaly update is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const record = await workflows.updateAnomaly(request.user!.id, id, parsed.data);
      if (!record) {
        response.status(404).json({
          error: { code: "ANOMALY_NOT_FOUND", message: "Anomaly was not found." },
        });
        return;
      }
      response.json({ data: anomalyRecordSchema.parse(record) });
    }),
  );

  app.get(
    "/api/v1/anomalies/:id/risk-assessments",
    requireUser(auth),
    asyncHandler(async (request, response) => {
      const id = routeId(request);
      if (!id) {
        response.status(400).json({
          error: { code: "INVALID_ANOMALY_ID", message: "Anomaly ID is invalid." },
        });
        return;
      }
      const records = await workflows.listRiskAssessments(id);
      response.json({
        data: records.map((record) => riskAssessmentRecordSchema.parse(record)),
      });
    }),
  );

  app.post(
    "/api/v1/anomalies/:id/risk-assessments",
    requireUser(auth),
    requireRole("ADMIN", "ENGINEER"),
    asyncHandler(async (request, response) => {
      const id = routeId(request);
      if (!id) {
        response.status(400).json({
          error: { code: "INVALID_ANOMALY_ID", message: "Anomaly ID is invalid." },
        });
        return;
      }
      const parsed = riskAssessmentInputSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Risk assessment input is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const record = await workflows.assessRisk(request.user!.id, id, parsed.data);
      if (!record) {
        response.status(404).json({
          error: { code: "ANOMALY_NOT_FOUND", message: "Anomaly was not found." },
        });
        return;
      }
      response.status(201).json({ data: riskAssessmentRecordSchema.parse(record) });
    }),
  );

  app.get(
    "/api/v1/work-orders",
    requireUser(auth),
    asyncHandler(async (request, response) => {
      const assetId = optionalQueryId(request, "assetId");
      if (assetId === false) {
        response.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Asset ID query is invalid." },
        });
        return;
      }
      const records = await workflows.listWorkOrders(assetId);
      response.json({
        data: records.map((record) => workOrderRecordSchema.parse(record)),
      });
    }),
  );

  app.post(
    "/api/v1/work-orders",
    requireUser(auth),
    requireRole("ADMIN", "ENGINEER"),
    asyncHandler(async (request, response) => {
      const parsed = createWorkOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Work-order data is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const record = await workflows.createWorkOrder(request.user!.id, parsed.data);
      response.status(201).json({ data: workOrderRecordSchema.parse(record) });
    }),
  );

  app.patch(
    "/api/v1/work-orders/:id",
    requireUser(auth),
    requireRole("ADMIN", "ENGINEER", "INSPECTOR"),
    asyncHandler(async (request, response) => {
      const id = routeId(request);
      if (!id) {
        response.status(400).json({
          error: { code: "INVALID_WORK_ORDER_ID", message: "Work-order ID is invalid." },
        });
        return;
      }
      const parsed = updateWorkOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Work-order update is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const record = await workflows.updateWorkOrder(request.user!.id, id, parsed.data);
      if (!record) {
        response.status(404).json({
          error: { code: "WORK_ORDER_NOT_FOUND", message: "Work order was not found." },
        });
        return;
      }
      response.json({ data: workOrderRecordSchema.parse(record) });
    }),
  );

  app.get(
    "/api/v1/audit-events",
    requireUser(auth),
    asyncHandler(async (request, response) => {
      const entityId = optionalQueryId(request, "entityId");
      if (entityId === false) {
        response.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Entity ID query is invalid." },
        });
        return;
      }
      const records = await workflows.listAuditEvents(entityId);
      response.json({ data: records.map((record) => auditEventSchema.parse(record)) });
    }),
  );

  app.get(
    "/api/v1/reports/:report.csv",
    requireUser(auth),
    asyncHandler(async (request, response) => {
      const report = request.params.report;
      const assetId = optionalQueryId(request, "assetId");
      if (assetId === false) {
        response.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Asset ID query is invalid." },
        });
        return;
      }

      if (report === "assets" || report === "health") {
        const rows: unknown[][] = [];
        if (assetId) {
          const asset = await assets.findById(assetId);
          if (asset) {
            rows.push([
              asset.assetCode,
              asset.name,
              asset.type,
              asset.location,
              asset.health,
              asset.criticality,
              asset.status,
              asset.parentId,
              asset.manufacturer,
              asset.model,
              asset.serialNumber,
            ]);
          }
        } else {
          let page = 1;
          let total = 0;
          do {
            const result = await assets.list({ page, pageSize: 100 });
            total = result.total;
            rows.push(
              ...result.data.map((asset) => [
                asset.assetCode,
                asset.name,
                asset.type,
                asset.location,
                asset.health,
                asset.criticality,
                asset.status,
                asset.parentId,
                asset.manufacturer,
                asset.model,
                asset.serialNumber,
              ]),
            );
            page += 1;
          } while (rows.length < total);
        }
        sendCsv(
          response,
          `${report}-report.csv`,
          [
            "assetCode",
            "name",
            "type",
            "location",
            "health",
            "criticality",
            "status",
            "parentId",
            "manufacturer",
            "model",
            "serialNumber",
          ],
          rows,
        );
        return;
      }

      if (report === "inspections") {
        const records = await workflows.listInspections(assetId);
        sendCsv(
          response,
          "inspection-report.csv",
          [
            "inspectionCode",
            "assetId",
            "type",
            "status",
            "plannedAt",
            "assignedToId",
            "openChecklistItems",
            "completedAt",
          ],
          records.map((record) => [
            record.inspectionCode,
            record.assetId,
            record.type,
            record.status,
            record.plannedAt,
            record.assignedToId,
            record.checklist.filter((item) => item.outcome === "OPEN").length,
            record.completedAt,
          ]),
        );
        return;
      }

      if (report === "anomalies") {
        const records = await workflows.listAnomalies(assetId);
        sendCsv(
          response,
          "anomaly-report.csv",
          [
            "reference",
            "assetId",
            "inspectionId",
            "type",
            "severity",
            "status",
            "title",
            "assignedToId",
            "createdAt",
            "closedAt",
          ],
          records.map((record) => [
            record.reference,
            record.assetId,
            record.inspectionId,
            record.type,
            record.severity,
            record.status,
            record.title,
            record.assignedToId,
            record.createdAt,
            record.closedAt,
          ]),
        );
        return;
      }

      if (report === "risk") {
        const anomalies = await workflows.listAnomalies(assetId);
        const records = (
          await Promise.all(
            anomalies.map((anomaly) => workflows.listRiskAssessments(anomaly.id)),
          )
        ).flat();
        sendCsv(
          response,
          "risk-report.csv",
          [
            "anomalyId",
            "version",
            "likelihood",
            "consequence",
            "exposure",
            "score",
            "category",
            "explanation",
            "createdAt",
          ],
          records.map((record) => [
            record.anomalyId,
            record.version,
            record.likelihood,
            record.consequence,
            record.exposure,
            record.score,
            record.category,
            record.explanation,
            record.createdAt,
          ]),
        );
        return;
      }

      if (report === "work-orders") {
        const records = await workflows.listWorkOrders(assetId);
        sendCsv(
          response,
          "work-order-report.csv",
          [
            "number",
            "assetId",
            "anomalyId",
            "title",
            "priority",
            "status",
            "plannedAt",
            "dueAt",
            "assignedToId",
            "completedAt",
            "verifiedAt",
          ],
          records.map((record) => [
            record.number,
            record.assetId,
            record.anomalyId,
            record.title,
            record.priority,
            record.status,
            record.plannedAt,
            record.dueAt,
            record.assignedToId,
            record.completedAt,
            record.verifiedAt,
          ]),
        );
        return;
      }

      response.status(404).json({
        error: {
          code: "REPORT_NOT_FOUND",
          message: "The requested report is unavailable.",
        },
      });
    }),
  );

  app.use("/api/v1/assets", requireUser(auth));
  app.get(
    "/api/v1/assets",
    asyncHandler(async (request, response) => {
      const parsed = listAssetsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Asset query parameters are invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const result = await assets.list(parsed.data);
      response.json({
        ...result,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      });
    }),
  );

  app.post(
    "/api/v1/assets",
    requireRole("ADMIN", "ENGINEER"),
    asyncHandler(async (request, response) => {
      const parsed = createAssetSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Asset data is invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const asset = await assets.create(parsed.data);
      response.status(201).json({ data: asset });
    }),
  );

  app.patch(
    "/api/v1/assets/:id",
    requireRole("ADMIN", "ENGINEER"),
    asyncHandler(async (request, response) => {
      const assetId = request.params.id;
      if (typeof assetId !== "string") {
        response.status(400).json({
          error: { code: "INVALID_ASSET_ID", message: "Asset ID is invalid." },
        });
        return;
      }
      const parsed = updateAssetSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Asset updates are invalid.",
            details: validationDetails(parsed.error.issues),
          },
        });
        return;
      }
      const asset = await assets.update(assetId, parsed.data);
      if (!asset) {
        response.status(404).json({
          error: { code: "ASSET_NOT_FOUND", message: "Asset was not found." },
        });
        return;
      }
      response.json({ data: asset });
    }),
  );

  app.delete(
    "/api/v1/assets/:id",
    requireRole("ADMIN", "ENGINEER"),
    asyncHandler(async (request, response) => {
      const assetId = request.params.id;
      if (typeof assetId !== "string") {
        response.status(400).json({
          error: { code: "INVALID_ASSET_ID", message: "Asset ID is invalid." },
        });
        return;
      }
      const asset = await assets.archive(assetId);
      if (!asset) {
        response.status(404).json({
          error: { code: "ASSET_NOT_FOUND", message: "Asset was not found." },
        });
        return;
      }
      response.json({ data: asset });
    }),
  );

  app.get(
    "/api/v1/assets/:id",
    asyncHandler(async (request, response) => {
      const assetId = request.params.id;
      if (typeof assetId !== "string") {
        response.status(400).json({
          error: { code: "INVALID_ASSET_ID", message: "Asset ID is invalid." },
        });
        return;
      }
      const asset = await assets.findById(assetId);
      if (!asset) {
        response.status(404).json({
          error: { code: "ASSET_NOT_FOUND", message: "Asset was not found." },
        });
        return;
      }
      response.json({ data: asset });
    }),
  );

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "The requested endpoint was not found." },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (
      error instanceof SyntaxError &&
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      response.status(400).json({
        error: { code: "INVALID_JSON", message: "Request body must be valid JSON." },
      });
      return;
    }

    if (isUniqueConstraintError(error)) {
      response.status(409).json({
        error: {
          code: request.path.startsWith("/api/v1/assets")
            ? "ASSET_CODE_CONFLICT"
            : "UNIQUE_CONFLICT",
          message: request.path.startsWith("/api/v1/assets")
            ? "An asset with this asset code already exists."
            : "A record with the requested unique value already exists.",
        },
      });
      return;
    }

    if (isInvalidRelationError(error)) {
      response.status(400).json({
        error: {
          code: request.path.startsWith("/api/v1/assets")
            ? "INVALID_PARENT"
            : "INVALID_RELATION",
          message: request.path.startsWith("/api/v1/assets")
            ? "The selected parent asset does not exist."
            : "One of the referenced workflow records does not exist.",
        },
      });
      return;
    }

    if (error instanceof InvalidAssetParentError) {
      response.status(400).json({
        error: {
          code: "INVALID_PARENT",
          message: "The selected parent asset does not exist or is archived.",
        },
      });
      return;
    }

    if (error instanceof CircularAssetHierarchyError) {
      response.status(400).json({
        error: {
          code: "CIRCULAR_ASSET_HIERARCHY",
          message: "An asset cannot be its own ancestor.",
        },
      });
      return;
    }

    if (error instanceof WorkflowRuleError) {
      const conflictCodes = new Set([
        "INVALID_INSPECTION_TRANSITION",
        "INSPECTION_NOT_IN_PROGRESS",
        "CHECKLIST_INCOMPLETE",
        "INVALID_ANOMALY_TRANSITION",
        "RESOLUTION_NOTES_REQUIRED",
        "CORRECTIVE_ACTION_NOT_VERIFIED",
        "ANOMALY_CLOSED",
        "INVALID_WORK_ORDER_TRANSITION",
        "COMPLETION_NOTES_REQUIRED",
        "VERIFICATION_REQUIRED",
      ]);
      const status = conflictCodes.has(error.code)
        ? 409
        : error.code === "ASSET_NOT_FOUND"
          ? 404
          : 400;
      response.status(status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    request.log.error({ err: error }, "Unhandled API error");
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
      requestId: request.id,
    });
  };
  app.use(errorHandler);

  return app;
}
