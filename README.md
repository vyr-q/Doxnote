DocX - Local Dev Server and Auth0 Setup

This project is a single-file client app (`docx.html`) with a small Node.js server (`server.js`) to store user documents and support server-backed accounts. It supports local accounts and Auth0-issued JWTs.

Quick start (local server)

1. Install dependencies and start the server:

```bash
npm install
npm start
```

The server runs on port 3000 by default.

Auth0 integration

This project can use Auth0 as the authentication provider. The frontend `login.html` uses the Auth0 SPA SDK to authenticate users and stores the access token in `localStorage` as `docx_token`.

Steps to configure Auth0 (dev-t8ky1sq7itz4af5f.us.auth0.com):

1. In your Auth0 Dashboard, create an "Application" of type "Single Page Application".
2. Set the application's **Allowed Callback URLs** to the origin where you'll host the frontend plus `/login.html`. For example:
   - `http://localhost:5500/login.html`
3. Set **Allowed Web Origins** to your frontend origin (e.g. `http://localhost:5500`).
4. Copy the application's **Client ID** and set it in `login.html` as `AUTH0_CLIENT_ID`.
5. If you use an API in Auth0 and need audience-based access tokens, set the API's identifier as `AUTH0_AUDIENCE` (export as env var for server and set it in `login.html`).

Server environment variables

- `AUTH0_DOMAIN` - (optional) your Auth0 tenant domain, default: `dev-t8ky1sq7itz4af5f.us.auth0.com`
- `AUTH0_AUDIENCE` - (optional) expected audience for tokens
- `JWT_SECRET` - (optional) fallback secret for local tokens
- `PORT` - (optional) server port (default 3000)

Security notes

- The sample stores the Auth0 access token in `localStorage` for simplicity. For production, prefer HTTP-only secure cookies and backend-managed sessions.
- Ensure you configure HTTPS in production and use a strong `JWT_SECRET` if using legacy local tokens.

API Endpoints (server.js)

- `POST /api/signup` — create local (non-Auth0) account (username/password)
- `POST /api/login` — login with local account, returns JWT
- `GET /api/docs` — list saved docs for authenticated user
- `POST /api/docs` — save named doc `{name,payload}`
- `GET /api/docs/:name` — retrieve named doc
- `DELETE /api/docs/:name` — delete named doc
- `POST /api/workspace` — save current workspace
- `GET /api/workspace` — get saved workspace
- `GET /api/health` — health check

The server accepts Auth0-issued RS256 JWTs and validates them using the tenant's JWKS endpoint. It also falls back to local JWTs signed with `JWT_SECRET` for compatibility.

If you want, I can:
- Swap token storage to secure cookies and server sessions
- Add stricter `aud`/`iss` checking on the frontend
- Create deployment instructions for a chosen cloud provider

