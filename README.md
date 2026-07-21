# OrganicWebapp

First thing first:

```bash
npm install
```

## Development server

To start a local development server, run:

```bash
npm run start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

By default the app talks to the server URL set in `src/environments/environment.development.ts` (`serverUrl`, root URL with no `/api` suffix — e.g. an [organic-webserver](https://github.com/OrganicEconomy/organic-webserver) running locally on `http://127.0.0.1:6868`). This is a temporary default until the server-selection screen (Phase 1 step 5) lets the user pick their own server.

## Database access

### Distant server

The distant server ([organic-webserver](https://github.com/OrganicEconomy/organic-webserver), routes under `/api/v1` — see its `API.md`) is there essentially to save things, in case local data would be lost, cross-verify transactions before routing them, and sign what only it is authorized to sign (bill cash-ins, genesis validation).

* `POST /users/register` — create a new citizen: a brand new unique blockchain;
* `PUT /users/save` — save the last block (block-auth, `x-signature`);
* `PUT /users/sign` — save and sign the last block (block-auth);
* `POST /users/login` — get the blockchain and encrypted secret key for a mail/password combination (rotates the devicetoken);
* `POST /users/password` — change the login password (timestamp-auth);
* `POST /tx/send` — send a transaction to its target (cross-verified against the sender's saved chain);
* `GET /tx/list` — list of transactions pending for me (timestamp-auth);
* `POST /papers/cash` — cash a paper bill (full transaction, not just its hash).

### Local database

For most usages, we use a local database with Localforage — one record per account, keyed by public key (`src/app/models/account.ts`, `Account` interface):

```ts
{
  publickey: string        // the user's public key, also the record's key
  name: string              // display only
  serverUrl: string         // this account's server, root URL (no /api suffix)
  blocks: BlockWire[]       // the user's blockchain, organic-protocol wire format
  secretkey: string         // AES-encrypted, serialized — never the plaintext key or password
  contacts: { name: string, pk: string, url: string, type: 'citizen' | 'ecosystem' }[]
  backupPolicy: 'every-tx' | 'manual' | 'payments-only'
  lastBackupAt: string | null
  isuptodate: boolean
  pendingOfflineTx: TxWire[]  // received offline (QR), awaiting tx/verify
  sentOfflineTx: TxWire[]     // sent offline (QR), kept to re-display if needed
  status: 'active'
  devicetoken: string         // rotates on every login; a stale one means read-only
}
```

There is no plaintext password field: unlocking an account tries to decrypt `secretkey` with the entered password (`src/app/services/secret-key-crypto.util.ts`) — a wrong password simply fails to decrypt, it is never compared directly.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

Karma needs a Chrome/Chromium binary. If it fails with `Cannot start ChromeHeadless` / `Can not find the binary`, point it at whatever Chromium is available on your machine (e.g. Playwright's, if you have it installed) via the `CHROME_BIN` environment variable:

```bash
CHROME_BIN="/path/to/chrome" ng test --watch=false --browsers=ChromeHeadless
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.