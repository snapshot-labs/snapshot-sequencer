import 'dotenv/config';
import { refreshProposalsCount, refreshVotesCount } from '../src/helpers/actions';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/generate_user_space_activities_counters.ts
async function main() {
  console.log('Inserting/Updating proposals_count');
  const proposalsCountRes = await refreshProposalsCount();
  console.log(proposalsCountRes);

  console.log('Inserting/Updating votes_count');
  let page = 0;
  const batchSize = 1000;
  const results: any[] = [];

  while (true) {
    const result = await db.queryAsync('SELECT id FROM spaces ORDER BY RAND () LIMIT ? OFFSET ?', [
      batchSize,
      page * batchSize
    ]);

    if (result.length === 0) {
      break;
    }

    page += 1;
    results.push(result);
  }

  for (const index in results) {
    console.log(`Processing batch ${index + 1}/${results.length}`);
    const votesCountRes = await refreshVotesCount(results[index].map(d => d.id));
    console.log(votesCountRes);
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