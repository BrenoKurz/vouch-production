import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import { apiDelete, apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type {
  ProfilePhotoUploadCompleteEnvelope,
  ProfilePhotoUploadCompleteRequest,
  ProfilePhotoUploadEnvelope,
  ProfilePhotoUploadRequest,
} from "@/types/intake";
import type {
  ProcessVoiceIntakeRequest,
  VoiceIntakeReflectionEnvelope,
} from "@/types/voice-intake";

const MAX_VOICE_BYTES = 25 * 1024 * 1024;

function recordingMetadata(uri: string) {
  const isWebM =
    Platform.OS === "web" || uri.toLocaleLowerCase().endsWith(".webm");
  return {
    contentType: isWebM ? "audio/webm" : "audio/mp4",
    filename: `vouch-reflection-${Date.now()}.${isWebM ? "webm" : "m4a"}`,
  };
}

export function deleteLocalVoiceRecording(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best-effort; the OS also manages the recording cache.
  }
}

export async function uploadAndProcessVoiceIntake(input: {
  accessToken: string;
  uri: string;
}): Promise<VoiceIntakeReflectionEnvelope> {
  const { accessToken, uri } = input;
  const file = new File(uri);
  const bytes = await file.arrayBuffer();
  const metadata = recordingMetadata(uri);

  if (bytes.byteLength <= 0) {
    throw new Error(
      "That recording is empty. Please record your reflection again.",
    );
  }
  if (bytes.byteLength > MAX_VOICE_BYTES) {
    throw new Error("Voice reflections must be 25 MB or smaller.");
  }

  const reservation = await apiPost<
    ProfilePhotoUploadEnvelope,
    ProfilePhotoUploadRequest
  >(
    "/uploads",
    accessToken,
    {
      purpose: "intake_voice",
      content_type: metadata.contentType,
      filename: metadata.filename,
      size_bytes: bytes.byteLength,
    },
    Crypto.randomUUID(),
  );

  try {
    const uploadToken = reservation.data.upload_token;
    if (!uploadToken)
      throw new Error("The private voice upload could not be authorized.");

    const { error: uploadError } = await supabase.storage
      .from(reservation.data.bucket)
      .uploadToSignedUrl(reservation.data.storage_path, uploadToken, bytes, {
        contentType: metadata.contentType,
      });
    if (uploadError) throw new Error(uploadError.message);

    await apiPost<
      ProfilePhotoUploadCompleteEnvelope,
      ProfilePhotoUploadCompleteRequest
    >(
      `/uploads/${encodeURIComponent(reservation.data.id)}/complete`,
      accessToken,
      { size_bytes: bytes.byteLength },
      Crypto.randomUUID(),
    );

    const request: ProcessVoiceIntakeRequest = {
      upload_id: reservation.data.id,
    };
    return await apiPost<
      VoiceIntakeReflectionEnvelope,
      ProcessVoiceIntakeRequest
    >("/members/me/intake/voice", accessToken, request, Crypto.randomUUID());
  } catch (error) {
    try {
      await apiDelete(
        `/uploads/${encodeURIComponent(reservation.data.id)}`,
        accessToken,
        Crypto.randomUUID(),
      );
    } catch {
      // The processing endpoint may already have securely deleted the upload.
    }
    throw error;
  } finally {
    deleteLocalVoiceRecording(uri);
  }
}
