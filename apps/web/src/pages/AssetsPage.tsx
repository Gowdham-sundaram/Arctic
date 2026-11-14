import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  assetHealthStatuses,
  assetCriticalities,
  assetOperationalStatuses,
  assetTypes,
  createAssetSchema,
  type AssetRecord,
  type CreateAssetInput,
} from "@arctic/contracts";
import { ApiError, createAsset, listAssets } from "../lib/api.ts";
import { useAuth } from "../lib/auth-context.tsx";

function displayLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function HealthBadge({ health }: { health: AssetRecord["health"] }) {
  return (
    <span className={`health-badge health-${health.toLowerCase()}`}>
      <span className="health-dot" />
      {displayLabel(health)}
    </span>
  );
}

function CreateAssetPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<CreateAssetInput>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: {
      assetCode: "",
      name: "",
      type: "PIPELINE",
      location: "",
      criticality: "MEDIUM",
      health: "UNKNOWN",
    },
  });
  const parentAssets = useQuery({
    queryKey: ["assets", "parent-options"],
    queryFn: () => listAssets({ page: 1, pageSize: 100 }),
  });
  const mutation = useMutation({
    mutationFn: createAsset,
    onSuccess: async (asset) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "assets"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "asset-health"] }),
      ]);
      await navigate(`/assets/${asset.id}`);
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <section className="panel create-panel" aria-labelledby="create-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">NEW RECORD</p>
          <h2 id="create-heading">Register an asset</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close form">
          ×
        </button>
      </div>
      <form className="asset-form" onSubmit={(event) => void onSubmit(event)}>
        <label>
          Asset ID
          <input
            autoComplete="off"
            placeholder="e.g. PIPE-B12"
            {...form.register("assetCode")}
          />
          {form.formState.errors.assetCode && (
            <span className="field-error">{form.formState.errors.assetCode.message}</span>
          )}
        </label>
        <label>
          Asset name
          <input
            autoComplete="off"
            placeholder="e.g. Pipeline B-12"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <span className="field-error">{form.formState.errors.name.message}</span>
          )}
        </label>
        <div className="form-grid">
          <label>
            Asset type
            <select {...form.register("type")}>
              {assetTypes.map((type) => (
                <option key={type} value={type}>
                  {displayLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Initial condition
            <select {...form.register("health")}>
              {assetHealthStatuses.map((health) => (
                <option key={health} value={health}>
                  {displayLabel(health)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Description
          <textarea
            rows={3}
            placeholder="Purpose, function, or relevant equipment context"
            {...form.register("description")}
          />
        </label>
        <div className="form-grid">
          <label>
            Offshore field
            <input
              autoComplete="off"
              placeholder="e.g. Synthetic Field C"
              {...form.register("offshoreField")}
            />
          </label>
          <label>
            Parent asset
            <select {...form.register("parentId")}>
              <option value="">No parent</option>
              {parentAssets.data?.data.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetCode} — {asset.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Manufacturer
            <input autoComplete="off" {...form.register("manufacturer")} />
          </label>
          <label>
            Model
            <input autoComplete="off" {...form.register("model")} />
          </label>
          <label>
            Serial number
            <input autoComplete="off" {...form.register("serialNumber")} />
          </label>
          <label>
            Installation date
            <input
              type="date"
              {...form.register("installationDate", {
                setValueAs: (value: string) => value || undefined,
              })}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Criticality
            <select {...form.register("criticality")}>
              {assetCriticalities.map((criticality) => (
                <option key={criticality} value={criticality}>
                  {displayLabel(criticality)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Location
          <input
            autoComplete="off"
            placeholder="Field, area, or illustrative location"
            {...form.register("location")}
          />
          {form.formState.errors.location && (
            <span className="field-error">{form.formState.errors.location.message}</span>
          )}
        </label>
        {mutation.error && (
          <div className="form-error" role="alert">
            {mutation.error instanceof ApiError &&
            mutation.error.code === "ASSET_CODE_CONFLICT"
              ? "That asset ID is already in use."
              : mutation.error.message}
          </div>
        )}
        {parentAssets.error && (
          <div className="form-error" role="alert">
            Parent asset options could not be loaded: {parentAssets.error.message}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="button-primary"
            disabled={mutation.isPending || form.formState.isSubmitting}
          >
            {mutation.isPending ? "Saving…" : "Create asset"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function AssetsPage() {
  const { session } = useAuth();
  const canManageAssets =
    session?.user.role === "ADMIN" || session?.user.role === "ENGINEER";
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const isCreating = canManageAssets && searchParams.get("create") === "1";
  const setIsCreating = (open: boolean) => {
    const nextParams = new URLSearchParams(searchParams);
    if (open) nextParams.set("create", "1");
    else nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  };
  const selectedType = assetTypes.find((assetType) => assetType === type);
  const selectedStatus = assetOperationalStatuses.find(
    (assetStatus) => assetStatus === status,
  );
  const assets = useQuery({
    queryKey: ["assets", search, type, status, page],
    queryFn: () =>
      listAssets({
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(selectedType ? { type: selectedType } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
        page,
        pageSize: 20,
      }),
  });
  const pageCount = assets.data ? Math.max(1, Math.ceil(assets.data.total / 20)) : 1;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FIELD OPERATIONS / REGISTRY</p>
          <h1>Asset registry</h1>
          <p className="page-description">
            A traceable view of equipment and infrastructure in the synthetic field.
          </p>
        </div>
        {canManageAssets && (
          <button className="button-primary" onClick={() => setIsCreating(!isCreating)}>
            <span aria-hidden="true">＋</span> Register asset
          </button>
        )}
      </div>

      {isCreating && <CreateAssetPanel onClose={() => setIsCreating(false)} />}

      <section className="panel registry-panel" aria-labelledby="registry-heading">
        <div className="registry-toolbar">
          <div>
            <p className="eyebrow">INVENTORY</p>
            <h2 id="registry-heading">
              Field assets
              {assets.data && <span className="count-pill">{assets.data.total}</span>}
            </h2>
          </div>
          <div className="filters">
            <label className="search-field">
              <span className="sr-only">Search assets</span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search ID, name, location"
              />
            </label>
            <label>
              <span className="sr-only">Filter by asset type</span>
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All types</option>
                {assetTypes.map((assetType) => (
                  <option key={assetType} value={assetType}>
                    {displayLabel(assetType)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by operational status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {assetOperationalStatuses.map((assetStatus) => (
                  <option key={assetStatus} value={assetStatus}>
                    {displayLabel(assetStatus)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {assets.isPending ? (
          <div className="state-message" role="status">
            <span className="loading-indicator" />
            Loading asset records…
          </div>
        ) : assets.isError ? (
          <div className="state-message state-error" role="alert">
            <strong>Asset records could not be loaded.</strong>
            <span>{assets.error.message}</span>
            <button className="button-secondary" onClick={() => void assets.refetch()}>
              Try again
            </button>
          </div>
        ) : assets.data.data.length === 0 ? (
          <div className="state-message">
            <span className="empty-icon" aria-hidden="true">
              ◫
            </span>
            <strong>No assets found</strong>
            <span>
              {search || type
                ? "Try changing the search or filter."
                : "Create an asset or load the synthetic seed data to get started."}
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Criticality</th>
                  <th scope="col">Condition</th>
                  <th scope="col">
                    <span className="sr-only">Open details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {assets.data.data.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <Link className="asset-link" to={`/assets/${asset.id}`}>
                        <span className="asset-code">{asset.assetCode}</span>
                        <span className="asset-name">{asset.name}</span>
                      </Link>
                    </td>
                    <td>
                      <span className="type-label">{displayLabel(asset.type)}</span>
                    </td>
                    <td className="location-cell">{asset.location}</td>
                    <td>
                      <span
                        className={`criticality criticality-${asset.criticality.toLowerCase()}`}
                      >
                        {displayLabel(asset.criticality)}
                      </span>
                    </td>
                    <td>
                      <HealthBadge health={asset.health} />
                    </td>
                    <td>
                      <Link
                        className="row-arrow"
                        to={`/assets/${asset.id}`}
                        aria-label={`View ${asset.name}`}
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!assets.isPending && !assets.isError && assets.data && (
          <div className="registry-table-footer">
            <div className="table-caption">
              Showing {assets.data.data.length} of {assets.data.total} synthetic assets
            </div>
            {pageCount > 1 && (
              <nav className="registry-pagination" aria-label="Asset registry pages">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        )}
      </section>
    </>
  );
}
