(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height, FLOOR = 714;
// Canonical Crimson Dusk collision/visual baseline: last horizontal floor row is 713,
// front face begins at 714. Entity feet/root resolve to Y=714.
const PLAYER_GROUND_Y = FLOOR;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const now=()=>performance.now()/1000;
const SAVE_KEY='crimsonDusk_v130_multiplayer_input_save';
const LEGACY_SAVE_KEYS=['crimsonDusk_v0320_save','crimsonDusk_v0310_save','crimsonDusk_v0301_save','crimsonDusk_v0300_save','crimsonDusk_v0271_save','crimsonDusk_v0270_save','crimsonDusk_v0262_save','crimsonDusk_v0261_save','crimsonDusk_v0260_save','crimsonDusk_v0250_save','crimsonDusk_v0243_save'];
const FLASK_COST=15;
const FLASK_HEAL_FRACTION=.40;
const MULTIPLAYER_HP_MULT=1.20;
const isMultiplayer=()=>!!player2?.enabled;
const scaledEnemyHp=base=>Math.max(1,Math.round(base*(isMultiplayer()?MULTIPLAYER_HP_MULT:1)));

const assetPaths = {
  room2:'assets/room2_sunken_plaza.png', room3:'assets/room3_hive_arena.png', room4:'assets/room4_sanctuary.png',
  elevator:'assets/elevator_room.png',
  courtyard1:'assets/bridge_courtyard_01.png', courtyard2:'assets/bridge_courtyard_02.png',
  bridgeEnd:'assets/bridge_end.png', courtyardDamned:'assets/courtyard_damned_entrance.png',
  statue:'assets/save_statue.png',
  bIdle:'assets/bandit_new_idle_ifp.png', bRun:'assets/bandit_new_run_ifp.png',
  bBack:'assets/bandit_new_backwalk_ifp.png', bDash:'assets/bandit_new_dash_ifp.png',
  bCrouch:'assets/bandit_crouch_ifp_rc.png', bCrouchShoot:'assets/bandit_crouch_shoot_ifp_rc.png',
  bAtk1:'assets/bandit_attack1_rc.png', bAtk2:'assets/bandit_attack2_rc.png', bAtk3:'assets/bandit_attack3_rc.png',
  bGuard:'assets/bandit_guard_rc.png', bDashParry:'assets/bandit_dash_parry_rc.png', bShotgun:'assets/bandit_shotgun_rc.png', bJump:'assets/bandit_jump_rc.png',
  spider:'assets/spider_run_ifp.png', boss:'assets/spider_boss.png',
  pLowerIdle:'assets/puppet_lower_idle_ifp.png', pLowerWalk:'assets/puppet_lower_walk_ifp.png',
  pLowerAtk1:'assets/puppet_lower_attack1_ifp.png', pLowerAtk2:'assets/puppet_lower_attack2_ifp.png',
  pClawIdle:'assets/puppet_claw_idle_ifp.png', pClawWalk:'assets/puppet_claw_walk_ifp.png',
  pClawAtk1:'assets/puppet_claw_attack1_ifp.png', pClawAtk2:'assets/puppet_claw_attack2_ifp.png',
  pCourtIdle:'assets/courtier_idle_ifp.png', pCourtWalk:'assets/courtier_walk_ifp.png',
  pCourtAtk1:'assets/courtier_attack1_ifp.png', pCourtAtk2:'assets/courtier_attack2_ifp.png',
  hRoomNormal:'assets/harlequin_room_normal.png', hRoomDream:'assets/harlequin_room_dream.png',
  hDormant:'assets/harlequin_dormant.png', hIdle:'assets/harlequin_idle_ifp.png',
  hLeft:'assets/harlequin_dance_left_ifp.png', hRight:'assets/harlequin_dance_right_ifp.png',
  hMoonIdle:'assets/harlequin_moon_idle_ifp.png', hMoonBlow:'assets/harlequin_moon_blow_ifp.png',
  starIFP:'assets/moon_star_projectile_ifp.png',
  castleGate:'assets/castle_gate.png', castleHall:'assets/castle_hall.png', castleGallery:'assets/castle_gallery.png',
  castleApproach:'assets/castle_approach.png', castleThrone:'assets/castle_throne.png',
  lordSeated:'assets/lord_seated.png', lordThrone:'assets/lord_throne_empty.png',
  lordIdle:'assets/lord_idle_ifp.png', lordWalk:'assets/lord_walk_ifp.png', lordCast:'assets/lord_cast_ifp.png', lordMelee:'assets/lord_melee_ifp.png', lordProjectile:'assets/lord_projectile_ifp.png',
  aSpawn:'assets/astalor_spawn_strip.png', aIdle:'assets/astalor_idle_strip.png', aHair:'assets/astalor_hair_strip.png', aFloor:'assets/astalor_floor_safe.png', shop:'assets/astalor_shop.png'
};
const A={};
function loadImage(key,src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{A[key]=im;resolve();};im.onerror=reject;im.src=src;});}

const BANDIT_CELL_W=640, BANDIT_CELL_H=640;
const BANDIT_DRAW_SCALE=.36;
// Per-frame source foot/root rows. The IFP images were authored independently, so
// their feet do not all land on the same source row. Runtime resolves each grounded
// pose back to the world floor at Y=714 instead of forcing one incorrect row.
const BANDIT_FRAME_BASELINES={
  bIdle:[620,620,620,620,620,620],
  bRun:[620,620,620,620,620,620],
  bBack:[620,620,620,620,620,620],
  bDash:[620,620,620,620,620,620],
  bCrouch:[620,620,620,620,620,620],
  bCrouchShoot:[620,620,620,620,620,620],
  bAtk1:[620,620,620,620,620,620], bAtk2:[620,620,620,620,620,620], bAtk3:[620,620,620,620,620,620],
  bGuard:[620,620,620,620,620,620], bDashParry:[620,620,620,620,620,620], bShotgun:[620,620,620,620,620,620], bJump:[620,620,620,620,620,620]
};
function banditSourceBaseline(key,frame){
  const a=BANDIT_FRAME_BASELINES[key];
  return a ? a[Math.max(0,Math.min(a.length-1,frame))] : 640;
}
// New-model-only IFP runtime.  Unauthored actions deliberately proxy to an
// existing new-model IFP instead of flashing back to the retired v0.24 atlas.
const BANDIT_ANIMS={
  melee_idle:{key:'bIdle',frames:6,ms:135,loop:true},
  melee_run:{key:'bRun',frames:6,ms:82,loop:true},
  melee_backwalk:{key:'bBack',frames:6,ms:105,loop:true},
  melee_jump:{key:'bJump',frames:6,ms:92,loop:false},
  melee_dash:{key:'bDash',frames:6,ms:55,loop:false},
  melee_crouch:{key:'bCrouch',frames:6,ms:150,loop:true},
  melee_crouch_shoot:{key:'bCrouchShoot',frames:6,ms:72,loop:false},
  melee_attack_1:{key:'bAtk1',frames:6,ms:65,loop:false},
  melee_attack_2:{key:'bAtk2',frames:6,ms:62,loop:false},
  melee_attack_3:{key:'bAtk3',frames:6,ms:68,loop:false},
  melee_shotgun:{key:'bShotgun',frames:6,ms:72,loop:false},
  melee_guard:{key:'bGuard',frames:6,ms:90,loop:false},
  melee_dash_parry:{key:'bDashParry',frames:6,ms:58,loop:false}
};
function setBanditActionFor(p,state){
  const a=BANDIT_ANIMS[state]; if(!a)return;
  p.animAction=state;
  p.animStart=performance.now();
  p.animUntil=p.animStart+a.ms*a.frames;
}
function setBanditAction(state){ setBanditActionFor(player,state); }
function banditStateFor(p,crouching=false){
  const t=performance.now();
  if(p.animAction && t<p.animUntil) return p.animAction;
  if(p.animAction && t>=p.animUntil) p.animAction=null;
  if(p.guard) return 'melee_guard';
  if(p.sitting || crouching) return 'melee_crouch';
  if(p.dashT>0) return 'melee_dash';
  if(!p.onGround) return 'melee_jump';
  if(p.vx<-24) return 'melee_backwalk';
  if(p.vx>24) return 'melee_run';
  return 'melee_idle';
}
function banditState(){ return banditStateFor(player,isCrouching()); }
function banditFrameFor(p,state){
  const a=BANDIT_ANIMS[state]||BANDIT_ANIMS.melee_idle;
  if(Number.isInteger(a.fixedFrame)) return {key:a.key,frame:a.fixedFrame};
  if(state==='melee_jump'){
    const f=p.vy<-220?1:(p.vy<120?3:5);
    return {key:a.key,frame:f};
  }
  const start=(p.animAction===state?p.animStart:0);
  const elapsed=start?Math.max(0,performance.now()-start):performance.now();
  let frame=Math.floor(elapsed/a.ms);
  frame=a.loop?frame%a.frames:Math.min(a.frames-1,frame);
  return {key:a.key,frame};
}
function banditFrame(state){ return banditFrameFor(player,state); }

const menuEl=document.getElementById('mainMenu');
const continueBtn=document.getElementById('continueGame');
const newGameBtn=document.getElementById('newGame');
const backMenuBtn=document.getElementById('backMenu');
const onlineLobby=document.getElementById('onlineLobby');
const openOnlineBtn=document.getElementById('openOnline');
const hostRoomBtn=document.getElementById('hostRoom');
const joinRoomBtn=document.getElementById('joinRoom');
const roomCodeInput=document.getElementById('roomCodeInput');
const roomStatus=document.getElementById('roomStatus');
const roomCodeDisplay=document.getElementById('roomCodeDisplay');
const startOnlineBtn=document.getElementById('startOnline');
const closeOnlineBtn=document.getElementById('closeOnline');
const netBadge=document.getElementById('netBadge');
const touchControls=document.getElementById('touchControls');
let gameActive=false;
const touchHeld=new Set(),touchPressed=new Set();
for(const btn of document.querySelectorAll('[data-touch]')){
  const a=btn.dataset.touch;
  const press=e=>{e.preventDefault();if(!touchHeld.has(a))touchPressed.add(a);touchHeld.add(a);btn.classList.add('active');};
  const release=e=>{e.preventDefault();touchHeld.delete(a);btn.classList.remove('active');};
  btn.addEventListener('pointerdown',press);btn.addEventListener('pointerup',release);btn.addEventListener('pointercancel',release);btn.addEventListener('pointerleave',release);
}
const net={ws:null,role:null,code:null,peer:false,seq:0,lastSnapshot:0,lastInput:null,remoteNow:{},remotePressed:new Set(),remotePrev:{},connected:false};
function netSetStatus(msg){if(roomStatus)roomStatus.textContent=msg;if(netBadge){netBadge.textContent=net.connected?`ONLINE · ${net.role?.toUpperCase()||''} · ${net.code||''}`:'';netBadge.classList.toggle('visible',!!net.connected);}}
function wsUrl(){return `${location.protocol==='https:'?'wss':'ws'}://${location.host}`;}
function sendNet(m){if(net.ws&&net.ws.readyState===WebSocket.OPEN)net.ws.send(JSON.stringify(m));}
function connectNet(){return new Promise((resolve,reject)=>{if(net.ws&&net.ws.readyState===WebSocket.OPEN)return resolve(net.ws);const ws=new WebSocket(wsUrl());net.ws=ws;ws.onopen=()=>{net.connected=true;resolve(ws);};ws.onerror=()=>reject(new Error('Connection failed'));ws.onclose=()=>{net.connected=false;net.peer=false;netSetStatus('Disconnected');};ws.onmessage=e=>handleNetMessage(JSON.parse(e.data));});}
function handleNetMessage(m){
  if(m.type==='created'){net.role='host';net.code=m.code;roomCodeDisplay.textContent=m.code;netSetStatus('Room created — waiting for Player 2');startOnlineBtn.disabled=true;}
  else if(m.type==='joined'){net.role='guest';net.code=m.code;roomCodeDisplay.textContent=m.code;netSetStatus('Joined — waiting for host to start');startOnlineBtn.disabled=true;}
  else if(m.type==='peer_joined'){net.peer=true;netSetStatus('Player 2 connected — ready');if(net.role==='host')startOnlineBtn.disabled=false;}
  else if(m.type==='peer_left'){net.peer=false;netSetStatus(m.reason||'Other player disconnected');if(startOnlineBtn)startOnlineBtn.disabled=true;}
  else if(m.type==='error'){netSetStatus(m.message||'Network error');}
  else if(m.type==='input'&&net.role==='host'){const input=m.input||{};const hit=new Set();for(const [k,v] of Object.entries(input))if(v&&!net.remotePrev[k])hit.add(k);net.remotePressed=hit;net.remotePrev={...input};net.remoteNow=input;}
  else if(m.type==='snapshot'&&net.role==='guest'){applyNetworkSnapshot(m.state);net.lastSnapshot=performance.now();}
  else if(m.type==='start'&&net.role==='guest'){newGame();player2.enabled=true;if(onlineLobby)onlineLobby.classList.remove('visible');enterGame();netSetStatus('Connected to host');}
}
function openOnlineLobby(){if(menuEl)menuEl.classList.remove('visible');if(onlineLobby)onlineLobby.classList.add('visible');roomCodeDisplay.textContent='';netSetStatus('Not connected');}
function closeOnlineLobby(){if(onlineLobby)onlineLobby.classList.remove('visible');if(menuEl)menuEl.classList.add('visible');}
function remoteHeld(a){return !!net.remoteNow[a];}function remoteTap(a){return net.remotePressed.has(a);}
function p2Held(a){if(net.role==='host'&&net.connected)return remoteHeld(a);const map={left:'KeyJ',right:'KeyL',crouch:'KeyK',guard:'KeyR'};return map[a]?down(map[a]):false;}
function p2Tap(a){if(net.role==='host'&&net.connected)return remoteTap(a);const map={jump:'KeyI',dash:'KeyP',stance:'KeyH',flask:'KeyY',attack:'KeyU',shotgun:'KeyO',interact:'KeyN'};if(map[a]&&tap(map[a]))return true;if(a==='attack')return meleeTrigger(1);if(a==='shotgun')return shotgunTrigger(1);if(a==='ranged')return rangedTrigger(1);return false;}
function localOnlineInput(){pollGamepads();return {left:keys.has('ArrowLeft')||padHeld(0,'left')||touchHeld.has('left'),right:keys.has('ArrowRight')||padHeld(0,'right')||touchHeld.has('right'),crouch:keys.has('ArrowDown')||padHeld(0,'b6'),guard:keys.has('KeyQ')||padHeld(0,'b4'),jump:pressed.has('ArrowUp')||padTap(0,'b0')||touchPressed.has('jump'),dash:pressed.has('KeyZ')||padTap(0,'b1')||touchPressed.has('dash'),stance:pressed.has('KeyV')||padTap(0,'b5'),flask:pressed.has('KeyA')||padTap(0,'b12')||touchPressed.has('flask'),attack:pressed.has('KeyC')||padTap(0,'b2')||touchPressed.has('attack'),shotgun:pressed.has('KeyX')||padTap(0,'b3')||touchPressed.has('shotgun'),ranged:padTap(0,'b7'),interact:pressed.has('KeyS')||padTap(0,'b13')||touchPressed.has('interact')};}
function sendGuestInput(){if(net.role!=='guest'||!gameActive)return;sendNet({type:'input',seq:++net.seq,input:localOnlineInput()});}
function cloneNet(o){return JSON.parse(JSON.stringify(o));}
function packPlayer(p){const q=cloneNet(p);const t=performance.now();q._animAge=p.animStart?Math.max(0,t-p.animStart):0;q._animLeft=p.animUntil?Math.max(0,p.animUntil-t):0;return q;}
function makeNetworkSnapshot(){const r=rooms[roomIndex];return {roomIndex,player:packPlayer(player),player2:packPlayer(player2),enemies:cloneNet(r.enemies),boss:cloneNet(r.boss),harlequin:cloneNet(harlequin),astalor:cloneNet(astalor),bullets:cloneNet(bullets),projectiles:cloneNet(projectiles),gameWon,victoryT,message,messageT,roomFade};}
function applyPackedPlayer(target,src){if(!src)return;const age=src._animAge||0,left=src._animLeft||0;delete src._animAge;delete src._animLeft;Object.assign(target,src);if(target.animAction){const t=performance.now();target.animStart=t-age;target.animUntil=t+left;}}
function applyNetworkSnapshot(st){if(!st)return;roomIndex=clamp(st.roomIndex||0,0,rooms.length-1);applyPackedPlayer(player,st.player);applyPackedPlayer(player2,st.player2);player2.enabled=true;rooms[roomIndex].enemies=st.enemies||[];rooms[roomIndex].boss=st.boss||null;Object.assign(harlequin,st.harlequin||{});Object.assign(astalor,st.astalor||{});bullets=st.bullets||[];projectiles=st.projectiles||[];gameWon=!!st.gameWon;victoryT=st.victoryT||0;message=st.message||'';messageT=st.messageT||0;roomFade=st.roomFade||0;}
function hostBroadcastSnapshot(){if(net.role==='host'&&net.peer&&gameActive){const t=performance.now();if(t-net.lastSnapshot>=50){net.lastSnapshot=t;sendNet({type:'snapshot',seq:++net.seq,state:makeNetworkSnapshot()});}}}


