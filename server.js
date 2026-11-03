const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));

const TEAM_NAMES = [
  "Chennai Super Kings", "Mumbai Indians", "Royal Challengers Bengaluru",
  "Kolkata Knight Riders", "Sunrisers Hyderabad", "Rajasthan Royals",
  "Delhi Capitals", "Punjab Kings", "Gujarat Titans", "Lucknow Super Giants"
];
const STARTING_PLAYERS = [
  ["Virat Kohli","Batter","India",200],["Rohit Sharma","Batter","India",180],
  ["Jasprit Bumrah","Bowler","India",200],["Suryakumar Yadav","Batter","India",180],
  ["Hardik Pandya","All-rounder","India",150],["Ravindra Jadeja","All-rounder","India",150],
  ["MS Dhoni","Wicketkeeper","India",100],["Rishabh Pant","Wicketkeeper","India",180],
  ["Shubman Gill","Batter","India",180],["Rashid Khan","Bowler","Afghanistan",180],
  ["Pat Cummins","Bowler","Australia",180],["Travis Head","Batter","Australia",150],
  ["Heinrich Klaasen","Wicketkeeper","South Africa",180],["Abhishek Sharma","All-rounder","India",100],
  ["Sanju Samson","Wicketkeeper","India",150],["Yashasvi Jaiswal","Batter","India",150],
  ["Andre Russell","All-rounder","West Indies",150],["Sunil Narine","All-rounder","West Indies",120],
  ["Rinku Singh","Batter","India",100],["Phil Salt","Wicketkeeper","England",100],
  ["Shreyas Iyer","Batter","India",150],["Mitchell Starc","Bowler","Australia",150],
  ["KL Rahul","Wicketkeeper","India",150],["Nicholas Pooran","Wicketkeeper","West Indies",150],
  ["Ruturaj Gaikwad","Batter","India",150],["Matheesha Pathirana","Bowler","Sri Lanka",100],
  ["Arshdeep Singh","Bowler","India",100],["Shreyas Gopal","Bowler","India",30],
  ["Marcus Stoinis","All-rounder","Australia",100],["Rachin Ravindra","All-rounder","New Zealand",100]
].map((p, i) => ({ id: `p${i+1}`, name:p[0], role:p[1], country:p[2], base:p[3], status:"available", soldTo:null, soldFor:null }));

const rooms = new Map();
const makeId = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const publicRoom = (r) => ({
  code:r.code, title:r.title, status:r.status, paused:r.paused,
  teams:r.teams, players:r.players, currentPlayer:r.currentPlayer,
  currentBid:r.currentBid, bidHistory:r.bidHistory.slice(-30),
  members:[...r.members.values()].map(m=>({id:m.id,name:m.name,role:m.role,teamId:m.teamId,muted:m.muted})),
  settings:r.settings
});
function emitRoom(r) { io.to(r.code).emit("room:update", publicRoom(r)); }
function findMember(r, socketId) { return r.members.get(socketId); }
function isAdmin(r, socketId, key) {
  const m = findMember(r, socketId);
  return !!m && m.role === "organiser" && r.adminHash === hash(key || "");
}
function roomFor(socket, code) {
  const r = rooms.get(String(code || "").toUpperCase());
  if (!r) throw new Error("Lobby not found.");
  if (!findMember(r, socket.id)) throw new Error("Join this lobby first.");
  return r;
}
function nextPlayer(r) {
  const p = r.players.find(x => x.status === "available");
  r.currentPlayer = p ? p.id : null;
  r.currentBid = p ? p.base : 0;
  r.highestBidder = null;
  r.bidHistory = [];
  if (!p) r.status = "completed";
}
function safeAction(socket, fn) {
  try { fn(); } catch(e) { socket.emit("action:error", e.message || "Action failed."); }
}

