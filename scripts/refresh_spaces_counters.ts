import 'dotenv/config';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/refresh_spaces_counters.ts
async function main() {
  const spaces = await db.queryAsync(`SELECT id FROM spaces`);

  console.log(`Found ${spaces.length} spaces`);

  for (const i in spaces) {
    const stats = await db.queryAsync(
      `SELECT COUNT(voter) as vote_count, COUNT(DISTINCT(proposal)) as proposal_count FROM votes WHERE space = ? GROUP BY space`,
      [spaces[i].id]
    );

    for (const stat of stats) {
      await db.queryAsync(`UPDATE spaces SET vote_count = ?, proposal_count = ? WHERE id = ?`, [
        stat.vote_count,
        stat.proposal_count,
        spaces[i].id
      ]);
      console.log(`${i} / ${spaces.length}`);
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
