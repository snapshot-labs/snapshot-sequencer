import { fetchWithKeepAlive } from './utils';

type Proposal = {
  network: string;
  strategies: any[];
  start: number;
};

const OVERLORD_URL = 'https://overlord.snapshot.org';

export default async function getStrategiesValue(proposal: Proposal): Promise<number[]> {
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
  return result;
}
