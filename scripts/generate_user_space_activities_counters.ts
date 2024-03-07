import 'dotenv/config';
import { refreshProposalsCount, refreshVotesCount } from '../src/helpers/actions';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/generate_user_space_activities_counters.ts
async function main() {
  const spaces = await db.queryAsync('SELECT id, name FROM spaces');

  for (const index in spaces) {
    console.log(
      `Processing space #${spaces[index].id} (${spaces[index].name}) - ${index}/${spaces.length}`
    );

    console.log('Inserting/Updating votes_count');
    const votesCountRes = await refreshVotesCount(spaces[index].id);
    console.log(votesCountRes);

    console.log('Inserting/Updating proposals_count');
    const proposalsCountRes = await refreshProposalsCount(spaces[index].id);
    console.log(proposalsCountRes);
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
