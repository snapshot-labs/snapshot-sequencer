import { DESTRUCTION } from 'dns';
import { verify } from '../../../src/writer/reactivate-space';

const input = {
  msg: { space: 'fabien.eth' },
  address: '0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00'
};

const regularAddress = '0xdDE56667616D31974A36F1CFcbe78481BBeE9A0F';

const DEFAULT_SPACE: any = {
  id: 'fabien.eth',
  network: '5',
  voting: { aliased: false, type: 'single-choice' },
  strategies: [],
  members: [],
  admins: ['0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00'],
  moderators: [],
  validation: { name: 'basic' },
  hibernated: true
};

const mockGetSpace = jest.fn((id: any): any => {
  return { ...DEFAULT_SPACE, id };
});
jest.mock('../../../src/helpers/actions', () => {
  const originalModule = jest.requireActual('../../../src/helpers/actions');

  return {
    __esModule: true,
    ...originalModule,
    getSpace: (id: string) => mockGetSpace(id)
  };
});

const mockGetSpaceController = jest.fn((): any => {
  return '0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00';
});
jest.mock('@snapshot-labs/snapshot.js', () => {
  const originalModule = jest.requireActual('@snapshot-labs/snapshot.js');

  return {
    ...originalModule,
    utils: {
      ...originalModule.utils,
      getSpaceController: () => mockGetSpaceController()
    }
  };
});

describe('writer/reactivate-space', () => {
  describe('verify()', () => {
    it('rejects if the submitter is not authorized to reactivate', () => {
      return expect(verify({ ...input, address: regularAddress })).rejects.toEqual(
        'not authorized to reactivate space'
      );
    });

    it('rejects if the space is not found', async () => {
      mockGetSpace.mockResolvedValueOnce(null);

      return expect(verify(input)).rejects.toEqual('unknown space');
    });

    it('pass if the space is not hibernated', () => {
      const activeSpace = { ...DEFAULT_SPACE, hibernated: false };
      mockGetSpace.mockResolvedValueOnce(activeSpace);

      expect(verify(input)).resolves.toBe(activeSpace);
    });

    it('resolves if the submitter is the space controller', () => {
      mockGetSpaceController.mockResolvedValueOnce(input.address);
      mockGetSpace.mockResolvedValueOnce(DEFAULT_SPACE);
      expect(verify(input)).resolves.toBe(DEFAULT_SPACE);
    });

    it('resolves if the submitter is a space admin', () => {
      mockGetSpace.mockResolvedValueOnce(DEFAULT_SPACE);
      expect(verify({ ...input, address: DEFAULT_SPACE.admins[0] })).resolves.toBe(DEFAULT_SPACE);
    });
  });
});
