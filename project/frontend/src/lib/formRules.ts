/**
 * Client-side mirrors of backend validation. These are convenience checks only:
 * the API remains authoritative for identity and account policy.
 */

/** Mirrors backend `AuthDtos.PASSWORD_PATTERN`. */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,72}$/;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_RULES = [
  { id: 'length', label: '10–72 characters', test: (value: string) => value.length >= 10 && value.length <= 72 },
  { id: 'lowercase', label: 'Lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { id: 'uppercase', label: 'Uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'digit', label: 'Number', test: (value: string) => /\d/.test(value) },
  { id: 'symbol', label: 'Symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function passwordChecks(value: string): Array<{ id: string; label: string; met: boolean }> {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(value) }));
}

export function passwordStrength(value: string): number {
  return passwordChecks(value).filter((check) => check.met).length;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN_LENGTH) return 'Use at least 10 characters.';
  if (value.length > PASSWORD_MAX_LENGTH) return 'Use no more than 72 characters.';
  if (!PASSWORD_PATTERN.test(value)) {
    return 'Include lowercase and uppercase letters, a number and a symbol.';
  }
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
  return undefined;
}
