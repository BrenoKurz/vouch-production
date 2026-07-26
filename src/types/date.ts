export type DateState =
  | 'proposed'
  | 'confirmed'
  | 'cancelled'
  | 'scheduled_time_passed'
  | 'debrief_pending'
  | 'completed'
  | 'disputed';

export type Venue = {
  id: string;
  name: string;
  neighborhood: string | null;
  address_public: string | null;
};

export type VouchDate = {
  id: string;
  conversation_id: string;
  state: DateState;
  version: number;
  proposed_at: string;
  starts_at: string;
  venue_id: string | null;
  venue: Venue | null;
  my_confirmed: boolean;
  can_confirm: boolean;
  reschedule_count: number;
  can_cancel: boolean;
  can_reschedule: boolean;
  cancelled_by_me: boolean;
  debrief_id: string | null;
  debrief_state: 'pending' | 'submitted' | 'expired' | null;
  can_complete_debrief: boolean;
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

export type DateEnvelope = {
  data: VouchDate;
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};

export type DatesEnvelope = {
  data: VouchDate[];
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};

export type VenuesEnvelope = {
  data: Venue[];
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};
