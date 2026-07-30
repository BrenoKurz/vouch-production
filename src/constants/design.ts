import { Platform } from "react-native";

export const palette = {
  canvas: "#F7F3ED",
  canvasStrong: "#EFE7DE",
  surface: "#FFFDFC",
  surfaceRaised: "#FFFFFF",
  ink: "#241F1C",
  inkSoft: "#4F4843",
  muted: "#746B64",
  subtle: "#9A9088",
  border: "#E3DAD1",
  borderStrong: "#D1C3B7",
  brand: "#713F36",
  brandPressed: "#5D332D",
  brandSoft: "#F2E4DE",
  brandSoftStrong: "#E8D0C7",
  sage: "#3F6656",
  sageSoft: "#E4EDE8",
  amber: "#765B2F",
  amberSoft: "#F6ECD8",
  danger: "#8F3D36",
  dangerSoft: "#F6E6E3",
  white: "#FFFFFF",
  overlay: "rgba(36, 31, 28, 0.42)",
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "700" as const,
    letterSpacing: -1.2,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700" as const,
    letterSpacing: -0.7,
  },
  heading: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700" as const,
    letterSpacing: -0.25,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800" as const,
    letterSpacing: 1.4,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600" as const,
  },
} as const;

export const shadow = Platform.select({
  ios: {
    shadowColor: "#3B2D26",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  android: {
    elevation: 2,
  },
  default: {
    boxShadow: "0 8px 24px rgba(59, 45, 38, 0.08)",
  },
});

export const layout = {
  contentMaxWidth: 720,
  gutter: 20,
  tabBarHeight: 68,
} as const;
