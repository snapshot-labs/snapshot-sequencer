import fetch from 'node-fetch';

const BLOCKAIDS_API_URL = 'https://api.blockaid.io/dapp/v1/scan';
const BLOCKAIDS_API_KEY = 'knUtyWFpcba5LlMUsky1jUkMM7kKPTug';

function extractUrls(text: string): string[] {
  return text.match(/(?:https?:\/\/)?[^\s<>()]+?\.[a-zA-Z]{2,}(?:\/[^\s<>()]*)?/g) || [];
}

async function scan(url: string) {
  const res = await fetch(BLOCKAIDS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': BLOCKAIDS_API_KEY
    },
    body: JSON.stringify({ url })
  });

  return await res.json();
}

async function scanMultiple(urls: string[]) {
  return await Promise.all(urls.map(url => scan(url)));
}

export async function isMalicious(content: string): Promise<boolean> {
  const urls = extractUrls(content);

  const results = await scanMultiple(urls);

  return results.some(result => result.is_malicious);
}
