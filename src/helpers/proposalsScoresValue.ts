import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { getProposalValue } from './entityValue';
import db from './mysql';
import { CB } from '../constants';

type Proposal = {
  id: string;
  vpValueByStrategy: number[];
  scoresByStrategy: number[][];
};

const REFRESH_INTERVAL = 10 * 1000;
const BATCH_SIZE = 25;

async function getProposals(): Promise<Proposal[]> {
  const query = `
    SELECT id, vp_value_by_strategy, scores_by_strategy
    FROM proposals
    WHERE cb = ? AND end < UNIX_TIMESTAMP() AND scores_state = ?
    ORDER BY created ASC
    LIMIT ?
  `;
  const proposals = await db.queryAsync(query, [CB.PENDING_CLOSE, 'final', BATCH_SIZE]);

  return proposals.map((p: any) => ({
    id: p.id,
    vpValueByStrategy: JSON.parse(p.vp_value_by_strategy),
    scoresByStrategy: JSON.parse(p.scores_by_strategy)
  }));
}

async function refreshScoresTotal(proposals: Proposal[]) {
  const query: string[] = [];
  const params: any[] = [];

  proposals.map(proposal => {
    query.push('UPDATE proposals SET scores_total_value = ?, cb = ? WHERE id = ? LIMIT 1');

    try {
      const scoresTotalValue = getProposalValue(
        proposal.scoresByStrategy,
        proposal.vpValueByStrategy
      );
      params.push(scoresTotalValue, CB.FINAL, proposal.id);
    } catch (e) {
      capture(e);
      params.push(0, CB.INELIGIBLE, proposal.id);
    }
  });

  if (query.length) {
    await db.queryAsync(query.join(';'), params);
  }
}

export default async function run() {
  while (true) {
    const proposals = await getProposals();

    if (proposals.length) {
      await refreshScoresTotal(proposals);
    }

    if (proposals.length < BATCH_SIZE) {
      await snapshot.utils.sleep(REFRESH_INTERVAL);
    }
  }
}
