import snapshot from '@snapshot-labs/snapshot.js';

const DEFAULT_NETWORK = process.env.DEFAULT_NETWORK ?? '1';
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export async function getSpaceENS(id: string): Promise<Record<string, any>> {
  const uri: any = await snapshot.utils.getSpaceUri(id, DEFAULT_NETWORK, { broviderUrl });

  if (uri) {
    if (!isValidUri(uri)) {
      return Promise.reject(new Error('TXT record is not a valid uri'));
    }

    try {
      return await snapshot.utils.getJSON(uri);
    } catch (e) {
      return Promise.reject(new Error(`${uri} is not a valid JSON file`));
    }
  }

  return Promise.reject(new Error(`missing snapshot TXT record on ENS name ${id}`));
}

function isValidUri(uri: string): boolean {
  return /^(ip[fn]s|https?):\/\//.test(uri);
}
