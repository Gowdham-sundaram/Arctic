import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import type { AssetRecord } from "@arctic/contracts";
import { PrismaClient } from "../apps/api/src/generated/prisma/client.ts";
import {
  getDemoAccessMode,
  getDemoUsers,
  getNonViewerDemoUserEmails,
} from "../apps/api/src/demo-users.ts";
import { hashPassword } from "../apps/api/src/prisma-auth-repository.ts";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed ARCTIC demo data.");
}
const demoUserPassword = process.env.DEMO_USER_PASSWORD;
if (!demoUserPassword || demoUserPassword.length < 12) {
  throw new Error("Set DEMO_USER_PASSWORD to at least 12 characters before seeding.");
}
const demoAccessMode = getDemoAccessMode(process.env.DEMO_ACCESS_MODE);
if (process.env.NODE_ENV === "production" && demoAccessMode !== "viewer-only") {
  throw new Error('Production seeding requires DEMO_ACCESS_MODE="viewer-only".');
}
const usersToSeed = getDemoUsers(demoAccessMode);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

type DemoAsset = Pick<
  AssetRecord,
  | "assetCode"
  | "name"
  | "type"
  | "description"
  | "location"
  | "offshoreField"
  | "latitude"
  | "longitude"
  | "installationDate"
  | "health"
  | "criticality"
  | "status"
  | "manufacturer"
  | "model"
  | "serialNumber"
> & { parentCode?: string };

