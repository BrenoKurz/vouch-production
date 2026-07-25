export type ApiErrorCode =
  | 'authentication_required'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'state_conflict'
  | 'version_conflict'
  | 'idempotency_conflict'
  | 'membership_inactive'
  | 'account_paused'
  | 'account_suspended'
  | 'account_banned'
  | 'rate_limited'
  | 'internal_error'
  | 'not_implemented'
  | string;

type ApiErrorEnvelope = {
  error?: {
    code?: ApiErrorCode;
    message?: string;
    retryable?: boolean;
    request_id?: string;
  };
};

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  retryable: boolean;
  requestId?: string;

  constructor(input: {
    status: number;
    code?: ApiErrorCode;
    message?: string;
    retryable?: boolean;
    requestId?: string;
  }) {
    super(input.message ?? 'The request could not be completed.');
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code ?? 'internal_error';
    this.retryable = input.retryable ?? false;
    this.requestId = input.requestId;
  }
}

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!apiBaseUrl || !publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_BASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
}

export async function apiGet<T>(
  path: string,
  accessToken: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        apikey: publishableKey!,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: 'Unable to reach Vouch. Check your connection and try again.',
      retryable: true,
    });
  }

  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    // A malformed or empty response is handled below.
  }

  if (!response.ok) {
    const envelope = body as ApiErrorEnvelope | null;

    throw new ApiError({
      status: response.status,
      code: envelope?.error?.code,
      message:
        envelope?.error?.message ??
        'The request could not be completed.',
      retryable: envelope?.error?.retryable,
      requestId: envelope?.error?.request_id,
    });
  }

  return body as T;
}
