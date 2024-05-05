import snapshot from '@snapshot-labs/snapshot.js';
import hashTypes from '@snapshot-labs/snapshot.js/src/sign/hashedTypes.json';
import { pin } from '@snapshot-labs/pineapple';
import kebabCase from 'lodash/kebabCase';
import relayer, { issueReceipt } from './helpers/relayer';
import envelope from './helpers/envelope.json';
import writer from './writer';
import { getIp, jsonParse, sha256 } from './helpers/utils';
import { isValidAlias } from './helpers/alias';
import { getProposal, getSpace } from './helpers/actions';
import { storeMsg, doesMessageExist } from './helpers/highlight';
import log from './helpers/log';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { flaggedIps } from './helpers/moderation';
import { timeIngestorProcess } from './helpers/metrics';
import { Envelope, InitialEnvelope } from './schemas';

type Writers = typeof writer;
type WritersKeys = keyof Writers;
type Handler<WriterKey extends WritersKeys> = {
  verify: (message: Parameters<Writers[WriterKey]['verify']>[0]) => Promise<any>;
  action: (
    message: Parameters<Writers[WriterKey]['action']>[0],
    ipfs: Parameters<Writers[WriterKey]['action']>[1],
    receipt: Parameters<Writers[WriterKey]['action']>[2],
    id: Parameters<Writers[WriterKey]['action']>[3],
    context: Parameters<Writers[WriterKey]['action']>[4]
  ) => Promise<any>;
};

