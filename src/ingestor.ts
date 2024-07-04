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

const NETWORK_METADATA = {
  evm: {
    name: 'snapshot',
    version: '0.1.4',
    broviderUrl: process.env.BROVIDER_URL ?? 'https://rpc.snapshot.org',
    defaultNetwork: '1'
  },
  starknet: {
    name: 'sx-starknet',
    version: '0.1.0',
    broviderUrl: process.env.STARKNET_RPC_URL,
    defaultNetwork: process.env.NETWORK === 'mainnet' ? 'SN_MAIN' : 'SN_SEPOLIA'
  }
};

export default async function ingestor(req) {
  let success = 0;
  let type = '';
  const endTimer = timeIngestorProcess.startTimer();
  const networkMetadata =
    NETWORK_METADATA[snapshot.utils.isEvmAddress(req.body.address) ? 'evm' : 'starknet'];
  let network = networkMetadata.defaultNetwork;

  try {
    const body = req.body;
    const formattedSignature = Array.from(body.sig).join(',');

    if (flaggedIps.includes(sha256(getIp(req)))) {
      return Promise.reject('unauthorized');
    }

    const schemaIsValid = snapshot.utils.validateSchema(envelope, body);
    if (schemaIsValid !== true) {
      log.warn(`[ingestor] Wrong envelope format ${JSON.stringify(schemaIsValid)}`);
      return Promise.reject('wrong envelope format');
    }

    const ts = Date.now() / 1e3;
    const over = 300;
    const under = 60 * 60 * 24 * 3; // 3 days
    const overTs = (ts + over).toFixed();
    const underTs = (ts - under).toFixed();
    const { domain, message, types } = body.data;

    if (JSON.stringify(body).length > 1e5) return Promise.reject('too large message');

    if (message.timestamp > overTs || message.timestamp < underTs)
      return Promise.reject('wrong timestamp');

    if (message.proposal && message.proposal.includes(' '))
      return Promise.reject('proposal cannot contain whitespace');

    if (domain.name !== networkMetadata.name || domain.version !== networkMetadata.version) {
      return Promise.reject('wrong domain');
    }

    // Ignore EIP712Domain type, it's not used
    delete types.EIP712Domain;

    const hash = sha256(JSON.stringify(types));
    if (!Object.keys(hashTypes).includes(hash)) return Promise.reject('wrong types');
    type = hashTypes[hash];

    let aliased = false;
    if (!['settings', 'alias', 'profile'].includes(type)) {
      if (!message.space) return Promise.reject('unknown space');

      const space = await getSpace(message.space, false, message.network);
      if (!space) return Promise.reject('unknown space');
      network = space.network;
      if (space.voting?.aliased) aliased = true;
    }

    // Check if signing address is an alias
    const aliasTypes = ['follow', 'unfollow', 'subscribe', 'unsubscribe', 'profile', 'statement'];
    const aliasOptionTypes = ['vote', 'vote-array', 'vote-string', 'proposal', 'delete-proposal'];
    if (body.address !== message.from) {
      if (!aliasTypes.includes(type) && !aliasOptionTypes.includes(type))
        return Promise.reject('wrong from');

      if (aliasOptionTypes.includes(type) && !aliased) return Promise.reject('alias not enabled');

      if (!(await isValidAlias(message.from, body.address))) return Promise.reject('wrong alias');
    }

    // Check if signature is valid
    try {
      const isValidSig = await snapshot.utils.verify(body.address, body.sig, body.data, network, {
        broviderUrl: networkMetadata.broviderUrl
      });
      if (!isValidSig) throw new Error('invalid signature');
    } catch (e: any) {
      log.warn(`signature validation failed for ${body.address} ${JSON.stringify(e)}`);
      return Promise.reject('signature validation failed');
    }

    const id = snapshot.utils.getHash(body.data, body.address);
    let payload = {};

    if (await doesMessageExist(id)) {
      return Promise.reject('duplicate message');
    }

    if (type === 'settings') payload = JSON.parse(message.settings);

    if (type === 'proposal')
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
    if (type === 'alias') payload = { alias: message.alias };
    if (type === 'statement')
      payload = {
        about: message.about,
        statement: message.statement,
        discourse: message.discourse,
        status: message.status,
        network: message.network
      };
    if (type === 'delete-proposal') payload = { proposal: message.proposal };
    if (type === 'update-proposal') {
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
    if (type === 'flag-proposal') payload = { proposal: message.proposal };

    if (['vote', 'vote-array', 'vote-string'].includes(type)) {
      if (message.metadata && message.metadata.length > 2000)
        return Promise.reject('too large metadata');

      let choice = message.choice;
      if (type === 'vote-string') {
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

    let legacyBody: any = {
      address: message.from,
      msg: JSON.stringify({
        version: domain.version,
        timestamp: message.timestamp,
        space: message.space,
        type,
        payload
      }),
      sig: formattedSignature
    };
    const msg = jsonParse(legacyBody.msg);

    if (['follow', 'unfollow', 'subscribe', 'unsubscribe', 'profile'].includes(type)) {
      legacyBody = message;
    }

    if (legacyBody.address) {
      legacyBody.address = snapshot.utils.getFormattedAddress(legacyBody.address);
    }

    if (legacyBody.from) {
      legacyBody.from = snapshot.utils.getFormattedAddress(legacyBody.from);
    }

    let context;
    try {
      context = await writer[type].verify(legacyBody);
    } catch (e) {
      if (typeof e !== 'string') {
        capture(e);
      }
      log.warn(`[ingestor] [space: ${message?.space}] verify failed ${JSON.stringify(e)}`);
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
      [pinned, receipt] = await Promise.all([
        pin(ipfsBody, process.env.PINEAPPLE_URL),
        issueReceipt(formattedSignature)
      ]);
    } catch (e) {
      capture(e);
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
        formattedSignature,
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
    const spaceText = message.space ? ` on "${message.space}"` : '';
    log.info(
      `[ingestor] New "${type}"${spaceText} for "${body.address}", id: ${shortId}, IP: ${sha256(
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
