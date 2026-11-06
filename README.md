# SEY GAMERZ Stock Exchange

A room-based simulated stock market game built with Node.js, Express and Socket.IO.

## Features
- Host creates a room key; players join using room key, nickname, and any positive virtual starting capital.
- 10 sets, 30 minutes per set.
- 10 fictional SEY GAMERZ companies available in every set.
- Simulated share prices fluctuate while a set is running.
- Players buy and sell shares using virtual cash only.
- Dividend earnings are calculated every 2 minutes of active game time based on current share market value and the company's dynamic dividend rate; they are recorded separately and do not change cash balance.
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
## Player reconnection

- If a phone call or temporary network interruption disconnects a player, the room keeps that player's game record instead of removing it.
- The browser automatically attempts to rejoin when its Socket.IO connection returns.
- If the player refreshes or reopens the game, use the **same room key and exact same nickname** to rejoin. The original player number, virtual cash, holdings, trade history, and progress are restored.
- A returning player does not need to re-enter starting capital; the saved original amount is kept.
- The host and leaderboard can see whether a player is online or disconnected.
- Reconnection works while the game server and room are still running. A server restart or an ended room cannot restore an in-memory room.


## Financial system update
- Every player has a starting cash balance, current available cash, share portfolio value, total realized profit, total realized loss, dividend earnings, and total wealth.
- Buying shares deducts the purchase price from cash and adds it to that share's average cost basis.
- When shares are sold, the original purchase cost (cost basis) is returned to cash. Realized profit is recorded separately and is not spendable cash.
- If a sale is below its cost basis, the loss is recorded separately and deducted from cash.
- Dividends are tracked separately. They do not alter cash or realized trading profit.
- Total Wealth leaderboard ranking = current cash + current portfolio market value + realized profit + dividends earned. Realized losses are already deducted from cash and are not subtracted a second time.
- Trade history records principal returned, sale value, realized profit/loss, and dividend payments separately.
