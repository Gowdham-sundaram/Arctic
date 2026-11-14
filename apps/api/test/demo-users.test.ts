import { describe, expect, it } from "vitest";
import {
  demoUsers,
  getDemoAccessMode,
  getDemoUsers,
  getNonViewerDemoUserEmails,
} from "../src/demo-users.ts";

describe("demo access mode", () => {
  it("preserves all seeded roles by default for local development", () => {
    expect(getDemoAccessMode(undefined)).toBe("full");
    expect(getDemoUsers("full")).toEqual(demoUsers);
  });

  it("limits public seeding to the read-only viewer and identifies elevated demo accounts", () => {
    expect(getDemoUsers("viewer-only")).toEqual([
      { email: "viewer@arctic.demo", displayName: "ARCTIC Demo Viewer", role: "VIEWER" },
    ]);
    expect(getNonViewerDemoUserEmails()).toEqual([
      "admin@arctic.demo",
      "engineer@arctic.demo",
      "inspector@arctic.demo",
    ]);
  });

  it("rejects unknown access modes", () => {
    expect(() => getDemoAccessMode("public")).toThrow(
      'DEMO_ACCESS_MODE must be either "full" or "viewer-only".',
    );
  });
});
