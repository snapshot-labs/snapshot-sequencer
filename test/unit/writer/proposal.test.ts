import omit from 'lodash/omit';
import * as writer from '../../../src/writer/proposal';
import input from '../../fixtures/writer-payload/proposal.json';
import { spacesGetSpaceFixtures } from '../../fixtures/space';
import {
  ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT,
  FLAGGED_SPACE_PROPOSAL_DAY_LIMIT,
  SPACE_PROPOSAL_DAY_LIMIT,
  VERIFIED_SPACE_PROPOSAL_DAY_LIMIT,
  ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT,
  FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT,
  SPACE_PROPOSAL_MONTH_LIMIT,
  VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT,
  MAINNET_ECOSYSTEM_SPACES,
  ACTIVE_PROPOSAL_BY_AUTHOR_LIMIT,
  TURBO_SPACE_PROPOSAL_DAY_LIMIT,
  TURBO_SPACE_PROPOSAL_MONTH_LIMIT
} from '../../../src/helpers/limits';

const FLAGGED_ADDRESSES = ['0x0'];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockGetSpace = jest.fn((_): any => {
  return spacesGetSpaceFixtures;
});
jest.mock('../../../src/helpers/actions', () => {
  const originalModule = jest.requireActual('../../../src/helpers/actions');

  return {
    __esModule: true,
    ...originalModule,
    getSpace: (id: string) => mockGetSpace(id)
  };
});

const mockSnapshotUtilsValidate = jest.fn((): any => {
  return true;
});
jest.mock('@snapshot-labs/snapshot.js', () => {
  const originalModule = jest.requireActual('@snapshot-labs/snapshot.js');

  return {
    ...originalModule,
    utils: {
      ...originalModule.utils,
      validate: () => mockSnapshotUtilsValidate()
    }
  };
});

jest.mock('../../../src/helpers/moderation', () => {
  const originalModule = jest.requireActual('../../../src/helpers/moderation');

  return {
    __esModule: true,
    ...originalModule,
    // sha256 of 1.2.3.4
    flaggedIps: ['6694f83c9f476da31f5df6bcc520034e7e57d421d247b9d34f49edbfc84a764c'],
    flaggedAddresses: ['0x0']
  };
});

const mockGetProposalsCount = jest.spyOn(writer, 'getProposalsCount');
mockGetProposalsCount.mockResolvedValue([
  {
    dayCount: 0,
    monthCount: 0,
    activeProposalsByAuthor: 0
  }
]);

