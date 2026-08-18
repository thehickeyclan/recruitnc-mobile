/**
 * NC United design tokens — mirrors the `rnc.*` palette in the web app's tailwind.config.ts,
 * which that file documents as "the dark navy actually shipped on the public pages".
 *
 * Navy and gold only. The brand's red (#BC0B03) is kept for destructive states, never as an
 * accent, so the app reads as two colours rather than three.
 *
 * The web codebase carries three near-miss navies and two golds (the legacy `nc-*` tokens).
 * The app deliberately ships only this set so that drift can't start here. If a colour is
 * needed that isn't below, add it here rather than inlining a hex in a component.
 */

export const colors = {
  // Surfaces, darkest → lightest
  ink: "#0A1628", // page background
  surface: "#0f1c2e", // inset panels, stat bars
  raised: "#13294B", // cards, buttons
  line: "#1a3a5f", // borders, hairlines

  gold: "#D3B574",
  goldHover: "#c4a665",
  red: "#BC0B03",
  redHover: "#a00a03",

  // Text, highest → lowest emphasis
  text: "#FFFFFF",
  textSecondary: "#A8BBD1",
  textMuted: "#6B829D",

  // Status
  success: "#3FB27F",
  warning: "#D3B574",
} as const

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const

export const type = {
  display: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "600" },
  caption: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
} as const

export type Colors = typeof colors
