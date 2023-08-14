import init from '@snapshot-labs/snapshot-metrics';
import { Express } from 'express';

export default function initMetrics(app: Express) {
  init(app, {
    normalizedPath: [
      ['/scores/.+', '/scores/#id'],
      ['/spaces/.+/poke', '/spaces/#key/poke']
    ],
    whitelistedPath: [/^\/$/, /^\/scores\/.+$/, /^\/spaces\/.+\/poke$/]
  });
}
