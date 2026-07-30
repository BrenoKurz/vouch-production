import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  dateOfBirthLimits,
  defaultDateOfBirth,
  formatDateOfBirth,
  parseDateOfBirth,
  toDateOfBirthValue,
} from "@/lib/date-of-birth";
import {
  palette,
  radius,
  space,
  typography,
} from "@/constants/design";

export type DateOfBirthFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  helperText?: string;
  label?: string;
};

export function DateOfBirthField({
  value,
  onChange,
  error,
  disabled = false,
  helperText = "You must be 18 or older. Your full birthday stays private.",
  label = "Date of birth",
}: DateOfBirthFieldProps) {
  const initialDate = parseDateOfBirth(value) ?? defaultDateOfBirth();
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(initialDate);
  const { minimumDate, maximumDate } = dateOfBirthLimits();

  function openPicker() {
    if (disabled) {
      return;
    }

    setDraftDate(parseDateOfBirth(value) ?? defaultDateOfBirth());
    setIsOpen(true);
  }

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setIsOpen(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setDraftDate(selectedDate);

    if (Platform.OS === "android") {
      onChange(toDateOfBirthValue(selectedDate));
    }
  }

  function confirmIosDate() {
    onChange(toDateOfBirthValue(draftDate));
    setIsOpen(false);
  }

  const displayValue = formatDateOfBirth(value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityHint="Opens the system date picker"
        accessibilityLabel={
          displayValue ? `${label}, ${displayValue}` : `${label}, not selected`
        }
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.control,
          error && styles.controlError,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.controlIcon}>
          <Ionicons
            color={error ? palette.danger : palette.brand}
            name="calendar-outline"
            size={21}
          />
        </View>
        <Text
          style={[
            styles.value,
            !displayValue && styles.placeholder,
            error && styles.valueError,
          ]}
        >
          {displayValue || "Choose your birthday"}
        </Text>
        <Ionicons
          color={palette.subtle}
          name="chevron-down"
          size={18}
        />
      </Pressable>

      {isOpen ? (
        <View style={styles.pickerCard}>
          <DateTimePicker
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            mode="date"
            onChange={handleChange}
            value={draftDate}
          />

          {Platform.OS === "ios" ? (
            <View style={styles.pickerActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsOpen(false)}
                style={styles.pickerButton}
              >
                <Text style={styles.pickerCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirmIosDate}
                style={styles.pickerButton}
              >
                <Text style={styles.pickerDone}>Use this date</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

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
  control: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.sm,
  },
  controlError: {
    borderColor: palette.danger,
  },
  controlIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.xs,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  value: {
    color: palette.ink,
    flex: 1,
    ...typography.body,
  },
  valueError: {
    color: palette.danger,
  },
  placeholder: {
    color: palette.subtle,
  },
  pickerCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: space.xs,
  },
  pickerActions: {
    borderTopColor: palette.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
  },
  pickerButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  pickerCancel: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  pickerDone: {
    color: palette.brand,
    fontSize: 14,
    fontWeight: "800",
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
  disabled: {
    opacity: 0.52,
  },
  pressed: {
    opacity: 0.78,
  },
});
