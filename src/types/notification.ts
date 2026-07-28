export type NotificationType =
  | 'new_introduction'
  | 'mutual_match'
  | 'new_message'
  | 'date_proposed'
  | 'date_confirmed'
  | 'date_cancelled'
  | 'date_rescheduled'
  | 'debrief_ready'
  | 'safety_report_received'
  | 'safety_case_updated';

export type NotificationEntityType =
  | 'introduction'
  | 'conversation'
  | 'message'
  | 'date'
  | 'debrief'
  | 'safety_case';

export type MemberNotification = {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  route: string;
  entity_type: NotificationEntityType;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type NotificationEnvelopeMeta = {
  request_id: string;
  version: number;
  contract_version: string;
};

export type NotificationsEnvelope = {
  data: MemberNotification[];
  meta: NotificationEnvelopeMeta;
};

export type NotificationEnvelope = {
  data: MemberNotification;
  meta: NotificationEnvelopeMeta;
};

export type NotificationUnreadCountEnvelope = {
  data: {
    unread_count: number;
  };
  meta: NotificationEnvelopeMeta;
};

export type MarkAllNotificationsReadEnvelope = {
  data: {
    updated_count: number;
  };
  meta: NotificationEnvelopeMeta;
};
