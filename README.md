# SEY GAMERZ Stock Exchange

A room-based simulated stock market game built with Node.js, Express and Socket.IO.

## Features
- Host creates a room key; players join using room key, nickname, and any positive virtual starting capital.
- 10 sets, 30 minutes per set.
- 10 fictional SEY GAMERZ companies available in every set.
- Simulated share prices fluctuate while a set is running.
- Players buy and sell shares using virtual cash only.
- Dividends are paid every 2 minutes of active game time based on current share market value and the company's dynamic dividend rate.
- Dividend rates adjust with market price movement and are bounded for gameplay.
- Host is spectator-only and can start, pause, resume, jump sets, advance, or end the game.
- Host trade floor feed shows buys, sells, and company-by-company dividend payments.
- Player portfolio, holdings, P/L, and leaderboard.

## Companies
1. Sey Gamerz Company (SGC)
2. TWAIN Fashion House (TFH)
3. Star Fitness Hub (SFH)
4. Star Export (SEX)
5. EM2 Luxe (EM2)
6. ANIKS Enterprises (ANE)
7. Tasher Foundation (TAS)
8. Paris Palace (PP)
9. RC World (RCW)
10. Ravishing Hotel (RH)

## Run locally
```bash
npm install
npm start
```
Then open `http://localhost:3000`.

## Render deployment
- Build command: `npm install`
- Start command: `npm start`

All funds and share prices are simulated game values; no real money or brokerage accounts are involved.
