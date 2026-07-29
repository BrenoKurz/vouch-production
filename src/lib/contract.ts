import type { components } from '@/generated/api-contract';

export const EXPECTED_CONTRACT_VERSION = '0.14.0' as const;

export type ApiEnvelopeMeta =
  components['schemas']['ApiEnvelopeMeta'];

export function getApiEnvelopeMeta(
  value: unknown,
): ApiEnvelopeMeta | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('meta' in value)
  ) {
    return null;
  }

  const meta = (value as { meta?: unknown }).meta;

  if (
    typeof meta !== 'object' ||
    meta === null ||
    !('request_id' in meta) ||
    !('version' in meta) ||
    !('contract_version' in meta)
  ) {
    return null;
  }

  const candidate = meta as {
    request_id?: unknown;
    version?: unknown;
    contract_version?: unknown;
  };

  if (
    typeof candidate.request_id !== 'string' ||
    typeof candidate.version !== 'number' ||
    typeof candidate.contract_version !== 'string'
  ) {
    return null;
  }

  return {
    request_id: candidate.request_id,
    version: candidate.version,
    contract_version: candidate.contract_version,
  };
}
