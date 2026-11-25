import { describe, expect, it } from 'vitest';
import {
  PASSWORD_PATTERN,
  passwordChecks,
  passwordStrength,
  validateEmail,
  validatePassword,
} from './formRules';

describe('password policy', () => {
  it('rejects a lowercase-only ten-character password', () => {
    expect(PASSWORD_PATTERN.test('lowercaseonly')).toBe(false);
    expect(validatePassword('lowercaseonly')).toMatch(/lowercase and uppercase/i);
  });

  it('accepts a compliant password', () => {
    expect(PASSWORD_PATTERN.test('LifeLink@2026')).toBe(true);
    expect(validatePassword('LifeLink@2026')).toBeUndefined();
  });

  it('rejects short and overlong values with the backend length policy', () => {
    expect(validatePassword('Short1!')).toBe('Use at least 10 characters.');
    expect(validatePassword(`${'A'.repeat(71)}a1!`)).toBe('Use no more than 72 characters.');
  });

  it('reports policy checks consistently with the pattern', () => {
    const checks = passwordChecks('lowercaseonly');
    expect(checks.find((check) => check.id === 'uppercase')?.met).toBe(false);
    expect(passwordStrength('LifeLink@2026')).toBe(5);
    expect(passwordStrength('')).toBe(0);
  });
});

describe('email policy', () => {
  it('requires a syntactically valid address', () => {
    expect(validateEmail('')).toBe('Email is required.');
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address.');
    expect(validateEmail('donor@example.org')).toBeUndefined();
  });
});
