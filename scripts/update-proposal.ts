import { Wallet } from '@ethersproject/wallet';
import fetch from 'cross-fetch';

const pk = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const updateProposalTypes = {
  updateProposal: [
    { name: 'proposal', type: 'string' },
    { name: 'from', type: 'address' },
    { name: 'space', type: 'string' },
    { name: 'timestamp', type: 'uint64' },
    { name: 'type', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'body', type: 'string' },
    { name: 'discussion', type: 'string' },
    { name: 'choices', type: 'string[]' },
    { name: 'plugins', type: 'string' }
  ]
};

const domain = {
  name: 'snapshot',
  version: '0.1.4'
};

const message = {
  proposal: '0x6349860681beea9473979c14f096901ed9c7d5a5bdda83ffedc8589ef1da7b7d',
  type: 'single-choice',
  title: 'never give up',
  body: 'asfd',
  discussion: '',
  choices: ['+', '-'],
  plugins: '{}',

  from: address,
  timestamp: Math.floor(Date.now() / 1e3),
  space: 'test1.todmy.eth'
};

const wallet = new Wallet(pk);

async function run() {
  const sig = await wallet._signTypedData(domain, updateProposalTypes, message);

  const body = {
    address,
    sig,
    data: {
      domain,
      types: updateProposalTypes,
      message
    }
  };

  const resp = await fetch('http://localhost:3001/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  return [resp, body];
}

(async () => {
  try {
    const [resp, sentReq] = await run();
    console.log('sentReq', sentReq);
    console.log('resp', resp);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