const keys=new Set(), pressed=new Set();
addEventListener('keydown',e=>{ if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyC','KeyX','KeyZ','KeyV','KeyS','KeyA','KeyJ','KeyL','KeyI','KeyK','KeyP','KeyU','KeyO','KeyH','KeyY','KeyN','KeyQ','KeyR'].includes(e.code)) e.preventDefault(); if(!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); });
addEventListener('keyup',e=>keys.delete(e.code));
// Unified local co-op input layer. Standard Gamepad API layout:
// 0 A/Cross jump, 1 B/Circle dash, 2 X/Square attack, 3 Y/Triangle shotgun,
// 4 LB/L1 guard, 5 RB/R1 stance, 6 LT/L2 crouch, 7 RT/R2 ranged fire,
// 12/13/14/15 D-pad up/down/left/right. One pad defaults to P2; two pads map P1/P2.
let padNow=[null,null], padPressed=[new Set(),new Set()], padPrev=[{},{}], padLabels=['KEYBOARD','KEYBOARD II'];
function padButton(gp,i){return !!gp?.buttons?.[i] && (gp.buttons[i].pressed || gp.buttons[i].value>.45);}
function snapshotPad(gp){const o={};for(let i=0;i<16;i++)o['b'+i]=padButton(gp,i);const ax=gp?.axes?.[0]||0;o.left=ax<-.28||o.b14;o.right=ax>.28||o.b15;return o;}
function pollGamepads(){
  const pads=(navigator.getGamepads?navigator.getGamepads():[]);const connected=[];for(const gp of pads)if(gp&&gp.connected)connected.push(gp);
  const assigned=connected.length>=2?[connected[0],connected[1]]:[null,connected[0]||null];
  for(let slot=0;slot<2;slot++){
    const snap=snapshotPad(assigned[slot]);const prev=padPrev[slot]||{};const hit=new Set();
    for(const [k,v] of Object.entries(snap))if(v&&!prev[k])hit.add(k);
    padNow[slot]=assigned[slot]?snap:null;padPressed[slot]=hit;padPrev[slot]=snap;
  }
  padLabels[0]=assigned[0]?`CONTROLLER ${assigned[0].index+1}`:'KEYBOARD';
  padLabels[1]=assigned[1]?`CONTROLLER ${assigned[1].index+1}`:'KEYBOARD II';
}
function padHeld(slot,key){return !!padNow[slot]?.[key];}
function padTap(slot,key){return !!padPressed[slot]?.has(key);}
function down(k){
  if(keys.has(k))return true;
  if((k==='ArrowLeft'&&touchHeld.has('left'))||(k==='ArrowRight'&&touchHeld.has('right'))||(k==='ArrowDown'&&touchHeld.has('crouch')))return true;
  const p1={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'b6',KeyQ:'b4'};
  const p2={KeyJ:'left',KeyL:'right',KeyK:'b6',KeyR:'b4'};
  if(p1[k])return padHeld(0,p1[k]);if(p2[k])return padHeld(1,p2[k]);return false;
}
function tap(k){
  if(pressed.has(k))return true;
  const tm={ArrowUp:'jump',KeyZ:'dash',KeyC:'attack',KeyX:'shotgun',KeyS:'interact',KeyA:'flask'};if(tm[k]&&touchPressed.has(tm[k]))return true;
  const p1={ArrowUp:'b0',KeyZ:'b1',KeyV:'b5',KeyA:'b12',KeyS:'b13'};
  const p2={KeyI:'b0',KeyP:'b1',KeyH:'b5',KeyY:'b12',KeyN:'b13'};
  if(p1[k])return padTap(0,p1[k]);if(p2[k])return padTap(1,p2[k]);return false;
}
function meleeTrigger(slot){return padTap(slot,'b2');}
function shotgunTrigger(slot){return padTap(slot,'b3');}
function rangedTrigger(slot){return padTap(slot,'b7');}
function isCrouching(){return !player.sitting&&player.onGround&&down('ArrowDown');}

const PUPPET_ANIMS={
  lower:{
    idle:{key:'pLowerIdle',frames:6,ms:165,cellW:362,cellH:724,baseline:660},
    walk:{key:'pLowerWalk',frames:6,ms:105,cellW:362,cellH:724,baseline:660},
    attack1:{key:'pLowerAtk1',frames:6,ms:85,cellW:362,cellH:724,baseline:660},
    attack2:{key:'pLowerAtk2',frames:6,ms:90,cellW:362,cellH:724,baseline:660}
  },
  claw:{
    idle:{key:'pClawIdle',frames:6,ms:155,cellW:362,cellH:724,baseline:660},
    walk:{key:'pClawWalk',frames:6,ms:100,cellW:640,cellH:724,baselines:[666,662,687,693,673,663]},
    attack1:{key:'pClawAtk1',frames:6,ms:82,cellW:640,cellH:724,baseline:660},
    attack2:{key:'pClawAtk2',frames:6,ms:86,cellW:640,cellH:724,baseline:660}
  },
  courtier:{
    idle:{key:'pCourtIdle',frames:6,ms:150,cellW:362,cellH:724,baseline:660},
    walk:{key:'pCourtWalk',frames:6,ms:96,cellW:362,cellH:724,baseline:660},
    attack1:{key:'pCourtAtk1',frames:6,ms:78,cellW:362,cellH:724,baseline:660},
    attack2:{key:'pCourtAtk2',frames:6,ms:84,cellW:362,cellH:724,baseline:660}
  }
};
const PUPPET_DRAW_SCALE={lower:.295,claw:.285,courtier:.31};
function puppetSourceBaseline(def,frame){return def.baselines?def.baselines[frame]:(def.baseline||660);}

const rooms=[
 {id:2,name:'THE SUNKEN PLAZA',bg:'room2',statueX:420,symbolX:null,elevatorX:null,enemies:[],boss:null},
 {id:3,name:'THE HIVE NAVE',bg:'room3',statueX:null,symbolX:null,elevatorX:null,enemies:[],boss:null},
 {id:4,name:'SANCTUARY OF THE PILGRIM',bg:'room4',statueX:410,symbolX:1050,elevatorX:null,enemies:[],boss:null},
 {id:5,name:'THE DESCENT',bg:'elevator',statueX:null,symbolX:null,elevatorX:900,enemies:[],boss:null},
 {id:6,name:'BRIDGE COURTYARD I',bg:'courtyard1',statueX:null,symbolX:null,elevatorX:null,enemies:[],boss:null},
 {id:7,name:'BRIDGE COURTYARD II',bg:'courtyard2',statueX:null,symbolX:null,elevatorX:null,enemies:[],boss:null},
 {id:8,name:'THE LAST SPAN',bg:'bridgeEnd',statueX:null,symbolX:null,elevatorX:null,enemies:[],boss:null,dropX:1335,dropTarget:7},
 {id:9,name:'COURTYARD OF THE DAMNED',bg:'courtyardDamned',statueX:1370,symbolX:null,elevatorX:null,enemies:[],boss:null,arrivalFromDrop:true},
 {id:10,name:'THE UNCHAINED DANCE',bg:'hRoomNormal',statueX:null,symbolX:null,elevatorX:null,enemies:[],boss:null,harlequinRoom:true},
 {id:11,name:'GATE OF THE CRIMSON KEEP',bg:'castleGate',statueX:330,symbolX:null,elevatorX:null,gateX:1410,enemies:[],boss:null},
 {id:12,name:'HALL OF THE CRIMSON COURT',bg:'castleHall',statueX:null,symbolX:null,elevatorX:null,enemies:[],boss:null},
 {id:13,name:'GALLERY OF THE ECLIPSE',bg:'castleGallery',statueX:null,symbolX:null,elevatorX:null,enemies:[],boss:null},
 {id:14,name:'THRONE APPROACH',bg:'castleApproach',statueX:330,symbolX:1160,elevatorX:null,enemies:[],boss:null},
 {id:15,name:'THRONE OF THE CRIMSON MOON',bg:'castleThrone',statueX:null,symbolX:null,elevatorX:null,enemies:[],boss:null,finalRoom:true,throneX:1270}
];

const player={x:190,y:PLAYER_GROUND_Y,w:88,h:152,vx:0,vy:0,facing:1,onGround:true,jumps:0,health:100,maxHealth:100,stamina:100,maxStamina:100,
 stance:'melee',attackCd:0,shotgunCd:0,xCd:0,vCd:0,dashCd:0,dashT:0,invuln:0,combo:0,comboT:0,shootSlow:0,slowT:0,
 checkpoint:{room:0,x:210},sitting:false,guard:false,healStart:0,healFrom:100,staminaFrom:100,restDone:false,dead:false,deathT:0,flash:0,animAction:null,animStart:0,animUntil:0,blood:0,flasks:0};
const player2={x:315,y:PLAYER_GROUND_Y,w:88,h:152,vx:0,vy:0,facing:1,onGround:true,jumps:0,health:100,maxHealth:100,stamina:100,maxStamina:100,
 stance:'melee',attackCd:0,shotgunCd:0,xCd:0,vCd:0,dashCd:0,dashT:0,invuln:0,combo:0,comboT:0,shootSlow:0,slowT:0,sitting:false,guard:false,dead:false,deathT:0,flash:0,animAction:null,animStart:0,animUntil:0,enabled:true,palette:'burgundy'};
let roomIndex=0, roomFade=0, message='', messageT=0, shake=0, saveFxT=0;
let bullets=[], particles=[], projectiles=[], floaters=[];
const astalor={room:null,mode:'hidden',spawnStart:0,idleStart:0,hairStart:0,lastHair:0,shopOpen:false};
const HARLEQUIN_ROOM=8, CASTLE_GATE_ROOM=9, FINAL_ROOM=13;
const harlequin={x:1080,y:FLOOR,hp:scaledEnemyHp(540),maxHp:scaledEnemyHp(540),active:false,awakenT:0,defeated:false,state:'dormant',dir:-1,moveT:0,stopT:0,moonCd:1.4,moonBlowT:0,moonShotT:-1,moonPattern:0,transition:0,flash:0,hurtCd:0,rewarded:false};
let gameWon=false, victoryT=0;
function resetHarlequin(){Object.assign(harlequin,{x:1080,y:FLOOR,hp:scaledEnemyHp(540),maxHp:scaledEnemyHp(540),active:false,awakenT:0,defeated:false,state:'dormant',dir:-1,moveT:1.25,stopT:0,moonCd:1.4,moonBlowT:0,moonShotT:-1,moonPattern:0,transition:0,flash:0,hurtCd:0,rewarded:false});}
resetHarlequin();

function resetRoomState(i){
  const r=rooms[i]; r.enemies=[]; r.boss=null;
  if(i===0){
    r.enemies=[makeSpider(930),makeSpider(1240),makeSpider(1470)];
  } else if(i===1){
    r.enemies=[makeSpider(520),makeSpider(760),makeSpider(1020)];
    {const hp=scaledEnemyHp(650);r.boss={x:1450,y:FLOOR,hp,maxHp:hp,attackCd:1.2,webCd:1.0,alive:true,flash:0,phase:0,rewarded:false};}
  } else if(i===4){
    // Bridge Courtyard I: one lower-rank puppet.
    r.enemies=[makePuppet(1040,'lower')];
  } else if(i===5){
    // Bridge Courtyard II: two lower-rank puppets plus the claw puppet.
    r.enemies=[makePuppet(610,'lower'),makePuppet(1050,'lower'),makePuppet(1420,'claw')];
  } else if(i===10){
    r.enemies=[makePuppet(520,'courtier'),makePuppet(980,'courtier'),makePuppet(1390,'courtier')];
  } else if(i===11){
    r.enemies=[makePuppet(470,'courtier'),makePuppet(930,'claw'),makePuppet(1370,'courtier')];
  } else if(i===12){
    r.enemies=[makePuppet(610,'claw'),makePuppet(1110,'courtier'),makePuppet(1420,'claw')];
  } else if(i===13){
    {const hp=scaledEnemyHp(980);r.boss={kind:'lord',x:1270,y:FLOOR,hp,maxHp:hp,attackCd:1.1,moonCd:1.6,dashCd:2.8,dashT:0,vx:0,alive:true,flash:0,phase:1,rewarded:false,engaged:false,intro:'seated',introT:0,attackPose:'idle',attackPoseT:0,attackAnimStart:0};}
  }
}
rooms.forEach((_,i)=>resetRoomState(i));
function makeSpider(x){const hp=scaledEnemyHp(70);return {x,y:FLOOR,vx:0,hp,maxHp:hp,attackCd:Math.random()*1.2,alive:true,flash:0,kind:'small',enemyType:'spider',rewarded:false,attackFx:0};}
function makePuppet(x,type='lower'){
  const claw=type==='claw', courtier=type==='courtier';
  const hp=scaledEnemyHp(claw?135:(courtier?118:82));
  return {
    x,y:FLOOR,vx:0,hp,maxHp:hp,
    attackCd:.45+Math.random()*.8,alive:true,flash:0,kind:'small',enemyType:type,rewarded:false,attackFx:0,
    anim:'idle',animStart:performance.now(),attackKind:1
  };
}

function setMessage(t,d=1.6){message=t;messageT=d;}

function awardBlood(amount,x,y){
  player.blood+=amount;
  floaters.push({x,y:y-65,life:1.25,max:1.25,text:`+${amount} BLOOD`});
}

function drinkFlask(){
  if(player.flasks<=0){setMessage('NO BLOOD FLASKS',.8);return;}
  if(player.health>=player.maxHealth){setMessage('HEALTH FULL',.7);return;}
  player.flasks--;
  const heal=Math.ceil(player.maxHealth*FLASK_HEAL_FRACTION);
  player.health=clamp(player.health+heal,0,player.maxHealth);
  burst(player.x,player.y-70,'#bb1730',18);
  setMessage('BLOOD FLASK  +40% HP',.9);
}

function buyBloodFlask(){
  if(player.blood<FLASK_COST){setMessage('NOT ENOUGH BLOOD',.9);return;}
  player.blood-=FLASK_COST;
  player.flasks++;
  setMessage('BLOOD FLASK PURCHASED',.9);
}

function saveGame(){
  const data={
    version:'1.2.0',
    roomIndex,
    checkpoint:{room:roomIndex,x:player.checkpoint.x},
    blood:player.blood,
    flasks:player.flasks,
    astalorRoom:astalor.room,
    harlequinDefeated:harlequin.defeated
  };
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));}catch(_){}
  saveFxT=1.05;
  refreshContinueButton();
  setMessage('GAME SAVED',1.0);
}

