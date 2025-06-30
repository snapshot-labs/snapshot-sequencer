import { uniq } from 'lodash';
import db from './mysql';

const DEFAULT_ALIAS_EXPIRY_DAYS = 30;

// These types can always be executed with an alias
const TYPES_EXECUTABLE_BY_ALIAS = [
  'follow',
  'unfollow',
  'subscribe',
  'unsubscribe',
  'profile',
  'statement'
] as const;

// These types can be executed with an alias only when enabled in the space settings
const OPTIONAL_TYPES_EXECUTABLE_BY_ALIAS = [
  'vote',
  'vote-array',
  'vote-string',
  'proposal',
  'update-proposal',
  'delete-proposal'
] as const;

// These types can be executed with a Starknet alias
const TYPES_EXECUTABLE_BY_STARKNET_ALIAS = [
  'flag-proposal',
  ...OPTIONAL_TYPES_EXECUTABLE_BY_ALIAS
] as const;

// Memoization cache for getAllowedTypes
const allowedTypesCache = new Map<string, ExecutableType[]>();

// Types
type ExecutableType =
  | (typeof TYPES_EXECUTABLE_BY_ALIAS)[number]
  | (typeof OPTIONAL_TYPES_EXECUTABLE_BY_ALIAS)[number]
  | 'flag-proposal';

/**
 * Checks if an alias relationship exists and is not expired
 * @param address - The original address
 * @param alias - The alias address to check
 * @param expiryDays - Number of days after which alias expires (default: 30)
 * @returns Promise<boolean> - True if valid alias exists
 */
export async function isExistingAlias(
  address: string,
  alias: string,
  expiryDays = DEFAULT_ALIAS_EXPIRY_DAYS
): Promise<boolean> {
  const query = `SELECT 1
    FROM aliases
    WHERE address = ? AND alias = ?
      AND created > UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL ? DAY))
    LIMIT 1`;

  const results = await db.queryAsync(query, [address, alias, expiryDays]);
  return results.length > 0;
}

export async function verifyAlias(type: string, body: any, optionalAlias = false): Promise<void> {
  const { message } = body.data;

  if (body.address === message.from) return;

  if (
    !getAllowedTypes(optionalAlias, isStarknetAddress(message.from)).includes(
      type as ExecutableType
    )
  ) {
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

export function getAllowedTypes(withAlias: boolean, forStarknet: boolean): ExecutableType[] {
  const cacheKey = `${withAlias}-${forStarknet}`;

  if (allowedTypesCache.has(cacheKey)) {
    return allowedTypesCache.get(cacheKey)!;
  }

  const types: ExecutableType[] = [...TYPES_EXECUTABLE_BY_ALIAS];

  if (withAlias) {
    types.push(...OPTIONAL_TYPES_EXECUTABLE_BY_ALIAS);
  }

  if (forStarknet) {
    types.push(...TYPES_EXECUTABLE_BY_STARKNET_ALIAS);
  }

  const result = uniq(types);
  allowedTypesCache.set(cacheKey, result);
  return result;
}
