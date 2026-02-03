// src/lib/typesense.ts
import Typesense from "typesense";

const host = process.env.TYPESENSE_HOST!;
const port = Number(process.env.TYPESENSE_PORT || 8108);
const protocol = process.env.TYPESENSE_PROTOCOL || "http";

function assertEnv(name: string, value?: string) {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function getTypesenseAdmin() {
  return new Typesense.Client({
    nodes: [{ host, port, protocol }],
    apiKey: assertEnv("TYPESENSE_ADMIN_API_KEY", process.env.TYPESENSE_ADMIN_API_KEY),
    connectionTimeoutSeconds: 5,
  });
}

export function getTypesenseSearch() {
  return new Typesense.Client({
    nodes: [{ host, port, protocol }],
    apiKey: assertEnv("TYPESENSE_SEARCH_API_KEY", process.env.TYPESENSE_SEARCH_API_KEY),
    connectionTimeoutSeconds: 5,
  });
}
