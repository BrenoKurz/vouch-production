import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { apiPost } from '@/lib/api';
import type {
  LocalEvidenceAsset,
  SafetyCaseEnvelope,
  UploadCompleteEnvelope,
  UploadReservationEnvelope,
} from '@/types/safety';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!apiBaseUrl || !publishableKey) {
  throw new Error(
    'Missing Vouch API or Supabase publishable-key configuration.',
  );
}

const supabaseUrl = apiBaseUrl.replace(
  /\/functions\/v1\/api-v1\/?$/,
  '',
);

const storageClient = createClient(
  supabaseUrl,
  publishableKey,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  },
);

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export async function attachSafetyEvidence(input: {
  caseId: string;
  asset: LocalEvidenceAsset;
  accessToken: string;
}): Promise<SafetyCaseEnvelope> {
  const { caseId, asset, accessToken } = input;
  const size = asset.size ?? 0;

  if (size > MAX_EVIDENCE_BYTES) {
    throw new Error('Evidence files must be 10 MB or smaller.');
  }

  const contentType =
    asset.mimeType ?? 'application/octet-stream';

  const reservation = await apiPost<
    UploadReservationEnvelope,
    {
      purpose: 'safety_evidence';
      content_type: string;
      filename: string;
      size_bytes: number | null;
    }
  >(
    '/uploads',
    accessToken,
    {
      purpose: 'safety_evidence',
      content_type: contentType,
      filename: asset.name,
      size_bytes: asset.size ?? null,
    },
    Crypto.randomUUID(),
  );

  const file = new File(asset.uri);
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await storageClient.storage
    .from(reservation.data.bucket)
    .uploadToSignedUrl(
      reservation.data.storage_path,
      reservation.data.upload_token,
      bytes,
      {
        contentType,
      },
    );

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  await apiPost<
    UploadCompleteEnvelope,
    { size_bytes: number }
  >(
    `/uploads/${encodeURIComponent(
      reservation.data.id,
    )}/complete`,
    accessToken,
    {
      size_bytes: bytes.byteLength,
    },
    Crypto.randomUUID(),
  );

  return apiPost<
    LocalEvidenceAsset,
  SafetyCaseEnvelope,
    { upload_id: string }
  >(
    `/safety-cases/${encodeURIComponent(caseId)}/evidence`,
    accessToken,
    {
      upload_id: reservation.data.id,
    },
    Crypto.randomUUID(),
  );
}
