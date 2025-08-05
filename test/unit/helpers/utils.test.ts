import { dotProduct } from '../../../src/helpers/utils';

describe('utils', () => {
  describe('dotProduct()', () => {
    describe('Input Validation', () => {
      it('should throw error for invalid array inputs', () => {
        expect(() => dotProduct(null as any, [1, 2])).toThrow('Invalid arrays structure mismatch');
        expect(() => dotProduct([1, 2], null as any)).toThrow('Invalid arrays structure mismatch');
        expect(() => dotProduct(undefined as any, [1, 2])).toThrow(
          'Invalid arrays structure mismatch'
        );
        expect(() => dotProduct([1, 2], undefined as any)).toThrow(
          'Invalid arrays structure mismatch'
        );
        expect(() => dotProduct('string' as any, [1, 2])).toThrow(
          'Invalid arrays structure mismatch'
        );
        expect(() => dotProduct([1, 2], 'string' as any)).toThrow(
          'Invalid arrays structure mismatch'
        );
      });

      it('should throw error for arrays of different lengths', () => {
        expect(() => dotProduct([1, 2], [3])).toThrow('Invalid arrays structure mismatch');
        expect(() => dotProduct([1], [2, 3, 4])).toThrow('Invalid arrays structure mismatch');
        expect(() => dotProduct([], [1, 2])).toThrow('Invalid arrays structure mismatch'); // Empty vs non-empty
      });

      it('should throw error for arrays with non-numeric values', () => {
        expect(() => dotProduct([1, null, 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject null values
        expect(() => dotProduct([1, undefined, 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject undefined values
        expect(() => dotProduct([1, 2, 3], [4, null, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject null values
        expect(() => dotProduct(['1', '2'], ['3', '4'])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject string numbers
        expect(() => dotProduct([1, '2'], [3, '4'])).toThrow('Invalid arrays structure mismatch'); // Should reject mixed types
        expect(() => dotProduct([1, 'invalid', 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject invalid strings
        expect(() => dotProduct([1, {}, 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject objects
        expect(() => dotProduct([1, [], 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject arrays as values
      });

      it('should throw error for mixed flat and nested arrays with different structures', () => {
        expect(() => dotProduct([1, 2], [[3], 4])).toThrow('Invalid arrays structure mismatch'); // Different structures - should reject
        expect(() => dotProduct([[1], 2], [3, 4])).toThrow('Invalid arrays structure mismatch'); // Different structures - should reject
      });
    });

    describe('Basic Calculations', () => {
      it('should calculate dot product for simple arrays', () => {
        expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32); // 1*4 + 2*5 + 3*6 = 32
        expect(dotProduct([2, 3], [4, 5])).toBe(23); // 2*4 + 3*5 = 23
        expect(dotProduct([1], [5])).toBe(5); // 1*5 = 5
      });

      it('should handle arrays with zeros', () => {
        expect(dotProduct([1, 0, 3], [4, 5, 6])).toBe(22); // 1*4 + 0*5 + 3*6 = 22
        expect(dotProduct([0, 0, 0], [1, 2, 3])).toBe(0); // All zeros in first array
      });

      it('should handle negative numbers', () => {
        expect(dotProduct([-1, 2], [3, -4])).toBe(-11); // -1*3 + 2*(-4) = -11
        expect(dotProduct([-2, -3], [-4, -5])).toBe(23); // -2*(-4) + -3*(-5) = 23
      });
    });

    describe('Nested Array Support', () => {
      it('should handle nested arrays (single level)', () => {
        expect(dotProduct([1, [2, 3]], [4, [5, 6]])).toBe(32); // Flattened: [1,2,3] • [4,5,6] = 32
      });

      it('should handle deeply nested arrays', () => {
        expect(dotProduct([1, [2, [3, 4]]], [5, [6, [7, 8]]])).toBe(70); // [1,2,3,4] • [5,6,7,8] = 70
        expect(dotProduct([[[1]], [2]], [[[3]], [4]])).toBe(11); // [1,2] • [3,4] = 11
      });
    });

    describe('JavaScript Native Precision', () => {
      it('should handle large × large number multiplication', () => {
        // Test realistic large financial numbers
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const votingPower = [123456789012.456789];
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const tokenValue = [987654321.123456789];

        const result = dotProduct(votingPower, tokenValue);
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const expected = 123456789012.456789 * 987654321.123456789;

        expect(result).toBe(expected);
      });

      it('should handle small × large number multiplication (DeFi scenario)', () => {
        // Test small token values with large voting power
        const smallTokenValues = [1e-18, 1e-12, 1e-6]; // Wei, micro, milli units
        const largeVotingPower = [1e18, 1e15, 1e12]; // Large voting power values

        const result = dotProduct(smallTokenValues, largeVotingPower);

        // Should equal: 1 + 1000 + 1000000 = 1001001
        expect(result).toBe(1001001);
      });

      it('should handle maximum precision decimal numbers', () => {
        // Test JavaScript's precision limits (~15-16 significant digits)
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const maxDecimalA = [1.1234567890123456];
        const maxDecimalB = [2.9876543210987654];

        const result = dotProduct(maxDecimalA, maxDecimalB);
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const expected = 1.1234567890123456 * 2.9876543210987654;

        expect(result).toBe(expected);
      });

      it('should handle underflow edge cases', () => {
        // Test numbers that underflow to 0
        const verySmallA = [1e-200];
        const verySmallB = [1e-200];

        const result = dotProduct(verySmallA, verySmallB);

        expect(result).toBe(0); // JavaScript underflow behavior
      });
    });
  });
});
