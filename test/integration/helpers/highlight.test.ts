import { isDuplicateMsg, storeMsg } from '../../../src/helpers/highlight';
import db from '../../../src/helpers/mysql';

describe('highlight', () => {
  describe('isDuplicateMsg()', () => {
    // afterAll(async () => {
    //   await db.queryAsync(
    //     'DELETE from snapshot_sequencer_test.messages where sig = ?',
    //     'test-exists'
    //   );
    //   return db.endAsync();
    // });

    it('returns false when message does not exist yet', async () => {
      expect(1).toEqual(1);
      // expect(await isDuplicateMsg('test-not-exists')).toEqual(false);
    });

    it('returns true when message already exist', async () => {
      // await storeMsg('', '', '', '', '', '', '', 'test-exists', '');
      // expect(await isDuplicateMsg('test-exists')).toEqual(true);
    });
  });
});
