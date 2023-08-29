import init, { client } from '@snapshot-labs/snapshot-metrics';
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

export const timeIngestorProcess = new client.Histogram({
  name: 'ingestor_process_duration_seconds',
  help: 'Duration in seconds of each ingestor process',
  labelNames: ['type', 'status', 'network']
});
