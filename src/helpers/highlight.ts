import { default as hubDB, sequencerDB } from './mysql';

export async function storeMsg(id, ipfs, address, version, timestamp, space, type, sig, receipt) {
  const query = 'INSERT INTO messages SET ?';
  // TODO: remove this once migration is done
  const result = await hubDB.queryAsync(query, [
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
  if (result.insertId) {
    // TODO: remove IGNORE once migration is done
    await sequencerDB.queryAsync('INSERT IGNORE INTO messages SET ?', [
      {
        id,
        mci: result.insertId,
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
}

export async function doesMessageExist(id: string): Promise<boolean> {
  const result = await sequencerDB.queryAsync('SELECT 1 FROM messages WHERE id = ? LIMIT 1', id);
  return result.length > 0;
}
