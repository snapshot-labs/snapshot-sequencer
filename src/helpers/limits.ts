export const FLAGGED_SPACE_PROPOSAL_DAY_LIMIT = 1;
export const FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT = 5;

export const SPACE_PROPOSAL_DAY_LIMIT = 5;
export const SPACE_PROPOSAL_MONTH_LIMIT = 25;

export const VERIFIED_SPACE_PROPOSAL_DAY_LIMIT = 20;
export const VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT = 100;

export const ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT = 150;
export const ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT = 750;

export const FOLLOWS_LIMIT_PER_USER = 50;

export const ECOSYSTEM_SPACES = [
  'orbapp.eth',
  'cakevote.eth',
  'outcome.eth',
  'polls.lenster.xyz',
  'daotest.dcl.eth',
  'arbitrumfoundation.eth'
];

export const ACTIVE_PROPOSAL_BY_AUTHOR_LIMIT = 20;

export function getSpaceLimits(space): number[] {
  if (space.flagged) {
    return [FLAGGED_SPACE_PROPOSAL_DAY_LIMIT, FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  if (ECOSYSTEM_SPACES.includes(space.id)) {
    return [ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT, ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  if (space.verified) {
    return [VERIFIED_SPACE_PROPOSAL_DAY_LIMIT, VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  return [SPACE_PROPOSAL_DAY_LIMIT, SPACE_PROPOSAL_MONTH_LIMIT];
}
