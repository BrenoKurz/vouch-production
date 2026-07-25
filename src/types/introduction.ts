export type IntroductionState =
  | 'awaiting_your_response'
  | 'accepted_waiting'
  | 'mutual_ready'
  | 'conversation_open'
  | 'date_proposed'
  | 'date_confirmed'
  | 'debrief_pending'
  | 'completed'
  | 'passed'
  | 'timed_out'
  | 'kind_closed'
  | 'expired'
  | 'cancelled';

export type IntroductionAction =
  | 'accept'
  | 'pass'
  | 'open_conversation'
  | 'open_scheduler'
  | 'complete_debrief';

export type Introduction = {
  id: string;
  member_state: IntroductionState;
  version: number;
  profile_snapshot: {
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
  introduction_note: {
    body: string;
    approved_by_staff_id: string;
    approved_at: string;
  };
  delivered_at: string;
  response_deadline_at: string | null;
  conversation_id: string | null;
  date_id: string | null;
  slot: {
    occupied: boolean;
    penalty_release_at: string | null;
  };
  available_actions: IntroductionAction[];
};

export type IntroductionsEnvelope = {
  data: Introduction[];
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};
