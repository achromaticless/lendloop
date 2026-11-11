# LendLoop

**Borrow what you need. Lend what you don't.**

LendLoop is a neighborhood tool-lending board. Neighbors list tools they are willing to lend, request to borrow from each other, and get automated email notifications and overdue reminders handled by n8n.

Stack: Next.js (App Router) · Clerk · Convex · n8n Cloud · TypeScript.

## Features

- **Public page:** read-only list of tools that are available right now (name and category only, no owner data) and a sign-in button.
- **Sign-in:** email + one-time code through Clerk. The account is created on first verification. No passwords, no social logins.
- **Signed-in users:** list, edit and remove their own tools; browse all tools with availability, filtered by category; request a tool for a date range; approve or decline incoming requests; mark a loan as returned. Views: *My listings*, *My requests*, *Incoming requests*.
- **Admins:** remove any listing, see all loans, mark a lender as *Trusted Lender*, and see the automation log with a *Retry* button for failed deliveries.
- **Automation (n8n):** an email when a request is created or changes status, a daily overdue reminder, and an alert email when any workflow fails.
- **Automation activity on each loan:** both people in a loan see what was emailed and when, for example "Overdue reminder emailed to you · 2 days ago", with failures shown as such. Text only, never an address.

## Architecture

```
 Browser ──Clerk session──▶ Next.js ──Convex client (Clerk JWT)──▶ Convex
                                                                     │  ▲
   request created / approved / declined / cancelled / returned      │  │
   ──▶ mutation writes an `outbox` row in the same transaction       │  │
                                                                     ▼  │
                    (1) POST webhook  {eventId, type, recipient}   n8n Cloud
                        Authorization: Bearer <JWT, secret A>        │
                    (2) GET  /n8n/notification?eventId=…  ◀──────────┤
                        Authorization: Bearer <JWT, secret B>        │
                    (3) POST /n8n/notification-result  ◀─────────────┘
                        (email sent | failed)

   n8n daily 09:00 ──GET /n8n/overdue ─▶ POST /n8n/reminders/claim
                    ─▶ send email ─▶ POST /n8n/reminders/result
```

| Part | Where | What it does |
|---|---|---|
| UI | `src/app` | Public landing, sign-in, onboarding, browse, dashboard, admin console |
| Data and rules | `convex/` | Schema, role checks, request workflow, all validation |
| Events to n8n | `convex/automation.ts` | Transactional outbox, signed delivery, retries with backoff |
| n8n HTTP API | `convex/http.ts` | Four signed routes that n8n calls |
| Token signing | `convex/lib/signing.ts` | HS256 sign and verify (Web Crypto, no dependency) |
| Workflows | `n8n/*.json` | Request notifications, overdue reminders, error alert |

### Data model

`users` (Clerk identity, email, role, trusted flag) · `tools` (soft-deleted) · `requests` (`pending → approved → returned`, or `declined` / `cancelled`) · `outbox` (one row per notification, with delivery and email status) · `reminders` (one row per overdue loan per UTC day).

### Roles

Roles are enforced in Convex functions, not only in the UI. The role is derived on the server from the verified Clerk email and the `ADMIN_EMAILS` env var of the Convex deployment. The client can never choose it.

| Action | user | admin |
|---|---|---|
| Create, edit, remove a tool | own tools only | any tool (remove) |
| Request a tool | other people's tools | same |
| Approve / decline / mark returned | requests on own tools | not extra |
| Cancel a request | own pending requests | not extra |
| See all loans, mark Trusted Lender, see and retry automation events | no | yes |

Business rules, also enforced server-side: no borrowing your own tool, dates must be valid and not in the past, loans last up to 30 days, no overlapping approved loans, no approving an expired request, a tool on loan cannot be removed by its owner, and small per-user caps (50 tools, 20 pending requests).

## Local setup

Requirements: Node 20+, a [Clerk](https://clerk.com) account, a [Convex](https://convex.dev) account, an [n8n Cloud](https://n8n.io) account and an SMTP account that can send email.

n8n runs on **n8n Cloud**, so there is no `docker-compose.yml`. Next.js and Convex run locally; only n8n is hosted.

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Clerk

1. Create an application. In **User & Authentication**, enable *Email* with *Email verification code* and turn off passwords and social providers.
2. In **JWT templates**, create a template named `convex` (the Convex preset). Its issuer URL is your *Clerk Frontend API URL*.
3. Put the publishable and secret keys in `.env.local` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).

