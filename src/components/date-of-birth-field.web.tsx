import { Ionicons } from "@expo/vector-icons";
import { createElement, type CSSProperties } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { DateOfBirthFieldProps } from "@/components/date-of-birth-field";
import {
  dateOfBirthLimits,
  toDateOfBirthValue,
} from "@/lib/date-of-birth";
import {
  palette,
  radius,
  space,
  typography,
} from "@/constants/design";

export function DateOfBirthField({
  value,
  onChange,
  error,
  disabled = false,
  helperText = "You must be 18 or older. Your full birthday stays private.",
  label = "Date of birth",
}: DateOfBirthFieldProps) {
  const { minimumDate, maximumDate } = dateOfBirthLimits();
  const inputStyle: CSSProperties = {
    appearance: "none",
    background: palette.surface,
    border: `1px solid ${error ? palette.danger : palette.border}`,
    borderRadius: radius.sm,
    boxSizing: "border-box",
    color: error ? palette.danger : palette.ink,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: 16,
    height: 56,
    opacity: disabled ? 0.52 : 1,
    padding: "0 16px",
    width: "100%",
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {createElement("input", {
        "aria-invalid": Boolean(error),
        "aria-label": label,
        disabled,
        max: toDateOfBirthValue(maximumDate),
        min: toDateOfBirthValue(minimumDate),
        onChange: (event: { currentTarget: { value: string } }) =>
          onChange(event.currentTarget.value),
        style: inputStyle,
        type: "date",
        value,
      })}
      <View style={styles.helperRow}>
        <Ionicons
          color={error ? palette.danger : palette.muted}
          name={error ? "alert-circle-outline" : "lock-closed-outline"}
          size={14}
        />
        <Text style={[styles.helper, error && styles.helperError]}>
          {error || helperText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  label: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  helperRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
  },
  helper: {
    color: palette.muted,
    flex: 1,
    ...typography.caption,
  },
  helperError: {
    color: palette.danger,
  },
});
