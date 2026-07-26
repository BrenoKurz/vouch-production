export type SafetyCategory =
  | 'harassment'
  | 'coercion'
  | 'threats'
  | 'physical_safety'
  | 'sexual_misconduct'
  | 'fraud'
  | 'impersonation'
  | 'other';

export type SafetyPriority = 'standard' | 'high' | 'urgent';

export type SafetyCaseState =
  | 'open'
  | 'assigned'
  | 'investigating'
  | 'resolved'
  | 'dismissed';

export type SafetyResolution =
  | 'dismissed'
  | 'no_action'
  | 'warning'
  | 'account_paused'
  | 'account_suspended'
  | 'account_banned';

export type LocalEvidenceAsset = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};

export type SafetyEvidence = {
  id: string;
  upload_id: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
  download_url: string | null;
};

export type MemberSafetyCase = {
  id: string;
  conversation_id: string;
  date_id: string | null;
  category: SafetyCategory;
  narrative: string;
  immediate_danger: boolean;
  priority: SafetyPriority;
  state: SafetyCaseState;
  resolution: SafetyResolution | null;
  resolved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  evidence: SafetyEvidence[];
};

export type SafetyCaseEnvelope = {
  data: MemberSafetyCase;
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};

export type SafetyCasesEnvelope = {
  data: MemberSafetyCase[];
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};

export type CreateSafetyCaseBody = {
  conversation_id: string;
  date_id: string | null;
  category: SafetyCategory;
  narrative: string;
  immediate_danger: boolean;
};

export type UploadReservation = {
  id: string;
  purpose: string;
  bucket: 'uploads';
  storage_path: string;
  upload_url: string;
  upload_token: string;
  expires_at: string;
  status: string;
};

export type UploadReservationEnvelope = {
  data: UploadReservation;
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};

export type UploadCompleteEnvelope = {
  data: {
    id: string;
    status: string;
    completed_at: string | null;
  };
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};
