import { lazy, Suspense, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { DashboardInsights } from "../components/DashboardInsights.tsx";
const OffshoreScene = lazy(async () => {
  const module = await import("../components/OffshoreScene.tsx");
  return { default: module.OffshoreScene };
});
import { getAssetHealthSummary, getWorkflowSummary, listAssets } from "../lib/api.ts";

interface TrendLine {
  label: string;
  color: string;
  values: number[];
}

interface TrendChartProps {
  title: string;
  metric: string;
  range: string;
  axisLabels: [string, string, string, string, string];
  series: TrendLine[];
  target?: string;
  featured?: boolean;
}

function TrendChart({
  title,
  metric,
  range,
  axisLabels,
  series,
  target,
  featured = false,
}: TrendChartProps) {
  const chartWidth = 540;
  const chartHeight = 154;
  const plot = { left: 42, right: 530, top: 12, bottom: 116 };
  const chartPath = (values: number[]) =>
    values
      .map((value, index) => {
        const x =
          plot.left + (index / Math.max(values.length - 1, 1)) * (plot.right - plot.left);
        const y = plot.bottom - (value / 100) * (plot.bottom - plot.top);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <article
      className={`panel trend-panel${featured ? " trend-panel-featured" : ""}`}
      aria-label={`${title} illustrative trend chart`}
    >
      <div className="trend-heading">
        <div>
          <div className="trend-title-row">
            <h2>{title}</h2>
            <span className="trend-info" title="Illustrative synthetic demo data">
              i
            </span>
          </div>
          <p>Illustrative telemetry · {range}</p>
        </div>
        <span className="trend-period">{range}</span>
      </div>
      <strong className="trend-metric">{metric}</strong>
      <div className="trend-plot">
        <div className="trend-axis-labels" aria-hidden="true">
          {axisLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <svg
          className="trend-svg"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label={`${title}: ${series.map((line) => line.label).join(", ")} over ${range}, using illustrative synthetic data`}
          preserveAspectRatio="none"
        >
          {[12, 38, 64, 90, 116].map((y) => (
            <line
              key={y}
              x1={plot.left}
              x2={plot.right}
              y1={y}
              y2={y}
              className="trend-gridline"
            />
          ))}
          {target && (
            <>
              <line
                x1={plot.left}
                x2={plot.right}
                y1={76}
                y2={76}
                className="trend-target-line"
              />
              <text x={plot.left + 8} y={71} className="trend-target-label">
                {target}
              </text>
            </>
          )}
          {series.map((line) => {
            const lastValue = line.values[line.values.length - 1] ?? 0;
            const lastY = plot.bottom - (lastValue / 100) * (plot.bottom - plot.top);
            return (
              <g key={line.label}>
                <path
                  d={chartPath(line.values)}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={featured ? 2.8 : 2.3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={plot.right}
                  cy={lastY}
                  r="3.2"
                  fill={line.color}
                  className="trend-last-point"
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="trend-time-labels" aria-hidden="true">
        <span>{range === "24 hours" ? "00:00" : "Day 1"}</span>
        <span>{range === "24 hours" ? "06:00" : "Day 8"}</span>
        <span>{range === "24 hours" ? "12:00" : "Day 15"}</span>
        <span>{range === "24 hours" ? "18:00" : "Day 22"}</span>
        <span>{range === "24 hours" ? "24:00" : "Day 30"}</span>
      </div>
      <div className="trend-legend">
        {series.map((line) => (
          <span key={line.label}>
            <i style={{ backgroundColor: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
    </article>
  );
}

const cathodicSeries: TrendLine[] = [
  {
    label: "Platform C · Avg.",
    color: "#43c8f2",
    values: [
      39, 43, 41, 52, 48, 57, 55, 45, 50, 59, 52, 46, 40, 49, 56, 52, 44, 38, 43, 35, 40,
      42,
    ],
  },
];

const corrosionSeries: TrendLine[] = [
  {
    label: "Platform C · Avg.",
    color: "#43c8f2",
    values: [
      31, 39, 35, 42, 34, 39, 47, 42, 35, 52, 45, 38, 42, 36, 34, 47, 40, 35, 30, 34, 32,
    ],
  },
];

const rectifierSeries: TrendLine[] = [
  {
    label: "Voltage (V)",
    color: "#43c8f2",
    values: [
      70, 73, 71, 76, 80, 77, 82, 79, 84, 87, 83, 80, 86, 89, 84, 88, 85, 90, 87, 84, 87,
    ],
  },
  {
    label: "Current (A)",
    color: "#f2a64a",
    values: [
      38, 36, 42, 40, 35, 39, 45, 40, 37, 43, 46, 42, 38, 44, 48, 43, 39, 46, 42, 45, 47,
    ],
  },
];

const coatingSeries: TrendLine[] = [
  {
    label: "Platform C · Avg.",
    color: "#43c8f2",
    values: [
      82, 84, 81, 86, 88, 85, 89, 91, 87, 90, 88, 92, 89, 91, 94, 90, 93, 91, 95, 92, 91,
    ],
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const handleSelectAsset = useCallback(
    (assetId: string) => {
      void navigate(`/assets/${assetId}`);
    },
    [navigate],
  );
  const summary = useQuery({
    queryKey: ["dashboard", "asset-health"],
    queryFn: getAssetHealthSummary,
  });
  const assets = useQuery({
    queryKey: ["dashboard", "assets"],
    queryFn: () => listAssets({ page: 1, pageSize: 100 }),
  });
  const workflow = useQuery({
    queryKey: ["dashboard", "workflow"],
    queryFn: getWorkflowSummary,
  });

  const loading = summary.isPending || assets.isPending;
  const error = summary.error ?? assets.error;

  return (
    <div className="dashboard-page">
      {loading && (
        <div className="panel state-message" role="status">
          <span className="loading-indicator" />
          Loading asset summary…
        </div>
      )}
      {error && (
        <div className="panel state-message state-error" role="alert">
          <strong>Dashboard information could not be loaded.</strong>
          <span>{error.message}</span>
          <button
            className="button-secondary"
            onClick={() => {
              void summary.refetch();
              void assets.refetch();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {summary.data && assets.data && (
        <section className="metric-grid" aria-label="Asset key performance indicators">
          <article className="metric-card">
            <span className="metric-icon metric-icon-blue" aria-hidden="true">
              ◫
            </span>
            <div>
              <span className="metric-label">REGISTERED ASSETS</span>
              <strong className="metric-value">{summary.data.total}</strong>
              <span className="metric-caption">Across all asset types</span>
            </div>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-red" aria-hidden="true">
              !
            </span>
            <div>
              <span className="metric-label">CRITICAL</span>
              <strong className="metric-value">{summary.data.byHealth.CRITICAL}</strong>
              <span className="metric-caption">Synthetic classification</span>
            </div>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-amber" aria-hidden="true">
              !
            </span>
            <div>
              <span className="metric-label">ATTENTION</span>
              <strong className="metric-value">{summary.data.byHealth.ATTENTION}</strong>
              <span className="metric-caption">Review classification</span>
            </div>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-green" aria-hidden="true">
              ✓
            </span>
            <div>
              <span className="metric-label">HEALTHY</span>
              <strong className="metric-value">{summary.data.byHealth.HEALTHY}</strong>
              <span className="metric-caption">Synthetic classification</span>
            </div>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-blue" aria-hidden="true">
              ?
            </span>
            <div>
              <span className="metric-label">UNKNOWN</span>
              <strong className="metric-value">{summary.data.byHealth.UNKNOWN}</strong>
              <span className="metric-caption">Condition not classified</span>
            </div>
          </article>
        </section>
      )}

      {workflow.data && (
        <section
          className="workflow-kpis dashboard-workflow-kpis"
          aria-label="Workflow key performance indicators"
        >
          <div>
            <span>Planned inspections</span>
            <strong>{workflow.data.inspections.PLANNED}</strong>
          </div>
          <div>
            <span>In-progress inspections</span>
            <strong>{workflow.data.inspections.IN_PROGRESS}</strong>
          </div>
          <div>
            <span>Open anomalies</span>
            <strong>{workflow.data.anomalies.OPEN}</strong>
          </div>
          <div>
            <span>Critical anomalies</span>
            <strong>{workflow.data.anomalies.CRITICAL}</strong>
          </div>
          <div>
            <span>Open work orders</span>
            <strong>{workflow.data.workOrders.OPEN}</strong>
          </div>
          <div>
            <span>Overdue inspections / work</span>
            <strong>
              {workflow.data.inspections.OVERDUE + workflow.data.workOrders.OVERDUE}
            </strong>
          </div>
        </section>
      )}
      {workflow.isError && (
        <div className="panel state-message state-error" role="alert">
          <strong>Workflow KPIs are unavailable.</strong>
          <span>{workflow.error.message}</span>
          <Link className="button-secondary" to="/operations">
            Open operations
          </Link>
        </div>
      )}

      <section className="dashboard-visual-grid" aria-label="Offshore asset overview">
        <section className="panel platform-panel" aria-labelledby="platform-title">
          <div className="platform-panel-heading">
            <div>
              <p className="eyebrow">ASSET OVERVIEW</p>
              <h2 id="platform-title">Offshore Platform C</h2>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="scene-loading" role="status">
                Loading interactive 3D platform…
              </div>
            }
          >
            <OffshoreScene
              assets={assets.data?.data ?? []}
              onSelectAsset={handleSelectAsset}
            />
          </Suspense>
        </section>
        <TrendChart
          title="Cathodic potential"
          metric="−782 mV"
          range="24 hours"
          axisLabels={["−200", "−450", "−700", "−950", "−1200"]}
          series={cathodicSeries}
          target="Illustrative protection threshold: −850 mV"
          featured
        />
      </section>

      <section
        className="trend-grid"
        aria-label="Illustrative condition monitoring trends"
      >
        <TrendChart
          title="Corrosion rate"
          metric="0.32 mm/year"
          range="30 days"
          axisLabels={["1.00", "0.75", "0.50", "0.25", "0.00"]}
          series={corrosionSeries}
          target="Illustrative target < 0.20 mm/year"
        />
        <TrendChart
          title="Rectifier output"
          metric="52.2 V · 5.6 A"
          range="30 days"
          axisLabels={["100", "75", "50", "25", "0"]}
          series={rectifierSeries}
        />
        <TrendChart
          title="Coating health"
          metric="91%"
          range="30 days"
          axisLabels={["100", "75", "50", "25", "0"]}
          series={coatingSeries}
          target="Illustrative target > 80%"
        />
      </section>
      {summary.data && assets.data && (
        <DashboardInsights assets={assets.data.data} healthSummary={summary.data} />
      )}
      <p className="telemetry-disclaimer">
        Asset records, scenario triggers, and chart values are illustrative synthetic
        samples. ARCTIC is not connected to field instrumentation; do not use this
        prototype or its prompts for engineering or safety decisions.
      </p>
    </div>
  );
}