### 3. Convex

```bash
npx convex dev        # logs in, creates the dev deployment, fills CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL
```

In another terminal, set the deployment variables (they are *not* read from `.env.local`):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://<your-clerk-frontend-api>"
npx convex env set ADMIN_EMAILS "you@example.com"
npx convex env set N8N_API_SECRET "$(openssl rand -hex 32)"
npx convex env set N8N_WEBHOOK_SECRET "$(openssl rand -hex 32)"
# N8N_WEBHOOK_URL is set after step 4
```

### 4. n8n Cloud

1. **Credentials.** Create three, with exactly these names (the workflow files reference them):
   - `LendLoop webhook (Convex to n8n)`: type *JWT Auth*, key type *Passphrase*, algorithm *HS256*, secret = `N8N_WEBHOOK_SECRET`.
   - `LendLoop API (n8n to Convex)`: type *JWT Auth*, same settings, secret = `N8N_API_SECRET`.
   - `LendLoop SMTP`: type *SMTP*, your provider's host, port, user and password.
2. **Import** the three files in `n8n/`.
3. **Check the credential of every node.** n8n links credentials by type when importing and can pick the wrong JWT credential. Required links:
   - *Request notifications*: `Convex webhook` and `Read signed hash` use the **webhook** credential; `Sign details request` and `Sign result` use the **API** credential.
   - *Overdue reminders*: `Sign overdue request`, `Sign claim` and `Sign result` use the **API** credential.
4. **Edit values** that depend on you: the sender address in the three email nodes (use an address your SMTP provider allows), the recipient in *Error alert*, and the Convex site URL (`https://<deployment>.convex.site`) in the HTTP Request nodes.
5. **Publish** *Error alert* first. In the settings of the other two, set *Error workflow* to *LendLoop - Error alert*, then publish them.
6. Copy the production URL of the `Convex webhook` node and give it to Convex:

```bash
npx convex env set N8N_WEBHOOK_URL "https://<your-instance>.app.n8n.cloud/webhook/lendloop-events"
```

### 5. Run

```bash
npm run dev           # http://localhost:3000
npm test              # 42 tests: access control and the automation API
npm run typecheck && npm run lint
```

Sign in with an email listed in `ADMIN_EMAILS` to get the admin console. To test notifications, create a request from one account on another account's tool and check the owner's inbox.

## Environment variables

| Variable | Where | Secret | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` | no | Clerk, browser |
| `CLERK_SECRET_KEY` | `.env.local` | **yes** | Clerk, server |
| `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | no | written by `npx convex dev` |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex env | no | which Clerk instance Convex trusts |
| `ADMIN_EMAILS` | Convex env | no | comma-separated emails that get the admin role |
| `N8N_WEBHOOK_URL` | Convex env | no | production webhook URL of the notification workflow |
| `N8N_WEBHOOK_SECRET` | Convex env + n8n credential | **yes** | signs Convex → n8n requests |
| `N8N_API_SECRET` | Convex env + n8n credential | **yes** | signs n8n → Convex requests |

`.env.local` is git-ignored. The exported workflow JSON contains no secrets: it only names the credentials, and the secrets live in n8n.

## Integration design

**Convex → n8n (notifications).** Every request mutation writes an `outbox` row in the same transaction, so a notification exists if and only if the change committed. A Convex action then POSTs to the webhook. If it fails, it retries with exponential backoff (30 s, 1 m, 2 m, 4 m) up to 5 attempts and ends in a visible `failed` state. Admins see failures in the console and can retry them. The webhook body carries only `eventId`, `type` and `recipient`; n8n then fetches the details it needs from a signed endpoint.

**n8n → Convex (reminders).** The daily workflow asks `/n8n/overdue` for approved loans past their end date. For each one it *claims* the day's reminder before sending anything. Only one claim can win per loan per UTC day, so a retried or duplicated run cannot send a second email. An abandoned claim can be retaken after 30 minutes and a failed one can be retried. Then n8n sends the email and writes the result back (`sent` or `failed`).

