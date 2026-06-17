import type { CSSProperties } from 'react';

/** B+C blend design tokens — the single source of truth for the calm-dark palette.
 *  Hex values are lifted verbatim from src/pages/LandingPage.tsx. */
export const tokens = {
  color: {
    bg: '#0d0d0f',
    panel: '#15171c',
    panelAlt: '#1a1d23',
    teal: '#5fb8a8',
    tealInk: '#0d1311', // dark ink that sits on the teal accent
    text: '#e7e9ee',
    muted: '#9aa1ad',
    subtle: '#b8bcc6',
    border: '#23262e',
    danger: '#ff8a8a',
  },
  font: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  /** 8px base spacing scale: space(n) === n * 8 px. */
  space: (n: number): number => n * 8,
  radius: { sm: 6, md: 10, lg: 14 },
} as const;

export function panelStyle(): CSSProperties {
  return {
    background: tokens.color.panel,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    color: tokens.color.text,
    padding: tokens.space(2),
  };
}

export function tealButtonStyle(disabled = false): CSSProperties {
  return {
    background: disabled ? tokens.color.panelAlt : tokens.color.teal,
    color: disabled ? tokens.color.muted : tokens.color.tealInk,
    border: 'none',
    borderRadius: tokens.radius.md,
    padding: '10px 18px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: tokens.font,
    cursor: disabled ? 'default' : 'pointer',
  };
}

/** Status / filter chip. active === pressed/selected → teal outline. */
export function chipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: active ? 'rgba(95,184,168,0.12)' : tokens.color.panelAlt,
    color: active ? tokens.color.teal : tokens.color.muted,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: active ? tokens.color.teal : tokens.color.border,
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: 13,
    fontFamily: tokens.font,
    cursor: 'pointer',
  };
}

/** Monospace styling for {slot} tokens so they read as fill-in code. */
export function slotTokenStyle(): CSSProperties {
  return {
    fontFamily: tokens.mono,
    fontSize: '0.92em',
    background: 'rgba(95,184,168,0.10)',
    color: tokens.color.teal,
    borderRadius: tokens.radius.sm,
    padding: '0 4px',
  };
}

/** ⌘↵ keyboard-hint pill used next to primary actions. */
export function kbdHintStyle(): CSSProperties {
  return {
    fontFamily: tokens.mono,
    fontSize: 12,
    color: tokens.color.muted,
    marginLeft: 8,
  };
}

/** A raised content card — the standard course/student/setup surface.
 *  Slightly larger radius + padding than panelStyle for hero cards. */
export function cardStyle(): CSSProperties {
  return {
    background: tokens.color.panel,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.lg,
    color: tokens.color.text,
    padding: tokens.space(3),
  };
}

/** The rounded track behind a progress bar (matches SendStepper's bar). */
export function progressTrackStyle(): CSSProperties {
  return {
    height: 4,
    background: tokens.color.panelAlt,
    borderRadius: 99,
    overflow: 'hidden',
  };
}

/** The teal fill of a progress bar. `pct` is clamped to 0..100. */
export function progressFillStyle(pct: number): CSSProperties {
  const clamped = Math.max(0, Math.min(100, pct));
  return {
    width: `${clamped}%`,
    height: '100%',
    background: tokens.color.teal,
  };
}

/** The breadcrumb row container (Year › Course › Period). */
export function breadcrumbStyle(): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: tokens.color.muted,
    fontFamily: tokens.font,
  };
}

/** The "›" separator between crumbs — subtler than the crumbs themselves. */
export function breadcrumbSepStyle(): CSSProperties {
  return {
    color: tokens.color.border,
    fontSize: 13,
    userSelect: 'none',
  };
}

/** The persistent top navigation bar surface. */
export function navBarStyle(): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space(3),
    background: tokens.color.panel,
    borderBottom: `1px solid ${tokens.color.border}`,
    padding: `${tokens.space(1.5)}px ${tokens.space(3)}px`,
    fontFamily: tokens.font,
  };
}

/** A period/section chip. Pill-shaped; active === current period → teal. */
export function periodChipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: active ? 'rgba(95,184,168,0.12)' : tokens.color.panelAlt,
    color: active ? tokens.color.teal : tokens.color.subtle,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: active ? tokens.color.teal : tokens.color.border,
    borderRadius: 999,
    padding: '2px 9px',
    fontSize: 12,
    fontFamily: tokens.font,
  };
}
