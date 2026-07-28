import type { paths } from '@/generated/api-contract';

type JsonResponse<
  TOperation,
  TStatus extends number,
> = TOperation extends {
  responses: infer TResponses;
}
  ? TStatus extends keyof TResponses
    ? TResponses[TStatus] extends {
        content: {
          'application/json': infer TBody;
        };
      }
      ? TBody
      : never
    : never
  : never;

export type NotificationsEnvelope = JsonResponse<
  paths['/notifications']['get'],
  200
>;

export type NotificationEnvelope = JsonResponse<
  paths['/notifications/{id}/read']['post'],
  200
>;

export type NotificationUnreadCountEnvelope = JsonResponse<
  paths['/notifications/unread-count']['get'],
  200
>;

export type MarkAllNotificationsReadEnvelope = JsonResponse<
  paths['/notifications/read-all']['post'],
  200
>;

export type MemberNotification =
  NotificationsEnvelope['data'][number];

export type NotificationType =
  MemberNotification['notification_type'];

export type NotificationEntityType =
  MemberNotification['entity_type'];
