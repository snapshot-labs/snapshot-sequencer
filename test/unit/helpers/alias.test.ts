import { getAllowedTypes, isStarknetAddress } from '../../../src/helpers/alias';

describe('Alias', () => {
  describe('isStarknetAddress()', () => {
    it('should return true for a starknet address', () => {
      expect(
        isStarknetAddress('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
      ).toBe(true);
    });
    it('should return false for a non-starknet address', () => {
      expect(isStarknetAddress('0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3')).toBe(false);
    });
    it('should return false for an invalid address', () => {
      expect(isStarknetAddress('')).toBe(false);
      expect(isStarknetAddress('test')).toBe(false);
    });
  });

  describe('getAllowedTypes()', () => {
    it('should return the correct types when both withAlias and forStarknet are false', () => {
      const result = getAllowedTypes(false, false);
      expect(result).toContain('profile');
      expect(result).not.toContain('vote');
      expect(result).not.toContain('update-proposal');
    });
    it('should return the correct types when withAlias is true and forStarknet is false', () => {
      const result = getAllowedTypes(true, false);
      expect(result).toContain('profile');
      expect(result).toContain('vote');
      expect(result).toContain('update-proposal');
    });
    it('should return the correct types when withAlias is false and forStarknet is true', () => {
      const result = getAllowedTypes(false, true);
      expect(result).toContain('profile');
      expect(result).toContain('vote');
      expect(result).toContain('update-proposal');
    });
    it('should return the correct types when both withAlias and forStarknet are true', () => {
      const result = getAllowedTypes(true, true);
      expect(result).toContain('profile');
      expect(result).toContain('vote');
      expect(result).toContain('update-proposal');
    });
  });
});
