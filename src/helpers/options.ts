import db from './mysql';

async function getOption(key: string) {
  return (await db.queryAsync('SELECT name, value FROM options WHERE name = ? LIMIT 1', [key]))[0];
}

export async function getLimit(key: string): Promise<number> {
  return (await getOption(key))?.value || 0;
}

export async function getList(key: string): Promise<string[]> {
  return (await getOption(key))?.value?.split(',') || [];
}
