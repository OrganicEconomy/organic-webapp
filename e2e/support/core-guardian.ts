import { CitizenBlockchain, hashTimestampAuth, signHash } from 'organic-money/src/index.js';
import { SERVER_URL } from '../../playwright.config';

const API = `${SERVER_URL}/api/v1`;

interface Guardian {
  publickey: string;
  secretKey: string;
}

const GUARDIAN_SECRET_KEY = '1'.repeat(64);

let guardian: Promise<Guardian> | undefined;

export function ensureCoreGuardian(): Promise<Guardian> {
  guardian ??= findOrRegisterGuardian();
  return guardian;
}

export async function approveCandidateNamed(name: string): Promise<void> {
  const { publickey, secretKey } = await ensureCoreGuardian();
  const candidatePk = await findCandidatePk(name, publickey, secretKey);
  const candidate = await getJson(`/validations/${candidatePk}`, timestampAuth(publickey, secretKey));
  const initBlock = new CitizenBlockchain(candidate.blocks).validateAccount(secretKey);

  await send('POST', `/validations/${candidatePk}/approve`, {
    body: { publickey, block: initBlock.export() },
    headers: { 'x-signature': signHash(initBlock.hash(), secretKey) },
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

async function findCandidatePk(name: string, publickey: string, secretKey: string): Promise<string> {
  const candidates: { pk: string; name: string }[] = await getJson(
    '/validations',
    timestampAuth(publickey, secretKey),
  );
  const candidate = candidates.find((entry) => entry.name === name);
  if (!candidate) throw new Error(`No pending candidate named ${name}`);
  return candidate.pk;
}

function timestampAuth(publickey: string, secretKey: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    query: { publickey, timestamp },
    headers: { 'x-signature': signHash(hashTimestampAuth(publickey, timestamp), secretKey) },
  };
}

async function getJson(
  path: string,
  { query, headers }: { query: Record<string, string>; headers: Record<string, string> },
) {
  const url = `${API}${path}?${new URLSearchParams(query)}`;
  return parseResponse(await fetch(url, { headers }));
}

async function send(
  method: string,
  path: string,
  { body, headers = {} }: { body: unknown; headers?: Record<string, string> },
) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

async function parseResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`${response.url} answered ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
