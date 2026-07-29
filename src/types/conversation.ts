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

export type ConversationEnvelope = JsonResponse<
  paths['/conversations/{id}']['get'],
  200
>;

export type SentMessageEnvelope = JsonResponse<
  paths['/conversations/{id}/messages']['post'],
  201
>;

export type ClosedConversationEnvelope = JsonResponse<
  paths['/conversations/{id}/close']['post'],
  200
>;

export type Conversation = ConversationEnvelope['data'];

export type ConversationState = Conversation['state'];

export type ConversationAction =
  Conversation['available_actions'][number];

export type ConversationMessage =
  Conversation['messages'][number];

export type ConversationCloseRequest = NonNullable<
  paths['/conversations/{id}/close']['post']['requestBody']
>['content']['application/json'];
