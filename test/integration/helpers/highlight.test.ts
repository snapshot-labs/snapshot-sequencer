import { isDuplicateMsg, storeMsg } from '../../../src/helpers/highlight';
import db from '../../../src/helpers/mysql';

describe('highlight', () => {
  describe('isDuplicateMsg()', () => {
    afterAll(() => {
      db.queryAsync('DELETE from snapshot_sequencer_test.messages where sig = ?', 'test-exists');
    });

    it('returns false when message does not exist yet', async () => {
      expect(await isDuplicateMsg('test-not-exists')).toEqual(false);
    });

    it('returns true when message already exist', async () => {
      await storeMsg('', '', '', '', '', '', '', 'test-exists', '');
      expect(await isDuplicateMsg('test-exists')).toEqual(true);
    });
  });
});
