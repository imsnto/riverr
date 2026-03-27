/**
 * @fileOverview Environment Variable Validation for Vertex AI Infrastructure
 * 
 * Validates required environment variables at application startup.
 * Fails fast if critical configuration is missing.
 */

export interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED_ENV_VARS = [
  'VERTEX_AI_INDEX_ID',
  'VERTEX_AI_INDEX_ENDPOINT_ID',
  'VERTEX_AI_DEPLOYED_INDEX_ID',
  'VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN',
];

const OPTIONAL_ENV_VARS = [
  'GOOGLE_CLOUD_PROJECT',
  'VERTEX_API_LOCATION',
];

/**
 * Validates that all required Vertex AI environment variables are set
 */
export function validateVertexEnv(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar] || process.env[envVar]?.trim() === '') {
      missing.push(envVar);
    }
  }

  // Check optional vars (warn but don't fail)
  for (const envVar of OPTIONAL_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(`${envVar} not set, using default`);
    }
  }

  // Validate INDEX_ID format (should be numeric)
  const indexId = process.env.VERTEX_AI_INDEX_ID;
  if (indexId && !/^\d+$/.test(indexId)) {
    warnings.push(`VERTEX_AI_INDEX_ID (${indexId}) doesn't look like a valid numeric index ID`);
  }

  // Validate ENDPOINT_ID format (should be numeric)
  const endpointId = process.env.VERTEX_AI_INDEX_ENDPOINT_ID;
  if (endpointId && !/^\d+$/.test(endpointId)) {
    warnings.push(`VERTEX_AI_INDEX_ENDPOINT_ID (${endpointId}) doesn't look like a valid numeric endpoint ID`);
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Asserts that environment is valid, throws if not
 */
export function assertVertexEnv(): void {
  const result = validateVertexEnv();
  
  if (!result.valid) {
    console.error('[ENV VALIDATION FAILED] Missing required environment variables:');
    for (const envVar of result.missing) {
      console.error(`  - ${envVar}`);
    }
    console.error('\nPlease set these in your .env file or environment.');
    throw new Error(`Missing required env vars: ${result.missing.join(', ')}`);
  }

  if (result.warnings.length > 0) {
    console.warn('[ENV VALIDATION WARNINGS]:');
    for (const warning of result.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  console.log('[ENV VALIDATION] Vertex AI environment variables OK');
}

/**
 * Logs current Vertex AI configuration (for debugging)
 */
export function logVertexConfig(): void {
  const config = {
    project: process.env.GOOGLE_CLOUD_PROJECT || 'timeflow-6i3eo (default)',
    location: process.env.VERTEX_API_LOCATION || 'us-central1 (default)',
    indexId: process.env.VERTEX_AI_INDEX_ID || 'NOT SET',
    endpointId: process.env.VERTEX_AI_INDEX_ENDPOINT_ID || 'NOT SET',
    deployedIndexId: process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'NOT SET',
    publicEndpoint: process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || 'NOT SET',
  };

  console.log('[VERTEX AI CONFIG]');
  console.log(JSON.stringify(config, null, 2));
}
