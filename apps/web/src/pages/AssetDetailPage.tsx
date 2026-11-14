import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  assetCriticalities,
  assetHealthStatuses,
  assetTypes,
  updateAssetSchema,
  type AssetRecord,
  type UpdateAssetInput,
} from "@arctic/contracts";
import { ApiError, archiveAsset, getAsset, listAssets, updateAsset } from "../lib/api.ts";
import { useAuth } from "../lib/auth-context.tsx";

function displayLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function EditAssetPanel({ asset, onClose }: { asset: AssetRecord; onClose: () => void }) {
  const queryClient = useQueryClient();
  const parents = useQuery({
    queryKey: ["assets", "parent-options"],
    queryFn: () => listAssets({ page: 1, pageSize: 100 }),
  });
  const form = useForm<UpdateAssetInput>({
    resolver: zodResolver(updateAssetSchema),
    defaultValues: {
      assetCode: asset.assetCode,
      name: asset.name,
      type: asset.type,
      description: asset.description ?? "",
      parentId: asset.parentId ?? "",
      location: asset.location,
      offshoreField: asset.offshoreField ?? "",
      health: asset.health,
      criticality: asset.criticality,
      latitude: asset.latitude ?? undefined,
      longitude: asset.longitude ?? undefined,
      installationDate: asset.installationDate ?? "",
      manufacturer: asset.manufacturer ?? "",
      model: asset.model ?? "",
      serialNumber: asset.serialNumber ?? "",
      status: asset.status === "ARCHIVED" ? undefined : asset.status,
    },
  });
  const mutation = useMutation({
    mutationFn: (input: UpdateAssetInput) => updateAsset(asset.id, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["asset", asset.id] }),
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "assets"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "asset-health"] }),
      ]);
      onClose();
    },
  });

  return (
    <section className="panel create-panel" aria-labelledby="edit-asset-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ASSET RECORD</p>
          <h2 id="edit-asset-heading">Edit asset</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close form">
          ×
        </button>
      </div>
      <form
        className="asset-form"
        onSubmit={(event) =>
          void form.handleSubmit((input) => mutation.mutate(input))(event)
        }
      >
        <label>
          Asset ID
          <input {...form.register("assetCode")} />
        </label>
        <label>
          Asset name
          <input {...form.register("name")} />
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
            Condition
            <select {...form.register("health")}>
              {assetHealthStatuses.map((health) => (
                <option key={health} value={health}>
                  {displayLabel(health)}
                </option>
              ))}
            </select>
          </label>
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
          <label>
            Operational status
            <select {...form.register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>
        <label>
          Description
          <textarea rows={3} {...form.register("description")} />
        </label>
        <div className="form-grid">
          <label>
            Offshore field
            <input {...form.register("offshoreField")} />
          </label>
          <label>
            Parent asset
            <select {...form.register("parentId")}>
              <option value="">No parent</option>
              {parents.data?.data
                .filter((parent) => parent.id !== asset.id)
                .map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.assetCode} — {parent.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="any"
              {...form.register("latitude", {
                setValueAs: (value: string) => (value === "" ? null : Number(value)),
              })}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              {...form.register("longitude", {
                setValueAs: (value: string) => (value === "" ? null : Number(value)),
              })}
            />
          </label>
          <label>
            Manufacturer
            <input {...form.register("manufacturer")} />
          </label>
          <label>
            Model
            <input {...form.register("model")} />
          </label>
          <label>
            Serial number
            <input {...form.register("serialNumber")} />
          </label>
          <label>
            Installation date
            <input
              type="date"
              {...form.register("installationDate", {
                setValueAs: (value: string) => value || null,
              })}
            />
          </label>
        </div>
        {mutation.error && (
          <div className="form-error" role="alert">
            {mutation.error.message}
          </div>
        )}
        {parents.error && (
          <div className="form-error" role="alert">
            Parent asset options could not be loaded: {parents.error.message}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function AssetDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const canManageAssets =
    session?.user.role === "ADMIN" || session?.user.role === "ENGINEER";
  const asset = useQuery({
    queryKey: ["asset", id],
    queryFn: () => getAsset(id),
    enabled: Boolean(id),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  });
  const assetPortfolio = useQuery({
    queryKey: ["dashboard", "assets"],
    queryFn: () => listAssets({ page: 1, pageSize: 100 }),
  });
  const detailNotFound = asset.error instanceof ApiError && asset.error.status === 404;
  const listedAsset = detailNotFound
    ? assetPortfolio.data?.data.find((record) => record.id === id)
    : undefined;
  const assetRecord = asset.data ?? listedAsset;
  const loading =
    asset.isPending || (detailNotFound && assetPortfolio.isPending && !assetRecord);
  const parentAsset = assetPortfolio.data?.data.find(
    (record) => record.id === assetRecord?.parentId,
  );
  const childAssets =
    assetPortfolio.data?.data.filter((record) => record.parentId === assetRecord?.id) ??
    [];
  const archiveMutation = useMutation({
    mutationFn: archiveAsset,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "assets"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "asset-health"] }),
      ]);
      await navigate("/assets");
    },
  });

  return (
    <>
      <Link className="back-link" to="/assets">
        <span aria-hidden="true">←</span> Back to asset registry
      </Link>
      {loading ? (
        <div className="panel state-message" role="status">
          <span className="loading-indicator" />
          Loading asset details…
        </div>
      ) : !assetRecord ? (
        <div className="panel state-message state-error" role="alert">
          <strong>Asset details could not be loaded.</strong>
          <span>
            {asset.error?.message ??
              assetPortfolio.error?.message ??
              "The asset could not be found in the loaded registry."}
          </span>
          <Link className="button-secondary" to="/assets">
            Return to registry
          </Link>
        </div>
      ) : (
        <>
          {assetRecord.isArchived && (
            <div className="detail-fallback-notice" role="status">
              This record is archived and retained for historical reference.
            </div>
          )}
          {isEditing && canManageAssets && (
            <EditAssetPanel asset={assetRecord} onClose={() => setIsEditing(false)} />
          )}
          {detailNotFound && (
            <div className="detail-fallback-notice" role="status">
              The detail endpoint returned not found. Showing this asset from the loaded
              registry record.
            </div>
          )}
          <div className="page-heading detail-heading">
            <div>
              <p className="eyebrow">ASSET RECORD / {assetRecord.assetCode}</p>
              <h1>{assetRecord.name}</h1>
              <p className="page-description">
                {displayLabel(assetRecord.type)} · {assetRecord.location}
              </p>
            </div>
            <span className={`health-badge health-${assetRecord.health.toLowerCase()}`}>
              <span className="health-dot" />
              {displayLabel(assetRecord.health)}
            </span>
            {canManageAssets && !assetRecord.isArchived && (
              <div className="asset-detail-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setIsEditing((editing) => !editing)}
                >
                  {isEditing ? "Close editor" : "Edit asset"}
                </button>
                <button
                  type="button"
                  className="button-danger"
                  disabled={archiveMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Archive ${assetRecord.assetCode}? It will be removed from active lists but retained in history.`,
                      )
                    ) {
                      archiveMutation.mutate(assetRecord.id);
                    }
                  }}
                >
                  {archiveMutation.isPending ? "Archiving…" : "Archive"}
                </button>
              </div>
            )}
          </div>
          {archiveMutation.error && (
            <div className="form-error" role="alert">
              Asset could not be archived: {archiveMutation.error.message}
            </div>
          )}

          <section className="detail-grid">
            <article className="panel detail-card">
              <p className="eyebrow">IDENTIFICATION</p>
              <h2>Asset information</h2>
              <dl className="detail-list">
                <div>
                  <dt>Asset ID</dt>
                  <dd>{assetRecord.assetCode}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{displayLabel(assetRecord.type)}</dd>
                </div>
                <div>
                  <dt>Operational status</dt>
                  <dd>{displayLabel(assetRecord.status)}</dd>
                </div>
                <div>
                  <dt>Criticality</dt>
                  <dd>{displayLabel(assetRecord.criticality)}</dd>
                </div>
                <div>
                  <dt>Parent asset</dt>
                  <dd>
                    {parentAsset ? (
                      <Link to={`/assets/${parentAsset.id}`}>
                        {parentAsset.assetCode} · {parentAsset.name}
                      </Link>
                    ) : (
                      (assetRecord.parentId ?? "Not assigned")
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Child assets</dt>
                  <dd>
                    {childAssets.length > 0
                      ? childAssets.map((record) => record.name).join(", ")
                      : "None recorded"}
                  </dd>
                </div>
              </dl>
              <p className="detail-description">
                {assetRecord.description ?? "No description has been recorded."}
              </p>
            </article>
            <article className="panel detail-card">
              <p className="eyebrow">LOCATION & DEPLOYMENT</p>
              <h2>Field context</h2>
              <dl className="detail-list">
                <div>
                  <dt>Location</dt>
                  <dd>{assetRecord.location}</dd>
                </div>
                <div>
                  <dt>Offshore field</dt>
                  <dd>{assetRecord.offshoreField ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt>Coordinates</dt>
                  <dd>
                    {assetRecord.latitude !== null && assetRecord.longitude !== null
                      ? `${assetRecord.latitude}, ${assetRecord.longitude}`
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Installation date</dt>
                  <dd>{assetRecord.installationDate ?? "Not specified"}</dd>
                </div>
              </dl>
            </article>
            <article className="panel detail-card">
              <p className="eyebrow">EQUIPMENT & CONDITION</p>
              <h2>Technical record</h2>
              <dl className="detail-list">
                <div>
                  <dt>Manufacturer</dt>
                  <dd>{assetRecord.manufacturer ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{assetRecord.model ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt>Serial number</dt>
                  <dd>{assetRecord.serialNumber ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Condition classification</dt>
                  <dd>{displayLabel(assetRecord.health)}</dd>
                </div>
                <div>
                  <dt>Record created</dt>
                  <dd>{new Date(assetRecord.createdAt).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt>Last record update</dt>
                  <dd>{new Date(assetRecord.updatedAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </article>
          </section>
          <section
            className="panel detail-monitoring"
            aria-labelledby="monitoring-heading"
          >
            <div>
              <p className="eyebrow">MONITORING COVERAGE</p>
              <h2 id="monitoring-heading">Data availability</h2>
            </div>
            <div className="monitoring-coverage-grid">
              <div>
                <span>Condition record</span>
                <strong>{displayLabel(assetRecord.health)}</strong>
              </div>
              <div>
                <span>Live sensor connection</span>
                <strong>Not connected</strong>
              </div>
              <div>
                <span>Inspection history</span>
                <strong>Not available in demo</strong>
              </div>
              <div>
                <span>Work-order history</span>
                <strong>Not available in demo</strong>
              </div>
            </div>
          </section>
          <p className="data-notice">
            Asset metadata and condition labels are synthetic demonstration data. No live
            instrumentation, inspection history, or work-order system is connected.
          </p>
        </>
      )}
    </>
  );
}
