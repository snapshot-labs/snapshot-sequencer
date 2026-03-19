import snapshot from '@snapshot-labs/snapshot.js';
import log from './log';
import db from './mysql';
import { CB } from '../constants';

type Vote = {
  id: string;
  voter: string;
  space: string;
};

const REFRESH_INTERVAL = 60 * 1000;
const BATCH_SIZE = 100;

async function getVotesPendingDeletion(): Promise<Vote[]> {
  return db.queryAsync(`SELECT id, voter, space FROM votes WHERE cb = ? LIMIT ?`, [
    CB.PENDING_DELETE,
    BATCH_SIZE
  ]);
}

async function processVotes(votes: Vote[]) {
  const query: string[] = [];
  const params: (string | number | string[])[] = [];

  // Update spaces vote_count
  const grouped = new Map<string, Vote[]>();
  for (const vote of votes) {
    if (!grouped.has(vote.space)) {
      grouped.set(vote.space, []);
    }
    grouped.get(vote.space)!.push(vote);
  }

  for (const [space, spaceVotes] of grouped) {
    query.push('UPDATE spaces SET vote_count = GREATEST(vote_count - ?, 0) WHERE id = ?');
    params.push(spaceVotes.length, space);
  }

  // Delete votes
  query.push('DELETE FROM votes WHERE id IN (?)');
  params.push(votes.map(v => v.id));

  // Refresh leaderboard from remaining votes (idempotent)
  const pairs = new Set(votes.map(v => `${v.voter}:${v.space}`));
  for (const pair of pairs) {
    const [voter, space] = pair.split(':');
    query.push(
      `UPDATE leaderboard
        SET vote_count = (SELECT COUNT(*) FROM votes v WHERE v.voter = ? AND v.space = ?),
            vp_value = COALESCE((
              SELECT SUM(v.vp_value) FROM votes v WHERE v.voter = ? AND v.space = ?
            ), 0)
        WHERE user = ? AND space = ?`
    );
    params.push(voter, space, voter, space, voter, space);
  }

  await db.queryAsync(query.join(';'), params);
}

export default async function run() {
  while (true) {
    const votes = await getVotesPendingDeletion();

    if (votes.length) {
      log.info(`[deleteProposalVotes] ${votes.length} votes to delete`);
      await processVotes(votes);
    }

    if (votes.length < BATCH_SIZE) {
      log.info('[deleteProposalVotes] sleeping');
      await snapshot.utils.sleep(REFRESH_INTERVAL);
    }
  }
}
