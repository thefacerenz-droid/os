/* global MudModels, lucide */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const settings={names:true,chat:true,hideChat:false,...read('mudline-social-settings',{})};
  const muted=new Set();
  let game,session=null,room=null,timer=null,epoch=0,failures=0,history=new Map(),samples=[],spectating=null,queue=Promise.resolve(),clockOffset=0;
  let controls={lights:false,awd:true,diff:false};
  const dialog=document.createElement('dialog');dialog.id='socialPanel';dialog.innerHTML='<header><h1 id="socialTitle">Mud Park</h1><button id="closeSocial" aria-label="Close multiplayer panel"><i data-lucide="x"></i></button></header><div id="socialContent"></div><p id="socialError" role="alert"></p>';document.body.append(dialog);
  const sidebar=document.createElement('aside');sidebar.id='parkPlayers';sidebar.hidden=true;document.body.append(sidebar);
  const chat=document.createElement('section');chat.id='parkChat';chat.hidden=true;chat.innerHTML='<div id="chatLog" role="log" aria-live="polite"></div><form id="chatForm"><input id="chatText" aria-label="Chat message" maxlength="180" placeholder="Message the park" autocomplete="off"><button aria-label="Send message"><i data-lucide="send"></i></button></form>';document.body.append(chat);
  function icons(){lucide.createIcons();}
  function open(title,html){game.release();$('socialTitle').textContent=title;$('socialContent').innerHTML=html;$('socialError').textContent='';if(!dialog.open)dialog.showModal();icons();}
  function close(){dialog.close();game.release();}
  $('closeSocial').onclick=close;
  function error(e){$('socialError').textContent=e.message;game.toast(e.message);}
  async function request(action,data={}){
    const response=await fetch('/api/games/mudline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,...data,action}),signal:AbortSignal.timeout(5000)});
    let result;try{result=await response.json();}catch{throw new Error('The multiplayer server did not return JSON. Deploy the game API with the website.');}
    if(!response.ok)throw Object.assign(new Error(result.message||'Unable to connect to the park.'),{status:response.status});return result;
  }
  function accept(result){
    room=result.room;clockOffset=result.serverTime-Date.now();
    const current=new Set();
    for(const player of room.players){
      if(player.id===session.id||!player.state)continue;current.add(player.id);
      let buffer=history.get(player.id)||[];
      if(!buffer.length||buffer.at(-1).at!==player.state.at)buffer.push({...player.state});
      history.set(player.id,buffer.slice(-12));
    }
    for(const id of history.keys())if(!current.has(id))history.delete(id);
    if(spectating&&!current.has(spectating))spectating=null;
    updateHud();
  }
  function command(action,data={}){
    const generation=epoch;
    const task=queue.then(async()=>{if(!session||generation!==epoch)return;const result=await request(action,data);if(generation===epoch&&result.room)accept(result);return result;});queue=task.catch(()=>{});return task;
  }
  function schedule(generation,delay=200){clearTimeout(timer);timer=setTimeout(async()=>{
    if(generation!==epoch||!session)return;
    try{await command('sync',{state:game.snapshot(controls)});failures=0;}
    catch(e){failures++;if(e.status===401||e.status===404){await leave(false);game.toast(e.message);return;}if(failures===1)game.toast(e.message);}
    if(generation===epoch&&session){updateHud();schedule(generation,failures?Math.min(2000,400*failures):200);}
  },delay);}
  async function connect(action,data){
    const button=$('connectPark');if(button)button.disabled=true;
    try{
      if(session)await leave();
      const result=await request(action,{...data,build:game.build()});
      session={id:result.id,token:result.token,code:result.room.code};epoch++;history.clear();samples=[];
      game.enter(result.room.map,180+180*(result.room.players.length-1));accept(result);close();schedule(epoch);game.toast('Joined '+room.name);
    }catch(e){error(e);}finally{if(button)button.disabled=false;}
  }
  async function leave(send=true){
    clearTimeout(timer);epoch++;const old=session;session=null;room=null;history.clear();samples=[];spectating=null;
    sidebar.hidden=true;chat.hidden=true;game?.exit();
    if(old&&send)try{await fetch('/api/games/mudline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...old,action:'leave'}),signal:AbortSignal.timeout(2000)});}catch{}
  }
  function username(){return read('mudline-player-name','Rider');}
  function remember(){try{localStorage.setItem('mudline-player-name',JSON.stringify($('riderName').value.trim()||'Rider'));}catch{}return $('riderName').value;}
  function create(){
    open('Create a lobby',`<form id="lobbyForm" class="park-form"><label>Your name<input id="riderName" maxlength="20" value="${esc(username())}" required></label><label>Lobby name<input id="lobbyName" maxlength="32" value="Mud Park" required></label><label>Max players<select id="maxPlayers">${[2,3,4,5,6,7,8].map(n=>`<option ${n===8?'selected':''}>${n}</option>`).join('')}</select></label><label>Visibility<select id="visibility"><option value="private">Private</option><option value="public">Public</option></select></label><label>Map<select id="parkMap"><option value="endless">Endless Backcountry</option><option value="bog">Cypress Bog</option><option value="pond">Backwater Ponds</option><option value="dunes">Sunbreak Dunes</option></select></label><label>Vehicles<select id="restriction"><option value="all">All builds</option><option value="atv">ATVs only</option><option value="sxs">Side-by-sides only</option></select></label><label class="park-check"><input id="collisions" type="checkbox">Player collisions</label><button id="connectPark" class="ride-button">Create lobby</button></form>`);
    $('lobbyForm').onsubmit=e=>{e.preventDefault();connect('create',{username:remember(),name:$('lobbyName').value,max:Number($('maxPlayers').value),public:$('visibility').value==='public',map:$('parkMap').value,restriction:$('restriction').value,collisions:$('collisions').checked});};
  }
  function join(code=''){
    open('Join a lobby',`<form id="lobbyForm" class="park-form"><label>Your name<input id="riderName" maxlength="20" value="${esc(username())}" required></label><label>Lobby code<input id="lobbyCode" maxlength="24" value="${esc(code)}" placeholder="MUD-XXXXXXXX" autocapitalize="characters" required></label><button id="connectPark" class="ride-button">Join lobby</button></form>`);
    $('lobbyForm').onsubmit=e=>{e.preventDefault();connect('join',{username:remember(),code:$('lobbyCode').value.trim().toUpperCase()});};
  }
  async function publicServers(){
    open('Public servers','<p>Loading parks...</p>');
    try{const result=await request('list');$('socialContent').replaceChildren();if(!result.rooms.length)$('socialContent').textContent='No public parks online.';
      for(const r of result.rooms){const b=document.createElement('button');b.className='server-row';b.textContent=`${r.name} / ${r.map} / ${r.count} of ${r.max}`;b.disabled=r.count>=r.max;b.onclick=()=>join(r.code);$('socialContent').append(b);}
    }catch(e){error(e);}
  }
  function multiplayer(){if(room)return players();open('Multiplayer','<div class="park-menu"><button id="createLobby">Create lobby</button><button id="joinLobby">Join lobby</button><button id="publicServers">Public servers</button></div>');$('createLobby').onclick=create;$('joinLobby').onclick=()=>join();$('publicServers').onclick=publicServers;}
  function main(){open('MUDLINE','<div class="park-menu"><button id="solo">Play solo</button><button id="multi">Multiplayer</button><button id="mainGarage">Garage</button><button id="settings">Settings</button></div>');$('solo').onclick=async()=>{await leave();close();};$('multi').onclick=multiplayer;$('mainGarage').onclick=()=>{close();game.garage();};$('settings').onclick=showSettings;}
  function showSettings(){
    open('Settings',`<div class="park-form">${[['names','Player names'],['chat','Enable chat'],['hideChat','Hide chat']].map(([key,label])=>`<label class="park-check"><input type="checkbox" data-setting="${key}" ${settings[key]?'checked':''}>${label}</label>`).join('')}</div>`);
    dialog.querySelectorAll('[data-setting]').forEach(el=>el.onchange=()=>{settings[el.dataset.setting]=el.checked;try{localStorage.setItem('mudline-social-settings',JSON.stringify(settings));}catch{}updateHud();});
  }
  function updateHud(){
    if(!room)return;sidebar.hidden=false;chat.hidden=!settings.chat||settings.hideChat;
    const old=sidebar.querySelector('button');
    if(!old){const b=document.createElement('button');b.onclick=players;sidebar.append(b);}
    sidebar.firstChild.textContent=`${room.name} / ${room.players.length}/${room.max}${failures?' / Reconnecting...':room.tows.some(t=>t.b===session.id&&!t.active)?' / Recovery request':''}`;
    let list=sidebar.querySelector('small');if(!list){list=document.createElement('small');sidebar.append(list);}list.textContent=room.players.map(p=>p.name).join('  /  ');
    let activity=sidebar.querySelector('output');if(!activity){activity=document.createElement('output');sidebar.append(activity);}const event=room.event,progress=event?.progress[session.id];activity.textContent=event&&!event.finished?`${event.name}${Date.now()+clockOffset<event.start?' / '+Math.ceil((event.start-Date.now()-clockOffset)/1000)+'s':progress?' / '+progress.checkpoint+' of '+event.targets.length:' / Freestyle'}`:'';
    const messages=room.chat.filter(m=>!muted.has(m.playerId));const log=$('chatLog');
    const signature=messages.map(m=>m.id).join(',');
    if(log.dataset.signature!==signature){log.dataset.signature=signature;log.replaceChildren();for(const m of messages){const line=document.createElement('div');line.textContent=m.name+': '+m.text;log.append(line);}log.scrollTop=log.scrollHeight;}
  }
  function players(){
    if(!room)return multiplayer();
    const me=game.snapshot(controls);
    open(room.name,`<div class="park-actions"><button id="copyCode"><i data-lucide="copy"></i>${esc(room.code)}</button><button id="parkSettings"><i data-lucide="settings"></i>Settings</button><button id="leavePark">Leave park</button></div><div class="park-actions">${[['lights','Headlights'],['awd','4WD'],['diff','Diff lock']].map(([key,label])=>`<label class="park-check"><input type="checkbox" data-drive="${key}" ${controls[key]?'checked':''}>${label}</label>`).join('')}</div><div id="riderList"></div><div class="park-actions"><button id="detachTow">Detach line</button><button id="stopSpectating">Drive my vehicle</button></div><h2>Activities</h2><div id="activities"></div>`);
    $('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);game.toast('Lobby code copied');}catch{game.toast(room.code);}};
    $('parkSettings').onclick=showSettings;$('leavePark').onclick=async()=>{await leave();close();};
    dialog.querySelectorAll('[data-drive]').forEach(el=>el.onchange=()=>controls[el.dataset.drive]=el.checked);
    $('detachTow').onclick=()=>command('detach').then(players).catch(error);$('stopSpectating').onclick=()=>{spectating=null;close();};
    for(const player of room.players){
      const row=document.createElement('div');row.className='rider-row';const name=document.createElement('strong');name.textContent=player.name+' / '+game.vehicleName(player.build.vehicle);row.append(name);
      if(player.id!==session.id){
        const near=player.state&&Math.hypot(player.state.x-me.x,player.state.y-me.y)<450;
        function button(label,fn,disabled=false){const b=document.createElement('button');b.textContent=label;b.onclick=fn;b.disabled=disabled;row.append(b);}
        button(muted.has(player.id)?'Unmute':'Mute',()=>{muted.has(player.id)?muted.delete(player.id):muted.add(player.id);players();updateHud();});
        button('Inspect build',()=>inspect(player),!near);
        button('Spectate',()=>{spectating=player.id;close();});
        button('Attach winch',()=>command('tow',{target:player.id,kind:'winch'}).then(()=>game.toast('Recovery request sent')).catch(error),!near);
        button('Attach tow strap',()=>command('tow',{target:player.id,kind:'strap'}).then(()=>game.toast('Recovery request sent')).catch(error),!near);
      }
      $('riderList').append(row);
    }
    if(room.tows.some(t=>t.b===session.id&&!t.active)){const accept=document.createElement('button');accept.textContent='Accept recovery line';accept.onclick=()=>command('acceptTow').then(players).catch(error);$('riderList').prepend(accept);}
    const activities=$('activities');
    if(room.event&&!room.event.finished){const text=document.createElement('p');text.textContent=room.event.name+' / '+Object.keys(room.event.progress).length+' riders';activities.append(text);const enter=document.createElement('button');enter.textContent='Join activity';enter.onclick=()=>command('enterEvent').then(()=>game.toast('Activity joined')).catch(error);activities.append(enter);}
    else if(room.host===session.id){for(const [kind,label]of [['drag','Mud drag'],['hill','Hill climb'],['trail','Trail run'],['bounty','Bounty hole'],['team','Team trail']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>command('event',{kind}).then(players).catch(error);activities.append(b);}}
    else activities.textContent='Freestyle';icons();
  }
  function inspect(player){open(player.name+' / Build',`<dl class="build-inspect">${Object.entries(player.build).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`);}
  $('chatForm').onsubmit=async e=>{e.preventDefault();if(!settings.chat)return;try{await command('chat',{text:$('chatText').value});$('chatText').value='';}catch(e){game.toast(e.message);}};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
  function sample(id){
    const buffer=history.get(id);if(!buffer?.length)return null;
    const target=Date.now()+clockOffset-300;
    let a=buffer[0],b=a;for(const frame of buffer){b=frame;if(frame.at>=target)break;a=frame;}
    if(a===b){const dt=Math.max(0,Math.min(.25,(target-a.at)/1000)),dx=a.vx*60*dt,dy=a.vy*60*dt;return {...a,x:a.x+dx,y:a.y+dy,wheels:a.wheels.map(w=>({...w,x:w.x+dx,y:w.y+dy}))};}
    const t=Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at)));
    return {...b,x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),angle:angle(a.angle,b.angle,t),wheels:b.wheels.map((w,i)=>({x:lerp(a.wheels[i].x,w.x,t),y:lerp(a.wheels[i].y,w.y,t),angle:angle(a.wheels[i].angle,w.angle,t)}))};
  }
  function forces(local){
    if(!room||spectating||failures>2)return {x:0,y:0};
    let x=0,y=0;
    for(const other of room.players){
      if(other.id===session.id||!other.state||Date.now()+clockOffset-other.state.at>1500)continue;
      const dx=other.state.x-local.x,dy=other.state.y-local.y,dist=Math.max(1,Math.hypot(dx,dy));
      // Soft contact caps impulses and ghosts the shared garage to avoid spawn pileups.
      if(room.collisions&&local.x>1700&&Math.abs(dx)<130&&Math.abs(dy)<50){x-=Math.sign(dx)*Math.min(.005,(130-Math.abs(dx))*.00006);}
      const tow=room.tows.find(t=>t.active&&((t.a===session.id&&t.b===other.id)||(t.b===session.id&&t.a===other.id)));
      if(tow){const length=tow.kind==='winch'?Math.max(160,tow.length-(Date.now()+clockOffset-tow.created)*.018):tow.length;const own=game.snapshot(controls),relative=(other.state.vx-own.vx)*dx/dist+(other.state.vy-own.vy)*dy/dist;const pull=dist>length?Math.max(0,Math.min(.012,(dist-length)*.00012+relative*.0002)):0;x+=dx/dist*pull;y+=dy/dist*pull;}
    }
    return {x:Math.max(-.017,Math.min(.017,x)),y:Math.max(-.012,Math.min(.012,y))};
  }
  function draw(c){
    if(!room)return;
    const now=Date.now()+clockOffset;
    for(const player of room.players){
      if(player.id===session.id)continue;const s=sample(player.id);if(!s)continue;
      c.save();if(now-s.at>1500)c.globalAlpha=.4;game.drawRemote(c,player.build,s,player.id);
      if(s.lights){c.fillStyle='#fff3a42b';c.beginPath();c.moveTo(s.x+60,s.y-10);c.lineTo(s.x+320,s.y-45);c.lineTo(s.x+320,s.y+60);c.fill();}
      if(settings.names){c.font='bold 12px Arial';c.textAlign='center';c.fillStyle='#102e34';c.fillText(player.name,s.x,s.y-player.build.snorkel-38);}
      if(s.throttle&&['mud','water','sand'].includes(s.terrain)&&samples.length<300){const wheel=s.wheels[0];for(let i=0;i<6&&samples.length<300;i++)samples.push({x:wheel.x,y:wheel.y+player.build.radius*.5,vx:-3-Math.random()*8,vy:-4-Math.random()*11,life:40,wet:s.terrain==='water'});}c.restore();
    }
    for(const tow of room.tows){if(!tow.active)continue;const a=tow.a===session.id?game.snapshot(controls):sample(tow.a),b=tow.b===session.id?game.snapshot(controls):sample(tow.b);if(!a||!b)continue;c.strokeStyle=tow.kind==='strap'?'#ebbe65':'#aabdc0';c.lineWidth=3;c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+16,b.x,b.y);c.stroke();}
    for(const p of samples){p.x+=p.vx;p.y+=p.vy;p.vy+=.23;p.life--;c.globalAlpha=p.life/35;c.fillStyle=p.wet?'#96d6de':'#785535';c.fillRect(p.x,p.y,4,3);}c.globalAlpha=1;samples=samples.filter(p=>p.life>0);
    const event=room.event,progress=event?.progress[session.id];if(progress&&!progress.finished&&!event.finished){const x=event.targets[progress.checkpoint];c.strokeStyle='#f4e18a';c.lineWidth=4;c.beginPath();c.moveTo(x,game.heightAt(x)-110);c.lineTo(x,game.heightAt(x));c.stroke();c.fillStyle='#173b40';c.font='bold 13px Arial';c.fillText('CHECKPOINT',x,game.heightAt(x)-120);}
  }
  window.MudMultiplayer={
    init(api){game=api;const button=document.createElement('button');button.id='parkMenu';button.title='Main menu';button.setAttribute('aria-label','Main menu');button.innerHTML='<i data-lucide="menu"></i>';button.onclick=main;document.querySelector('.hud nav').prepend(button);icons();},
    active:()=>!!session,blocked:()=>dialog.open||!!spectating||document.activeElement?.tagName==='INPUT',controls:()=>controls,
    forces,draw,camera:()=>spectating?sample(spectating):null,
    recover:async()=>{if(!session)return false;try{await command('recover');game.enter(room.map);return true;}catch(e){game.toast(e.message);return true;}},
    state:()=>({connected:!!session,code:room?.code,id:session?.id,players:room?.players.map(p=>({id:p.id,name:p.name,build:p.build,state:p.state})),tows:room?.tows,event:room?.event,failures,collisions:room?.collisions,remoteCount:history.size,host:room?.host}),
    leave,main
  };
  addEventListener('pagehide',()=>{if(session)navigator.sendBeacon('/api/games/mudline',new Blob([JSON.stringify({...session,action:'leave'})],{type:'application/json'}));});
})();
