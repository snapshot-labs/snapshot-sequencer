import * as writer from '../../../src/writer/proposal';
import input from '../../fixtures/writer-payload/proposal.json';
import omit from 'lodash/omit';

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

describe('writer/proposal', () => {
  describe('verify()', () => {
    describe.only('when the schema is invalid', () => {
      const msg = JSON.parse(input.msg);
      const invalidMsg = [
        ['unknown field', { ...msg, payload: { ...msg.payload, title: 'title' } }],
        ['missing field', { msg, payload: omit(msg.payload, 'name') }],
        ['not matching type', { ...msg, payload: { ...msg.payload, name: true } }]
      ];

      it.each(invalidMsg)('rejects on %s', async (title: string, val: any) => {
        await expect(writer.verify({ ...input, msg: JSON.stringify(val) })).rejects.toMatch(
          'format'
        );
      });
    });

    it('rejects if the basic vote choices are not valid', async () => {
      const msg = JSON.parse(input.msg);
      msg.payload.type = 'basic';
      msg.payload.choices = ['Good'];

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).rejects.toMatch(
        'choices'
      );
    });

    it('does not reject if the basic vote choices are valid', async () => {
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
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          strategies: [{ name: 'ticket' }],
          voteValidation: null
        });

        await expect(writer.verify(input)).rejects.toMatch('ticket');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('rejects if the space voting validation is <any>', async () => {
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          strategies: [{ name: 'ticket' }],
          voteValidation: { name: 'any' }
        });

        await expect(writer.verify(input)).rejects.toMatch('ticket');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the space voting validation is anything else valid than <any>', async () => {
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
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          voting: { ...DEFAULT_SPACE.voting, period: VOTING_PERIOD }
        });

        await expect(writer.verify(input)).rejects.toMatch('period');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the proposal voting period is matching the space', async () => {
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
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          voting: { ...DEFAULT_SPACE.voting, delay: VOTING_DELAY }
        });

        await expect(writer.verify(input)).rejects.toMatch('delay');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });

      it('does not reject if the proposal voting delay is matching the space', async () => {
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
      mockGetSpace.mockResolvedValueOnce({
        ...DEFAULT_SPACE,
        voting: { ...DEFAULT_SPACE.voting, type: 'multiple-choices' }
      });

      await expect(writer.verify(input)).rejects.toMatch('voting');
      expect(mockGetSpace).toHaveBeenCalledTimes(1);
    });

    describe('when the proposal contains flagged contents', () => {
      const msg = JSON.parse(input.msg);
      const invalidInput = [
        [{ ...input, address: writer.FLAGGED_ADDRESSES[0] }, 'submitted address is flagged'],
        [
          { ...input, msg: { ...msg, name: `${msg.name} - ${writer.FLAGGED_NAME_KEYWORDS}` } },
          'name contains flagged keywords'
        ],
        [
          { ...input, msg: { ...msg, body: `${msg.body} - ${writer.FLAGGED_BODY_KEYWORDS}` } },
          'body contains flagged keywords'
        ]
      ];

      it.each(invalidInput)('rejects when the %s', async (title, val) => {
        await expect(writer.verify(val)).rejects.toMatch('wrong');
      });
    });

    describe('when the submitter is not a space member', () => {
      beforeEach(() => {
        mockSnapshotUtilsValidate.mockResolvedValueOnce(false);
      });

      describe('when using a custom of validation', () => {
        it('validates the space validation using snapshot SDK', async () => {
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
          await writer.verify(input);

          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(0);
        });
      });

      describe('when using the any validation', () => {
        it('does not validate the space validation', async () => {
          await writer.verify(input);

          expect(mockSnapshotUtilsValidate).toHaveBeenCalledTimes(0);
        });
      });
    });

    it('rejects if the snapshot is in the future', async () => {
      const msg = JSON.parse(input.msg);
      msg.payload.snapshot = Number.MAX_SAFE_INTEGER;

      await expect(writer.verify({ ...input, msg: JSON.stringify(msg) })).rejects.toMatch(
        'snapshot'
      );
    });

    it('rejects if the space has exceeded the proposal daily post limit', async () => {
      const mockGetRecentProposalsCount = jest
        .spyOn(writer, 'getRecentProposalsCount')
        .mockResolvedValueOnce([{ count_1d: 100, count_30d: 0 }]);

      await expect(writer.verify(input)).rejects.toMatch('limit');
      expect(mockGetRecentProposalsCount).toHaveBeenCalledTimes(1);
    });

    it('rejects if the space has exceeded the proposal monthly post limit', async () => {
      const mockGetRecentProposalsCount = jest
        .spyOn(writer, 'getRecentProposalsCount')
        .mockResolvedValueOnce([{ count_1d: 0, count_30d: 999 }]);

      await expect(writer.verify(input)).rejects.toMatch('limit');
      expect(mockGetRecentProposalsCount).toHaveBeenCalledTimes(1);
    });

    it('rejects if the space limit checker fails', async () => {
      const mockGetRecentProposalsCount = jest
        .spyOn(writer, 'getRecentProposalsCount')
        .mockImplementationOnce(() => {
          throw new Error();
        });

      await expect(writer.verify(input)).rejects.toMatch('limit');
      expect(mockGetRecentProposalsCount).toHaveBeenCalledTimes(1);
    });

    describe('when only members can propose', () => {
      it('rejects if the submitter is not a space member', async () => {
        mockGetSpace.mockResolvedValueOnce({
          ...DEFAULT_SPACE,
          filters: { onlyMembers: true }
        });

        await expect(writer.verify(input)).rejects.toMatch('authors');
        expect(mockGetSpace).toHaveBeenCalledTimes(1);
      });
    });

    it('verifies a valid input', async () => {
      await expect(writer.verify(input)).resolves.toBeUndefined();
    });
  });
});
