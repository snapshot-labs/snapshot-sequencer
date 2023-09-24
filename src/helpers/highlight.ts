import db from './mysql';

export async function storeMsg(id, ipfs, address, version, timestamp, space, type, sig, receipt) {
  const query = 'INSERT IGNORE INTO messages SET ?';
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

export async function isDuplicateMsg(sig: string) {
  const result = await db.queryAsync('SELECT 1 FROM messages WHERE sig = ? LIMIT 1', sig);
  return result.length > 0;
}