function readSaveData(){
  const keys=[SAVE_KEY,...LEGACY_SAVE_KEYS];
  for(const key of keys){
    try{const data=JSON.parse(localStorage.getItem(key)||'null');if(data&&Number.isInteger(data.roomIndex))return data;}catch(_){}
  }
  return null;
}
function hasSaveGame(){return !!readSaveData();}

function refreshContinueButton(){
  if(!continueBtn)return;
  const ok=hasSaveGame();
  continueBtn.disabled=!ok;
  continueBtn.textContent=ok?'CONTINUE':'NO SAVE FOUND';
}

function resetRuntimeState(){
  bullets=[];particles=[];projectiles=[];floaters=[];gameWon=false;victoryT=0;
  astalor.shopOpen=false;
  player.dead=false;player.deathT=0;player.sitting=false;player.restDone=false;
  player.vx=0;player.vy=0;player.onGround=true;player.jumps=0;player.facing=1;
  player.attackCd=0;player.shotgunCd=0;player.xCd=0;player.vCd=0;player.dashCd=0;player.dashT=0;
  player.invuln=0;player.combo=0;player.comboT=0;player.shootSlow=0;player.slowT=0;
  player.animAction=null;player.animStart=0;player.animUntil=0;
  player2.dead=false;player2.deathT=0;player2.vx=0;player2.vy=0;player2.onGround=true;player2.jumps=0;player2.facing=1;player2.health=player2.maxHealth;player2.stamina=player2.maxStamina;player2.stance='melee';player2.attackCd=0;player2.shotgunCd=0;player2.xCd=0;player2.vCd=0;player2.dashCd=0;player2.dashT=0;player2.invuln=0;player2.combo=0;player2.comboT=0;player2.shootSlow=0;player2.slowT=0;player2.animAction=null;player2.animStart=0;player2.animUntil=0;
}

function loadGame(){
  const data=readSaveData();
  if(!data)return false;

  rooms.forEach((_,i)=>resetRoomState(i));
  resetRuntimeState();

  let loadedRoom=Number(data.roomIndex)||0;
  // v0.25.0 had no elevator room: its Courtyard I/II lived at indices 3/4.
  if(data.version==='0.25.0' && loadedRoom>=3) loadedRoom+=1;
  roomIndex=clamp(loadedRoom,0,rooms.length-1);
  resetHarlequin();
  if(data.harlequinDefeated||roomIndex>HARLEQUIN_ROOM){harlequin.defeated=true;harlequin.active=false;harlequin.transition=0;}
  player.checkpoint={room:roomIndex,x:clamp(Number(data.checkpoint?.x)||210,40,W-40)};
  player.x=player.checkpoint.x;
  player.y=FLOOR;player2.x=clamp(player.x+125,40,W-40);player2.y=FLOOR;player2.vx=player2.vy=0;player2.onGround=true;player2.jumps=0;
  player.health=player.maxHealth;
  player.stamina=player.maxStamina;player2.health=player2.maxHealth;player2.stamina=player2.maxStamina;player2.dead=false;player2.stance='melee';
  player.blood=Math.max(0,Number(data.blood)||0);
  player.flasks=Math.max(0,Math.floor(Number(data.flasks)||0));
  player.stance='melee';

  astalor.room=null;astalor.mode='hidden';astalor.spawnStart=0;astalor.idleStart=0;astalor.hairStart=0;astalor.lastHair=0;
  if(Number.isInteger(data.astalorRoom)&&data.astalorRoom>=0&&data.astalorRoom<rooms.length){
    astalor.room=data.astalorRoom;
    astalor.mode='idle';
    astalor.idleStart=now();
    astalor.lastHair=now();
  }

  roomFade=.6;
  return true;
}

function newGame(){
  try{localStorage.removeItem(SAVE_KEY);for(const k of LEGACY_SAVE_KEYS)localStorage.removeItem(k);}catch(_){}
  rooms.forEach((_,i)=>resetRoomState(i));
  resetRuntimeState();
  resetHarlequin();

  roomIndex=0;
  player.x=190;player.y=FLOOR;player2.x=315;player2.y=FLOOR;player2.vx=player2.vy=0;player2.onGround=true;player2.jumps=0;
  player.health=player.maxHealth;player.stamina=player.maxStamina;player2.health=player2.maxHealth;player2.stamina=player2.maxStamina;player2.dead=false;player2.stance='melee';
  player.blood=0;player.flasks=0;player.stance='melee';
  player.checkpoint={room:0,x:210};

  astalor.room=null;astalor.mode='hidden';astalor.spawnStart=0;astalor.idleStart=0;astalor.hairStart=0;astalor.lastHair=0;astalor.shopOpen=false;
  roomFade=.6;
  refreshContinueButton();
}

function showMainMenu(){
  gameActive=false;
  keys.clear();pressed.clear();
  astalor.shopOpen=false;
  if(menuEl)menuEl.classList.add('visible');
  if(backMenuBtn)backMenuBtn.classList.remove('visible');if(touchControls)touchControls.classList.remove('game-visible');
  refreshContinueButton();
}

function enterGame(){
  gameActive=true;
  if(menuEl)menuEl.classList.remove('visible');
  if(backMenuBtn)backMenuBtn.classList.add('visible');if(touchControls)touchControls.classList.add('game-visible');
  last=performance.now();
}


function activeBandits(){return player2.enabled?[player,player2]:[player];}
function nearestBandit(x){const living=activeBandits().filter(p=>!p.dead);return living.sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]||player;}
function damageBandit(p,n,knock=0){
  if(!p||p.invuln>0||p.dead)return;
  if(p.guard&&p.stamina>0){const cost=Math.min(p.stamina,Math.max(10,n*.65));p.stamina-=cost;n*=.42;knock*=.35;setBanditActionFor(p,'melee_guard');}
  p.health=clamp(p.health-n,0,p.maxHealth);p.invuln=.55;p.flash=.18;shake=.18;
  if(knock)p.vx=knock;
  if(p.health<=0){p.dead=true;p.deathT=3.0;setMessage(p===player2?'BANDIT II FALLEN':'BANDIT FALLEN',1.1);}
}
function damagePlayer(n,knock=0){damageBandit(player,n,knock);}
function respawn(){
  roomIndex=player.checkpoint.room; player.x=player.checkpoint.x; player.y=FLOOR; player.vx=player.vy=0; player.health=player.maxHealth; player.stamina=player.maxStamina;
  player.dead=false; player.invuln=1; player.sitting=false; player.animAction=null; player.animStart=player.animUntil=0; player2.x=clamp(player.x+125,40,W-40);player2.y=FLOOR;player2.vx=player2.vy=0;player2.health=player2.maxHealth;player2.stamina=player2.maxStamina;player2.dead=false;player2.invuln=1;player2.animAction=null;player2.animStart=player2.animUntil=0; astalor.shopOpen=false; bullets=[]; projectiles=[]; resetRoomState(roomIndex); if(roomIndex<=7)resetHarlequin(); if(roomIndex===12)resetRoomState(FINAL_ROOM); roomFade=.8;
}

function hitEnemy(e,damage,kb,sourceX){
  if(!e.alive)return;
  e.hp-=damage; e.flash=.12; if(e.kind==='small' && kb) e.vx += Math.sign(e.x-sourceX)*kb;
  if(e.hp<=0){ e.alive=false; burst(e.x,FLOOR-45,'#b20d24',18); if(!e.rewarded){e.rewarded=true;awardBlood(10,e.x,FLOOR-70);} }
}
function bossDamage(b,damage,hitX){
  if(!b||!b.alive)return;
  if(b.kind==='lord'&&!b.engaged)return;
  let dealt=damage;
  if(b.kind!=='lord'){
    const coreDist=Math.abs(hitX-b.x); dealt=coreDist<90?damage:damage*.22;
  }
  b.hp-=dealt; b.flash=.12;
  if(b.hp<=0){
    b.hp=0;b.alive=false;burst(b.x,FLOOR-120,'#c1122f',52);
    if(!b.rewarded){b.rewarded=true;awardBlood(50,b.x,FLOOR-180);}
    if(b.kind==='lord'){
      setMessage('LORD OF THE CRIMSON MOON DEFEATED',2.8); victoryT=2.0;
    }else setMessage('HIVE MATRIARCH DEFEATED  ·  +50 BLOOD',2.5);
  }
}
function harlequinDamage(damage,hitX,source='melee',attacker=player){
  if(roomIndex!==HARLEQUIN_ROOM||!harlequin.active||harlequin.defeated)return;
  let dealt=damage;
  if(source==='melee'&&attacker.onGround){dealt*=.18;if(harlequin.hurtCd<=0){harlequin.hurtCd=.68;damageBandit(attacker,16,Math.sign(attacker.x-harlequin.x)*150);}setMessage('THE DANCE BURNS THE FLOOR',.55);}
  if(source!=='melee')dealt*=.28;
  harlequin.hp-=dealt;harlequin.flash=.13;
  if(harlequin.hp<=0){
    harlequin.hp=0;harlequin.active=false;harlequin.defeated=true;harlequin.state='idle';
    projectiles=projectiles.filter(p=>p.kind!=='star');burst(harlequin.x,FLOOR-170,'#d3a531',55);
    if(!harlequin.rewarded){harlequin.rewarded=true;awardBlood(50,harlequin.x,FLOOR-180);}
    setMessage('UNCHAINED HARLEQUIN DEFEATED  ·  +50 BLOOD',2.7);
  }
}

