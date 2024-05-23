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
  const processedVoters = new Set<string>();
  const batchWindow = 60 * 60 * 24 * 2; // 2 day
  let _pivot = pivot;

  while (_pivot < Date.now() / 1000) {
    console.log(
      `\nProcessing voters from ${_pivot} to ${_pivot + batchWindow} (${new Date(_pivot * 1000)})`
    );
    const votersId = await db
      .queryAsync(
        `SELECT voter FROM votes WHERE created >= ?
      AND created < ?
      ORDER BY created ASC`,
        [_pivot, _pivot + batchWindow]
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
