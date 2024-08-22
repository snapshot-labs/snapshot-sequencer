import snapshot from '@snapshot-labs/snapshot.js';
import { Delegate } from '../';

export class Provider {
  spaceId: string;
  delegates: Delegate[];

  // Time in seconds between each request, 0 to disable
  throttle_interval = 0;

  constructor(spaceId: string) {
    this.spaceId = spaceId;
    this.delegates = [];
  }

  async fetch(): Promise<Delegate[]> {
    await this._fetch();

    console.log(
      `[${this.getId()}] ${this.spaceId} - ✅ Found ${
        Object.keys(this.delegates).length
      } delegate(s) with statement`
    );

    return this.delegates;
  }

  async _fetch() {}

  formatDelegate(result: { delegate: string; statement: string }): Delegate {
    const [network, space] = this.spaceId.split(':');

    return {
      ...result,
      source: this.getId(),
      space,
      network
    };
  }

  beforeFetchPage(page: number) {
    console.log(`[${this.getId()}] ${this.spaceId} - Fetching page #${page + 1}`);
  }

  async afterFetchPage(page: number, delegates: Delegate[]) {
    if (delegates.length) {
      this.delegates = { ...this.delegates, ...delegates };

      console.log(`[${this.getId()}] -- Importing ${delegates.length} delegate(s)`);
    }

    if (this.throttle_interval) {
      await snapshot.utils.sleep(this.throttle_interval);
    }
  }

  throttled(): boolean {
    return this.throttle_interval > 0;
  }

  getMapping() {
    return {};
  }

  getId(): string {
    return '';
  }
}