function meleeAttack(){
  player.combo = (player.comboT>0)?(player.combo%3)+1:1; player.comboT=.7; player.attackCd=.24; setBanditAction(`melee_attack_${player.combo}`);
  const range=105 + player.combo*9, dmg=[0,26,31,40][player.combo];
  const hx=player.x+player.facing*70;
  const r=rooms[roomIndex];
  r.enemies.forEach(e=>{if(e.alive&&Math.abs(e.x-hx)<range&&Math.abs((e.y-40)-(player.y-70))<100)hitEnemy(e,dmg,70,player.x);});
  if(r.boss&&r.boss.alive&&Math.abs(r.boss.x-hx)<230)bossDamage(r.boss,dmg,hx);
  if(roomIndex===HARLEQUIN_ROOM&&harlequin.active&&!harlequin.defeated&&Math.abs(harlequin.x-hx)<150)harlequinDamage(dmg,hx,'melee');
  slashFX(player.x+player.facing*65,player.y-85,player.facing,player.combo);
}
function fireRevolver(){
  const crouch=isCrouching();
  player.attackCd=.32; player.shootSlow=.22; setBanditAction(crouch?'melee_crouch_shoot':'melee_shotgun');
  const sy=player.y-(crouch?54:92);
  bullets.push({x:player.x+player.facing*50,y:sy,vx:player.facing*1350,life:.9,damage:18,kb:190,type:'revolver'});
  muzzle(player.x+player.facing*55,sy);
}
function fireShotgun(){
  const crouch=isCrouching();
  player.shotgunCd=5; player.shootSlow=.35; setBanditAction(crouch?'melee_crouch_shoot':'melee_shotgun');
  const r=rooms[roomIndex]; const maxRange=560;
  r.enemies.forEach(e=>{const dx=(e.x-player.x)*player.facing;if(e.alive&&dx>0&&dx<maxRange&&Math.abs((e.y-45)-(player.y-85))<95)hitEnemy(e,48,430,player.x);});
  if(r.boss&&r.boss.alive){const dx=(r.boss.x-player.x)*player.facing;if(dx>0&&dx<maxRange+90)bossDamage(r.boss,42,player.x+player.facing*Math.min(dx,260));}
  if(roomIndex===HARLEQUIN_ROOM&&harlequin.active&&!harlequin.defeated){const dx=(harlequin.x-player.x)*player.facing;if(dx>0&&dx<maxRange)harlequinDamage(42,player.x+player.facing*Math.min(dx,260),'shotgun');}
  const sy=player.y-(crouch?54:88);
  for(let i=0;i<14;i++)particles.push({x:player.x+player.facing*55,y:sy,vx:player.facing*(650+Math.random()*400),vy:(Math.random()-.5)*220,life:.18+Math.random()*.18,max:.36,c:'#dfb078'});
  shake=.13;
}
function rangedBackdash(){
  player.xCd=5; player.invuln=.45; player.vx=-player.facing*820; player.vy=-80; setBanditAction('melee_dash');
  const r=rooms[roomIndex];
  r.enemies.forEach(e=>{if(e.alive&&Math.abs(e.x-player.x)<150)hitEnemy(e,30,520,player.x);});
  if(r.boss&&r.boss.alive&&Math.abs(r.boss.x-player.x)<180)bossDamage(r.boss,24,player.x);
  burst(player.x,player.y-55,'#ce2d28',28); shake=.16;
}
function dash(){ if(player.stamina<22||player.dashCd>0)return; const inputDir=(down('ArrowLeft')&&!down('ArrowRight'))?-1:((down('ArrowRight')&&!down('ArrowLeft'))?1:0); const dir=inputDir||Math.sign(player.vx)||player.facing||1; player.stamina-=22; player.dashT=.16; player.invuln=.22; player.dashCd=.38; player.vx=dir*1020; setBanditAction('melee_dash'); burst(player.x,player.y-55,'#65202a',10); }
function toggleStance(){ if(player.vCd>0)return; player.stance=player.stance==='melee'?'ranged':'melee'; player.vCd=6; burst(player.x,player.y-78,'#47d56e',22); setMessage(player.stance==='ranged'?'RANGED MODE':'MELEE MODE',.8); }

function burst(x,y,c,n){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*430,vy:(Math.random()-.7)*380,life:.35+Math.random()*.4,max:.75,c});}
function muzzle(x,y){for(let i=0;i<8;i++)particles.push({x,y,vx:player.facing*(240+Math.random()*360),vy:(Math.random()-.5)*160,life:.08+Math.random()*.1,max:.18,c:'#f2c485'});}
function slashFX(x,y,dir,combo){particles.push({slash:true,x,y,dir,life:.14,max:.14,combo});}

function nearestInteraction(actor=player){
  if(astalor.shopOpen)return {type:'shopclose',x:W/2,label:'S / D↓ — Close'};
  const r=rooms[roomIndex]; let best=null;
  const add=(type,x,label)=>{const d=Math.abs(actor.x-x);if(d<155&&(!best||d<best.d))best={type,x,label,d};};
  if(r.statueX!=null)add('statue',r.statueX,'S — Rest');
  if(r.elevatorX!=null)add('elevator',r.elevatorX,'S — Take Elevator');
  if(r.gateX!=null)add('gate',r.gateX,'S — Enter Castle');
  if(r.symbolX!=null){
    if(astalor.room===roomIndex && astalor.mode!=='hidden') add('astalor',r.symbolX,'S — Shop');
    else add('symbol',r.symbolX,'S — Summon Astalor');
  }
  return best;
}
function interact(actor=player){
  if(astalor.shopOpen){astalor.shopOpen=false;return;}
  const it=nearestInteraction(actor); if(!it)return;
  if(it.type==='statue'){
    if(player.sitting){player.sitting=false;setMessage('REST INTERRUPTED',.7);return;}
    player.sitting=true;player.vx=player.vy=0;player.healStart=now();player.healFrom=player.health;player.staminaFrom=player.stamina;player.restDone=false;
    if(player2.enabled){player2.health=player2.maxHealth;player2.stamina=player2.maxStamina;}
    player.checkpoint={room:roomIndex,x:it.x-115};
    saveGame();
  } else if(it.type==='elevator'){
    if(roomIndex===3){
      roomIndex=4;
      player.x=95; player.y=FLOOR; player.vx=player.vy=0;placePlayer2NearPlayer(125);
      bullets=[];projectiles=[];roomFade=.8;
      setMessage('COURTYARD OF THE DAMNED',1.4);
    }
  } else if(it.type==='gate'){
    if(roomIndex===CASTLE_GATE_ROOM){roomIndex=10;player.x=95;player.y=FLOOR;player.vx=player.vy=0;placePlayer2NearPlayer(125);bullets=[];projectiles=[];roomFade=.85;setMessage('THE CRIMSON KEEP',1.4);}
  } else if(it.type==='symbol'){
    astalor.room=roomIndex;astalor.mode='spawn';astalor.spawnStart=now();astalor.idleStart=0;astalor.lastHair=now();setMessage('ASTALOR SUMMONED',1.1);
  } else if(it.type==='astalor'){
    if(astalor.mode!=='spawn')astalor.shopOpen=true;
  }
}

function roomHasGroundAtX(room,x){
  // The final bridge physically ends at dropX. Everywhere else keeps the canonical Y=714 floor.
  return !(Number.isFinite(room.dropX) && x>room.dropX);
}
function placePlayer2NearPlayer(offset=125){if(!player2.enabled)return;player2.x=clamp(player.x+offset,40,W-40);player2.y=player.y;player2.vx=player2.vy=0;player2.onGround=player.onGround;player2.jumps=player.onGround?0:player.jumps;}
function completeBridgeDrop(){
  const r=rooms[roomIndex];
  if(!Number.isInteger(r.dropTarget))return false;
  roomIndex=r.dropTarget;
  player.x=215;
  player.y=250;
  player.vx=135;
  player.vy=470;
  player.onGround=false;
  player.jumps=2;
  player.dashT=0;placePlayer2NearPlayer(125);
  bullets=[];projectiles=[];
  roomFade=.62;
  setMessage('COURTYARD OF THE DAMNED',1.5);
  return true;
}

function p2DrinkFlask(){
  if(player.flasks<=0){setMessage('NO BLOOD FLASKS',.8);return;}
  if(player2.health>=player2.maxHealth){setMessage('BANDIT II HEALTH FULL',.7);return;}
  player.flasks--;player2.health=clamp(player2.health+Math.ceil(player2.maxHealth*FLASK_HEAL_FRACTION),0,player2.maxHealth);
  burst(player2.x,player2.y-70,'#7d355f',18);setMessage('BANDIT II BLOOD FLASK  +40% HP',.9);
}
function p2MeleeAttack(){
  const p=player2;p.combo=(p.comboT>0)?(p.combo%3)+1:1;p.comboT=.7;p.attackCd=.24;setBanditActionFor(p,`melee_attack_${p.combo}`);
  const range=105+p.combo*9,dmg=[0,26,31,40][p.combo],hx=p.x+p.facing*70,r=rooms[roomIndex];
  r.enemies.forEach(e=>{if(e.alive&&Math.abs(e.x-hx)<range&&Math.abs((e.y-40)-(p.y-70))<100)hitEnemy(e,dmg,70,p.x);});
  if(r.boss&&r.boss.alive&&Math.abs(r.boss.x-hx)<230)bossDamage(r.boss,dmg,hx);
  if(roomIndex===HARLEQUIN_ROOM&&harlequin.active&&!harlequin.defeated&&Math.abs(harlequin.x-hx)<150)harlequinDamage(dmg,hx,'melee',p);
  slashFX(p.x+p.facing*65,p.y-85,p.facing,p.combo);
}
function p2FireRevolver(){
  const p=player2,crouch=p.onGround&&p2Held('crouch');p.attackCd=.32;p.shootSlow=.22;setBanditActionFor(p,crouch?'melee_crouch_shoot':'melee_shotgun');
  const sy=p.y-(crouch?54:92);bullets.push({x:p.x+p.facing*50,y:sy,vx:p.facing*1350,life:.9,damage:18,kb:190,type:'revolver',owner:2});
  for(let i=0;i<7;i++)particles.push({x:p.x+p.facing*55,y:sy,vx:p.facing*(240+Math.random()*360),vy:(Math.random()-.5)*160,life:.08+Math.random()*.1,max:.18,c:'#d8a6c4'});
}
function p2FireShotgun(){
  const p=player2,crouch=p.onGround&&p2Held('crouch');p.shotgunCd=5;p.shootSlow=.35;setBanditActionFor(p,crouch?'melee_crouch_shoot':'melee_shotgun');
  const r=rooms[roomIndex],maxRange=560;
  r.enemies.forEach(e=>{const dx=(e.x-p.x)*p.facing;if(e.alive&&dx>0&&dx<maxRange&&Math.abs((e.y-45)-(p.y-85))<95)hitEnemy(e,48,430,p.x);});
  if(r.boss&&r.boss.alive){const dx=(r.boss.x-p.x)*p.facing;if(dx>0&&dx<maxRange+90)bossDamage(r.boss,42,p.x+p.facing*Math.min(dx,260));}
  if(roomIndex===HARLEQUIN_ROOM&&harlequin.active&&!harlequin.defeated){const dx=(harlequin.x-p.x)*p.facing;if(dx>0&&dx<maxRange)harlequinDamage(42,p.x+p.facing*Math.min(dx,260),'shotgun',p);}
  const sy=p.y-(crouch?54:88);for(let i=0;i<14;i++)particles.push({x:p.x+p.facing*55,y:sy,vx:p.facing*(650+Math.random()*400),vy:(Math.random()-.5)*220,life:.18+Math.random()*.18,max:.36,c:'#c08cae'});shake=.13;
}
function p2ToggleStance(){const p=player2;if(p.vCd>0)return;p.stance=p.stance==='melee'?'ranged':'melee';p.vCd=6;burst(p.x,p.y-78,'#8d4e92',18);setMessage(p.stance==='ranged'?'BANDIT II RANGED':'BANDIT II MELEE',.7);}

