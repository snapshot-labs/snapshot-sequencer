import { requestDeduplicatorSize } from './metrics';
import { sha256 } from './utils';

const ongoingRequests = new Map();

export default async function serve(id, action, args) {
  const key = sha256(id);
  if (!ongoingRequests.has(key)) {
    ongoingRequests.set(
      key,
      action(...args).finally(() => ongoingRequests.delete(key))
    );
  }

  requestDeduplicatorSize.set(ongoingRequests.size);
  return ongoingRequests.get(key);
}
