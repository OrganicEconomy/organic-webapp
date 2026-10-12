# CLAUDE.md

Angular webapp of the Organic Economy. See `README.md` for the server API it talks to and the
local account model (`src/app/models/account.ts`).

## Commands

```bash
npm install
npm start                                        # dev server on http://localhost:4200
npm test                                         # Karma, watch mode
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

The default server URL lives in `src/environments/environment.development.ts`.

Before pushing, the full test suite and `npm run build` must pass.

## Code style

- Code, identifiers and comments are in English.
- No comments. Code should read on its own: when a passage seems to need one, split it into
  well-named methods that read like a sentence. Readability over brevity.
- Follow the Prettier config in `package.json` (single quotes, print width 100) and
  `.editorconfig` (2 spaces). Use semicolons. Match the surrounding files.
- Prefer explicit code over workarounds (e.g. no fake list entries to reuse a code path).

## Tests

- TDD: write the failing test first, then the implementation, then see it pass.
- One test at a time, not a batch of tests followed by a batch of code.
- One `describe` per function, and every `it` starts with `should`, so it reads as a sentence:
  "it should …".
- State expectations explicitly in the test (e.g. `httpMock.expectNone(...)`) instead of
  explaining them in a comment.

## Pull requests

- Small PRs, one step each, so they can be reviewed calmly.
