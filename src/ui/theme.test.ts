import { describe, it, expect } from 'vitest';
import { tokens, panelStyle, tealButtonStyle, chipStyle, slotTokenStyle } from './theme';

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
