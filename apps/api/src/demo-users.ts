export const demoUsers = [
  { email: "admin@arctic.demo", displayName: "ARCTIC Demo Admin", role: "ADMIN" },
  {
    email: "engineer@arctic.demo",
    displayName: "ARCTIC Demo Engineer",
    role: "ENGINEER",
  },
  {
    email: "inspector@arctic.demo",
    displayName: "ARCTIC Demo Inspector",
    role: "INSPECTOR",
  },
  { email: "viewer@arctic.demo", displayName: "ARCTIC Demo Viewer", role: "VIEWER" },
] as const;

export type DemoAccessMode = "full" | "viewer-only";

export function getDemoAccessMode(value: string | undefined): DemoAccessMode {
  if (value === undefined || value === "full") return "full";
  if (value === "viewer-only") return "viewer-only";
  throw new Error('DEMO_ACCESS_MODE must be either "full" or "viewer-only".');
}

export function getDemoUsers(accessMode: DemoAccessMode) {
  return accessMode === "viewer-only"
    ? demoUsers.filter((user) => user.role === "VIEWER")
    : demoUsers;
}

export function getNonViewerDemoUserEmails(): string[] {
  return demoUsers.filter((user) => user.role !== "VIEWER").map((user) => user.email);
}
