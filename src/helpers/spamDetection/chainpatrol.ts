import fetch from 'node-fetch';

const CHAINPATROL_API_URL = 'https://app.chainpatrol.io/api/v2/asset/check';
const CHAINPATROL_API_KEY = process.env.CHAINPATROL_API_KEY || '';

function extractUrls(text: string): string[] {
  return text.match(/(?:https?:\/\/)?[^\s<>()]+?\.[a-zA-Z]{2,}(?:\/[^\s<>()]*)?/g) || [];
}

async function scan(url: string) {
  if (!CHAINPATROL_API_KEY) return { is_malicious: false };
  const res = await fetch(CHAINPATROL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CHAINPATROL_API_KEY
    },
    body: JSON.stringify({ content: url })
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
