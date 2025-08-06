import { capture } from '@snapshot-labs/snapshot-sentry';
import { fetchWithKeepAlive } from './utils';

type Proposal = {
  network: string;
  strategies: any[];
  start: number;
};

const OVERLORD_URL = 'https://overlord.snapshot.org';
const STRATEGIES_VALUE_PRECISION = 9;

export async function getStrategiesValue(proposal: Proposal): Promise<number[]> {
  const init = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'get_vp_value_by_strategy',
      params: {
        network: proposal.network,
        strategies: proposal.strategies,
        snapshot: proposal.start
      },
      id: Math.random().toString(36).substring(7)
    })
  };
  const res = await fetchWithKeepAlive(OVERLORD_URL, init);
  const { result } = await res.json();

  // Handle unlikely case where strategies value array length does not match strategies length
  if (result.length !== proposal.strategies.length) {
    capture(new Error('Strategies value length mismatch'), {
      strategiesLength: proposal.strategies.length,
      result: JSON.stringify(result)
    });
    return Promise.reject('failed to get strategies value');
  }

  return result.map(value => parseFloat(value.toFixed(STRATEGIES_VALUE_PRECISION)));
}
