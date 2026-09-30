# InsuredMine Assessment

Express + Mongoose (MongoDB) REST API built for the InsuredMine technical assessment. It covers four tasks:

1. **Bulk policy import**: upload an `.xlsx` or `.csv` file and load agents, users, accounts, categories, carriers and policies into MongoDB, parsed off the main thread.
2. **Policy search and aggregation**: find policies by user name, and group policies by user with an aggregation pipeline.
3. **CPU watchdog**: restart the server when CPU usage reaches 70% or more.
4. **Scheduled messages**: store a message with a future day and time, and mark it executed when that moment arrives.

## Requirements

- node 24.20.0 (`engines`: >=20, enforced by `engine-strict` in `.npmrc`)
- npm 11.19.0
- A running MongoDB instance

## Installation

```bash
npm i
cp env-sample .env    # then fill in the values
npm run dev           # nodemon src
npm start             # node src
npm test              # jest + supertest, no database needed
npm run lint          # eslint src test
```

### Environment variables (`.env`)

`env-sample` lists the keys only. Fill in the values in `.env`.

| Key | Purpose |
| --- | --- |
| `NODE_ENV` | Environment name (required; the server upper-cases it in its startup log) |
| `PORT` | HTTP port (defaults to 3000) |
| `MONGODB_URI` | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/insuredmine` |
| `JWT_SECRET` | Secret used to sign access and refresh tokens |
| `JWT_LIFE_TIME` | Access token lifetime, e.g. `1h` |
| `JWT_REFRESH_TOKEN_LIFE_TIME` | Refresh token lifetime, e.g. `7d` |

### Database connection

`src/models/index.js` connects with `mongoose.connect(process.env.MONGODB_URI)` at startup and the server exits if the connection fails. There are no migrations: Mongoose creates collections and indexes on first use. On boot, two users are seeded if missing:

| Email | Password | Roles |
| --- | --- | --- |
| `admin@example.com` | `Admin@123` | ADMIN |
| `user@example.com` | `User@123` | USER |

Collections: `users`, `agents`, `policy_holders`, `user_accounts`, `policy_categories`, `policy_carriers`, `policy_infos`, `scheduled_messages`. Ids are UUID strings, and documents are soft-deleted through a `deletedAt` field.

## Architecture

Request flow: `route/` -> `middlewares/auth` -> `controllers/` -> `db-functions/` -> `models/`.

- **Worker threads for file parsing.** `POST /policies/upload` stores the file in the OS temp directory with Multer and starts a `worker_threads` worker (`src/workers/data-upload-worker.js`), passing the path through `workerData`. The worker opens its own MongoDB connection, parses the file (`csv-parser` for CSV, `exceljs` for XLSX), extracts the unique agents, users, accounts, categories and carriers, and upserts them with `bulkWrite` in chunks of 1000 to resolve their ids. It then upserts the policies referencing those ids. It reports progress to the parent thread, always deletes the temp file, and the request resolves with the import stats. The main event loop is never blocked by parsing or inserts.
- **CPU monitor daemon.** `src/utils/cpu-monitor.js` samples CPU usage every 3 seconds and, at 70% or more, logs a warning, closes the HTTP server and MongoDB connection, and exits with code 1 so a process manager restarts the app. See [CPU monitoring and restart](#cpu-monitoring-and-restart).
- **Message scheduler.** `src/utils/message-scheduler.js` arms one `setTimeout` per pending message (no cron dependency). When the time arrives it atomically moves the message from `pending` to `executed` and logs it. Pending messages are re-armed on every boot, so they survive restarts, including CPU-triggered ones.

## API documentation

Routes are mounted at the root, with no `/api` prefix (for example `POST /policies/upload`). All responses share this shape:

```json
{ "success": true, "statusCode": 200, "message": "...", "data": {} }
```

Errors use the same shape with `success: false`, a 4xx or 5xx `statusCode`, and `data: []`.

### Authentication

Every endpoint below except register and login needs `Authorization: Bearer <accessToken>`. Log in first:

```bash
curl -X POST http://localhost:3000/user/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@example.com", "password": "Admin@123" }'
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged in successfully",
  "data": { "user": { "id": "...", "name": "Admin User", "email": "admin@example.com", "roles": ["ADMIN"] }, "accessToken": "<jwt>", "refreshToken": "<jwt>" }
}
```

Use the token in the examples: `export TOKEN=<accessToken>`. In Postman, set the request Authorization type to Bearer Token.

Access is role based. `auth()` only checks the token, and `auth(['ADMIN'])` also requires the user to have at least one of the listed roles in their `roles` array (`ADMIN` or `USER`, default `["USER"]`). A user without a required role gets `401` with `You do not have permission to perform this action`.

### Task routes at a glance

| Task | Method and path | Auth | Details |
| --- | --- | --- | --- |
| 1.1 Upload XLSX/CSV (worker thread) | `POST /policies/upload` | ADMIN | [section 1](#1-file-upload-post-policiesupload) |
| 1.2 Search policies by username | `GET /policies/search?username=` | any user | [section 2](#2-search-by-username-get-policiessearch) |
| 1.3 Policies aggregated by user | `GET /policies/aggregate-by-user` | any user | [section 3](#3-aggregate-by-user-get-policiesaggregate-by-user) |
| 2.1 CPU watchdog (restart at 70%) | none, runs as a background monitor | n/a | [CPU monitoring](#cpu-monitoring-and-restart) |
| 2.2 Schedule a message | `POST /messages/schedule` | any user | [section 4](#4-schedule-a-message-post-messagesschedule) |

A Postman collection with all of these requests is in `postman/insuredmine.postman_collection.json`. Run Login first; it saves the token into the `token` collection variable.

### User endpoints

| Method and path | Auth | Description |
| --- | --- | --- |
| `POST /user/register` | none | Body `name`, `email`, `password`. Returns `201` with the new user (`roles` defaults to `["USER"]`). `400` on missing or invalid fields, `409` if the email exists. |
| `POST /user/login` | none | Body `email`, `password`. Returns the user, `accessToken` and `refreshToken`. `401` on wrong credentials. |
| `GET /user/me` | any user | Returns the logged-in user. |
| `GET /user/list` | ADMIN | Returns all users. |

### 1. File upload: `POST /policies/upload`

ADMIN only. Multipart form data with a single `file` field (`.xlsx` or `.csv`, max 20 MB).

```bash
curl -X POST http://localhost:3000/policies/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@policies.csv"
```

Header names are matched case-insensitively and ignoring `_`, space and `-`. Recognised columns: `agent`, `userType`, `policy_number`, `company_name` (or `carrier`), `category_name` (or `lob`), `policy_start_date`, `policy_end_date`, `account_name`, `email`, `gender`, `firstname`, `phone`, `address`, `state`, `zip`, `dob`. A row must have `policy_number`, `company_name`, `category_name`, both dates, `email` and `firstname`; other rows are skipped and reported.

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Policies uploaded successfully",
  "data": {
    "totalRows": 3,
    "recordsImported": 2,
    "recordsSkipped": 1,
    "skippedRowErrors": [{ "row": 4, "error": "missing or invalid policyStartDate" }],
    "policiesCreated": 2,
    "policiesUpdated": 0,
    "agentsCreated": 1,
    "usersCreated": 1,
    "userAccountsCreated": 1,
    "categoriesCreated": 1,
    "carriersCreated": 1,
    "durationMs": 182
  }
}
```

