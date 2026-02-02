import { DigitalTwinsClient } from "@azure/digital-twins-core";
import { ClientSecretCredential } from "@azure/identity";
import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";

// --- Environment validation ---

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// --- Singletons ---

let adtClient: DigitalTwinsClient | null = null;
let adxClient: KustoClient | null = null;

function getCredential(): ClientSecretCredential {
  return new ClientSecretCredential(
    requireEnv("AZURE_TENANT_ID"),
    requireEnv("AZURE_CLIENT_ID"),
    requireEnv("AZURE_CLIENT_SECRET")
  );
}

export function getAdtClient(): DigitalTwinsClient {
  if (!adtClient) {
    adtClient = new DigitalTwinsClient(
      requireEnv("ADT_INSTANCE_URL"),
      getCredential()
    );
  }
  return adtClient;
}

export function getAdxClient(): KustoClient {
  if (!adxClient) {
    const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
      requireEnv("ADX_CLUSTER_URL"),
      requireEnv("AZURE_CLIENT_ID"),
      requireEnv("AZURE_CLIENT_SECRET"),
      requireEnv("AZURE_TENANT_ID")
    );
    adxClient = new KustoClient(kcsb);
  }
  return adxClient;
}

export const ADX_DATABASE = process.env.ADX_DATABASE || "productionriskradar";

// --- ADX query helper ---

export async function queryAdx<T>(kql: string): Promise<T[]> {
  const client = getAdxClient();
  const result = await client.execute(ADX_DATABASE, kql);
  const table = result.primaryResults[0];
  if (!table) return [];

  const rows: T[] = [];
  for (const row of table.rows()) {
    rows.push(row.toJSON<T>());
  }
  return rows;
}

// --- ADX management command helper (for .set-or-append, .clear, etc.) ---

export async function executeAdxCommand(command: string): Promise<void> {
  const client = getAdxClient();
  await client.executeMgmt(ADX_DATABASE, command);
}

// --- ADT helpers ---

export async function getTwin(dtId: string): Promise<Record<string, unknown> | null> {
  try {
    const client = getAdtClient();
    const response = await client.getDigitalTwin(dtId);
    return response.body as Record<string, unknown>;
  } catch (e: unknown) {
    if (e instanceof Error && "statusCode" in e && (e as { statusCode: number }).statusCode === 404) {
      return null;
    }
    throw e;
  }
}

export async function patchTwin(
  dtId: string,
  patches: { op: string; path: string; value: unknown }[]
): Promise<void> {
  const client = getAdtClient();
  await client.updateDigitalTwin(dtId, patches);
}

// --- ADT query helper ---

export async function queryTwins<T>(query: string): Promise<T[]> {
  const client = getAdtClient();
  const result = client.queryTwins(query);
  const twins: T[] = [];
  for await (const twin of result) {
    twins.push(twin as T);
  }
  return twins;
}
