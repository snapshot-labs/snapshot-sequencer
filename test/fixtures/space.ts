// Mock return results from SQL
const SpacesSqlFixtures: Record<string, any>[] = [
  {
    id: 'test.eth',
    name: 'Test Space',
    verified: 1,
    flagged: 0,
    deleted: 0,
    created_at: 1649844547,
    updated_at: 1649844547,
    settings: {
      name: 'Test Space',
      admins: ['0xFC01614d28595d9ea5963daD9f44C0E0F0fE10f0'],
      symbol: 'TEST',
      network: '1',
      strategies: []
    }
  },
  {
    id: 'test2.eth',
    name: 'Test Space 2',
    verified: 0,
    flagged: 0,
    deleted: 0,
    created_at: 1649844547,
    updated_at: 1649844547,
    settings: {
      name: 'Test Space 2',
      admins: ['0x87D68ecFBcF53c857ABf494728Cf3DE1016b27B0'],
      symbol: 'TEST2',
      network: '1',
      strategies: []
    }
  }
];

export default SpacesSqlFixtures;
