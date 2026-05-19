import type { SidebarSafetyTier } from "./types";

export function formatSafetyTierLabel(tier: SidebarSafetyTier): string | null {
  switch (tier) {
    case "T4":
      return "Safety 1";
    case "T3":
      return "Safety 2";
    case "T2":
      return "Safety 3";
    case "T1":
      return "Safety 4";
    case "T0":
      return "Offline";
    default:
      return null;
  }
}

export function formatSafetyTextForReference(text: string): string {
  return text.replace(/\bT[0-4]\b/g, (token) => formatSafetyTierLabel(token as SidebarSafetyTier) ?? token);
}
