describe('ingestor', () => {
  it.todo('rejects when the requestor IP is banned');
  it.todo('rejects when the schema is invalid');
  it.todo('rejects when the body is too large');
  it.todo('rejects when the timestamp is invalid');
  it.todo('rejects when the domain is not matching');
  it.todo('rejects when the type are not matching');
  it.todo('rejects when the space is not found');

  describe('when the message origin is not the sender', () => {
    it.todo('rejects when <wrong from>');
    it.todo('rejects when alias is not enabled');
    it.todo('rejects when alias is not valid');
  });

  it.todo('rejects when the signature is not valid');
  it.todo('rejects when the metadata is too large');
  it.todo('rejects when it fails the writer verification');
  it.todo('rejects when IPFS pinning fail');
  it.todo('rejects when the message storing fail');

  describe('on a valid transaction', () => {
    it.todo('returns an ID');
    it.todo('returns the IPFS address');
    it.todo('returns the relayer');
  });
});
