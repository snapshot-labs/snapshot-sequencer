import fetch, { Response } from 'node-fetch';
import { DelegateMeta } from '../';

export const MAPPING = {
  's:aave.eth': 'aave',
  's:apecoin.eth': 'apecoin',
  's:arbitrumfoundation.eth': 'arbitrum',
  's:gitcoindao.eth': 'gitcoin',
  's:moonbeam-foundation.eth': 'moonbeam',
  's:opcollective.eth': 'optimism',
  's:rocketpool-dao.eth': 'rocketpool',
  'sn:0x009fedaf0d7a480d21a27683b0965c0f8ded35b3f1cac39827a25a06a8a682a4': 'starknet'
};

export async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  while (retries > 0) {
    try {
      const response: Response = await fn();

      if (!response.ok) {
        throw new Error(`Response not ok: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.log(`Error, retrying...`);
      if (retries > 0) {
        fetchWithRetry(fn, retries - 1);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries reached');
}

export async function fetchSpaceDelegates(spaceId: string): Promise<DelegateMeta[]> {
  const PAGE_SIZE = 1000;
  const delegates: DelegateMeta[] = [];
  let page = 0;

  while (true) {
    console.log(`[karmahq] Fetching page ${page} for ${spaceId}`);

    const response: Response = await fetchWithRetry(() =>
      fetch(
        `https://api.karmahq.xyz/api/dao/delegates?name=${MAPPING[spaceId]}&offset=${page}&pageSize=${PAGE_SIZE}`
      )
    );

    const body = await response.json();

    if (!body.data.delegates.length) break;

    body.data.delegates.map(delegate => {
      const statement = delegate.delegatePitch?.customFields?.find(
        field => field.label === 'statement'
      )?.value;

      if (statement && typeof statement === 'string') {
        delegates.push({ address: delegate.publicAddress, statement });
      }
    });

    page++;
  }

  console.log(
    `[karmahq] Found ${Object.keys(delegates).length} ${spaceId} delegates with statement\n`
  );

  return delegates;
}