function updateSecondBandit(dt){
  const p=player2;if(!p.enabled)return;
  p.attackCd=Math.max(0,p.attackCd-dt);p.shotgunCd=Math.max(0,p.shotgunCd-dt);p.xCd=Math.max(0,p.xCd-dt);p.vCd=Math.max(0,p.vCd-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.invuln=Math.max(0,p.invuln-dt);p.comboT=Math.max(0,p.comboT-dt);p.shootSlow=Math.max(0,p.shootSlow-dt);p.slowT=Math.max(0,p.slowT-dt);p.flash=Math.max(0,p.flash-dt);
  if(p.dead){p.deathT-=dt;if(!player.dead&&p.deathT<=0){p.dead=false;p.health=Math.ceil(p.maxHealth*.5);p.x=clamp(player.x+95,40,W-40);p.y=FLOOR;p.vx=p.vy=0;p.invuln=1.5;setMessage('BANDIT II RETURNS  ·  50% HP',1.0);}return;}
  const crouching=p.onGround&&p2Held('crouch');
  p.guard=!!(p.onGround&&p2Held('guard')&&!crouching&&p.stamina>0);if(p.guard){p.vx=0;p.stamina=Math.max(0,p.stamina-8*dt);}
  const move=(crouching||p.guard)?0:(p2Held('right')?1:0)-(p2Held('left')?1:0);
  if(move>0)p.facing=1; else if(move<0)p.facing=-1;
  const base=p.stance==='ranged'?300:365,slow=p.shootSlow>0?.48:1,web=p.slowT>0?.55:1;
  if(crouching){p.vx=0;p.dashT=0;} else if(p.dashT>0){p.dashT-=dt;} else p.vx+=(move*base*slow*web-p.vx)*Math.min(1,dt*13);
  if(p2Tap('jump')){if(p.onGround){p.vy=-650;p.onGround=false;p.jumps=1;}else if(p.jumps<2){p.vy=-600;p.jumps=2;}}
  if(p2Tap('dash')&&p.stamina>=22&&p.dashCd<=0){const dir=move||Math.sign(p.vx)||p.facing||1;p.stamina-=22;p.dashT=.16;p.invuln=.22;p.dashCd=.38;p.vx=dir*1020;setBanditActionFor(p,'melee_dash');burst(p.x,p.y-55,'#4e244f',10);}
  if(p2Tap('stance'))p2ToggleStance();if(p2Tap('flask'))p2DrinkFlask();if(p2Tap('attack')&&p.attackCd<=0){p.stance==='melee'?p2MeleeAttack():p2FireRevolver();}if(p2Tap('ranged')&&p.stance==='ranged'&&p.attackCd<=0)p2FireRevolver();if(p2Tap('shotgun')&&p.shotgunCd<=0)p2FireShotgun();if(p2Tap('interact'))interact(player2);
  if(!p.onGround){p.vy+=1550*dt;p.y+=p.vy*dt;if(p.y>=PLAYER_GROUND_Y&&roomHasGroundAtX(rooms[roomIndex],p.x)){p.y=FLOOR;p.vy=0;p.onGround=true;p.jumps=0;}}
  p.x+=p.vx*dt;p.x=clamp(p.x,30,W-30);if(p.dashT<=0)p.stamina=clamp(p.stamina+27*dt,0,p.maxStamina);
  if(net.role==='host')net.remotePressed.clear();
}

function update(dt){
  pollGamepads();
  if(!gameActive){pressed.clear();touchPressed.clear();return;}
  if(net.role==='guest'&&net.connected){sendGuestInput();pressed.clear();touchPressed.clear();return;}
  if(gameWon){if(tap('KeyS'))showMainMenu();pressed.clear();return;}
  if(messageT>0)messageT-=dt;if(shake>0)shake-=dt;if(roomFade>0)roomFade-=dt;if(saveFxT>0)saveFxT-=dt;
  player.attackCd=Math.max(0,player.attackCd-dt); player.shotgunCd=Math.max(0,player.shotgunCd-dt); player.xCd=Math.max(0,player.xCd-dt); player.vCd=Math.max(0,player.vCd-dt); player.dashCd=Math.max(0,player.dashCd-dt); player.invuln=Math.max(0,player.invuln-dt); player.comboT=Math.max(0,player.comboT-dt); player.shootSlow=Math.max(0,player.shootSlow-dt); player.slowT=Math.max(0,player.slowT-dt); player.flash=Math.max(0,player.flash-dt);
  if(player.dead){
    player.deathT-=dt;updateSecondBandit(dt);
    if(player2.enabled&&!player2.dead&&player.deathT<=0){player.dead=false;player.health=Math.ceil(player.maxHealth*.5);player.x=clamp(player2.x-95,40,W-40);player.y=FLOOR;player.vx=player.vy=0;player.invuln=1.5;setMessage('BANDIT RETURNS  ·  50% HP',1.0);}
    else if(!player2.enabled&&player.deathT<=0){respawn();pressed.clear();return;}
    else if(player2.enabled&&player2.dead){respawn();pressed.clear();return;}
    updateBullets(dt);updateEnemies(dt);updateHarlequin(dt);updateAstalor();updateParticles(dt);updateFloaters(dt);pressed.clear();return;
  }
  if(astalor.shopOpen){ updateAstalor(); updateParticles(dt); updateFloaters(dt); if(tap('KeyC'))buyBloodFlask(); if(tap('KeyS'))interact(); pressed.clear(); return; }

  if(player.sitting){
    const movement=down('ArrowLeft')||down('ArrowRight')||tap('ArrowUp')||down('ArrowDown');
    if(movement||tap('KeyS')){player.sitting=false;setMessage('REST INTERRUPTED',.7);} else {
      const t=clamp((now()-player.healStart)/4,0,1);
      player.health=lerp(player.healFrom,player.maxHealth,t);
      player.stamina=lerp(player.staminaFrom,player.maxStamina,t);
      if(t>=1&&!player.restDone){player.restDone=true;player.health=player.maxHealth;player.stamina=player.maxStamina;setMessage('RESTORED',.7);}
    }
  }

  if(!player.sitting){
    const crouching=isCrouching();
    player.guard=!!(player.onGround&&down('KeyQ')&&!crouching&&player.stamina>0);if(player.guard){player.vx=0;player.stamina=Math.max(0,player.stamina-8*dt);}
    const move=(crouching||player.guard)?0:(down('ArrowRight')?1:0)-(down('ArrowLeft')?1:0);
    if(move>0)player.facing=1;
    // Moving left uses the authored backwalk; never mirror the Bandit and swap weapon hands.

    const base=player.stance==='ranged'?300:365, slow=player.shootSlow>0?.48:1, web=player.slowT>0?.55:1;
    if(crouching){
      // Crouch stays stationary, but shooting is now supported with a dedicated IFP.
      player.vx=0;
      player.dashT=0;
    } else if(player.dashT>0){
      player.dashT-=dt;
    } else {
      player.vx += (move*base*slow*web-player.vx)*Math.min(1,dt*13);
    }

    if(!crouching&&tap('ArrowUp')){
      if(player.onGround){player.vy=-650;player.onGround=false;player.jumps=1;}
      else if(player.jumps<2){player.vy=-600;player.jumps=2;burst(player.x,player.y-15,'#697483',8);}
    }

    // Crouch keeps locomotion locked but permits firearm use.
    if(crouching){
      if(tap('KeyA'))drinkFlask();
      if(tap('KeyX')&&player.stance==='melee'&&player.shotgunCd<=0)fireShotgun();
      if(tap('KeyC')&&player.stance==='ranged'&&player.attackCd<=0)fireRevolver();
    } else {
      if(tap('KeyZ'))dash();
      if(tap('KeyV'))toggleStance();
      if(tap('KeyA'))drinkFlask();
      if(tap('KeyC')&&player.attackCd<=0){player.stance==='melee'?meleeAttack():fireRevolver();}
      if(meleeTrigger(0)&&player.stance==='melee'&&player.attackCd<=0)meleeAttack();
      if(rangedTrigger(0)&&player.stance==='ranged'&&player.attackCd<=0)fireRevolver();
      if(shotgunTrigger(0)&&player.shotgunCd<=0)fireShotgun();
      if(tap('KeyX')){if(player.stance==='melee'&&player.shotgunCd<=0)fireShotgun();else if(player.stance==='ranged'&&player.xCd<=0)rangedBackdash();}
    }
    if(tap('KeyS'))interact();
  }

  const activeRoom=rooms[roomIndex];
  if(!player.onGround){
    player.vy+=1550*dt;
    player.y+=player.vy*dt;
    if(player.y>=PLAYER_GROUND_Y && roomHasGroundAtX(activeRoom,player.x)){
      player.y=FLOOR;player.vy=0;player.onGround=true;player.jumps=0;
    }
  }
  player.x+=player.vx*dt;

  // The Last Span requires an intentional jump. Walking/running into the broken edge stops at the lip;
  // an airborne Bandit may cross it, after which there is no invisible Y=714 floor beneath him.
  if(Number.isFinite(activeRoom.dropX)){
    if(player.onGround && player.x>activeRoom.dropX){
      player.x=activeRoom.dropX;
      player.vx=0;
    } else if(!player.onGround && player.x>W-105){
      player.x=W-105;
      if(player.vx>0)player.vx*=.25;
    }
    if(!player.onGround && player.x>activeRoom.dropX+10 && player.y>H+78){
      completeBridgeDrop();
    }
  }

  if(!player.sitting && player.dashT<=0) player.stamina=clamp(player.stamina+27*dt,0,player.maxStamina);
  updateSecondBandit(dt);
  if(player2.enabled&&player2.dead&&player.dead){respawn();pressed.clear();return;}
  handleTransitions(); updateBullets(dt); updateEnemies(dt); updateHarlequin(dt); updateAstalor(); updateParticles(dt); updateFloaters(dt); if(victoryT>0){victoryT-=dt;if(victoryT<=0)gameWon=true;} hostBroadcastSnapshot(); pressed.clear();touchPressed.clear();
}

function handleTransitions(){
  if(player.x<30){
    if(roomIndex===HARLEQUIN_ROOM&&harlequin.active&&!harlequin.defeated){player.x=30;setMessage('THE FEVER DREAM HOLDS YOU',.8);return;}
    if(roomIndex===FINAL_ROOM&&rooms[FINAL_ROOM].boss&&rooms[FINAL_ROOM].boss.alive){player.x=30;setMessage('FACE THE LORD',.8);return;}
    // The Courtyard entrance is reached by a one-way drop from the broken bridge; there is no invisible climb back up.
    if(rooms[roomIndex].arrivalFromDrop){
      player.x=30;
      if(messageT<=0)setMessage('THE BROKEN BRIDGE LIES ABOVE',.85);
    } else if(roomIndex>0){
      roomIndex--;player.x=W-85;placePlayer2NearPlayer(-125);roomFade=.45;bullets=[];projectiles=[];
    } else player.x=30;
  }
  if(player.x>W-30){
    if(roomIndex===1 && rooms[1].boss&&rooms[1].boss.alive){player.x=W-30;setMessage('DEFEAT THE HIVE MATRIARCH',1.1);return;}
    if(roomIndex===HARLEQUIN_ROOM&&!harlequin.defeated){player.x=W-30;setMessage(harlequin.active?'END THE DANCE':'APPROACH THE FALLEN PUPPET',1.0);return;}
    if(roomIndex===CASTLE_GATE_ROOM){player.x=W-30;setMessage('USE THE CASTLE GATE',.9);return;}
    if(roomIndex===12 && rooms[12].enemies.some(e=>e.alive)){player.x=W-30;setMessage('THE THRONE PATH IS SEALED',.9);return;}
    if(roomIndex===FINAL_ROOM){player.x=W-30;return;}
    // The elevator is the required gateway from Astalor's Sanctuary into the bridge/courtyard area.
    if(roomIndex===3){player.x=W-30;setMessage('USE THE ELEVATOR',.9);return;}
    // The final bridge does not side-transition. Its only route forward is the broken-edge jump/drop.
    if(Number.isFinite(rooms[roomIndex].dropX)){player.x=W-30;return;}
    if(roomIndex<rooms.length-1){roomIndex++;player.x=75;placePlayer2NearPlayer(125);roomFade=.45;bullets=[];projectiles=[];}
    else player.x=W-30;
  }
}
function updateBullets(dt){
  const r=rooms[roomIndex];
  for(const b of bullets){b.x+=b.vx*dt;b.life-=dt;if(b.life<=0)continue;
    for(const e of r.enemies){if(e.alive&&Math.abs(e.x-b.x)<54&&Math.abs((e.y-45)-b.y)<65){hitEnemy(e,b.damage,b.kb,b.x-b.vx*.02);b.life=0;break;}}
    if(b.life>0&&r.boss&&r.boss.alive&&Math.abs(r.boss.x-b.x)<175&&Math.abs((FLOOR-125)-b.y)<145){bossDamage(r.boss,b.damage,b.x);b.life=0;}
    if(b.life>0&&roomIndex===HARLEQUIN_ROOM&&harlequin.active&&!harlequin.defeated&&Math.abs(harlequin.x-b.x)<120&&Math.abs((FLOOR-150)-b.y)<180){harlequinDamage(b.damage,b.x,'revolver');b.life=0;}
  }
  bullets=bullets.filter(b=>b.life>0&&b.x>-100&&b.x<W+100);
  for(const p of projectiles){
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
    for(const bp of activeBandits()){
      if(bp.dead)continue;const crouching=bp===player?isCrouching():(bp.onGround&&down('KeyK'));
      const hitCenterY=bp.y-(crouching?34:75),halfH=crouching?26:68,halfW=crouching?34:42;
      if(Math.abs(p.x-bp.x)<halfW&&Math.abs(p.y-hitCenterY)<halfH){
        if(p.kind==='web'){p.life=0;damageBandit(bp,12,Math.sign(p.vx)*45);bp.slowT=1.3;}
        else if(p.kind==='star'){p.life=0;damageBandit(bp,15,Math.sign(p.vx||1)*90);burst(p.x,p.y,'#d8b43b',8);}
        else if(p.kind==='crimsonStar'){p.life=0;damageBandit(bp,20,Math.sign(p.vx||1)*125);burst(p.x,p.y,'#b81731',10);}
        break;
      }
    }
  }
  projectiles=projectiles.filter(p=>p.life>0);
}
function setEnemyAnim(e,name){
  if(e.anim===name)return;
  e.anim=name;e.animStart=performance.now();
}
function enemyAnimFrame(e){
  const family=PUPPET_ANIMS[e.enemyType];
  if(!family)return null;
  const def=family[e.anim]||family.idle;
  let f=Math.floor((performance.now()-e.animStart)/def.ms);
  const attacking=e.anim==='attack1'||e.anim==='attack2';
  if(attacking)f=Math.min(def.frames-1,f);
  else f=f%def.frames;
  return {def,frame:f};
}
function enemyAttackFinished(e){
  const family=PUPPET_ANIMS[e.enemyType];
  if(!family||!(e.anim==='attack1'||e.anim==='attack2'))return true;
  const def=family[e.anim];
  return performance.now()-e.animStart>=def.ms*def.frames;
}

function updateEnemies(dt){
  const r=rooms[roomIndex];
  for(const e of r.enemies){
    if(!e.alive)continue;
    e.flash=Math.max(0,e.flash-dt);
    e.attackFx=Math.max(0,(e.attackFx||0)-dt);
    e.attackCd-=dt;
    const targetBandit=nearestBandit(e.x);const dx=targetBandit.x-e.x;
    const abs=Math.abs(dx);

    if(e.enemyType==='claw'){
      if((e.anim==='attack1'||e.anim==='attack2')&&!enemyAttackFinished(e)){
        e.vx*=.93;
      }else{
        if(e.anim==='attack1'||e.anim==='attack2')setEnemyAnim(e,'idle');
        const target=abs<760&&!targetBandit.dead?Math.sign(dx)*155:0;
        e.vx += (target-e.vx)*Math.min(1,dt*5.8);
        if(Math.abs(e.vx)>24)setEnemyAnim(e,'walk'); else setEnemyAnim(e,'idle');
        if(abs<150&&e.attackCd<=0){
          e.attackCd=1.35;
          e.attackKind=e.attackKind===1?2:1;
          setEnemyAnim(e,`attack${e.attackKind}`);
          e.attackFx=.52;
          e.vx+=Math.sign(dx)*320;
          damageBandit(targetBandit,18,Math.sign(dx)*210);
          burst(targetBandit.x,targetBandit.y-78,'#7f1730',12);
        }
      }
    } else if(e.enemyType==='lower'||e.enemyType==='courtier'){
      if((e.anim==='attack1'||e.anim==='attack2')&&!enemyAttackFinished(e)){
        e.vx*=.90;
      }else{
        if(e.anim==='attack1'||e.anim==='attack2')setEnemyAnim(e,'idle');
        const target=abs<690&&!targetBandit.dead?Math.sign(dx)*118:0;
        e.vx += (target-e.vx)*Math.min(1,dt*4.8);
        if(Math.abs(e.vx)>20)setEnemyAnim(e,'walk'); else setEnemyAnim(e,'idle');
        if(abs<92&&e.attackCd<=0){
          e.attackCd=1.08;
          e.attackKind=e.attackKind===1?2:1;
          setEnemyAnim(e,`attack${e.attackKind}`);
          e.attackFx=.50;
          const court=e.enemyType==='courtier';damageBandit(targetBandit,court?(e.attackKind===2?18:15):(e.attackKind===2?13:11),Math.sign(dx)*(court?180:135));
        }
      }
    } else {
      if(abs<650&&!targetBandit.dead)e.vx += (Math.sign(dx)*115-e.vx)*Math.min(1,dt*4.5);
      else e.vx*=.92;
      if(abs<76&&e.attackCd<=0){e.attackCd=1.05;e.attackFx=.18;damageBandit(targetBandit,10,Math.sign(dx)*120);}
    }
    e.x=clamp(e.x+e.vx*dt,70,W-70);
  }
  const b=r.boss;if(b&&b.alive){
    b.flash=Math.max(0,b.flash-dt);b.attackCd-=dt;const bossTarget=nearestBandit(b.x);const d=bossTarget.x-b.x;
    if(b.kind==='lord'){
      b.attackPoseT=Math.max(0,(b.attackPoseT||0)-dt);if(b.attackPoseT<=0)b.attackPose='idle';
      if(!b.engaged){
        b.vx=0;
        if(b.intro==='seated'&&Math.abs(bossTarget.x-b.x)<620){b.intro='eyes';b.introT=.72;setMessage('THE LORD AWAKENS',1.0);}
        else if(b.intro==='eyes'){b.introT-=dt;if(b.introT<=0){b.intro='blackout';b.introT=.62;}}
        else if(b.intro==='blackout'){b.introT-=dt;if(b.introT<=0){b.intro='active';b.engaged=true;b.attackPose='idle';setMessage('LORD OF THE CRIMSON MOON',1.6);}}
      }else{
        b.phase=b.hp<=b.maxHp*.5?2:1;b.moonCd-=dt;b.dashCd-=dt;b.dashT=Math.max(0,b.dashT-dt);
        const desired=Math.abs(d)>245?Math.sign(d)*(b.phase===2?175:135):0;
        if(b.dashT<=0)b.vx+=(desired-b.vx)*Math.min(1,dt*3.8);
        b.x=clamp(b.x+b.vx*dt,210,W-170);
        if(Math.abs(d)<215&&b.attackCd<=0){b.attackCd=b.phase===2?.82:1.18;b.attackPose='melee';b.attackPoseT=.54;b.attackAnimStart=performance.now();damageBandit(bossTarget,b.phase===2?30:24,Math.sign(d)*-290);slashFX(bossTarget.x,bossTarget.y-95,Math.sign(d)*-1,3);shake=.18;}
        if(b.moonCd<=0){
          b.moonCd=b.phase===2?.82:1.35;b.attackPose='cast';b.attackPoseT=.60;b.attackAnimStart=performance.now();
          const shots=b.phase===2?3:1;
          for(let k=0;k<shots;k++){
            const sx=b.x+(k-(shots-1)/2)*70,sy=FLOOR-300;const tx=bossTarget.x+(k-(shots-1)/2)*55,ty=bossTarget.y-70;const len=Math.hypot(tx-sx,ty-sy)||1;
            projectiles.push({kind:'crimsonStar',x:sx,y:sy,vx:(tx-sx)/len*(b.phase===2?520:455),vy:(ty-sy)/len*(b.phase===2?520:455),life:4,born:performance.now()});
          }
        }
        if(b.phase===2&&b.dashCd<=0){b.dashCd=3.0;b.dashT=.28;b.vx=Math.sign(d)*760;burst(b.x,FLOOR-95,'#9d1028',22);}
      }
    }else{
      b.webCd-=dt;
      if(b.webCd<=0 && Math.abs(d)>210){b.webCd=2.25;const sx=b.x-90,sy=FLOOR-160;const tx=bossTarget.x,ty=bossTarget.y-75;const len=Math.hypot(tx-sx,ty-sy)||1;projectiles.push({kind:'web',x:sx,y:sy,vx:(tx-sx)/len*420,vy:(ty-sy)/len*420,life:4});}
      if(Math.abs(d)<240&&b.attackCd<=0){b.attackCd=1.45;damageBandit(bossTarget,22,Math.sign(-d)*260);burst(bossTarget.x,bossTarget.y-25,'#53151f',8);}
    }
  }
}
function spawnHarlequinStars(){
  const mx=W/2,my=210;harlequin.moonPattern=(harlequin.moonPattern+1)%3;
  if(harlequin.moonPattern===0){
    const hpTarget=nearestBandit(mx);const tx=hpTarget.x,ty=hpTarget.y-70,len=Math.hypot(tx-mx,ty-my)||1;projectiles.push({kind:'star',x:mx,y:my,vx:(tx-mx)/len*480,vy:(ty-my)/len*480,life:4,born:performance.now()});
  }else if(harlequin.moonPattern===1){
    for(let a=-1;a<=1;a++){const hpTarget=nearestBandit(mx);const tx=hpTarget.x+a*120,ty=hpTarget.y-65,len=Math.hypot(tx-mx,ty-my)||1;projectiles.push({kind:'star',x:mx+a*18,y:my,vx:(tx-mx)/len*440,vy:(ty-my)/len*440,life:4,born:performance.now()});}
  }else{
    for(let k=0;k<4;k++){const hpTarget=nearestBandit(300+k*350),sx=300+k*350,sy=80;projectiles.push({kind:'star',x:sx,y:sy,vx:(hpTarget.x-sx)*.16,vy:405+k*18,life:4,born:performance.now()});}
  }
}
function updateHarlequin(dt){
  if(harlequin.defeated){harlequin.transition=Math.max(0,harlequin.transition-dt*.62);return;}
  if(roomIndex!==HARLEQUIN_ROOM)return;
  harlequin.flash=Math.max(0,harlequin.flash-dt);harlequin.hurtCd=Math.max(0,harlequin.hurtCd-dt);
  if(!harlequin.active){
    if(activeBandits().some(p=>!p.dead&&Math.abs(p.x-harlequin.x)<330)){harlequin.active=true;harlequin.awakenT=1.15;harlequin.state='idle';harlequin.moveT=1.1;setMessage('UNCHAINED HARLEQUIN',1.6);burst(harlequin.x,FLOOR-90,'#d7b63d',28);}
    return;
  }
  harlequin.transition=Math.min(1,harlequin.transition+dt*.8);
  if(harlequin.awakenT>0){harlequin.awakenT-=dt;return;}
  harlequin.moonCd-=dt;harlequin.moonBlowT=Math.max(0,harlequin.moonBlowT-dt);
  if(harlequin.moonShotT>=0){harlequin.moonShotT-=dt;if(harlequin.moonShotT<=0){harlequin.moonShotT=-1;spawnHarlequinStars();}}
  if(harlequin.moonCd<=0){harlequin.moonCd=1.55+Math.random()*.85;harlequin.moonBlowT=.58;harlequin.moonShotT=.28;}
  if(harlequin.stopT>0){harlequin.stopT-=dt;harlequin.state='idle';if(harlequin.stopT<=0){harlequin.dir=Math.random()<.5?-1:1;harlequin.moveT=.9+Math.random()*1.5;}}
  else{
    harlequin.state=harlequin.dir<0?'left':'right';harlequin.x+=harlequin.dir*132*dt;harlequin.moveT-=dt;
    if(harlequin.x<300){harlequin.x=300;harlequin.dir=1;harlequin.stopT=.65+Math.random()*.7;}
    if(harlequin.x>1390){harlequin.x=1390;harlequin.dir=-1;harlequin.stopT=.65+Math.random()*.7;}
    if(harlequin.moveT<=0)harlequin.stopT=.55+Math.random()*1.15;
    for(const hp of activeBandits()){if(hp.onGround&&!hp.dead&&Math.abs(hp.x-harlequin.x)<150&&harlequin.hurtCd<=0){harlequin.hurtCd=.68;damageBandit(hp,13,Math.sign(hp.x-harlequin.x)*170);break;}}
  }
}

function updateAstalor(){
  if(astalor.room!==roomIndex||astalor.mode==='hidden')return;const t=now();
  if(astalor.mode==='spawn' && t-astalor.spawnStart>1.15){astalor.mode='idle';astalor.idleStart=t;astalor.lastHair=t;}
  if(astalor.mode==='idle' && t-astalor.lastHair>=15){astalor.mode='hair';astalor.hairStart=t;}
  if(astalor.mode==='hair' && t-astalor.hairStart>1.6){astalor.mode='idle';astalor.idleStart=t;astalor.lastHair=t;}
}
function updateParticles(dt){for(const p of particles){p.life-=dt;if(!p.slash){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=560*dt;}}particles=particles.filter(p=>p.life>0);}
function updateFloaters(dt){for(const f of floaters){f.life-=dt;f.y-=28*dt;}floaters=floaters.filter(f=>f.life>0);}

function draw(){
  ctx.save();const sx=shake>0?(Math.random()-.5)*10:0,sy=shake>0?(Math.random()-.5)*6:0;ctx.translate(sx,sy);
  if(roomIndex===HARLEQUIN_ROOM){ctx.drawImage(A.hRoomNormal,0,0,W,H);if(harlequin.transition>0){ctx.save();ctx.globalAlpha=harlequin.transition;ctx.drawImage(A.hRoomDream,0,0,W,H);ctx.restore();}}
  else ctx.drawImage(A[rooms[roomIndex].bg],0,0,W,H);
  drawObjects(); drawEnemies(); drawHarlequin(); drawAstalor(); drawPlayer(); drawBullets(); drawParticles(); drawFloaters(); ctx.restore();
  if(roomIndex===FINAL_ROOM){const lb=rooms[FINAL_ROOM].boss;if(lb&&lb.alive&&!lb.engaged&&lb.intro==='blackout'){const a=1-Math.abs((lb.introT/.62)*2-1);ctx.fillStyle=`rgba(0,0,0,${clamp(.45+a*.55,0,1)})`;ctx.fillRect(0,0,W,H);}}
  drawHUD(); drawSaveFx(); drawTraversalHint(); drawPrompt(); if(astalor.shopOpen)drawShopOverlay(); if(messageT>0)drawMessage(); if(gameWon)drawVictory(); if(roomFade>0){ctx.fillStyle=`rgba(0,0,0,${clamp(roomFade/.8,0,1)})`;ctx.fillRect(0,0,W,H);} 
}

function drawObjects(){
  const r=rooms[roomIndex];
  if(r.statueX!=null)drawStatue(r.statueX,FLOOR);
  if(r.symbolX!=null)drawTriangle(r.symbolX,FLOOR+2,astalor.room===roomIndex?1:.72);
  if(r.finalRoom&&r.throneX!=null&&A.lordThrone){
    const tw=430,th=538;ctx.drawImage(A.lordThrone,r.throneX-tw/2,FLOOR-th,tw,th);
  }
  if(r.elevatorX!=null){
    ctx.save();ctx.strokeStyle='rgba(155,166,180,.35)';ctx.lineWidth=2;
    ctx.strokeRect(r.elevatorX-145,FLOOR-10,290,10);ctx.restore();
  }
}
// Every save statue uses the exact same approved Hooded Stone Knight asset.
// It remains a separate gameplay object (never baked into a room background).
const STATUE_DRAW_H=260;
function drawStatue(x,y){
  const img=A.statue;
  if(!img)return;
  const h=STATUE_DRAW_H;
  const w=h*(img.naturalWidth/img.naturalHeight);
  ctx.save();
  ctx.drawImage(img,x-w/2,y-h,w,h);
  ctx.restore();
}
function drawTriangle(x,y,a){ctx.save();ctx.translate(x,y);ctx.globalAlpha=a;ctx.strokeStyle='#d51b35';ctx.lineWidth=5;ctx.shadowBlur=12;ctx.shadowColor='#d51b35';ctx.beginPath();ctx.arc(0,0,55,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-42);ctx.lineTo(40,32);ctx.lineTo(-40,32);ctx.closePath();ctx.stroke();ctx.restore();}

function drawEnemies(){
  const r=rooms[roomIndex];
  for(const e of r.enemies){
    if(!e.alive)continue;
    ctx.save();
    ctx.translate(e.x,e.y);
    const drawTarget=nearestBandit(e.x);const facing=e.enemyType==='spider'?(e.vx<0?-1:1):((drawTarget.x<e.x)?-1:1);
    ctx.scale(facing,1);
    if(e.flash>0)ctx.globalAlpha=.55;

    if(e.enemyType==='lower'||e.enemyType==='claw'||e.enemyType==='courtier'){
      const af=enemyAnimFrame(e);
      const def=af.def, frame=af.frame, img=A[def.key];
      const scale=PUPPET_DRAW_SCALE[e.enemyType];
      const dw=def.cellW*scale, dh=def.cellH*scale;
      // Resolve the authored source-foot row for this frame, then pin that foot/root to world Y=714.
      // Grounded walk frames are normalized here; airborne attack motion keeps its authored offset.
      const sourceBaseline=puppetSourceBaseline(def,frame);
      ctx.drawImage(img,frame*def.cellW,0,def.cellW,def.cellH,-dw/2,-sourceBaseline*scale,dw,dh);
      if(e.enemyType==='claw'&&(e.anim==='attack1'||e.anim==='attack2')&&frame>=2&&frame<=4){
        ctx.strokeStyle='rgba(206,45,40,.72)';ctx.lineWidth=4;
        ctx.beginPath();ctx.arc(72,-108,58,-1.2,.7);ctx.stroke();
      }
    } else {
      const scell=640,sf=Math.floor(performance.now()/82)%6,ss=.245;ctx.drawImage(A.spider,sf*scell,0,scell,scell,-scell*ss/2,-610*ss,scell*ss,scell*ss);
    }
    ctx.restore();
    // Every mob exposes its authoritative HP in multiplayer/single-player alike.
    const barW=e.enemyType==='spider'?112:(e.enemyType==='claw'?142:126),barY=FLOOR-(e.enemyType==='spider'?178:235);
    drawWorldHealthBar(e.x-barW/2,barY,barW,9,e.hp/e.maxHp,e.enemyType==='claw'?'#8d244d':'#a8172b');
  }
  if(r.boss&&r.boss.alive){const b=r.boss;ctx.save();ctx.translate(b.x,b.y);if(b.flash>0)ctx.globalAlpha=.55;
    if(b.kind==='lord'){
      if(!b.engaged){
        const sw=430,sh=538;ctx.drawImage(A.lordSeated,-sw/2,-sh,sw,sh);
        if(b.intro==='eyes'||b.intro==='blackout'){
          const pulse=.65+.35*Math.sin(now()*16);ctx.save();ctx.fillStyle=`rgba(255,20,35,${.72*pulse})`;ctx.shadowBlur=24;ctx.shadowColor='#ff172c';ctx.beginPath();ctx.arc(-14,-385,8,0,Math.PI*2);ctx.arc(14,-385,8,0,Math.PI*2);ctx.fill();ctx.restore();
        }
      }else{
        // Every active Lord state now uses a six-frame IFP pinned to the floor; no levitating static fallback.
        let img=A.lordIdle,ms=135,loop=true;
        if(b.attackPose==='cast'){img=A.lordCast;ms=100;loop=false;}
        else if(b.attackPose==='melee'){img=A.lordMelee;ms=90;loop=false;}
        else if(Math.abs(b.vx)>24){img=A.lordWalk;ms=b.dashT>0?60:105;loop=true;}
        const elapsed=(b.attackPose==='cast'||b.attackPose==='melee')?Math.max(0,performance.now()-(b.attackAnimStart||performance.now())):performance.now();
        let lf=Math.floor(elapsed/ms);lf=loop?lf%6:Math.min(5,lf);
        const lscale=.82,cell=640;
        // Mirroring Lord locomotion is intentional and was approved for left/right movement.
        if(b.vx< -8)ctx.scale(-1,1);
        ctx.drawImage(img,lf*cell,0,cell,cell,-cell*lscale/2,-620*lscale,cell*lscale,cell*lscale);
        if(b.phase===2){ctx.strokeStyle='rgba(190,25,55,.75)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-300,190+Math.sin(now()*5)*10,0,Math.PI*2);ctx.stroke();}
      }
    }else ctx.drawImage(A.boss,-205,-290,410,300);
    ctx.restore();}
}
function drawHarlequin(){
  if(roomIndex!==HARLEQUIN_ROOM)return;
  if(harlequin.active&&!harlequin.defeated){
    // damaging dance-floor aura: only dangerous while he is traveling.
    if(harlequin.state==='left'||harlequin.state==='right'){
      ctx.save();const pulse=.5+.5*Math.sin(now()*7);ctx.globalAlpha=.32+.18*pulse;ctx.fillStyle='#6d1d92';ctx.beginPath();ctx.ellipse(harlequin.x,FLOOR-4,165,24,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e0bd48';ctx.lineWidth=3;ctx.stroke();ctx.restore();
    }
    // Separate moon sprite in the center of the fever-dream sky.
    const mkey=harlequin.moonBlowT>0?'hMoonBlow':'hMoonIdle',mimg=A[mkey],mframes=6,mcell=512;
    const mf=Math.floor(performance.now()/(harlequin.moonBlowT>0?85:145))%mframes;
    ctx.save();ctx.globalAlpha=harlequin.transition;ctx.drawImage(mimg,mf*mcell,0,mcell,mcell,W/2-145,55,290,290);ctx.restore();
  }
  if(!harlequin.active&&!harlequin.defeated){
    const img=A.hDormant,dh=245,dw=img.width/img.height*dh;ctx.drawImage(img,harlequin.x-dw/2,FLOOR-dh+8,dw,dh);return;
  }
  if(harlequin.defeated)return;
  const map={idle:'hIdle',left:'hLeft',right:'hRight'};const key=map[harlequin.state]||'hIdle',img=A[key];const cell=640;
  const f=Math.floor(performance.now()/(harlequin.state==='idle'?145:92))%6;const scale=.53,dw=cell*scale,dh=cell*scale;
  ctx.save();if(harlequin.flash>0)ctx.globalAlpha=.55;
  if(harlequin.awakenT>0){const t=1-clamp(harlequin.awakenT/1.15,0,1);ctx.globalAlpha*=t;ctx.translate(0,(1-t)*55);}
  ctx.drawImage(img,f*cell,0,cell,cell,harlequin.x-dw/2,FLOOR-620*scale,dw,dh);ctx.restore();
}

function drawAstalor(){
  if(astalor.room!==roomIndex||astalor.mode==='hidden')return;const x=rooms[roomIndex].symbolX,y=FLOOR;
  const spawnP=astalor.mode==='spawn'?clamp((now()-astalor.spawnStart)/1.15,0,1):1;
  ctx.save();ctx.globalAlpha=spawnP;ctx.drawImage(A.shop,x-220,y-320,440,330);ctx.restore();

  let img=A.aIdle,count=6,t=now()-astalor.idleStart,frameMs=.22,loop=true;
  if(astalor.mode==='spawn'){img=A.aSpawn;count=6;t=now()-astalor.spawnStart;frameMs=.18;loop=false;}
  if(astalor.mode==='hair'){img=A.aHair;count=6;t=now()-astalor.hairStart;frameMs=.25;loop=false;}

  const fw=img.width/count;
  let frame=Math.floor(t/frameMs);
  frame=loop?frame%count:Math.min(count-1,frame);
  // During idle use the floor-safe approved sprite, whose feet are explicitly pinned above the Y=714 line.
  if(astalor.mode==='idle'&&A.aFloor){const dh=205,dw=dh;ctx.drawImage(A.aFloor,0,0,512,512,x-dw/2,y-dh,dw,dh);}
  else {const dh=190,dw=fw/img.height*dh;ctx.drawImage(img,frame*fw,0,fw,img.height,x-dw/2,y-dh,dw,dh);}
}
const p2PaletteCache=new Map();
function getBanditFrameCanvas(key,frame,palette){
  if(!palette)return null;
  const cacheKey=`${palette}:${key}:${frame}`;if(p2PaletteCache.has(cacheKey))return p2PaletteCache.get(cacheKey);
  // Deployment-safe palette treatment: never read sprite pixels back with getImageData().
  // Some public hosts/CDNs make canvas pixel reads unavailable, which previously could throw
  // a SecurityError and stop the entire requestAnimationFrame loop. We only draw + composite.
  const c=document.createElement('canvas');c.width=BANDIT_CELL_W;c.height=BANDIT_CELL_H;
  const g=c.getContext('2d',{willReadFrequently:false});g.imageSmoothingEnabled=false;
  g.clearRect(0,0,c.width,c.height);
  g.drawImage(A[key],frame*BANDIT_CELL_W,0,BANDIT_CELL_W,BANDIT_CELL_H,0,0,BANDIT_CELL_W,BANDIT_CELL_H);
  g.save();
  g.globalCompositeOperation='source-atop';
  g.fillStyle='rgba(77,25,105,0.28)';
  g.fillRect(0,0,c.width,c.height);
  g.restore();
  p2PaletteCache.set(cacheKey,c);return c;
}
function drawBanditEntity(p,palette=null,crouching=false){
  const state=banditStateFor(p,crouching),fr=banditFrameFor(p,state),scale=BANDIT_DRAW_SCALE,dw=BANDIT_CELL_W*scale,dh=BANDIT_CELL_H*scale;
  ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));if(p.invuln>0&&Math.floor(now()*18)%2===0)ctx.globalAlpha=.5;if(p.flash>0)ctx.globalAlpha=.55;
  const alt=getBanditFrameCanvas(fr.key,fr.frame,palette);
  if(alt)ctx.drawImage(alt,0,0,BANDIT_CELL_W,BANDIT_CELL_H,-dw/2,-banditSourceBaseline(fr.key,fr.frame)*scale,dw,dh);
  else ctx.drawImage(A[fr.key],fr.frame*BANDIT_CELL_W,0,BANDIT_CELL_W,BANDIT_CELL_H,-dw/2,-banditSourceBaseline(fr.key,fr.frame)*scale,dw,dh);
  ctx.restore();
}
function drawPlayer(){drawBanditEntity(player,null,isCrouching());if(player2.enabled)drawBanditEntity(player2,player2.palette,player2.onGround&&p2Held('crouch'));}

function drawBullets(){ctx.save();for(const b of bullets){ctx.strokeStyle='#f5d18e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-b.vx*.012,b.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  for(const p of projectiles){
    if(p.kind==='star'||p.kind==='crimsonStar'){
      ctx.save();
      if(p.kind==='crimsonStar'){const img=A.lordProjectile,pcell=256,pf=Math.floor((performance.now()-(p.born||performance.now()))/72)%6;ctx.globalAlpha=.94;ctx.shadowBlur=18;ctx.shadowColor='#d51435';ctx.drawImage(img,pf*pcell,0,pcell,pcell,p.x-34,p.y-34,68,68);}
      else {const img=A.starIFP,cell=96,frame=Math.floor((performance.now()-(p.born||performance.now()))/70)%6;ctx.drawImage(img,frame*cell,0,cell,cell,p.x-28,p.y-28,56,56);}
      ctx.restore();
    }else{ctx.strokeStyle='#d6d9df';ctx.lineWidth=4;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.stroke();}
  }ctx.restore();}
function drawParticles(){for(const p of particles){ctx.save();const a=clamp(p.life/p.max,0,1);ctx.globalAlpha=a;if(p.slash){ctx.strokeStyle='#c72b38';ctx.lineWidth=8;ctx.beginPath();const r=75+12*p.combo;ctx.arc(p.x,p.y,r,p.dir>0?-1.1:Math.PI+.1,p.dir>0?1.1:Math.PI*2-.1);ctx.stroke();}else{ctx.fillStyle=p.c;ctx.fillRect(p.x-3,p.y-3,6,6);}ctx.restore();}}

function panel(x,y,w,h){ctx.fillStyle='rgba(8,7,9,.88)';ctx.strokeStyle='#8c6a4d';ctx.lineWidth=2;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}

function drawBloodIcon(x,y,s=1){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  ctx.fillStyle='#b5162e';ctx.strokeStyle='#e3a1a8';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,-16);ctx.bezierCurveTo(11,-3,14,4,14,10);ctx.bezierCurveTo(14,20,7,26,0,26);ctx.bezierCurveTo(-7,26,-14,20,-14,10);ctx.bezierCurveTo(-14,4,-11,-3,0,-16);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.restore();
}
function drawFlaskIcon(x,y,s=1){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  ctx.strokeStyle='#dccac0';ctx.fillStyle='#28181b';ctx.lineWidth=2;
  ctx.fillRect(-5,-19,10,8);ctx.strokeRect(-5,-19,10,8);
  ctx.beginPath();ctx.moveTo(-9,-11);ctx.lineTo(-14,4);ctx.quadraticCurveTo(-17,19,0,22);ctx.quadraticCurveTo(17,19,14,4);ctx.lineTo(9,-11);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#ad1730';ctx.beginPath();ctx.moveTo(-11,7);ctx.quadraticCurveTo(0,2,11,7);ctx.lineTo(10,16);ctx.quadraticCurveTo(0,20,-10,16);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawFloaters(){
  ctx.save();ctx.textAlign='center';ctx.font='bold 18px Georgia';
  for(const f of floaters){ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle='#f0b0b8';ctx.fillText(f.text,f.x,f.y);}
  ctx.restore();
}
function drawSaveFx(){
  if(saveFxT<=0)return;
  const t=clamp(1-saveFxT/1.05,0,1), pulse=1+Math.sin(t*Math.PI)*.18;
  const x=W-72,y=H-74;
  ctx.save();ctx.globalAlpha=clamp(saveFxT/.25,0,1);
  ctx.strokeStyle='rgba(216,74,94,.65)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,28+22*t,0,Math.PI*2);ctx.stroke();
  drawBloodIcon(x,y-8,pulse);
  ctx.fillStyle='#ead6d8';ctx.textAlign='center';ctx.font='bold 15px Georgia';ctx.fillText('SAVED',x,y+36);
  ctx.restore();
}
function drawHUD(){
  ctx.save();panel(32,26,470,112);ctx.fillStyle='#27060b';ctx.beginPath();ctx.arc(82,80,42,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9b6b4f';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#9f1127';ctx.beginPath();ctx.arc(82,80,25,0,Math.PI*2);ctx.fill();
  drawBar(132,47,335,28,player.health/player.maxHealth,'#a81025','#2c0b11');drawBar(132,83,335,20,player.stamina/player.maxStamina,'#3f8c61','#0b2217');
  ctx.font='18px Georgia';ctx.fillStyle='#d8c8b7';ctx.fillText(player.stance==='melee'?'MELEE':'RANGED',136,128);
  // V cooldown bubble
  ctx.save();ctx.translate(458,120);ctx.fillStyle='#0c1710';ctx.strokeStyle='#4bd976';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.stroke();const ready=1-player.vCd/6;ctx.fillStyle='rgba(75,217,118,.75)';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,15,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(ready,0,1));ctx.closePath();ctx.fill();ctx.fillStyle='#e5f7e9';ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.fillText('V',0,5);ctx.restore();
  panel(W-290,28,245,90);ctx.font='16px Georgia';ctx.fillStyle='#d8c8b7';ctx.fillText(`Room ${rooms[roomIndex].id}`,W-266,56);ctx.font='13px Georgia';ctx.fillStyle='#9b8f86';ctx.fillText(rooms[roomIndex].name,W-266,82);ctx.fillStyle='#b89ac4';ctx.font='12px Georgia';ctx.fillText(`P1 ${padLabels[0]}  ·  P2 ${padLabels[1]}  ·  Pads: A jump · B dash · X attack · Y shotgun · RB stance · RT revolver · LB guard · LT crouch · D↑ flask`,W-1030,H-22);ctx.fillText(player.stance==='melee'?`X Shotgun ${player.shotgunCd>0?player.shotgunCd.toFixed(1)+'s':'READY'}`:`X Backdash ${player.xCd>0?player.xCd.toFixed(1)+'s':'READY'}`,W-266,104);
  panel(W-290,130,245,94);
  drawBloodIcon(W-258,157,.62);ctx.fillStyle='#e7cfd0';ctx.font='bold 18px Georgia';ctx.fillText(`${player.blood} BLOOD`,W-230,164);
  drawFlaskIcon(W-258,196,.62);ctx.fillStyle='#eadbd2';ctx.fillText(`× ${player.flasks}`,W-230,203);
  ctx.font='12px Georgia';ctx.fillStyle='#a99a91';ctx.fillText('A / D↑  Flask · +40% HP',W-180,203);
  if(player2.enabled){panel(32,150,470,72);ctx.fillStyle='#cbb8ca';ctx.font='bold 15px Georgia';ctx.fillText('BANDIT II',48,174);drawBar(132,160,335,21,player2.health/player2.maxHealth,'#762a69','#1c0d1b');drawBar(132,188,335,14,player2.stamina/player2.maxStamina,'#497f66','#0b2217');}
  const b=rooms[roomIndex].boss;if(b&&b.alive&&(b.kind!=='lord'||b.engaged)){const bw=650,bx=(W-bw)/2,by=H-64;panel(bx-14,by-20,bw+28,48);drawBar(bx,by,bw,16,b.hp/b.maxHp,'#841020','#19070a');ctx.fillStyle='#d8c8b7';ctx.textAlign='center';ctx.font='15px Georgia';ctx.fillText(b.kind==='lord'?'LORD OF THE CRIMSON MOON':'HIVE MATRIARCH',W/2,by-6);}
  if(roomIndex===HARLEQUIN_ROOM&&harlequin.active&&!harlequin.defeated){const bw=650,bx=(W-bw)/2,by=H-64;panel(bx-14,by-20,bw+28,48);drawBar(bx,by,bw,16,harlequin.hp/harlequin.maxHp,'#7b278d','#17091c');ctx.fillStyle='#ead9bd';ctx.textAlign='center';ctx.font='15px Georgia';ctx.fillText('UNCHAINED HARLEQUIN',W/2,by-6);}
  ctx.restore();
}
function drawWorldHealthBar(x,y,w,h,p,c='#a8172b'){ctx.save();ctx.fillStyle='rgba(9,5,7,.82)';ctx.fillRect(x-2,y-2,w+4,h+4);ctx.fillStyle='#241014';ctx.fillRect(x,y,w,h);ctx.fillStyle=c;ctx.fillRect(x+1,y+1,(w-2)*clamp(p,0,1),h-2);ctx.strokeStyle='rgba(218,190,165,.55)';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);ctx.restore();}
function drawBar(x,y,w,h,p,c,bg){ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);ctx.fillStyle=c;ctx.fillRect(x+2,y+2,(w-4)*clamp(p,0,1),h-4);ctx.strokeStyle='#9a7657';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);}
function drawTraversalHint(){
  const r=rooms[roomIndex];
  if(!Number.isFinite(r.dropX) || player.x<1080 || player.x>r.dropX+30)return;
  ctx.save();
  const label='↑ + →   LEAP INTO THE COURTYARD';
  ctx.font='18px Georgia';
  const tw=ctx.measureText(label).width+38;
  panel(r.dropX-tw/2,FLOOR-88,tw,40);
  ctx.fillStyle='#e7d6c5';ctx.textAlign='center';ctx.fillText(label,r.dropX,FLOOR-61);
  ctx.restore();
}
function drawPrompt(){const it=nearestInteraction();if(!it||astalor.shopOpen)return;const y=FLOOR-55;ctx.save();ctx.font='22px Georgia';const tw=ctx.measureText(it.label).width+34;panel(it.x-tw/2,y-34,tw,40);ctx.fillStyle='#e7d6c5';ctx.textAlign='center';ctx.fillText(it.label,it.x,y-7);ctx.restore();}
function drawMessage(){ctx.save();ctx.font='26px Georgia';const tw=ctx.measureText(message).width+54;panel((W-tw)/2,150,tw,50);ctx.fillStyle='#e5d1bb';ctx.textAlign='center';ctx.fillText(message,W/2,184);ctx.restore();}
function drawVictory(){
  ctx.save();ctx.fillStyle='rgba(3,2,5,.82)';ctx.fillRect(0,0,W,H);panel(W/2-390,H/2-155,780,310);ctx.textAlign='center';ctx.fillStyle='#d7384b';ctx.font='bold 46px Georgia';ctx.fillText('THE CRIMSON MOON HAS FALLEN',W/2,H/2-55);ctx.fillStyle='#e5d5c6';ctx.font='24px Georgia';ctx.fillText('The castle is silent. The dusk finally breaks.',W/2,H/2+8);ctx.fillStyle='#bca99c';ctx.font='18px Georgia';ctx.fillText('S — Return to Main Menu',W/2,H/2+88);ctx.restore();
}

