const crypto = require('node:crypto');
const path = require('node:path');
const { createMessengerStore } = require('../../messengerStore');

const VEHICLES = ['highwater','redline','blackwater','tidal','pearl','violet','silverback','paddle','volt-mx','flux-trail','tundra'];
const MAPS = ['bog','pond','dunes','endless'];
const TTL = 20000;
const fail = (message,status=400) => Object.assign(new Error(message),{status});
const clean = (v,n) => String(v||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n);
const hash = v => crypto.createHash('sha256').update(String(v||'')).digest('hex');
const random = () => crypto.randomBytes(24).toString('base64url');
const clamp = (v,a,b) => Math.max(a,Math.min(b,Number(v)||0));
function build(value={}) {
  if(!VEHICLES.includes(value.vehicle))throw fail('Choose a valid vehicle.');
  const result={vehicle:value.vehicle,tires:['mud','paddle','trail'].includes(value.tires)?value.tires:'mud'};
  for(const [key,a,b]of [['power',60,200],['spring',15,95],['damping',10,90],['lift',30,78],['radius',25,48],['snorkel',45,180]])result[key]=clamp(value[key],a,b);
  return result;
}
function state(value,previous,now) {
  if(!value||!['x','y','angle','vx','vy'].every(k=>Number.isFinite(value[k])))throw fail('Invalid vehicle state.');
  if(value.x<0||value.x>1e8||value.y< -1000||value.y>1500||Math.abs(value.vx)>45||Math.abs(value.vy)>45)throw fail('Vehicle movement exceeds the park limits.');
  if(previous){
    const seconds=Math.min(2,Math.max(.05,(now-previous.at)/1000));
    if(Math.hypot(value.x-previous.x,value.y-previous.y)>seconds*2100+90)throw fail('Movement rejected. Recover your vehicle to resync.',409);
  }else if(value.x>1600)throw fail('New players must spawn at the garage.');
  if(!Array.isArray(value.wheels)||value.wheels.length!==2)throw fail('Two wheel states are required.');
  const wheels=value.wheels.map(w=>{
    if(!w||!['x','y','angle'].every(k=>Number.isFinite(w[k]))||Math.hypot(w.x-value.x,w.y-value.y)>240)throw fail('Invalid suspension state.');
    return {x:w.x,y:w.y,angle:w.angle%(Math.PI*2)};
  });
  return {x:value.x,y:value.y,angle:value.angle%(Math.PI*2),vx:value.vx,vy:value.vy,wheels,throttle:!!value.throttle,braking:!!value.braking,lights:!!value.lights,awd:!!value.awd,diff:!!value.diff,stalled:!!value.stalled,dirt:clamp(value.dirt,0,1),terrain:['mud','water','sand','trail'].includes(value.terrain)?value.terrain:'trail',at:now};
}
function createHandler({storage,now=Date.now}={}) {
  // Dedicated key: game snapshots never contend with Messages or its call signaling.
  storage ||= createMessengerStore({key:'velos:mudline-rooms-v1',file:path.join(__dirname,'../../../data/mudline-rooms.json')});
  return async (req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    try{
      if(req.method!=='POST')throw fail('Use POST.',405);
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw fail('Cross-site request denied.',403);
      let raw='';if(req.body)raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
      else for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>10000)throw fail('Request too large.',413);}
      if(Buffer.byteLength(raw)>10000)throw fail('Request too large.',413);
      let input;try{input=JSON.parse(raw);}catch{throw fail('Invalid JSON.');}
      const time=now(),action=input.action;
      // Generate once, outside transaction retries.
      const token=random(),id=crypto.randomUUID(),code='MUD-'+crypto.randomBytes(4).toString('hex').toUpperCase();
      const result=await storage.transact(rawStore=>{
        const store=rawStore||{rooms:{},rates:{}};store.rates||={};
        for(const [key,room]of Object.entries(store.rooms)){
          for(const [pid,p]of Object.entries(room.players))if(time-p.seen>TTL)delete room.players[pid];
          room.tows=room.tows.filter(t=>room.players[t.a]&&room.players[t.b]);
          if(!Object.keys(room.players).length)delete store.rooms[key];
          else if(!room.players[room.host])room.host=Object.keys(room.players)[0];
        }
        for(const [key,rate]of Object.entries(store.rates))if(time-rate.at>60000)delete store.rates[key];
        const ip=hash(req.socket?.remoteAddress||req.headers['x-forwarded-for']||'unknown');
        if(['create','join','list'].includes(action)){
          const rate=store.rates[ip]||{at:time,count:0};rate.count++;store.rates[ip]=rate;
          if(rate.count>60)throw fail('Too many lobby requests. Wait a minute.',429);
        }
        if(action==='list')return {store,result:{rooms:Object.values(store.rooms).filter(r=>r.public).map(r=>({code:r.code,name:r.name,map:r.map,count:Object.keys(r.players).length,max:r.max}))}};
        let room=store.rooms[clean(input.code,24).toUpperCase()];
        if(action==='create'){
          if(Object.keys(store.rooms).length>=64)throw fail('All park sessions are busy. Try again later.',503);
          if(!MAPS.includes(input.map))throw fail('Choose a park map.');
          room={code,name:clean(input.name,32)||'Mud Park',max:Math.round(clamp(input.max,2,8)),public:!!input.public,map:input.map,restriction:['all','atv','sxs'].includes(input.restriction)?input.restriction:'all',collisions:!!input.collisions,host:id,created:time,players:{},chat:[],tows:[],event:null,weather:'clear',dayTime:'afternoon'};
          store.rooms[code]=room;
        }
        if(!room)throw fail('Lobby not found or expired. Ask your friend for a new code.',404);
        let player;
        if(action==='create'||action==='join'){
          if(Object.keys(room.players).length>=room.max)throw fail('This lobby is full.',409);
          const custom=build(input.build);
          if(room.restriction==='atv'&&['tidal','volt-mx','flux-trail','tundra'].includes(custom.vehicle)||room.restriction==='sxs'&&custom.vehicle!=='tidal')throw fail('Your vehicle does not match this lobby restriction. Change it in the garage.');
          player={id,name:clean(input.username,20)||'Rider',auth:hash(token),build:custom,seen:time,joined:time,state:null,lastChat:0,lastRecover:0};room.players[id]=player;
        }else{
          player=room.players[input.id];if(!player||player.auth!==hash(input.token))throw fail('Session expired. Rejoin the lobby.',401);
          player.seen=time;
        }
        if(action==='leave'){delete room.players[player.id];return {store,result:{left:true}};}
        if(action==='sync'){
          if(player.lastSync&&time-player.lastSync<100)throw fail('Updates are arriving too quickly.',429);
          const next=state(input.state,player.state,time);
          if(room.map!=='endless'&&next.x>7300)throw fail('Vehicle is outside this map.');
          player.state=next;player.lastSync=time;
          const event=room.event,progress=event?.progress?.[player.id];
          if(progress&&!progress.finished&&time>=event.start&&time<event.end){
            const target=event.targets[progress.checkpoint];
            if(Math.abs(next.x-target)<160&&!next.stalled){progress.checkpoint++;if(progress.checkpoint===event.targets.length){progress.finished=time;room.chat.push({id:crypto.randomUUID(),name:'Park',text:player.name+' completed '+event.name,at:time});}}
          }
          if(event&&(time>event.end||(Object.keys(event.progress).length>0&&Object.values(event.progress).every(p=>p.finished))))event.finished=true;
          for(const tow of room.tows)if(tow.active){const a=room.players[tow.a]?.state,b=room.players[tow.b]?.state;if(!a||!b||Math.hypot(a.x-b.x,a.y-b.y)>650)tow.broken=true;}
          room.tows=room.tows.filter(t=>!t.broken&& (t.active||time-t.created<15000));
        }else if(action==='recover'){
          if(time-player.lastRecover<3000)throw fail('Recovery is cooling down.');
          player.state=null;player.lastRecover=time;room.tows=room.tows.filter(t=>t.a!==player.id&&t.b!==player.id);
          if(room.event?.progress[player.id])delete room.event.progress[player.id];
        }else if(action==='chat'){
          if(time-player.lastChat<1000)throw fail('Wait a moment before sending another message.',429);
          const text=clean(input.text,180);if(!text)throw fail('Enter a message.');
          room.chat.push({id:crypto.randomUUID(),playerId:player.id,name:player.name,text,at:time});player.lastChat=time;
        }else if(action==='tow'){
          const other=room.players[input.target];
          if(!other||other.id===player.id||!other.state||!player.state)throw fail('Choose a nearby player.');
          const distance=Math.hypot(player.state.x-other.state.x,player.state.y-other.state.y);
          if(distance>450)throw fail('Move closer to attach a recovery line.');
          if(room.tows.some(t=>[t.a,t.b].includes(player.id)||[t.a,t.b].includes(other.id)))throw fail('One recovery line per vehicle.');
          room.tows.push({a:player.id,b:other.id,active:false,kind:input.kind==='strap'?'strap':'winch',length:Math.max(120,distance),created:time});
        }else if(action==='acceptTow'){
          const tow=room.tows.find(t=>t.b===player.id&&!t.active);if(!tow)throw fail('No pending recovery request.');tow.active=true;
        }else if(action==='detach')room.tows=room.tows.filter(t=>t.a!==player.id&&t.b!==player.id);
        else if(action==='event'){
          if(room.host!==player.id)throw fail('Only the lobby host can start an activity.',403);
          if(room.event&&!room.event.finished&&time<room.event.end)throw fail('An activity is already running.');
          const definitions={drag:['Mud drag',[2200,2800,3400]],hill:['Hill climb',[3600,4400]],trail:['Trail run',[2000,3200,4800,6000]],bounty:['Bounty hole',[2200,2600,3000]],team:['Team trail',[2000,3200,4400]]};
          const def=definitions[input.kind];if(!def)throw fail('Choose an activity.');
          room.event={id:crypto.randomUUID(),name:def[0],kind:input.kind,targets:def[1],start:time+15000,end:time+315000,progress:{},finished:false};
        }else if(action==='enterEvent'){
          if(!room.event||time>room.event.start||!player.state||player.state.x>1700)throw fail('Join at the garage before the countdown ends.');
          room.event.progress[player.id]={checkpoint:0,finished:0};
        }else if(!['create','join','sync','recover','chat','tow','acceptTow','detach','event','enterEvent'].includes(action))throw fail('Unknown park action.');
        room.chat=room.chat.slice(-40);
        const snapshot={...room,players:Object.values(room.players).map(({auth,lastChat,lastSync,...p})=>p)};
        return {store,result:{room:snapshot,serverTime:time,...(['create','join'].includes(action)?{id,token}:{}),transport:'http-snapshot',interval:200}};
      });
      res.statusCode=200;res.end(JSON.stringify(result));
    }catch(error){res.statusCode=error.status||503;res.end(JSON.stringify({message:error.status?error.message:'Multiplayer storage is unavailable. Check Redis configuration and redeploy.'}));}
  };
}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.validateState=state;
