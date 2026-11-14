import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { downloadReport, listAssets, type ReportKind } from "../lib/api.ts";

const reports: {
  id: ReportKind;
  title: string;
  description: string;
}[] = [
  {
    id: "assets",
    title: "Asset inventory",
    description: "Active asset identity, hierarchy, condition, and criticality fields.",
  },
  {
    id: "health",
    title: "Asset health",
    description: "Asset condition and operational status as a CSV snapshot.",
  },
  {
    id: "inspections",
    title: "Inspection progress",
    description: "Schedule, assignment, checklist completion, and lifecycle state.",
  },
  {
    id: "anomalies",
    title: "Anomaly register",
    description: "Findings, severity, ownership, and resolution lifecycle.",
  },
  {
    id: "risk",
    title: "Risk assessments",
    description:
      "Versioned illustrative risk inputs, scores, categories, and explanations.",
  },
  {
    id: "work-orders",
    title: "Work orders",
    description: "Corrective work, priority, due date, completion, and verification.",
  },
];

export function ReportsPage() {
  const [assetId, setAssetId] = useState("");
  const assets = useQuery({
    queryKey: ["reports", "assets"],
    queryFn: () => listAssets({ page: 1, pageSize: 100 }),
  });
  const mutation = useMutation({
    mutationFn: (report: ReportKind) => downloadReport(report, assetId || undefined),
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">OPERATIONAL VISIBILITY / CSV</p>
          <h1>Reports</h1>
          <p className="page-description">
            Download current synthetic registry and workflow records for review.
          </p>
        </div>
        <label className="report-asset-filter">
          Filter workflow reports by asset
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            <option value="">All assets</option>
            {assets.data?.data.map((asset) => (
              <option value={asset.id} key={asset.id}>
                {asset.assetCode} · {asset.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {assets.isError && (
        <div className="form-error" role="alert">
          Asset filters could not be loaded: {assets.error.message}
        </div>
      )}
      {mutation.error && (
        <div className="form-error" role="alert">
          Report export failed: {mutation.error.message}
        </div>
      )}
      <section className="report-grid" aria-label="Available CSV reports">
        {reports.map((report) => (
          <article className="panel report-card" key={report.id}>
            <p className="eyebrow">CSV EXPORT</p>
            <h2>{report.title}</h2>
            <p>{report.description}</p>
            <button
              className="button-secondary"
              disabled={
                mutation.isPending ||
                (report.id !== "assets" && report.id !== "health" && assets.isError)
              }
              onClick={() => mutation.mutate(report.id)}
            >
              {mutation.isPending && mutation.variables === report.id
                ? "Preparing…"
                : "Download CSV"}
            </button>
          </article>
        ))}
      </section>
      <p className="data-notice">
        These exports contain synthetic demonstration records. Risk scores are
        illustrative, versioned calculations, not certified engineering assessments.
      </p>
    </>
  );
}
