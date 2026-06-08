# EventsLK — Client Portal (EventXP)

A modern, responsive portal for discovering and booking events. Users browse events, sign
up (with email verification), book seats, and manage their tickets. Built with **HTML, CSS,
and vanilla JavaScript**, served by **Nginx**, deployed as a container on Kubernetes.

> Full backend contract (services, request flow, every endpoint, env contract) lives in
> [`../FRONTEND_INTEGRATION_SPEC.md`](../FRONTEND_INTEGRATION_SPEC.md).

## Features

- **Event discovery** — card grid with event image, location, **price tiers**, and **live
  seat availability** (sold-out aware).
- **Auth + email verification** — sign up (role `USER`), then verify via emailed link;
  login blocks unverified accounts and offers a **resend** action.
- **Multi-seat booking** — choose a seat quantity (capped at availability); booking and
  cancellation trigger confirmation emails (via the backend Kafka notification pipeline).
- **My Bookings** — ticket number, confirmed/cancelled status, and cancel.

## Architecture

All traffic goes to the **API Gateway** (the only externally reachable entry point); the
gateway routes to `event-registration-api`. The portal calls the gateway directly using the
public `/api/v1` prefix — no nginx API proxy.

```
Client Browser ──HTTPS──▶ API Gateway (NodePort 30080) ──▶ event-registration-api (ClusterIP)
   (env-config.js → window.ENV.API_BASE_URL)       /api/v1/{auth,events,book}
                                                          │ outbox → Kafka → NotificationService
                                                          ▼ verification / booking emails
```

| Frontend call | Gateway → service |
|---|---|
| `POST /api/v1/auth/signup`, `/login` | `/auth/...` |
| `GET /api/v1/auth/verify-email?token=`, `POST /api/v1/auth/resend-verification` | `/auth/...` |
| `GET /api/v1/events` | `/event` (public) |
| `POST /api/v1/book`, `GET /api/v1/book/user/{id}`, `DELETE /api/v1/book/{id}` | `/book...` |

> The shipped gateway only defines `auth` and `events` routes. Add the `book` (and `users`)
> routes from `../FRONTEND_INTEGRATION_SPEC.md` §2 or booking actions return 404.

## Pages

| File | Purpose |
|---|---|
| `index.html`  | Event discovery + booking modal (seats, prices, multi-seat) |
| `auth.html`   | Sign in / sign up, verification messaging + resend |
| `verify.html` | Email-verification landing page (reads `?token=`) |
| `profile.html`| My Bookings (ticket no., status, cancel) |

### Email verification link

The backend emails `{APP_BASE_URL}/auth/verify-email?token=...`. Set the backend
`APP_BASE_URL` to this portal's public URL (e.g. `http://localhost:30081`); nginx maps
`/auth/verify-email` → `verify.html`, which reads the token and calls the gateway.

## Runtime configuration (env)

| File | Role |
|---|---|
| `.env` | Source value: `API_BASE_URL=http://localhost:30080` |
| `env-config.template.js` | `window.ENV = { API_BASE_URL: "${API_BASE_URL}" }` |
| `env-config.js` | Committed default (used when serving statically) |
| `docker-entrypoint.sh` | Renders `env-config.js` from the template via `envsubst` on boot |

`js/api.js` reads `window.ENV.API_BASE_URL` and calls `${API_BASE_URL}/api/v1/...`.
In Kubernetes the value comes from the deployment's `API_BASE_URL` env var.

## Run locally

```bash
echo 'window.ENV = { API_BASE_URL: "http://localhost:30080" };' > env-config.js
python3 -m http.server 3001
# open http://localhost:3001/index.html
```

## Build & run with Docker

```bash
docker build -t kaveengayanga12/eventslk-client-portal:local .
docker run -p 8081:80 -e API_BASE_URL=http://localhost:30080 \
  kaveengayanga12/eventslk-client-portal:local
```

The image installs `gettext` and renders `env-config.js` from `API_BASE_URL` at startup,
so the same image can be repointed at any gateway without a rebuild.
