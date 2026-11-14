import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  anomalySeverities,
  anomalyTypes,
  checklistOutcomes,
  inspectionTypes,
  workOrderPriorities,
  type AnomalyRecord,
  type AssetRecord,
  type InspectionRecord,
  type UserSummary,
  type WorkOrderRecord,
} from "@arctic/contracts";
import {
  ApiError,
  assessRisk,
  createAnomaly,
  createInspection,
  createWorkOrder,
  getWorkflowSummary,
  listAnomalies,
  listAuditEvents,
  listInspections,
  listRiskAssessments,
  listUsers,
  listWorkOrders,
  updateAnomaly,
  updateChecklistItem,
  updateInspection,
  updateWorkOrder,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth-context.tsx";
import { listAssets } from "../lib/api.ts";

type WorkflowTab = "inspections" | "anomalies" | "work-orders";

function useWorkflowData() {
  const assets = useQuery({
    queryKey: ["workflow", "assets"],
    queryFn: () => listAssets({ page: 1, pageSize: 100 }),
  });
  const users = useQuery({
    queryKey: ["workflow", "users"],
    queryFn: listUsers,
  });
  const inspections = useQuery({
    queryKey: ["workflow", "inspections"],
    queryFn: () => listInspections(),
  });
  const anomalies = useQuery({
    queryKey: ["workflow", "anomalies"],
    queryFn: () => listAnomalies(),
  });
  const workOrders = useQuery({
    queryKey: ["workflow", "work-orders"],
    queryFn: () => listWorkOrders(),
  });
  return { assets, users, inspections, anomalies, workOrders };
}

function useInvalidateWorkflow() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workflow"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "workflow"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "assets"] }),
    ]);
  };
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").toLowerCase();
}

function localDateTimeToIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="form-error" role="alert">
      {error instanceof ApiError
        ? error.message
        : "The operation could not be completed."}
    </div>
  );
}

