import { DEFAULT_ALIAS_EXPIRY_DAYS } from '../../src/helpers/alias';

const now = Math.floor(Date.now() / 1000);
const EXPIRY_SECONDS = DEFAULT_ALIAS_EXPIRY_DAYS * 86400;

export const aliasesSqlFixtures: Record<string, any>[] = [
  {
    id: '1',
    ipfs: 'Qm...',
    address: '0x0000000000000000000000000000000000000000',
    alias: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
    created: now,
    expiration: now + EXPIRY_SECONDS
  },
  {
    id: '2',
    ipfs: 'Qm...',
    address: '0x02a0a8f3b6097e7a6bd7649deb30715323072a159c0e6b71b689bd245c146cc0',
    alias: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
    created: now,
    expiration: now + EXPIRY_SECONDS
  },
  {
    id: '3',
    ipfs: 'Qm...',
    address: '0x02a0a8f3b6097e7a6bd7649deb30715323072a159c0e6b71b689bd245c146cc0',
    alias: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f4',
    created: 1,
    expiration: 1 + EXPIRY_SECONDS
  }
];
