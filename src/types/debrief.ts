import type { DateState, Venue } from '@/types/date';

export type DebriefState = 'pending' | 'submitted' | 'expired';

export type DebriefReasonTag =
  | 'chemistry_not_there'
  | 'different_values'
  | 'timing_or_lifestyle'
  | 'communication'
  | 'date_did_not_happen'
  | 'safety_concern'
  | 'other';

export type Debrief = {
  id: string;
  date_id: string;
  state: DebriefState;
  created_at: string;
  submitted_at: string | null;
  date_happened: boolean | null;
  see_again: boolean | null;
  reason_tag: DebriefReasonTag | null;
  private_note: string | null;
  date: {
    id: string;
    conversation_id: string;
    state: DateState;
    starts_at: string;
    venue_id: string | null;
    venue: Venue | null;
  };
  conversation_id: string;
  counterpart_profile: {
    first_name: string;
    age_display: number;
    neighborhood: string;
    photos: Array<{
      id: string;
      url: string;
    }>;
    prompts: Array<{
      id: string;
      question: string;
      answer: string;
    }>;
  };
};

export type DebriefEnvelope = {
  data: Debrief;
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};

export type DebriefsEnvelope = {
  data: Debrief[];
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};

export type DebriefSubmission = {
  date_happened: boolean;
  see_again?: boolean | null;
  reason_tag?: DebriefReasonTag | null;
  private_note?: string | null;
};
