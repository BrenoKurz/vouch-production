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

export type PrivacyRequestsEnvelope = JsonResponse<
  paths["/members/me/privacy-requests"]["get"],
  200
>;

export type PrivacyRequestEnvelope = JsonResponse<
  paths["/members/me/privacy-requests"]["post"],
  201
>;

export type CancelPrivacyRequestEnvelope = JsonResponse<
  paths["/members/me/privacy-requests/{id}/cancel"]["post"],
  200
>;

export type PrivacyRequest = PrivacyRequestsEnvelope["data"][number];
export type PrivacyRequestType = PrivacyRequest["request_type"];
export type SubmitPrivacyRequestBody = {
  request_type: PrivacyRequestType;
};
