import { jsonRpcRequest } from './utils';

type Vote = {
  vp_by_strategy: number[];
};

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
export function getVoteValue(proposal: { vp_value_by_strategy: number[] }, vote: Vote): number {
  if (!proposal.vp_value_by_strategy.length) return 0;

  if (proposal.vp_value_by_strategy.length !== vote.vp_by_strategy.length) {
    throw new Error('invalid data to compute vote value');
  }

  return proposal.vp_value_by_strategy.reduce(
    (sum, value, index) => sum + value * vote.vp_by_strategy[index],
    0
  );
}

/**
 * Calculates the proposal total value based on all votes' total voting power and the proposal's value per strategy.
 * @returns The total value of the given proposal's votes, in the currency unit specified by the proposal's vp_value_by_strategy values
 */
export function getProposalValue(
  scoresByStrategy: number[][],
  vpValueByStrategy: number[]
): number {
  if (!scoresByStrategy.length || !scoresByStrategy[0]?.length || !vpValueByStrategy.length) {
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

  let totalValue = 0;
  for (let strategyIndex = 0; strategyIndex < vpValueByStrategy.length; strategyIndex++) {
    const strategyTotal = scoresByStrategy.reduce((sum, voteScores) => {
      return sum + voteScores[strategyIndex];
    }, 0);

    totalValue += strategyTotal * vpValueByStrategy[strategyIndex];
  }

  return totalValue;
}
