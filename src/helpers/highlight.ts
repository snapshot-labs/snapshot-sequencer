import db from './mysql';

export async function storeMsg(id, ipfs, address, version, timestamp, space, type, sig, receipt) {
  const query = 'INSERT INTO messages SET ?';
  await db.queryAsync(query, [
    {
      id,
      ipfs,
      address,
      version,
      timestamp,
      space,
      type,
      sig,
      receipt
    }
  ]);
}

export async function isDuplicateMsg(id: string) {
  const result = await db.queryAsync('SELECT 1 FROM messages WHERE id = ? LIMIT 1', id);
  return result.length > 0;
}
