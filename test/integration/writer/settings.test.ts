import db, { sequencerDB } from '../../../src/helpers/mysql';
import { action, verify } from '../../../src/writer/settings';
import payload from '../../fixtures/writer-payload/space.json';

const spaceId = JSON.parse(payload.msg).space;

afterEach(() => {
  jest.restoreAllMocks();
});

const mockGetSpaceController = jest.fn((): any => {
  return '';
});
jest.mock('@snapshot-labs/snapshot.js', () => {
  const originalModule = jest.requireActual('@snapshot-labs/snapshot.js');

  return {
    ...originalModule,
    utils: {
      ...originalModule.utils,
      getSpaceController: () => mockGetSpaceController()
    }
  };
});

describe('writer/settings', () => {
  afterAll(async () => {
    await db.queryAsync('DELETE FROM spaces');
    await db.endAsync();
    await sequencerDB.endAsync();
  });

  describe('verify()', () => {
    beforeAll(async () => {
      await db.queryAsync(
        'INSERT INTO spaces (id, name, created, updated, domain) VALUES (?, ?, 0, 0, ?)',
        ['test.eth', 'test.eth', 'vote.snapshot.org']
      );
    });

    afterAll(async () => {
      await db.queryAsync('DELETE FROM spaces WHERE id = ?', ['test.eth']);
    });

    it('rejects when domain is used by another space', async () => {
      const domain = 'Vote.snapshot.org';
      const msg = JSON.parse(payload.msg);
      msg.payload.domain = domain;
      const payloadWithDomain = {
        ...payload,
        msg: JSON.stringify(msg)
      };

      mockGetSpaceController.mockResolvedValueOnce(payload.address);
      await expect(verify(payloadWithDomain)).rejects.toContain('domain already taken');
      expect(mockGetSpaceController).toHaveBeenCalledTimes(1);
    });

    it('resolves when domain is not used yet', async () => {
      const domain = 'vote1.snapshot.org';
      const msg = JSON.parse(payload.msg);
      msg.payload.domain = domain;
      const payloadWithDomain = {
        ...payload,
        msg: JSON.stringify(msg)
      };

      mockGetSpaceController.mockResolvedValueOnce(payload.address);
      await expect(verify(payloadWithDomain)).resolves.toBeUndefined();
      expect(mockGetSpaceController).toHaveBeenCalledTimes(1);
    });
  });

  describe('action', () => {
    afterEach(async () => {
      await db.queryAsync('DELETE FROM spaces WHERE id = ?', spaceId);
    });

    describe('with a domain', () => {
      it('saves the domain in space settings and in the domain column', async () => {
        const domain = 'vote.snapshot.org';
        const msg = JSON.parse(payload.msg);
        msg.payload.domain = domain;
        const payloadWithDomain = {
          ...payload,
          msg: JSON.stringify(msg)
        };

        await action(payloadWithDomain);

        const results = (
          await db.queryAsync(
            "SELECT JSON_UNQUOTE(settings->'$.domain') as settingsDomain, domain as columnDomain FROM spaces WHERE id = ?",
            [spaceId]
          )
        )[0];

        expect(results.settingsDomain).toBe(domain);
        expect(results.columnDomain).toBe(domain);
      });
    });

    describe('without domain', () => {
      it('sets the domain in space setting and column as NULL', async () => {
        await action(payload);

        const results = (
          await db.queryAsync(
            "SELECT JSON_UNQUOTE(settings->'$.domain') as settingsDomain, domain as columnDomain FROM spaces WHERE id = ?",
            [spaceId]
          )
        )[0];

        expect(results.settingsDomain).toBe(null);
        expect(results.columnDomain).toBe(null);
      });
    });
  });
});
