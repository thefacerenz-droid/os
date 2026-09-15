# Mudline

A locally hosted, 2D off-road game made for Veloi. Open index.html through the existing server. No remote game provider or proxy is required.

Eleven original rigs include the user's ATV/SXS reference-inspired builds, Volt MX (Stark Varg-inspired), Flux Trail (Sur-Ron-inspired), and Tundra Snowmobile. The new electric bikes have separate battery/frame/fork/swingarm details and spoked wheels; the snowmobile has an animated rear track and front ski. They use original unbranded artwork, not licensed manufacturer models. The snowmobile uses the existing two-contact arcade terrain solver, not a continuous-track simulation.

Riders use subtle damped pose animation, not ragdolls. The seat, hands and feet remain fixed while acceleration, pitch and bumps move the upper body by at most 4.5 pixels horizontally and 2.5 vertically. Elbows and knees follow with smaller offsets. The pose settles when stopped, including after crashes, and remote riders regenerate it from vehicle snapshots without extra network messages.

Mud and water emission rates are substantially higher, with desktop/tablet particle counts capped at 1100 and narrow screens at 700. Remote spray has a shared 300-particle cap. Dirt reaches full coverage much faster and coats panels, rims, tires and rider clothing. Water slowly rinses it; the garage wash clears it. Electric bikes have a synthesized motor whine, and the snowmobile has a higher-rev engine tone.

Matter.js 0.20.0 handles rigid-body collisions and suspension constraints. Terrain-specific traction and drag, adjustable engine power, spring stiffness, damping, lift, tire size and tire type affect driving. Wheelie assist uses damped pitch control; manual mode permits overturning. This is an arcade simulation, not an engineering vehicle simulator.

Controls: touch gas, brake/reverse, wheelie, lean back and lean forward. Multi-touch is supported. Desktop equivalents are arrows or WASD, Space for wheelie, R for recovery. Recover returns to the last dry checkpoint. Pause, garage, maps and map creator are in the top toolbar.

Three built-in courses: Cypress Bog, Backwater Ponds and Sunbreak Dunes. The map creator supports height shaping and mud, water, sand and dry-trail painting, brush size, panning, undo, save and test ride. Up to 20 maps and the current vehicle tune are stored in this browser's localStorage. Clearing site data removes them; saves are not synchronized across devices.

Bundled third-party libraries are in vendor/ with their licenses. Local images and scripts work without external asset requests. The parent Veloi access gate remains unchanged.

Browser checks are in tests/mudline-ui.cjs, tests/mudline-balance.cjs and tests/mudline-home.cjs at the project root. They use Playwright and a local server on port 3020.

## Endless terrain and snorkels

Maps now includes Endless Backcountry. Stateless terrain generation streams a bounded window of at most 131 ground segments around the vehicle, including 150-255 pixel deep mud basins and periodic water crossings. The garage snorkel slider changes the visible intake height and its world-space submersion point. Sustained intake submersion stalls the engine. Recover clears flooding. Tall snorkels do not eliminate mud drag. Vehicle dirt, spray, wash and procedural engine/terrain audio remain enabled.

## Multiplayer foundation (September 14, 2026)

Open the top toolbar's Main menu, then Multiplayer. Create a private/public park for 2-8 players, or join by code. Codes are server-generated; copy one from the player panel. A public directory lists public rooms only. Available shared maps are the three built-in courses and Endless Backcountry. Shared maps have a longer garage apron with separate spawn bays. Local map-editor saves are not networked.

Implemented:

- Server-issued bearer session identities, capacity and vehicle-class restrictions, lobby expiry and host reassignment when the original host leaves.
- Join-in-progress with current builds, chassis, wheel and suspension states, room activity and recovery lines.
- Position/rotation/velocity, throttle/brake, headlights, 2WD/4WD, differential lock, dirt and stalled-state snapshots. Suspension renders from independently synchronized wheel positions.
- 300ms remote interpolation buffer, capped 250ms extrapolation, stale-vehicle fading, retry/backoff and no particle payloads. Driving continues locally during network delays.
- Optional capped soft-contact player forces outside the garage. These are not a fully authoritative multi-body collision solver. Collisions default off and garage spawns always ghost.
- Consent-based winch/tow-strap requests, a capped damped pull on each participating client's vehicle, visible lines, detach and distance/disconnect cleanup. Winches reel in; straps keep their initial length. These are approximate client-simulated recovery forces, not a server-simulated rope constraint.
- Optional host-started checkpoint activity templates: mud drag, hill climb, trail run, bounty hole and team trail. Players opt in at the garage during the countdown. Checkpoints are checked in order by the server; freestyle driving stays available.
- Small player list, local name/chat visibility settings, per-player local chat mute, nearby read-only build inspection and spectating. Stop spectating with Drive my vehicle in the player panel.

Change a build before joining a park. Live garage rebuilds are deliberately blocked to prevent unsynchronized vehicle changes.

### Server and deployment

The normal site API dispatcher and local Node server expose POST /api/games/mudline. The existing site access-pass gate still protects this endpoint. Multiplayer does not collect payment credentials or change that gate.

Storage uses the existing REDIS_URL or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN configuration, under the separate velos:mudline-rooms-v1 key. Vercel fails explicitly if shared storage is absent; it does not silently use instance-local rooms. Local development without Redis uses data/mudline-rooms.json and requires a single Node server. Never publish that data file. Deploy the updated lib/, api/, server files and game assets together, then test on the production origin with valid access passes.

This first transport uses at most 5 HTTP snapshot requests per second per active client, with no overlapping client requests. Redis compare-and-set protects concurrent writes. All rooms currently share one game snapshot document: this is an initial small-session implementation, not a high-concurrency production architecture. An eight-player session can issue up to 40 requests and at least 80 Redis commands per second, plus CAS retries. Monitor provider quotas/costs; do not assume it fits a free tier. A per-room realtime service and server physics worker are the next scaling step.

### Not complete yet

This is not the entire requested multiplayer specification. NPC/truck recovery events, fuel management, a functional wash station/ramp/flex obstacle at the meet area, live in-lobby rebuilds, account-owned upgrades/portal ratios, dynamic weather, cross-device profiles and money rewards are not implemented. The meet area currently provides parking bays and lights.

Server validation rejects malformed states, extreme speeds, large teleports, invalid suspension positions, unauthorized actions and excess update rates. It does NOT prove that every reported movement followed vehicle physics. Therefore no spendable multiplayer currency or purchased progression is awarded. Do not enable money rewards until server-side simulation, profile authentication, entitlement checks and replay-resistant reward accounting exist.

### Verification

- node --test tests/mudline-api.test.cjs tests/messenger.test.cjs
- tests/mudline-multiplayer.cjs uses Playwright and the real game/API with an isolated in-memory transactional test store. It starts its own temporary HTTP server and launches eight separate browser contexts, not NPCs. It checks actual cross-instance builds, wheels, movement, chat, consent-based line attachment, late joins, capacity, host departure, repeated rejoining and delayed/dropped HTTP updates.
- tests/mudline-ui.cjs and tests/mudline-effects.cjs cover solo driving, touch layout, garage, maps, editing, sound and dirt against localhost:3020.
- tests/mudline-riders.cjs covers all three new builds, constrained rider motion, heavy dirt/spray, garage availability and tablet layout.
- The tests do not establish production Redis latency, real WAN/iPad performance, realistic multi-vehicle collision outcomes, or reliable stuck-vehicle recovery under poor network conditions. Those need broader playtesting before calling this production-ready.
