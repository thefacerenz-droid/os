/* global Matter, lucide */
(() => {
  'use strict';
  const { Engine, Bodies, Body, Composite, Constraint, Vector } = Matter;
  const $ = id => document.getElementById(id);
  const canvas = $('scene'), ctx = canvas.getContext('2d');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clone = value => JSON.parse(JSON.stringify(value));
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast('Storage unavailable. This session still works.'); return false; } }
  const vehicles = [
    { id: 'highwater', name: 'Highwater 1000', body: '#f2f0df', trim: '#b52e4a', rim: '#d7e1db', frame: '#e7eada', lift: 1.1, length: 132, mass: 6, snorkel: true },
    { id: 'redline', name: 'Redline Rancher', body: '#c4383d', trim: '#262e35', rim: '#465057', frame: '#354348', lift: .9, length: 128, mass: 6.4, snorkel: true },
    { id: 'blackwater', name: 'Blackwater Max', body: '#30393c', trim: '#9baf8e', rim: '#6c7780', frame: '#505958', lift: 1, length: 148, mass: 7, backrest: true },
    { id: 'tidal', name: 'Tidal Crew SXS', body: '#61d3cc', trim: '#225d6a', rim: '#72e0d7', frame: '#4cafb0', lift: 1.2, length: 192, mass: 10, sxs: true },
    { id: 'pearl', name: 'Pearl on Chrome', body: '#f4f4dd', trim: '#be4b4b', rim: '#e2eced', frame: '#d2dfe1', lift: 1.15, length: 135, mass: 6.1, snorkel: true },
    { id: 'violet', name: 'Violet Highrise', body: '#f2f2ec', trim: '#7654bc', rim: '#9571d6', frame: '#7654bc', lift: 1.2, length: 138, mass: 6.3, snorkel: true },
    { id: 'silverback', name: 'Silverback Lift', body: '#dce6df', trim: '#263b3e', rim: '#37484a', frame: '#d2ddd7', lift: 1.2, length: 139, mass: 6.8, snorkel: true },
    { id: 'paddle', name: 'Paddle Monster', body: '#ebebe0', trim: '#303f41', rim: '#e6e9df', frame: '#e7e9df', lift: 1.3, length: 145, mass: 7.1, snorkel: true, disc: true }
  ];
  const defaults = { vehicle: 'highwater', power: 110, spring: 55, damping: 55, lift: 52, radius: 34, snorkel: 75, tires: 'mud', assist: true };
  const saved = read('mudline-tune-v1', {});
  const tune = { ...defaults, ...saved };
  for (const [key, min, max] of [['power',60,200],['spring',15,95],['damping',10,90],['lift',30,78],['radius',25,48]]) tune[key] = clamp(Number(tune[key]) || defaults[key], min, max);
  if (!vehicles.some(v => v.id === tune.vehicle)) tune.vehicle = defaults.vehicle;
  if (!['mud','paddle','trail'].includes(tune.tires)) tune.tires = 'mud';
  tune.assist = Boolean(tune.assist);
  tune.snorkel=clamp(Number(tune.snorkel)||75,45,180);
  const STEP = 48, COUNT = 151, LENGTH = (COUNT - 1) * STEP;
  const mapInfo = {
    bog: { name: 'Cypress Bog', sub: 'Deep ruts / thick mud', sky: '#a9d1c7', far: '#568d83', near: '#376c65', soil: '#695c47', grass: '#6d9660' },
    pond: { name: 'Backwater Ponds', sub: 'Water crossings / rolling trails', sky: '#b1d9df', far: '#639d9e', near: '#437d81', soil: '#7f7960', grass: '#85ac76' },
    dunes: { name: 'Sunbreak Dunes', sub: 'Soft sand / long climbs', sky: '#bddfe0', far: '#c2b787', near: '#c9a96d', soil: '#c39c60', grass: '#e7c886' }
  };
  function makeMap(kind) {
    return { name: mapInfo[kind].name, theme: kind, heights: Array.from({ length: COUNT }, (_, i) => {
      if (i < 8) return 480;
      const x = i - 8;
      return kind === 'dunes' ? 490 - Math.sin(x / 8) * 100 - Math.sin(x / 19) * 70 : kind === 'pond' ? 480 + Math.sin(x / 6) * 48 + Math.sin(x / 17) * 48 : 480 + Math.sin(x / 8) * 32 + Math.sin(x / 2.5) * 12;
    }), surfaces: Array.from({ length: COUNT }, (_, i) => i < 9 ? 'trail' : kind === 'dunes' ? 'sand' : kind === 'pond' ? (i % 28 > 12 && i % 28 < 23 ? 'water' : 'trail') : (i % 24 > 8 && i % 24 < 20 ? 'mud' : 'trail')) };
  }
  function validMap(map) { return map && typeof map.name === 'string' && map.name.length <= 40 && mapInfo[map.theme] && Array.isArray(map.heights) && map.heights.length === COUNT && map.heights.every(h => Number.isFinite(h) && h >= 250 && h <= 700) && Array.isArray(map.surfaces) && map.surfaces.length === COUNT && map.surfaces.every(s => ['trail','mud','water','sand'].includes(s)); }
  let customMaps = read('mudline-maps-v1', []);
  customMaps = Array.isArray(customMaps) ? customMaps.filter(validMap).slice(0,20) : [];
  let map = makeMap('bog'), engine, chassis, wheels = [], springs = [], particles = [];
  let endless=false,streamed=new Map(),lastStream=-999,flood=0,stalled=false,intakeClearance=999;
  let bestEndless=Number(read('mudline-endless-best-v1',0))||0;
  let width = 1000, height = 650, zoom = 1, camera = { x: 0, y: 0 }, paused = false, editing = false, activePanel = '', time = 0, stepCount = 0;
  let wheelieTime = 0, bestWheelie = Number(read('mudline-best-v1', 0)) || 0, checkpoint = 180, finished = false, brushActive = false, undoStack = [], stroke = null;
  const inputs = { gas: false, brake: false, wheelie: false, up: false, down: false };
  let toastTimer;
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200); }
  function rig() { return {...vehicles.find(v => v.id === tune.vehicle),snorkelHeight:tune.snorkel}; }
  const savedDirt=read('mudline-dirt-v1',{});
  const dirt=Object.fromEntries(vehicles.map(v=>[v.id,clamp(Number(savedDirt?.[v.id])||0,0,1)]));
  function terrainY(x) { const i = endless?Math.max(0,Math.floor(x/STEP)):clamp(Math.floor(x / STEP), 0, COUNT - 2), t = clamp((x - i * STEP) / STEP, 0, 1); return endless?MudEndless.sample(i).height*(1-t)+MudEndless.sample(i+1).height*t:map.heights[i] * (1-t) + map.heights[i+1] * t; }
  function surfaceAt(x) { return endless?MudEndless.sample(Math.max(0,Math.floor(x/STEP))).material:map.surfaces[clamp(Math.floor(x / STEP), 0, COUNT - 1)]; }
  function fluidLevel(x){return endless?MudEndless.sample(Math.max(0,Math.floor(x/STEP))).level:null;}
  function streamTerrain(x){
    const index=Math.floor(x/STEP);if(index===lastStream)return;lastStream=index;
    const first=Math.max(0,index-45),last=index+85;
    for(const [i,body]of streamed)if(i<first||i>last){Composite.remove(engine.world,body);streamed.delete(i);}
    for(let i=first;i<=last;i++)if(!streamed.has(i)){const a=MudEndless.sample(i).height,b=MudEndless.sample(i+1).height;const body=Bodies.rectangle((i+.5)*STEP,(a+b)/2+28,Math.hypot(STEP,b-a)+6,56,{isStatic:true,angle:Math.atan2(b-a,STEP),friction:.9,label:'ground'});streamed.set(i,body);Composite.add(engine.world,body);}
  }
  function createWorld(x = 180) {
    engine = Engine.create({ gravity: { x: 0, y: 1, scale: .001 }, positionIterations: 8, velocityIterations: 8, constraintIterations: 5 });
    const ground = [];
    streamed=new Map();lastStream=-999;flood=0;stalled=false;
    for (let i = 0; !endless && i < COUNT - 1; i++) {
      const dy = map.heights[i+1] - map.heights[i], length = Math.hypot(STEP, dy);
      ground.push(Bodies.rectangle((i + .5) * STEP, (map.heights[i] + map.heights[i+1]) / 2 + 28, length + 6, 56, { isStatic: true, angle: Math.atan2(dy, STEP), friction: .9, label: 'ground' }));
    }
    ground.push(Bodies.rectangle(-35, 430, 60, 1600, { isStatic: true }));
    if(!endless)ground.push(Bodies.rectangle(LENGTH+35,430,60,1600,{isStatic:true}));
    Composite.add(engine.world, ground);
    if(endless)streamTerrain(x);
    spawn(x); particles = []; wheelieTime = 0; finished = false;
    $('mapLabel').textContent = map.name;
  }
  function spawn(x) {
    const v = rig(), r = tune.radius, lift = tune.lift * v.lift;
    const y = terrainY(x) - r - lift - 15;
    const group = Body.nextGroup(true);
    chassis = Bodies.rectangle(x, y, v.length, 27, { chamfer: { radius: 9 }, friction: .5, frictionAir: .003, collisionFilter: { group }, label: 'chassis' });
    Body.setMass(chassis, v.mass);
    wheels = [-1,1].map(side => {
      const wheel = Bodies.circle(x + side * v.length * .4, y + lift, r, { friction: .95, frictionStatic: 2, restitution: .02, frictionAir: .002, collisionFilter: { group }, label: 'wheel' });
      Body.setMass(wheel, 1.4); return wheel;
    });
    springs = [];
    wheels.forEach((wheel, i) => {
      const side = i === 0 ? -1 : 1, axle = side * v.length * .4;
      for (const delta of [-18,18]) springs.push(Constraint.create({ bodyA: chassis, pointA: { x: axle + delta, y: 0 }, bodyB: wheel, length: Math.hypot(lift, delta), stiffness: .09 + tune.spring / 600, damping: tune.damping / 250 }));
    });
    Composite.add(engine.world, [chassis, ...wheels, ...springs]);
    camera.x = clamp(x - width / zoom * .32, 0, endless?Infinity:Math.max(0,LENGTH - width / zoom)); camera.y = y - height / zoom * .56;
    $('vehicleLabel').textContent = v.name;
  }
  function recover() { createWorld(checkpoint); release(); toast('Recovered at the last trail marker'); }
  function release() { for (const key in inputs) inputs[key] = false; document.querySelectorAll('.pressed').forEach(b => b.classList.remove('pressed')); }
  function groundContact(wheel) { return Math.abs(wheel.position.y + tune.radius - terrainY(wheel.position.x)) < 18; }
  function simulate() {
    if(endless)streamTerrain(chassis.position.x);
    const intake=MudEndless.intake(chassis.position,chassis.angle,tune.snorkel,rig().length,rig().sxs),level=fluidLevel(intake.x);
    intakeClearance=level===null?999:level-intake.y;
    flood=clamp(flood+(intakeClearance<0?.018:-.009),0,1);
    if(flood>=1&&!stalled){stalled=true;toast('Engine flooded. Recover to the last dry checkpoint.');}
    const gas = inputs.gas&&!stalled ? 1 : 0;
    const reverse = inputs.brake && !stalled && chassis.velocity.x < .6 ? -.45 : 0;
    const power = tune.power / 110, type = surfaceAt(chassis.position.x);
    const contacts = wheels.map(groundContact);
    wheels.forEach((wheel, i) => {
      const material = surfaceAt(wheel.position.x), grip = tune.tires === 'mud' ? { trail:1, mud:.85, water:.65, sand:.55 } : tune.tires === 'paddle' ? { trail:.65, mud:.95, water:.85, sand:1 } : { trail:1.15, mud:.32, water:.3, sand:.55 };
      const drive = gas + reverse;
      if (contacts[i]) {
        Body.applyForce(wheel, wheel.position, { x: drive * .006 * power * grip[material] * (34 / tune.radius), y: 0 });
        Body.setAngularVelocity(wheel, clamp(wheel.angularVelocity + drive * .016 * power, -.3, .7));
      } else Body.setAngularVelocity(wheel, wheel.angularVelocity * .99 + drive * .003);
      if (inputs.brake && !reverse) { Body.setAngularVelocity(wheel, wheel.angularVelocity * .8); Body.applyForce(wheel, wheel.position, { x: -wheel.velocity.x * .0008, y: 0 }); }
      const immersion=fluidLevel(wheel.position.x)===null?0:clamp((wheel.position.y+tune.radius-fluidLevel(wheel.position.x))/(tune.radius*2),0,1);
      const drag = (material === 'mud' ? .0012 : material === 'water' ? .0016 : material === 'sand' ? .00035 : .00003)*(1+immersion*2);
      if(immersion>0)Body.applyForce(wheel,wheel.position,{x:-wheel.velocity.x*.0003*immersion,y:-.00035*immersion});
      if (contacts[i]) Body.applyForce(wheel, wheel.position, { x: -wheel.velocity.x * drag, y: 0 });
      wheel.friction = grip[material];
      const spin=Math.abs(wheel.angularVelocity)*tune.radius;
      if(contacts[i]&&(Math.abs(wheel.velocity.x)>.3||spin>1)&&stepCount%2===0){
        const muddy=material==='mud',wet=material==='water',count=muddy?5:wet?4:2;
        const direction=wheel.velocity.x<-.1?-1:1;
        for(let j=0;j<count;j++)particles.push({x:wheel.position.x-direction*tune.radius*.65,y:wheel.position.y+tune.radius*.55,vx:-direction*(2+Math.random()*5+spin*.22),vy:-2-Math.random()*(muddy?8:5)-spin*.12,life:45+Math.random()*20,maxLife:65,size:muddy?2+Math.random()*5:1+Math.random()*3,material});
        if(muddy)dirt[tune.vehicle]=clamp(dirt[tune.vehicle]+.0025+spin*.00009,0,1);
        if(wet)dirt[tune.vehicle]=Math.max(0,dirt[tune.vehicle]-.003);
        if(material==='sand')dirt[tune.vehicle]=clamp(dirt[tune.vehicle]+.0004,0,1);
      }
    });
    // Rider input shifts pitch; assisted wheelies use a damped target angle.
    if (inputs.wheelie && gas && contacts[0]) {
      if (tune.assist) chassis.torque += clamp((-.55 - chassis.angle) * 4 - chassis.angularVelocity * 22, -2, 2);
      else chassis.torque -= 1.25 * power;
    }
    if (inputs.up) chassis.torque -= .9;
    if (inputs.down || (inputs.brake && !reverse)) chassis.torque += .9;
    if (type === 'water') Body.applyForce(chassis, chassis.position, { x: -chassis.velocity.x * .0005, y: -.001 });
    const bodyLevel=fluidLevel(chassis.position.x);
    if(bodyLevel!==null){const submerged=clamp((chassis.position.y+18-bodyLevel)/60,0,1);Body.applyForce(chassis,chassis.position,{x:-chassis.velocity.x*.0016*submerged,y:-chassis.mass*.00028*submerged});if(submerged>.1)dirt[tune.vehicle]=clamp(dirt[tune.vehicle]+.003,0,1);}
    Engine.update(engine, 1000/60);
    if (contacts[0] && !contacts[1] && chassis.angle < -.14 && chassis.angle > -1.5 && Math.abs(chassis.velocity.x) > .5) wheelieTime += 1/60;
    else { if (wheelieTime > bestWheelie) { bestWheelie = wheelieTime; write('mudline-best-v1', bestWheelie); } wheelieTime = 0; }
    if (chassis.position.x > checkpoint + 700 && type === 'trail' && Math.abs(chassis.angle) < .4) checkpoint = chassis.position.x;
    if (chassis.position.y > 1500 || chassis.position.x < -80) recover();
    if (!endless && chassis.position.x > LENGTH - 220 && !finished) { finished = true; toast('TRAIL COMPLETE! Choose a new map or keep riding.'); }
    if(endless&&stepCount%120===0){bestEndless=Math.max(bestEndless,Math.round((chassis.position.x-180)/12));write('mudline-endless-best-v1',bestEndless);}
    if (Math.abs(chassis.angle) > 2 && stepCount % 180 === 0) toast('Rolled over? Use Recover to get back on the trail.');
    if (particles.length > 320) particles.splice(0, particles.length - 320);
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx*=.99;p.vy += .24; p.life--;if(p.y>terrainY(p.x)){p.y=terrainY(p.x)+1;p.vx*=.45;p.vy=0;p.life-=2;} }); particles = particles.filter(p => p.life > 0);
    if(stepCount%120===0)write('mudline-dirt-v1',dirt);
    stepCount++;
  }
  function line(c, points, color, thickness = 3) { c.beginPath(); points.forEach((p,i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.strokeStyle = color; c.lineWidth = thickness; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
  function poly(c, points, fill, stroke = '#152e35', lw = 3) { c.beginPath(); points.forEach((p,i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); } }
  function circle(c, x, y, r, fill, stroke, lw = 2) { c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle=stroke; c.lineWidth=lw; c.stroke(); } }
  function wheelArt(c, x, y, r, angle, v, tire = tune.tires) {
    if(window.MudModels)return MudModels.wheel(c,x,y,r,angle,v,tire,dirt[v.id]||0);
    c.save(); c.translate(x,y); c.rotate(angle);
    circle(c,0,0,r,'#202d32','#10232a',3);
    const lugs = tire === 'paddle' ? 9 : tire === 'mud' ? 12 : 18;
    for (let i=0;i<lugs;i++) { c.save(); c.rotate(i/lugs*Math.PI*2); poly(c, [[-5,-r+7],[-7,-r-3],[4,-r-6],[8,-r+3]], '#334047', '#15272e', 1.5); c.restore(); }
    circle(c,0,0,r*.66,v.disc ? v.rim : '#182b32',v.rim,3);
    if (!v.disc) for(let i=0;i<8;i++){ c.save(); c.rotate(i*Math.PI/4); poly(c, [[-3,-4],[-4,-r*.57],[1,-r*.6],[4,-9]],v.rim,null); c.restore(); }
    circle(c,0,0,r*.18,'#c5d8d7','#445a62',2);
    for(let i=0;i<6;i++) circle(c,Math.cos(i*Math.PI/3)*r*.27,Math.sin(i*Math.PI/3)*r*.27,1.6,v.disc?'#24393f':'#dcebea');
    c.restore();
  }
  function bodyArt(c,v) {
    if(window.MudModels)return MudModels.body(c,v,dirt[v.id]||0);
    const L=v.length, a=L*.5;
    // Body silhouettes follow the reference rigs, with separate animated axles.
    poly(c,[[-a,-8],[-a+7,-22],[-a+34,-25],[-17,-10],[20,-10],[a-23,-28],[a+7,-24],[a+10,-8],[a-8,3],[-a+12,3]],v.body);
    poly(c,[[-a+22,2],[-25,14],[24,14],[a-15,-4],[a-26,22],[-a+34,22]],'#283c43');
    poly(c,[[-30,-19],[-22,-30],[18,-30],[30,-20]],v.trim);
    line(c,[[-a,-27],[-a+30,-27]],'#24383e',6);
    line(c,[[a-25,-32],[a+2,-32]],'#24383e',6);
    line(c,[[34,-24],[43,-49],[61,-48]],'#21333a',5);
    if(v.snorkel){ line(c,[[a-9,-10],[a-7,-60],[a+3,-63]],v.frame,8); poly(c,[[a-24,-28],[a-34,-58],[a-7,-68],[a+4,-34]],v.frame); line(c,[[a-26,-49],[a-12,-56]],v.trim,4); }
    circle(c,3,2,13,'#50646a','#132d35',3); line(c,[[-10,2],[10,2]],'#afc6c6',2);
    poly(c,[[a-6,-18],[a+7,-17],[a+5,-11],[a-8,-12]],'#fff2ae',null);
    line(c,[[a+7,-6],[a+15,-5],[a+15,-29]],'#273e43',4);
    if(v.backrest) line(c,[[-31,-28],[-39,-52],[-49,-52]],'#22363b',10);
    if(v.sxs){
      poly(c,[[-a+7,-15],[-a+16,-78],[a-28,-78],[a-8,-21]],'#6bbcc522');
      line(c,[[-a+7,-10],[-a+14,-87],[a-24,-87],[a-5,-14]],v.frame,7);
      line(c,[[-19,-83],[-16,-9]],v.frame,5);
      poly(c,[[-a+17,-5],[-a+23,-28],[-30,-28],[-21,-5]],v.body);
      poly(c,[[-14,-5],[-10,-28],[a-20,-28],[a-11,-5]],v.body);
      poly(c,[[-a+3,-85],[-a+9,-96],[a-16,-96],[a-10,-85]],'#24434b');
      poly(c,[[-a+2,-97],[-a+12,-107],[a-10,-107],[a-20,-97]],'#d6e6d8');
      for(let i=0;i<5;i++) circle(c,-a+23+i*20,-72,7,'#243c46',v.rim,2);
    } else {
      // A helmeted rider leans with the chassis.
      line(c,[[-2,-24],[9,-42],[18,-55]],'#24414d',13);
      line(c,[[9,-42],[30,-36],[42,-47]],'#e9b893',6);
      line(c,[[0,-23],[-17,-4],[5,14]],'#1c3440',9);
      circle(c,19,-64,12,v.trim,'#18333c',2);
      poly(c,[[21,-70],[32,-67],[30,-59],[21,-61]],'#c5ecdf',null);
    }
    line(c,[[-a+6,-16],[-a+24,-17]],'#ffffff70',2);
  }
  function drawRig(c,v,bodyPosition,angle,wheelPositions,r,wheelAngles) {
    const toWorld = p => Vector.add(bodyPosition,Vector.rotate(p,angle));
    wheelPositions.forEach((w,i) => {
      const anchor = toWorld({x:(i?1:-1)*v.length*.4,y:5});
      line(c,[[anchor.x,anchor.y],[w.x,w.y]],'#182f36',8);
      const dx=w.x-anchor.x,dy=w.y-anchor.y,len=Math.hypot(dx,dy), nx=-dy/len,ny=dx/len;
      const zig=[[anchor.x,anchor.y]]; for(let s=1;s<10;s++) zig.push([anchor.x+dx*s/10+nx*(s%2?4:-4),anchor.y+dy*s/10+ny*(s%2?4:-4)]); zig.push([w.x,w.y]); line(c,zig,v.frame,3);
      wheelArt(c,w.x,w.y,r,wheelAngles[i],v);
    });
    c.save();c.translate(bodyPosition.x,bodyPosition.y);c.rotate(angle);bodyArt(c,v);c.restore();
  }
  function thumbnail(target,v) {
    target.width=360;target.height=170;const c=target.getContext('2d');c.fillStyle='#24434a';c.fillRect(0,0,360,170);
    const scale=Math.min(v.sxs?1.1:1.25,145/(tune.snorkel+80));c.save();c.translate(180,160-59*scale);c.scale(scale,scale);drawRig(c,{...v,snorkelHeight:tune.snorkel},{x:0,y:0},0,[{x:-v.length*.4,y:32},{x:v.length*.4,y:32}],27,[0,0]);c.restore();
  }
  function scenery() {
    const theme = mapInfo[map.theme];ctx.fillStyle=theme.sky;ctx.fillRect(0,0,width,height);
    circle(ctx,width*.79,height*.22,35,'#f8e7a6');
    for(let layer=0;layer<2;layer++) {
      ctx.beginPath();ctx.moveTo(0,height);
      for(let sx=0;sx<=width+20;sx+=20) { const wx=sx+camera.x*zoom*(layer?.22:.09);ctx.lineTo(sx,height*(layer?.65:.48)+Math.sin(wx/170)*35+Math.sin(wx/63)*12); }
      ctx.lineTo(width,height);ctx.closePath();ctx.fillStyle=layer?theme.near:theme.far;ctx.fill();
    }
    if(map.theme!=='dunes') for(let i=-1;i<width/95+2;i++) {
      const sx=i*95-(camera.x*zoom*.4%95),sy=height*.58+Math.sin(i*7)*22;
      ctx.fillStyle='#285959';ctx.fillRect(sx-3,sy-54,6,83);
      poly(ctx,[[sx-28,sy],[sx,sy-103],[sx+30,sy]],'#3e7770',null);
      poly(ctx,[[sx-24,sy-29],[sx,sy-125],[sx+24,sy-29]],'#4e8679',null);
    }
  }
  function render() {
    if(!engine) return;
    if(!editing){ const tx=clamp(chassis.position.x-width/zoom*.32,0,endless?Infinity:Math.max(0,LENGTH-width/zoom));camera.x+=(tx-camera.x)*.09;camera.y+=(chassis.position.y-height/zoom*.58-camera.y)*.04; }
    scenery();const theme=mapInfo[map.theme];
    ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
    const start=clamp(Math.floor(camera.x/STEP)-2,0,endless?Infinity:COUNT-2),end=clamp(Math.ceil((camera.x+width/zoom)/STEP)+2,1,endless?Infinity:COUNT-1);
    const at=i=>endless?MudEndless.sample(i):{height:map.heights[i],material:map.surfaces[i],level:null};
    ctx.beginPath();ctx.moveTo(start*STEP,1100);for(let i=start;i<=end;i++)ctx.lineTo(i*STEP,at(i).height);ctx.lineTo(end*STEP,1100);ctx.closePath();ctx.fillStyle=theme.soil;ctx.fill();
    for(let i=start;i<end;i++) {
      const x=i*STEP,y=at(i).height,ny=at(i+1).height,material=at(i).material;
      const color={trail:theme.grass,mud:'#544c3c',water:'#3d9ba4',sand:'#ebca88'}[material];
      line(ctx,[[x,y],[x+STEP,ny]],color,8);
      if(material==='water'||material==='mud') {
        if(endless)poly(ctx,[[x,480],[x+STEP,480],[x+STEP,ny],[x,y]],material==='water'?'#367c88':'#65533d',null);
        poly(ctx,[[x,y-18],[x+STEP,ny-18],[x+STEP,ny+7],[x,y+7]],material==='water'?'#429faca8':'#6a6351',null);
        line(ctx,[[x+8,y-15],[x+30,y-15]],material==='water'?'#ade4dc':'#918573',2);
      }
      if(i%3===0){circle(ctx,x+20,y+36,3,'#203b3c33');circle(ctx,x+34,y+57,2,'#203b3c33');}
      if(i%19===0&&material==='trail'){line(ctx,[[x,y-5],[x+6,y-17]],'#709557',3);line(ctx,[[x+5,y-4],[x+14,y-13]],'#8aa669',3);}
    }
    for(let x=Math.max(900,Math.ceil(start*STEP/900)*900);x<end*STEP;x+=900){const y=terrainY(x);line(ctx,[[x,y],[x,y-68]],'#e3d8b4',4);poly(ctx,[[x,y-66],[x+32,y-66],[x+27,y-43],[x,y-43]],'#e8bf57');ctx.fillStyle='#23424a';ctx.font='bold 10px Arial';ctx.fillText(`${Math.round(x/12)}m`,x+3,y-50);}
    if(editing){ctx.strokeStyle='#ffffff25';ctx.lineWidth=1;for(let i=start;i<=end;i++){ctx.beginPath();ctx.moveTo(i*STEP,camera.y);ctx.lineTo(i*STEP,camera.y+height/zoom);ctx.stroke();} }
    else {
      drawRig(ctx,rig(),chassis.position,chassis.angle,wheels.map(w=>w.position),tune.radius,wheels.map(w=>w.angle));
      if(endless)for(let i=start;i<end;i++){const s=at(i);if(s.level!==null){poly(ctx,[[i*STEP,s.level],[(i+1)*STEP,s.level],[(i+1)*STEP,at(i+1).height],[i*STEP,s.height]],s.material==='water'?'#4aa0b16b':'#715737a8',null);line(ctx,[[i*STEP+5,s.level+Math.sin(time*2+i)*2],[i*STEP+32,s.level]],s.material==='water'?'#a2dedb':'#a1895d',2);}}
      for(const p of particles){ctx.globalAlpha=clamp(p.life/20,0,1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.fillStyle=p.material==='water'?'#b3e5dabd':p.material==='sand'?'#d9b574':'#755335';ctx.beginPath();ctx.ellipse(0,0,p.size*(p.material==='water'?2:1.3),p.size,0,0,Math.PI*2);ctx.fill();ctx.restore();}ctx.globalAlpha=1;
    }
    ctx.restore();
    if(!editing){$('speed').textContent=Math.round(Math.abs(chassis.velocity.x)*3);$('distance').textContent=Math.max(0,Math.round((chassis.position.x-180)/12));$('surface').textContent=surfaceAt(chassis.position.x).toUpperCase();$('wheelieStat').textContent=wheelieTime>.1?`WHEELIE ${wheelieTime.toFixed(1)}s`:`BEST WHEELIE ${bestWheelie.toFixed(1)}s`;$('balanceNeedle').style.left=`${clamp((chassis.angle+1.3)/2*100,0,100)}%`;}
  }
  function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);zoom=clamp(width/1150,.63,1.3);}
  let previous=0,accumulator=0;
  function loop(now){const delta=Math.min((now-previous)/1000,.06);previous=now;if(!paused&&!editing&&!activePanel){accumulator+=delta;while(accumulator>=1/60){simulate();accumulator-=1/60;}}else accumulator=0;time+=delta;MudAudio.update(chassis.velocity.x,inputs.gas,surfaceAt(chassis.position.x),!paused&&!editing&&!activePanel&&!document.hidden);render();requestAnimationFrame(loop);}
  const panel=$('panel');
  function icons(){lucide.createIcons();}
  let garageSnapshot;
  function closePanel(){if(activePanel==='garage'&&garageSnapshot){Object.assign(tune,garageSnapshot);garageSnapshot=null;}panel.close();activePanel='';release();}
  function openPanel(kind){release();activePanel=kind;$('panelTitle').textContent={garage:'The garage',maps:'Find your next trail',editor:'Build a trail'}[kind];$('panelEyebrow').textContent={garage:'EIGHT RIGS. YOUR BUILD.',maps:'MUD / WATER / SAND',editor:'MAP CREATOR'}[kind];if(kind==='garage')garage();if(kind==='maps')maps();if(kind==='editor')editorPanel();if(!panel.open)panel.showModal();icons();}
  function garage(){
    garageSnapshot={...tune};
    $('panelContent').innerHTML=`<div class="garage"><div class="vehicle-grid">${vehicles.map(v=>`<button class="vehicle-card ${v.id===tune.vehicle?'selected':''}" data-vehicle="${v.id}"><canvas aria-label="${v.name}"></canvas><span>${v.name}</span></button>`).join('')}</div><div class="tuning"><h2 id="tuneName">${rig().name}</h2>${[['power','Engine power',60,200,'%'],['spring','Spring stiffness',15,95,'%'],['damping','Shock damping',10,90,'%'],['lift','Suspension lift',30,78,''],['radius','Wheel size',25,48,'in']].map(([id,label,min,max,unit])=>`<label><span>${label}<output id="out-${id}">${tune[id]}${unit}</output></span><input type="range" data-tune="${id}" data-unit="${unit}" min="${min}" max="${max}" value="${tune[id]}" aria-label="${label}"></label>`).join('')}<label><span>Tire type</span><select id="tireType"><option value="mud">Deep-lug mud tires</option><option value="paddle">Paddle tires</option><option value="trail">All-terrain tires</option></select></label><label class="check"><input id="assist" type="checkbox" ${tune.assist?'checked':''}>Assisted wheelies</label><button class="ride-button" id="applyTune"><i data-lucide="check"></i>Apply build & ride</button></div></div>`;
    document.querySelectorAll('[data-vehicle]').forEach(b=>{thumbnail(b.querySelector('canvas'),vehicles.find(v=>v.id===b.dataset.vehicle));b.onclick=()=>{tune.vehicle=b.dataset.vehicle;document.querySelectorAll('[data-vehicle]').forEach(el=>el.classList.toggle('selected',el===b));$('tuneName').textContent=rig().name;};});
    document.querySelectorAll('[data-tune]').forEach(el=>el.oninput=()=>{tune[el.dataset.tune]=Number(el.value);$('out-'+el.dataset.tune).textContent=el.value+el.dataset.unit;});
    const wash=document.createElement('button');wash.textContent='Wash vehicle';wash.className='ride-button';wash.onclick=()=>{dirt[tune.vehicle]=0;write('mudline-dirt-v1',dirt);document.querySelectorAll('[data-vehicle]').forEach(b=>thumbnail(b.querySelector('canvas'),vehicles.find(v=>v.id===b.dataset.vehicle)));toast('Washed and ready');};document.querySelector('.tuning').append(wash);
    $('tireType').value=tune.tires;$('tireType').onchange=e=>tune.tires=e.target.value;$('assist').onchange=e=>tune.assist=e.target.checked;
    $('applyTune').onclick=()=>{write('mudline-tune-v1',tune);garageSnapshot=null;editing=false;$('editorBar').hidden=true;$('driveControls').hidden=false;$('balance').hidden=false;createWorld(checkpoint);closePanel();toast('Build applied');};
  }
  function mapThumbnail(target,data){target.width=420;target.height=160;const c=target.getContext('2d'),theme=mapInfo[data.theme];c.fillStyle=theme.sky;c.fillRect(0,0,420,160);circle(c,340,36,17,'#f7e6a8');c.beginPath();c.moveTo(0,160);for(let i=0;i<COUNT;i++)c.lineTo(i/(COUNT-1)*420,80+(data.heights[i]-480)*.3);c.lineTo(420,160);c.fillStyle=theme.soil;c.fill();for(let i=0;i<COUNT-1;i++)line(c,[[i/(COUNT-1)*420,80+(data.heights[i]-480)*.3],[(i+1)/(COUNT-1)*420,80+(data.heights[i+1]-480)*.3]],{water:'#398eaa',mud:'#5f5640',sand:'#ecd18b',trail:theme.grass}[data.surfaces[i]],5);}
  function loadMap(data,infinite=false){endless=infinite;map=clone(data);if(infinite)map.name='Endless Backcountry';checkpoint=180;editing=false;$('editorBar').hidden=true;$('driveControls').hidden=false;$('balance').hidden=false;createWorld();closePanel();toast(map.name);}
  function maps(){
    $('panelContent').innerHTML=`<div class="map-grid">${Object.entries(mapInfo).map(([id,m])=>`<button class="map-card" data-map="${id}"><canvas></canvas><strong>${m.name}</strong><small>${m.sub}</small></button>`).join('')}</div><h2 class="section-title">Your trails</h2><div id="savedMaps"></div><button id="newMap"><i data-lucide="plus"></i>Create a map</button>`;
    document.querySelectorAll('[data-map]').forEach(b=>{mapThumbnail(b.querySelector('canvas'),makeMap(b.dataset.map));b.onclick=()=>loadMap(makeMap(b.dataset.map));});
    const list=$('savedMaps');if(!customMaps.length)list.textContent='No saved trails yet.';
    customMaps.forEach((m,i)=>{const row=document.createElement('div');row.className='saved-row';const open=document.createElement('button');open.className='saved-open';open.textContent=m.name;open.onclick=()=>loadMap(m);const del=document.createElement('button');del.innerHTML='<i data-lucide="trash-2"></i>';del.title='Delete '+m.name;del.setAttribute('aria-label',del.title);del.onclick=()=>{if(confirm(`Delete ${m.name}?`)){customMaps.splice(i,1);write('mudline-maps-v1',customMaps);maps();icons();}};row.append(open,del);list.append(row);});
    $('newMap').onclick=()=>openPanel('editor');
    const infinite=document.createElement('button');infinite.id='endlessMode';infinite.className='ride-button';infinite.innerHTML='<i data-lucide="infinity"></i>Endless Backcountry / Deep bogs';infinite.onclick=()=>loadMap(makeMap('bog'),true);$('panelContent').prepend(infinite);
  }
  function editorPanel(){
    $('panelContent').innerHTML='<div class="editor-start"><label>Trail name<input id="mapName" maxlength="40" placeholder="My mud park"></label><label>Starting terrain<select id="editorTheme"><option value="current">Current map</option><option value="bog">Cypress Bog</option><option value="pond">Backwater Ponds</option><option value="dunes">Sunbreak Dunes</option></select></label><p>Drag the Terrain brush to shape hills. Paint mud, ponds, sand or dry trail with the other brushes. Use Map position to move along the course. Save keeps your trail on this device.</p><button id="beginEdit" class="ride-button">Open creator</button></div>';
    $('mapName').value=map.name;
    $('beginEdit').onclick=()=>{const theme=$('editorTheme').value;const name=$('mapName').value.trim()||'My mud park';if(theme!=='current')map=makeMap(theme);map=clone(map);map.name=name.slice(0,40);editing=true;undoStack=[];$('undo').disabled=true;$('editorBar').hidden=false;$('driveControls').hidden=true;$('balance').hidden=true;$('mapLabel').textContent=map.name;camera={x:0,y:480-height/zoom*.52};$('mapPan').max=Math.max(0,LENGTH-width/zoom);$('mapPan').value=0;closePanel();};
  }
  function brushPoint(event){const x=event.clientX/zoom+camera.x,y=event.clientY/zoom+camera.y;const index=Math.round(x/STEP),size=Number($('brushSize').value),mode=$('brush').value;for(let i=Math.max(8,index-size);i<=Math.min(COUNT-2,index+size);i++){if(mode==='height'){const influence=1-Math.abs(i-index)/(size+1);map.heights[i]=clamp(map.heights[i]*(1-influence)+y*influence,270,670);}else map.surfaces[i]=mode;}
    // Limit neighboring slopes so a touch stroke cannot create an impassable wall.
    for(let pass=0;pass<3;pass++){for(let i=8;i<COUNT;i++)map.heights[i]=clamp(map.heights[i],map.heights[i-1]-30,map.heights[i-1]+30);for(let i=COUNT-2;i>=8;i--)map.heights[i]=clamp(map.heights[i],map.heights[i+1]-30,map.heights[i+1]+30);}
  }
  canvas.addEventListener('pointerdown',e=>{if(!editing)return;stroke=clone(map);brushActive=true;canvas.setPointerCapture(e.pointerId);brushPoint(e);});
  canvas.addEventListener('pointermove',e=>{if(editing&&brushActive)brushPoint(e);});
  function endStroke(){if(stroke){undoStack.push(stroke);if(undoStack.length>25)undoStack.shift();$('undo').disabled=false;}stroke=null;brushActive=false;}
  canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',endStroke);
  $('undo').onclick=()=>{if(undoStack.length)map=undoStack.pop();$('undo').disabled=!undoStack.length;};
  $('mapPan').oninput=e=>camera.x=Number(e.target.value);
  $('saveMap').onclick=()=>{const existing=customMaps.findIndex(m=>m.name===map.name);if(existing>=0)customMaps[existing]=clone(map);else if(customMaps.length<20)customMaps.push(clone(map));else return toast('Your 20 trail slots are full. Delete a trail first.');if(write('mudline-maps-v1',customMaps))toast('Trail saved on this device');};
  $('testMap').onclick=()=>{editing=false;checkpoint=180;$('editorBar').hidden=true;$('driveControls').hidden=false;$('balance').hidden=false;createWorld();toast('Testing '+map.name);};
  document.querySelectorAll('[data-control]').forEach(button=>{button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);inputs[button.dataset.control]=true;button.classList.add('pressed');});const end=()=>{inputs[button.dataset.control]=false;button.classList.remove('pressed');};button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',end);button.addEventListener('contextmenu',e=>e.preventDefault());});
  const keys={ArrowRight:'gas',KeyD:'gas',ArrowLeft:'brake',KeyA:'brake',Space:'wheelie',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};
  addEventListener('keydown',e=>{if(activePanel||editing)return;if(keys[e.code]){e.preventDefault();inputs[keys[e.code]]=true;}if(e.code==='KeyR')recover();});
  addEventListener('keyup',e=>{if(keys[e.code]){e.preventDefault();inputs[keys[e.code]]=false;}});
  addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{release();if(document.hidden){paused=true;MudAudio.update(0,false,'trail',false);$('pause').innerHTML='<i data-lucide="play"></i>';icons();}});
  document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));
  $('closePanel').onclick=closePanel;panel.addEventListener('cancel',event=>{event.preventDefault();closePanel();});
  $('reset').onclick=recover;$('pause').onclick=()=>{paused=!paused;release();$('pause').innerHTML=`<i data-lucide="${paused?'play':'pause'}"></i>`;$('pause').setAttribute('aria-label',paused?'Resume':'Pause');icons();toast(paused?'Paused':'Ride on');};
  const sound=document.createElement('button');sound.id='sound';sound.title='Toggle sound';sound.setAttribute('aria-label','Toggle sound');sound.setAttribute('aria-pressed',String(!MudAudio.isMuted()));sound.innerHTML=`<i data-lucide="${MudAudio.isMuted()?'volume-x':'volume-2'}"></i>`;sound.onclick=()=>{const muted=MudAudio.toggle();sound.setAttribute('aria-pressed',String(!muted));sound.innerHTML=`<i data-lucide="${muted?'volume-x':'volume-2'}"></i>`;icons();};document.querySelector('.hud nav').append(sound);
  addEventListener('pointerdown',()=>MudAudio.start(),{passive:true});addEventListener('keydown',()=>MudAudio.start());
  addEventListener('resize',resize);resize();createWorld();icons();requestAnimationFrame(loop);
  window.mudline = { state:()=>({x:chassis.position.x,y:chassis.position.y,angle:chassis.angle,speed:chassis.velocity.x,vehicle:tune.vehicle,dirt:dirt[tune.vehicle],particles:particles.length,muted:MudAudio.isMuted(),tune:{...tune},editing,paused,map:map.name,savedMaps:customMaps.length,terrain:map.heights.slice(),surfaces:map.surfaces.slice(),wheels:wheels.map(w=>({x:w.position.x,y:w.position.y}))}), vehicles, thumbnail };
})();
