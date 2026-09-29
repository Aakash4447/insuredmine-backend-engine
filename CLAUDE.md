# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Express + Mongoose (MongoDB) backend, plain CommonJS JavaScript. Currently it exposes `GET /version` and has a `user` model, JWT auth middleware, and boot-time seeding of dummy users. Target versions per README: node 24.20.0 (engines: >=20, enforced via engine-strict in .npmrc), npm 11.19.0.

## Commands

```bash
npm i
npm run dev          # nodemon src
npm start            # node src
npm test             # jest (supertest), tests in test/route/*.test.js
npm run lint         # eslint src test, flat config in eslint.config.js
npm run lint:fix     # eslint src test --fix (also rewrites CRLF files to LF)
```

Husky (`prepare` script, hooks in `.husky/`) runs `npm run lint` then `npm test` on `pre-commit` and `pre-push`; a lint error or failing test blocks the git operation. Don't bypass with `--no-verify`.

Tests: Jest + supertest (`npm test`), one file per route or feature in `test/route/*.test.js`. They run the real router via `test/helpers/build-app.js` (never `src/index.js`), mock `src/models` with the shared `test/helpers/mock-models.js` (`mockQuery` gives chainable, awaitable queries), mock the logger, and load env values from `test/helpers/setup-env.js`. Auth runs for real with a JWT signed by the test secret (`test/helpers/tokens.js`). No database is needed.

There are no migrations: Mongoose creates collections and indexes on first use. `MONGODB_URI` must point to a running MongoDB. The server calls `process.env.NODE_ENV.toUpperCase()` at startup, so `NODE_ENV` must be set.

## Environment

Copy `env-sample` to `.env` and fill in the values; `env-sample` lists keys only, no values. When adding a new env var, add only its key to `env-sample`. Variables: `NODE_ENV`, `PORT`, `MONGODB_URI` (read in `src/models/index.js`), `JWT_SECRET`, `JWT_LIFE_TIME`, `JWT_REFRESH_TOKEN_LIFE_TIME` (the JWT ones are read in `src/utils/generate-token.js`).

## Architecture

Request flow: `route/` → `middlewares/auth` (where required) → `controllers/` → `db-functions/` → `models/`.

- **Entry (`src/index.js`)**: sets up cors/helmet/JSON parsing, logs every request, mounts the router, then a 404 handler (`ROUTE_NOT_FOUND`) and `utils/error-handler`. It first calls `connectDb()` (exits on failure) and closes the connection on SIGINT/SIGTERM. After `listen`, it runs `boot/` which seeds dummy users (`boot/data/dummy-users.js`, passwords hashed with bcryptjs) if their email doesn't exist yet.
- **Routes (`src/route/`)**: `route/index.js` currently registers only `GET /version`. Add one router per entity (`<entity>.routes.js`) and mount it there.
- **Models (`src/models/`)**: each model file exports `mongoose => model` and must be registered by hand in `models/index.js`, which exports `{ mongoose, models, connectDb, disconnectDb }` (only `user` is registered today). Ids stay UUID strings (`_id: String`, default `crypto.randomUUID`) and `toJSON` outputs `id` (see `plugins/to-json.js`). Soft delete is the `plugins/soft-delete.js` plugin (`deletedAt`): find/count/update queries and aggregations skip deleted docs unless `{ withDeleted: true }` is passed. `user` has `name`, unique lowercase `email`, `password` (`select: false`) and `role` (`ADMIN` or `USER`, default `USER`). Collections are plural (`users`, set via `collection:`), while file and folder names are singular (`user.model.js`, `route/user.routes.js`, `controllers/user-controller/`, `db-functions/user/`).
- **db-functions/**: data-access helpers grouped per entity, each re-exported from an `index.js` (none exist yet). They use `models.<name>`, log the error, then rethrow. They never call `next`.
- **Auth**: `middlewares/auth.js` expects `Authorization: Bearer <jwt>`, verifies it with `utils/generate-token.decodeToken`, loads the user by `decoded.userId` and sets `req.user` (401 with `TOKEN_REQUIRED`, `TOKEN_INVALID` or `USER_NOT_FOUND` otherwise). Roles are `ADMIN` and `USER`: ADMIN can see all records, other users only their own (filter by `userId`).

### Conventions

- One handler per file, with `index.js` barrel files in each controller and db-function folder.
- Controllers throw `createHttpError(httpStatus.X, getMessage('KEY'))` and wrap everything in try/catch → `logger.error(\`ERROR FROM <fn> ==> ${error}\`)` → `next(error)`.
- Success responses use `generateResponse('MESSAGE_KEY', data, statusCode)`. All user-facing strings are keys in `utils/get-message.js`; add new messages there.
- Log with the winston logger in `utils/logger.js`, not `console`.
- Cast user-supplied values used in queries with `String()` so request objects can't inject Mongo operators; keep an explicit `deletedAt: null` in hand-built queries.
- Add packages with exact versions (`npm i --save-exact <pkg>`, no `^` or `~`).
- ESLint 9 (flat config `eslint.config.js`: eslint-config-airbnb-extended + @stylistic, import-x, n, security, promise plugins, kebab-case filenames via eslint-plugin-check-file) enforces: 2-space indent, single quotes, semicolons, unix line endings, `arrow-parens: as-needed`, max 150 lines per file, max 150 chars per line, and alphabetized `import/order` with blank lines between groups.