const examples: DemoAsset[] = [
  {
    assetCode: "PLAT-C",
    name: "Offshore Platform C",
    type: "PLATFORM",
    description:
      "Integrated fixed production platform with topsides, jacket structure, helideck, and corrosion protection systems.",
    location: "Offshore Field C",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-04-15",
    health: "HEALTHY",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "Fixed jacket platform",
    serialNumber: "DEMO-PLAT-C-001",
  },
  {
    assetCode: "PIPE-01",
    name: "Export Pipeline 01",
    type: "PIPELINE",
    description:
      "Illustrative export line with corrosion monitoring and periodic inspection requirements.",
    location: "Field C west export corridor",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2017-08-03",
    health: "ATTENTION",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "Subsea export line",
    serialNumber: "DEMO-PIPE-001",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "RISER-01",
    name: "Production Riser 01",
    type: "RISER",
    description:
      "Production riser assembly represented for vibration, fatigue, and inspection scenarios.",
    location: "Field C east jacket face",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-05-01",
    health: "CRITICAL",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "Top-tensioned riser",
    serialNumber: "DEMO-RISER-001",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "MAN-01",
    name: "Subsea Manifold 01",
    type: "MANIFOLD",
    description:
      "Subsea distribution manifold with illustrative pressure and communications monitoring.",
    location: "Field C north subsea template",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2018-02-20",
    health: "UNKNOWN",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "Four-slot production manifold",
    serialNumber: "DEMO-MAN-001",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "PUMP-SW-01",
    name: "Seawater Injection Pump 01",
    type: "PUMP",
    description:
      "Seawater injection pump package represented for bearing temperature and vibration scenarios.",
    location: "Utilities module, deck 2",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2019-06-11",
    health: "ATTENTION",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Machinery",
    model: "SWI-400",
    serialNumber: "DEMO-PUMP-SW-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "PUMP-FW-01",
    name: "Firewater Pump 01",
    type: "PUMP",
    description:
      "Firewater system pump retained as a high-consequence availability monitoring example.",
    location: "Firewater module, main deck",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-05-12",
    health: "HEALTHY",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Machinery",
    model: "FW-220",
    serialNumber: "DEMO-PUMP-FW-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "PUMP-BK-02",
    name: "Standby Booster Pump 02",
    type: "PUMP",
    description:
      "Standby equipment example used to show inactive and unknown-condition states.",
    location: "Utilities module, deck 1",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-05-12",
    health: "UNKNOWN",
    criticality: "MEDIUM",
    status: "INACTIVE",
    manufacturer: "ARCTIC Demo Machinery",
    model: "SB-120",
    serialNumber: "DEMO-PUMP-BK-02",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "COMP-01",
    name: "Gas Export Compressor 01",
    type: "EQUIPMENT",
    description:
      "Compressor train represented for vibration, temperature, and availability scenarios.",
    location: "Compression module, deck 3",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2017-01-08",
    health: "HEALTHY",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Machinery",
    model: "GX-900",
    serialNumber: "DEMO-COMP-001",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "GAS-DET-01",
    name: "Gas Detector Deck A",
    type: "EQUIPMENT",
    description:
      "Fixed gas detection point used to illustrate alarm, fault, and stale-data workflows.",
    location: "Process module, deck 2",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2020-03-16",
    health: "ATTENTION",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Instruments",
    model: "GD-X2",
    serialNumber: "DEMO-GAS-DET-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "CP-RECT-A",
    name: "CP Rectifier A",
    type: "EQUIPMENT",
    description:
      "Impressed-current cathodic protection rectifier represented for output and availability monitoring.",
    location: "Electrical room, deck 1",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-06-02",
    health: "ATTENTION",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Electrical",
    model: "ICCP-120",
    serialNumber: "DEMO-CP-RECT-A",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "CP-REF-01",
    name: "CP Reference Electrode 01",
    type: "EQUIPMENT",
    description:
      "Reference electrode example for potential measurement and instrument-quality scenarios.",
    location: "Jacket leg 1, splash zone",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-06-02",
    health: "UNKNOWN",
    criticality: "MEDIUM",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Instruments",
    model: "RE-30",
    serialNumber: "DEMO-CP-REF-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "VALVE-ISO-01",
    name: "Export Isolation Valve 01",
    type: "VALVE",
    description:
      "Pipeline isolation valve represented for actuator position and response-time monitoring.",
    location: "Export riser base, cellar deck",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2017-08-03",
    health: "HEALTHY",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Controls",
    model: "EIV-600",
    serialNumber: "DEMO-VALVE-ISO-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "VALVE-ACT-07",
    name: "Actuated Process Valve 07",
    type: "VALVE",
    description:
      "Actuated process valve example used for travel-time and position-disagreement scenarios.",
    location: "Production module, deck 2",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2018-09-10",
    health: "ATTENTION",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Controls",
    model: "PCV-220",
    serialNumber: "DEMO-VALVE-ACT-07",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "CONN-JMP-02",
    name: "Production Jumper Connector 02",
    type: "CONNECTOR",
    description:
      "Subsea jumper connection included for leak-detection and inspection-planning scenarios.",
    location: "Field C north subsea template",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2018-02-20",
    health: "HEALTHY",
    criticality: "MEDIUM",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Subsea",
    model: "JMP-CONN-02",
    serialNumber: "DEMO-CONN-JMP-02",
    parentCode: "MAN-01",
  },
  {
    assetCode: "CONN-SUB-04",
    name: "Subsea Connector 04",
    type: "CONNECTOR",
    description:
      "Subsea connector record with incomplete inspection metadata for data-quality examples.",
    location: "Field C south subsea template",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2019-04-04",
    health: "UNKNOWN",
    criticality: "MEDIUM",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Subsea",
    model: "SUB-CONN-04",
    serialNumber: "DEMO-CONN-SUB-04",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "PIG-LCH-01",
    name: "Pipeline Pig Launcher 01",
    type: "EQUIPMENT",
    description:
      "Pipeline launcher package included for maintenance, inspection, and readiness scenarios.",
    location: "Export line deck, west side",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2017-08-03",
    health: "HEALTHY",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "PIG-L-24",
    serialNumber: "DEMO-PIG-LCH-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "SEP-01",
    name: "Production Separator 01",
    type: "EQUIPMENT",
    description:
      "Production separator vessel record for process instrumentation and inspection scenarios.",
    location: "Production module, deck 2",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-08-12",
    health: "ATTENTION",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "3P-SEP-800",
    serialNumber: "DEMO-SEP-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "CRANE-01",
    name: "Main Deck Crane 01",
    type: "EQUIPMENT",
    description:
      "Lattice-boom deck crane example for mechanical integrity and scheduled inspection tracking.",
    location: "Main deck, port side",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-05-12",
    health: "HEALTHY",
    criticality: "MEDIUM",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Lifting",
    model: "LBC-75",
    serialNumber: "DEMO-CRANE-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "JACKET-LEG-02",
    name: "Jacket Leg 02",
    type: "EQUIPMENT",
    description:
      "Primary support member represented for coating, corrosion, and inspection history.",
    location: "Jacket southeast corner",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-04-15",
    health: "ATTENTION",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "JKT-LEG-02",
    serialNumber: "DEMO-JACKET-LEG-02",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "RISER-CLAMP-02",
    name: "Riser Clamp 02",
    type: "EQUIPMENT",
    description:
      "Riser support component listed for vibration review and inspection planning.",
    location: "Riser guide, deck 1",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-05-01",
    health: "CRITICAL",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "RCL-220",
    serialNumber: "DEMO-RISER-CLAMP-02",
    parentCode: "RISER-01",
  },
  {
    assetCode: "HX-01",
    name: "Cooling Water Heat Exchanger 01",
    type: "EQUIPMENT",
    description:
      "Heat exchanger record for fouling, corrosion, and performance-deviation examples.",
    location: "Utilities module, deck 2",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2017-02-17",
    health: "HEALTHY",
    criticality: "MEDIUM",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Process",
    model: "CW-HX-440",
    serialNumber: "DEMO-HX-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "TX-01",
    name: "Main Power Transformer TX-01",
    type: "EQUIPMENT",
    description:
      "Power transformer entry used for condition, availability, and maintenance examples.",
    location: "Electrical room, deck 1",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-04-15",
    health: "ATTENTION",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Electrical",
    model: "TX-3MVA",
    serialNumber: "DEMO-TX-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "UMB-01",
    name: "Subsea Control Umbilical 01",
    type: "PIPELINE",
    description:
      "Control umbilical record for data availability and subsea connection monitoring.",
    location: "Field C north subsea route",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2018-02-20",
    health: "UNKNOWN",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Subsea",
    model: "SCU-12",
    serialNumber: "DEMO-UMB-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "PUMP-PW-02",
    name: "Produced Water Pump 02",
    type: "PUMP",
    description:
      "Produced-water pump record for vibration, temperature, and availability scenarios.",
    location: "Water treatment module, deck 2",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2018-07-14",
    health: "CRITICAL",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Machinery",
    model: "PWP-240",
    serialNumber: "DEMO-PUMP-PW-02",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "VALVE-SC-03",
    name: "Subsea Choke Valve 03",
    type: "VALVE",
    description:
      "Subsea choke valve included for actuation, control, and telemetry-gap examples.",
    location: "Field C north subsea template",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2018-02-20",
    health: "UNKNOWN",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Controls",
    model: "SCV-160",
    serialNumber: "DEMO-VALVE-SC-03",
    parentCode: "MAN-01",
  },
  {
    assetCode: "HELI-FM-01",
    name: "Helideck Fire Monitor 01",
    type: "EQUIPMENT",
    description:
      "Helideck fire monitor record used for inspection and equipment-readiness tracking.",
    location: "Helideck, starboard edge",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-05-12",
    health: "HEALTHY",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Safety Systems",
    model: "HFM-90",
    serialNumber: "DEMO-HELI-FM-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "PROD-MOD-01",
    name: "Production Module 01",
    type: "EQUIPMENT",
    description:
      "Production module grouping record for process equipment and asset-hierarchy examples.",
    location: "Topside, central deck",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-04-15",
    health: "HEALTHY",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "PM-01",
    serialNumber: "DEMO-PROD-MOD-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "TANK-01",
    name: "Chemical Storage Tank 01",
    type: "EQUIPMENT",
    description:
      "Chemical storage tank record included for corrosion, level instrumentation, and inspection scenarios.",
    location: "Chemical injection area, deck 1",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-07-09",
    health: "HEALTHY",
    criticality: "MEDIUM",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Fabrication",
    model: "CST-120",
    serialNumber: "DEMO-TANK-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "MOOR-LINE-01",
    name: "Mooring Line 01",
    type: "EQUIPMENT",
    description:
      "Mooring-line entry for fatigue, inspection-status, and environmental-load examples.",
    location: "Field C west anchor spread",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2016-04-15",
    health: "ATTENTION",
    criticality: "HIGH",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Mooring",
    model: "ML-900",
    serialNumber: "DEMO-MOOR-LINE-01",
    parentCode: "PLAT-C",
  },
  {
    assetCode: "LEAK-SENS-01",
    name: "Subsea Leak Sensor 01",
    type: "EQUIPMENT",
    description:
      "Leak-detection sensor record for alarm, communication, and stale-data scenarios.",
    location: "Field C north subsea template",
    offshoreField: "Synthetic Field C",
    latitude: null,
    longitude: null,
    installationDate: "2018-02-20",
    health: "UNKNOWN",
    criticality: "CRITICAL",
    status: "ACTIVE",
    manufacturer: "ARCTIC Demo Instruments",
    model: "SLS-10",
    serialNumber: "DEMO-LEAK-SENS-01",
    parentCode: "MAN-01",
  },
];

