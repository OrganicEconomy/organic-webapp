# OrganicWebapp

First thing first:

```bash
npm install
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Database access

### Distant server

The distant server is there essentialy to save things, in case local data would be lost.
The second usage is to sign some transactions (papers), while server is the only one authorized to do so.

* `/register` to create a new citizen : create a brand new unique blockchain;
* `/users/save` to save the last block;
* `/users/sign` to save and sign the last block;
* `/users/login` to get the blockchain and secret key of given mail/password combination;
* `/tx/send` to send the transaction to it's target;
* `/tx/list` to get the list of transactions I should receive;
* `/papers/cash` to cash a list of papers.

### Local database

For most usages, we use a local database with Localforage.
It saves those informations:

```json
{
  pk: {                  // the user public key 
    publickey: "...",
    name: "user name",    // only for display
    bc: { ... },         // the user's blockchain
    isuptodate: false,   // Boolean saving if blockchain is up to date with the server
    password: "...",     // password hash
    secretkey: "...",    // aes crypted secretkey
    contacts: [
        {
            pk,          // Contact public key
            name         // Contact name (for display)
        },
        ...
    ]
  }
}
```

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

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.