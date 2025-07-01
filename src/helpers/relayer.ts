import { verifyTypedData, Wallet } from '@ethersproject/wallet';

const RECEIPT_DOMAIN = {
  name: 'snapshot-receipt',
  version: '0.1.0'
};

const RECEIPT_TYPES = {
  Receipt: [{ name: 'sig', type: 'string' }]
};

const privateKey = process.env.RELAYER_PK ?? '';
const wallet = new Wallet(privateKey);

function getReceiptData(sig: string) {
  return { sig };
}

export async function issueReceipt(sig: string) {
  return await wallet._signTypedData(RECEIPT_DOMAIN, RECEIPT_TYPES, getReceiptData(sig));
}

export function verifyReceipt(sig: string, receipt: string): boolean {
  try {
    const signer = verifyTypedData(RECEIPT_DOMAIN, RECEIPT_TYPES, getReceiptData(sig), receipt);
    return signer.toLowerCase() === wallet.address.toLowerCase();
  } catch (e) {
    return false;
  }
}

export default wallet;
