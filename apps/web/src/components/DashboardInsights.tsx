import { useState } from "react";
import { Link } from "react-router-dom";
import { assetTypes, type AssetHealthSummary, type AssetRecord } from "@arctic/contracts";

type ScenarioSeverity = "CRITICAL" | "ATTENTION" | "MONITOR" | "DATA_GAP";
type ScenarioFilter = "ALL" | ScenarioSeverity;

interface DemoScenario {
  id: string;
  category: string;
  severity: ScenarioSeverity;
  title: string;
  assetCode: string;
  trigger: string;
  context: string;
  reviewPrompt: string;
}

const demoScenarios: DemoScenario[] = [
  {
    id: "cp-potential",
    category: "Corrosion protection",
    severity: "ATTENTION",
    title: "Cathodic potential outside example range",
    assetCode: "PLAT-C",
    trigger: "Illustrative reading: −782 mV",
    context: "A sample trend approaches the demo protection threshold.",
    reviewPrompt:
      "Validate the measurement and compare it with the approved inspection basis.",
  },
  {
    id: "rectifier-output",
    category: "Electrical / CP",
    severity: "ATTENTION",
    title: "Rectifier output drift",
    assetCode: "CP-RECT-A",
    trigger: "Example output: 52.2 V · 5.6 A",
    context: "A simulated output trend varies from its example baseline.",
    reviewPrompt:
      "Check sample quality and review rectifier records with a qualified owner.",
  },
  {
    id: "pipeline-corrosion",
    category: "Pipeline integrity",
    severity: "ATTENTION",
    title: "Corrosion-rate trend increasing",
    assetCode: "PIPE-01",
    trigger: "Illustrative rate: 0.32 mm/year",
    context: "A synthetic series shows a gradual increase over the displayed period.",
    reviewPrompt:
      "Confirm the trend against validated inspection and measurement records.",
  },
  {
    id: "riser-vibration",
    category: "Structural integrity",
    severity: "CRITICAL",
    title: "Riser vibration anomaly",
    assetCode: "RISER-01",
    trigger: "Example vibration band exceeded",
    context:
      "A simulated vibration signal is outside its illustrative operating envelope.",
    reviewPrompt:
      "Review data validity and route the case through the site's approved process.",
  },
  {
    id: "manifold-pressure",
    category: "Subsea process",
    severity: "CRITICAL",
    title: "Manifold pressure mismatch",
    assetCode: "MAN-01",
    trigger: "Example inlet / outlet delta: 8.4 bar",
    context: "A demo pressure comparison indicates a difference between sample points.",
    reviewPrompt: "Verify transmitter quality and compare with approved process records.",
  },
  {
    id: "sensor-gap",
    category: "Data quality",
    severity: "DATA_GAP",
    title: "Subsea sensor communication gap",
    assetCode: "LEAK-SENS-01",
    trigger: "Example data age: 6 hours",
    context: "The sample signal is stale; this does not confirm an equipment event.",
    reviewPrompt: "Check connectivity and record the time window with no valid samples.",
  },
  {
    id: "pump-bearing",
    category: "Rotating equipment",
    severity: "ATTENTION",
    title: "Pump bearing temperature rise",
    assetCode: "PUMP-SW-01",
    trigger: "Example temperature: 86 °C",
    context: "A synthetic temperature trace rises above its example baseline.",
    reviewPrompt:
      "Check sensor quality and compare with the equipment's approved limits.",
  },
  {
    id: "gas-detection",
    category: "Instrumentation",
    severity: "ATTENTION",
    title: "Gas detector proof-test due",
    assetCode: "GAS-DET-01",
    trigger: "Example status: test window overdue",
    context: "A maintenance-calendar scenario, not a live gas alarm.",
    reviewPrompt:
      "Confirm the maintenance record and follow the approved test procedure.",
  },
  {
    id: "coating-condition",
    category: "Coating / inspection",
    severity: "MONITOR",
    title: "Jacket coating inspection due",
    assetCode: "JACKET-LEG-02",
    trigger: "Example coverage: 78%",
    context: "A synthetic inspection estimate is below its illustrative target.",
    reviewPrompt: "Review the latest inspection evidence and update the asset record.",
  },
  {
    id: "valve-travel",
    category: "Process equipment",
    severity: "ATTENTION",
    title: "Valve travel-time deviation",
    assetCode: "VALVE-ACT-07",
    trigger: "Example actuation time: 14.2 seconds",
    context: "A simulated response time differs from the example baseline.",
    reviewPrompt: "Verify position feedback and compare with approved equipment records.",
  },
  {
    id: "mooring-fatigue",
    category: "Environmental / structural",
    severity: "MONITOR",
    title: "Mooring fatigue review window",
    assetCode: "MOOR-LINE-01",
    trigger: "Example review interval: 30 days",
    context: "A planning scenario for fatigue and inspection history.",
    reviewPrompt: "Check the approved inspection plan and confirm the record is current.",
  },
  {
    id: "firewater-readiness",
    category: "Availability / maintenance",
    severity: "MONITOR",
    title: "Firewater pump readiness review",
    assetCode: "PUMP-FW-01",
    trigger: "Example proof-test window: 14 days",
    context: "A synthetic maintenance reminder, not a live system test result.",
    reviewPrompt:
      "Confirm the work history and follow the site's approved maintenance plan.",
  },
];

const severityLabels: Record<ScenarioSeverity, string> = {
  CRITICAL: "Critical",
  ATTENTION: "Attention",
  MONITOR: "Monitor",
  DATA_GAP: "Data gap",
};

const typeLabels: Record<(typeof assetTypes)[number], string> = {
  PLATFORM: "Platforms",
  PIPELINE: "Pipelines",
  RISER: "Risers",
  VALVE: "Valves",
  MANIFOLD: "Manifolds",
  CONNECTOR: "Connectors",
  PUMP: "Pumps",
  EQUIPMENT: "Other equipment",
};