function drawShopOverlay(){
  ctx.save();ctx.fillStyle='rgba(0,0,0,.74)';ctx.fillRect(0,0,W,H);
  panel(470,190,732,490);ctx.textAlign='center';
  ctx.fillStyle='#d9b6a0';ctx.font='38px Georgia';ctx.fillText('ASTALOR',836,252);
  ctx.font='18px Georgia';ctx.fillStyle='#b39987';ctx.fillText('THE CRIMSON MERCHANT',836,285);
  ctx.strokeStyle='#7c1730';ctx.beginPath();ctx.moveTo(570,312);ctx.lineTo(1102,312);ctx.stroke();

  ctx.textAlign='left';drawFlaskIcon(590,390,1.05);
  ctx.fillStyle='#ecd9ce';ctx.font='bold 25px Georgia';ctx.fillText('Blood Flask',640,372);
  ctx.font='16px Georgia';ctx.fillStyle='#a99a91';ctx.fillText('Restores 40% max HP',640,400);
  ctx.fillStyle='#d7b0b4';ctx.fillText(`Price: ${FLASK_COST} Blood`,640,430);

  drawBloodIcon(600,500,.75);ctx.fillStyle='#e8d4d5';ctx.font='bold 20px Georgia';ctx.fillText(`You have: ${player.blood} Blood`,635,507);
  drawFlaskIcon(880,500,.72);ctx.fillStyle='#e8d9d0';ctx.fillText(`Flasks: ${player.flasks}`,915,507);

  ctx.textAlign='center';ctx.font='bold 21px Georgia';
  ctx.fillStyle=player.blood>=FLASK_COST?'#e8d8cb':'#855d61';ctx.fillText(`C — Buy Blood Flask (${FLASK_COST})`,836,575);
  ctx.fillStyle='#b9a9a0';ctx.font='18px Georgia';ctx.fillText('S — Close shop',836,625);
  ctx.restore();
}

