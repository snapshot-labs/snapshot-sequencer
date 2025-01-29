import db from './mysql';

type Space = { verified: boolean; turbo: boolean; flagged: boolean; id: string };
type SpaceType = 'space' | 'flagged_space' | 'verified_space' | 'turbo_space' | 'ecosystem_space';

const lists = new Map<string, string[]>();
const limits = new Map<string, number>();

async function loadOptions() {
  const results = await db.queryAsync('SELECT name, value FROM options');

  results.forEach(row => {
    if (row.name.includes('limit')) {
      limits.set(row.name, Number(row.value));
    } else {
      lists.set(row.name, row.value.split(','));
    }
  });
}

loadOptions();

function getSpaceType(space: Space): SpaceType {
  let type: null | string = null;

  if (getLists('ecosystem_spaces').includes(space.id)) {
    type = 'ecosystem';
  }
  if (space.flagged) type = 'flagged';
  if (space.verified) type = 'verified';
  if (space.turbo) type = 'turbo';

  return [type, 'space'].join('_') as SpaceType;
}

export function getLimits(key: string): number {
  return limits.get(key) || 0;
}

export function getLists(key: string): string[] {
  return lists.get(key) || [];
}

export function getSpaceProposalsLimits(space: Space, interval: 'day' | 'month'): number {
  return getLimits(`limit.${getSpaceType(space)}.proposal.${interval}`);
}
