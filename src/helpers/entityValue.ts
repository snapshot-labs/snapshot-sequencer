import { randomUUID } from 'crypto';
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
      id: randomUUID()
    })
  };

  try {
    const res = await fetchWithKeepAlive(OVERLORD_URL, init);

    // Check HTTP status
    if (!res.ok) {
      capture(new Error('HTTP error response'), {
        status: res.status,
        statusText: res.statusText,
        url: OVERLORD_URL
      });
      return Promise.reject(`HTTP error: ${res.status} ${res.statusText}`);
    }

    const response = await res.json();

    // Handle JSON-RPC error response
    if (response.error) {
      capture(new Error('JSON-RPC error response'), {
        error: response.error,
        request: {
          network: proposal.network,
          strategiesLength: proposal.strategies.length,
          snapshot: proposal.start
        }
      });
      return Promise.reject(
        `JSON-RPC error: ${response.error.message || response.error.code || 'Unknown error'}`
      );
    }

    const { result } = response;

    // Handle unlikely case where strategies value array length does not match strategies length
    if (result.length !== proposal.strategies.length) {
      capture(new Error('Strategies value length mismatch'), {
        strategiesLength: proposal.strategies.length,
        result: JSON.stringify(result)
      });
      return Promise.reject('failed to get strategies value');
    }

    return result.map(value => parseFloat(value.toFixed(STRATEGIES_VALUE_PRECISION)));
  } catch (error) {
    capture(new Error('Network or parsing error'), {
      error: error instanceof Error ? error.message : String(error),
      url: OVERLORD_URL,
      request: {
        network: proposal.network,
        strategiesLength: proposal.strategies.length,
        snapshot: proposal.start
      }
    });
    return Promise.reject(
      `Failed to fetch strategies value: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
