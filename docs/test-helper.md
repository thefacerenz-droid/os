# Veloi Test Helper

The app library now includes **Veloi Test Helper**. TikTok/Veloi Shorts has been removed from the app catalog, and the old Shorts page and API have been removed.

## Use

Open `/test-helper/`, enable the screen-analysis consent checkbox, and select **Start Testing**. Choose a tab, window, or entire screen using the browser's picker. Selecting an entire screen follows the foreground tab/window on that screen. Selecting a specific tab continues sharing that tab when you switch elsewhere. The browser's permission prompt is mandatory.

While sharing, the app scans changed frames about every 12 seconds after the previous response. It shows the question number, answer, and an expandable explanation in the answer panel. Numbered answers update by question number. Unnumbered questions use their text as the identifier. Clear answers between tests that reuse question numbers. The answer window button opens a separate window you can arrange beside the shared tab.

**Stop**, revoking screen sharing, navigating away, or unchecking consent stops capture and aborts pending analysis. No snapshots are saved by this app. Screenshots are sent to OpenAI with `store: false`; provider data handling still applies. Answers stay in browser memory until cleared or the page closes. The API stores only short-lived rate-limit counters.

Live screen sharing requires HTTPS or localhost and a browser that supports `getDisplayMedia`. Mobile/iPad browsers may not support it. Screenshot upload is available as a fallback (JPEG/PNG, up to 10 MB before resizing). Background browser throttling or tab suspension can delay/pause scanning; a website cannot guarantee uninterrupted background execution. It cannot read unshared tabs or type into a different website. AI recognition and answers can be wrong or incomplete.

## Server setup

Set `OPENAI_API_KEY` on the server/Vercel and redeploy. The key remains server-side. `TEST_HELPER_MODEL` optionally selects the vision-capable model; otherwise it uses `OPENAI_MODEL`, then the existing project's `gpt-5-mini` default. Existing access-pass authentication protects the API. Existing Redis/Upstash configuration provides shared rate limiting on Vercel; local development falls back to `data/test-helper-limits.json`.

The client sends at most one request at a time, skips identical frames, and resizes captures to a maximum of 1600x1200. The server caps input at 3 MB, accepts only inline JPEG/PNG images, checks signatures and consent, restricts cross-origin requests, and limits each access pass to six analyses per minute. The model receives screenshot content as untrusted input and returns a structured result. API use incurs your provider's normal charges.

## Validation

- `node --test tests/test-helper.test.cjs` tests validation, server-side image analysis request construction, structured responses, provider errors, and absence of stored screenshots using a mocked provider.
- `scripts/verify-test-helper.cjs` requires Playwright on Node's module path and installed Microsoft Edge. It starts the actual app server, tests desktop/mobile layout, consent, a simulated screen stream, numbered output, stopping and ignoring cancelled requests, and removal of the previous app. AI responses are mocked; no personal screen is captured.
- Live recognition requires a configured API key and must be checked on the deployment. Local tests do not establish live model accuracy or actual cross-tab permissions.

API implementation follows the [OpenAI image-input guide](https://developers.openai.com/api/docs/guides/images-vision) and [structured-output guide](https://developers.openai.com/api/docs/guides/structured-outputs).
