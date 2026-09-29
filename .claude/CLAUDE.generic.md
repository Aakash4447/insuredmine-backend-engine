# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

<One or two sentences: what this service does.> Express + Mongoose (MongoDB) backend, plain CommonJS JavaScript. Target versions: node <x.y.z> (engines: <range>, enforced via engine-strict in .npmrc), npm <x.y.z>.

## Commands

```bash
npm i
npm run dev          # nodemon src
npm start            # node src
npm test             # jest
npm run lint         # eslint src test
npm run lint:fix     # eslint src test --fix
```

There are no migrations: Mongoose creates collections and indexes on first use. `MONGODB_URI` must point to a running MongoDB. `NODE_ENV` must be set.

## Environment

Copy `env-sample` to `.env` and fill in the values; `env-sample` lists keys only, no values. When adding a new env var, add only its key to `env-sample`. Variables: `NODE_ENV`, `PORT`, `MONGODB_URI` (read in `src/models/index.js`), `JWT_SECRET`, `JWT_LIFE_TIME`, `JWT_REFRESH_TOKEN_LIFE_TIME`, <add project-specific ones>.

## Architecture

Request flow: `route/` → `middlewares/auth` (where required) → `controllers/` → `db-functions/` → `models/`.

- **Entry (`src/index.js`)**: sets up cors/helmet/JSON parsing, logs every request, mounts the router, then a 404 handler and `utils/error-handler`. It calls `connectDb()` first (exits on failure) and closes the connection on SIGINT/SIGTERM.
- **Routes (`src/route/`)**: one router per entity (`<entity>.routes.js`), mounted in `route/index.js`. <Note any catch-all route: it is registered last, and new top-level routes go above it.>
- **Models (`src/models/`)**: each model file exports `mongoose => model` and must be registered by hand in `models/index.js`, which exports `{ mongoose, models, connectDb, disconnectDb }`. Ids are UUID strings (`_id: String`, default `crypto.randomUUID`) and `toJSON` outputs `id` (see `plugins/to-json.js`). Soft delete is the `plugins/soft-delete.js` plugin (`deletedAt`): find/count/update queries and aggregations skip deleted docs unless `{ withDeleted: true }` is passed. Collections are plural (set via `collection:`), while file and folder names are singular (`user.model.js`, `route/user.routes.js`, `controllers/user-controller/`, `db-functions/user/`).
- **db-functions/**: data-access helpers grouped per entity, each re-exported from an `index.js`. They use `models.<name>`, log the error, then rethrow. They never call `next`.
- **Auth**: `middlewares/auth.js` expects `Authorization: Bearer <jwt>`, verifies it with `utils/generate-token.decodeToken`, and loads the user into `req.user`. <Describe roles and how controllers scope data, e.g. ADMIN sees everything, other users only their own records.>

### Conventions

- One handler per file, with `index.js` barrel files in each controller and db-function folder.
- Controllers throw `createHttpError(status.X, getMessage('KEY'))` and wrap everything in try/catch → `logger.error(\`ERROR FROM <fn> ==> ${error}\`)` → `next(error)`.
- Success responses use `generateResponse('MESSAGE_KEY', data, statusCode)`. All user-facing strings are keys in `utils/get-message.js`; add new messages there.
- Log with the winston logger in `utils/logger.js`, not `console`.
- Cast user-supplied values used in queries with `String()` so request objects can't inject Mongo operators.
- Add packages with exact versions (`npm i --save-exact <pkg>`, no `^` or `~`).
- ESLint 9 (flat config `eslint.config.js`) enforces: 2-space indent, single quotes, semicolons, unix line endings, `arrow-parens: as-needed`, max 150 lines per file, max 150 chars per line, kebab-case filenames, and alphabetized `import/order` with blank lines between groups.

## Tests

Jest + supertest, one file per route or feature in `test/route/*.test.js`. Tests exercise the real router through `test/helpers/build-app.js` (never import `src/index.js`), mock `src/models` with the shared `test/helpers/mock-models.js`, and load env values from `test/helpers/setup-env.js`. Auth runs for real with a JWT signed by the test secret. Cover success, 400, 404, permission, and 500 paths for every endpoint.
