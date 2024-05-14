import db from './mysql';

export async function isValidAlias(userAddress: string, userAlias: string): Promise<boolean> {
  const thirtyDaysAgo = Math.floor(new Date().getTime() / 1000) - 30 * 24 * 60 * 60;

  const query =
    'SELECT address, alias FROM aliases WHERE address = ? AND alias = ? AND created > ? LIMIT 1';
  const results = await db.queryAsync(query, [userAddress, userAlias, thirtyDaysAgo]);
  return !!results[0];
}
