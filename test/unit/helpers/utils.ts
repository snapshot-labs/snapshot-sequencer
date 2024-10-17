import { formatApp } from '../../../src/helpers/utils';

describe('utils', () => {
  describe('formatApp()', () => {
    it('returns an empty string on empty', () => {
      expect(formatApp(undefined)).toEqual('');
      expect(formatApp('')).toEqual('');
    });

    it('returns the input when valid', () => {
      expect('0xAaB').toBe('0xAaB');
    });

    it('returns an empty string exceeding the chars limit', () => {
      expect(
        'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz!'
      ).toBe('');
    });
  });
});