const healthRows = [
  { key: "CRITICAL", label: "Critical", className: "distribution-critical" },
  { key: "ATTENTION", label: "Attention", className: "distribution-attention" },
  { key: "HEALTHY", label: "Healthy", className: "distribution-healthy" },
  { key: "UNKNOWN", label: "Unknown", className: "distribution-unknown" },
] as const;

function isScenarioFilter(value: string): value is ScenarioFilter {
  return (
    value === "ALL" ||
    value === "CRITICAL" ||
    value === "ATTENTION" ||
    value === "MONITOR" ||
    value === "DATA_GAP"
  );
}

export function DashboardInsights({
  assets,
  healthSummary,
}: {
  assets: AssetRecord[];
  healthSummary: AssetHealthSummary;
}) {
  const [filter, setFilter] = useState<ScenarioFilter>("ALL");
  const typeCounts = assetTypes.map((type) => ({
    key: type,
    label: typeLabels[type],
    count: assets.filter((asset) => asset.type === type).length,
  }));
  const visibleScenarios =
    filter === "ALL"
      ? demoScenarios
      : demoScenarios.filter((scenario) => scenario.severity === filter);
  const totalAssets = Math.max(healthSummary.total, 1);

  return (
    <>
      <section className="portfolio-grid" aria-label="Asset portfolio breakdown">
        <article className="panel portfolio-panel">
          <div className="insight-heading">
            <div>
              <p className="eyebrow">PORTFOLIO MIX</p>
              <h2>Assets by type</h2>
            </div>
            <span className="insight-count">{healthSummary.total} total</span>
          </div>
          <div className="distribution-list">
            {typeCounts.map((row) => (
              <div className="distribution-row" key={row.key}>
                <span>{row.label}</span>
                <div
                  className="distribution-track"
                  role="img"
                  aria-label={`${row.label}: ${row.count} of ${healthSummary.total} assets`}
                >
                  <span
                    className="distribution-type"
                    style={{
                      width: `${(row.count / totalAssets) * 100}%`,
                    }}
                  />
                </div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
          <p className="insight-footnote">
            Counts reflect the synthetic asset catalogue currently loaded.
          </p>
        </article>

        <article className="panel portfolio-panel">
          <div className="insight-heading">
            <div>
              <p className="eyebrow">CONDITION REGISTER</p>
              <h2>Health classification</h2>
            </div>
            <span className="insight-count">API summary</span>
          </div>
          <div className="distribution-list">
            {healthRows.map((row) => {
              const count = healthSummary.byHealth[row.key];
              return (
                <div className="distribution-row" key={row.key}>
                  <span>{row.label}</span>
                  <div
                    className="distribution-track"
                    role="img"
                    aria-label={`${row.label}: ${count} of ${healthSummary.total} assets`}
                  >
                    <span
                      className={row.className}
                      style={{
                        width: `${(count / totalAssets) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
          <p className="insight-footnote">
            A health label is a sample classification, not a live diagnosis.
          </p>
        </article>
      </section>

      <section className="panel scenario-section" aria-labelledby="scenario-heading">
        <div className="scenario-heading">
          <div>
            <p className="eyebrow">SIMULATED SCENARIO LIBRARY</p>
            <h2 id="scenario-heading">Operational scenario watchlist</h2>
            <p className="scenario-description">
              12 representative condition, integrity, process, maintenance, and data
              quality cases. Every trigger and review prompt is illustrative.
            </p>
          </div>
          <label className="scenario-filter-label">
            <span className="sr-only">Filter scenarios by priority</span>
            <select
              value={filter}
              onChange={(event) => {
                if (isScenarioFilter(event.target.value)) {
                  setFilter(event.target.value);
                }
              }}
            >
              <option value="ALL">All scenarios</option>
              <option value="CRITICAL">Critical</option>
              <option value="ATTENTION">Attention</option>
              <option value="MONITOR">Monitor</option>
              <option value="DATA_GAP">Data gaps</option>
            </select>
          </label>
        </div>
        <div className="scenario-grid">
          {visibleScenarios.map((scenario) => {
            const relatedAsset = assets.find(
              (asset) => asset.assetCode === scenario.assetCode,
            );
            return (
              <article className="scenario-card" key={scenario.id}>
                <div className="scenario-card-heading">
                  <span className="scenario-category">{scenario.category}</span>
                  <span
                    className={`scenario-severity scenario-severity-${scenario.severity.toLowerCase()}`}
                  >
                    {severityLabels[scenario.severity]}
                  </span>
                </div>
                <h3>{scenario.title}</h3>
                <div className="scenario-asset">
                  <span>Affected asset</span>
                  {relatedAsset ? (
                    <Link to={`/assets/${relatedAsset.id}`}>
                      {relatedAsset.assetCode} · {relatedAsset.name}
                    </Link>
                  ) : (
                    <strong>{scenario.assetCode}</strong>
                  )}
                </div>
                <dl className="scenario-details">
                  <div>
                    <dt>Example trigger</dt>
                    <dd>{scenario.trigger}</dd>
                  </div>
                  <div>
                    <dt>Scenario context</dt>
                    <dd>{scenario.context}</dd>
                  </div>
                  <div>
                    <dt>Review prompt</dt>
                    <dd>{scenario.reviewPrompt}</dd>
                  </div>
                </dl>
                <span className="scenario-demo-tag">SIMULATED · NOT LIVE</span>
              </article>
            );
          })}
        </div>
        {visibleScenarios.length === 0 && (
          <p className="scenario-empty">No scenarios match this filter.</p>
        )}
      </section>
    </>
  );
}
