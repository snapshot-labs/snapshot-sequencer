import snapshot from '@snapshot-labs/snapshot.js';
import log from './log';
import { capture } from './sentry';

const DEFAULT_NETWORK = process.env.DEFAULT_NETWORK ?? '1';

export async function getSpaceENS(id) {
  let space = false;
  const uri: any = await snapshot.utils.getSpaceUri(id, DEFAULT_NETWORK);
  if (uri) {
    try {
      space = await snapshot.utils.getJSON(uri);
    } catch (e) {
      capture(e, { context: { id, uri } });
      log.warn(`[ens] getSpaceENS failed ${id}, ${JSON.stringify(e)}`);
    }
  }
  return space;
}
