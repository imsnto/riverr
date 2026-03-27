// src/lib/typesense.ts
/**
 * @deprecated This module is deprecated and will be removed in a future release.
 * The application has migrated to Vertex AI Vector Search for all vector search operations.
 * Please use `@/lib/brain/vector-search` instead for all search functionality.
 * 
 * Migration completed: March 2026
 * See: /home/imsnto/Desktop/riverr/documents/Vertex AI Vector Search Provisioning Guide.pdf
 */

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
