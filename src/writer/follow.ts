import { FOLLOWS_LIMIT_PER_USER } from '../helpers/limits';
import db from '../helpers/mysql';

const MAINNET_NETWORK_WHITELIST = ['s', 'eth', 'matic', 'arb1', 'oeth', 'sn'];
const TESTNET_NETWORK_WHITELIST = ['s-tn', 'sep', 'linea-testnet', 'sn-sep'];
export const NETWORK_WHITELIST = [...MAINNET_NETWORK_WHITELIST, ...TESTNET_NETWORK_WHITELIST];

export const getFollowsCount = async (follower: string): Promise<number> => {
  const query = `SELECT COUNT(*) AS count FROM follows WHERE follower = ?`;

  const [{ count }] = await db.queryAsync(query, [follower]);

  return count;
};

export const networks =
  process.env.NETWORK === 'testnet' ? TESTNET_NETWORK_WHITELIST : MAINNET_NETWORK_WHITELIST;
export const defaultNetwork = networks[0];

export async function verify(message): Promise<any> {
  const query = `SELECT * FROM follows WHERE follower = ? AND space = ? LIMIT 1`;
  const follows = await db.queryAsync(query, [message.from, message.space]);

  if (follows.length !== 0) return Promise.reject('you are already following this space');

  const count = await getFollowsCount(message.from);

  if (count >= FOLLOWS_LIMIT_PER_USER) {
    return Promise.reject(`you can join max ${FOLLOWS_LIMIT_PER_USER} spaces`);
  }

  if (message.network && !networks.includes(message.network)) {
    return Promise.reject(`network ${message.network} is not allowed`);
  }

  return true;
}

export async function action(message, ipfs, _receipt, id): Promise<void> {
  const query = `
    INSERT INTO follows SET ?;
    UPDATE spaces SET follower_count = follower_count + 1 WHERE id = ?;
  `;
  const params = {
    id,
    ipfs,
    follower: message.from,
    space: message.space,
    network: message.network || defaultNetwork,
    created: message.timestamp
  };

  await db.queryAsync(query, [params, message.space]);
}
