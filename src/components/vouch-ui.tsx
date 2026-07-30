import { Ionicons } from "@expo/vector-icons";
import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageStyle,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import {
  layout,
  palette,
  radius,
  shadow,
  space,
  typography,
} from "@/constants/design";

export function AppScreen({
  children,
  includeBottomInset = false,
  style,
}: PropsWithChildren<{
  includeBottomInset?: boolean;
  style?: ViewStyle;
}>) {
  return (
    <SafeAreaView
      edges={
        includeBottomInset
          ? ["top", "right", "bottom", "left"]
          : ["top", "right", "left"]
      }
      style={[styles.screen, style]}
    >
      {children}
    </SafeAreaView>
  );
}

export function ContentColumn({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.contentColumn, style]}>{children}</View>;
}

export function VouchWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessibilityLabel="Vouch"
      accessibilityRole="text"
      style={styles.wordmark}
    >
      <View style={[styles.mark, compact && styles.markCompact]}>
        <Text style={[styles.markText, compact && styles.markTextCompact]}>
          V
        </Text>
      </View>
      {!compact ? <Text style={styles.wordmarkText}>VOUCH</Text> : null}
    </View>
  );
}

export function StackHeader({
  title,
  subtitle,
  right,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.stackHeader}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.stackBack,
          pressed && styles.buttonPressed,
        ]}
      >
        <Ionicons color={palette.ink} name="chevron-back" size={24} />
      </Pressable>

      {title ? (
        <View style={styles.stackTitleCopy}>
          <Text numberOfLines={1} style={styles.stackTitle}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.stackSubtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <VouchWordmark compact />
      )}

      <View style={styles.stackRight}>{right}</View>
    </View>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.pageTitle}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
        >
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export type StatusTone = "neutral" | "brand" | "positive" | "warning" | "danger";

const statusStyles: Record<
  StatusTone,
  { container: ViewStyle; text: TextStyle }
> = {
  neutral: {
    container: { backgroundColor: palette.canvasStrong },
    text: { color: palette.inkSoft },
  },
  brand: {
    container: { backgroundColor: palette.brandSoft },
    text: { color: palette.brand },
  },
  positive: {
    container: { backgroundColor: palette.sageSoft },
    text: { color: palette.sage },
  },
  warning: {
    container: { backgroundColor: palette.amberSoft },
    text: { color: palette.amber },
  },
  danger: {
    container: { backgroundColor: palette.dangerSoft },
    text: { color: palette.danger },
  },
};

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  const toneStyle = statusStyles[tone];

  return (
    <View style={[styles.statusPill, toneStyle.container]}>
      <Text style={[styles.statusPillText, toneStyle.text]}>{label}</Text>
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function AppButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled = false,
  loading = false,
  compact = false,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
}) {
  const isInactive = disabled || loading;
  const foreground =
    variant === "primary"
      ? palette.white
      : variant === "danger"
        ? palette.danger
        : palette.ink;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant],
        compact && styles.buttonCompact,
        isInactive && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : (
        <>
          {icon ? <Ionicons color={foreground} name={icon} size={18} /> : null}
          <Text style={[styles.buttonText, buttonTextStyles[variant]]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const buttonStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: palette.brand,
    borderColor: palette.brand,
  },
  secondary: {
    backgroundColor: palette.surface,
    borderColor: palette.borderStrong,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  danger: {
    backgroundColor: palette.dangerSoft,
    borderColor: palette.brandSoftStrong,
  },
};

const buttonTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: palette.white },
  secondary: { color: palette.ink },
  ghost: { color: palette.brand },
  danger: { color: palette.danger },
};

