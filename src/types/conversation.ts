export type ConversationState =
  | 'open'
  | 'closed_scheduled'
  | 'closed_passed'
  | 'closed_expired';

export type ConversationAction = 'propose_date';

export type ConversationMessage = {
  id: string;
  body: string;
  sent_at: string;
  is_mine: boolean;
  moderation_status: string;
};

export type Conversation = {
  id: string;
  state: ConversationState;
  raw_state: string;
  introduction_id: string;
  version: number;
  opened_at: string;
  expires_at: string;
  last_message_at: string | null;
  date_id: string | null;
  available_actions: ConversationAction[];
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
  messages: ConversationMessage[];
};

export type ConversationEnvelope = {
  data: Conversation;
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};

export type SentMessageEnvelope = {
  data: ConversationMessage & {
    conversation_version: number;
  };
  meta: {
    request_id: string;
    version: number;
    contract_version: string;
  };
};
