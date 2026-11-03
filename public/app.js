const socket = io();
let state = {code:null,member:null,adminKey:null,room:null,selectedBid:0};
const $ = id => document.getElementById(id);
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add("hidden"),3200)}
function show(which){["home","createPanel","joinPanel","room"].forEach(id=>$(id).classList.toggle("hidden",id!==which))}
$("showCreate").onclick=()=>show("createPanel");$("showJoin").onclick=()=>show("joinPanel");
document.querySelectorAll("[data-home]").forEach(b=>b.onclick=()=>show("home"));
function emitAdmin(action,data={}){socket.emit("organiser:action",{code:state.code,key:state.adminKey,action,data})}
function setRoom(room){
 state.room=room;
 $("roomTitle").textContent=room.title;$("roomCode").textContent=room.code;
 $("statusPill").textContent=room.status.toUpperCase();$("pauseLabel").textContent=room.paused?"PAUSED":"";
 const p=room.players.find(x=>x.id===room.currentPlayer);
 $("playerName").textContent=p?p.name:"Auction finished / waiting";
 $("playerMeta").textContent=p?`${p.role} · ${p.country}`:"The organiser can start or reset the auction.";
 $("currentBid").textContent=`₹${room.currentBid||0} L`;
 $("basePrice").textContent=p?`₹${p.base} L`:"—";
 const high=room.teams.find(t=>t.id===(room.highestBidder||{}).teamId);
 $("highestBidder").textContent=high?high.name:"—";
 const myTeam=room.teams.find(t=>t.id===state.member?.teamId);
 const next=(room.currentBid===p?.base?p?.base:(room.currentBid+10))||0;
 state.selectedBid=next;
 $("bidAmount").textContent=`₹${next}L`;
 $("placeBid").disabled=!myTeam||state.member.muted||room.status!=="live"||room.paused||!p||next>myTeam.budget-myTeam.spent;
 $("bidHint").textContent=state.member.role==="organiser"?"Organiser account: use the control panel to manage the auction.":state.member.role==="viewer"?"You are viewing only. Join as a team owner to bid.":state.member.muted?"You have been muted by the organiser.":`Your team: ${myTeam?.name||"—"}. Bids increase by ₹10 lakh.`;
 $("teamsGrid").innerHTML=room.teams.map(t=>{const pct=Math.min(100,t.spent/t.budget*100);return `<div class="team-card"><div class="team-card-top"><span>${esc(t.name)}</span><span>${t.owner?"●":"○"}</span></div><small>${t.owner?`Owner: ${esc(t.owner)}`:"No owner"} · Spent ₹${t.spent}L</small><div class="progress"><span style="width:${pct}%"></span></div><small>Remaining ₹${t.budget-t.spent}L</small></div>`}).join("");
 $("playersList").innerHTML=room.players.map(x=>`<div class="player-row"><div><b>${esc(x.name)}</b><small>${esc(x.role)} · ${esc(x.country)} · Base ₹${x.base}L</small></div><span class="status ${x.status==="sold"?"sold":""}">${x.status==="sold"?"SOLD":x.status.toUpperCase()}</span></div>`).join("");
 $("playerCount").textContent=`${room.players.length} players`;
 $("membersList").innerHTML=room.members.map(m=>`<div class="member-row"><div><b>${esc(m.name)}</b><small>${m.role==="organiser"?"Organiser":m.role==="team"?(room.teams.find(t=>t.id===m.teamId)?.name||"Team owner"):"Viewer"}${m.muted?" · MUTED":""}</small></div><span class="status">${m.role.toUpperCase()}</span></div>`).join("");
 $("memberCount").textContent=`${room.members.length} online`;
 $("bidHistory").innerHTML=room.bidHistory.length?room.bidHistory.slice().reverse().map(b=>`<div class="history-row"><span>${esc(b.teamName)} <small>· ${esc(b.bidder)}</small></span><b>₹${b.amount}L</b></div>`).join(""):'<p class="muted">No bids yet.</p>';
 const admin=state.member.role==="organiser";$("organiserPanel").classList.toggle("hidden",!admin);
 if(admin){
   const others=room.members.filter(m=>m.role!=="organiser");
   $("moderateMember").innerHTML=others.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}${m.muted?" (muted)":""}</option>`).join("");
   $("removePlayerSelect").innerHTML=room.players.map(p=>`<option value="${p.id}">${esc(p.name)} — ${p.status}</option>`).join("");
   $("budgetTeam").innerHTML=room.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("");
   const selected=room.teams.find(t=>t.id===$("budgetTeam").value)||room.teams[0];$("budgetValue").placeholder=`Current: ₹${selected?.budget||0}L`;
 }
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function joined(data){state.code=data.code;state.member=data.member;state.adminKey=data.adminKey;show("room");setRoom(data.room);history.replaceState({}, "", `/lobby/${data.code}`);if(data.adminKey)toast(`Lobby created! Save organiser password and share code ${data.code}.`);else toast("Joined auction room.");}
socket.on("room:joined",joined);socket.on("room:update",setRoom);socket.on("action:error",toast);socket.on("room:removed",d=>{toast(d.message);setTimeout(()=>{state={code:null,member:null,adminKey:null,room:null};show("home")},900)});
$("createForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);socket.emit("room:create",{name:f.get("name"),title:f.get("title"),password:f.get("password"),budget:f.get("budget")})};
$("joinForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);socket.emit("room:join",{code:f.get("code"),name:f.get("name"),teamId:f.get("kind")==="team"?f.get("teamId"):null,asViewer:f.get("kind")==="viewer"})};
$("joinKind").onchange=()=> $("teamPickWrap").classList.toggle("hidden",$("joinKind").value==="viewer");
$("placeBid").onclick=()=>{if(!state.room)return;const p=state.room.players.find(x=>x.id===state.room.currentPlayer);const amount=state.room.currentBid===p?.base?p.base:state.room.currentBid+10;socket.emit("bid:place",{code:state.code,amount})};
$("increaseBid").onclick=()=>{state.selectedBid+=10;$("bidAmount").textContent=`₹${state.selectedBid}L`};
$("decreaseBid").onclick=()=>{state.selectedBid=Math.max(state.room?.currentBid||0,state.selectedBid-10);$("bidAmount").textContent=`₹${state.selectedBid}L`};
$("copyInvite").onclick=async()=>{const url=location.origin+`/lobby/${state.code}`;try{await navigator.clipboard.writeText(url);toast("Invite link copied!")}catch{toast(url)}};
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{
 const action=b.dataset.action;let data={};
 if(["mute","unmute","kick","ban"].includes(action)){data.name=$("moderateMember").value;if(!data.name)return toast("No participant selected.");}
 if(action==="addPlayer"){data={name:$("newPlayerName").value,role:$("newPlayerRole").value,base:$("newPlayerBase").value};if(!data.name.trim())return toast("Enter a player name.");}
 if(action==="removePlayer")data.playerId=$("removePlayerSelect").value;
 if(action==="setBudget")data={teamId:$("budgetTeam").value,budget:$("budgetValue").value};
 if(action==="reset"&&!confirm("Reset the entire auction? All sold players, bids and team ownership will be cleared."))return;
 if(action==="end"&&!confirm("End this auction now?"))return;
 emitAdmin(action,data);
 if(action==="addPlayer")$("newPlayerName").value="";
});
 socket.on("connect", () => {
  const parts = window.location.pathname.split("/").filter(Boolean);

  if (parts[0]?.toLowerCase() === "lobby" && parts[1]) {
    show("joinPanel");

    const codeInput = $("joinForm").querySelector('[name="code"]');

    if (codeInput) {
      codeInput.value = parts[1].toUpperCase();
    }
  }
});