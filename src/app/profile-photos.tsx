import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AppButton,
  AppScreen,
  ErrorState,
  InlineNotice,
  LoadingState,
  StackHeader,
  StatusPill,
} from "@/components/vouch-ui";
import {
  layout,
  palette,
  radius,
  shadow,
  space,
  typography,
} from "@/constants/design";
import { ApiError, apiGet } from "@/lib/api";
import {
  deleteProfilePhoto,
  updateProfilePhoto,
  uploadProfilePhoto,
} from "@/lib/profile-photos";
import { useAuth } from "@/providers/auth-provider";
import type {
  IntakeEnvelope,
  IntakeProfilePhoto,
  LocalProfilePhotoAsset,
  MemberIntake,
} from "@/types/intake";

type PhotoSource = "camera" | "library";

const PHOTO_COACHING = [
  {
    icon: "happy-outline" as const,
    title: "Lead with your face",
    body: "Use a clear solo photo where your face is easy to recognize.",
  },
  {
    icon: "sunny-outline" as const,
    title: "Choose natural light",
    body: "Even lighting makes your photo feel warm, recent, and authentic.",
  },
  {
    icon: "body-outline" as const,
    title: "Show the real you",
    body: "Avoid heavy filters, sunglasses, or a crop that hides your face.",
  },
  {
    icon: "images-outline" as const,
    title: "Keep it current",
    body: "Pick a photo that still looks like you when you arrive for a date.",
  },
];

function photoStatus(photo?: IntakeProfilePhoto) {
  if (!photo) {
    return {
      title: "Add your primary photo",
      body: "This is the first photo members see in a Vouch introduction.",
      label: "Missing",
      tone: "warning" as const,
      icon: "camera-outline" as const,
    };
  }

  if (
    photo.screen_status === "pass" ||
    photo.screen_status === "override_pass"
  ) {
    return {
      title: "Primary photo approved",
      body: "Your photo is ready to appear in curated introductions.",
      label: "Approved",
      tone: "positive" as const,
      icon: "checkmark-circle-outline" as const,
    };
  }

  if (photo.screen_status === "pending") {
    return {
      title: "Photo under review",
      body: "The Vouch team is checking quality and authenticity before it appears.",
      label: "In review",
      tone: "brand" as const,
      icon: "time-outline" as const,
    };
  }

  return {
    title: "Choose a different photo",
    body:
      photo.screen_reason ||
      "This photo needs attention before it can appear in introductions.",
    label: "Needs update",
    tone: "danger" as const,
    icon: "alert-circle-outline" as const,
  };
}

