import path from "path";

// Mock Azure modules before importing the seed function
const mockUpsertDigitalTwin = jest.fn().mockResolvedValue({});
const mockUpsertRelationship = jest.fn().mockResolvedValue({});
const mockDeleteDigitalTwin = jest.fn().mockResolvedValue({});
const mockDeleteRelationship = jest.fn().mockResolvedValue({});
const mockListRelationships = jest.fn().mockReturnValue({
  [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }),
});
const mockListIncomingRelationships = jest.fn().mockReturnValue({
  [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }),
});
const mockQueryTwins = jest.fn().mockReturnValue({
  [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }),
});
const mockExecuteMgmt = jest.fn().mockResolvedValue({});

jest.mock("@azure/digital-twins-core", () => ({
  DigitalTwinsClient: jest.fn().mockImplementation(() => ({
    upsertDigitalTwin: mockUpsertDigitalTwin,
    upsertRelationship: mockUpsertRelationship,
    deleteDigitalTwin: mockDeleteDigitalTwin,
    deleteRelationship: mockDeleteRelationship,
    listRelationships: mockListRelationships,
    listIncomingRelationships: mockListIncomingRelationships,
    queryTwins: mockQueryTwins,
  })),
}));

jest.mock("@azure/identity", () => ({
  ClientSecretCredential: jest.fn(),
}));

jest.mock("azure-kusto-data", () => ({
  Client: jest.fn().mockImplementation(() => ({
    executeMgmt: mockExecuteMgmt,
  })),
  KustoConnectionStringBuilder: {
    withAadApplicationKeyAuthentication: jest.fn().mockReturnValue("mock-kcsb"),
  },
}));

jest.mock("azure-kusto-ingest", () => ({}));

// Import after mocks are set up
import { seedAzure } from "../azure-seed";

const csvPath = path.join(process.cwd(), "data", "production_risk_radar_demo_data.csv");

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the singleton clients so mocks are re-initialized
  jest.resetModules();
});

describe("seedAzure", () => {
  it("creates 19 twins (1 factory + 3 lines + 15 machines)", async () => {
    const result = await seedAzure(csvPath);
    expect(result.twins_created).toBe(19);
    expect(mockUpsertDigitalTwin).toHaveBeenCalledTimes(19);
  });

  it("creates 33 relationships (3 hasLines + 15 hasMachines + 15 partOf)", async () => {
    const result = await seedAzure(csvPath);
    expect(result.relationships_created).toBe(33);
    expect(mockUpsertRelationship).toHaveBeenCalledTimes(33);
  });

  it("reports 360 telemetry rows", async () => {
    const result = await seedAzure(csvPath);
    expect(result.telemetry_rows).toBe(360);
  });

  it("clears ADX table before ingestion", async () => {
    await seedAzure(csvPath);
    const clearCall = mockExecuteMgmt.mock.calls.find(
      (call: unknown[]) => typeof call[1] === "string" && call[1].includes(".clear table Telemetry data")
    );
    expect(clearCall).toBeDefined();
  });

  it("creates factory twin with valid risk score", async () => {
    await seedAzure(csvPath);
    const factoryCall = mockUpsertDigitalTwin.mock.calls.find(
      (call: unknown[]) => call[0] === "demo-factory"
    );
    expect(factoryCall).toBeDefined();
    const factoryTwin = JSON.parse(factoryCall![1] as string) as Record<string, unknown>;
    expect(factoryTwin.overallRiskScore).toBeGreaterThanOrEqual(0);
    expect(factoryTwin.overallRiskScore).toBeLessThanOrEqual(1);
  });

  it("creates machine twins with valid risk scores", async () => {
    await seedAzure(csvPath);
    const machineCalls = mockUpsertDigitalTwin.mock.calls.filter(
      (call: unknown[]) => {
        const twin = JSON.parse(call[1] as string) as Record<string, unknown>;
        const metadata = twin.$metadata as Record<string, string>;
        return metadata.$model === "dtmi:com:productionriskradar:Machine;1";
      }
    );
    expect(machineCalls.length).toBe(15);
    for (const call of machineCalls) {
      const twin = JSON.parse(call[1] as string) as Record<string, unknown>;
      expect(twin.riskScore).toBeGreaterThanOrEqual(0);
      expect(twin.riskScore).toBeLessThanOrEqual(1);
    }
  });

  it("creates line twins with throughput forecasts", async () => {
    await seedAzure(csvPath);
    const lineCalls = mockUpsertDigitalTwin.mock.calls.filter(
      (call: unknown[]) => {
        const twin = JSON.parse(call[1] as string) as Record<string, unknown>;
        const metadata = twin.$metadata as Record<string, string>;
        return metadata.$model === "dtmi:com:productionriskradar:Line;1";
      }
    );
    expect(lineCalls.length).toBe(3);
    for (const call of lineCalls) {
      const twin = JSON.parse(call[1] as string) as Record<string, unknown>;
      expect(twin.throughputForecast).toBeGreaterThan(0);
      expect(twin.throughputForecast).toBeLessThanOrEqual(480);
    }
  });

  it("creates hasLines relationships from factory to lines", async () => {
    await seedAzure(csvPath);
    const hasLinesCalls = mockUpsertRelationship.mock.calls.filter(
      (call: unknown[]) => call[0] === "demo-factory"
    );
    expect(hasLinesCalls.length).toBe(3);
  });

  it("creates hasMachines and partOf relationships for each machine", async () => {
    await seedAzure(csvPath);
    const hasMachinesCalls = mockUpsertRelationship.mock.calls.filter(
      (call: unknown[]) => {
        const rel = call[2] as Record<string, string>;
        return rel.$relationshipName === "hasMachines";
      }
    );
    const partOfCalls = mockUpsertRelationship.mock.calls.filter(
      (call: unknown[]) => {
        const rel = call[2] as Record<string, string>;
        return rel.$relationshipName === "partOf";
      }
    );
    expect(hasMachinesCalls.length).toBe(15);
    expect(partOfCalls.length).toBe(15);
  });

  it("ingests telemetry in batches via .ingest inline commands", async () => {
    await seedAzure(csvPath);
    const ingestCalls = mockExecuteMgmt.mock.calls.filter(
      (call: unknown[]) => typeof call[1] === "string" && call[1].includes(".ingest inline into table Telemetry")
    );
    // 360 rows / 50 per batch = 8 batches (7 full + 1 partial)
    expect(ingestCalls.length).toBe(8);
  });
});
