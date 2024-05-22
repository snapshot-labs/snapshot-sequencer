import { action } from '../../../src/writer/proposal';
import db, { sequencerDB } from '../../../src/helpers/mysql';
import input from '../../fixtures/writer-payload/proposal.json';
import { spacesGetSpaceFixtures } from '../../fixtures/space';
import { setData } from '../../../src/helpers/moderation';
import * as actionHelper from '../../../src/helpers/actions';

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

const getSpaceMock = jest.spyOn(actionHelper, 'getSpace');
getSpaceMock.mockResolvedValue(spacesGetSpaceFixtures);

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
      beforeAll(() => {
        setData({ flaggedLinks: [JSON.parse(input.msg).payload.body] });
      });

      afterAll(() => {
        setData({ flaggedLinks: [] });
      });

      it('creates and flags the proposal', async () => {
        expect.assertions(3);
        mockContainsFlaggedLinks.mockReturnValueOnce(true);
        const id = '0x01-flagged';
        await expect(action(input, 'ipfs', 'receipt', id)).resolves.toBeUndefined();
        expect(mockContainsFlaggedLinks).toBeCalledTimes(1);

        const [proposal] = await db.queryAsync('SELECT * FROM proposals WHERE id = ?', [id]);
        return expect(proposal.flagged).toBe(1);
      });
    });

    describe('when the proposal does not contain flagged links', () => {
      it('creates and does not flag proposal', async () => {
        expect.assertions(3);
        const id = '0x02-non-flagged';
        await expect(action(input, 'ipfs', 'receipt', id)).resolves.toBeUndefined();
        expect(mockContainsFlaggedLinks).toBeCalledTimes(1);

        const [proposal] = await db.queryAsync('SELECT * FROM proposals WHERE id = ?', [id]);
        return expect(proposal.flagged).toBe(0);
      });
    });
  });
});
