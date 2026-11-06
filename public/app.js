const $ = id => document.getElementById(id);
const socket = io();
let role = null;
let roomKey = null;
let state = null;
let selected = "SGC";
let toastTimer;
let lastSocketConnected = false;
let reconnectProfile = null;
try {
  reconnectProfile = JSON.parse(localStorage.getItem("seyGamerzReconnectProfile") || "null");
} catch (_) { reconnectProfile = null; }
if (reconnectProfile) {
  $("playerName").value = reconnectProfile.name || "";
  $("roomKey").value = reconnectProfile.key || "";
  $("startingCashInput").value = reconnectProfile.startingCash ?? "";
}
const fmt = value => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
}).format(value || 0);
const qty = value => Number(value || 0).toLocaleString("en-US", {
  maximumFractionDigits: 6
});
const companyMeta = {
  SGC: { name: "Sey Gamerz Company", icon: "🎮" },
  TFH: { name: "TWAIN Fashion House", icon: "👗" },
  SFH: { name: "Star Fitness Hub", icon: "💪" },
  SEX: { name: "Star Export", icon: "🚢" },
  EM2: { name: "EM2 Luxe", icon: "💎" },
  ANE: { name: "ANIKS Enterprises", icon: "🏢" },
  TAS: { name: "Tasher Foundation", icon: "🤝" },
  PP: { name: "Paris Palace", icon: "🏰" },
  RCW: { name: "RC World", icon: "🌐" },
  RH: { name: "Ravishing Hotel", icon: "🏨" }
};

function notice(message, error = false) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden", "error");
  if (error) $("toast").classList.add("error");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 3500);
}

$("create").onclick = () => {
  localStorage.removeItem("seyGamerzReconnectProfile");
  reconnectProfile = null;
  socket.emit("createRoom", { name: $("hostName").value });
};
$("join").onclick = () => {
  const startingCash = Number($("startingCashInput").value);
  const name = $("playerName").value.trim();
  const key = $("roomKey").value.trim().toUpperCase();
  if (!name || !key) return notice("Enter your player name and current room key.", true);
  reconnectProfile = { name, key, startingCash };
  localStorage.setItem("seyGamerzReconnectProfile", JSON.stringify(reconnectProfile));
  socket.emit("joinRoom", { name, key, startingCash });
};

$("copyRoom").onclick = () => navigator.clipboard?.writeText(roomKey)
  .then(() => notice("Room key copied"))
  .catch(() => notice("Room key: " + roomKey));
$("startBtn").onclick = () => socket.emit("hostAction", { action: "start" });
$("pauseBtn").onclick = () => socket.emit("hostAction", { action: "pause" });
$("resumeBtn").onclick = () => socket.emit("hostAction", { action: "resume" });
$("nextBtn").onclick = () => socket.emit("hostAction", { action: "next" });
$("endBtn").onclick = () => {
  if (confirm("End the Stock Exchange game for everyone?")) {
    socket.emit("hostAction", { action: "end" });
  }
};

$("setSelect").innerHTML = Array.from({ length: 10 }, (_, index) =>
  `<option value="${index + 1}">Set ${String(index + 1).padStart(2, "0")}</option>`
).join("");
$("setSelect").onchange = () => socket.emit("hostAction", {
  action: "set",
  value: $("setSelect").value
});
$("buyBtn").onclick = () => trade("buy");
$("sellBtn").onclick = () => trade("sell");

function trade(side) {
  const amount = Number($("quantity").value);
  if (!amount || amount <= 0) return notice("Enter a share quantity first.", true);
  socket.emit("trade", { side, symbol: selected, quantity: amount });
  $("quantity").value = "";
}

