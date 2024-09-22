import db from '../../../src/helpers/mysql';
import { action } from '../../../src/writer/profile';
import * as utils from '../../../src/helpers/utils';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('writer/profile', () => {
  describe('verify()', () => {
    it.todo('rejects if the schema is invalid');
  });

  describe('action()', () => {
    const userProfile = {
      name: 'Test name',
      avatar: 'https://snapshot.org',
      about: 'Bio',
      twitter: '',
      github: ''
    };

    beforeAll(async () => {
      await db.queryAsync('INSERT INTO users SET ?', [
        { id: '0x0', ipfs: '0', created: 0, profile: JSON.stringify(userProfile) }
      ]);
    });

    afterAll(async () => {
      await db.queryAsync('DELETE FROM users WHERE id = ?', ['0x0']);
    });

    it('clears the stamp cache if the avatar has changed', async () => {
      const spy = jest.spyOn(utils, 'clearStampCache');

      await action(
        { profile: JSON.stringify({ avatar: 'https://newurl.com' }), timestamp: 0, from: '0x0' },

        '1'
      );

      return expect(spy).toHaveBeenCalledTimes(2);
    });

    it('does not clear the stamp cache if the avatar has not changed', () => {
      const spy = jest.spyOn(utils, 'clearStampCache');

      action(
        { profile: JSON.stringify({ avatar: userProfile.avatar }), timestamp: 0, from: '0x0' },
        '2'
      );

      return expect(spy).not.toHaveBeenCalled();
    });
  });
});
