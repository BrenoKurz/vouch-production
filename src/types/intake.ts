import type { paths } from "@/generated/api-contract";

export type IntakeEnvelope =
  paths["/members/me/intake"]["get"]["responses"][200]["content"]["application/json"];

export type StartIntakeEnvelope =
  paths["/members/me/intake/sessions"]["post"]["responses"][200]["content"]["application/json"];

export type StartIntakeRequest =
  paths["/members/me/intake/sessions"]["post"]["requestBody"]["content"]["application/json"];

export type SubmitIntakeEnvelope =
  paths["/members/me/intake/sessions/{session_id}/submit"]["post"]["responses"][200]["content"]["application/json"];

export type SubmitIntakeRequest =
  paths["/members/me/intake/sessions/{session_id}/submit"]["post"]["requestBody"]["content"]["application/json"];

export type MemberIntake = IntakeEnvelope["data"];
export type IntakeAnswers = SubmitIntakeRequest["answers"];
export type IntakeDossier = NonNullable<MemberIntake["dossier"]>;