socket.on("joined", data => {
  role = data.role;
  roomKey = data.key;
  $("lobby").classList.add("hidden");
  $("game").classList.remove("hidden");
  document.body.classList.toggle("host-view", role === "host");
  $("roomDisplay").textContent = roomKey;
  $("roleLabel").textContent = role === "host" ? "HOST CONTROL TERMINAL" : "PLAYER TRADING TERMINAL";
  $("hostPanel").classList.toggle("hidden", role !== "host");

  if (role === "host") {
    $("tradePanel").classList.add("hidden");
    $("portfolioPanel").classList.add("hidden");
    $("historyEyebrow").textContent = "LIVE MARKET ACTIVITY";
    $("historyTitle").textContent = "PLAYER TRADE FLOOR";
    $("feedLiveTag").classList.remove("hidden");
    notice("Room created! Share key " + roomKey);
  } else {
    reconnectProfile = { name: data.name, key: data.key, startingCash: data.startingCash };
    localStorage.setItem("seyGamerzReconnectProfile", JSON.stringify(reconnectProfile));
    notice(data.reconnected
      ? `Welcome back, ${data.name}! Your previous game progress has been restored.`
      : `Joined room ${roomKey} — ${fmt(data.startingCash)} game cash ready.`);
  }
});

socket.on("connect", () => {
  if (lastSocketConnected && role === "player" && reconnectProfile) {
    notice("Connection restored. Rejoining your game…");
    socket.emit("joinRoom", reconnectProfile);
  }
  lastSocketConnected = true;
});
socket.on("disconnect", () => {
  if (role === "player") notice("Connection lost. Your game progress is being kept. Reconnecting…", true);
});
socket.on("notice", data => notice(data.message, data.type === "error"));
socket.on("state", nextState => {
  state = nextState;
  render();
});
socket.on("roundEnd", () => notice("Set finished! Host may move to the next set."));
socket.on("tradeNotice", data => {
  notice(`${data.player} ${data.side === "buy" ? "bought" : "sold"} ${qty(data.quantity)} ${data.symbol}`);
});

