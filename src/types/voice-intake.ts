import type { paths } from "@/generated/api-contract";

export type VoiceIntakeStatusEnvelope =
  paths["/members/me/intake/voice"]["get"]["responses"][200]["content"]["application/json"];

export type ProcessVoiceIntakeRequest =
  paths["/members/me/intake/voice"]["post"]["requestBody"]["content"]["application/json"];

export type VoiceIntakeReflectionEnvelope =
  paths["/members/me/intake/voice"]["post"]["responses"][201]["content"]["application/json"];

export type ConfirmVoiceIntakeRequest =
  paths["/members/me/intake/voice/{reflection_id}/confirm"]["post"]["requestBody"]["content"]["application/json"];

export type ConfirmVoiceIntakeEnvelope =
  paths["/members/me/intake/voice/{reflection_id}/confirm"]["post"]["responses"][200]["content"]["application/json"];

export type DiscardVoiceIntakeEnvelope =
  paths["/members/me/intake/voice/{reflection_id}"]["delete"]["responses"][200]["content"]["application/json"];

export type VoiceIntakeReflection = VoiceIntakeReflectionEnvelope["data"];
export type VoiceIntakeAnswers = ConfirmVoiceIntakeRequest["answers"];
