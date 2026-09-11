# Access passes

The entry screen leads to a paywall. Passes are one-time USD payments: $1 for seven days or $5 for one calendar month, with no recurring charges. The private key grants owner access for one year per entry and can be entered again. Changing the key revokes existing owner cookies.

Set these server environment variables in Vercel for each deployment environment, then redeploy:

- STRIPE_SECRET_KEY: your Stripe test secret initially; switch to a live secret after testing.
- APP_BASE_URL: the exact site origin, such as https://your-project.vercel.app (no trailing path).
- PAYWALL_SESSION_SECRET: a random secret of at least 32 characters, kept stable between deployments.
- PAYWALL_FREE_KEY: your long, private owner access key.

For local development, use the same names in .env and set APP_BASE_URL to http://localhost:3000 (or the port you use). Never put secrets in client JavaScript.

Stripe Checkout selects eligible enabled payment methods. Enable desired methods in Stripe's payment settings. Cards, Apple Pay, and PayPal availability depends on the account, region, currency and buyer device; PayPal is not available for every Stripe account.

Verification retrieves the Checkout Session and its payment directly from Stripe. A signed HttpOnly cookie remembers the pending checkout, so users can return in the same browser and click "Already paid? Check access" even if they missed the payment redirect. Expiry is calculated from the payment timestamp, so repeated verification cannot extend a pass. No webhook is required for this browser-based claim flow.

Current scope: passes belong to this browser, not an account. Clearing cookies loses the recovery reference. Cross-device purchase restoration and automatic refund revocation are not implemented. API access is checked on the server; existing static game files remain publicly hosted and are not protected downloads. This is an entry/API paywall, not copy protection for public files.

Before accepting real payments, test a successful payment, cancellation, owner-key entry, and expiry on the deployed site using Stripe test mode. Real payment verification cannot be tested without a configured Stripe account.

Run automated checks with: node --test tests/billing.test.js
