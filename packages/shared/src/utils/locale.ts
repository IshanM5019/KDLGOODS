// ─── KDLGOODS Locale & Currency Utilities ────────────────────────────────────
// All pricing and locale formatting is in Indian Rupee (INR) for the
// Dantewada Kirandul, Chhattisgarh operational zone.

/** ISO 4217 currency code. */
export const CURRENCY_CODE = 'INR';

/** Unicode Rupee symbol. */
export const CURRENCY_SYMBOL = '₹';

/** BCP 47 locale tag for Indian number formatting. */
export const LOCALE = 'hi-IN';

/**
 * Formats a numeric amount as an Indian Rupee string.
 *
 * Examples:
 *  formatINR(1499)   → "₹1,499"
 *  formatINR(49.5)   → "₹49.50"
 *  formatINR(100000) → "₹1,00,000"
 *
 * @param amount  Numeric price value in INR
 * @param paise   When true, shows two decimal places (for paise). Defaults to false.
 */
export function formatINR(amount: number, paise = false): string {
  return (
    CURRENCY_SYMBOL +
    amount.toLocaleString(LOCALE, {
      minimumFractionDigits: paise ? 2 : 0,
      maximumFractionDigits: paise ? 2 : 0,
    })
  );
}
// ─────────────────────────────────────────────────────────────────────────────
