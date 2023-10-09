import ingestor from '../../src/ingestor';
import proposalInput from '../fixtures/ingestor-payload/proposal.json';
import voteInput from '../fixtures/ingestor-payload/vote.json';
import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';
import { default as db, sequencerDB } from '../../src/helpers/mysql';
import relayer from '../../src/helpers/relayer';

jest.mock('../../src/helpers/moderation', () => {
  const originalModule = jest.requireActual('../../src/helpers/moderation');

  return {
    __esModule: true,
    ...originalModule,
    // sha256 of 1.2.3.4
    flaggedIps: ['6694f83c9f476da31f5df6bcc520034e7e57d421d247b9d34f49edbfc84a764c'],
    flaggedProposalBodyKeywords: ['claim drop']
  };
});

const DEFAULT_SPACE: any = {
  id: 'fabien.eth',
  network: '1',
  voting: { aliased: false, type: 'single-choice' },
  strategies: [],
  members: [],
  admins: [],
  moderators: [],
  validation: { name: 'basic' }
};

const mockGetSpace = jest.fn((id: any): any => {
  return { ...DEFAULT_SPACE, id };
});
jest.mock('../../src/helpers/actions', () => {
  const originalModule = jest.requireActual('../../src/helpers/actions');

  return {
    __esModule: true,
    ...originalModule,
    getSpace: (id: string) => mockGetSpace(id)
  };
});

const mockSnapshotUtilsVerify = jest.fn((): any => {
  return true;
});
jest.mock('@snapshot-labs/snapshot.js', () => {
  const originalModule = jest.requireActual('@snapshot-labs/snapshot.js');

  return {
    ...originalModule,
    utils: {
      ...originalModule.utils,
      verify: () => mockSnapshotUtilsVerify()
    }
  };
});

const mockPin = jest.fn(async (payload: any, originalFn: (payload: any) => any): Promise<any> => {
  return originalFn(payload);
});
jest.mock('@snapshot-labs/pineapple', () => {
  const originalModule = jest.requireActual('@snapshot-labs/pineapple');

  return {
    ...originalModule,
    pin: (payload: any) => mockPin(payload, originalModule.pin)
  };
});

const proposalRequest = {
  headers: { 'x-real-ip': '1.1.1.1' },
  body: proposalInput
};

const voteRequest = {
  headers: { 'x-real-ip': '1.1.1.1' },
  body: voteInput
};

function cloneWithNewMessage(data: Record<string, any>) {
  const clonedRequest = cloneDeep(proposalRequest);
  clonedRequest.body.data.message = { ...clonedRequest.body.data.message, ...data };

  return clonedRequest;
}

describe('ingestor', () => {
  beforeAll(() => {
    proposalInput.data.message.timestamp = Math.floor(Date.now() / 1e3) - 60;
    voteInput.data.message.timestamp = Math.floor(Date.now() / 1e3) - 60;
  });

  afterEach(async () => {
    await db.queryAsync('DELETE FROM snapshot_sequencer_test.messages');
  });

  afterAll(async () => {
    await db.queryAsync('DELETE FROM snapshot_sequencer_test.proposals;');
    await db.queryAsync('DELETE FROM snapshot_sequencer_test.messages;');
    return await db.endAsync();
  });

  it('rejects when the submitter IP is banned', async () => {
    const ip = '1.2.3.4';

    await expect(ingestor({ headers: { 'x-real-ip': ip } })).rejects.toMatch('unauthorized');
  });

  describe('when the schema is invalid', () => {
    const fixtures = [
      ['is missing', null],
      ['is empty', {}],
      ['missing a required key', omit(proposalInput, 'data')],
      ['contains an extra unauthorized key', { ...proposalInput, test: 'test' }]
    ];

    it.each(fixtures)('rejects when the proposalInput %s', async (title: string, body: any) => {
      await expect(ingestor({ ...proposalRequest, body })).rejects.toMatch('envelop');
    });
  });

  it('rejects when the body is too large', async () => {
    const invalidRequest = cloneWithNewMessage({ body: ' - - - '.repeat(50000) });

    await expect(ingestor(invalidRequest)).rejects.toMatch('large');
  });

  describe('when the timestamp is invalid', () => {
    const proposalInput = [
      ['future', Date.now() + 10000],
      ['past', Date.now() - 10000]
    ];

    it.each(proposalInput)(
      'rejects timestamp too far in the %s',
      async (title: any, timestamp: any) => {
        const invalidRequest = cloneWithNewMessage({ timestamp });

        await expect(ingestor(invalidRequest)).rejects.toMatch('timestamp');
      }
    );
  });

  it('rejects when the domain is not matching', async () => {
    const invalidRequest = cloneDeep(proposalRequest);
    invalidRequest.body.data.domain = { name: 'snapshot', version: '99.99.99' };

    await expect(ingestor(invalidRequest)).rejects.toMatch('domain');
  });

  it('rejects when the type does not exist', async () => {
    const invalidRequest = cloneDeep(proposalRequest);
    invalidRequest.body.data.types.Proposal.push({ name: 'test', type: 'number' });

    await expect(ingestor(invalidRequest)).rejects.toMatch('type');
  });

  it('rejects when the space is not found', async () => {
    mockGetSpace.mockReturnValueOnce(null);

    await expect(ingestor(proposalRequest)).rejects.toMatch('space');
    expect(mockGetSpace).toHaveBeenCalledTimes(1);
  });

  describe('when the message creator is not the sender', () => {
    it.todo('rejects when alias is not available for the type');
    it.todo('rejects when alias is not enabled');
    it.todo('rejects when the submitted is not an allowed alias');
  });

  it('rejects when the signature is not valid', () => {
    mockSnapshotUtilsVerify.mockReturnValueOnce(false);

    expect(ingestor(proposalRequest)).rejects.toMatch('signature');
  });

  it('rejects when the metadata is too large', async () => {
    const invalidRequest = cloneDeep(voteRequest);
    invalidRequest.body.data.message.metadata = JSON.stringify({ reason: ' - '.repeat(5000) });

    await expect(ingestor(invalidRequest)).rejects.toMatch('large');
  });

  it('rejects when IPFS pinning fail', async () => {
    mockPin.mockImplementationOnce(() => {
      return Promise.reject('');
    });

    await expect(ingestor(proposalRequest)).rejects.toMatch('pin');
    expect(mockPin).toHaveBeenCalledTimes(1);
  });

  describe('on a valid transaction', () => {
    it('returns a payload', async () => {
      const result = await ingestor(proposalRequest);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('ipfs');
      expect(result).toHaveProperty('relayer');
      expect(result.relayer.address).toEqual(relayer.address);
      expect(result.relayer).toHaveProperty('receipt');
    });

    it('saves the proposal in the DB', async () => {
      const typeResult = await ingestor(proposalRequest);
      const dbResult = await db.queryAsync(
        `SELECT * from proposals WHERE id = ? LIMIT 1`,
        typeResult.id
      );

      expect(dbResult.length).toBe(1);
    });

    ['vote', 'follow', 'unfollow', 'subscribe', 'unsubscribe'].forEach(type => {
      it.todo(`updates/saves the ${type} in the DB`);
    });
  });
});
