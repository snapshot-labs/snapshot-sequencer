import 'dotenv/config';
import { refreshProposalsCount, refreshVotesCount } from '../src/helpers/actions';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/refresh_leaderboard_counters.ts --space [OPTIONAL-SPACE-ID] --pivot TIMESTAMP
async function main() {
  const filters: string[] = [];

  process.argv.forEach((arg, index) => {
    if (arg === '--space') {
      if (!process.argv[index + 1]) throw new Error('Space ID is missing');
      console.log('Filtered by space:', process.argv[index + 1]);
      filters.push(`id = '${process.argv[index + 1]}'`);
    }

    if (arg === '--pivot') {
      if (!process.argv[index + 1]) throw new Error('Pivot timestamp is missing');
      console.log('Filtered by created >= ', process.argv[index + 1]);
      filters.push(`created >= ${process.argv[index + 1]}`);
    }
  });

  const filtersQuery = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `SELECT id, name, created FROM spaces ${filtersQuery} ORDER BY created ASC`;

  const spaces: { id: string; name: string; created: number }[] = await db.queryAsync(query);

  for (const index in spaces) {
    console.log(
      `Processing space #${spaces[index].id} (${spaces[index].name}) (ts:${
        spaces[index].created
      }) - ${+index + 1}/${spaces.length}`
    );

    const votesCountRes = await refreshVotesCount([spaces[index].id]);
    console.log(
      '  Inserting/Updating vote_count - ',
      `Affected: ${votesCountRes.affectedRows}`,
      `Changed: ${votesCountRes.changedRows}`
    );

    const proposalsCountRes = await refreshProposalsCount([spaces[index].id]);
    console.log(
      '  Inserting/Updating proposal_count',
      `Affected: ${proposalsCountRes.affectedRows}`,
      `Changed: ${proposalsCountRes.changedRows}`
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