**Idempotency.** Outbox rows have a unique key per event (`approved:<requestId>`). Reminders have one row per loan per day. Write-backs (`recordEmailResult`, `recordReminderResult`) can be repeated without changes, and a confirmed `sent` is never overwritten by a late `failed`. If Convex retries a webhook that n8n already handled, `alreadySent` makes the workflow skip the email.

**Failure handling.** Every HTTP and email node retries 3 times. A failed email is reported back to Convex as `failed` and then the workflow stops with an error, which triggers the *Error alert* workflow (an email with the workflow, node, error and execution link). A failure is therefore visible in three places: the n8n execution list, the alert email and the admin console.

## Security and data minimization

- **Authentication:** Clerk email code. Convex validates the Clerk JWT on every call. Identity is the Clerk `tokenIdentifier`; the email is only used for the admin match.
- **Authorization in the backend:** every query and mutation calls `requireUser` or `requireAdmin` and checks ownership itself. The Next.js proxy only exposes the session; it is not the gate.
- **Signed integration in both directions.** Tokens are HS256 JWTs that live at most 10 minutes (5 in practice), with the algorithm pinned on verification. Each token is bound to one request: a SHA-256 of the exact body bytes, and for n8n → Convex also the HTTP method and path with query. A captured token cannot be replayed against another endpoint or with another body. The signature is compared in constant time and checked before the body is parsed. Failures return the same `401` body so responses reveal nothing. The webhook workflow recomputes the body hash and rejects mismatches.
- **Two secrets, one per direction,** so a leak of one does not let an attacker act in the other direction.
- **Secrets** only in Convex env vars, `.env.local` (ignored) and n8n credentials. Never logged: delivery errors store a message, not the URL or the token.
- **Public data:** the landing page query returns only tool name and category, for available tools. No ids, no owner information.
- **Names:** other users only ever see a display name chosen in onboarding, never anything derived from the email (fallback: "Neighbor").
- **Emails leave the database in exactly two places:** `notificationDetails` (for one existing event) and the winning reminder claim (the borrower). Neither includes the pick-up note. The overdue list contains no email addresses.
- **Pick-up notes** are visible only to the two people in the loan, and only while it is approved.
- **Input:** every argument is validated by Convex validators plus length, date and range checks. Text is rendered by React (escaped).
- **Headers:** `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- **Dependencies:** exact versions, no carets.

## What I would change for production

- **Separate environments.** A Convex prod deployment (`npx convex deploy`) with its own env vars, a Clerk production instance, and a separate n8n project or instance for prod. The Convex site URL in the workflows should come from an n8n variable, not be written into nodes.
- **Secret rotation.** Rotate both secrets on a schedule. Accept two valid secrets during rotation so nothing fails mid-change.
- **Replay protection.** Tokens are bound and short-lived, but the same token can be replayed inside its window. Store each `jti` for its lifetime and reject reuse.
- **Strict CSP** tuned for Clerk's script and frame domains, plus rate limiting on the public query.
- **Email.** Use a transactional provider with a verified domain (SPF, DKIM), and add bounce handling. Today a "sent" status means the SMTP server accepted the message.
- **Monitoring.** Alert on `failed` outbox rows and on a growing queue, not only on n8n workflow errors. Keep n8n execution history long enough to investigate.
- **Time zones.** "Today" and "overdue" use UTC, while the 09:00 schedule follows the n8n instance time zone. Store a neighborhood time zone and compute due dates in it.
- **Scale.** The overdue endpoint reads up to 200 loans per run; page it with a cursor. Give admin lists pagination.
- **Data lifecycle.** Delete old outbox and reminder rows after a retention period; add account deletion and data export.
- **Delivery guarantee.** Convex retries are at-least-once and the workflow is idempotent. If volume grows, put a queue between Convex and n8n.
- **CI.** Run `typecheck`, `lint` and `test` on every pull request, and add an end-to-end test for the two workflows.

## Project layout

```
convex/        schema, rules, outbox, HTTP API, signing, tests
src/app/       routes: / (public), /sign-in, /welcome, /browse, /dashboard, /admin
src/components UI and dialogs
n8n/           exported workflows
```
