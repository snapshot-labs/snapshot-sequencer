import { sha256 } from './utils';
import { requestDeduplicatorSize } from './metrics';

const ongoingRequests = new Map();

export default async function serve(id, action, args) {
  const key = sha256(id);
  if (!ongoingRequests.has(key)) {
    const requestPromise = action(...args)
      .then(result => {
        return result;
      })
      .catch(e => {
        throw e;
      })
      .finally(() => {
        ongoingRequests.delete(key);
      });
    ongoingRequests.set(key, requestPromise);
  }

  requestDeduplicatorSize.set(ongoingRequests.size);
  return ongoingRequests.get(key);
}
