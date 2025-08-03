import hubDB from './mysql';
import { fetchWithKeepAlive } from './utils';

type Proposal = {
  id: string;
  network: string;
  strategies: any[];
  start: number;
};

const OVERLORD_URL = 'https://overlord.snapshot.org';
const CB_LAST = 5;
const CB_ERROR = 0;

export async function setProposalVpValue(proposal: Proposal) {
  if (proposal.start > Date.now()) {
    return;
  }

  try {
    const vpValue = await getVpValue(proposal);

    await hubDB.queryAsync('UPDATE proposals SET vp_value = ?, cb = ? WHERE id = ? LIMIT 1', [
      vpValue,
      CB_LAST,
      proposal.id
    ]);
  } catch {
    await hubDB.queryAsync('UPDATE proposals SET cb = ? WHERE id = ? LIMIT 1', [
      CB_ERROR,
      proposal.id
    ]);
    return;
  }
}

async function getVpValue(proposal: Proposal) {
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
