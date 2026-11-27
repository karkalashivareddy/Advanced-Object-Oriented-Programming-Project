import { BLOOD_GROUPS } from '@/lib/constants';
import type { BloodGroup } from '@/types/domain';

export type RbcGroup = BloodGroup;

/** Blood groups read as `AB positive`, never `Ab Positive`. */
export function formatBloodGroup(group: RbcGroup): string {
  const [prefix, rh] = group.split('_');
  const letter = prefix === 'AB' ? 'AB' : `${prefix.charAt(0)}${prefix.slice(1).toLowerCase()}`;
  return `${letter} ${rh.charAt(0)}${rh.slice(1).toLowerCase()}`;
}

export const RBC_COMPATIBILITY_NOTE =
  'Red blood cell compatibility. Plasma and platelet compatibility follow different rules (e.g., AB plasma is the universal plasma donor type), and final matching always requires crossmatching by clinical staff.';

/**
 * Illustrative red-cell-only teaching matrix. It is not a clinical decision
 * table and deliberately excludes plasma, platelets and crossmatching.
 */
const RBC_DONORS_BY_RECIPIENT: Record<RbcGroup, readonly RbcGroup[]> = {
  O_POSITIVE: ['O_POSITIVE', 'O_NEGATIVE'],
  O_NEGATIVE: ['O_NEGATIVE'],
  A_POSITIVE: ['A_POSITIVE', 'A_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  A_NEGATIVE: ['A_NEGATIVE', 'O_NEGATIVE'],
  B_POSITIVE: ['B_POSITIVE', 'B_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  B_NEGATIVE: ['B_NEGATIVE', 'O_NEGATIVE'],
  AB_POSITIVE: BLOOD_GROUPS,
  AB_NEGATIVE: ['AB_NEGATIVE', 'A_NEGATIVE', 'B_NEGATIVE', 'O_NEGATIVE'],
};

export interface RbcCompatibilityResult {
  recipient: RbcGroup;
  donor: RbcGroup;
  compatible: boolean;
  explanation: string;
  note: typeof RBC_COMPATIBILITY_NOTE;
}

export interface RbcMatrixRow {
  donor: RbcGroup;
  compatibility: RbcCompatibilityResult;
}

export function getRbcCompatibility(recipient: RbcGroup, donor: RbcGroup): RbcCompatibilityResult {
  const compatible = RBC_DONORS_BY_RECIPIENT[recipient].includes(donor);
  let explanation: string;

  if (!compatible) {
    explanation = 'Not listed as compatible in this illustrative red-cell matrix.';
  } else if (donor === 'O_NEGATIVE') {
    explanation = 'O negative appears as a donor group for every recipient in this matrix.';
  } else if (recipient === 'AB_POSITIVE') {
    explanation = 'AB positive appears as a recipient group for every donor in this matrix.';
  } else {
    explanation = 'Listed as compatible in this illustrative red-cell matrix.';
  }

  return { recipient, donor, compatible, explanation, note: RBC_COMPATIBILITY_NOTE };
}

export function getRbcMatrix(recipient: RbcGroup): RbcMatrixRow[] {
  return BLOOD_GROUPS.map((donor) => ({
    donor,
    compatibility: getRbcCompatibility(recipient, donor),
  }));
}

export function getCompatibleDonorCount(recipient: RbcGroup): number {
  return RBC_DONORS_BY_RECIPIENT[recipient].length;
}
