import type { paths } from "@/generated/api-contract";

export type ProfileEnvelope =
  paths["/members/me/profile"]["get"]["responses"][200]["content"]["application/json"];

export type ProfileUpdateEnvelope =
  paths["/members/me/profile"]["patch"]["responses"][200]["content"]["application/json"];

export type ProfileUpdateRequest =
  paths["/members/me/profile"]["patch"]["requestBody"]["content"]["application/json"];

export type MemberProfile = ProfileEnvelope["data"];

export type MemberProfilePrompt = MemberProfile["prompts"][number];

export type ProfileVerificationState = MemberProfile["verification_state"];

export type ProfileIntakeState = MemberProfile["intake"]["state"];
