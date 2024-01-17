import http from 'http';
import https from 'https';
import isEqual from 'lodash/isEqual';
import { createHash } from 'crypto';
import { Response } from 'express';
import fetch from 'node-fetch';
import { URL } from 'url';
import snapshot from '@snapshot-labs/snapshot.js';
import { BigNumber } from '@ethersproject/bignumber';

export const DEFAULT_NETWORK = process.env.DEFAULT_NETWORK ?? '1';
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export function jsonParse(input, fallback?) {
  try {
    return JSON.parse(input);
  } catch (err) {
    return fallback || {};
  }
}

export function sendError(res: Response, description: any, status?: number) {
  const statusCode = status || (typeof description === 'string' ? 400 : 500);
  return res.status(statusCode).json({
    error: statusCode < 500 ? 'client_error' : 'server_error',
    error_description: description
  });
}

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

export function rpcSuccess(res, result, id) {
  res.json({
    jsonrpc: '2.0',
    result,
    id
  });
}

export function rpcError(res, code, e, id) {
  res.status(code).json({
    jsonrpc: '2.0',
    error: {
      code,
      message: 'unauthorized',
      data: e
    },
    id
  });
}

export function hasStrategyOverride(strategies: any[]) {
  const keywords = [
    '"aura-vlaura-vebal-with-overrides"',
    '"balance-of-with-linear-vesting-power"',
    '"balancer-delegation"',
    '"cyberkongz"',
    '"cyberkongz-v2"',
    '"delegation"',
    '"delegation-with-cap"',
    '"delegation-with-overrides"',
    '"erc20-balance-of-delegation"',
    '"erc20-balance-of-fixed-total"',
    '"erc20-balance-of-quadratic-delegation"',
    '"erc20-votes-with-override"',
    '"esd-delegation"',
    '"ocean-dao-brightid"',
    '"orbs-network-delegation"',
    '"api-v2-override"'
  ];
  const strategiesStr = JSON.stringify(strategies).toLowerCase();
  return keywords.some(keyword => strategiesStr.includes(`"name":${keyword}`));
}

export function validateChoices({ type, choices }): boolean {
  if (type && choices.length > 0) {
    switch (type) {
      case 'basic':
        return isEqual(['For', 'Against', 'Abstain'], choices);
      default:
        return true;
    }
  } else {
    return false;
  }
}

export function getIp(req) {
  const ips = (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    ''
  ).split(',');

  return ips[0].trim();
}

export function verifyAuth(req, res, next) {
  const auth = req.headers.secret || '';
  const authHash = sha256(auth);
  const secretHash = process.env.AUTH_SECRET;

  if (!secretHash || authHash !== secretHash) {
    return sendError(res, 'Unauthorized', 401);
  }

  return next();
}

const agentOptions = { keepAlive: true };
const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

function agent(url: string) {
  return new URL(url).protocol === 'http:' ? httpAgent : httpsAgent;
}

export const fetchWithKeepAlive = (uri: any, options: any = {}) => {
  return fetch(uri, { agent: agent(uri), ...options });
};

export const getQuorum = async (options: any, network: string, blockTag: number) => {
  const { strategy = 'static', total = 0 } = options;
  switch (strategy) {
    case 'static': {
      return total;
    }
    case 'balance': {
      const { address, methodABI, decimals, quorumModifier = 1 } = options;
      const provider = snapshot.utils.getProvider(network, { broviderUrl });

      const votingPower = await snapshot.utils.call(
        provider,
        [methodABI],
        [address, methodABI.name],
        {
          blockTag
        }
      );

      return (
        BigNumber.from(votingPower).div(BigNumber.from(10).pow(decimals)).toNumber() *
        quorumModifier
      );
    }

    case 'multichainBalance': {
      const { network, strategies, quorumModifier = 1 } = options;
      const provider = snapshot.utils.getProvider(network, { broviderUrl });
      const blocks = await snapshot.utils.getSnapshots(
        network,
        blockTag,
        provider,
        strategies.map(s => s.network || network)
      );
      const requests: Promise<any>[] = strategies.map(s =>
        snapshot.utils.call(
          snapshot.utils.getProvider(s.network, { broviderUrl }),
          [s.methodABI],
          [s.address, s.methodABI.name],
          {
            blockTag: blocks[s.network]
          }
        )
      );
      const results = await Promise.all(requests);
      const totalBalance = results.reduce((total, ele, index) => {
        if (index === 1) {
          total = total.div(BigNumber.from(10).pow(strategies[0].decimals));
        }
        return total.add(ele.div(BigNumber.from(10).pow(strategies[index].decimals)));
      });
      return totalBalance.toNumber() * quorumModifier;
    }

    default:
      throw new Error(`Unsupported quorum strategy: ${strategy}`);
  }
};
