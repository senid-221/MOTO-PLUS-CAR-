/**
 * Decimal-safe money handling.
 *
 * Requirement: money must never be computed with JavaScript floating-point
 * arithmetic. Amounts cross the API boundary as strings and are computed
 * internally as integer minor units (centimes, 1 RWF = 100).
 */

export const CURRENCY_MINOR_UNITS = 100;

export type MoneyString = string;

const AMOUNT_PATTERN = /^-?\d+(\.\d{1,2})?$/;

export function isMoneyString(value: unknown): value is MoneyString {
  return typeof value === 'string' && AMOUNT_PATTERN.test(value);
}

/** Parse "1500", "1500.50" or a number into integer minor units. */
export function toMinor(amount: MoneyString | number): number {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      throw new TypeError('Money amount is not finite');
    }
    // Numbers are only accepted when they are already exact at 2 decimals.
    return Math.round(amount * CURRENCY_MINOR_UNITS);
  }
  const trimmed = amount.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new TypeError(`Invalid money amount: "${amount}"`);
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const minor = Number(whole) * CURRENCY_MINOR_UNITS + Number((fraction + '00').slice(0, 2));
  return negative ? -minor : minor;
}

/** Render integer minor units as a fixed 2-decimal string. */
export function fromMinor(minor: number): MoneyString {
  if (!Number.isInteger(minor)) {
    throw new TypeError(`Minor units must be an integer, received ${minor}`);
  }
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / CURRENCY_MINOR_UNITS);
  const fraction = abs % CURRENCY_MINOR_UNITS;
  return `${sign}${whole}.${String(fraction).padStart(2, '0')}`;
}

export function add(...amounts: Array<MoneyString | number>): MoneyString {
  return fromMinor(amounts.reduce<number>((total, amount) => total + toMinor(amount), 0));
}

export function subtract(
  minuend: MoneyString | number,
  ...subtrahends: Array<MoneyString | number>
): MoneyString {
  return fromMinor(
    toMinor(minuend) - subtrahends.reduce<number>((total, amount) => total + toMinor(amount), 0),
  );
}

/**
 * Multiply an amount by a rate and round to the nearest minor unit
 * (half away from zero), which is how commission and platform fees are charged.
 */
export function multiplyByRate(amount: MoneyString | number, rate: number): MoneyString {
  if (!Number.isFinite(rate)) {
    throw new RangeError('rate must be finite');
  }
  const minor = toMinor(amount) * rate;
  const rounded = Math.sign(minor) * Math.floor(Math.abs(minor) + 0.5);
  return fromMinor(rounded);
}

/** Split an amount into `parts` pieces, distributing the remainder to the first pieces. */
export function splitEvenly(amount: MoneyString | number, parts: number): MoneyString[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError('parts must be a positive integer');
  }
  const minor = toMinor(amount);
  const base = Math.floor(minor / parts);
  const remainder = minor - base * parts;
  return Array.from({ length: parts }, (_, index) => fromMinor(base + (index < remainder ? 1 : 0)));
}

export interface FareBreakdown {
  /** Amount the customer pays. */
  gross: MoneyString;
  /** Platform commission retained. */
  commission: MoneyString;
  /** Amount owed to the rider or merchant. */
  payout: MoneyString;
}

/**
 * Commission split for a completed service. Commission is computed on the
 * gross amount and the payout is whatever remains, so the two always sum to
 * gross and no rounding drift can occur.
 */
export function splitCommission(
  gross: MoneyString | number,
  commissionRate: number,
): FareBreakdown {
  const grossMinor = toMinor(gross);
  if (commissionRate < 0 || commissionRate > 1) {
    throw new RangeError('commissionRate must be between 0 and 1');
  }
  const commissionMinor = Math.floor(grossMinor * commissionRate + 0.5);
  return {
    gross: fromMinor(grossMinor),
    commission: fromMinor(commissionMinor),
    payout: fromMinor(grossMinor - commissionMinor),
  };
}
