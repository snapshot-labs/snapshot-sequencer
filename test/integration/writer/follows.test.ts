import { verify, action } from '../../../src/writer/follow';
import { FOLLOWS_LIMIT_PER_USER } from '../../../src/helpers/limits';
import db, { sequencerDB } from '../../../src/helpers/mysql';

const mockGetSpace = jest.fn((): any => {
  return {};
});
jest.mock('../../../src/helpers/actions', () => {
  const originalModule = jest.requireActual('../../../src/helpers/actions');

  return {
    __esModule: true,
    ...originalModule,
    getSpace: () => mockGetSpace()
  };
});

describe('writer/follow', () => {
  afterAll(async () => {
    await db.queryAsync('DELETE FROM follows');
    await db.endAsync();
    await sequencerDB.endAsync();
  });

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

    it('rejects when the user has followed too much spaces', () => {
      return expect(verify({ from: followerId })).rejects.toEqual(
        `you can join max ${FOLLOWS_LIMIT_PER_USER} spaces`
      );
    });

    it('returns true when the user has not reached the limit', () => {
      return expect(verify({ from: '0x1' })).resolves.toEqual(true);
    });

    it('rejects when the network is not allowed', () => {
      return expect(verify({ from: '0x1', network: 'not-allowed' })).rejects.toEqual(
        'network not-allowed is not allowed'
      );
    });

    it('rejects when the space does not exist on default network', () => {
      mockGetSpace.mockRejectedValueOnce('unknown space');

      return expect(verify({ from: '0x1', network: 's', space: 'hello.eth' })).rejects.toEqual(
        'unknown space'
      );
    });

    it('rejects when the space does not exist on missing network params', () => {
      mockGetSpace.mockRejectedValueOnce('unknown space');

      return expect(verify({ from: '0x1', space: 'hello.eth' })).rejects.toEqual('unknown space');
    });

    it('does not check the space when on other network', () => {
      return expect(verify({ from: '0x1', network: 'eth', space: 'hello.eth' })).resolves.toEqual(
        true
      );
    });

    it('returns true when all data are valid', () => {
      mockGetSpace.mockResolvedValueOnce({});

      return expect(verify({ from: '0x1', network: 's' })).resolves.toEqual(true);
    });
  });

  describe('action()', () => {
    describe('without a network', () => {
      it('inserts a new follow with a default network', async () => {
        const id = '1';
        const ipfs = '2';
        const message = {
          from: '0x2',
          space: 'test.eth',
          timestamp: 1
        };

        await action(message, ipfs, 1, id);

        return expect(
          db.queryAsync('SELECT * FROM follows WHERE follower = ?', [message.from])
        ).resolves.toEqual([
          {
            id,
            ipfs,
            follower: '0x2',
            space: 'test.eth',
            network: 's',
            created: 1
          }
        ]);
      });
    });

    describe('with a network', () => {
      it('inserts a new follow with the given network', async () => {
        const id = '2';
        const ipfs = '3';
        const message = {
          from: '0x3',
          space: 'test.eth',
          timestamp: 1,
          network: 'sep'
        };

        await action(message, ipfs, 1, id);

        return expect(
          db.queryAsync('SELECT * FROM follows WHERE follower = ?', [message.from])
        ).resolves.toEqual([
          {
            id,
            ipfs,
            follower: '0x3',
            space: 'test.eth',
            network: 'sep',
            created: 1
          }
        ]);
      });
    });
  });
});
