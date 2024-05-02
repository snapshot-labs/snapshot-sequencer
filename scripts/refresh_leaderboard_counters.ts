import 'dotenv/config';
import db from '../src/helpers/mysql';
import { refreshProposalsCount, refreshVotesCount } from '../src/helpers/actions';

// Usage: yarn ts-node scripts/refresh_leaderboard_counters.ts --space [OPTIONAL-SPACE-ID] --pivot TIMESTAMP
async function main() {
  let spacesFilter = '';
  let usersFilter = '';

  process.argv.forEach((arg, index) => {
    if (arg === '--space') {
      if (!process.argv[index + 1]) throw new Error('Space ID is missing');
      console.log('Filtered by spaces.id =', process.argv[index + 1]);
      spacesFilter = `WHERE space = '${process.argv[index + 1].trim()}'`;
    }

    if (arg === '--pivot') {
      if (!process.argv[index + 1]) throw new Error('Pivot timestamp is missing');
      console.log('Filtered by users.created >=', process.argv[index + 1]);
      usersFilter = `WHERE created >= ${process.argv[index + 1].trim()}`;
    }
  });
  console.log('');

  const users: { id: string; created: number }[] = await db.queryAsync(
    `SELECT id, created FROM users ${usersFilter} ORDER BY created ASC`
  );

  for (const userIndex in users) {
    const { id: user, created } = users[userIndex];
    console.log(`Processing user ${user} (${+userIndex + 1}/${users.length}) - (ts:${created})`);

    const spaces: { space: string }[] = await db.queryAsync(
      `SELECT DISTINCT(space) FROM votes ${
        spacesFilter || 'WHERE 1=1'
      } AND voter = ? GROUP BY space`,
      user
    );

    const proposalsCountRes = await refreshProposalsCount([], [user]);
    console.log(
      ` PROPOSAL_COUNT >`,
      `Affected: ${proposalsCountRes.affectedRows}`,
      `Changed: ${proposalsCountRes.changedRows}`
    );

    for (const spaceIndex in spaces) {
      const space = spaces[spaceIndex].space;

      const votesCountRes = await refreshVotesCount([space], [user]);
      console.log(
        ` VOTE_COUNT     >`,
        `Affected: ${votesCountRes.affectedRows}`,
        `Changed: ${votesCountRes.changedRows}`,
        `- ${space}`
      );
    }
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
