import 'dotenv/config';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/refresh_spaces_counters.ts
async function main() {
  const spaces = await db.queryAsync(`SELECT id FROM spaces`);

  console.log(`Found ${spaces.length} spaces`);

  for (const i in spaces) {
    await db.queryAsync(
      `UPDATE spaces SET vote_count = (
        SELECT COALESCE(SUM(vote_count),0) FROM leaderboard WHERE space = ?
      ) WHERE id = ?`,
      [spaces[i].id, spaces[i].id]
    );
    console.log(`${i} / ${spaces.length}`);
  }

  console.log('Updating proposal count');
  await db.queryAsync(
    'UPDATE spaces SET proposal_count = (SELECT count(id) from proposals WHERE space = spaces.id)'
  );

  console.log('Updating follower count');
  await db.queryAsync(
    'UPDATE spaces SET follower_count = (SELECT count(id) from follows WHERE space = spaces.id)'
  );
  console.log('Done! ✅');
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
