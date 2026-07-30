import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";

import { apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type {
  LocalProfilePhotoAsset,
  ProfilePhotoUploadCompleteEnvelope,
  ProfilePhotoUploadCompleteRequest,
  ProfilePhotoUploadEnvelope,
  ProfilePhotoUploadRequest,
  RegisterProfilePhotoEnvelope,
  RegisterProfilePhotoRequest,
} from "@/types/intake";

const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;

export async function uploadProfilePhoto(input: {
  accessToken: string;
  asset: LocalProfilePhotoAsset;
  version: number;
}): Promise<RegisterProfilePhotoEnvelope> {
  const { accessToken, asset, version } = input;
  const size = asset.size ?? 0;

  if (size > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error("Profile photos must be 10 MB or smaller.");
  }

  const contentType = asset.mimeType ?? "image/jpeg";

  if (!contentType.startsWith("image/")) {
    throw new Error("Choose an image for your profile photo.");
  }

  const reservation = await apiPost<
    ProfilePhotoUploadEnvelope,
    ProfilePhotoUploadRequest
  >(
    "/uploads",
    accessToken,
    {
      purpose: "profile_photo",
      content_type: contentType,
      filename: asset.name,
      size_bytes: asset.size ?? undefined,
    },
    Crypto.randomUUID(),
  );

  const file = new File(asset.uri);
  const bytes = await file.arrayBuffer();
  const uploadToken = reservation.data.upload_token;

  if (!uploadToken) {
    throw new Error("The profile-photo upload could not be authorized.");
  }

  const { error: uploadError } = await supabase.storage
    .from(reservation.data.bucket)
    .uploadToSignedUrl(reservation.data.storage_path, uploadToken, bytes, {
      contentType,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  await apiPost<
    ProfilePhotoUploadCompleteEnvelope,
    ProfilePhotoUploadCompleteRequest
  >(
    `/uploads/${encodeURIComponent(reservation.data.id)}/complete`,
    accessToken,
    {
      size_bytes: bytes.byteLength,
    },
    Crypto.randomUUID(),
  );

  return apiPost<RegisterProfilePhotoEnvelope, RegisterProfilePhotoRequest>(
    "/members/me/profile/photos",
    accessToken,
    {
      upload_id: reservation.data.id,
      is_primary: true,
    },
    Crypto.randomUUID(),
    {
      "If-Match": String(version),
    },
  );
}
