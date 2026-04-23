import db from './mysql';

const DEFAULT_ALIAS_EXPIRY_DAYS = 30;

const TYPES_EXECUTABLE_BY_ALIAS = [
  'follow',
  'unfollow',
  'subscribe',
  'unsubscribe',
  'profile',
  'statement',
  'vote',
  'vote-array',
  'vote-string',
  'proposal',
  'update-proposal',
  'delete-proposal',
  'flag-proposal'
] as const;

export async function isExistingAlias(
  address: string,
  alias: string,
  expiryDays = DEFAULT_ALIAS_EXPIRY_DAYS
): Promise<boolean> {
  const results = await db.queryAsync(
    `SELECT 1
      FROM aliases
      WHERE address = ? AND alias = ?
        AND created > UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL ? DAY))
      LIMIT 1`,
    [address, alias, expiryDays]
  );
  return results.length > 0;
}

export async function verifyAlias(type: string, body: any): Promise<void> {
  const { message } = body.data;

  if (body.address === message.from) return;

  if (!TYPES_EXECUTABLE_BY_ALIAS.includes(type as any)) {
    return Promise.reject(`alias not allowed for the type: ${type}`);
  }

  if (!(await isExistingAlias(message.from, body.address))) {
    return Promise.reject('wrong alias');
  }
}
