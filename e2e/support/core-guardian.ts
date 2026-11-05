import { randomBytes } from 'node:crypto';
import { CitizenBlockchain, signHash } from 'organic-money/src/index.js';
import { hashRequestAuth, REQUEST_AUTH_HEADERS } from 'organic-protocol';
import { SERVER_URL } from '../../playwright.config';

const API_PATH = '/api/v1';
const API = `${SERVER_URL}${API_PATH}`;

interface Guardian {
  publickey: string;
  secretKey: string;
}

const GUARDIAN_SECRET_KEY = '1'.repeat(64);

let guardian: Promise<Guardian> | undefined;
let serverPk: Promise<string> | undefined;

export function ensureCoreGuardian(): Promise<Guardian> {
  guardian ??= findOrRegisterGuardian();
  return guardian;
}

export async function approveCandidateNamed(name: string): Promise<void> {
  const { publickey, secretKey } = await ensureCoreGuardian();
  const guardianAuth = { publickey, secretKey };
  const candidatePk = await findCandidatePk(name, guardianAuth);
  const candidate = await send('GET', `/validations/${candidatePk}`, { signedBy: guardianAuth });
  const initBlock = new CitizenBlockchain(candidate.blocks).validateAccount(secretKey);

  await send('POST', `/validations/${candidatePk}/approve`, {
    body: { block: initBlock.export() },
    signedBy: guardianAuth,
  });
}

export async function registerPendingCitizen(name: string): Promise<string> {
  await ensureCoreGuardian();
  const chain = new CitizenBlockchain();
  chain.makeBirthBlock(name, new Date(Date.UTC(1990, 0, 1)));
  const publickey = chain.getMyPublicKey();
  await register(chain, publickey, name);
  return publickey;
}

async function findOrRegisterGuardian(): Promise<Guardian> {
  const chain = new CitizenBlockchain();
  const secretKey = chain.makeBirthBlock(
    'Gardien du cœur',
    new Date(Date.UTC(1980, 0, 1)),
    GUARDIAN_SECRET_KEY,
  );
  const publickey = chain.getMyPublicKey();

  if (!(await isRegistered(publickey))) {
    await registerGuardian(chain, publickey);
  }
  return { publickey, secretKey };
}

async function isRegistered(publickey: string): Promise<boolean> {
  const response = await fetch(`${API}/validations/status/${publickey}`);
  return response.ok;
}

async function registerGuardian(chain: CitizenBlockchain, publickey: string): Promise<void> {
  const status = await register(chain, publickey, 'Gardien du cœur');
  if (status !== 'active') {
    throw new Error('The core guardian must be the first account of a fresh e2e server');
  }
}

async function register(chain: CitizenBlockchain, publickey: string, name: string): Promise<string> {
  const registered = await send('POST', '/users/register', {
    body: {
      publickey,
      name,
      mail: `${name.replace(/\W/g, '').toLowerCase()}-api@e2e.test`,
      password: 'e2e-password',
      birthdate: '1980-01-01',
      secretkey: 'unused',
      blocks: chain.export(),
    },
  });
  return registered.status;
}

async function findCandidatePk(name: string, guardianAuth: Guardian): Promise<string> {
  const candidates: { pk: string; name: string }[] = await send('GET', '/validations', { signedBy: guardianAuth });
  const candidate = candidates.find((entry) => entry.name === name);
  if (!candidate) throw new Error(`No pending candidate named ${name}`);
  return candidate.pk;
}

async function send(
  method: string,
  path: string,
  { body, signedBy }: { body?: unknown; signedBy?: Guardian },
) {
  const json = body === undefined ? '' : JSON.stringify(body);
  const authHeaders = signedBy ? await requestAuthHeaders(method, `${API_PATH}${path}`, json, signedBy) : {};
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: body === undefined ? undefined : json,
  });
  return parseResponse(response);
}

async function requestAuthHeaders(method: string, path: string, json: string, { publickey, secretKey }: Guardian) {
  const fields = {
    method,
    path,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: randomBytes(16).toString('hex'),
    body: json,
    serverPk: await knownServerPk(),
    publickey,
  };
  return {
    [REQUEST_AUTH_HEADERS.publickey]: publickey,
    [REQUEST_AUTH_HEADERS.timestamp]: String(fields.timestamp),
    [REQUEST_AUTH_HEADERS.nonce]: fields.nonce,
    [REQUEST_AUTH_HEADERS.signature]: signHash(hashRequestAuth(fields), secretKey),
  };
}

function knownServerPk(): Promise<string> {
  serverPk ??= fetch(`${API}/info`).then(parseResponse).then((info) => info.serverPk);
  return serverPk;
}

async function parseResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`${response.url} answered ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
