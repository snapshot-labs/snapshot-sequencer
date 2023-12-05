import snapshot from '@snapshot-labs/snapshot.js';
import log from './log';
import { capture } from '@snapshot-labs/snapshot-sentry';

const DEFAULT_NETWORK = process.env.DEFAULT_NETWORK ?? '1';
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export async function getSpaceENS(id) {
  let space = false;
  const uri: string | null = await snapshot.utils.getSpaceUri(id, DEFAULT_NETWORK, { broviderUrl });
  if (uri && (uri.startsWith('ipfs://') || uri.startsWith('https://'))) {
    try {
      space = await snapshot.utils.getJSON(uri);
    } catch (e) {
      capture(e, { id, uri });
      log.warn(`[ens] getSpaceENS failed ${id}, ${JSON.stringify(e)}`);
    }
  }
  return space;
}
