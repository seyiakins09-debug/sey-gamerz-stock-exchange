const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express(); const server = http.createServer(app); const io = new Server(server);
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
const SET_MS = 30 * 60 * 1000, DIVIDEND_MS = 2 * 60 * 1000, MAX_FEED = 500;
const COMPANIES = [
 {symbol:'SGC',name:'Sey Gamerz Company',price:125,vol:.0009,rate:.0025,icon:'🎮'},
 {symbol:'TFH',name:'TWAIN Fashion House',price:86,vol:.00125,rate:.0020,icon:'👗'},
 {symbol:'SFH',name:'Star Fitness Hub',price:64,vol:.0011,rate:.0018,icon:'💪'},
 {symbol:'SEX',name:'Star Export',price:148,vol:.0016,rate:.0028,icon:'🚢'},
 {symbol:'EM2',name:'EM2 Luxe',price:210,vol:.0014,rate:.0032,icon:'💎'},
 {symbol:'ANE',name:'ANIKS Enterprises',price:175,vol:.0010,rate:.0024,icon:'🏢'},
 {symbol:'TAS',name:'Tasher Foundation',price:52,vol:.0008,rate:.0015,icon:'🤝'},
 {symbol:'PP',name:'Paris Palace',price:230,vol:.0015,rate:.0030,icon:'🏰'},
 {symbol:'RCW',name:'RC World',price:98,vol:.00175,rate:.0022,icon:'🌐'},
 {symbol:'RH',name:'Ravishing Hotel',price:185,vol:.0012,rate:.0027,icon:'🏨'}
];
const rooms = {};
function makeRoom(key,hostId){
 const companies={}; COMPANIES.forEach(c=>companies[c.symbol]={...c,history:[c.price],previousPrice:c.price});
 return rooms[key]={key,hostId,hostName:'HOST',players:{},nextPlayerNumber:1,tradeFeed:[],tradeCount:0,set:1,started:false,paused:false,ended:false,deadline:null,remaining:SET_MS,companies,lastDividendAt:null,pausedAt:null,interval:null};
}
function portfolio(p,r){return Object.entries(p.holdings).reduce((s,[sym,qty])=>s+qty*r.companies[sym].price,0)}
function netWorth(p,r){return p.cash+portfolio(p,r)}
function stateOf(r){return {key:r.key,set:r.set,started:r.started,paused:r.paused,ended:r.ended,remaining:r.started&&!r.paused&&!r.ended?Math.max(0,r.deadline-Date.now()):r.remaining,companies:r.companies,players:Object.values(r.players).map(p=>({id:p.id,playerNumber:p.playerNumber,name:p.name,startingCash:p.startingCash,cash:p.cash,holdings:p.holdings,portfolio:portfolio(p,r),netWorth:netWorth(p,r),profit:netWorth(p,r)-p.startingCash,trades:p.trades.slice(-8),connected:p.connected!==false})),tradeFeed:r.tradeFeed};}
function emit(r){io.to(r.key).emit('state',stateOf(r))}
function fail(s,m){s.emit('notice',{type:'error',message:m})}
function feed(r,item){item.tradeNumber=++r.tradeCount;item.time=new Date().toISOString();r.tradeFeed.push(item);if(r.tradeFeed.length>MAX_FEED)r.tradeFeed.shift();}
function tick(r){if(!r.started||r.paused||r.ended)return;const now=Date.now();
 for(const c of Object.values(r.companies)){c.previousPrice=c.price;let drift=(Math.random()-.49)*c.vol;let shock=Math.random()<.025?(Math.random()-.5)*c.vol*3:0;c.price=Math.max(c.price*.03,c.price*(1+drift+shock));c.history.push(c.price);if(c.history.length>100)c.history.shift();
 // Dividend yield responds to current market movement, bounded to keep the game playable.
 const move=c.previousPrice?c.price/c.previousPrice-1:0;c.rate=Math.max(.0005,Math.min(.008,c.rate+move*.025));}
 if(r.lastDividendAt===null)r.lastDividendAt=now;
 while(now-r.lastDividendAt>=DIVIDEND_MS){r.lastDividendAt+=DIVIDEND_MS;payDividends(r);}
 r.remaining=Math.max(0,r.deadline-now);if(r.remaining<=0){r.ended=true;r.started=false;clearInterval(r.interval);r.interval=null;io.to(r.key).emit('roundEnd',stateOf(r));}emit(r);
}
function payDividends(r){
 for(const p of Object.values(r.players)){
  for(const [sym,shares] of Object.entries(p.holdings)){
   const c=r.companies[sym];
   if(shares<=0)continue;
   const amount=shares*c.price*c.rate;
   if(amount<=0)continue;
   p.cash+=amount;
   const entry={playerNumber:p.playerNumber,player:p.name,side:'dividend',symbol:sym,company:c.name,quantity:shares,price:c.price,total:amount,details:'Dividend payout',cashAfter:p.cash,netWorthAfter:netWorth(p,r)};
   p.trades.push(entry);feed(r,entry);
  }
 }
}
io.on('connection',socket=>{
 socket.on('createRoom',({name}={})=>{let key;do{key=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms[key]);const r=makeRoom(key,socket.id);r.hostName=(name||'Host').trim().slice(0,24)||'Host';socket.join(key);socket.data.room=key;socket.data.role='host';socket.emit('joined',{role:'host',key,name:r.hostName});emit(r);});
 socket.on('joinRoom',({key,name,startingCash}={})=>{key=(key||'').trim().toUpperCase();const r=rooms[key];if(!r)return fail(socket,'Room key not found.');if(r.ended)return fail(socket,'This game has ended.');const cash=Number(startingCash);const nickname=(name||'Player').trim().slice(0,24)||'Player';const normalized=nickname.toLocaleLowerCase();const existing=Object.entries(r.players).find(([,p])=>p.name.toLocaleLowerCase()===normalized);let p,reconnected=false;if(existing){const [oldId,oldPlayer]=existing;if(oldPlayer.connected)return fail(socket,'That player name is already connected. If this is your account, wait a moment and try again.');delete r.players[oldId];p=oldPlayer;p.id=socket.id;p.connected=true;r.players[socket.id]=p;reconnected=true;}else{if(!Number.isFinite(cash)||cash<=0||cash>Number.MAX_SAFE_INTEGER)return fail(socket,'Enter a valid starting amount greater than zero for a new player.');if(Object.keys(r.players).length>=50)return fail(socket,'Room is full (50 players maximum).');const holdings={};COMPANIES.forEach(c=>holdings[c.symbol]=0);p=r.players[socket.id]={id:socket.id,playerNumber:r.nextPlayerNumber++,name:nickname,startingCash:cash,cash,holdings,trades:[],connected:true};}socket.join(key);socket.data.room=key;socket.data.role='player';socket.emit('joined',{role:'player',key,name:p.name,playerNumber:p.playerNumber,startingCash:p.startingCash,reconnected});emit(r);});
 socket.on('hostAction',({action,value}={})=>{const r=rooms[socket.data.room];if(!r||socket.data.role!=='host'||r.hostId!==socket.id)return;
 if(action==='start'&&!r.ended){r.started=true;r.paused=false;r.deadline=Date.now()+r.remaining;if(r.lastDividendAt===null)r.lastDividendAt=Date.now();if(!r.interval)r.interval=setInterval(()=>tick(r),1000);}
 if(action==='pause'&&r.started&&!r.paused){r.remaining=Math.max(0,r.deadline-Date.now());r.paused=true;r.pausedAt=Date.now();}
 if(action==='resume'&&r.started&&r.paused){r.paused=false;r.deadline=Date.now()+r.remaining;if(r.pausedAt&&r.lastDividendAt!==null)r.lastDividendAt+=Date.now()-r.pausedAt;r.pausedAt=null;}
 if(action==='next'||action==='set'){if(r.interval)clearInterval(r.interval);r.interval=null;r.set=action==='set'?Math.min(10,Math.max(1,Number(value)||1)):Math.min(10,r.set+1);r.started=false;r.paused=false;r.ended=false;r.remaining=SET_MS;r.deadline=null;r.lastDividendAt=null;r.pausedAt=null;}
 if(action==='end'){r.ended=true;r.started=false;r.paused=false;if(r.interval)clearInterval(r.interval);r.interval=null;}emit(r);});
 socket.on('trade',({side,symbol,quantity}={})=>{const r=rooms[socket.data.room],p=r&&r.players[socket.id];if(!r||!p||socket.data.role!=='player')return;if(!r.started||r.paused||r.ended)return fail(socket,'Trading is available only while the set is running.');const c=r.companies[symbol],q=Number(quantity);if(!c||!Number.isFinite(q)||q<=0||q>1e12)return fail(socket,'Enter a valid number of shares.');const total=q*c.price;if(!Number.isFinite(total))return fail(socket,'That trade is too large.');if(side==='buy'){if(total>p.cash+1e-8)return fail(socket,'Not enough virtual cash.');p.cash-=total;p.holdings[symbol]+=q;}else if(side==='sell'){if(q>p.holdings[symbol]+1e-10)return fail(socket,'You do not own enough shares.');p.holdings[symbol]-=q;p.cash+=total;}else return;
 const item={playerNumber:p.playerNumber,player:p.name,side,symbol,company:c.name,quantity:q,price:c.price,total,cashAfter:p.cash,netWorthAfter:netWorth(p,r)};p.trades.push(item);feed(r,item);io.to(r.key).emit('tradeNotice',{player:p.name,side,symbol,quantity:q,total});emit(r);});
 socket.on('disconnect',()=>{const r=rooms[socket.data.room];if(r&&socket.data.role==='player'&&r.players[socket.id]){r.players[socket.id].connected=false;r.players[socket.id].disconnectedAt=Date.now();emit(r);}});
});
server.listen(PORT,()=>console.log('SEY GAMERZ Stock Exchange running on '+PORT));
