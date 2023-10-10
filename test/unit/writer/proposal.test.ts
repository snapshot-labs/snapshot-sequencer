import * as writer from '../../../src/writer/proposal';
import input from '../../fixtures/writer-payload/proposal.json';
import omit from 'lodash/omit';
import {
  ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT,
  FLAGGED_SPACE_PROPOSAL_DAY_LIMIT,
  SPACE_PROPOSAL_DAY_LIMIT,
  VERIFIED_SPACE_PROPOSAL_DAY_LIMIT,
  ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT,
  FLAGGED_SPACE_PROPOSAL_MONTH_LIMIT,
  SPACE_PROPOSAL_MONTH_LIMIT,
  VERIFIED_SPACE_PROPOSAL_MONTH_LIMIT,
  ECOSYSTEM_SPACES,
  ACTIVE_PROPOSAL_BY_AUTHOR_LIMIT
} from '../../../src/helpers/limits';

const FLAGGED_ADDRESSES = ['0x0'];

const DEFAULT_SPACE: any = {
  id: 'fabien.eth',
  network: '5',
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

describe('writer/proposal', () => {
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
      expect.assertions(2);
      mockGetSpace.mockResolvedValueOnce({
        ...DEFAULT_SPACE,
        voting: { ...DEFAULT_SPACE.voting, type: 'basic' }
      });

      const msg = JSON.parse(input.msg);
      msg.payload.type = 'basic';
      msg.payload.choices = ['For', 'Against', 'Abstain'];

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).resolves.toBeUndefined();
      expect(mockGetSpace).toHaveBeenCalledTimes(1);
    });

    describe('when the space has enabled the ticket validation strategy', () => {
      it('rejects if the space does not have voting validation', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          strategies: [{ name: 'ticket' }],
          voteValidation: null
        });

        await expect(writer.verify(input)).rejects.toMatch('ticket');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('rejects if the space voting validation is <any>', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          strategies: [{ name: 'ticket' }],
          voteValidation: { name: 'any' }
        });

        await expect(writer.verify(input)).rejects.toMatch('ticket');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the space voting validation is anything else valid than <any>', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          strategies: [{ name: 'ticket' }],
          voteValidation: { name: 'gitcoin' }
        });

        await expect(writer.verify(input)).resolves.toBeUndefined();
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });
    });

    describe('when the space has set a voting period', () => {
      const VOTING_PERIOD = 1e6;

      it('rejects if the proposal voting period is not matching the space', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          voting: { ...DEFAULT_SPACE.voting, period: VOTING_PERIOD }
        });

        await expect(writer.verify(input)).rejects.toMatch('period');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the proposal voting period is matching the space', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          voting: { ...DEFAULT_SPACE.voting, period: VOTING_PERIOD }
        });

        const msg = JSON.parse(input.msg);
        msg.payload.end = msg.payload.start + VOTING_PERIOD;

        await expect(
          writer.verify({ ...input, msg: JSON.stringify(msg) })
        ).resolves.toBeUndefined();
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });
    });

    describe('when the space has set a voting delay', () => {
      const VOTING_DELAY = 1e6;

      it('rejects if the proposal voting delay is not matching the space', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          voting: { ...DEFAULT_SPACE.voting, delay: VOTING_DELAY }
        });

        await expect(writer.verify(input)).rejects.toMatch('delay');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the proposal voting delay is matching the space', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          voting: { ...DEFAULT_SPACE.voting, delay: VOTING_DELAY }
        });

        const msg = JSON.parse(input.msg);
        msg.payload.start = msg.timestamp + VOTING_DELAY;

        await expect(
          writer.verify({ ...input, msg: JSON.stringify(msg) })
        ).resolves.toBeUndefined();
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });
    });

    it('rejects if the voting type is invalid', async () => {
      expect.assertions(2);
      mockGetSpace.mockResolvedValueOnce({
        ...DEFAULT_SPACE,
        voting: { ...DEFAULT_SPACE.voting, type: 'multiple-choices' }
      });

      await expect(writer.verify(input)).rejects.toMatch('voting');
      expect(mockGetSpace).toHaveBeenCalledTimes(1);
    });

    describe('when the proposal contains flagged contents', () => {
      const invalidInput = [
        [{ ...input, address: FLAGGED_ADDRESSES[0] }, 'submitted address is flagged']
      ];

      it.each(invalidInput)('rejects when the %s', async (title, val) => {
        expect.assertions(1);
        await expect(writer.verify(val)).rejects.toMatch('wrong');
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
            ...DEFAULT_SPACE,
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
            ...DEFAULT_SPACE,
            validation: { name: 'basic', params: { minScore: 100 } }
          });

          await expect(writer.verify(input)).rejects.toMatch('validation');
          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(1);
        });
      });

      describe('when using the basic validation with no minimum score', () => {
        it('does not validate the space validation', async () => {
          expect.assertions(1);
          await writer.verify(input);

          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(0);
        });
      });

      describe('when using the any validation', () => {
        it('does not validate the space validation', async () => {
          expect.assertions(1);
          await writer.verify(input);

          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(0);
        });
      });
    });

    it('rejects if the snapshot is in the future', async () => {
      expect.assertions(1);
      const msg = JSON.parse(input.msg);
      msg.payload.snapshot = Number.MAX_SAFE_INTEGER;

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).rejects.toMatch(
        'snapshot'
      );
    });

    it.each([
      ['flagged', FLAGGED_SPACE_PROPOSAL_DAY_LIMIT, 'flagged', true],
      ['verified', VERIFIED_SPACE_PROPOSAL_DAY_LIMIT, 'verified', true],
      ['ecosystem', ECOSYSTEM_SPACE_PROPOSAL_DAY_LIMIT, 'id', ECOSYSTEM_SPACES[0]],
      ['normal', SPACE_PROPOSAL_DAY_LIMIT, null, null]
    ])(
      'rejects if the %s space has exceeded the proposal daily post limit',
      async (category, limit, key, value) => {
        expect.assertions(3);
        const mockGetProposalsCount = jest
          .spyOn(writer, 'getProposalsCount')
          .mockResolvedValueOnce([
            { dayCount: limit + 1, monthCount: 0, activeProposalsByAuthor: 1 }
          ]);
        const mockedSpace = { ...DEFAULT_SPACE };
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
      ['ecosystem', ECOSYSTEM_SPACE_PROPOSAL_MONTH_LIMIT, 'id', ECOSYSTEM_SPACES[0]],
      ['normal', SPACE_PROPOSAL_MONTH_LIMIT, null, null]
    ])(
      'rejects if the space has exceeded the proposal monthly post limit',
      async (category, limit, key, value) => {
        expect.assertions(3);
        const mockGetProposalsCount = jest
          .spyOn(writer, 'getProposalsCount')
          .mockResolvedValueOnce([
            { dayCount: 0, monthCount: limit + 1, activeProposalsByAuthor: 1 }
          ]);
        const mockedSpace = { ...DEFAULT_SPACE };
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
      const mockGetProposalsCount = jest.spyOn(writer, 'getProposalsCount').mockResolvedValueOnce([
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

    describe('when only members can propose', () => {
      it('rejects if the submitter is not a space member', async () => {
        expect.assertions(2);
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
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