const NAME = 'snapshot';
const VERSION = '0.1.4';
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export default async function ingestor(req) {
  let success = 0;
  let type = '';
  let network = '1';
  const endTimer = timeIngestorProcess.startTimer();

  try {
    if (flaggedIps.includes(sha256(getIp(req)))) {
      return Promise.reject('unauthorized');
    }

    const schemaIsValid = snapshot.utils.validateSchema(envelope, req.body);
    if (schemaIsValid !== true) {
      log.warn(`[ingestor] Wrong envelope format ${JSON.stringify(schemaIsValid)}`);
      return Promise.reject('wrong envelope format');
    }

    const ts = Date.now() / 1e3;
    const over = 300;
    const under = 60 * 60 * 24 * 3; // 3 days
    const overTs = Math.round(ts + over);
    const underTs = Math.round(ts - under);

    if (JSON.stringify(req.body).length > 1e5) return Promise.reject('too large message');

    const initialEnvelopeResult = InitialEnvelope.safeParse(req.body);
    if (!initialEnvelopeResult.success) return Promise.reject('wrong envelope format');
    const { domain, types } = initialEnvelopeResult.data.data;

    if (domain.name !== NAME || domain.version !== VERSION) return Promise.reject('wrong domain');

    // Ignore EIP712Domain type, it's not used
    delete types.EIP712Domain;

    const hash = sha256(JSON.stringify(types));
    if (!Object.keys(hashTypes).includes(hash)) return Promise.reject('wrong types');
    type = hashTypes[hash];

    const bodyWithType = {
      ...req.body,
      data: {
        ...req.body.data,
        type
      }
    };
    const envelopeResult = Envelope.safeParse(bodyWithType);
    if (!envelopeResult.success) return Promise.reject('wrong envelope format');
    const { data: parsed } = envelopeResult;
    const { type: messageType, message } = parsed.data;

    if (message.timestamp > overTs || message.timestamp < underTs)
      return Promise.reject('wrong timestamp');

    network = '1';
    let aliased = false;

    if (messageType !== 'settings' && messageType !== 'alias' && messageType !== 'profile') {
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
    if (parsed.address !== message.from) {
      if (!aliasTypes.includes(messageType) && !aliasOptionTypes.includes(messageType))
        return Promise.reject('wrong from');

      if (aliasOptionTypes.includes(type) && !aliased) return Promise.reject('alias not enabled');

      if (!(await isValidAlias(message.from, parsed.address))) return Promise.reject('wrong alias');
    }

    // Check if signature is valid
    try {
      const isValidSig = await snapshot.utils.verify(
        parsed.address,
        parsed.sig,
        parsed.data,
        network,
        {
          broviderUrl
        }
      );
      if (!isValidSig) throw new Error('invalid signature');
    } catch (e: any) {
      log.warn(`signature validation failed for ${parsed.address} ${JSON.stringify(e)}`);
      return Promise.reject('signature validation failed');
    }

    const id = snapshot.utils.getHash(parsed.data);
    let payload = {};

    if (await doesMessageExist(id)) {
      return Promise.reject('duplicate message');
    }

    if (messageType === 'settings') payload = JSON.parse(message.settings);
    if (messageType === 'proposal')
      payload = {
        name: message.title,
        body: message.body,
        discussion: message.discussion || '',
        choices: message.choices,
        start: message.start,
        end: message.end,
        snapshot: message.snapshot,
        metadata: {
          plugins: JSON.parse(message.plugins)
        },
        type: message.type,
        app: kebabCase(message.app || '')
      };
    if (messageType === 'alias') payload = { alias: message.alias };
    if (messageType === 'statement') {
      payload = { about: message.about, statement: message.statement };
    }
    if (messageType === 'delete-proposal') payload = { proposal: message.proposal };
    if (messageType === 'update-proposal') {
      payload = {
        proposal: message.proposal,
        name: message.title,
        body: message.body,
        discussion: message.discussion || '',
        choices: message.choices,
        metadata: {
          plugins: JSON.parse(message.plugins)
        },
        type: message.type
      };
    }
    if (messageType === 'flag-proposal') payload = { proposal: message.proposal };

    if (messageType === 'vote' || messageType === 'vote-array' || messageType === 'vote-string') {
      let choice = message.choice;
      if (messageType === 'vote-string') {
        const proposal = await getProposal(message.space, message.proposal);
        if (!proposal) return Promise.reject('unknown proposal');
        if (proposal.privacy !== 'shutter') {
          try {
            choice = JSON.parse(message.choice);
          } catch (e) {
            return Promise.reject('invalid choice');
          }
        }
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

    const legacyBody = {
      address: message.from,
      msg: JSON.stringify({
        version: domain.version,
        timestamp: message.timestamp,
        space: 'space' in message ? message.space : '',
        type,
        payload
      }),
      sig: parsed.sig
    };
    const msg = jsonParse(legacyBody.msg);

    let context;
    try {
      if (
        messageType === 'follow' ||
        messageType === 'unfollow' ||
        messageType === 'subscribe' ||
        messageType === 'unsubscribe' ||
        messageType === 'profile'
      ) {
        // NOTE: those are only writers that support new format right now, in the future it won't be conditional
        // once other writers are updated
        const handler = writer[messageType] as Handler<typeof messageType>;
        context = await handler.verify(message);
      } else {
        context = await writer[messageType].verify(legacyBody);
      }
    } catch (e) {
      if (typeof e !== 'string') {
        capture(e);
      }
      log.warn(
        `[ingestor] [space: ${'space' in message && message.space}] verify failed ${JSON.stringify(
          e
        )}`
      );
      return Promise.reject(e);
    }

    let pinned;
    let receipt;
    try {
      const { address, sig, ...restBody } = parsed;
      const ipfsBody = {
        address,
        sig,
        hash: id,
        ...restBody
      };
      [pinned, receipt] = await Promise.all([
        pin(ipfsBody, process.env.PINEAPPLE_URL),
        issueReceipt(parsed.sig)
      ]);
    } catch (e) {
      capture(e);
      return Promise.reject('pinning failed');
    }
    const ipfs = pinned.cid;

    try {
      if (
        messageType === 'follow' ||
        messageType === 'unfollow' ||
        messageType === 'subscribe' ||
        messageType === 'unsubscribe' ||
        messageType === 'profile'
      ) {
        // NOTE: those are only writers that support new format right now, in the future it won't be conditional
        // once other writers are updated
        const handler = writer[messageType] as Handler<typeof messageType>;
        context = await handler.action(message, ipfs, receipt, id, context);
      } else {
        await writer[messageType].action(legacyBody, ipfs, receipt, id, context);
      }

      await storeMsg(
        id,
        ipfs,
        parsed.address,
        msg.version,
        msg.timestamp,
        msg.space || '',
        msg.type,
        parsed.sig,
        receipt
      );
    } catch (e: any) {
      // Last check to avoid duplicate entries, in the unlikely event
      // that the writer's action was successful, but storeMsg failed or is not
      // completed yet
      if (e.errno === 1062) {
        return Promise.reject('duplicate message');
      }

      if (typeof e !== 'string') {
        capture(e);
      }

      return Promise.reject(e);
    }

    const shortId = `${id.slice(0, 7)}...`;
    const spaceText = 'space' in message && message.space ? ` on "${message.space}"` : '';
    log.info(
      `[ingestor] New "${type}"${spaceText} for "${parsed.address}", id: ${shortId}, IP: ${sha256(
        getIp(req)
      )}`
    );

    success = 1;
    return {
      id,
      ipfs,
      relayer: {
        address: relayer.address,
        receipt
      }
    };
  } finally {
    endTimer({ status: success, type, network });
  }
}
