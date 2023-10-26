import { verify } from '../../../src/writer/follow';
import { FOLLOWS_LIMIT_PER_USER } from '../../../src/helpers/limits';
import db, { sequencerDB } from '../../../src/helpers/mysql';

describe('writer/follow', () => {
  describe('verify()', () => {
    const followerId = '0x0';

    beforeAll(async () => {
      let i = 0;
      const promises: Promise<any>[] = [];

      while (i <= FOLLOWS_LIMIT_PER_USER) {
        promises.push(
          db.queryAsync(
            'INSERT INTO follows SET id = ?, ipfs = ?, follower = ?, space = ?, created = ?',
            [i, i, followerId, `test-${i}.eth`, i]
          )
        );

        i++;
      }

      await Promise.all(promises);
    });

    afterAll(async () => {
      await db.queryAsync('DELETE FROM follows');
      await db.endAsync();
      await sequencerDB.endAsync();
    });

    it('rejects when the user has followed too much spaces', () => {
      expect(verify({ from: followerId })).rejects.toEqual('you can join max 25 spaces');
    });

    it('returns true when the user has not reached the limit', () => {
      expect(verify({ from: '0x1' })).resolves.toEqual(true);
    });
  });
});