function render() {
  if (!state) return;

  $("roundDisplay").textContent = `${String(state.set).padStart(2, "0")} / 10`;
  $("setSelect").value = state.set;
  const seconds = Math.ceil(state.remaining / 1000);
  $("timer").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  $("startBtn").textContent = state.ended ? "GAME ENDED" : state.started ? "ROUND RUNNING" : "START ROUND";
  $("startBtn").disabled = state.started || state.ended;
  $("pauseBtn").disabled = !state.started || state.paused;
  $("resumeBtn").disabled = !state.started || !state.paused;
  $("nextBtn").disabled = state.set >= 10;

  $("companyTabs").innerHTML = Object.entries(state.companies).map(([symbol, company]) =>
    `<button class="coin-tab ${symbol === selected ? "active" : ""}" data-company="${symbol}">${symbol} ${fmt(company.price)} · ${(company.rate * 100).toFixed(2)}% DIV</button>`
  ).join("");
  document.querySelectorAll("[data-company]").forEach(button => {
    button.onclick = () => {
      selected = button.dataset.company;
      render();
    };
  });

  const company = state.companies[selected];
  $("chartPrice").textContent = fmt(company.price);
  const firstPrice = company.history[0] || company.price;
  const change = (company.price / firstPrice - 1) * 100;
  $("chartChange").textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}% since set`;
  $("chartChange").style.color = change >= 0 ? "#32d69a" : "#ff6475";
  $("selectedIcon").textContent = companyMeta[selected].icon;
  $("selectedName").textContent = companyMeta[selected].name;
  $("selectedSymbol").textContent = selected;
  $("selectedDividend").textContent = `Dividend rate: ${(company.rate * 100).toFixed(2)}% per 2-minute payout`;
  $("selectedPrice").textContent = fmt(company.price);
  drawChart(company.history);

  const players = Array.isArray(state.players) ? state.players : [];
  // Socket IDs can change after a mobile reconnect. Fall back to the saved player name
  // so the personal dashboard still renders while the server rebinds the socket.
  const me = players.find(player => player.id === socket.id)
    || (role === "player" && reconnectProfile
      ? players.find(player => String(player.name || "").toLowerCase() === String(reconnectProfile.name || "").toLowerCase())
      : null);
  if (me && role === "player") {
    const holdings = me.holdings && typeof me.holdings === "object" ? me.holdings : {};
    const costBasis = me.costBasis && typeof me.costBasis === "object" ? me.costBasis : {};
    const activeHoldings = Object.entries(holdings).filter(([, amount]) => Number(amount) > 0);
    $("cash").textContent = fmt(me.cash);
    $("cashBalance").textContent = fmt(me.cash);
    $("portfolio").textContent = fmt(me.portfolio);
    $("netWorth").textContent = fmt(me.totalWealth);
    $("stockValue").textContent = fmt(me.portfolio);
    $("totalProfit").textContent = fmt(me.totalProfit);
    $("totalLoss").textContent = fmt(me.totalLoss);
    $("dividendsEarned").textContent = fmt(me.dividendsEarned);

    $("holdings").innerHTML = activeHoldings.length
      ? activeHoldings.map(([symbol, amount]) => {
          const company = state.companies[symbol];
          if (!company) return "";
          const marketValue = Number(amount) * Number(company.price || 0);
          const basis = Number(costBasis[symbol] || 0);
          const unrealized = marketValue - basis;
          return `<article class="holding-card">
            <div class="holding-top"><span class="holding-symbol">${esc(symbol)}</span><span class="holding-company">${esc(companyMeta[symbol]?.name || company.name || symbol)}</span></div>
            <div class="holding-units"><small>SHARES OWNED</small><strong>${qty(amount)}</strong></div>
            <div class="holding-values"><div><small>MARKET VALUE</small><b>${fmt(marketValue)}</b></div><div><small>BUY COST</small><b>${fmt(basis)}</b></div></div>
            <div class="holding-unrealized ${unrealized >= 0 ? "positive" : "negative"}">Unrealized ${unrealized >= 0 ? "gain" : "loss"}: ${fmt(Math.abs(unrealized))}</div>
          </article>`;
        }).join("")
      : '<p class="empty-state">You have not purchased any shares yet. Your holdings will appear here after your first BUY.</p>';

    const trades = Array.isArray(me.trades) ? me.trades : [];
    $("history").innerHTML = trades.length
      ? trades.slice().reverse().map(item => {
          const isDividend = item.side === "dividend";
          const isSell = item.side === "sell";
          const title = isDividend
            ? `DIVIDEND · ${esc(item.symbol || "")}`
            : `${String(item.side || "trade").toUpperCase()} · ${qty(item.quantity)} ${esc(item.symbol || "")} shares`;
          const detail = isDividend
            ? `Dividend recorded separately · ${fmt(item.total)}`
            : isSell
              ? `Principal returned ${fmt(item.principalReturned || 0)} · Profit ${fmt(item.realizedProfit || 0)} · Loss ${fmt(item.realizedLoss || 0)}`
              : `Purchase cost ${fmt(item.purchaseCost ?? item.total ?? 0)} · ${fmt(item.price || 0)} per share`;
          return `<article class="player-trade-row"><div class="player-trade-heading"><strong class="${isSell ? "sell-text" : "buy-text"}">${title}</strong><b>${fmt(item.total || 0)}</b></div><small>${esc(companyMeta[item.symbol]?.name || item.company || item.symbol || "Stock transaction")}</small><p>${detail}</p></article>`;
        }).join("")
      : '<p class="empty-state">No transactions yet. Your buy, sell, and dividend activity will appear here.</p>';
  }

  const rankedPlayers = players.slice().sort((a, b) => Number(b.totalWealth || 0) - Number(a.totalWealth || 0));
  $("leaderboard").innerHTML = rankedPlayers.length
    ? rankedPlayers.map((player, index) =>
      `<article class="leader-row"><span class="rank">#${index + 1}</span><div class="leader-player"><strong>${esc(player.name || "Player")}${player.id === socket.id ? " <small>YOU</small>" : ""}</strong><small>${player.connected === false ? "OFFLINE · " : "ONLINE · "}Cash ${fmt(player.cash)} · Shares ${fmt(player.portfolio)}<br>Profit ${fmt(player.totalProfit)} · Loss ${fmt(player.totalLoss)} · Dividends ${fmt(player.dividendsEarned)}</small></div><strong class="leader-wealth">${fmt(player.totalWealth)}</strong></article>`
    ).join("")
    : '<p class="empty-state">Waiting for players to join the room. Player rankings will appear here.</p>';

  if (role === "host") renderHostTradeFeed(state.tradeFeed || []);

  const active = state.started && !state.paused && !state.ended;
  $("buyBtn").disabled = role !== "player" || !active;
  $("sellBtn").disabled = role !== "player" || !active;
  $("quantity").disabled = role !== "player" || !active;
  $("tradeHint").textContent = state.ended
    ? "Game ended. Trading is closed."
    : state.paused
      ? "Round paused. Wait for host to resume."
      : !state.started
        ? "Waiting for host to start the round."
        : "Trading is live. All trades use virtual game cash.";
}

