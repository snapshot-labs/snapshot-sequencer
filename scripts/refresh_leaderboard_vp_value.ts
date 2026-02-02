import 'dotenv/config';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/refresh_leaderboard_vp_value.ts [--space SPACE-ID] [--from SPACE-ID] [--dry-run]
// This script populates the vp_value in the leaderboard table by summing all vp_value from votes for each user/space

const BATCH_SIZE = 10000;
const MIN_VOTES_PER_BATCH = 1000;

type VoteRow = { user: string; space: string; vp_value: number };
type SpaceRow = { id: string; vote_count: number; scores_total_value: number };
type ProcessResult = { affectedRows: number; changedRows: number; total: number };

async function processSpaces(spaces: SpaceRow[], dryRun = false): Promise<ProcessResult> {
  let rowNum = 0;
  let totalAffected = 0;
  let totalChanged = 0;

  const spaceIds = spaces.map(s => s.id);

  if (!dryRun) {
    await db.queryAsync('UPDATE leaderboard SET vp_value = 0 WHERE space IN (?)', [spaceIds]);
  }

  console.log('\n# | user | space | vp_value');
  console.log('--|------|-------|----------');

  for (const { id: space, scores_total_value: scoresTotalValue } of spaces) {
    if (scoresTotalValue === 0) continue;
    let lastVoter = '';

    while (true) {
      const rows: VoteRow[] = await db.queryAsync(
        `
          SELECT voter AS user, space, SUM(vp_value) AS vp_value
          FROM votes v
          WHERE v.vp_value > 0
            AND v.space = ?
            AND v.voter > ?
          GROUP BY voter
          ORDER BY voter
          LIMIT ?
        `,
        [space, lastVoter, BATCH_SIZE]
      );

      if (rows.length === 0) break;

      for (const row of rows) {
        rowNum++;
        console.log(`${rowNum} | ${row.user} | ${row.space} | ${row.vp_value}`);
      }

      if (!dryRun) {
        const query = rows
          .map(() => 'UPDATE leaderboard SET vp_value = ? WHERE user = ? AND space = ?')
          .join('; ');
        const params = rows.flatMap(row => [row.vp_value, row.user, row.space]);

        const result = await db.queryAsync(query, params);
        const results = Array.isArray(result) ? result : [result];
        totalAffected += results.reduce((sum, r) => sum + (r.affectedRows || 0), 0);
        totalChanged += results.reduce((sum, r) => sum + (r.changedRows || 0), 0);
      }

      lastVoter = rows[rows.length - 1].user;

      if (rows.length < BATCH_SIZE) break;
    }
  }

  return { affectedRows: totalAffected, changedRows: totalChanged, total: rowNum };
}

function parseArgs() {
  let space: string | undefined;
  let from: string | undefined;
  let dryRun = false;

  process.argv.forEach((arg, index) => {
    if (arg === '--space') {
      if (!process.argv[index + 1]) throw new Error('Space ID is missing');
      space = process.argv[index + 1].trim();
    }
    if (arg === '--from') {
      if (!process.argv[index + 1]) throw new Error('From space ID is missing');
      from = process.argv[index + 1].trim();
    }
    if (arg === '--dry-run') {
      dryRun = true;
    }
  });

  return { space, from, dryRun };
}

async function main() {
  const { space, from, dryRun } = parseArgs();

  console.log('Space:', space || 'all');
  if (from) console.log('From:', from);
  if (dryRun) console.log('Dry run mode enabled');

  console.log('Fetching spaces...');
  const params: string[] = [];
  let whereClause = 's.deleted = 0';

  if (space) {
    whereClause += ' AND s.id = ?';
    params.push(space);
  } else if (from) {
    whereClause += ' AND s.id >= ?';
    params.push(from);
  }

  const spaces: SpaceRow[] = await db.queryAsync(
    `SELECT s.id, s.vote_count, COALESCE(SUM(p.scores_total_value), 0) AS scores_total_value
     FROM spaces s
     LEFT JOIN proposals p ON p.space = s.id
     WHERE ${whereClause}
     GROUP BY s.id
     ORDER BY s.id`,
    params
  );
  const totalSpaces = spaces.length;
  console.log(`Found ${totalSpaces} spaces to process`);

  let totalRows = 0;
  let totalAffected = 0;
  let totalChanged = 0;
  let batch: SpaceRow[] = [];
  let batchVotes = 0;
  let processedSpaces = 0;

  for (let i = 0; i < totalSpaces; i++) {
    const spaceRow = spaces[i];
    batch.push(spaceRow);
    batchVotes += spaceRow.vote_count;

    const isLast = i === totalSpaces - 1;
    if (batchVotes >= MIN_VOTES_PER_BATCH || isLast) {
      processedSpaces += batch.length;
      console.log(
        `\n--- Processing ${batch.length} spaces (${batchVotes} votes) [${processedSpaces}/${totalSpaces}] ---`
      );
      console.log(`Spaces: ${batch.map(s => s.id).join(', ')}`);
      const result = await processSpaces(batch, dryRun);
      totalRows += result.total;
      totalAffected += result.affectedRows;
      totalChanged += result.changedRows;

      batch = [];
      batchVotes = 0;
    }
  }

  console.log('\n=== Summary ===');
  if (dryRun) {
    console.log(`Total users that would be affected: ${totalRows}`);
  } else {
    console.log(`Total: ${totalRows}, Affected: ${totalAffected}, Changed: ${totalChanged}`);
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
