import { describe, expect, it } from 'vitest';
import { BLOOD_GROUPS } from '@/lib/constants';
import {
  formatBloodGroup,
  getCompatibleDonorCount,
  getRbcCompatibility,
  getRbcMatrix,
  RBC_COMPATIBILITY_NOTE,
} from '@/lib/bloodCompatibility';

describe('illustrative RBC compatibility matrix', () => {
  it('covers all 64 recipient/donor pairs', () => {
    const pairs = BLOOD_GROUPS.flatMap((recipient) =>
      BLOOD_GROUPS.map((donor) => getRbcCompatibility(recipient, donor)),
    );

    expect(pairs).toHaveLength(64);
    expect(new Set(pairs.map(({ recipient, donor }) => `${recipient}:${donor}`)).size).toBe(64);
    pairs.forEach((pair) => {
      expect(pair.note).toBe(RBC_COMPATIBILITY_NOTE);
    });
  });

  it('uses the standard illustrative red-cell teaching ranges', () => {
    expect(getCompatibleDonorCount('O_NEGATIVE')).toBe(1);
    expect(getCompatibleDonorCount('AB_POSITIVE')).toBe(8);
    expect(getCompatibleDonorCount('O_POSITIVE')).toBe(2);
    expect(getCompatibleDonorCount('A_NEGATIVE')).toBe(2);
    expect(getCompatibleDonorCount('B_NEGATIVE')).toBe(2);
    expect(getCompatibleDonorCount('AB_NEGATIVE')).toBe(4);

    BLOOD_GROUPS.forEach((recipient) => {
      expect(getRbcCompatibility(recipient, 'O_NEGATIVE').compatible).toBe(true);
      expect(getRbcCompatibility('AB_POSITIVE', recipient).compatible).toBe(true);
    });
  });

  it('returns a complete, ordered matrix for a selected recipient', () => {
    const matrix = getRbcMatrix('A_POSITIVE');
    expect(matrix.map((row) => row.donor)).toEqual(BLOOD_GROUPS);
    expect(matrix.filter((row) => row.compatibility.compatible).map((row) => row.donor)).toEqual([
      'A_POSITIVE',
      'A_NEGATIVE',
      'O_POSITIVE',
      'O_NEGATIVE',
    ]);
  });

  it('formats every group as title case with a readable prefix', () => {
    expect(BLOOD_GROUPS.map(formatBloodGroup)).toEqual([
      'A Positive',
      'A Negative',
      'B Positive',
      'B Negative',
      'AB Positive',
      'AB Negative',
      'O Positive',
      'O Negative',
    ]);
  });

  it('keeps the exact clinical-boundary note', () => {
    expect(RBC_COMPATIBILITY_NOTE).toBe(
      'Red blood cell compatibility. Plasma and platelet compatibility follow different rules (e.g., AB plasma is the universal plasma donor type), and final matching always requires crossmatching by clinical staff.',
    );
  });
});
