import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
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

/**
 * Calculates the proposal total value based on all votes' total voting power and the proposal's value per strategy.
 * @returns The total value of the given proposal's votes, in the currency unit specified by the proposal's vp_value_by_strategy values
 */
export function getProposalValue(
  scoresByStrategy: number[][],
  vpValueByStrategy: number[]
): number {
  if (!scoresByStrategy.length || !scoresByStrategy[0].length || !vpValueByStrategy.length) {
    return 0;
  }

  // Validate that all voteScores arrays have the same length as vpValueByStrategy
  for (const voteScores of scoresByStrategy) {
    if (voteScores.length !== vpValueByStrategy.length) {
      throw new Error(
        'Array size mismatch: voteScores length does not match vpValueByStrategy length'
      );
    }
  }

  return vpValueByStrategy.reduce((totalValue, strategyValue, strategyIndex) => {
    const strategyTotal = scoresByStrategy.reduce(
      (sum, voteScores) => sum + voteScores[strategyIndex],
      0
    );
    return totalValue + strategyTotal * strategyValue;
  }, 0);
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
