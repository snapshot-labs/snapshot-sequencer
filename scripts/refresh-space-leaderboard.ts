import 'dotenv/config';
import db from '../src/helpers/mysql';

// Usage: yarn ts-node scripts/refresh-space-leaderboard.ts --space SPACE-ID
// This script assumes there are no active proposals in the space

async function getFirstAndLastVote(space: string) {
  console.log('Getting first and last vote for space', space);
  const firstVoted = await db.queryAsync(
    'SELECT created FROM votes WHERE space = ? ORDER BY created ASC LIMIT 1',
    [space]
  );

  if (!firstVoted.length) throw new Error('No votes found in the database');
  const firstVote = firstVoted[0].created as number;

  const lastVote = (
    await db.queryAsync('SELECT created FROM votes WHERE space = ? ORDER BY created DESC LIMIT 1', [
      space
    ])
  ).created;

  console.log(
    'Will process votes from',
    new Date(firstVote * 1000),
    'to',
    new Date(lastVote * 1000)
  );

  return { firstVote, lastVote };
}

async function deleteLeaderboard(space: string) {
  console.log('Removing leaderboard for space', space);
  await db.queryAsync(`DELETE FROM leaderboard WHERE space = ?`, [space]);
  console.log('Leaderboard for space', space, 'has been removed');
}

async function main(space) {
  await deleteLeaderboard(space);
  const { firstVote, lastVote } = await getFirstAndLastVote(space);

  // Process votes in chunks of 24 hours
  let start = firstVote;
  while (true) {
    const end = start + 86400; // 24 hours
    console.log('Get votes from', new Date(start * 1000), 'to', new Date(end * 1000));

    await db.queryAsync(
      `
      INSERT INTO leaderboard (space, address, count, last_vote)
      (SELECT space, voter AS address, COUNT(*) AS count, MAX(created) AS last_vote
      FROM votes
      WHERE space = ? AND created >= ? AND created < ?
      GROUP BY voter)
      ON DUPLICATE KEY UPDATE count = count + VALUES(count), last_vote = VALUES(last_vote)
    `,
      [space, start, end]
    );

    if (end > lastVote) break;
    start = end;
  }

  process.exit(0);
}

const space = process.argv[process.argv.indexOf('--space') + 1];
if (!space) throw new Error('Space ID is missing');
main(space);
