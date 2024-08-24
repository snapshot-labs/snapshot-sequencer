const SNAPSHOT_ENV = process.env.NETWORK || 'testnet';

export const FLAGGED_SPACE_PROPOSAL_DAY_LIMIT = 0;
export const FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT = 0;

export const SPACE_PROPOSAL_DAY_LIMIT = 3;
export const SPACE_PROPOSAL_MONTH_LIMIT = 15;

export const VERIFIED_SPACE_PROPOSAL_DAY_LIMIT = 20;
export const VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT = 100;

export const TURBO_SPACE_PROPOSAL_DAY_LIMIT = 40;
export const TURBO_SPACE_PROPOSAL_MONTH_LIMIT = 200;

export const ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT = 150;
export const ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT = 750;

export const FOLLOWS_LIMIT_PER_USER = 25;

export const MAINNET_ECOSYSTEM_SPACES = [
  'orbapp.eth',
  'cakevote.eth',
  'outcome.eth',
  'polls.lenster.xyz',
  'daotest.dcl.eth',
  'arbitrumfoundation.eth'
];

export const TESTNET_ECOSYSTEM_SPACES = ['citiesdao.eth'];

export const ACTIVE_PROPOSAL_BY_AUTHOR_LIMIT = 20;

export function getSpaceLimits(space): number[] {
  if (space.flagged) {
    return [FLAGGED_SPACE_PROPOSAL_DAY_LIMIT, FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  const ecosystemSpaces =
    SNAPSHOT_ENV === 'testnet' ? TESTNET_ECOSYSTEM_SPACES : MAINNET_ECOSYSTEM_SPACES;

  if (ecosystemSpaces.includes(space.id)) {
    return [ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT, ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  if (space.turbo) {
    return [TURBO_SPACE_PROPOSAL_DAY_LIMIT, TURBO_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  if (space.verified || SNAPSHOT_ENV === 'testnet') {
    return [VERIFIED_SPACE_PROPOSAL_DAY_LIMIT, VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT];
  }

  return [SPACE_PROPOSAL_DAY_LIMIT, SPACE_PROPOSAL_MONTH_LIMIT];
}