function renderHostTradeFeed(trades) {
  const buys = trades.filter(item => item.side === "buy").length;
  const sells = trades.filter(item => item.side === "sell").length;
  const dividends = trades.filter(item => item.side === "dividend").length;
  const realizedProfits = trades.filter(item => item.side === "sell" && item.realizedProfit > 0).length;
  const realizedLosses = trades.filter(item => item.side === "sell" && item.realizedLoss > 0).length;
  $("hostFeedSummary").classList.remove("hidden");
  $("hostFeedSummary").innerHTML = `
    <div class="feed-stat"><small>RECENT TRADES</small><strong>${trades.length}</strong></div>
    <div class="feed-stat"><small>BUY ORDERS</small><strong class="buy-text">${buys}</strong></div>
    <div class="feed-stat"><small>SELL ORDERS</small><strong class="sell-text">${sells}</strong></div>
    <div class="feed-stat"><small>DIVIDENDS</small><strong>${dividends}</strong></div>
    <div class="feed-stat"><small>PROFIT SALES</small><strong class="buy-text">${realizedProfits}</strong></div>
    <div class="feed-stat"><small>LOSS SALES</small><strong class="sell-text">${realizedLosses}</strong></div>`;

  if (!trades.length) {
    $("history").innerHTML = '<div class="feed-empty"><strong>THE MARKET FLOOR IS QUIET</strong><span>Player purchases and sales will appear here live as soon as trading begins.</span></div>';
    return;
  }

  $("history").innerHTML = trades.slice().reverse().map(item => {
    const time = new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const action = item.side === "dividend" ? "DIVIDEND RECORDED" : item.side.toUpperCase();
    const number = String(item.playerNumber || 0).padStart(2, "0");
    return `<article class="host-trade-card">
      <div class="host-trade-top">
        <div class="host-player"><span class="player-number">PLAYER ${number}</span><strong>${esc(item.player)}</strong></div>
        <span class="trade-action ${item.side === "buy" ? "buy-action" : item.side === "dividend" ? "buy-action" : "sell-action"}">${action}</span>
      </div>
      <div class="host-trade-main"><strong>${item.side === "dividend" ? "Dividend recorded separately" : `${qty(item.quantity)} shares <span>${esc(item.symbol)} · ${esc(item.company || companyMeta[item.symbol]?.name || item.symbol)}</span>`}</strong><b>${fmt(item.total)}</b></div>
      <div class="host-trade-meta"><span>${item.side === "dividend" ? "Not added to cash or trading profit" : item.side === "sell" ? `Principal returned ${fmt(item.principalReturned||0)} · Profit ${fmt(item.realizedProfit||0)} · Loss ${fmt(item.realizedLoss||0)}` : `${fmt(item.price)} per share · purchase cost`}</span><time>${time}</time></div>
    </article>`;
  }).join("");
}

function drawChart(values) {
  const canvas = $("chart");
  const context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = 190;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);

  for (let index = 0; index < 4; index++) {
    context.strokeStyle = "#252c34";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, index * height / 3);
    context.lineTo(width, index * height / 3);
    context.stroke();
  }
  if (values.length < 2) return;

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    max *= 1.001;
    min *= 0.999;
  }
  const points = values.map((value, index) => ({
    x: index / (values.length - 1) * width,
    y: height - 12 - (value - min) / (max - min) * (height - 24)
  }));
  context.beginPath();
  points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  const rising = values.at(-1) >= values[0];
  context.strokeStyle = rising ? "#32d69a" : "#ff6475";
  context.lineWidth = 2.5;
  context.stroke();
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, rising ? "#32d69a30" : "#ff647530");
  gradient.addColorStop(1, "#10131800");
  context.fillStyle = gradient;
  context.fill();
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

setInterval(() => {
  if (state && state.started && !state.paused && !state.ended) {
    const seconds = Math.ceil(state.remaining / 1000) - 1;
    $("timer").textContent = `${String(Math.max(0, Math.floor(seconds / 60))).padStart(2, "0")}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;
  }
}, 1000);
