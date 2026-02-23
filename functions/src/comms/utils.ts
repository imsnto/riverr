
/**
 * Normalizes a phone number for consistent database lookups.
 * Preserves the leading '+' for E.164 and removes all other non-digit characters.
 */
export function normalizePhoneFallback(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const keepPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return keepPlus ? `+${digits}` : digits;
}
