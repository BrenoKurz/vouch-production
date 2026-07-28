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

export type IntroductionsEnvelope = JsonResponse<
  paths['/introductions']['get'],
  200
>;

export type IntroductionEnvelope = JsonResponse<
  paths['/introductions/{id}']['get'],
  200
>;

export type AcceptIntroductionEnvelope = JsonResponse<
  paths['/introductions/{id}/accept']['post'],
  200
>;

export type PassIntroductionEnvelope = JsonResponse<
  paths['/introductions/{id}/pass']['post'],
  200
>;

export type Introduction = IntroductionEnvelope['data'];

export type IntroductionState =
  Introduction['member_state'];

export type IntroductionAction =
  Introduction['available_actions'][number];