function toLocalAsset(
  asset: ImagePicker.ImagePickerAsset,
): LocalProfilePhotoAsset {
  return {
    uri: asset.uri,
    name: asset.fileName ?? `vouch-profile-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize ?? null,
  };
}

export default function ProfilePhotosScreen() {
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [intake, setIntake] = useState<MemberIntake | null>(null);
  const [selectedPhoto, setSelectedPhoto] =
    useState<LocalProfilePhotoAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPicking, setIsPicking] = useState<PhotoSource | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) {
      setErrorMessage("Your session has expired. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await apiGet<IntakeEnvelope>(
        "/members/me/intake",
        accessToken,
      );
      setIntake(response.data);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.code === "authentication_required")
      ) {
        await signOut();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not load your profile photos.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    void ImagePicker.getPendingResultAsync().then((result) => {
      if (
        result &&
        "canceled" in result &&
        !result.canceled &&
        result.assets[0]
      ) {
        setSelectedPhoto(toLocalAsset(result.assets[0]));
      }
    }).catch(() => {
      setErrorMessage(
        "Android could not restore the last photo selection. Please choose it again.",
      );
    });
  }, []);

  const primaryPhoto = useMemo(
    () =>
      intake?.profile_photos.find((photo) => photo.is_primary) ??
      intake?.profile_photos[0],
    [intake?.profile_photos],
  );
  const orderedPhotos = useMemo(
    () =>
      (intake?.profile_photos ?? [])
        .slice()
        .sort((a, b) => a.ordering - b.ordering),
    [intake?.profile_photos],
  );
  const status = photoStatus(primaryPhoto);

  async function choosePhoto(source: PhotoSource) {
    if (isPicking || isUploading) {
      return;
    }

    setIsPicking(source);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (source === "camera" && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          setErrorMessage(
            "Camera access is needed only when you choose to take a new profile photo.",
          );
          return;
        }
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 5],
              mediaTypes: ["images"],
              quality: 0.88,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [4, 5],
              mediaTypes: ["images"],
              quality: 0.88,
            });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setSelectedPhoto(toLocalAsset(result.assets[0]));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not open your photos.",
      );
    } finally {
      setIsPicking(null);
    }
  }

  async function saveSelectedPhoto() {
    if (
      !accessToken ||
      !intake ||
      !selectedPhoto ||
      isUploading
    ) {
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await uploadProfilePhoto({
        accessToken,
        asset: selectedPhoto,
        version: intake.version,
        isPrimary: intake.profile_photos.length === 0,
      });

      setIntake(response.data);
      setSelectedPhoto(null);
      setSuccessMessage(
        intake.profile_photos.length === 0
          ? "Your primary photo was uploaded and sent for private review."
          : "Your photo was added to the private gallery and sent for review.",
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setErrorMessage(
          "Your profile changed while the photo was uploading. We refreshed it; please try once more.",
        );
        await load();
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not upload your profile photo.",
        );
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function changePhoto(
    photo: IntakeProfilePhoto,
    body: { make_primary?: true; ordering?: number },
    success: string,
  ) {
    if (!accessToken || !intake || busyPhotoId || isUploading) {
      return;
    }

    setBusyPhotoId(photo.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await updateProfilePhoto({
        accessToken,
        photoId: photo.id,
        version: intake.version,
        body,
      });
      setIntake(response.data);
      setSuccessMessage(success);
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setErrorMessage(
          "Your gallery changed on another screen. We refreshed it; please try again.",
        );
        await load();
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not update that photo.",
        );
      }
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function removePhoto(photo: IntakeProfilePhoto) {
    if (!accessToken || !intake || busyPhotoId || isUploading) {
      return;
    }

    setBusyPhotoId(photo.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await deleteProfilePhoto({
        accessToken,
        photoId: photo.id,
        version: intake.version,
      });
      setIntake(response.data);
      setSuccessMessage("The photo was removed from your private gallery.");
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setErrorMessage(
          "Your gallery changed on another screen. We refreshed it; please try again.",
        );
        await load();
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not remove that photo.",
        );
      }
    } finally {
      setBusyPhotoId(null);
    }
  }

  function confirmRemove(photo: IntakeProfilePhoto) {
    Alert.alert(
      "Remove this photo?",
      "It will disappear from your private gallery and future introductions.",
      [
        { text: "Keep photo", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void removePhoto(photo),
        },
      ],
    );
  }

  if (isLoading && !intake) {
    return (
      <AppScreen includeBottomInset>
        <StackHeader title="Profile photos" />
        <LoadingState label="Opening your private photo manager…" />
      </AppScreen>
    );
  }

  if (!intake) {
    return (
      <AppScreen includeBottomInset>
        <StackHeader title="Profile photos" />
        <ErrorState
          body={errorMessage || "We could not load your photos."}
          onRetry={() => void load()}
          title="Photo manager unavailable"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen includeBottomInset>
      <StackHeader title="Profile photos" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>YOUR FIRST IMPRESSION</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Look like yourself,{"\n"}on your best day.
        </Text>
        <Text style={styles.subtitle}>
          Photos stay private during review and are only shared through
          approved Vouch introductions.
        </Text>

        {errorMessage ? (
          <InlineNotice message={errorMessage} tone="danger" />
        ) : null}
        {successMessage ? (
          <InlineNotice message={successMessage} tone="positive" />
        ) : null}

        <View style={styles.photoPanel}>
          <View style={styles.panelTop}>
            <StatusPill label={status.label} tone={status.tone} />
            <Text style={styles.photoCount}>
              {intake.profile_photos.length}{" "}
              {intake.profile_photos.length === 1 ? "photo" : "photos"} uploaded
            </Text>
          </View>

          <View style={styles.previewFrame}>
            {selectedPhoto ? (
              <Image
                accessibilityLabel="Selected profile photo preview"
                source={{ uri: selectedPhoto.uri }}
                style={styles.preview}
              />
            ) : primaryPhoto?.url ? (
              <Image
                accessibilityLabel="Your stored profile photo"
                source={{ uri: primaryPhoto.url }}
                style={styles.preview}
              />
            ) : (
              <View style={styles.privatePreview}>
                <View style={styles.privateIcon}>
                  <Ionicons
                    color={palette.brand}
                    name={status.icon}
                    size={32}
                  />
                </View>
                <Text style={styles.privateLabel}>PRIVATE PROFILE PHOTO</Text>
                <Text style={styles.privateBody}>
                  {primaryPhoto
                    ? "Your stored photo remains protected while Vouch reviews and serves it."
                    : "Choose a portrait to preview it here before uploading."}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.statusTitle}>
            {selectedPhoto ? "Ready to upload?" : status.title}
          </Text>
          <Text style={styles.statusBody}>
            {selectedPhoto
              ? "Check the crop and make sure this still looks unmistakably like you."
              : status.body}
          </Text>

          {selectedPhoto ? (
            <View style={styles.previewActions}>
              <AppButton
                disabled={isUploading}
                label="Choose another"
                onPress={() => setSelectedPhoto(null)}
                variant="secondary"
              />
              <AppButton
                loading={isUploading}
                label={
                  primaryPhoto ? "Add to private gallery" : "Use this photo"
                }
                onPress={() => void saveSelectedPhoto()}
              />
            </View>
          ) : (
            <View style={styles.sourceActions}>
              <AppButton
                disabled={
                  Boolean(isPicking) || intake.profile_photos.length >= 6
                }
                icon="camera-outline"
                label={
                  intake.profile_photos.length >= 6
                    ? "Gallery full"
                    : isPicking === "camera"
                      ? "Opening…"
                      : "Take photo"
                }
                onPress={() => void choosePhoto("camera")}
                variant="secondary"
              />
              <AppButton
                disabled={
                  Boolean(isPicking) || intake.profile_photos.length >= 6
                }
                icon="images-outline"
                label={
                  intake.profile_photos.length >= 6
                    ? "Remove one to add"
                    : isPicking === "library"
                      ? "Opening…"
                      : "Choose from library"
                }
                onPress={() => void choosePhoto("library")}
              />
            </View>
          )}
        </View>

        <View style={styles.coachSection}>
          <Text style={styles.sectionEyebrow}>VOUCH PHOTO COACH</Text>
          <Text style={styles.sectionTitle}>What makes a strong primary</Text>
          <View style={styles.coachGrid}>
            {PHOTO_COACHING.map((item) => (
              <View key={item.title} style={styles.coachCard}>
                <View style={styles.coachIcon}>
                  <Ionicons
                    color={palette.sage}
                    name={item.icon}
                    size={21}
                  />
                </View>
                <Text style={styles.coachTitle}>{item.title}</Text>
                <Text style={styles.coachBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        </View>

        {intake.profile_photos.length > 0 ? (
          <View style={styles.gallerySection}>
            <Text style={styles.sectionEyebrow}>YOUR PRIVATE GALLERY</Text>
            <Text style={styles.sectionTitle}>Choose the story you show</Text>
            <Text style={styles.galleryIntro}>
              Add up to six photos, choose an approved primary, and arrange
              the order used in future introductions.
            </Text>
            <View style={styles.galleryGrid}>
              {orderedPhotos.map((photo, index) => {
                const copy = photoStatus(photo);
                const isApproved =
                  photo.screen_status === "pass" ||
                  photo.screen_status === "override_pass";
                const isBusy = busyPhotoId === photo.id;

                return (
                  <View key={photo.id} style={styles.galleryCard}>
                    <View style={styles.galleryImageFrame}>
                      {photo.url ? (
                        <Image
                          accessibilityLabel={`Private gallery photo ${index + 1}`}
                          source={{ uri: photo.url }}
                          style={styles.galleryImage}
                        />
                      ) : (
                        <View style={styles.galleryImageFallback}>
                          <Ionicons
                            color={palette.brand}
                            name="image-outline"
                            size={28}
                          />
                        </View>
                      )}
                      <View style={styles.galleryPosition}>
                        <Text style={styles.galleryPositionText}>{index + 1}</Text>
                      </View>
                    </View>

                    <View style={styles.galleryMeta}>
                      <Text style={styles.galleryLabel}>
                        {photo.is_primary ? "Primary photo" : `Photo ${index + 1}`}
                      </Text>
                      <StatusPill label={copy.label} tone={copy.tone} />
                    </View>

                    {!photo.is_primary && isApproved ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={Boolean(busyPhotoId) || isUploading}
                        onPress={() =>
                          void changePhoto(
                            photo,
                            { make_primary: true },
                            "Your approved primary photo was updated.",
                          )
                        }
                        style={({ pressed }) => [
                          styles.primaryAction,
                          pressed && styles.galleryActionPressed,
                          (Boolean(busyPhotoId) || isUploading) &&
                            styles.galleryActionDisabled,
                        ]}
                      >
                        <Ionicons
                          color={palette.brand}
                          name="star-outline"
                          size={17}
                        />
                        <Text style={styles.primaryActionText}>
                          {isBusy ? "Updating…" : "Make primary"}
                        </Text>
                      </Pressable>
                    ) : null}

                    <View style={styles.galleryActions}>
                      <Pressable
                        accessibilityLabel={`Move photo ${index + 1} earlier`}
                        accessibilityRole="button"
                        disabled={
                          index === 0 || Boolean(busyPhotoId) || isUploading
                        }
                        onPress={() =>
                          void changePhoto(
                            photo,
                            { ordering: index - 1 },
                            "Your gallery order was updated.",
                          )
                        }
                        style={({ pressed }) => [
                          styles.iconAction,
                          pressed && styles.galleryActionPressed,
                          (index === 0 || Boolean(busyPhotoId) || isUploading) &&
                            styles.galleryActionDisabled,
                        ]}
                      >
                        <Ionicons
                          color={palette.ink}
                          name="chevron-back"
                          size={19}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Move photo ${index + 1} later`}
                        accessibilityRole="button"
                        disabled={
                          index === orderedPhotos.length - 1 ||
                          Boolean(busyPhotoId) ||
                          isUploading
                        }
                        onPress={() =>
                          void changePhoto(
                            photo,
                            { ordering: index + 1 },
                            "Your gallery order was updated.",
                          )
                        }
                        style={({ pressed }) => [
                          styles.iconAction,
                          pressed && styles.galleryActionPressed,
                          (index === orderedPhotos.length - 1 ||
                            Boolean(busyPhotoId) ||
                            isUploading) &&
                            styles.galleryActionDisabled,
                        ]}
                      >
                        <Ionicons
                          color={palette.ink}
                          name="chevron-forward"
                          size={19}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Remove photo ${index + 1}`}
                        accessibilityRole="button"
                        disabled={Boolean(busyPhotoId) || isUploading}
                        onPress={() => confirmRemove(photo)}
                        style={({ pressed }) => [
                          styles.iconAction,
                          styles.removeAction,
                          pressed && styles.galleryActionPressed,
                          (Boolean(busyPhotoId) || isUploading) &&
                            styles.galleryActionDisabled,
                        ]}
                      >
                        <Ionicons
                          color={palette.danger}
                          name="trash-outline"
                          size={18}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.privacyCard}>
          <Ionicons
            color={palette.sage}
            name="shield-checkmark-outline"
            size={23}
          />
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Human-reviewed, never public</Text>
            <Text style={styles.privacyBody}>
              Your photo is stored privately and only appears in introductions
              approved by the Vouch team.
            </Text>
          </View>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    width: "100%",
  },
  eyebrow: {
    color: palette.brand,
    ...typography.label,
  },
  title: {
    color: palette.ink,
    marginTop: space.sm,
    ...typography.display,
  },
  subtitle: {
    color: palette.muted,
    marginBottom: space.lg,
    marginTop: space.sm,
    maxWidth: 580,
    ...typography.body,
  },
  photoPanel: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: space.lg,
    padding: space.md,
    ...shadow,
  },
  panelTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  photoCount: {
    color: palette.muted,
    ...typography.caption,
  },
  previewFrame: {
    aspectRatio: 4 / 5,
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.md,
    maxHeight: 540,
    overflow: "hidden",
    width: "100%",
  },
  preview: {
    height: "100%",
    resizeMode: "cover",
    width: "100%",
  },
  privatePreview: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: space.xl,
  },
  privateIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.pill,
    height: 70,
    justifyContent: "center",
    width: 70,
  },
  privateLabel: {
    color: palette.brand,
    marginTop: space.lg,
    ...typography.label,
  },
  privateBody: {
    color: palette.muted,
    marginTop: space.xs,
    maxWidth: 360,
    textAlign: "center",
    ...typography.small,
  },
  statusTitle: {
    color: palette.ink,
    marginTop: space.lg,
    ...typography.heading,
  },
  statusBody: {
    color: palette.muted,
    marginTop: space.xs,
    ...typography.body,
  },
  sourceActions: {
    gap: space.sm,
    marginTop: space.lg,
  },
  previewActions: {
    gap: space.sm,
    marginTop: space.lg,
  },
  coachSection: {
    marginTop: space.xxxl,
  },
  sectionEyebrow: {
    color: palette.brand,
    ...typography.label,
  },
  sectionTitle: {
    color: palette.ink,
    marginTop: space.xs,
    ...typography.heading,
  },
  coachGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.md,
  },
  coachCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: 240,
    flexGrow: 1,
    minWidth: 0,
    padding: space.md,
  },
  coachIcon: {
    alignItems: "center",
    backgroundColor: palette.sageSoft,
    borderRadius: radius.sm,
    height: 40,
    justifyContent: "center",
    marginBottom: space.sm,
    width: 40,
  },
  coachTitle: {
    color: palette.ink,
    ...typography.bodyStrong,
  },
  coachBody: {
    color: palette.muted,
    marginTop: space.xxs,
    ...typography.small,
  },
  gallerySection: {
    marginTop: space.xxxl,
  },
  galleryIntro: {
    color: palette.muted,
    marginTop: space.xs,
    maxWidth: 620,
    ...typography.body,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.lg,
  },
  galleryCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: 250,
    flexGrow: 1,
    maxWidth: 420,
    minWidth: 0,
    overflow: "hidden",
    padding: space.sm,
  },
  galleryImageFrame: {
    aspectRatio: 4 / 5,
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.sm,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  galleryImage: {
    height: "100%",
    resizeMode: "cover",
    width: "100%",
  },
  galleryImageFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  galleryPosition: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    left: space.sm,
    position: "absolute",
    top: space.sm,
    width: 28,
  },
  galleryPositionText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  galleryMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    justifyContent: "space-between",
    marginTop: space.sm,
  },
  galleryLabel: {
    color: palette.ink,
    flex: 1,
    ...typography.bodyStrong,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: space.xs,
    justifyContent: "center",
    marginTop: space.sm,
    minHeight: 42,
    paddingHorizontal: space.sm,
  },
  primaryActionText: {
    color: palette.brand,
    ...typography.caption,
  },
  galleryActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    marginTop: space.sm,
  },
  iconAction: {
    alignItems: "center",
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 44,
  },
  removeAction: {
    marginLeft: "auto",
  },
  galleryActionPressed: {
    opacity: 0.72,
  },
  galleryActionDisabled: {
    opacity: 0.35,
  },
  privacyCard: {
    alignItems: "flex-start",
    backgroundColor: palette.sageSoft,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xxl,
    padding: space.md,
  },
  privacyCopy: {
    flex: 1,
  },
  privacyTitle: {
    color: palette.sage,
    ...typography.bodyStrong,
  },
  privacyBody: {
    color: palette.sage,
    marginTop: space.xxs,
    ...typography.small,
  },
});