function AssetSelect({
  assets,
  value,
  onChange,
  label = "Asset",
}: {
  assets: AssetRecord[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Select asset</option>
        {assets.map((asset) => (
          <option value={asset.id} key={asset.id}>
            {asset.assetCode} · {asset.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserSelect({
  users,
  value,
  onChange,
  roles,
}: {
  users: UserSummary[];
  value: string;
  onChange: (value: string) => void;
  roles: UserSummary["role"][];
}) {
  return (
    <label>
      Assigned to
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Unassigned</option>
        {users
          .filter((user) => roles.includes(user.role))
          .map((user) => (
            <option value={user.id} key={user.id}>
              {user.displayName} · {user.role.toLowerCase()}
            </option>
          ))}
      </select>
    </label>
  );
}

function ChecklistItemEditor({
  inspection,
  item,
}: {
  inspection: InspectionRecord;
  item: InspectionRecord["checklist"][number];
}) {
  const invalidate = useInvalidateWorkflow();
  const [outcome, setOutcome] = useState(item.outcome);
  const [observation, setObservation] = useState(item.observation ?? "");
  const [measurement, setMeasurement] = useState(
    item.measurement === null ? "" : String(item.measurement),
  );
  const [unit, setUnit] = useState(item.unit ?? "");
  const [evidenceReference, setEvidenceReference] = useState(
    item.evidenceReference ?? "",
  );
  const mutation = useMutation({
    mutationFn: () =>
      updateChecklistItem(inspection.id, item.id, {
        outcome,
        observation,
        measurement: measurement ? Number(measurement) : null,
        unit,
        evidenceReference,
      }),
    onSuccess: invalidate,
  });

  return (
    <form
      className="checklist-item-form"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <strong>
        {item.position + 1}. {item.prompt}
      </strong>
      <div className="form-grid">
        <label>
          Result
          <select
            value={outcome}
            onChange={(event) =>
              setOutcome(
                checklistOutcomes.find((value) => value === event.target.value) ?? "OPEN",
              )
            }
          >
            <option value="OPEN">Open</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="NOT_APPLICABLE">Not applicable</option>
          </select>
        </label>
        <label>
          Measurement
          <input
            type="number"
            step="any"
            value={measurement}
            onChange={(event) => setMeasurement(event.target.value)}
          />
        </label>
        <label>
          Unit
          <input value={unit} onChange={(event) => setUnit(event.target.value)} />
        </label>
        <label>
          Evidence reference
          <input
            value={evidenceReference}
            onChange={(event) => setEvidenceReference(event.target.value)}
            placeholder="Synthetic evidence ID"
          />
        </label>
      </div>
      <label>
        Observation
        <textarea
          rows={2}
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
        />
      </label>
      <button type="submit" className="button-secondary" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save checklist item"}
      </button>
      <FormError error={mutation.error} />
    </form>
  );
}

function InspectionCard({ inspection }: { inspection: InspectionRecord }) {
  const invalidate = useInvalidateWorkflow();
  const [schedule, setSchedule] = useState("");
  const mutation = useMutation({
    mutationFn: (status: InspectionRecord["status"]) =>
      updateInspection(inspection.id, {
        status,
        ...(status === "PLANNED" ? { plannedAt: localDateTimeToIso(schedule) } : {}),
        notes: inspection.notes ?? undefined,
      }),
    onSuccess: invalidate,
  });
  const openItems = inspection.checklist.filter((item) => item.outcome === "OPEN").length;

  return (
    <article className="workflow-card">
      <div className="workflow-card-heading">
        <div>
          <span className="record-code">{inspection.inspectionCode}</span>
          <h3>{inspection.type.replaceAll("_", " ")} inspection</h3>
          <p>
            <Link to={`/assets/${inspection.assetId}`}>View asset</Link> ·{" "}
            {inspection.assignedToId ?? "Unassigned"}
          </p>
        </div>
        <span className={`status-pill status-${inspection.status.toLowerCase()}`}>
          {formatStatus(inspection.status)}
        </span>
      </div>
      <div className="workflow-card-meta">
        <span>
          Planned{" "}
          {inspection.plannedAt
            ? new Date(inspection.plannedAt).toLocaleString()
            : "not scheduled"}
        </span>
        <span>{openItems} checklist items open</span>
      </div>
      {inspection.status === "DRAFT" && (
        <div className="workflow-inline-action">
          <input
            aria-label={`Schedule ${inspection.inspectionCode}`}
            type="datetime-local"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
          />
          <button
            className="button-secondary"
            disabled={!schedule || mutation.isPending}
            onClick={() => mutation.mutate("PLANNED")}
          >
            Schedule
          </button>
        </div>
      )}
      {inspection.status === "PLANNED" && (
        <button
          className="button-secondary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("IN_PROGRESS")}
        >
          Start inspection
        </button>
      )}
      {inspection.status === "IN_PROGRESS" && (
        <>
          <div className="checklist-list">
            {inspection.checklist.map((item) => (
              <ChecklistItemEditor
                key={`${inspection.id}-${item.id}-${item.updatedAt}`}
                inspection={inspection}
                item={item}
              />
            ))}
          </div>
          <button
            className="button-primary"
            disabled={openItems > 0 || mutation.isPending}
            onClick={() => mutation.mutate("COMPLETED")}
          >
            Complete inspection
          </button>
        </>
      )}
      {(inspection.status === "DRAFT" || inspection.status === "PLANNED") && (
        <button
          className="workflow-text-button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("CANCELLED")}
        >
          Cancel inspection
        </button>
      )}
      <FormError error={mutation.error} />
    </article>
  );
}

function InspectionsSection({
  assets,
  users,
  inspections,
}: {
  assets: AssetRecord[];
  users: UserSummary[];
  inspections: InspectionRecord[];
}) {
  const invalidate = useInvalidateWorkflow();
  const [assetId, setAssetId] = useState("");
  const [type, setType] = useState<(typeof inspectionTypes)[number]>("GENERAL");
  const [plannedAt, setPlannedAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [prompts, setPrompts] = useState(
    "Visual condition and coating\nCorrosion or damage observations\nCathodic protection reading",
  );
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: createInspection,
    onSuccess: invalidate,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({
      assetId,
      type,
      plannedAt: localDateTimeToIso(plannedAt),
      assignedToId: assignedToId || undefined,
      notes,
      checklistPrompts: prompts
        .split(/\r?\n/)
        .map((prompt) => prompt.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="workflow-layout">
      <section className="panel workflow-form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PLAN & ASSIGN</p>
            <h2>New inspection</h2>
          </div>
        </div>
        <form className="asset-form" onSubmit={submit}>
          <AssetSelect assets={assets} value={assetId} onChange={setAssetId} />
          <label>
            Inspection type
            <select
              value={type}
              onChange={(event) =>
                setType(
                  inspectionTypes.find((value) => value === event.target.value) ??
                    "GENERAL",
                )
              }
            >
              {inspectionTypes.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Planned date
            <input
              type="datetime-local"
              value={plannedAt}
              onChange={(event) => setPlannedAt(event.target.value)}
              required
            />
          </label>
          <UserSelect
            users={users}
            value={assignedToId}
            onChange={setAssignedToId}
            roles={["ADMIN", "ENGINEER", "INSPECTOR"]}
          />
          <label>
            Checklist prompts (one per line)
            <textarea
              rows={5}
              value={prompts}
              onChange={(event) => setPrompts(event.target.value)}
              required
            />
          </label>
          <label>
            Notes
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <FormError error={mutation.error} />
          <button className="button-primary" disabled={mutation.isPending || !assetId}>
            {mutation.isPending ? "Scheduling…" : "Create and schedule"}
          </button>
        </form>
      </section>
      <section className="workflow-records" aria-label="Inspection register">
        {inspections.length === 0 ? (
          <div className="panel state-message">
            <strong>No inspections recorded</strong>
            <span>
              Create a planned inspection to start a synthetic checklist workflow.
            </span>
          </div>
        ) : (
          inspections.map((inspection) => (
            <InspectionCard key={inspection.id} inspection={inspection} />
          ))
        )}
      </section>
    </div>
  );
}

function RiskAssessmentPanel({ anomaly }: { anomaly: AnomalyRecord }) {
  const invalidate = useInvalidateWorkflow();
  const assessments = useQuery({
    queryKey: ["workflow", "risk", anomaly.id],
    queryFn: () => listRiskAssessments(anomaly.id),
  });
  const [likelihood, setLikelihood] = useState(3);
  const [consequence, setConsequence] = useState(3);
  const [exposure, setExposure] = useState(3);
  const [factorNote, setFactorNote] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      assessRisk(anomaly.id, {
        likelihood,
        consequence,
        exposure,
        factors: { note: factorNote || "No additional synthetic factors supplied." },
      }),
    onSuccess: async () => {
      await Promise.all([invalidate(), assessments.refetch()]);
    },
  });

  return (
    <div className="risk-assessment-panel">
      <p className="eyebrow">ILLUSTRATIVE RISK · ARCTIC-ILLUSTRATIVE-1</p>
      <div className="form-grid">
        <RiskFactorSelect
          label="Likelihood"
          value={likelihood}
          onChange={setLikelihood}
        />
        <RiskFactorSelect
          label="Consequence"
          value={consequence}
          onChange={setConsequence}
        />
        <RiskFactorSelect label="Exposure" value={exposure} onChange={setExposure} />
      </div>
      <label>
        Factors / context
        <input
          value={factorNote}
          onChange={(event) => setFactorNote(event.target.value)}
        />
      </label>
      <button
        className="button-secondary"
        disabled={mutation.isPending || anomaly.status === "CLOSED"}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Assessing…" : "Record assessment"}
      </button>
      <FormError error={mutation.error} />
      {assessments.data?.map((record) => (
        <div className="risk-result" key={record.id}>
          <strong>
            {record.category} · {record.score}/125
          </strong>
          <span>{record.explanation}</span>
        </div>
      ))}
    </div>
  );
}

function RiskFactorSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label} (1–5)
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {[1, 2, 3, 4, 5].map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </label>
  );
}

function AnomalyCard({
  anomaly,
  workOrders,
  canVerify,
  canAssessRisk,
}: {
  anomaly: AnomalyRecord;
  workOrders: WorkOrderRecord[];
  canVerify: boolean;
  canAssessRisk: boolean;
}) {
  const invalidate = useInvalidateWorkflow();
  const [showRisk, setShowRisk] = useState(false);
  const workOrder = workOrders.find((record) => record.anomalyId === anomaly.id);
  const mutation = useMutation({
    mutationFn: (input: {
      status: AnomalyRecord["status"];
      resolutionNotes?: string;
      verificationNotes?: string;
    }) => updateAnomaly(anomaly.id, input),
    onSuccess: invalidate,
  });

  function moveTo(status: AnomalyRecord["status"]) {
    if (status === "RESOLVED") {
      const resolutionNotes = window.prompt("Record resolution notes:");
      if (resolutionNotes === null) return;
      mutation.mutate({ status, resolutionNotes });
    } else if (status === "CLOSED") {
      const verificationNotes = window.prompt("Record engineer verification notes:");
      if (verificationNotes === null) return;
      mutation.mutate({ status, verificationNotes });
    } else {
      mutation.mutate({ status });
    }
  }

  return (
    <article className="workflow-card">
      <div className="workflow-card-heading">
        <div>
          <span className="record-code">{anomaly.reference}</span>
          <h3>{anomaly.title}</h3>
          <p>
            <Link to={`/assets/${anomaly.assetId}`}>View asset</Link> ·{" "}
            {anomaly.type.replaceAll("_", " ")}
          </p>
        </div>
        <span className={`status-pill status-${anomaly.severity.toLowerCase()}`}>
          {anomaly.severity.toLowerCase()}
        </span>
      </div>
      <p className="workflow-description">{anomaly.description}</p>
      <div className="workflow-card-meta">
        <span>Status: {formatStatus(anomaly.status)}</span>
        <span>
          {workOrder
            ? `Work order ${workOrder.number} · ${formatStatus(workOrder.status)}`
            : "No work order"}
        </span>
      </div>
      <div className="workflow-inline-action">
        {anomaly.status === "OPEN" && (
          <button className="button-secondary" onClick={() => moveTo("IN_PROGRESS")}>
            Start investigation
          </button>
        )}
        {anomaly.status === "IN_PROGRESS" && (
          <button className="button-secondary" onClick={() => moveTo("RESOLVED")}>
            Record resolution
          </button>
        )}
        {anomaly.status === "RESOLVED" && canVerify && (
          <button
            className="button-secondary"
            disabled={workOrder?.status !== "VERIFIED"}
            title={
              workOrder?.status !== "VERIFIED"
                ? "The linked work order must be engineer-verified first."
                : undefined
            }
            onClick={() => moveTo("CLOSED")}
          >
            Close anomaly
          </button>
        )}
        {canAssessRisk && (
          <button
            className="workflow-text-button"
            onClick={() => setShowRisk((visible) => !visible)}
          >
            {showRisk ? "Hide risk" : "Risk assessment"}
          </button>
        )}
      </div>
      <FormError error={mutation.error} />
      {showRisk && <RiskAssessmentPanel anomaly={anomaly} />}
    </article>
  );
}

function AnomaliesSection({
  assets,
  users,
  inspections,
  anomalies,
  workOrders,
  canVerify,
  canAssessRisk,
}: {
  assets: AssetRecord[];
  users: UserSummary[];
  inspections: InspectionRecord[];
  anomalies: AnomalyRecord[];
  workOrders: WorkOrderRecord[];
  canVerify: boolean;
  canAssessRisk: boolean;
}) {
  const invalidate = useInvalidateWorkflow();
  const [assetId, setAssetId] = useState("");
  const [inspectionId, setInspectionId] = useState("");
  const [type, setType] = useState<(typeof anomalyTypes)[number]>("CORROSION");
  const [severity, setSeverity] = useState<(typeof anomalySeverities)[number]>("MEDIUM");
  const [assignedToId, setAssignedToId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [detectionDetails, setDetectionDetails] = useState("");
  const mutation = useMutation({
    mutationFn: createAnomaly,
    onSuccess: invalidate,
  });
  const assetInspections = inspections.filter(
    (inspection) => inspection.assetId === assetId,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({
      assetId,
      ...(inspectionId ? { inspectionId } : {}),
      type,
      severity,
      title,
      description,
      detectionDetails,
      assignedToId: assignedToId || undefined,
    });
  }

  return (
    <div className="workflow-layout">
      <section className="panel workflow-form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">REGISTER FINDING</p>
            <h2>New anomaly</h2>
          </div>
        </div>
        <form className="asset-form" onSubmit={submit}>
          <AssetSelect assets={assets} value={assetId} onChange={setAssetId} />
          <label>
            Related inspection
            <select
              value={inspectionId}
              onChange={(event) => setInspectionId(event.target.value)}
            >
              <option value="">Not linked</option>
              {assetInspections.map((inspection) => (
                <option value={inspection.id} key={inspection.id}>
                  {inspection.inspectionCode} · {formatStatus(inspection.status)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Type
              <select
                value={type}
                onChange={(event) =>
                  setType(
                    anomalyTypes.find((value) => value === event.target.value) ?? "OTHER",
                  )
                }
              >
                {anomalyTypes.map((option) => (
                  <option value={option} key={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Severity
              <select
                value={severity}
                onChange={(event) =>
                  setSeverity(
                    anomalySeverities.find((value) => value === event.target.value) ??
                      "MEDIUM",
                  )
                }
              >
                {anomalySeverities.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </label>
          <label>
            Detection details / synthetic evidence
            <textarea
              rows={2}
              value={detectionDetails}
              onChange={(event) => setDetectionDetails(event.target.value)}
            />
          </label>
          <UserSelect
            users={users}
            value={assignedToId}
            onChange={setAssignedToId}
            roles={["ADMIN", "ENGINEER", "INSPECTOR"]}
          />
          <FormError error={mutation.error} />
          <button className="button-primary" disabled={mutation.isPending || !assetId}>
            {mutation.isPending ? "Saving…" : "Create anomaly"}
          </button>
        </form>
      </section>
      <section className="workflow-records" aria-label="Anomaly register">
        {anomalies.length === 0 ? (
          <div className="panel state-message">
            <strong>No anomalies recorded</strong>
            <span>Findings created from inspections can be tracked here.</span>
          </div>
        ) : (
          anomalies.map((anomaly) => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              workOrders={workOrders}
              canVerify={canVerify}
              canAssessRisk={canAssessRisk}
            />
          ))
        )}
      </section>
    </div>
  );
}

function WorkOrderCard({
  workOrder,
  canVerify,
}: {
  workOrder: WorkOrderRecord;
  canVerify: boolean;
}) {
  const invalidate = useInvalidateWorkflow();
  const mutation = useMutation({
    mutationFn: (input: {
      status: WorkOrderRecord["status"];
      completionNotes?: string;
      verificationNotes?: string;
    }) => updateWorkOrder(workOrder.id, input),
    onSuccess: invalidate,
  });

  function moveTo(status: WorkOrderRecord["status"]) {
    if (status === "COMPLETED") {
      const completionNotes = window.prompt("Record completion notes:");
      if (completionNotes === null) return;
      mutation.mutate({ status, completionNotes });
    } else if (status === "VERIFIED") {
      const verificationNotes = window.prompt("Record engineer verification notes:");
      if (verificationNotes === null) return;
      mutation.mutate({ status, verificationNotes });
    } else {
      mutation.mutate({ status });
    }
  }

  return (
    <article className="workflow-card">
      <div className="workflow-card-heading">
        <div>
          <span className="record-code">{workOrder.number}</span>
          <h3>{workOrder.title}</h3>
          <p>
            <Link to={`/assets/${workOrder.assetId}`}>View asset</Link> ·{" "}
            {workOrder.priority.toLowerCase()} priority
          </p>
        </div>
        <span className={`status-pill status-${workOrder.status.toLowerCase()}`}>
          {formatStatus(workOrder.status)}
        </span>
      </div>
      <p className="workflow-description">
        {workOrder.description ?? "No work detail supplied."}
      </p>
      <div className="workflow-card-meta">
        <span>
          Planned{" "}
          {workOrder.plannedAt
            ? new Date(workOrder.plannedAt).toLocaleDateString()
            : "not set"}
        </span>
        <span>
          Due{" "}
          {workOrder.dueAt ? new Date(workOrder.dueAt).toLocaleDateString() : "not set"}
        </span>
        <span>
          {workOrder.assignedToId ? `Assigned ${workOrder.assignedToId}` : "Unassigned"}
        </span>
      </div>
      <div className="workflow-inline-action">
        {workOrder.status === "OPEN" && (
          <button className="button-secondary" onClick={() => moveTo("IN_PROGRESS")}>
            Start work
          </button>
        )}
        {workOrder.status === "IN_PROGRESS" && (
          <button className="button-secondary" onClick={() => moveTo("COMPLETED")}>
            Record completion
          </button>
        )}
        {workOrder.status === "COMPLETED" && canVerify && (
          <button className="button-secondary" onClick={() => moveTo("VERIFIED")}>
            Engineer verify
          </button>
        )}
        {workOrder.status === "OPEN" && (
          <button className="workflow-text-button" onClick={() => moveTo("CANCELLED")}>
            Cancel
          </button>
        )}
      </div>
      <FormError error={mutation.error} />
    </article>
  );
}

function WorkOrdersSection({
  assets,
  users,
  anomalies,
  workOrders,
  canVerify,
}: {
  assets: AssetRecord[];
  users: UserSummary[];
  anomalies: AnomalyRecord[];
  workOrders: WorkOrderRecord[];
  canVerify: boolean;
}) {
  const invalidate = useInvalidateWorkflow();
  const [assetId, setAssetId] = useState("");
  const [anomalyId, setAnomalyId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [priority, setPriority] =
    useState<(typeof workOrderPriorities)[number]>("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plannedAt, setPlannedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const mutation = useMutation({
    mutationFn: createWorkOrder,
    onSuccess: invalidate,
  });
  const assetAnomalies = anomalies.filter(
    (anomaly) => anomaly.assetId === assetId && anomaly.status !== "CLOSED",
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({
      assetId,
      ...(anomalyId ? { anomalyId } : {}),
      assignedToId: assignedToId || undefined,
      priority,
      title,
      description,
      plannedAt: localDateTimeToIso(plannedAt),
      dueAt: localDateTimeToIso(dueAt),
    });
  }

  return (
    <div className="workflow-layout">
      <section className="panel workflow-form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CORRECTIVE ACTION</p>
            <h2>New work order</h2>
          </div>
        </div>
        <form className="asset-form" onSubmit={submit}>
          <AssetSelect assets={assets} value={assetId} onChange={setAssetId} />
          <label>
            Related anomaly
            <select
              value={anomalyId}
              onChange={(event) => setAnomalyId(event.target.value)}
            >
              <option value="">Not linked</option>
              {assetAnomalies.map((anomaly) => (
                <option value={anomaly.id} key={anomaly.id}>
                  {anomaly.reference} · {anomaly.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label>
            Description / scope
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Priority
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(
                    workOrderPriorities.find((value) => value === event.target.value) ??
                      "MEDIUM",
                  )
                }
              >
                {workOrderPriorities.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Planned date
              <input
                type="datetime-local"
                value={plannedAt}
                onChange={(event) => setPlannedAt(event.target.value)}
              />
            </label>
            <label>
              Due date
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </label>
          </div>
          <UserSelect
            users={users}
            value={assignedToId}
            onChange={setAssignedToId}
            roles={["ADMIN", "ENGINEER", "INSPECTOR"]}
          />
          <FormError error={mutation.error} />
          <button className="button-primary" disabled={mutation.isPending || !assetId}>
            {mutation.isPending ? "Creating…" : "Create work order"}
          </button>
        </form>
      </section>
      <section className="workflow-records" aria-label="Work-order register">
        {workOrders.length === 0 ? (
          <div className="panel state-message">
            <strong>No work orders recorded</strong>
            <span>Assign and track corrective work for assets and anomalies.</span>
          </div>
        ) : (
          workOrders.map((workOrder) => (
            <WorkOrderCard
              key={workOrder.id}
              workOrder={workOrder}
              canVerify={canVerify}
            />
          ))
        )}
      </section>
    </div>
  );
}

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState<WorkflowTab>("inspections");
  const { session } = useAuth();
  const data = useWorkflowData();
  const summary = useQuery({
    queryKey: ["dashboard", "workflow"],
    queryFn: getWorkflowSummary,
  });
  const activity = useQuery({
    queryKey: ["workflow", "activity"],
    queryFn: () => listAuditEvents(),
  });
  const loading =
    data.assets.isPending ||
    data.users.isPending ||
    data.inspections.isPending ||
    data.anomalies.isPending ||
    data.workOrders.isPending;
  const error =
    data.assets.error ??
    data.users.error ??
    data.inspections.error ??
    data.anomalies.error ??
    data.workOrders.error;
  const canCreate =
    session?.user.role === "ADMIN" ||
    session?.user.role === "ENGINEER" ||
    session?.user.role === "INSPECTOR";
  const canManageWork =
    session?.user.role === "ADMIN" || session?.user.role === "ENGINEER";

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FIELD WORKFLOWS / SYNTHETIC DATA</p>
          <h1>Operations workbench</h1>
          <p className="page-description">
            Plan inspections, record anomalies, assess illustrative risk, and track
            corrective work.
          </p>
        </div>
      </div>
      <section className="workflow-kpis" aria-label="Workflow summary">
        <div>
          <span>Planned inspections</span>
          <strong>{summary.data?.inspections.PLANNED ?? "—"}</strong>
        </div>
        <div>
          <span>In progress</span>
          <strong>{summary.data?.inspections.IN_PROGRESS ?? "—"}</strong>
        </div>
        <div>
          <span>Open anomalies</span>
          <strong>{summary.data?.anomalies.OPEN ?? "—"}</strong>
        </div>
        <div>
          <span>Critical anomalies</span>
          <strong>{summary.data?.anomalies.CRITICAL ?? "—"}</strong>
        </div>
        <div>
          <span>Open work orders</span>
          <strong>{summary.data?.workOrders.OPEN ?? "—"}</strong>
        </div>
        <div>
          <span>Overdue items</span>
          <strong>
            {(summary.data?.inspections.OVERDUE ?? 0) +
              (summary.data?.workOrders.OVERDUE ?? 0)}
          </strong>
        </div>
      </section>
      {summary.data && (
        <section
          className="panel risk-distribution"
          aria-label="Latest open anomaly risk distribution"
        >
          <div className="insight-heading">
            <div>
              <p className="eyebrow">LATEST ASSESSMENT PER OPEN ANOMALY</p>
              <h2>Illustrative risk distribution</h2>
            </div>
            <span className="insight-count">Not an engineering rating</span>
          </div>
          <div className="risk-distribution-list">
            {(["LOW", "MODERATE", "HIGH", "CRITICAL"] as const).map((category) => (
              <div
                className={`risk-distribution-row risk-${category.toLowerCase()}`}
                key={category}
              >
                <span>{category}</span>
                <strong>{summary.data.risk[category]}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      <nav className="workflow-tabs" aria-label="Operations modules">
        {(["inspections", "anomalies", "work-orders"] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? "workflow-tab-active" : ""}
            aria-current={activeTab === tab ? "page" : undefined}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "work-orders"
              ? "Work orders"
              : `${tab.charAt(0).toUpperCase()}${tab.slice(1)}`}
          </button>
        ))}
      </nav>
      {loading ? (
        <div className="panel state-message" role="status">
          Loading workflow records…
        </div>
      ) : error ? (
        <div className="panel state-message state-error" role="alert">
          <strong>Workflow records could not be loaded.</strong>
          <span>{error.message}</span>
        </div>
      ) : data.assets.data && data.users.data ? (
        <>
          {activeTab === "inspections" && canCreate && (
            <InspectionsSection
              assets={data.assets.data.data}
              users={data.users.data}
              inspections={data.inspections.data ?? []}
            />
          )}
          {activeTab === "anomalies" && canCreate && (
            <AnomaliesSection
              assets={data.assets.data.data}
              users={data.users.data}
              inspections={data.inspections.data ?? []}
              anomalies={data.anomalies.data ?? []}
              workOrders={data.workOrders.data ?? []}
              canVerify={canManageWork}
              canAssessRisk={canManageWork}
            />
          )}
          {activeTab === "work-orders" && canManageWork && (
            <WorkOrdersSection
              assets={data.assets.data.data}
              users={data.users.data}
              anomalies={data.anomalies.data ?? []}
              workOrders={data.workOrders.data ?? []}
              canVerify={canManageWork}
            />
          )}
          {!canCreate && (
            <div className="panel state-message">
              <strong>Read-only role</strong>
              <span>
                Your role can review workflow records but cannot create or change them.
              </span>
            </div>
          )}
          {activeTab === "work-orders" && canCreate && !canManageWork && (
            <div className="panel state-message">
              <strong>Work-order management is restricted</strong>
              <span>Only Admins and Engineers can create or verify work orders.</span>
            </div>
          )}
          <section
            className="panel operations-activity"
            aria-labelledby="activity-heading"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">TRACEABILITY</p>
                <h2 id="activity-heading">Recent activity</h2>
              </div>
              <span className="insight-count">Latest 100 events</span>
            </div>
            {activity.isError ? (
              <div className="form-error" role="alert">
                Activity history could not be loaded: {activity.error.message}
              </div>
            ) : activity.isPending ? (
              <p className="activity-empty" role="status">
                Loading activity history…
              </p>
            ) : activity.data.length === 0 ? (
              <p className="activity-empty">Workflow changes will appear here.</p>
            ) : (
              <ol className="activity-list">
                {activity.data.slice(0, 10).map((event) => (
                  <li key={event.id}>
                    <span className="activity-marker" aria-hidden="true" />
                    <div>
                      <strong>{event.summary}</strong>
                      <span>
                        {event.entityType.replaceAll("_", " ")} · {event.actorId} ·{" "}
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {event.toStatus && (
                      <span
                        className={`status-pill status-${event.toStatus.toLowerCase()}`}
                      >
                        {formatStatus(event.toStatus)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
