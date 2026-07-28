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

type JsonRequest<TOperation> =
  TOperation extends {
    requestBody: {
      content: {
        'application/json': infer TBody;
      };
    };
  }
    ? TBody
    : TOperation extends {
          requestBody?: {
            content: {
              'application/json': infer TBody;
            };
          };
        }
      ? TBody
      : never;

export type DatesEnvelope = JsonResponse<
  paths['/dates']['get'],
  200
>;

export type DateEnvelope = JsonResponse<
  paths['/dates/{id}']['get'],
  200
>;

export type VenuesEnvelope = JsonResponse<
  paths['/venues']['get'],
  200
>;

export type ProposedDateEnvelope = JsonResponse<
  paths['/conversations/{id}/dates']['post'],
  201
>;

export type ConfirmedDateEnvelope = JsonResponse<
  paths['/dates/{id}/confirm']['post'],
  200
>;

export type CancelledDateEnvelope = JsonResponse<
  paths['/dates/{id}/cancel']['post'],
  200
>;

export type RescheduledDateEnvelope = JsonResponse<
  paths['/dates/{id}/reschedule']['post'],
  200
>;

export type DateProposalRequest = JsonRequest<
  paths['/conversations/{id}/dates']['post']
>;

export type DateCancellationRequest = JsonRequest<
  paths['/dates/{id}/cancel']['post']
>;

export type DateRescheduleRequest = JsonRequest<
  paths['/dates/{id}/reschedule']['post']
>;

export type VouchDate = DateEnvelope['data'];

export type DateState = VouchDate['state'];

export type Venue = VenuesEnvelope['data'][number];
