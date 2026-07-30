import type { paths } from "@/generated/api-contract";

export type AiMatchmakingPreferencesEnvelope =
  paths["/members/me/ai-matchmaking"]["get"]["responses"][200]["content"]["application/json"];

export type AiMatchmakingPreferencesUpdateEnvelope =
  paths["/members/me/ai-matchmaking"]["patch"]["responses"][200]["content"]["application/json"];

export type AiMatchmakingPreferencesUpdateRequest =
  paths["/members/me/ai-matchmaking"]["patch"]["requestBody"]["content"]["application/json"];

export type AiMatchmakingPreferences =
  AiMatchmakingPreferencesEnvelope["data"];
