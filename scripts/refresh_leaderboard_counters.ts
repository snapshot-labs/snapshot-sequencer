import 'dotenv/config';
import db from '../src/helpers/mysql';
import { refreshProposalsCount, refreshVotesCount } from '../src/helpers/actions';

const ALLOWED_TYPES = ['proposal', 'vote'];

// Usage: yarn ts-node scripts/refresh_leaderboard_counters.ts --type proposal|vote --space OPTIONAL-SPACE-ID --pivot TIMESTAMP
async function main() {
  let pivot = 0;
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

  if (types.includes('proposal')) {
    await processProposalsCount(spaces);
  } else if (types.includes('vote')) {
    await processVotesCount(spaces, pivot);
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

async function processVotesCount(spaces: string[], pivot: number) {
  console.log('Building voters list, this may take a while... (each step is 500k voters)');

  const voters: Map<string, number> = new Map();
  let index = 0;
  let _pivot = pivot;

  while (true) {
    process.stdout.write(index % 10 === 0 ? '_' : '.');
    const params: any[] = [_pivot];
    if (spaces.length) params.push(spaces);

    const users = await db.queryAsync(
      `SELECT distinct(voter) as id, created FROM votes WHERE created > ?
      ${spaces.length ? 'AND space IN (?)' : ''}
      ORDER BY created ASC LIMIT 500000`,
      params
    );
    if (!users.length) break;

    _pivot = users[users.length - 1].created;
    index += 1;
    users.forEach(user => {
      if (!voters.has(user.id)) {
        voters.set(user.id, user.created);
      }
    });
  }

  console.log(`Found ${voters.size} unique voters`);

  let i = 0;
  for (const [voterId, ts] of voters.entries()) {
    console.log(`Processing user ${voterId} (${+i + 1}/${voters.size}) - (pivot:${ts})`);

    const votesCountRes = await refreshVotesCount(spaces, [voterId]);
    console.log(
      ` VOTE_COUNT     >`,
      `Affected: ${votesCountRes.affectedRows}`,
      `Changed: ${votesCountRes.changedRows}`
    );
    i += 1;
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
