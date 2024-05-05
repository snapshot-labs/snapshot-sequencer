import { FOLLOWS_LIMIT_PER_USER } from '../helpers/limits';
import db from '../helpers/mysql';

const NETWORK_WHITELIST = [
  's',
  's-tn',
  'eth',
  'matic',
  'arb1',
  'oeth',
  'gor',
  'sep',
  'linea-testnet',
  'sn',
  'sn-tn',
  'sn-sep'
];

export const getFollowsCount = async (follower: string): Promise<number> => {
  const query = `SELECT COUNT(*) AS count FROM follows WHERE follower = ?`;

  const [{ count }] = await db.queryAsync(query, [follower]);

  return count;
};

export async function verify(message): Promise<any> {
  const count = await getFollowsCount(message.from);

  if (count >= FOLLOWS_LIMIT_PER_USER) {
    return Promise.reject(`you can join max ${FOLLOWS_LIMIT_PER_USER} spaces`);
  }

  if (message.network && !NETWORK_WHITELIST.includes(message.network)) {
    return Promise.reject(`network ${message.network} is not allowed`);
  }

  return true;
}

export async function action(message, ipfs, receipt, id): Promise<void> {
  const params = {
    id,
    ipfs,
    follower: message.from,
    space: message.space,
    network: message.network || 's',
    created: message.timestamp
  };

  await db.queryAsync('INSERT INTO follows SET ?', params);
}
