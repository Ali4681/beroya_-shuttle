"use client";

import { create } from "zustand";
import type { Branding, InstitutionRef } from "@/domain/models/entities";

type BrandingState = {
  institution: InstitutionRef | null;
  branding: Branding | null;
  setBranding: (institution: InstitutionRef | null, branding: Branding | null) => void;
  reset: () => void;
};

const HEX = /^#[0-9A-Fa-f]{6}$/;
const STYLE_ID = "institution-branding";
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#151a24";
/** Accents are used for active states, icons and button fills; below this they blend into the panel. */
const MIN_ACCENT_CONTRAST = 2;

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Prefers the primary colour; falls back to the secondary when the primary vanishes on this surface. */
function pickAccent(colors: string[], surface: string) {
  return colors.find((color) => contrast(color, surface) >= MIN_ACCENT_CONTRAST) ?? null;
}

function lightVars(accent: string) {
  return `
    --primary: ${accent};
    --accent: ${accent};
    --accent-strong: color-mix(in srgb, ${accent} 78%, black);
    --accent-soft: color-mix(in srgb, ${accent} 12%, transparent);
    --accent-glow: color-mix(in srgb, ${accent} 20%, transparent);
    --accent-gradient: linear-gradient(45deg, color-mix(in srgb, ${accent} 72%, black) 0%, ${accent} 100%);
    --row-odd: color-mix(in srgb, ${accent} 4%, transparent);
    --field-hover: color-mix(in srgb, ${accent} 5%, white);
    --shadow-sm: 0px 2px 6px 0px color-mix(in srgb, ${accent} 45%, transparent);
    --scrollbar-gradient: linear-gradient(180deg, ${accent} 0%, color-mix(in srgb, ${accent} 70%, black) 100%);
    --scrollbar-gradient-hover: linear-gradient(180deg, color-mix(in srgb, ${accent} 85%, white) 0%, ${accent} 100%);
    --scrollbar-gradient-active: linear-gradient(180deg, color-mix(in srgb, ${accent} 70%, white) 0%, ${accent} 100%);`;
}

function darkVars(accent: string) {
  return `
    --primary: ${accent};
    --accent: ${accent};
    --accent-strong: color-mix(in srgb, ${accent} 75%, white);
    --accent-soft: color-mix(in srgb, ${accent} 14%, transparent);
    --accent-glow: color-mix(in srgb, ${accent} 24%, transparent);
    --accent-gradient: linear-gradient(45deg, color-mix(in srgb, ${accent} 72%, black) 0%, ${accent} 100%);
    --row-odd: color-mix(in srgb, ${accent} 6%, transparent);
    --field-hover: color-mix(in srgb, ${accent} 8%, transparent);
    --scrollbar-gradient: linear-gradient(180deg, ${accent} 0%, color-mix(in srgb, ${accent} 70%, black) 100%);
    --scrollbar-gradient-hover: linear-gradient(180deg, color-mix(in srgb, ${accent} 85%, white) 0%, ${accent} 100%);
    --scrollbar-gradient-active: linear-gradient(180deg, color-mix(in srgb, ${accent} 70%, white) 0%, ${accent} 100%);`;
}

function brandingCss(branding: Branding) {
  const colors = [branding.primaryColor, branding.secondaryColor].filter(
    (color): color is string => !!color && HEX.test(color),
  );
  const light = pickAccent(colors, LIGHT_SURFACE);
  const dark = pickAccent(colors, DARK_SURFACE);
  const secondary = branding.secondaryColor && HEX.test(branding.secondaryColor) ? branding.secondaryColor : null;

  // Doubled selectors outrank the theme defaults in globals.css regardless of stylesheet order.
  let css = "";
  if (light || secondary) {
    css += `html:root { ${light ? lightVars(light) : ""} ${secondary ? `--secondary: ${secondary};` : ""} }\n`;
  }
  if (dark) {
    css += `html:root[data-theme="dark"] { ${darkVars(dark)} }
html:root[data-theme="dark"] .btn-primary,
html:root[data-theme="dark"] .drawer-confirm-btn {
  background: linear-gradient(45deg, color-mix(in srgb, ${dark} 55%, black) 0%, color-mix(in srgb, ${dark} 80%, black) 100%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, ${dark} 30%, transparent), 0 6px 18px -10px color-mix(in srgb, ${dark} 55%, transparent);
}\n`;
  }
  return css;
}

export function applyBrandingToDocument(branding: Branding | null) {
  if (typeof document === "undefined") return;
  document.getElementById(STYLE_ID)?.remove();
  if (!branding || branding.useInstitutionIdentity === false) return;

  const css = brandingCss(branding);
  if (!css) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export const useBrandingStore = create<BrandingState>((set) => ({
  institution: null,
  branding: null,
  setBranding: (institution, branding) => {
    applyBrandingToDocument(branding);
    set({ institution, branding });
  },
  reset: () => {
    applyBrandingToDocument(null);
    set({ institution: null, branding: null });
  },
}));
