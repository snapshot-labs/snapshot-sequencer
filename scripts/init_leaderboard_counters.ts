import 'dotenv/config';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/init_leaderboard_counters.ts --pivot TIMESTAMP
async function main() {
  let pivot: number | null = null;

  process.argv.forEach((arg, index) => {
    if (arg === '--pivot') {
      if (!process.argv[index + 1]) throw new Error('Pivot timestamp is missing');
      console.log('Filtered by votes.created >=', process.argv[index + 1]);
      pivot = +process.argv[index + 1].trim();
    }
  });

  if (!pivot) {
    const firstVoted = await db.queryAsync(
      'SELECT created FROM votes ORDER BY created ASC LIMIT 1'
    );
    if (!firstVoted.length) throw new Error('No votes found in the database');
    pivot = firstVoted[0].created as number;
  }

  await processVotesCount(pivot);
}

async function processVotesCount(pivot: number) {
  const processedVoters = new Set<string>();
  const batchWindow = 60 * 60 * 24; // 1 day
  console.log(`Processing voters from ${pivot} to ${pivot + batchWindow}`);

  let _pivot = pivot;

  while (_pivot < Date.now() / 1000) {
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

    for (const id of Array.from(new Set<string>(votersId.values()))) {
      if (processedVoters.has(id)) {
        continue;
      }

      processedVoters.add(id);

      process.stdout.write(`\n${id} `);
      const votes = await db.queryAsync(
        'SELECT space, COUNT(voter) as votes_count, MAX(created) as last_vote FROM votes WHERE voter = ? GROUP BY space',
        id
      );

      votes.forEach(async vote => {
        await db.queryAsync(
          `
            INSERT INTO leaderboard (vote_count, last_vote, user, space)
            VALUES(?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE vote_count = ?, last_vote = ?
            `,
          [vote.votes_count, vote.last_vote, id, vote.space, vote.votes_count, vote.last_vote]
        );

        process.stdout.write('.');
      });

      _pivot = _pivot + batchWindow;
      count += 1;
    }

    console.log(
      `\nProcessed ${count} voters (${Math.round(count / (+new Date() / 1000 - startTs))} voters/s)`
    );
  }

  console.log(`Processed ${processedVoters.size} voters`);
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
