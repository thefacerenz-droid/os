const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createHandler,validateState}=require('../lib/api/games/mudline');
const {sample,intake}=require('../assets/games/mudline/endless');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
// Isolated in-memory datastore; the actual API handler and eight real browser game instances.
let store=null,queue=Promise.resolve();
const storage={transact(update){const task=queue.then(()=>{const out=update(structuredClone(store));store=out.store;return out.result;});queue=task.catch(()=>{});return task;}};
const handler=createHandler({storage});
const root=path.resolve(__dirname,'..');
const server=http.createServer(async(req,res)=>{
  if(req.url==='/api/games/mudline')return handler(req,res);
  try{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))throw Error();const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.statusCode=404;res.end();}
});
(async()=>{
  for(const i of [0,9,28,150,10000,999999])assert.ok(Number.isFinite(sample(i).height));
  assert.ok(sample(28).height>620);
  assert.ok(intake({x:0,y:600},0,180,132).y<480);
  assert.ok(intake({x:0,y:600},0,45,132).y>480);
  assert.throws(()=>validateState({x:1e9,y:400,vx:0,vy:0,angle:0,wheels:[]},null,0));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const errors=[],pages=[];
  async function page(name){const context=await browser.newContext({viewport:{width:1180,height:820}});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/assets/games/mudline/index.html');await p.waitForFunction(()=>window.MudMultiplayer&&window.mudline);pages.push(p);return p;}
  async function join(p,code,name){await p.locator('#parkMenu').click();await p.locator('#multi').click();await p.locator('#joinLobby').click();await p.locator('#riderName').fill(name);await p.locator('#lobbyCode').fill(code);await p.locator('#connectPark').click();await p.waitForFunction(()=>MudMultiplayer.state().connected);}
  try{
    const a=await page('Renz');
    await a.locator('[data-panel="garage"]').click();await a.locator('[data-tune="snorkel"]').fill('180');await a.locator('#applyTune').click();
    await a.locator('[data-panel="maps"]').click();await a.locator('#endlessMode').click();await a.keyboard.down('ArrowRight');await a.waitForTimeout(3500);await a.keyboard.up('ArrowRight');
    const ride=await a.evaluate(()=>mudline.state());assert.ok(ride.endless&&ride.x>500);assert.ok(ride.groundBodies<=131);assert.ok(Number.isFinite(ride.y));console.log('Endless terrain and tall snorkel driving passed',ride.x,ride.stalled);
    await a.locator('#parkMenu').click();await a.locator('#multi').click();await a.locator('#createLobby').click();await a.locator('#riderName').fill('Renz');await a.locator('#visibility').selectOption('public');await a.locator('#collisions').check();await a.locator('#connectPark').click();await a.waitForFunction(()=>MudMultiplayer.state().connected);
    const code=await a.evaluate(()=>MudMultiplayer.state().code);
    const b=await page('Drew');await b.locator('[data-panel="garage"]').click();await b.locator('[data-vehicle="redline"]').click();await b.locator('#applyTune').click();await join(b,code,'Drew');
    await a.waitForFunction(()=>MudMultiplayer.state().remoteCount===1);await b.waitForFunction(()=>MudMultiplayer.state().remoteCount===1);
    assert.equal((await a.evaluate(()=>MudMultiplayer.state().players)).find(p=>p.name==='Drew').build.vehicle,'redline');
    console.log('Two actual games joined with synchronized custom builds and wheels');
    await a.locator('#parkPlayers button').click();await a.getByRole('button',{name:'Attach winch',exact:true}).click();await a.locator('#closeSocial').click();
    await b.waitForFunction(()=>MudMultiplayer.state().tows.length===1);await b.locator('#parkPlayers button').click();await b.getByRole('button',{name:'Accept recovery line'}).click();await b.locator('#closeSocial').click();await a.waitForFunction(()=>MudMultiplayer.state().tows[0]?.active);
    await a.screenshot({path:path.join(os.tmpdir(),'mudline-multiplayer.png')});
    await a.locator('#parkPlayers button').click();await a.locator('#detachTow').click();await a.locator('#closeSocial').click();await b.waitForFunction(()=>MudMultiplayer.state().tows.length===0);
    await a.locator('#chatText').fill('Lets hit the bog');await a.locator('#chatForm button').click();await b.getByText('Renz: Lets hit the bog',{exact:true}).waitFor();console.log('Consent-based winch attach/detach and cross-client chat passed');
    await a.keyboard.down('ArrowRight');await a.waitForTimeout(1500);await a.keyboard.up('ArrowRight');await b.waitForFunction(()=>MudMultiplayer.state().players.some(p=>p.name==='Renz'&&p.state?.x>500));
    let count=0;await b.route('**/api/games/mudline',async route=>{if(route.request().postDataJSON().action==='sync'){await new Promise(r=>setTimeout(r,230));if(++count%4===0)return route.abort('failed');}return route.continue();});
    await a.waitForTimeout(2500);assert.ok((await b.evaluate(()=>MudMultiplayer.state())).connected);await b.unrouteAll({behavior:'wait'});await b.waitForFunction(()=>MudMultiplayer.state().failures===0);console.log('Delayed updates and dropped requests recover without stopping local physics');
    for(let i=2;i<8;i++){const p=await page('Rider '+i);if(i<5){await p.locator('[data-panel="garage"]').click();await p.locator(`[data-vehicle="${['volt-mx','flux-trail','tundra'][i-2]}"]`).click();await p.locator('#applyTune').click();}await join(p,code,'Rider '+i);}
    await a.waitForFunction(()=>MudMultiplayer.state().players.length===8,{},{timeout:20000});await pages[7].waitForFunction(()=>MudMultiplayer.state().remoteCount===7,{},{timeout:20000});
    const denied=await fetch(base+'/api/games/mudline',{method:'POST',body:JSON.stringify({action:'join',code,username:'Ninth',build:ride.tune})});assert.equal(denied.status,409);
    console.log('Eight actual games, late join state and lobby capacity passed');
    await a.evaluate(()=>MudMultiplayer.leave());await b.waitForFunction(()=>MudMultiplayer.state().players.length===7);assert.equal(await b.evaluate(()=>MudMultiplayer.state().host),await b.evaluate(()=>MudMultiplayer.state().id));
    for(let i=0;i<2;i++){await pages[7].evaluate(()=>MudMultiplayer.leave());await join(pages[7],code,'Rejoined');}
    await b.waitForFunction(()=>MudMultiplayer.state().players.length===7);console.log('Host departure and repeated leave/rejoin passed');
    await b.setViewportSize({width:390,height:844});await b.screenshot({path:path.join(os.tmpdir(),'mudline-multiplayer-mobile.png')});assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth),390);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
