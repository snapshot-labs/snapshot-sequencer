import { action } from '../../../src/writer/proposal';
import db, { sequencerDB } from '../../../src/helpers/mysql';
import input from '../../fixtures/writer-payload/proposal.json';

const mockContainsFlaggedLinks = jest.fn((): any => {
  return false;
});

jest.mock('../../../src/helpers/moderation', () => {
  const originalModule = jest.requireActual('../../../src/helpers/moderation');

  return {
    __esModule: true,
    ...originalModule,
    containsFlaggedLinks: () => mockContainsFlaggedLinks()
  };
});

describe('writer/proposal', () => {
  describe('action()', () => {
    afterAll(async () => {
      await db.queryAsync('DELETE FROM proposals where id in (?)', [
        ['0x01-flagged', '0x02-non-flagged']
      ]);
      await db.endAsync();
      await sequencerDB.endAsync();
    });

    describe('when the proposal contains flagged links', () => {
      it('flag the proposal', async () => {
        expect.assertions(2);
        mockContainsFlaggedLinks.mockReturnValueOnce(true);
        const id = '0x01-flagged';
        await action(input, 'ipfs', 'receipt', id);

        const [proposal] = await db.queryAsync('SELECT * FROM proposals WHERE id = ?', [id]);
        expect(proposal.flagged).toBe(1);
        expect(mockContainsFlaggedLinks).toHaveBeenCalledTimes(1);
      });
    });

    describe('when the proposal does not contain flagged links', () => {
      it('does not flag proposal', async () => {
        expect.assertions(2);
        const id = '0x02-non-flagged';
        await action(input, 'ipfs', 'receipt', id);

        const [proposal] = await db.queryAsync('SELECT * FROM proposals WHERE id = ?', [id]);
        expect(proposal.flagged).toBe(0);
        expect(mockContainsFlaggedLinks).toHaveBeenCalledTimes(1);
      });
    });
  });
});