describe('writer/proposal', () => {
  afterEach(jest.clearAllMocks);

  const msg = JSON.parse(input.msg);
  msg.payload.end = Math.floor(Date.now() / 1000) + 60;
  input.msg = JSON.stringify(msg);

  describe('verify()', () => {
    describe('when the schema is invalid', () => {
      const msg = JSON.parse(input.msg);
      const invalidMsg = [
        ['unknown field', { ...msg, payload: { ...msg.payload, title: 'title' } }],
        ['missing field', { msg, payload: omit(msg.payload, 'name') }],
        ['not matching type', { ...msg, payload: { ...msg.payload, name: true } }]
      ];

      it.each(invalidMsg)('rejects on %s', async (title: string, val: any) => {
        expect.assertions(1);
        await expect(writer.verify({ ...input, msg: JSON.stringify(val) })).rejects.toMatch(
          'format'
        );
      });
    });

    it('rejects if the basic vote choices are not valid', async () => {
      expect.assertions(1);

      const msg = JSON.parse(input.msg);
      msg.payload.type = 'basic';
      msg.payload.choices = ['Good'];

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).rejects.toMatch(
        'choices'
      );
    });

    it('does not reject if the basic vote choices are valid', async () => {
      expect.assertions(3);
      mockGetSpace.mockResolvedValueOnce({
        ...spacesGetSpaceFixtures,
        voting: { ...spacesGetSpaceFixtures.voting, type: 'basic' }
      });

      const msg = JSON.parse(input.msg);
      msg.payload.type = 'basic';
      msg.payload.choices = ['For', 'Against', 'Abstain'];

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).resolves.toBeUndefined();
      expect(mockGetSpace).toHaveBeenCalledTimes(1);
      expect(mockGetProposalsCount).toHaveBeenCalledTimes(1);
    });

    describe('when the space has enabled the ticket validation strategy', () => {
      it('rejects if the space does not have voting validation', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          strategies: [{ name: 'ticket' }],
          voteValidation: undefined
        });

        await expect(writer.verify(input)).rejects.toMatch('ticket');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('rejects if the space voting validation is <any>', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          strategies: [{ name: 'ticket' }],
          voteValidation: { name: 'any' }
        });

        await expect(writer.verify(input)).rejects.toMatch('ticket');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the space voting validation is anything else valid than <any>', async () => {
        expect.assertions(3);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          strategies: [{ name: 'ticket' }],
          voteValidation: { name: 'gitcoin' }
        });

        await expect(writer.verify(input)).resolves.toBeUndefined();
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
        expect(mockGetProposalsCount).toHaveBeenCalledTimes(1);
      });
    });

    describe('when the space has set a voting period', () => {
      const VOTING_PERIOD = 120;
      const msg = JSON.parse(input.msg);
      msg.payload.start = Math.floor(Date.now() / 1000) - 60;
      const inputWithVotingPeriod = { ...input, msg: JSON.stringify(msg) };

      it('rejects if the proposal voting period is not matching the space', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          voting: { ...spacesGetSpaceFixtures.voting, period: VOTING_PERIOD + 1000 }
        });

        await expect(writer.verify(inputWithVotingPeriod)).rejects.toMatch('period');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the proposal voting period is matching the space', async () => {
        expect.assertions(3);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          voting: { ...spacesGetSpaceFixtures.voting, period: VOTING_PERIOD }
        });

        await expect(writer.verify(inputWithVotingPeriod)).resolves.toBeUndefined();
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
        expect(mockGetProposalsCount).toHaveBeenCalledTimes(1);
      });
    });

    describe('when the space has set a voting delay', () => {
      const VOTING_DELAY = 1e6;

      it('rejects if the proposal voting delay is not matching the space', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          voting: { ...spacesGetSpaceFixtures.voting, delay: VOTING_DELAY }
        });

        await expect(writer.verify(input)).rejects.toMatch('delay');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the proposal voting delay is matching the space', async () => {
        expect.assertions(3);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          voting: { ...spacesGetSpaceFixtures.voting, delay: VOTING_DELAY }
        });

        const msg = JSON.parse(input.msg);
        msg.payload.start = msg.timestamp + VOTING_DELAY;

        await expect(
          writer.verify({ ...input, msg: JSON.stringify(msg) })
        ).resolves.toBeUndefined();
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
        expect(mockGetProposalsCount).toHaveBeenCalledTimes(1);
      });
    });

    it('rejects if the voting type is invalid', async () => {
      expect.assertions(2);
      mockGetSpace.mockResolvedValueOnce({
        ...spacesGetSpaceFixtures,
        voting: { ...spacesGetSpaceFixtures.voting, type: 'multiple-choices' }
      });

      await expect(writer.verify(input)).rejects.toMatch('voting');
      expect(mockGetSpace).toHaveBeenCalledTimes(1);
    });

    describe('when the proposal contains flagged contents', () => {
      const invalidInput = [
        ['submitted address is flagged', { ...input, address: FLAGGED_ADDRESSES[0] }]
      ];

      it.each(invalidInput)('rejects when the %s', async (title, val) => {
        expect.assertions(1);
        await expect(writer.verify(val)).rejects.toMatch(
          'invalid proposal, please contact support'
        );
      });
    });

    describe('when the submitter is not a space member', () => {
      beforeEach(() => {
        mockSnapshotUtilsValidate.mockResolvedValueOnce(false);
      });

      describe('when using a custom of validation', () => {
        it('validates the space validation using snapshot SDK', async () => {
          expect.assertions(2);
          mockGetSpace.mockResolvedValueOnce({
            ...spacesGetSpaceFixtures,
            validation: { name: 'gitcoin' }
          });

          await expect(writer.verify(input)).rejects.toMatch('validation');
          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(1);
        });
      });

      describe('when using the basic validation with a minimum score', () => {
        it('validates the space validation using snapshot SDK', async () => {
          expect.assertions(2);
          mockGetSpace.mockResolvedValueOnce({
            ...spacesGetSpaceFixtures,
            validation: { name: 'basic', params: { minScore: 100 } }
          });

          await expect(writer.verify(input)).rejects.toMatch('validation');
          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(1);
        });
      });

      describe('when using the basic validation with no minimum score', () => {
        it('does not validate the space validation', async () => {
          expect.assertions(2);

          await expect(writer.verify(input)).resolves.toBeUndefined();
          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(0);
        });
      });

      describe('when using the any validation', () => {
        it('does not validate the space validation', async () => {
          expect.assertions(2);

          await expect(writer.verify(input)).resolves.toBeUndefined();
          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(0);
        });
      });
    });

    it('rejects if the snapshot is in the future', async () => {
      expect.assertions(1);
      const msg = JSON.parse(input.msg);
      msg.payload.snapshot = Number.MAX_SAFE_INTEGER;

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).rejects.toMatch(
        'invalid snapshot block'
      );
    });

    it('rejects if the snapshot is lower than network start block', async () => {
      expect.assertions(1);
      const msg = JSON.parse(input.msg);
      msg.payload.snapshot = 1000;

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).rejects.toMatch(
        'proposal snapshot must be after network start'
      );
    });

    it('rejects if the end period is in the past', async () => {
      expect.assertions(1);
      const msg = JSON.parse(input.msg);
      msg.payload.end = Math.floor(Date.now() / 1000) - 60 * 5;

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).rejects.toMatch(
        'proposal end date must be in the future'
      );
    });

    it.each([
      ['flagged', FLAGGED_SPACE_PROPOSAL_DAY_LIMIT, 'flagged', true],
      ['verified', VERIFIED_SPACE_PROPOSAL_DAY_LIMIT, 'verified', true],
      ['ecosystem', ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT, 'id', MAINNET_ECOSYSTEM_SPACES[0]],
      ['turbo', TURBO_SPACE_PROPOSAL_DAY_LIMIT, 'turbo', true],
      ['normal', SPACE_PROPOSAL_DAY_LIMIT, null, null]
    ])(
      'rejects if the %s space has exceeded the proposal daily post limit',
      async (category, limit, key, value) => {
        expect.assertions(3);
        mockGetProposalsCount.mockResolvedValueOnce([
          { dayCount: limit + 1, monthCount: 0, activeProposalsByAuthor: 1 }
        ]);
        const mockedSpace = { ...spacesGetSpaceFixtures };
        if (key && value) {
          mockedSpace[key] = value;
        }
        mockGetSpace.mockResolvedValueOnce(mockedSpace);

        await expect(writer.verify(input)).rejects.toMatch('limit reached');
        expect(mockGetProposalsCount).toHaveBeenCalledTimes(1);
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      }
    );

    it.each([
      ['flagged', FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT, 'flagged', true],
      ['verified', VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT, 'verified', true],
      ['ecosystem', ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT, 'id', MAINNET_ECOSYSTEM_SPACES[0]],
      ['turbo', TURBO_SPACE_PROPOSAL_MONTH_LIMIT, 'turbo', true],
      ['normal', SPACE_PROPOSAL_MONTH_LIMIT, null, null]
    ])(
      'rejects if the %s space has exceeded the proposal monthly post limit',
      async (category, limit, key, value) => {
        expect.assertions(3);
        mockGetProposalsCount.mockResolvedValueOnce([
          { dayCount: 0, monthCount: limit + 1, activeProposalsByAuthor: 1 }
        ]);
        const mockedSpace = { ...spacesGetSpaceFixtures };
        if (key && value) {
          mockedSpace[key] = value;
        }
        mockGetSpace.mockResolvedValueOnce(mockedSpace);

        await expect(writer.verify(input)).rejects.toMatch('limit reached');
        expect(mockGetProposalsCount).toHaveBeenCalledTimes(1);
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      }
    );

    it('rejects if the user has exceed the number of proposals per space', async () => {
      expect.assertions(2);
      mockGetProposalsCount.mockResolvedValueOnce([
        {
          dayCount: 0,
          monthCount: 0,
          activeProposalsByAuthor: ACTIVE_PROPOSAL_BY_AUTHOR_LIMIT + 1
        }
      ]);

      await expect(writer.verify(input)).rejects.toMatch('limit reached for author');
      expect(mockGetProposalsCount).toHaveBeenCalledTimes(1);
    });

    it('rejects if the space limit checker fails', async () => {
      expect.assertions(2);
      const mockGetProposalsCount = jest
        .spyOn(writer, 'getProposalsCount')
        .mockImplementationOnce(() => {
          throw new Error();
        });

      await expect(writer.verify(input)).rejects.toMatch('failed to check proposals limit');
      expect(mockGetProposalsCount).toHaveBeenCalledTimes(1);
    });

    it('rejects if the space is not found', async () => {
      expect.assertions(2);
      mockGetSpace.mockResolvedValueOnce(false);

      await expect(writer.verify(input)).rejects.toMatch('unknown space');
      expect(mockGetSpace).toHaveBeenCalledTimes(1);
    });

    describe('on invalid space settings', () => {
      it('rejects if using testnet on production', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          network: '5'
        });

        await expect(writer.verify(input)).rejects.toMatch(
          'invalid space settings: network not allowed'
        );
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('rejects if the network does not exist', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          network: '123abc'
        });

        await expect(writer.verify(input)).rejects.toMatch(
          'invalid space settings: network not allowed'
        );
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('rejects if missing proposal validation', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          validation: { name: 'any' }
        });

        await expect(writer.verify(input)).rejects.toMatch(
          'invalid space settings: space missing proposal validation'
        );
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('rejects if missing vote validation with ticket strategy', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          validation: { name: 'any' },
          strategies: [{ name: 'ticket' }]
        });

        await expect(writer.verify(input)).rejects.toMatch(
          'invalid space settings: space with ticket requires voting validation'
        );
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('rejects if the space was deleted', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          filters: { onlyMembers: true },
          deleted: true
        });

        await expect(writer.verify(input)).rejects.toMatch(
          'invalid space settings: space deleted, contact admin'
        );
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });
    });

    describe('when only members can propose', () => {
      it('rejects if the submitter is not a space member', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...spacesGetSpaceFixtures,
          filters: { onlyMembers: true }
        });

        await expect(writer.verify(input)).rejects.toMatch('authors');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });
    });

    it('verifies a valid input', async () => {
      expect.assertions(1);
      await expect(writer.verify(input)).resolves.toBeUndefined();
    });
  });
});
