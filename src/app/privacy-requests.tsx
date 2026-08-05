import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AppButton,
  AppScreen,
  Card,
  EmptyState,
  InlineNotice,
  LoadingState,
  StackHeader,
  StatusPill,
} from "@/components/vouch-ui";
import { layout, palette, radius, space, typography } from "@/constants/design";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type {
  CancelPrivacyRequestEnvelope,
  PrivacyRequest,
  PrivacyRequestEnvelope,
  PrivacyRequestsEnvelope,
  PrivacyRequestType,
  SubmitPrivacyRequestBody,
} from "@/types/privacy-request";

const ACTIVE_STATUSES = new Set([
  "submitted",
  "in_progress",
  "action_required",
]);

const statusLabels: Record<PrivacyRequest["status"], string> = {
  submitted: "Submitted",
  in_progress: "In progress",
  action_required: "Action required",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Closed",
};

function isAuthenticationError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.code === "authentication_required")
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function PrivacyRequestsScreen() {
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [submittingType, setSubmittingType] =
    useState<PrivacyRequestType | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const activeTypes = useMemo(
    () =>
      new Set(
        requests
          .filter((request) => ACTIVE_STATUSES.has(request.status))
          .map((request) => request.request_type),
      ),
    [requests],
  );

  const load = useCallback(
    async (refresh = false) => {
      if (!accessToken) return;
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setMessage("");
      try {
        const response = await apiGet<PrivacyRequestsEnvelope>(
          "/members/me/privacy-requests",
          accessToken,
        );
        setRequests(response.data);
      } catch (error) {
        if (isAuthenticationError(error)) {
          await signOut();
          return;
        }
        setMessage(
          error instanceof Error
            ? error.message
            : "Your privacy requests could not be loaded.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function submit(requestType: PrivacyRequestType) {
    if (!accessToken || submittingType || activeTypes.has(requestType)) return;
    setSubmittingType(requestType);
    setMessage("");
    try {
      const response = await apiPost<
        PrivacyRequestEnvelope,
        SubmitPrivacyRequestBody
      >(
        "/members/me/privacy-requests",
        accessToken,
        { request_type: requestType },
        Crypto.randomUUID(),
      );
      setRequests((current) => [response.data, ...current]);
      setMessage(
        requestType === "account_deletion"
          ? "Your deletion request is in the privacy review queue. Your account has not been deleted yet."
          : "Your data access request is in the privacy review queue.",
      );
    } catch (error) {
      if (isAuthenticationError(error)) {
        await signOut();
        return;
      }
      setMessage(
        error instanceof Error
          ? error.message
          : "The request could not be submitted.",
      );
    } finally {
      setSubmittingType(null);
    }
  }

  function confirmDeletionRequest() {
    Alert.alert(
      "Request account deletion?",
      "This starts a verified privacy review. Vouch will explain any safety or legal retention requirement before eligible data is removed. It does not delete your account immediately.",
      [
        { text: "Keep account", style: "cancel" },
        {
          text: "Submit request",
          style: "destructive",
          onPress: () => void submit("account_deletion"),
        },
      ],
    );
  }

  function confirmCancellation(request: PrivacyRequest) {
    Alert.alert(
      "Cancel this request?",
      "The privacy team will stop processing this request. You can submit a new one later.",
      [
        { text: "Keep request", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: () => void cancel(request),
        },
      ],
    );
  }

  async function cancel(request: PrivacyRequest) {
    if (!accessToken || cancellingId) return;
    setCancellingId(request.id);
    setMessage("");
    try {
      const response = await apiPost<CancelPrivacyRequestEnvelope>(
        `/members/me/privacy-requests/${request.id}/cancel`,
        accessToken,
        undefined,
        Crypto.randomUUID(),
      );
      setRequests((current) =>
        current.map((item) => (item.id === request.id ? response.data : item)),
      );
      setMessage("The request was cancelled.");
    } catch (error) {
      if (isAuthenticationError(error)) {
        await signOut();
        return;
      }
      setMessage(
        error instanceof Error
          ? error.message
          : "The request could not be cancelled.",
      );
    } finally {
      setCancellingId(null);
    }
  }

  if (isLoading && requests.length === 0) {
    return (
      <AppScreen includeBottomInset>
        <StackHeader title="Your privacy requests" />
        <LoadingState label="Loading your request history…" />
      </AppScreen>
    );
  }

  return (
    <AppScreen includeBottomInset>
      <StackHeader title="Your privacy requests" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={isRefreshing}
            tintColor={palette.brand}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              color={palette.brand}
              name="lock-closed-outline"
              size={24}
            />
          </View>
          <Text style={styles.title}>Private, tracked, and reversible</Text>
          <Text style={styles.subtitle}>
            Requests are tied to your signed-in account, tracked here, and
            reviewed by authorized operations staff. You will receive an in-app
            update when the status changes.
          </Text>
        </View>

        {message ? <InlineNotice message={message} /> : null}

        <Card style={styles.actionCard}>
          <RequestAction
            body="Ask for a portable copy of information associated with your Vouch membership. Secure delivery and identity checks happen during review."
            disabled={activeTypes.has("data_access")}
            icon="download-outline"
            label={
              activeTypes.has("data_access")
                ? "Data request active"
                : "Request my data"
            }
            loading={submittingType === "data_access"}
            onPress={() => void submit("data_access")}
            title="Data access"
          />
          <View style={styles.divider} />
          <RequestAction
            body="Begin a verified account-deletion review. Safety and legal records may require limited retention, which the privacy team will explain."
            danger
            disabled={activeTypes.has("account_deletion")}
            icon="trash-outline"
            label={
              activeTypes.has("account_deletion")
                ? "Deletion request active"
                : "Request account deletion"
            }
            loading={submittingType === "account_deletion"}
            onPress={confirmDeletionRequest}
            title="Account deletion"
          />
        </Card>

        <Text style={styles.sectionTitle}>Request history</Text>
        {requests.length === 0 ? (
          <EmptyState
            body="Data-access and account-deletion requests will appear here with their current status."
            icon="document-text-outline"
            title="No requests yet"
          />
        ) : (
          requests.map((request) => (
            <Card key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeading}>
                <View style={styles.requestCopy}>
                  <Text style={styles.requestTitle}>
                    {request.request_type === "data_access"
                      ? "Data access"
                      : "Account deletion"}
                  </Text>
                  <Text style={styles.requestDate}>
                    Submitted {formatDate(request.submitted_at)}
                  </Text>
                </View>
                <StatusPill
                  label={statusLabels[request.status]}
                  tone={
                    request.status === "completed"
                      ? "positive"
                      : request.status === "action_required"
                        ? "warning"
                        : "neutral"
                  }
                />
              </View>
              {request.member_message ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageLabel}>Privacy team update</Text>
                  <Text style={styles.messageBody}>
                    {request.member_message}
                  </Text>
                </View>
              ) : null}
              {ACTIVE_STATUSES.has(request.status) ? (
                <>
                  <Text style={styles.targetText}>
                    Target response by {formatDate(request.target_response_at)}
                  </Text>
                  <AppButton
                    label="Cancel request"
                    loading={cancellingId === request.id}
                    onPress={() => confirmCancellation(request)}
                    variant="secondary"
                  />
                </>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
}

function RequestAction({
  body,
  danger = false,
  disabled,
  icon,
  label,
  loading,
  onPress,
  title,
}: {
  body: string;
  danger?: boolean;
  disabled: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  loading: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <View style={styles.actionSection}>
      <View style={[styles.actionIcon, danger && styles.dangerIcon]}>
        <Ionicons
          color={danger ? palette.danger : palette.brand}
          name={icon}
          size={21}
        />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionBody}>{body}</Text>
      </View>
      <AppButton
        disabled={disabled}
        label={label}
        loading={loading}
        onPress={onPress}
        variant={danger ? "danger" : "secondary"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.lg,
    width: "100%",
  },
  hero: { paddingBottom: space.lg, paddingTop: space.lg },
  heroIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    marginBottom: space.md,
    width: 48,
  },
  title: { color: palette.ink, ...typography.title },
  subtitle: { color: palette.muted, marginTop: space.sm, ...typography.body },
  actionCard: { gap: space.md, marginTop: space.lg },
  actionSection: { gap: space.sm },
  actionIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.sm,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  dangerIcon: { backgroundColor: palette.dangerSoft },
  actionCopy: { gap: space.xs },
  actionTitle: { color: palette.ink, ...typography.heading },
  actionBody: { color: palette.muted, ...typography.small },
  divider: {
    backgroundColor: palette.border,
    height: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    color: palette.ink,
    marginBottom: space.sm,
    marginTop: space.xl,
    ...typography.heading,
  },
  requestCard: { gap: space.md, marginBottom: space.sm },
  requestHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
  },
  requestCopy: { flex: 1 },
  requestTitle: { color: palette.ink, ...typography.bodyStrong },
  requestDate: { color: palette.muted, marginTop: 2, ...typography.caption },
  messageBox: {
    backgroundColor: palette.canvas,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  messageLabel: { color: palette.inkSoft, ...typography.caption },
  messageBody: { color: palette.ink, marginTop: space.xs, ...typography.small },
  targetText: { color: palette.muted, ...typography.caption },
});
