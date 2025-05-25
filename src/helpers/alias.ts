import db from './mysql';

// These types can always be executed with an alias
const TYPES_EXECUTABLE_BY_ALIAS = [
  'follow',
  'unfollow',
  'subscribe',
  'unsubscribe',
  'profile',
  'statement'
];
// These types can be executed with an alias only when enabled in the space settings
const OPTIONAL_TYPES_EXECUTABLE_BY_ALIAS = [
  'vote',
  'vote-array',
  'vote-string',
  'proposal',
  'delete-proposal'
];
// These types can be executed with a Starknet alias
const TYPES_EXECUTABLE_BY_STARKNET_ALIAS = OPTIONAL_TYPES_EXECUTABLE_BY_ALIAS;

export async function isExistingAlias(address: string, alias: string): Promise<boolean> {
  const query = `SELECT
      address
    FROM aliases
    WHERE
      address = ?
      AND alias = ?
      AND created > (UNIX_TIMESTAMP(NOW()) - 30 * 24 * 60 * 60)
    LIMIT 1`;
  const results = await db.queryAsync(query, [address, alias]);

  return results.length > 0;
}

export async function verifyAlias(type: string, body: any, optionalAlias = false): Promise<void> {
  const { message } = body.data;

  if (body.address === message.from) return;

  if (!getAllowedTypes(optionalAlias, isStarknetAddress(message.from)).includes(type)) {
    return Promise.reject(`alias not allowed for the type: ${type}`);
  }

  if (!(await isExistingAlias(message.from, body.address))) {
    return Promise.reject('wrong alias');
  }
}

// Loose checking here, as we're looking for this address in the database later,
// which will always be a formatted starknet address if valid.
export function isStarknetAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(address);
}

export function getAllowedTypes(withAlias: boolean, forStarknet: boolean): string[] {
  const types = TYPES_EXECUTABLE_BY_ALIAS;

  if (withAlias) {
    types.push(...OPTIONAL_TYPES_EXECUTABLE_BY_ALIAS);
  }

  if (forStarknet) {
    types.push(...TYPES_EXECUTABLE_BY_STARKNET_ALIAS);
  }

  return types;
}
