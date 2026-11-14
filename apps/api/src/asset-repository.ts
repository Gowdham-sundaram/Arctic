import type {
  AssetHealthSummary,
  AssetRecord,
  CreateAssetInput,
  ListAssetsQuery,
  UpdateAssetInput,
} from "@arctic/contracts";

export interface AssetRepository {
  list(query: ListAssetsQuery): Promise<{ data: AssetRecord[]; total: number }>;
  findById(id: string): Promise<AssetRecord | null>;
  create(input: CreateAssetInput): Promise<AssetRecord>;
  update(id: string, input: UpdateAssetInput): Promise<AssetRecord | null>;
  archive(id: string): Promise<AssetRecord | null>;
  healthSummary(): Promise<AssetHealthSummary>;
  ping(): Promise<void>;
}
