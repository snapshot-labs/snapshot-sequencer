import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { getProposalValue } from './entityValue';
import db from './mysql';
import { CB } from '../constants';

type Proposal = {
  id: string;
  scoresState: string;
  vpValueByStrategy: number[];
  scoresByStrategy: number[][];
};

const REFRESH_INTERVAL = 10 * 1000;
const BATCH_SIZE = 25;

async function getProposals(): Promise<Proposal[]> {
  const query = `
    SELECT id, scores_state as scoresState, vp_value_by_strategy, scores_by_strategy
    FROM proposals
    WHERE cb = ?
    ORDER BY created ASC
    LIMIT ?
  `;
  const proposals = await db.queryAsync(query, [CB.PENDING_CLOSE, BATCH_SIZE]);

  return proposals.map((p: any) => ({
    id: p.id,
    vpValueByStrategy: JSON.parse(p.vp_value_by_strategy),
    scoresByStrategy: JSON.parse(p.scores_by_strategy)
  }));
}

async function refreshScoresTotal(proposals: Proposal[]) {
  const query: string[] = [];
  const params: any[] = [];

  proposals.forEach(proposal => {
    query.push('UPDATE proposals SET scores_total_value = ?, cb = ? WHERE id = ? LIMIT 1');

    try {
      const scoresTotalValue = getProposalValue(
        proposal.scoresByStrategy,
        proposal.vpValueByStrategy
      );
      params.push(
        scoresTotalValue,
        proposal.scoresState === 'final' ? CB.FINAL : CB.PENDING_CLOSE,
        proposal.id
      );
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
