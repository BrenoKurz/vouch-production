import type { paths } from "@/generated/api-contract";

export type VerificationEnvelope =
  paths["/members/me/verification"]["get"]["responses"][200]["content"]["application/json"];

export type StartVerificationEnvelope =
  paths["/members/me/verification"]["post"]["responses"][200]["content"]["application/json"];

export type StartVerificationRequest =
  paths["/members/me/verification"]["post"]["requestBody"]["content"]["application/json"];

export type MemberVerification = VerificationEnvelope["data"];
export type VerificationState = MemberVerification["verification_state"];
export type VerificationSession = NonNullable<
  MemberVerification["latest_session"]
>;
