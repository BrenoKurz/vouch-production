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

type ApplicationPost =
  paths['/applications']['post'];

export type ApplicationRequest =
  ApplicationPost['requestBody']['content']['application/json'];

export type ExistingApplicationEnvelope = JsonResponse<
  ApplicationPost,
  200
>;

export type CreatedApplicationEnvelope = JsonResponse<
  ApplicationPost,
  201
>;

export type ApplicationResponse =
  | ExistingApplicationEnvelope
  | CreatedApplicationEnvelope;

export type ApplicationEnvelope = JsonResponse<
  paths['/applications/me']['get'],
  200
>;

export type Application = ApplicationEnvelope['data'];

export type ApplicationStatus = Application['status'];
