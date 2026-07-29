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

export type RegisterProfilePhotoEnvelope =
  paths["/members/me/profile/photos"]["post"]["responses"][200]["content"]["application/json"];

export type RegisterProfilePhotoRequest =
  paths["/members/me/profile/photos"]["post"]["requestBody"]["content"]["application/json"];

export type ApproveDossierEnvelope =
  paths["/members/me/intake/dossier/approve"]["post"]["responses"][200]["content"]["application/json"];

export type ApproveDossierRequest =
  paths["/members/me/intake/dossier/approve"]["post"]["requestBody"]["content"]["application/json"];

export type ProfilePhotoUploadRequest =
  paths["/uploads"]["post"]["requestBody"]["content"]["application/json"];

export type ProfilePhotoUploadEnvelope =
  paths["/uploads"]["post"]["responses"][201]["content"]["application/json"];

export type ProfilePhotoUploadCompleteRequest = NonNullable<
  paths["/uploads/{id}/complete"]["post"]["requestBody"]
>["content"]["application/json"];

export type ProfilePhotoUploadCompleteEnvelope =
  paths["/uploads/{id}/complete"]["post"]["responses"][200]["content"]["application/json"];

export type MemberIntake = IntakeEnvelope["data"];
export type IntakeAnswers = SubmitIntakeRequest["answers"];
export type IntakeDossier = NonNullable<MemberIntake["dossier"]>;
export type IntakeProfilePhoto = MemberIntake["profile_photos"][number];

export type LocalProfilePhotoAsset = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};
