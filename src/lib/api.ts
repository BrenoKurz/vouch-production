export type ApiErrorCode =
  | 'authentication_required'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'state_conflict'
  | 'version_conflict'
  | 'idempotency_conflict'
  | 'introduction_resolved'
  | 'introduction_cap_reached'
  | 'response_deadline_passed'
  | 'conversation_closed'
  | 'message_rejected'
  | 'date_slot_unavailable'
  | 'venue_unavailable'
  | 'debrief_already_submitted'
  | 'verification_pending'
  | 'verification_rejected'
  | 'membership_inactive'
  | 'account_paused'
  | 'account_suspended'
  | 'account_banned'
  | 'rate_limited'
  | 'internal_error'
  | 'not_implemented'
  | 'network_error'
  | string;

type ApiErrorEnvelope = {
  error?: {
    code?: ApiErrorCode;
    message?: string;
    retryable?: boolean;
    request_id?: string;
    field_errors?: Record<string, string[]>;
  };
};

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  retryable: boolean;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;

  constructor(input: {
    status: number;
    code?: ApiErrorCode;
    message?: string;
    retryable?: boolean;
    requestId?: string;
    fieldErrors?: Record<string, string[]>;
  }) {
    super(input.message ?? 'The request could not be completed.');
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code ?? 'internal_error';
    this.retryable = input.retryable ?? false;
    this.requestId = input.requestId;
    this.fieldErrors = input.fieldErrors;
  }
}

const apiBaseUrlValue = process.env.EXPO_PUBLIC_API_BASE_URL;
const publishableKeyValue =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!apiBaseUrlValue || !publishableKeyValue) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_BASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
}

const apiBaseUrl: string = apiBaseUrlValue;
const publishableKey: string = publishableKeyValue;

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  accessToken: string;
  body?: unknown;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    apikey: publishableKey,
    Authorization: `Bearer ${options.accessToken}`,
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.idempotencyKey) {
    headers['X-Idempotency-Key'] = options.idempotencyKey;
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message:
        'Unable to reach Vouch. Check your connection and try again.',
      retryable: true,
    });
  }

  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    // Empty or malformed responses are handled below.
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
      fieldErrors: envelope?.error?.field_errors,
    });
  }

  return body as T;
}

export function apiGet<T>(
  path: string,
  accessToken: string,
): Promise<T> {
  return apiRequest<T>(path, {
    method: 'GET',
    accessToken,
  });
}

export function apiPost<TResponse, TBody = undefined>(
  path: string,
  accessToken: string,
  body?: TBody,
  idempotencyKey?: string,
  headers?: Record<string, string>,
): Promise<TResponse> {
  return apiRequest<TResponse>(path, {
    method: 'POST',
    accessToken,
    body,
    idempotencyKey,
    headers,
  });
}
