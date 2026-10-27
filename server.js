const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const PORT = Number(process.env.PORT || 3000);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8'};
const server = http.createServer((req,res)=>{
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, clean === '/' ? 'index.html' : clean);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file,(err,st)=>{
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
});

const rooms = new Map();
const clients = new Set();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function roomCode(){let s='';do{s='';for(let i=0;i<5;i++)s+=alphabet[Math.floor(Math.random()*alphabet.length)];}while(rooms.has(s));return s;}
function frameText(text){const payload=Buffer.from(text);let head;if(payload.length<126){head=Buffer.alloc(2);head[0]=0x81;head[1]=payload.length;}else if(payload.length<65536){head=Buffer.alloc(4);head[0]=0x81;head[1]=126;head.writeUInt16BE(payload.length,2);}else{head=Buffer.alloc(10);head[0]=0x81;head[1]=127;head.writeBigUInt64BE(BigInt(payload.length),2);}return Buffer.concat([head,payload]);}
function send(c,msg){if(c&&!c.closed){try{c.socket.write(frameText(JSON.stringify(msg)));}catch{}}}
function cleanup(c){if(!c||c.closed)return;c.closed=true;clients.delete(c);const code=c.roomCode;if(!code)return;const room=rooms.get(code);if(!room)return;if(c.role==='host'){send(room.guest,{type:'peer_left',reason:'Host disconnected'});rooms.delete(code);}else if(c.role==='guest'){room.guest=null;send(room.host,{type:'peer_left',reason:'Guest disconnected'});}}
function handleMessage(c,m){
  if(m.type==='create'){cleanupRoomOnly(c);const code=roomCode();rooms.set(code,{host:c,guest:null,created:Date.now()});c.roomCode=code;c.role='host';send(c,{type:'created',code,role:'host'});return;}
  if(m.type==='join'){cleanupRoomOnly(c);const code=String(m.code||'').trim().toUpperCase();const room=rooms.get(code);if(!room)return send(c,{type:'error',message:'Room not found'});if(room.guest&&!room.guest.closed)return send(c,{type:'error',message:'Room is full'});room.guest=c;c.roomCode=code;c.role='guest';send(c,{type:'joined',code,role:'guest'});send(room.host,{type:'peer_joined'});return;}
  const room=rooms.get(c.roomCode);if(!room)return;
  if(m.type==='input'&&c.role==='guest')send(room.host,{type:'input',input:m.input,seq:m.seq});
  else if(m.type==='snapshot'&&c.role==='host')send(room.guest,{type:'snapshot',state:m.state,seq:m.seq});
  else if(m.type==='start'&&c.role==='host')send(room.guest,{type:'start'});
  else if(m.type==='ping')send(c,{type:'pong',t:m.t});
}
function cleanupRoomOnly(c){const code=c.roomCode;if(!code)return;const room=rooms.get(code);if(room){if(c.role==='host'){send(room.guest,{type:'peer_left',reason:'Host changed rooms'});rooms.delete(code);}else if(c.role==='guest'){room.guest=null;send(room.host,{type:'peer_left',reason:'Guest left room'});}}c.roomCode=null;c.role=null;}
function parseFrames(c,chunk){c.buffer=Buffer.concat([c.buffer,chunk]);while(c.buffer.length>=2){let b0=c.buffer[0],b1=c.buffer[1],opcode=b0&0x0f,masked=!!(b1&0x80),len=b1&0x7f,off=2;if(len===126){if(c.buffer.length<4)return;len=c.buffer.readUInt16BE(2);off=4;}else if(len===127){if(c.buffer.length<10)return;const n=c.buffer.readBigUInt64BE(2);if(n>BigInt(Number.MAX_SAFE_INTEGER))return cleanup(c);len=Number(n);off=10;}const maskLen=masked?4:0;if(c.buffer.length<off+maskLen+len)return;let payload=c.buffer.subarray(off+maskLen,off+maskLen+len);if(masked){const mask=c.buffer.subarray(off,off+4);const out=Buffer.alloc(len);for(let i=0;i<len;i++)out[i]=payload[i]^mask[i%4];payload=out;}c.buffer=c.buffer.subarray(off+maskLen+len);if(opcode===0x8){cleanup(c);try{c.socket.end();}catch{}return;}if(opcode===0x9){try{c.socket.write(Buffer.from([0x8A,0x00]));}catch{}continue;}if(opcode!==0x1)continue;try{handleMessage(c,JSON.parse(payload.toString('utf8')));}catch{}}
}
server.on('upgrade',(req,socket)=>{
  if(req.headers.upgrade?.toLowerCase()!=='websocket'){socket.destroy();return;}
  const key=req.headers['sec-websocket-key'];if(!key){socket.destroy();return;}
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const c={socket,buffer:Buffer.alloc(0),roomCode:null,role:null,closed:false};clients.add(c);
  socket.on('data',chunk=>parseFrames(c,chunk));socket.on('close',()=>cleanup(c));socket.on('error',()=>cleanup(c));
});
setInterval(()=>{const cutoff=Date.now()-1000*60*60*6;for(const [code,room] of rooms){if(room.created<cutoff){send(room.host,{type:'peer_left',reason:'Room expired'});send(room.guest,{type:'peer_left',reason:'Room expired'});rooms.delete(code);}}},60000).unref();
server.listen(PORT,()=>console.log(`Crimson Dusk Online listening on port ${PORT}`));
