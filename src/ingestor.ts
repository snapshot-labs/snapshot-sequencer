import snapshot from '@snapshot-labs/snapshot.js';
import hashTypes from '@snapshot-labs/snapshot.js/src/sign/types.json';
import { pin } from '@snapshot-labs/pineapple';
import kebabCase from 'lodash/kebabCase';
import relayer, { issueReceipt } from './helpers/relayer';
import envelope from './helpers/envelope.json';
import writer from './writer';
import { getIp, jsonParse, sha256 } from './helpers/utils';
import { isValidAlias } from './helpers/alias';
import { getProposal, getSpace } from './helpers/actions';
import { storeMsg } from './helpers/highlight';
import log from './helpers/log';

const NAME = 'snapshot';
const VERSION = '0.1.4';

const spam = [
  '594c3796d3e139686d85fdfd48f58eb27748703689e93ac9404f8a6e3fe69488',
  'f38f87bfd58860fdb0dac0374ee6e1f4ef823867cd01286de4b031d762ceb18e',
  '516263be80d8ec183d89dbedf8093852775ed38ad2e2fff03f018522247651bd',
  'aed8ab2423772377b19170381d72d1d7b85bc741bc77700c0ff14c3e081e3605',
  '7d85f3c5a23d9773662ab276a04f064ed406215315a550dc337cf4276c22a747'
];

export default async function ingestor(req) {
  const body = req.body;

  if (spam.includes(sha256(getIp(req)))) {
    return Promise.reject('unauthorized');
  }

  const schemaIsValid = snapshot.utils.validateSchema(envelope, body);
  if (schemaIsValid !== true) {
    log.warn(`[ingestor] Wrong envelope format ${JSON.stringify(schemaIsValid)}`);
    return Promise.reject('wrong envelope format');
  }

  const ts = parseInt((Date.now() / 1e3).toFixed());
  const over = 300;
  const under = 60 * 60 * 24 * 3; // 3 days
  const overTs = (ts + over).toFixed();
  const underTs = (ts - under).toFixed();
  const { domain, message, types } = body.data;

  if (JSON.stringify(body).length > 1e5) return Promise.reject('too large message');

  if (message.timestamp > overTs || message.timestamp < underTs)
    return Promise.reject('wrong timestamp');

  if (domain.name !== NAME || domain.version !== VERSION) return Promise.reject('wrong domain');

  const hash = sha256(JSON.stringify(types));
  if (!Object.keys(hashTypes).includes(hash)) return Promise.reject('wrong types');
  let type = hashTypes[hash];

  let network = '1';
  let aliased = false;
  if (!['settings', 'alias', 'profile'].includes(type)) {
    if (!message.space) return Promise.reject('unknown space');
    const space = await getSpace(message.space);
    if (!space) return Promise.reject('unknown space');
    network = space.network;
    if (space.voting?.aliased) aliased = true;
  }

  // Check if signing address is an alias
  const aliasTypes = ['follow', 'unfollow', 'subscribe', 'unsubscribe', 'profile'];
  const aliasOptionTypes = [
    'vote',
    'vote-array',
    'vote-string',
    'proposal',
    'delete-proposal',
    'statement'
  ];
  if (body.address !== message.from) {
    if (!aliasTypes.includes(type) && !aliasOptionTypes.includes(type))
      return Promise.reject('wrong from');

    if (aliasOptionTypes.includes(type) && !aliased) return Promise.reject('alias not enabled');

    if (!(await isValidAlias(message.from, body.address))) return Promise.reject('wrong alias');
  }

  // Check if signature is valid
  try {
    const isValidSig = await snapshot.utils.verify(body.address, body.sig, body.data, network);
    if (!isValidSig) return Promise.reject('wrong signature');
  } catch (e) {
    log.warn(`signature validation failed for ${body.address} ${JSON.stringify(e)}`);
    return Promise.reject('signature validation failed');
  }

  const id = snapshot.utils.getHash(body.data);
  let payload = {};

  if (type === 'settings') payload = JSON.parse(message.settings);

  if (type === 'proposal') {
    payload = {
      name: message.title,
      body: message.body,
      discussion: message.discussion || '',
      choices: message.choices,
      start: message.start > ts ? message.start : ts,
      end: message.end,
      snapshot: message.snapshot,
      metadata: {
        plugins: JSON.parse(message.plugins)
      },
      type: message.type,
      app: kebabCase(message.app || '')
    };
  }

  if (type === 'delete-proposal') payload = { proposal: message.proposal };

  if (['vote', 'vote-array', 'vote-string'].includes(type)) {
    if (message.metadata && message.metadata.length > 2000)
      return Promise.reject('too large metadata');

    let choice = message.choice;
    if (type === 'vote-string') {
      const proposal = await getProposal(message.space, message.proposal);
      if (proposal.privacy !== 'shutter') choice = JSON.parse(message.choice);
    }

    payload = {
      proposal: message.proposal,
      choice,
      reason: message.reason || '',
      app: kebabCase(message.app || ''),
      metadata: jsonParse(message.metadata, {})
    };
    type = 'vote';
  }

  let legacyBody = {
    address: message.from,
    msg: JSON.stringify({
      version: domain.version,
      timestamp: message.timestamp,
      space: message.space,
      type,
      payload
    }),
    sig: body.sig
  };
  const msg = jsonParse(legacyBody.msg);

  if (
    ['follow', 'unfollow', 'alias', 'subscribe', 'unsubscribe', 'profile', 'statement'].includes(
      type
    )
  ) {
    legacyBody = message;
  }

  let context;
  try {
    context = await writer[type].verify(legacyBody);
  } catch (e) {
    log.warn(`[ingestor] verify failed ${JSON.stringify(e)}`);
    return Promise.reject(e);
  }

  let pinned;
  let receipt;
  try {
    const { address, sig, ...restBody } = body;
    const ipfsBody = {
      address,
      sig,
      hash: id,
      ...restBody
    };
    [pinned, receipt] = await Promise.all([pin(ipfsBody), issueReceipt(body.sig)]);
  } catch (e) {
    return Promise.reject('pinning failed');
  }
  const ipfs = pinned.cid;

  try {
    await writer[type].action(legacyBody, ipfs, receipt, id, context);
    await storeMsg(
      id,
      ipfs,
      body.address,
      msg.version,
      msg.timestamp,
      msg.space || '',
      msg.type,
      body.sig,
      receipt
    );
  } catch (e) {
    return Promise.reject(e);
  }

  const shortId = `${id.slice(0, 7)}...`;
  log.info(
    `[ingestor] New "${type}" on "${message.space}",  for "${
      body.address
    }", id: ${shortId}, IP: ${sha256(getIp(req))}`
  );

  return {
    id,
    ipfs,
    relayer: {
      address: relayer.address,
      receipt
    }
  };
}
