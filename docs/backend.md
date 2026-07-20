# Backend development

Stitch Talk uses Clerk for identity, PostgreSQL + Drizzle for application data,
tRPC for typed CRUD, an authenticated SSE route for model streaming, and private
S3-compatible storage for chat images.

## Local services

The application databases are intentionally separate from PostgreSQL's default
`postgres` database:

- `stitch_talk_dev` — local application data
- `stitch_talk_test` — integration tests

MinIO runs from `compose.backend.yaml` and provides the private
`stitch-talk-dev` bucket. Start it with:

```bash
docker compose -f compose.backend.yaml up -d
portless alias stitch-talk-storage 9000
```

The app itself should be run through Portless:

```bash
portless
```

- App: <https://stitch-talk.localhost>
- Storage API: <https://stitch-talk-storage.localhost>
- MinIO console: <http://localhost:9001>

## Environment variables

Keep these in `.env.local`; never commit their values:

```dotenv
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/stitch_talk_dev
S3_ENDPOINT=http://127.0.0.1:9000
S3_PUBLIC_ENDPOINT=https://stitch-talk-storage.localhost
S3_REGION=us-east-1
S3_BUCKET=stitch-talk-dev
S3_ACCESS_KEY=<local-or-production-key>
S3_SECRET_KEY=<local-or-production-secret>
S3_FORCE_PATH_STYLE=true
CLERK_WEBHOOK_SIGNING_SECRET=<whsec_...>
```

`S3_PUBLIC_ENDPOINT` is the host embedded in browser-facing presigned URLs.
Production can use Cloudflare R2 or AWS S3 without changing application code;
set the endpoint, region, credentials, bucket, and path-style flag accordingly.

## Database workflow

```bash
npm run db:generate   # generate reviewed SQL after schema changes
npm run db:migrate    # apply committed migrations
npm run db:studio     # inspect local data
```

Do not use `drizzle-kit push` as the shared or production migration workflow.
The optional seed command requires a real development Clerk user:

```bash
SEED_CLERK_USER_ID=user_... npm run db:seed
```

## API boundaries

- `/api/trpc/[trpc]` — typed project, thread, attachment, message-cancel,
  and brief procedures.
- `/api/chat` — authenticated SSE generation. The browser sends only a thread
  ID, idempotency request ID, new text, and attachment IDs. The server rebuilds
  model history from owned database rows.
- `/api/webhooks/clerk` — verified Clerk user synchronization. Webhook delivery
  is eventually consistent; protected procedures lazily ensure the user row.

Every data lookup is scoped to the authenticated Clerk user. Unknown and
foreign IDs are both exposed as not found to prevent resource enumeration.

## Verification

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Integration tests use `stitch_talk_test` and local MinIO. They cover ownership,
idempotent persisted turns, typed API authentication, brief parsing, SSE
framing, and private image upload verification.
