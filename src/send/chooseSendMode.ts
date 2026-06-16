// src/send/chooseSendMode.ts

export type SendMode = 'A' | 'B';

export interface SendModeInput {
  gmailScopeGranted: boolean;
  override?: SendMode; // explicit per-batch toggle
}

// Mode A (Gmail) requires the scope; without it we always fall back to Mode B.
// An explicit override can force B, but can never force A when scope is missing.
export function chooseSendMode({ gmailScopeGranted, override }: SendModeInput): SendMode {
  if (!gmailScopeGranted) return 'B';
  return override ?? 'A';
}
