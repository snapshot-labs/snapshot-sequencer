import { getSpace } from '../helpers/actions';
import { FOLLOWS_LIMIT_PER_USER } from '../helpers/limits';
import db from '../helpers/mysql';

const MAINNET_NETWORK_WHITELIST = ['s', 'eth', 'matic', 'arb1', 'oeth', 'sn'];
const TESTNET_NETWORK_WHITELIST = ['s-tn', 'gor', 'sep', 'linea-testnet', 'sn-tn', 'sn-sep'];

export const getFollowsCount = async (follower: string): Promise<number> => {
  const query = `SELECT COUNT(*) AS count FROM follows WHERE follower = ?`;

  const [{ count }] = await db.queryAsync(query, [follower]);

  return count;
};

export const networks =
  process.env.NETWORK === 'testnet' ? TESTNET_NETWORK_WHITELIST : MAINNET_NETWORK_WHITELIST;
export const defaultNetwork = networks[0];

export async function verify(message): Promise<any> {
  const count = await getFollowsCount(message.from);

  if (count >= FOLLOWS_LIMIT_PER_USER) {
    return Promise.reject(`you can join max ${FOLLOWS_LIMIT_PER_USER} spaces`);
  }

  if (message.network && !networks.includes(message.network)) {
    return Promise.reject(`network ${message.network} is not allowed`);
  }

  if (message.network === defaultNetwork) {
    const space = await getSpace(message.space);
    if (!space) return Promise.reject('unknown space');
  }

  return true;
}

export async function action(message, ipfs, receipt, id): Promise<void> {
  const params = {
    id,
    ipfs,
    follower: message.from,
    space: message.space,
    network: message.network || defaultNetwork,
    created: message.timestamp
  };

  await db.queryAsync('INSERT INTO follows SET ?', params);
}
