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
      await db.queryAsync('DELETE FROM proposals');
      await db.endAsync();
      await sequencerDB.endAsync();
    });

    describe('when the proposal contains flagged links', () => {
      it('flagged the proposal', async () => {
        expect.assertions(1);
        mockContainsFlaggedLinks.mockReturnValueOnce(true);
        const id = '0x01';
        await action(input, 'ipfs', 'receipt', id);

        const [proposal] = await db.queryAsync('SELECT * FROM proposals WHERE id = ?', [id]);
        expect(proposal.flagged).toBe(1);
      });
    });

    describe('when the proposal does not contain flagged links', () => {
      it('does not flag proposal', async () => {
        const id = '0x02';
        await action(input, 'ipfs', 'receipt', id);

        const [proposal] = await db.queryAsync('SELECT * FROM proposals WHERE id = ?', [id]);
        expect(proposal.flagged).toBe(0);
      });
    });
  });
});
