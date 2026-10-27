# Crimson Dusk v1.4.0 — Online Rooms Build

Crimson Dusk is now structured as a two-player browser co-op game. The host browser simulates the authoritative game world and Player 2 sends normalized inputs through a WebSocket room. The host broadcasts world snapshots back to Player 2 so both screens share the same room, player, enemy and boss state.

## Player flow
1. Open the public game link in a browser.
2. Choose **ONLINE CO-OP**.
3. Player 1 chooses **HOST GAME** and sends the displayed 5-character code to Player 2.
4. Player 2 opens the same public link, chooses **ONLINE CO-OP**, enters the code and presses **JOIN**.
5. When Player 2 is connected, Player 1 presses **START GAME**.

No login or installation is required for players once the app is deployed.

## Inputs
**Keyboard:** arrows move, Up jumps, Z dashes, C attacks, X shotgun, V switches stance, A uses a Blood Flask, S interacts.

**Controller:** left stick/D-pad move, A/Cross jump, B/Circle dash, X/Square attack, Y/Triangle shotgun, RB/R1 stance, RT/R2 ranged fire, LB/L1 guard, LT/L2 crouch, D-pad Up flask, D-pad Down interact.

**Phone/tablet:** labeled on-screen movement, Jump, Dash, Attack, Shotgun, Interact and Flask buttons appear automatically on touch devices.

## Multiplayer rules
- Two Bandits share one room/world.
- Multiplayer enemies and bosses use the existing +20% max-HP scaling.
- Normal mobs have overhead HP bars and bosses use named boss bars.
- Enemies can target either living Bandit.
- The host is authoritative for enemy/boss/world state.
- Player 2 uses the same Bandit IFP library with the burgundy palette shift.

## Local developer run
Requires Node.js 22+ only; there are no npm dependencies.

```bash
npm start
```

Open `http://localhost:3000`. To test online logic locally, open the address in two browser windows and use Host/Join.

## Public deployment
Deploy this directory as one Node web service. The server serves the game and WebSocket connection from the same origin and automatically reads the hosting provider's `PORT`.

A `render.yaml` and `Procfile` are included for straightforward deployment. On a typical Node host, use:

- Build command: none
- Start command: `node server.js`
- Health check: `/`

After deployment, the provider's HTTPS URL is the public game link both players use.


## v1.4.1 deployment UI hotfix
The main page now inlines critical CSS and game JavaScript so menu styling and button initialization survive hosts/deploy paths that fail to serve sibling CSS/JS files. Main menu/lobby also use existing Crimson Dusk castle art as their interface backdrop.
