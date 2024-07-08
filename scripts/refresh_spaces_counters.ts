import 'dotenv/config';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/refresh_spaces_counters.ts
async function main() {
  const spaces = await db.queryAsync(`SELECT id FROM spaces`);

  console.log(`Found ${spaces.length} spaces`);

  for (const i in spaces) {
    const stats = await db.queryAsync(
      `SELECT COUNT(voter) as vote_count FROM votes WHERE space = ?`,
      [spaces[i].id]
    );
    const stat = stats[0];
    await db.queryAsync(`UPDATE spaces SET vote_count = ? WHERE id = ?`, [
      stat.vote_count,
      spaces[i].id
    ]);
    console.log(`${i} / ${spaces.length}`);
  }

  await db.queryAsync(
    'UPDATE spaces SET proposal_count = (SELECT count(id) from proposals WHERE space = spaces.id)'
  );

  await db.queryAsync(
    'UPDATE spaces SET follower_count = (SELECT count(id) from follows WHERE space = spaces.id)'
  );
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