export function IconButton({
  accessibilityLabel,
  icon,
  onPress,
  badge,
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Ionicons color={palette.ink} name={icon} size={22} />
      {badge ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function InlineNotice({
  message,
  tone = "warning",
  actionLabel,
  onAction,
}: {
  message: string;
  tone?: "warning" | "danger" | "positive";
  actionLabel?: string;
  onAction?: () => void;
}) {
  const icon =
    tone === "danger"
      ? "alert-circle-outline"
      : tone === "positive"
        ? "checkmark-circle-outline"
        : "information-circle-outline";
  const toneColor =
    tone === "danger"
      ? palette.danger
      : tone === "positive"
        ? palette.sage
        : palette.amber;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        tone === "danger" && styles.noticeDanger,
        tone === "positive" && styles.noticePositive,
      ]}
    >
      <Ionicons color={toneColor} name={icon} size={20} />
      <View style={styles.noticeCopy}>
        <Text style={[styles.noticeText, { color: toneColor }]}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable hitSlop={6} onPress={onAction}>
            <Text style={[styles.noticeAction, { color: toneColor }]}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Avatar({
  firstName,
  uri,
  size = 56,
  style,
}: {
  firstName: string;
  uri?: string | null;
  size?: number;
  style?: ImageStyle;
}) {
  const imageStyle: ImageStyle = {
    borderRadius: Math.max(12, size * 0.28),
    height: size,
    width: size,
  };

  if (uri) {
    return (
      <Image
        accessibilityLabel={`${firstName}'s profile photo`}
        source={{ uri }}
        style={[styles.avatar, imageStyle, style]}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`${firstName}'s profile placeholder`}
      style={[styles.avatar, styles.avatarPlaceholder, imageStyle, style]}
    >
      <Text style={[styles.avatarInitial, { fontSize: Math.max(18, size * 0.36) }]}>
        {firstName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function LoadingState({
  label = "Loading…",
}: {
  label?: string;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.state}>
      <View style={styles.stateIcon}>
        <ActivityIndicator color={palette.brand} size="large" />
      </View>
      <Text style={styles.stateBody}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = "sparkles-outline",
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Ionicons color={palette.brand} name={icon} size={28} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        {title}
      </Text>
      <Text style={styles.stateBody}>{body}</Text>
      {actionLabel && onAction ? (
        <AppButton compact label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      actionLabel="Try again"
      body={body}
      icon="cloud-offline-outline"
      onAction={onRetry}
      title={title}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.canvas,
    flex: 1,
  },
  contentColumn: {
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    width: "100%",
  },
  wordmark: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  mark: {
    alignItems: "center",
    backgroundColor: palette.brand,
    borderRadius: radius.sm,
    height: 34,
    justifyContent: "center",
    transform: [{ rotate: "-4deg" }],
    width: 34,
  },
  markCompact: {
    borderRadius: 10,
    height: 30,
    width: 30,
  },
  markText: {
    color: palette.white,
    fontFamily: "Georgia",
    fontSize: 21,
    fontWeight: "700",
    transform: [{ rotate: "4deg" }],
  },
  markTextCompact: {
    fontSize: 18,
  },
  wordmarkText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2.8,
  },
  pageHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
    paddingBottom: space.xl,
    paddingTop: space.lg,
  },
  stackHeader: {
    alignItems: "center",
    borderBottomColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: space.sm,
    paddingVertical: 7,
  },
  stackBack: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  stackTitleCopy: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: space.xs,
  },
  stackTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  stackSubtitle: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  stackRight: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
  },
  pageHeaderCopy: {
    flex: 1,
  },
  eyebrow: {
    color: palette.brand,
    ...typography.label,
  },
  pageTitle: {
    color: palette.ink,
    marginTop: space.xs,
    ...typography.title,
  },
  pageSubtitle: {
    color: palette.muted,
    marginTop: space.xs,
    maxWidth: 560,
    ...typography.body,
  },
  headerAction: {
    paddingTop: space.xs,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  sectionTitle: {
    color: palette.ink,
    ...typography.heading,
  },
  sectionAction: {
    color: palette.brand,
    ...typography.caption,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
    ...shadow,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.45,
    lineHeight: 13,
    textTransform: "uppercase",
  },
  button: {
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  buttonCompact: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  buttonText: {
    ...typography.bodyStrong,
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.46,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: palette.brand,
    borderColor: palette.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 3,
    position: "absolute",
    right: -5,
    top: -5,
  },
  iconBadgeText: {
    color: palette.white,
    fontSize: 9,
    fontWeight: "900",
  },
  notice: {
    alignItems: "flex-start",
    backgroundColor: palette.amberSoft,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
  },
  noticeDanger: {
    backgroundColor: palette.dangerSoft,
  },
  noticePositive: {
    backgroundColor: palette.sageSoft,
  },
  noticeCopy: {
    flex: 1,
  },
  noticeText: {
    ...typography.small,
  },
  noticeAction: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: space.xs,
  },
  avatar: {
    backgroundColor: palette.canvasStrong,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: palette.brand,
    fontWeight: "700",
  },
  state: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.xxxl,
  },
  stateIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.pill,
    height: 64,
    justifyContent: "center",
    marginBottom: space.md,
    width: 64,
  },
  stateTitle: {
    color: palette.ink,
    textAlign: "center",
    ...typography.heading,
  },
  stateBody: {
    color: palette.muted,
    marginBottom: space.lg,
    marginTop: space.xs,
    maxWidth: 420,
    textAlign: "center",
    ...typography.body,
  },
});