if(openOnlineBtn)openOnlineBtn.addEventListener('click',openOnlineLobby);
if(closeOnlineBtn)closeOnlineBtn.addEventListener('click',closeOnlineLobby);
if(hostRoomBtn)hostRoomBtn.addEventListener('click',async()=>{try{await connectNet();sendNet({type:'create'});netSetStatus('Creating room…');}catch(e){netSetStatus('Could not connect to multiplayer server');}});
if(joinRoomBtn)joinRoomBtn.addEventListener('click',async()=>{const code=(roomCodeInput?.value||'').trim().toUpperCase();if(code.length!==5){netSetStatus('Enter the 5-character room code');return;}try{await connectNet();sendNet({type:'join',code});netSetStatus('Joining…');}catch(e){netSetStatus('Could not connect to multiplayer server');}});
if(roomCodeInput)roomCodeInput.addEventListener('input',()=>roomCodeInput.value=roomCodeInput.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,5));
if(startOnlineBtn)startOnlineBtn.addEventListener('click',()=>{if(net.role!=='host'||!net.peer)return;newGame();player2.enabled=true;if(onlineLobby)onlineLobby.classList.remove('visible');enterGame();sendNet({type:'start'});setTimeout(hostBroadcastSnapshot,60);netSetStatus('Online co-op active');});
if(continueBtn)continueBtn.addEventListener('click',()=>{if(loadGame())enterGame();});
if(newGameBtn)newGameBtn.addEventListener('click',()=>{newGame();enterGame();});
if(backMenuBtn)backMenuBtn.addEventListener('click',showMainMenu);

let last=performance.now(),runtimeErrorShown=false;
function loop(t){
  const dt=Math.min(.033,(t-last)/1000);last=t;
  try{update(dt);draw();runtimeErrorShown=false;}
  catch(err){
    console.error('Crimson Dusk frame error',err);
    // Never allow one render/state error to permanently freeze the game loop.
    if(!runtimeErrorShown){runtimeErrorShown=true;if(netBadge){netBadge.textContent='RECOVERED FROM FRAME ERROR';netBadge.classList.add('visible');}}
  }
  requestAnimationFrame(loop);
}
Promise.all(Object.entries(assetPaths).map(([k,v])=>loadImage(k,v))).then(()=>{showMainMenu();document.getElementById('loading').style.opacity='0';setTimeout(()=>document.getElementById('loading').remove(),450);requestAnimationFrame(loop);}).catch(err=>{document.getElementById('loading').innerHTML='ASSET LOAD ERROR<br><span>'+String(err)+'</span>';});
})();
