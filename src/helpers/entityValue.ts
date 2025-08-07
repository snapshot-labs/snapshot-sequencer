import { jsonRpcRequest } from './utils';

type Proposal = {
  network: string;
  strategies: any[];
  start: number;
};

const OVERLORD_URL = 'https://overlord.snapshot.org';
// Round strategy values to 9 decimal places
const STRATEGIES_VALUE_PRECISION = 9;
const PRECISION_MULTIPLIER = Math.pow(10, STRATEGIES_VALUE_PRECISION);

export async function getStrategiesValue(proposal: Proposal): Promise<number[]> {
  const result: number[] = await jsonRpcRequest(OVERLORD_URL, 'get_vp_value_by_strategy', {
    network: proposal.network,
    strategies: proposal.strategies,
    snapshot: proposal.start
  });

  // Handle unlikely case where strategies value array length does not match strategies length
  if (result.length !== proposal.strategies.length) {
    throw new Error('Strategies value length mismatch');
  }

  return result.map(value => Math.round(value * PRECISION_MULTIPLIER) / PRECISION_MULTIPLIER);
}
