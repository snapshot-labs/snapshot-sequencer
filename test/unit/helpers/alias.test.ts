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

  it('rejects delete-proposal when the author is an EVM address', async () => {
    const body = {
      address: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
      data: { message: { from: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f4' } }
    };
    await expect(verifyAlias('delete-proposal', body)).rejects.toMatch('alias not allowed');
  });
});
