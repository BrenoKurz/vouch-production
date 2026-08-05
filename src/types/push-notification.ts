import type { paths } from "@/generated/api-contract";

type JsonResponse<TOperation, TStatus extends number> = TOperation extends {
  responses: infer TResponses;
}
  ? TStatus extends keyof TResponses
    ? TResponses[TStatus] extends {
        content: { "application/json": infer TBody };
      }
      ? TBody
      : never
    : never
  : never;

export type PushSettingsEnvelope = JsonResponse<
  paths["/members/me/push-settings"]["get"],
  200
>;

export type RegisterPushDeviceEnvelope = JsonResponse<
  paths["/members/me/push-devices"]["post"],
  201
>;

export type DisablePushDevicesEnvelope = JsonResponse<
  paths["/members/me/push-devices"]["delete"],
  200
>;

export type PushSettings = PushSettingsEnvelope["data"];
