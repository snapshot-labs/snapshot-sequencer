import { verify } from '../../../src/writer/follow';
import { FOLLOWS_LIMIT_PER_USER } from '../../../src/helpers/limits';
import db from '../../../src/helpers/mysql';

describe('writer/follow', () => {
  describe('verify()', () => {
    const followerId = '0x0';

    beforeAll(async () => {
      let i = 0;

      while (i <= FOLLOWS_LIMIT_PER_USER) {
        await db.queryAsync(
          'INSERT INTO follows SET id = ?, ipfs = ?, follower = ?, space = ?, created = ?',
          [i, i, followerId, `test-${i}.eth`, i]
        );

        i++;
      }
    });

    afterAll(async () => {
      await db.queryAsync('DELETE FROM follows');
      await db.endAsync();
    });

    it('rejects when the user has followed too much spaces', () => {
      expect(verify({ from: followerId })).rejects.toEqual('follows limit reached');
    });

    it('returns true when the user has not reached the limit', () => {
      expect(verify({ from: '0x1' })).resolves.toEqual(true);
    });
  });
});
