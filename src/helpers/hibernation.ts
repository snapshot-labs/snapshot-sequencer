import db from './mysql';

export function hibernate(id: string, action: string) {
  if (!id || !action) throw new Error(`missing params. 'id' and 'action' required`);
  if (!['hibernate', 'reactivate'].includes(action)) throw new Error('invalid action');

  const query = `UPDATE spaces SET hibernating = ? WHERE id = ? LIMIT 1`;

  return db.queryAsync(query, [action === 'hibernate' ? '1' : '0', id]);
}
