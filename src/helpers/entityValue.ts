import { jsonRpcRequest } from './utils';

type Proposal = {
  network: string;
  strategies: any[];
  start: number;
};

const OVERLORD_URL = process.env.OVERLORD_URL ?? 'https://overlord.snapshot.box';
// Round strategy values to 9 decimal places
const STRATEGIES_VALUE_PRECISION = 9;

export async function getVpValueByStrategy(proposal: Proposal): Promise<number[]> {
  const result: number[] = await jsonRpcRequest(OVERLORD_URL, 'get_value_by_strategy', {
    network: proposal.network,
    strategies: proposal.strategies,
    snapshot: proposal.start // Expecting timestamp and not block number
  });

  // Handle unlikely case where strategies value array length does not match strategies length
  if (result.length !== proposal.strategies.length) {
    throw new Error('Strategies value length mismatch');
  }

  return result.map(value => parseFloat(value.toFixed(STRATEGIES_VALUE_PRECISION)));
}

/**
 * Calculates the total vote value based on the voting power and the proposal's value per strategy.
 * @returns The total vote value, in the currency unit specified by the proposal's vp_value_by_strategy values
 **/
export function getVoteValue(vp_value_by_strategy: number[], vp_by_strategy: number[]): number {
  if (!vp_value_by_strategy.length) return 0;

  if (vp_value_by_strategy.length !== vp_by_strategy.length) {
    throw new Error('invalid data to compute vote value');
  }

  return vp_value_by_strategy.reduce((sum, value, index) => sum + value * vp_by_strategy[index], 0);
}

/**
 * Calculates the proposal total value based on all votes' total voting power and the proposal's value per strategy.
 * @returns The total value of the given proposal's votes, in the currency unit specified by the proposal's vp_value_by_strategy values
 */
export function getProposalValue(
  scores_by_strategy: number[][],
  vp_value_by_strategy: number[]
): number {
  if (
    !scores_by_strategy.length ||
    !scores_by_strategy[0]?.length ||
    !vp_value_by_strategy.length
  ) {
    return 0;
  }

  // Validate that all voteScores arrays have the same length as vp_value_by_strategy
  for (const voteScores of scores_by_strategy) {
    if (voteScores.length !== vp_value_by_strategy.length) {
      throw new Error(
        'Array size mismatch: voteScores length does not match vp_value_by_strategy length'
      );
    }
  }

  let totalValue = 0;
  for (let strategyIndex = 0; strategyIndex < vp_value_by_strategy.length; strategyIndex++) {
    const strategyTotal = scores_by_strategy.reduce((sum, voteScores) => {
      const score = voteScores[strategyIndex];
      if (typeof score !== 'number') {
        throw new Error(`Invalid score value: expected number, got ${typeof score}`);
      }
      return sum + score;
    }, 0);

    if (typeof vp_value_by_strategy[strategyIndex] !== 'number') {
      throw new Error(
        `Invalid vp_value: expected number, got ${typeof vp_value_by_strategy[strategyIndex]}`
      );
    }

    totalValue += strategyTotal * vp_value_by_strategy[strategyIndex];
  }

  return totalValue;
}
