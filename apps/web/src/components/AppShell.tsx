import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import type { AssetRecord } from "@arctic/contracts";
import { getApiHealth, listAssets, logout } from "../lib/api.ts";
import { useAuth } from "../lib/auth-context.tsx";

function assetCategory(type: AssetRecord["type"]): string {
  const categories: Record<AssetRecord["type"], string> = {
    PLATFORM: "Offshore",
    PIPELINE: "Pipeline",
    RISER: "Offshore",
    VALVE: "Subsea Equipment",
    MANIFOLD: "Subsea Equipment",
    CONNECTOR: "Subsea Equipment",
    PUMP: "Equipment",
    EQUIPMENT: "Equipment",
  };
  return categories[type];
}

function AssetGlyph({ type }: { type: AssetRecord["type"] }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      {type === "PIPELINE" ? (
        <>
          <path d="M3 9h6v10H3zm16 0h6v10h-6zM9 12h10v4H9z" />
          <path d="M6 6v3m16-3v3M6 19v3m16-3v3" />
        </>
      ) : type === "PLATFORM" ? (
        <>
          <path d="M4 10h20M6 10V7h16v3M8 10v12m6-12v12m6-12v12M4 22h20" />
          <path d="M10 7V4h8v3" />
        </>
      ) : (
        <>
          <ellipse cx="14" cy="7" rx="8" ry="3" />
          <path d="M6 7v14c0 1.7 16 1.7 16 0V7M6 14c0 1.7 16 1.7 16 0" />
        </>
      )}
    </svg>
  );
}

export function AppShell() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { session, clearSession } = useAuth();
  const canManageAssets =
    session?.user.role === "ADMIN" || session?.user.role === "ENGINEER";
  const [assetSearch, setAssetSearch] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearSession();
      queryClient.clear();
    },
  });
  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: getApiHealth,
    refetchInterval: 30_000,
    retry: 1,
  });
  const assets = useQuery({
    queryKey: ["dashboard", "assets"],
    queryFn: () => listAssets({ page: 1, pageSize: 100 }),
  });
  const visibleAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    const typeOrder: Record<AssetRecord["type"], number> = {
      PIPELINE: 0,
      EQUIPMENT: 1,
      PUMP: 1,
      RISER: 2,
      PLATFORM: 3,
      VALVE: 4,
      MANIFOLD: 4,
      CONNECTOR: 4,
    };
    return (assets.data?.data ?? [])
      .filter((asset) =>
        `${asset.assetCode} ${asset.name} ${asset.type} ${asset.location}`
          .toLowerCase()
          .includes(query),
      )
      .sort((left, right) => typeOrder[left.type] - typeOrder[right.type])
      .slice(0, 3);
  }, [assetSearch, assets.data?.data]);
  const currentAssetId = location.pathname.startsWith("/assets/")
    ? location.pathname.split("/")[2]
    : undefined;

  return (
    <div className={`app-shell${isCollapsed ? " app-shell-collapsed" : ""}`}>
      <aside className={`sidebar${isCollapsed ? " sidebar-collapsed" : ""}`}>
        <section className="sidebar-assets" aria-labelledby="sidebar-assets-title">
          <div className="sidebar-assets-heading">
            <h2 id="sidebar-assets-title">ASSETS</h2>
            {canManageAssets && (
              <Link
                className="sidebar-add-button"
                to="/assets?create=1"
                aria-label="Register asset"
                title="Register asset"
              >
                +
              </Link>
            )}
          </div>
          <label className="sidebar-search">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" />
            </svg>
            <input
              type="search"
              aria-label="Search assets"
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="Search assets..."
            />
          </label>
          {assets.isPending ? (
            <div className="sidebar-assets-message" role="status">
              Loading assets…
            </div>
          ) : assets.isError ? (
            <div className="sidebar-assets-message sidebar-assets-error" role="alert">
              <span>Asset list unavailable.</span>
              <button onClick={() => void assets.refetch()}>Retry</button>
            </div>
          ) : visibleAssets.length === 0 ? (
            <div className="sidebar-assets-message">No matching assets.</div>
          ) : (
            <div className="sidebar-asset-list">
              {visibleAssets.map((asset) => {
                const isSelected = currentAssetId
                  ? currentAssetId === asset.id
                  : location.pathname === "/dashboard" && asset.type === "PLATFORM";
                return (
                  <Link
                    className={`sidebar-asset${isSelected ? " sidebar-asset-selected" : ""}`}
                    to={`/assets/${asset.id}`}
                    key={asset.id}
                    aria-current={isSelected ? "page" : undefined}
                  >
                    <span className="sidebar-asset-icon">
                      <AssetGlyph type={asset.type} />
                    </span>
                    <span className="sidebar-asset-copy">
                      <strong>{asset.name}</strong>
                      <small>{assetCategory(asset.type)}</small>
                    </span>
                    <span
                      className={`sidebar-health-dot sidebar-health-${asset.health.toLowerCase()}`}
                      title={`Health: ${asset.health.toLowerCase()}`}
                      aria-label={`Health: ${asset.health.toLowerCase()}`}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              ▦
            </span>
            <span className="nav-link-label">Dashboard</span>
          </NavLink>
          <NavLink
            to="/assets"
            className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              ◫
            </span>
            <span className="nav-link-label">Assets</span>
          </NavLink>
          <NavLink
            to="/operations"
            className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              !
            </span>
            <span className="nav-link-label">Operations</span>
          </NavLink>
          <span
            className="nav-link nav-link-disabled"
            aria-disabled="true"
            title="Planned module"
          >
            <span className="nav-icon" aria-hidden="true">
              ⌁
            </span>
            <span className="nav-link-label">Analytics</span>
          </span>
          <NavLink
            to="/reports"
            className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
          >
            <span className="nav-icon" aria-hidden="true">
              ▤
            </span>
            <span className="nav-link-label">Reports</span>
          </NavLink>
          <span
            className="nav-link nav-link-disabled"
            aria-disabled="true"
            title="Planned module"
          >
            <span className="nav-icon" aria-hidden="true">
              ⚙
            </span>
            <span className="nav-link-label">Settings</span>
          </span>
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-collapse-button"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          >
            <span aria-hidden="true">{isCollapsed ? "›" : "‹"}</span>
            <span className="sidebar-collapse-label">
              {isCollapsed ? "Expand" : "Collapse"}
            </span>
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <Link className="topbar-brand" to="/dashboard" aria-label="ARCTIC dashboard">
              <span className="topbar-brand-mark" aria-hidden="true">
                A
              </span>
              <strong>ARCTIC</strong>
            </Link>
            <div className="topbar-context">
              <span className="topbar-eyebrow">ASSET RELIABILITY PLATFORM</span>
              <span className="topbar-divider">/</span>
              <span>Workspace</span>
            </div>
          </div>
          <div className="topbar-actions">
            <div
              className={`api-status${health.isError ? " api-status-error" : ""}`}
              role="status"
            >
              <span className="status-dot" />
              {health.isPending
                ? "Connecting"
                : health.isError
                  ? "API unavailable"
                  : "API connected"}
            </div>
            <span className="topbar-user">
              {session?.user.displayName} · {session?.user.role}
            </span>
            <button
              type="button"
              className="button-secondary topbar-logout"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>
        {logoutMutation.error && (
          <div className="topbar-error" role="alert">
            Sign out failed: {logoutMutation.error.message}
          </div>
        )}
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="page-footer">
          Independent portfolio prototype · Synthetic data · Not for operational
          engineering or safety decisions
        </footer>
      </div>
    </div>
  );
}
