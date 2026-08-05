import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type {
  DisablePushDevicesEnvelope,
  PushSettings,
  PushSettingsEnvelope,
  RegisterPushDeviceEnvelope,
} from "@/types/push-notification";

const PUSH_CHANNEL_ID = "vouch-updates";

export class PushRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushRegistrationError";
  }
}

function getEasProjectId(): string {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (typeof projectId !== "string" || projectId.length === 0) {
    throw new PushRegistrationError(
      "This build is missing its Vouch notification project ID. Install the latest build and try again.",
    );
  }

  return projectId;
}

async function prepareAndroidChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: "Vouch updates",
    description: "Private alerts that a new update is waiting inside Vouch.",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#713F36",
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function getPushSettings(accessToken: string): Promise<PushSettings> {
  const response = await apiGet<PushSettingsEnvelope>(
    "/members/me/push-settings",
    accessToken,
  );
  return response.data;
}
export async function registerForPushNotifications(
  accessToken: string,
  options: { requestPermission: boolean },
): Promise<PushSettings | null> {
  if (Platform.OS === "web") {
    if (!options.requestPermission) return null;
    throw new PushRegistrationError(
      "Native push notifications are available in the iPhone and Android apps.",
    );
  }

  if (!Device.isDevice) {
    if (!options.requestPermission) return null;
    throw new PushRegistrationError(
      "Push notifications require a physical phone and a Vouch development or production build.",
    );
  }

  await prepareAndroidChannel();

  let permission = await Notifications.getPermissionsAsync();
  if (
    permission.status !== Notifications.PermissionStatus.GRANTED &&
    options.requestPermission
  ) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (permission.status !== Notifications.PermissionStatus.GRANTED) {
    if (!options.requestPermission) return null;
    throw new PushRegistrationError(
      "Push permission is off. Enable notifications for Vouch in your phone settings, then try again.",
    );
  }

  let expoPushToken: string;
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: getEasProjectId(),
    });
    expoPushToken = token.data;
  } catch {
    throw new PushRegistrationError(
      "This build cannot register for push yet. Install the latest Vouch development or production build and try again.",
    );
  }

  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }

  const response = await apiPost<
    RegisterPushDeviceEnvelope,
    { expo_push_token: string; platform: "ios" | "android" }
  >(
    "/members/me/push-devices",
    accessToken,
    { expo_push_token: expoPushToken, platform: Platform.OS },
    Crypto.randomUUID(),
  );

  return response.data;
}

export async function disablePushNotifications(
  accessToken: string,
): Promise<PushSettings> {
  const response = await apiDelete<DisablePushDevicesEnvelope>(
    "/members/me/push-devices",
    accessToken,
    Crypto.randomUUID(),
  );
  return response.data;
}
