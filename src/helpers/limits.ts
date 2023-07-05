import { flaggedSpaces, verifiedSpaces } from './moderation';

export const SPACE_PROPOSAL_DAY_LIMIT = 10;
export const SPACE_PROPOSAL_MONTH_LIMIT = 100;

export const VERIFIED_SPACE_PROPOSAL_DAY_LIMIT = 30;
export const VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT = 300;

export const FLAGGED_SPACE_PROPOSAL_DAY_LIMIT = 5;
export const FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT = 50;

export const ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT = 100;
export const ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT = 1000;
export const ECOSYSTEM_SPACES = ['orbapp.eth', 'cakevote.eth'];

export function getSpaceLimits(space): number[] {
  if (verifiedSpaces.includes(space)) {
    return [VERIFIED_SPACE_PROPOSAL_DAY_LIMIT, VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  if (flaggedSpaces.includes(space)) {
    return [FLAGGED_SPACE_PROPOSAL_DAY_LIMIT, FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  if (ECOSYSTEM_SPACES.includes(space)) {
    return [ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT, ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  return [SPACE_PROPOSAL_DAY_LIMIT, SPACE_PROPOSAL_MONTH_LIMIT];
}
