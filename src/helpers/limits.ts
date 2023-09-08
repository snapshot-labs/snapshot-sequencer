import { flaggedSpaces, verifiedSpaces } from './moderation';

export const SPACE_PROPOSAL_DAY_LIMIT = 500;
export const SPACE_PROPOSAL_MONTH_LIMIT = 50000;

export const VERIFIED_SPACE_PROPOSAL_DAY_LIMIT = 20;
export const VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT = 200;

export const FLAGGED_SPACE_PROPOSAL_DAY_LIMIT = 1;
export const FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT = 10;

export const ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT = 150;
export const ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT = 1000;
export const ECOSYSTEM_SPACES = [
  'orbapp.eth',
  'cakevote.eth',
  'outcome.eth',
  'polls.lenster.xyz',
  'daotest.dcl.eth'
];

export const ACTIVE_PROPOSAL_BY_AUTHOR_LIMIT = 10;

export function getSpaceLimits(space): number[] {
  if (flaggedSpaces.includes(space)) {
    return [FLAGGED_SPACE_PROPOSAL_DAY_LIMIT, FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  if (ECOSYSTEM_SPACES.includes(space)) {
    return [ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT, ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  if (verifiedSpaces.includes(space)) {
    return [VERIFIED_SPACE_PROPOSAL_DAY_LIMIT, VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  return [SPACE_PROPOSAL_DAY_LIMIT, SPACE_PROPOSAL_MONTH_LIMIT];
}