io.on("connection", socket => {
  socket.on("room:create", ({name, title, password, budget}) => safeAction(socket, () => {
    if (!name || !password || String(password).length < 6) throw new Error("Enter your name and an organiser password of at least 6 characters.");
    let code; do { code = makeId(); } while (rooms.has(code));
    const teams = TEAM_NAMES.map((n,i)=>({id:`t${i+1}`,name:n,budget:Number(budget)||12000,spent:0,owner:null,players:[]}));
    const r = {code,title:String(title||"IPL Mega Auction").slice(0,60),adminHash:hash(password),status:"waiting",paused:false,
      teams,players:STARTING_PLAYERS.map(p=>({...p})),currentPlayer:null,currentBid:0,highestBidder:null,bidHistory:[],
      members:new Map(),banned:new Set(),settings:{budget:Number(budget)||12000,currency:"₹ Lakhs",maxSquad:25,maxOverseas:8}};
    rooms.set(code,r);
    const member = {id:socket.id,name:String(name).slice(0,24),role:"organiser",teamId:null,muted:false};
    r.members.set(socket.id,member); socket.join(code);
    socket.emit("room:joined",{code,member,adminKey:password,room:publicRoom(r)});
  }));

  socket.on("room:join", ({code,name,teamId,asViewer}) => safeAction(socket, () => {
    const r=rooms.get(String(code||"").toUpperCase());
    if(!r) throw new Error("Lobby not found. Check the code.");
    if(r.banned.has(socket.id)) throw new Error("You are banned from this lobby.");
    if(!name) throw new Error("Enter your display name.");
    let role="viewer", chosen=null;
    if(!asViewer && teamId) {
      const team=r.teams.find(t=>t.id===teamId);
      if(!team) throw new Error("Select a valid team.");
      if(team.owner) throw new Error("That team already has an owner. Choose another team or join as viewer.");
      team.owner=String(name).slice(0,24); chosen=team.id; role="team";
    }
    const member={id:socket.id,name:String(name).slice(0,24),role,teamId:chosen,muted:false};
    r.members.set(socket.id,member); socket.join(r.code);
    socket.emit("room:joined",{code:r.code,member,adminKey:null,room:publicRoom(r)});
    emitRoom(r);
  }));

  socket.on("room:refresh", ({code}) => safeAction(socket,()=>{const r=roomFor(socket,code);socket.emit("room:update",publicRoom(r));}));

  socket.on("bid:place", ({code,amount}) => safeAction(socket,()=>{
    const r=roomFor(socket,code), m=findMember(r,socket.id);
    if(m.role!=="team" || !m.teamId) throw new Error("Only team owners can bid.");
    if(m.muted) throw new Error("You are muted by the organiser.");
    if(r.status!=="live" || r.paused) throw new Error("Bidding is not active.");
    const p=r.players.find(x=>x.id===r.currentPlayer), t=r.teams.find(x=>x.id===m.teamId);
    if(!p || !t) throw new Error("No player is currently open for bidding.");
    const value=Number(amount);
    const minimum=r.currentBid===p.base ? p.base : r.currentBid+10;
    if(!Number.isFinite(value)||value<minimum||value%10!==0) throw new Error(`Bid must be at least ₹${minimum} lakh and increase in ₹10 lakh steps.`);
    if(value>t.budget-t.spent) throw new Error("Insufficient remaining purse.");
    r.currentBid=value;r.highestBidder={teamId:t.id,name:t.name,member:m.name};
    r.bidHistory.push({teamId:t.id,teamName:t.name,bidder:m.name,amount:value,at:Date.now()});
    emitRoom(r);
  }));

  socket.on("organiser:action", ({code,key,action,data={}}) => safeAction(socket,()=>{
    const r=roomFor(socket,code);
    if(!isAdmin(r,socket.id,key)) throw new Error("Organiser permission required.");
    const p=r.players.find(x=>x.id===r.currentPlayer);
    if(action==="start") { if(r.status==="completed") throw new Error("Auction is completed. Reset to start again."); r.status="live"; if(!r.currentPlayer) nextPlayer(r); }
    else if(action==="pause") r.paused=true;
    else if(action==="resume") r.paused=false;
    else if(action==="end") { r.status="completed";r.paused=false; }
    else if(action==="next") { if(p && r.highestBidder) {const t=r.teams.find(x=>x.id===r.highestBidder.teamId);p.status="sold";p.soldTo=t.id;p.soldFor=r.currentBid;t.spent+=r.currentBid;t.players.push(p.id);} else if(p) p.status="unsold"; nextPlayer(r); }
    else if(action==="unsold") { if(!p) throw new Error("No active player.");p.status="unsold";nextPlayer(r); }
    else if(action==="removePlayer") { r.players=r.players.filter(x=>x.id!==data.playerId);if(r.currentPlayer===data.playerId)nextPlayer(r); }
    else if(action==="addPlayer") { const n=String(data.name||"").trim();if(!n)throw new Error("Player name is required.");r.players.push({id:crypto.randomUUID(),name:n.slice(0,50),role:String(data.role||"Player"),country:String(data.country||"India"),base:Math.max(10,Number(data.base)||20),status:"available",soldTo:null,soldFor:null}); }
    else if(action==="kick") { const target=[...r.members.values()].find(m=>m.name===data.name);if(!target||target.role==="organiser")throw new Error("Participant not found or cannot be removed.");r.members.delete(target.id);io.to(target.id).emit("room:removed",{message:"You were removed by the organiser."});io.sockets.sockets.get(target.id)?.leave(r.code); }
    else if(action==="ban") { const target=[...r.members.values()].find(m=>m.name===data.name);if(!target||target.role==="organiser")throw new Error("Participant not found or cannot be banned.");r.banned.add(target.id);r.members.delete(target.id);io.to(target.id).emit("room:removed",{message:"You were banned by the organiser."});io.sockets.sockets.get(target.id)?.leave(r.code); }
    else if(action==="mute"||action==="unmute") { const target=[...r.members.values()].find(m=>m.name===data.name);if(!target||target.role==="organiser")throw new Error("Participant not found.");target.muted=action==="mute"; }
    else if(action==="setBudget") { const t=r.teams.find(x=>x.id===data.teamId);if(!t)throw new Error("Team not found.");const b=Number(data.budget);if(!Number.isFinite(b)||b<t.spent)throw new Error("Budget cannot be below money already spent.");t.budget=b; }
    else if(action==="reset") { r.teams.forEach(t=>{t.spent=0;t.owner=null;t.players=[];});r.players.forEach(x=>{x.status="available";x.soldTo=null;x.soldFor=null;});for(const [sid,m] of r.members){if(m.role==="team"){m.role="viewer";m.teamId=null;}}r.status="waiting";r.paused=false;nextPlayer(r); }
    else throw new Error("Unknown organiser action.");
    emitRoom(r);
  }));

  socket.on("disconnect",()=>{
    for(const r of rooms.values()){
      const m=r.members.get(socket.id);
      if(m){r.members.delete(socket.id);if(m.teamId){const t=r.teams.find(x=>x.id===m.teamId);if(t&&t.owner===m.name)t.owner=null;}emitRoom(r);}
    }
  });
});

app.get("/health",(req,res)=>res.json({ok:true,service:"IPL Mega Auction"}));
server.listen(PORT,()=>console.log(`IPL auction server listening on ${PORT}`));
