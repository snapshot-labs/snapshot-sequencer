import { verifyAlias } from '../../../src/helpers/alias';

jest.mock('../../../src/helpers/mysql', () => ({
  __esModule: true,
  default: { queryAsync: jest.fn() }
}));

describe('verifyAlias()', () => {
  it('resolves when the sender is the creator', async () => {
    const body = { address: '0xabc', data: { message: { from: '0xabc' } } };
    await expect(verifyAlias('vote', body)).resolves.toBeUndefined();
  });

  it('rejects when the type is not alias-executable', async () => {
    const body = { address: '0xaaa', data: { message: { from: '0xbbb' } } };
    await expect(verifyAlias('settings', body)).rejects.toMatch('alias not allowed');
  });
});
