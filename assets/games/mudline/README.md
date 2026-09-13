# Mudline

A locally hosted, 2D off-road game made for Veloi. Open index.html through the existing server. No remote game provider or proxy is required.

Eight original cartoon rigs are inspired by the user's ATV and side-by-side reference photographs. Artwork is drawn with Canvas, with separately animated wheels and suspension. These are stylized interpretations, not photo conversions or licensed manufacturer models.

Matter.js 0.20.0 handles rigid-body collisions and suspension constraints. Terrain-specific traction and drag, adjustable engine power, spring stiffness, damping, lift, tire size and tire type affect driving. Wheelie assist uses damped pitch control; manual mode permits overturning. This is an arcade simulation, not an engineering vehicle simulator.

Controls: touch gas, brake/reverse, wheelie, lean back and lean forward. Multi-touch is supported. Desktop equivalents are arrows or WASD, Space for wheelie, R for recovery. Recover returns to the last dry checkpoint. Pause, garage, maps and map creator are in the top toolbar.

Three built-in courses: Cypress Bog, Backwater Ponds and Sunbreak Dunes. The map creator supports height shaping and mud, water, sand and dry-trail painting, brush size, panning, undo, save and test ride. Up to 20 maps and the current vehicle tune are stored in this browser's localStorage. Clearing site data removes them; saves are not synchronized across devices.

Bundled third-party libraries are in vendor/ with their licenses. Local images and scripts work without external asset requests. The parent Veloi access gate remains unchanged.

Browser checks are in tests/mudline-ui.cjs, tests/mudline-balance.cjs and tests/mudline-home.cjs at the project root. They use Playwright and a local server on port 3020.
