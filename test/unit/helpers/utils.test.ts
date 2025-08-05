import { arrayOperation } from '../../../src/helpers/utils';

describe('utils', () => {
  describe('arrayOperation()', () => {
    describe('Input Validation', () => {
      it('should throw error for invalid array inputs', () => {
        expect(() => arrayOperation(null as any, [1, 2])).toThrow(
          'Invalid arrays structure mismatch'
        );
        expect(() => arrayOperation([1, 2], null as any)).toThrow(
          'Invalid arrays structure mismatch'
        );
        expect(() => arrayOperation(undefined as any, [1, 2])).toThrow(
          'Invalid arrays structure mismatch'
        );
        expect(() => arrayOperation([1, 2], undefined as any)).toThrow(
          'Invalid arrays structure mismatch'
        );
        expect(() => arrayOperation('string' as any, [1, 2])).toThrow(
          'Invalid arrays structure mismatch'
        );
        expect(() => arrayOperation([1, 2], 'string' as any)).toThrow(
          'Invalid arrays structure mismatch'
        );
      });

      it('should throw error for arrays of different lengths', () => {
        expect(() => arrayOperation([1, 2], [3])).toThrow('Invalid arrays structure mismatch');
        expect(() => arrayOperation([1], [2, 3, 4])).toThrow('Invalid arrays structure mismatch');
        expect(() => arrayOperation([], [1, 2])).toThrow('Invalid arrays structure mismatch'); // Empty vs non-empty
      });

      it('should throw error for arrays with non-numeric values', () => {
        expect(() => arrayOperation([1, null, 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject null values
        expect(() => arrayOperation([1, undefined, 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject undefined values
        expect(() => arrayOperation([1, 2, 3], [4, null, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject null values
        expect(() => arrayOperation(['1', '2'], ['3', '4'])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject string numbers
        expect(() => arrayOperation([1, '2'], [3, '4'])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject mixed types
        expect(() => arrayOperation([1, 'invalid', 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject invalid strings
        expect(() => arrayOperation([1, {}, 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject objects
        expect(() => arrayOperation([1, [], 3], [4, 5, 6])).toThrow(
          'Invalid arrays structure mismatch'
        ); // Should reject nested arrays in wrong positions
      });

      it('should throw error for mixed flat and nested arrays with different structures', () => {
        expect(() => arrayOperation([1, 2], [[3], 4])).toThrow('Invalid arrays structure mismatch'); // Different structures - should reject
        expect(() => arrayOperation([[1], 2], [3, 4])).toThrow('Invalid arrays structure mismatch'); // Different structures - should reject
      });
    });

    describe('Basic Calculations', () => {
      it('should calculate element-wise multiplication for simple arrays', () => {
        expect(arrayOperation([1, 2, 3], [4, 5, 6], 'multiply')).toEqual([4, 10, 18]);
        expect(arrayOperation([2, 3], [4, 5], 'multiply')).toEqual([8, 15]);
        expect(arrayOperation([1], [5], 'multiply')).toEqual([5]);
      });

      it('should calculate element-wise addition for simple arrays', () => {
        expect(arrayOperation([1, 2, 3], [4, 5, 6], 'add')).toEqual([5, 7, 9]);
        expect(arrayOperation([2, 3], [4, 5], 'add')).toEqual([6, 8]);
        expect(arrayOperation([1], [5], 'add')).toEqual([6]);
      });

      it('should calculate element-wise subtraction for simple arrays', () => {
        expect(arrayOperation([10, 20, 30], [4, 5, 6], 'subtract')).toEqual([6, 15, 24]);
        expect(arrayOperation([5, 8], [2, 3], 'subtract')).toEqual([3, 5]);
        expect(arrayOperation([5], [1], 'subtract')).toEqual([4]);
      });

      it('should calculate element-wise division for simple arrays', () => {
        expect(arrayOperation([10, 20, 30], [2, 4, 5], 'divide')).toEqual([5, 5, 6]);
        expect(arrayOperation([6, 8], [2, 4], 'divide')).toEqual([3, 2]);
        expect(arrayOperation([10], [5], 'divide')).toEqual([2]);
      });

      it('should handle arrays with zeros', () => {
        expect(arrayOperation([1, 0, 3], [4, 5, 6], 'multiply')).toEqual([4, 0, 18]);
        expect(arrayOperation([0, 0, 0], [1, 2, 3], 'multiply')).toEqual([0, 0, 0]);
      });

      it('should handle negative numbers', () => {
        expect(arrayOperation([-1, 2], [3, -4], 'multiply')).toEqual([-3, -8]);
        expect(arrayOperation([-2, -3], [-4, -5], 'multiply')).toEqual([8, 15]);
        expect(arrayOperation([-1, 2], [3, -4], 'add')).toEqual([2, -2]);
      });

      it('should default to multiply when no operation specified', () => {
        expect(arrayOperation([1, 2, 3], [4, 5, 6])).toEqual([4, 10, 18]);
      });
    });

    describe('Nested Array Support', () => {
      it('should handle nested arrays (single level)', () => {
        expect(arrayOperation([1, [2, 3]], [4, [5, 6]], 'multiply')).toEqual([4, [10, 18]]);
      });

      it('should handle deeply nested arrays', () => {
        expect(arrayOperation([1, [2, [3, 4]]], [5, [6, [7, 8]]], 'multiply')).toEqual([
          5,
          [12, [21, 32]]
        ]);
        expect(arrayOperation([[[1]], [2]], [[[3]], [4]], 'multiply')).toEqual([[[3]], [8]]);
      });
    });

    describe('JavaScript Native Precision', () => {
      it('should handle large × large number multiplication', () => {
        // Test realistic large financial numbers
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const votingPower = [123456789012.456789];
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const tokenValue = [987654321.123456789];

        const result = arrayOperation(votingPower, tokenValue, 'multiply');
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const expected = [123456789012.456789 * 987654321.123456789];

        expect(result).toEqual(expected);
      });

      it('should handle small × large number multiplication (DeFi scenario)', () => {
        // Test small token values with large voting power
        const smallTokenValues = [1e-18, 1e-12, 1e-6]; // Wei, micro, milli units
        const largeVotingPower = [1e18, 1e15, 1e12]; // Large voting power values

        const result = arrayOperation(smallTokenValues, largeVotingPower, 'multiply');

        expect(result).toEqual([1, 1000, 1000000]);
      });

      it('should handle maximum precision decimal numbers', () => {
        // Test JavaScript's precision limits (~15-16 significant digits)
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const maxDecimalA = [1.1234567890123456];
        const maxDecimalB = [2.9876543210987654];

        const result = arrayOperation(maxDecimalA, maxDecimalB, 'multiply');
        // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
        const expected = [1.1234567890123456 * 2.9876543210987654];

        expect(result).toEqual(expected);
      });

      it('should handle underflow edge cases', () => {
        // Test numbers that underflow to 0
        const verySmallA = [1e-200];
        const verySmallB = [1e-200];

        const result = arrayOperation(verySmallA, verySmallB, 'multiply');

        expect(result).toEqual([0]); // JavaScript underflow behavior
      });
    });

    describe('Infinity and NaN handling', () => {
      it('should throw error when division by zero results in infinity', () => {
        expect(() => arrayOperation([1, 2], [0, 0], 'divide')).toThrow(
          'Operation resulted in infinity or NaN'
        );
      });

      it('should throw error when multiplication results in infinity', () => {
        expect(() => arrayOperation([Number.MAX_VALUE], [Number.MAX_VALUE], 'multiply')).toThrow(
          'Operation resulted in infinity or NaN'
        );
      });

      it('should throw error when operation with infinity', () => {
        expect(() => arrayOperation([Infinity, 1], [1, 1], 'add')).toThrow(
          'Operation resulted in infinity or NaN'
        ); // Infinity + 1 = Infinity
      });

      it('should throw error for nested arrays with infinity results', () => {
        expect(() =>
          arrayOperation(
            [
              [1, 2],
              [3, 4]
            ],
            [
              [0, 0],
              [1, 1]
            ],
            'divide'
          )
        ).toThrow('Operation resulted in infinity or NaN');
      });

      it('should throw error when subtraction results in negative infinity', () => {
        expect(() => arrayOperation([-Number.MAX_VALUE], [Number.MAX_VALUE], 'subtract')).toThrow(
          'Operation resulted in infinity or NaN'
        );
      });
    });
  });
});
