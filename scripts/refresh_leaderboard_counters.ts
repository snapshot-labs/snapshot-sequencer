import 'dotenv/config';
import db from '../src/helpers/mysql';

const ALLOWED_TYPES = ['proposal', 'vote'];

async function refreshProposalsCount(spaces?: string[], users?: string[]) {
  const whereFilters: string[] = [];
  const params: string[][] = [];

  if (spaces?.length) {
    whereFilters.push('space IN (?)');
    params.push(spaces);
  }

  if (users?.length) {
    whereFilters.push('author IN (?)');
    params.push(users);
  }

  whereFilters.push('space NOT IN (?)');
  params.push(
    (await db.queryAsync('SELECT id FROM spaces WHERE deleted = 1')).map(space => space.id)
  );

  return db.queryAsync(
    `
      INSERT INTO leaderboard (proposal_count, user, space)
        (SELECT * FROM (
          SELECT COUNT(proposals.id) AS proposal_count, author, space
          FROM proposals
          WHERE ${whereFilters.join(' AND ')}
          GROUP BY author, space
        ) AS t)
      ON DUPLICATE KEY UPDATE proposal_count = t.proposal_count
    `,
    params
  );
}

async function refreshVotesCount(spaces?: string[], users?: string[]) {
  const whereFilters: string[] = [];
  const params: string[][] = [];

  if (spaces?.length) {
    whereFilters.push('space IN (?)');
    params.push(spaces);
  }

  if (users?.length) {
    whereFilters.push('voter IN (?)');
    params.push(users);
  }

  whereFilters.push('space NOT IN (?)');
  params.push(
    (await db.queryAsync('SELECT id FROM spaces WHERE deleted = 1')).map(space => space.id)
  );

  return db.queryAsync(
    `
      INSERT INTO leaderboard (vote_count, last_vote, user, space)
        (SELECT * FROM (
          SELECT COUNT(votes.id) AS vote_count, MAX(votes.created) as last_vote, voter, space
          FROM votes
          WHERE ${whereFilters.join(' AND ')}
          GROUP BY voter, space
        ) AS t)
      ON DUPLICATE KEY UPDATE vote_count = t.vote_count, last_vote = t.last_vote
    `,
    params
  );
}

// Usage: yarn ts-node scripts/refresh_leaderboard_counters.ts --type proposal|vote --space OPTIONAL-SPACE-ID --pivot TIMESTAMP --end TIMESTAMP
async function main() {
  let pivot = 0;
  let end = 0;
  const types: string[] = [];
  const spaces: string[] = [];

  process.argv.forEach((arg, index) => {
    if (arg === '--space') {
      if (!process.argv[index + 1]) throw new Error('Space ID is missing');
      console.log('Filtered by spaces =', process.argv[index + 1]);
      spaces.push(process.argv[index + 1].trim());
    }

    if (arg === '--pivot') {
      if (!process.argv[index + 1]) throw new Error('Pivot timestamp is missing');
      console.log('Filtered by votes.created >=', process.argv[index + 1]);
      pivot = +process.argv[index + 1].trim();
    }

    if (arg === '--end') {
      if (!process.argv[index + 1]) throw new Error('End timestamp is missing');
      console.log('Filtered by votes.created <=', process.argv[index + 1]);
      end = +process.argv[index + 1].trim();
    }

    if (arg === '--type') {
      if (!process.argv[index + 1]) throw new Error('Type is missing');

      const type = process.argv[index + 1].trim();
      if (!ALLOWED_TYPES.includes(type)) throw new Error('Invalid type');

      console.log('Filtered by type:', type);
      types.push(type);
    }
  });

  if (!types.length) {
    types.push('proposal', 'vote');
  }

  if (!pivot) {
    const firstVoted = await db.queryAsync(
      'SELECT created FROM votes ORDER BY created ASC LIMIT 1'
    );
    if (!firstVoted.length) throw new Error('No votes found in the database');
    pivot = firstVoted[0].created as number;
  }

  if (types.includes('proposal')) {
    await processProposalsCount(spaces);
  } else if (types.includes('vote')) {
    await processVotesCount(spaces, pivot, end);
  }
}

async function processProposalsCount(spaces: string[]) {
  const authors = (await db.queryAsync(`SELECT distinct(author) FROM proposals`)).map(
    author => author.author
  );

  const proposalsCountRes = await refreshProposalsCount(spaces, authors);
  console.log(
    ` PROPOSAL_COUNT >`,
    `Affected: ${proposalsCountRes.affectedRows}`,
    `Changed: ${proposalsCountRes.changedRows}`
  );
}

async function processVotesCount(spaces: string[], pivot: number, end?: number) {
  const processedVoters = new Set<string>();
  const batchWindow = 60 * 60 * 24 * 2; // 2 day
  let _pivot = pivot;

  while (_pivot < (end || Date.now() / 1000)) {
    console.log(
      `\nProcessing voters from ${_pivot} to ${_pivot + batchWindow} (${new Date(_pivot * 1000)})`
    );
    const params: any[] = [_pivot, _pivot + batchWindow];
    if (spaces.length) {
      params.push(spaces);
    }
    const votersId = await db
      .queryAsync(
        `SELECT voter FROM votes WHERE created >= ?
      AND created < ?
      ${spaces.length ? 'AND space IN (?)' : ''}
      ORDER BY created ASC`,
        params
      )
      .map(v => v.voter);
    const startTs = +new Date() / 1000;
    let count = 0;
    const newVoters = Array.from(new Set<string>(votersId.values())).filter(
      v => !processedVoters.has(v)
    );

    console.log(`Found ${newVoters.length} new voters`);

    for (const id of newVoters) {
      processedVoters.add(id);

      await refreshVotesCount(spaces, [id]);
      process.stdout.write('.');

      count += 1;
    }

    _pivot = _pivot + batchWindow;
    console.log(
      `\nProcessed ${count} voters (${Math.round(
        count / (+new Date() / 1000 - startTs)
      )} voters/s) - ${processedVoters.size} total processed`
    );
  }
}

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
