import db from '../helpers/mysql';

export async function verify(message): Promise<any> {
  return message.from !== message.alias;
}

export async function action(message, ipfs, receipt, id): Promise<void> {
  const params = {
    id,
    ipfs,
    address: message.from,
    alias: message.alias,
    created: message.timestamp
  };
  await db.queryAsync('INSERT IGNORE INTO aliases SET ?', params);
}