async function main(): Promise<void> {
  const assetIds = new Map<string, string>();

  for (const example of examples) {
    const { parentCode, ...asset } = example;
    const parentId = parentCode ? assetIds.get(parentCode) : null;
    if (parentCode && !parentId) {
      throw new Error(`Demo asset parent "${parentCode}" must be seeded first.`);
    }

    const data = {
      ...asset,
      installationDate: asset.installationDate
        ? new Date(`${asset.installationDate}T00:00:00.000Z`)
        : null,
      parentId: parentId ?? null,
    };
    const saved = await prisma.asset.upsert({
      where: { assetCode: asset.assetCode },
      update: data,
      create: data,
    });
    assetIds.set(asset.assetCode, saved.id);
  }

  if (demoAccessMode === "viewer-only") {
    await prisma.user.updateMany({
      where: { email: { in: getNonViewerDemoUserEmails() } },
      data: { isActive: false },
    });
  }

  for (const user of usersToSeed) {
    const passwordHash = await hashPassword(demoUserPassword);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role,
        isActive: true,
        passwordHash,
      },
      create: {
        ...user,
        passwordHash,
      },
    });
  }

  console.info(`Seeded ${examples.length} synthetic ARCTIC assets.`);
  console.info(`Seeded ${usersToSeed.length} demo account(s) in ${demoAccessMode} mode.`);
}

main()
  .catch((error: unknown) => {
    console.error("Synthetic asset seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
