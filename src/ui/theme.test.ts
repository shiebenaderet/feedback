import { describe, it, expect } from 'vitest';
import {
  tokens,
  panelStyle,
  tealButtonStyle,
  chipStyle,
  slotTokenStyle,
  cardStyle,
  progressTrackStyle,
  progressFillStyle,
  breadcrumbStyle,
  breadcrumbSepStyle,
  navBarStyle,
  periodChipStyle,
} from './theme';

describe('theme tokens', () => {
  it('exposes the B+C palette with the exact LandingPage hexes', () => {
    expect(tokens.color.bg).toBe('#0d0d0f');
    expect(tokens.color.panel).toBe('#15171c');
    expect(tokens.color.panelAlt).toBe('#1a1d23');
    expect(tokens.color.teal).toBe('#5fb8a8');
    expect(tokens.color.text).toBe('#e7e9ee');
    expect(tokens.color.muted).toBe('#9aa1ad');
  });

  it('exposes a system-ui font stack and a spacing/radius scale', () => {
    expect(tokens.font).toMatch(/system-ui/);
    expect(tokens.space(2)).toBe(16); // 8px base * 2
    expect(tokens.radius.md).toBe(10); // matches LandingPage button radius
  });

  it('panelStyle renders a calm dark card on panelAlt with the panel border', () => {
    const s = panelStyle();
    expect(s.background).toBe(tokens.color.panel);
    expect(s.borderRadius).toBe(tokens.radius.md);
    expect(s.color).toBe(tokens.color.text);
  });

  it('tealButtonStyle is the one accent; disabled drops to muted', () => {
    expect(tealButtonStyle(false).background).toBe(tokens.color.teal);
    expect(tealButtonStyle(true).color).toBe(tokens.color.muted);
  });

  it('chipStyle reflects an active/pressed state with the teal accent', () => {
    expect(chipStyle(true).borderColor).toBe(tokens.color.teal);
    expect(chipStyle(false).borderColor).not.toBe(tokens.color.teal);
  });

  it('slotTokenStyle is monospace so {slot} tokens read as code', () => {
    expect(slotTokenStyle().fontFamily).toMatch(/mono/i);
  });
});

describe('B+C layout primitives', () => {
  it('cardStyle is a panel surface with generous radius and 3-unit padding', () => {
    const s = cardStyle();
    expect(s.background).toBe(tokens.color.panel);
    expect(s.border).toBe(`1px solid ${tokens.color.border}`);
    expect(s.borderRadius).toBe(tokens.radius.lg);
    expect(s.padding).toBe(tokens.space(3));
  });

  it('progressTrackStyle is a thin rounded track on panelAlt', () => {
    const s = progressTrackStyle();
    expect(s.height).toBe(4);
    expect(s.background).toBe(tokens.color.panelAlt);
    expect(s.overflow).toBe('hidden');
  });

  it('progressFillStyle paints a teal bar at the given percentage width', () => {
    const s = progressFillStyle(40);
    expect(s.width).toBe('40%');
    expect(s.background).toBe(tokens.color.teal);
    expect(s.height).toBe('100%');
  });

  it('progressFillStyle clamps out-of-range percentages to 0..100', () => {
    expect(progressFillStyle(-5).width).toBe('0%');
    expect(progressFillStyle(150).width).toBe('100%');
  });

  it('breadcrumbStyle is a muted inline row; separators are subtler still', () => {
    expect(breadcrumbStyle().display).toBe('flex');
    expect(breadcrumbStyle().color).toBe(tokens.color.muted);
    expect(breadcrumbSepStyle().color).toBe(tokens.color.border);
  });

  it('navBarStyle is a bordered top bar on the panel surface', () => {
    const s = navBarStyle();
    expect(s.background).toBe(tokens.color.panel);
    expect(s.borderBottom).toBe(`1px solid ${tokens.color.border}`);
    expect(s.display).toBe('flex');
  });

  it('periodChipStyle reuses the chip look and highlights the active period', () => {
    expect(periodChipStyle(true).borderColor).toBe(tokens.color.teal);
    expect(periodChipStyle(true).color).toBe(tokens.color.teal);
    expect(periodChipStyle(false).borderColor).toBe(tokens.color.border);
  });
});
