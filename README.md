# IPL Mega Auction — Multiplayer MVP

A runnable, mobile-friendly IPL-style auction room with private invite codes, 10 teams, live bidding, team purses and organiser-only moderation.

## Run locally

1. Install Node.js 18 or newer.
2. Extract this project.
3. In the project folder, run:

   ```bash
   npm install
   npm start
   ```

4. Open `http://localhost:3000`.

To test multiplayer, open the same lobby link in two different browser windows/devices. For devices on the same Wi-Fi, use the computer's LAN IP and port 3000.

## Create and join

- Create an auction with your name, a room password and a purse amount (entered in ₹ lakh).
- The organiser receives a six-character lobby code and can share the room URL.
- Other users join with that code, choose an available team, or join as viewers.
- Each team has one owner at a time.
- Team owners bid in ₹10 lakh increments. The server checks room state, role and remaining purse.

## Organiser permissions

The organiser password is checked on the server for every organiser action. Organiser actions include:
- Start, pause, resume and end auction
- Sell the current player to the highest bidder / move to next player
- Mark a player unsold
- Add or remove players
- Mute, unmute, kick or ban participants
- Change a team's purse (cannot set it below money already spent)
- Reset the auction

## Important MVP limitations

- This starter version stores rooms in server memory. Rooms disappear when the server restarts, and it is intended for a single server instance.
- Add a persistent database (for example PostgreSQL or MongoDB), durable user accounts, rate limiting, audit logs, HTTPS and production session management before running public/high-stakes events.
- The ban list is lobby-session scoped in this MVP; durable bans should use authenticated account IDs.
- This is an unofficial fan project and is not affiliated with IPL, BCCI or any franchise.
- The included player list is a sample editable pool, not an official or current squad list.
- A real public deployment needs hosting. This project does not automatically publish itself to the internet or create a custom domain.

## Deploy

Deploy the Node app to a host that supports persistent Node.js processes and WebSockets (for example Render, Railway or a VPS). Set the start command to `npm start`, expose the assigned port, and use the host-provided HTTPS URL. Do not put organiser passwords or private admin keys in public source code.
