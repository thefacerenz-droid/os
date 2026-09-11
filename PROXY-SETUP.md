# User-provided proxy browsing

Open Web Browser, then Proxy settings. Enter the HTTP or HTTPS proxy hostname, port and optional username/password. Test & connect checks an HTTPS request to example.com before saving. The proxy must be reachable from the Vercel server, not just from the user's computer.

The existing address bar, tabs, back, forward, refresh and home controls use the configured proxy in Proxy mode. Direct mode is an explicit separate choice. A failed proxy request never falls back to direct access.

Supported: read-only GET requests to HTTP/HTTPS sites on ports 80 and 443, HTML documents, plain text and JSON. HTTP destinations use forward-proxy requests; HTTPS destinations use CONNECT with certificate validation. Proxy-server connections may themselves use HTTP or HTTPS. Basic proxy authentication is supported.

The document reader removes scripts, forms, images, stylesheets and other active/remote assets so displayed pages cannot silently make direct requests. Page links navigate through the same proxy session. This is not a full browser engine: web apps, website login sessions, streaming, downloads and WebSockets are unsupported. Sites declaring embedding restrictions are not displayed. No filter-removal or restriction-bypass features are included.

## Vercel configuration

Existing paid-access checks still apply to /api/proxy. Configure:

- UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for shared server-side session storage.
- PROXY_CREDENTIAL_SECRET: a random secret of at least 32 characters. If absent, PAYWALL_SESSION_SECRET is used.
- APP_BASE_URL: exact public origin, such as https://veloi.vercel.app.

Credentials are AES-256-GCM encrypted in Redis, expire after one hour, and are removed on Disconnect. Only a random session ID is stored in the HttpOnly cookie. Password inputs are cleared after submission; credentials are not saved in browser storage or printed in logs. Local development can use memory storage, which is lost on restart.

Veloi and the selected proxy provider participate in requests; this feature does not promise anonymity. HTTP proxy connections are unencrypted on the server-to-proxy hop. Target and proxy DNS is resolved by the server and restricted to public addresses. Validated addresses are pinned to prevent DNS rebinding. Redirects are revalidated, capped at three, and requests have a 12-second timeout and 2 MB response limit.

Run checks: node --test tests/proxy.test.js tests/billing.test.js

Deploy the updated files and package-lock.json to Vercel. A real end-to-end deployment test requires a reachable proxy supplied by the user; no live proxy credentials are bundled.
