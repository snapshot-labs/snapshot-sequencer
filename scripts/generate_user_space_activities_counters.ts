import 'dotenv/config';
import { refreshProposalsCount, refreshVotesCount } from '../src/helpers/actions';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/generate_user_space_activities_counters.ts [OPTIONAL-SPACE-ID]
async function main() {
  const query = `SELECT id, name FROM spaces ${
    process.argv[2] ? `WHERE id = '${process.argv[2]}'` : ''
  }`;

  const spaces: { id: string; name: string }[] = await db.queryAsync(query);

  for (const index in spaces) {
    console.log(
      `Processing space #${spaces[index].id} (${spaces[index].name}) - ${+index + 1}/${
        spaces.length
      }`
    );

    const votesCountRes = await refreshVotesCount([spaces[index].id]);
    console.log(
      'Inserting/Updating votes_count - ',
      `Affected: ${votesCountRes.affectedRows}`,
      `Changed: ${votesCountRes.changedRows}`
    );

    const proposalsCountRes = await refreshProposalsCount([spaces[index].id]);
    console.log(
      'Inserting/Updating proposals_count',
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
