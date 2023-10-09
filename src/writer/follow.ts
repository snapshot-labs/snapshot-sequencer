import db from '../helpers/mysql';

export async function verify(): Promise<any> {
  return true;
}

export async function action(message, ipfs, receipt, id): Promise<void> {
  const params = {
    id,
    ipfs,
    follower: message.from,
    space: message.space,
    created: message.timestamp
  };
  await db.queryAsync('INSERT IGNORE INTO follows SET ?', params);
}
