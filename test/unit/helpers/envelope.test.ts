import snapshot from '@snapshot-labs/snapshot.js';
import envelope from '../../../src/helpers/envelope.json';

function withSpace(obj: any, spaceName: any) {
  return {
    ...obj,
    data: {
      ...obj.data,
      message: {
        ...obj.data.message,
        space: spaceName
      }
    }
  };
}

describe('envelope.json', () => {
  const validBody = {
    address: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
    data: {
      domain: {
        name: 'snapshot',
        version: '0.1.4'
      },
      message: {
        from: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
        timestamp: 0
      },
      types: {}
    },
    sig: ''
  };

  it('returns true when the schema is valid', () => {
    expect(snapshot.utils.validateSchema(envelope, validBody)).toBe(true);
  });

  it('return true when space is valid', () => {
    expect(snapshot.utils.validateSchema(envelope, withSpace(validBody, 'space.eth'))).toBe(true);
  });

  it('return false when space is empty', () => {
    expect(snapshot.utils.validateSchema(envelope, withSpace(validBody, ''))?.[0]).toEqual(
      expect.objectContaining({ instancePath: '/data/message/space' })
    );
  });

  it('return false when space is null', () => {
    expect(snapshot.utils.validateSchema(envelope, withSpace(validBody, null))?.[0]).toEqual(
      expect.objectContaining({ instancePath: '/data/message/space' })
    );
  });

  it('return false when space contains spaces', () => {
    expect(snapshot.utils.validateSchema(envelope, withSpace(validBody, 'test.eth '))?.[0]).toEqual(
      expect.objectContaining({ instancePath: '/data/message/space' })
    );
    expect(
      snapshot.utils.validateSchema(envelope, withSpace(validBody, ' test.eth '))?.[0]
    ).toEqual(expect.objectContaining({ instancePath: '/data/message/space' }));
    expect(snapshot.utils.validateSchema(envelope, withSpace(validBody, 'test. eth'))?.[0]).toEqual(
      expect.objectContaining({ instancePath: '/data/message/space' })
    );
    expect(snapshot.utils.validateSchema(envelope, withSpace(validBody, '   '))?.[0]).toEqual(
      expect.objectContaining({ instancePath: '/data/message/space' })
    );
  });
});