Re-uploading the same file updates existing records instead of duplicating them. Errors: `400` (no file, wrong type, too large), `401` (missing or invalid token, or not ADMIN).

### 2. Search by username: `GET /policies/search`

Query: `username` (required, case-insensitive partial match on the user's `firstName`), `page` (default 1), `limit` (default 10, max 100).

```bash
curl "http://localhost:3000/policies/search?username=ann&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Policies fetched successfully",
  "data": {
    "policies": [
      {
        "id": "b1f0...",
        "policyNumber": "P1",
        "policyStartDate": "2024-01-01T00:00:00.000Z",
        "policyEndDate": "2025-01-01T00:00:00.000Z",
        "user": { "id": "9c2a...", "firstName": "Ann", "email": "a@x.com", "phoneNumber": "555", "state": "TX", "zipCode": "75001" },
        "category": { "id": "7d1e...", "categoryName": "Auto" },
        "carrier": { "id": "3e8b...", "companyName": "Acme" }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
}
```

Errors: `400` (`Username is required`, invalid pagination), `401`. ADMIN searches all users; other users only see the policy holder registered with their own email.

### 3. Aggregate by user: `GET /policies/aggregate-by-user`

Query: `page` (default 1), `limit` (default 10, max 100), paginated by user.

```bash
curl "http://localhost:3000/policies/aggregate-by-user?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Policies aggregated by user successfully",
  "data": {
    "users": [
      {
        "userId": "9c2a...",
        "user": { "name": "Ann", "email": "a@x.com", "phone": "555" },
        "totalPolicies": 2,
        "policies": [
          { "id": "b1f0...", "policyNumber": "P2", "policyStartDate": "2024-02-01T00:00:00.000Z", "policyEndDate": "2025-02-01T00:00:00.000Z", "categoryName": "Auto", "companyName": "Acme" },
          { "id": "c4d2...", "policyNumber": "P1", "policyStartDate": "2024-01-01T00:00:00.000Z", "policyEndDate": "2025-01-01T00:00:00.000Z", "categoryName": "Auto", "companyName": "Acme" }
        ]
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
}
```

Errors: `400` (invalid pagination), `401`. Same ADMIN / non-ADMIN scoping as search.

### 4. Schedule a message: `POST /messages/schedule`

Body: `message`, `day` (`YYYY-MM-DD`) and `time` (`HH:mm`). The date and time are read as **UTC** and must be in the future.

```bash
curl -X POST http://localhost:3000/messages/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "message": "Renewal reminder", "day": "2030-03-04", "time": "09:30" }'
```

Response `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Message scheduled successfully",
  "data": {
    "id": "5a7c...",
    "message": "Renewal reminder",
    "scheduledDate": "2030-03-04T09:30:00.000Z",
    "status": "pending",
    "createdAt": "2026-09-29T10:00:00.000Z",
    "updatedAt": "2026-09-29T10:00:00.000Z"
  }
}
```

At the scheduled time the server logs `Scheduled message <id> executed at <timestamp>: <message>` and the stored `status` becomes `executed` (`failed` if the update errors). Errors: `400` (missing field, invalid day/time, date in the past), `401`.

## CPU monitoring and restart

`src/utils/cpu-monitor.js` reads `os.cpus()` every 3 seconds and computes system-wide CPU usage from the change in idle versus total time since the previous sample. When usage reaches 70% or more it:

1. logs a warning with the recorded percentage and an ISO timestamp,
2. closes the HTTP server and the MongoDB connection,
3. calls `process.exit(1)` (forced after 10 seconds if cleanup hangs).

The process only restarts if a process manager is supervising it. Run it under PM2:

```bash
npm i -g pm2
pm2 start src/index.js --name insuredmine   # restarts automatically when the process exits
pm2 logs insuredmine                        # follow the CPU warnings
pm2 status                                  # the restart counter goes up after each CPU restart
pm2 stop insuredmine
pm2 save && pm2 startup                     # optional: start on boot
```

PM2 loads `.env` through the app's own `dotenv`. If the machine stays above 70%, PM2 keeps restarting the app; add `--max-restarts` or `--restart-delay 5000` to limit that. `nodemon` (`npm run dev`) does not restart after `process.exit(1)`; it waits for a file change.
