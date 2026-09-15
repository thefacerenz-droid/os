const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler}=require('../lib/api/games/mudline');
const build={vehicle:'highwater',tires:'mud',power:110,spring:55,damping:55,lift:52,radius:34,snorkel:75};
const state=x=>({x,y:390,angle:0,vx:0,vy:0,wheels:[{x:x-50,y:440,angle:0},{x:x+50,y:440,angle:0}]});
function fixture(){
  let data=null,time=100000;
  const handler=createHandler({storage:{async transact(fn){const next=fn(structuredClone(data));data=next.store;return next.result;}},now:()=>time});
  return {advance:ms=>time+=ms,data:()=>data,async call(body,headers={}){let result,status;await handler({method:'POST',body,headers:{host:'localhost',...headers},socket:{remoteAddress:'test'}},{setHeader(){},set statusCode(v){status=v;},end(v){result=JSON.parse(v);}});return {status,...result};}};
}
async function create(f,options={}){return f.call({action:'create',username:'Renz',name:'Park',max:8,map:'endless',build,...options});}
const auth=r=>({code:r.room.code,id:r.id,token:r.token});
test('private discovery, restrictions, session secrecy and capacity',async()=>{
  const f=fixture(),a=await create(f,{max:2});assert.equal(a.status,200);
  assert.equal((await f.call({action:'list'})).rooms.length,0);
  const b=await f.call({action:'join',code:a.room.code,username:'Drew',build});assert.equal(b.status,200);
  assert.ok(!JSON.stringify(b.room).includes(a.token));assert.ok(!('auth' in b.room.players[0]));
  assert.equal((await f.call({action:'join',code:a.room.code,username:'Extra',build})).status,409);
  assert.equal((await f.call({...auth(a),token:'wrong',action:'sync',state:state(180)})).status,401);
  const r=await create(f,{restriction:'sxs',build:{...build,vehicle:'tidal'}});
  assert.equal((await f.call({action:'join',code:r.room.code,build})).status,400);
  assert.equal((await f.call({action:'list'},{origin:'https://other.example'})).status,403);
});
test('teleports, speed, malformed wheels and rapid updates rejected',async()=>{
  const f=fixture(),a=await create(f),identity=auth(a);
  assert.equal((await f.call({...identity,action:'sync',state:state(180)})).status,200);f.advance(200);
  assert.equal((await f.call({...identity,action:'sync',state:state(10000)})).status,409);
  assert.equal((await f.call({...identity,action:'sync',state:{...state(185),vx:900}})).status,400);
  assert.equal((await f.call({...identity,action:'sync',state:{...state(185),wheels:[]}})).status,400);
  assert.equal((await f.call({...identity,action:'sync',state:state(190)})).status,200);
  assert.equal((await f.call({...identity,action:'sync',state:state(191)})).status,429);
  f.advance(200);assert.equal((await f.call({...identity,action:'recover'})).status,200);
  assert.equal((await f.call({...identity,action:'sync',state:state(5000)})).status,400);
});
test('recovery line consent, distance, detach and disconnect cleanup',async()=>{
  const f=fixture(),a=await create(f),b=await f.call({action:'join',code:a.room.code,build});
  await f.call({...auth(a),action:'sync',state:state(180)});await f.call({...auth(b),action:'sync',state:state(360)});
  const tow=await f.call({...auth(a),action:'tow',target:b.id,kind:'strap'});assert.equal(tow.room.tows[0].active,false);
  assert.equal((await f.call({...auth(a),action:'acceptTow'})).status,400);
  assert.equal((await f.call({...auth(b),action:'acceptTow'})).room.tows[0].active,true);
  assert.equal((await f.call({...auth(b),action:'detach'})).room.tows.length,0);
  f.advance(10000);await f.call({...auth(b),action:'sync',state:state(360)});f.advance(10001);
  const still=await f.call({...auth(b),action:'sync',state:state(360)});assert.equal(still.room.players.length,1);assert.equal(still.room.host,b.id);
});
test('host-only optional events, ordered checkpoints and no client money writes',async()=>{
  const f=fixture(),a=await create(f),b=await f.call({action:'join',code:a.room.code,build});
  await f.call({...auth(a),action:'sync',state:state(180)});
  assert.equal((await f.call({...auth(b),action:'event',kind:'drag'})).status,403);
  await f.call({...auth(a),action:'event',kind:'drag'});
  await f.call({...auth(a),action:'enterEvent'});f.advance(15001);
  let result=await f.call({...auth(a),action:'sync',state:state(3400),money:999999});
  assert.equal(result.room.event.progress[a.id].checkpoint,0);
  for(const x of [2200,2800,3400]){f.advance(2000);result=await f.call({...auth(a),action:'sync',state:state(x)});}
  assert.ok(result.room.event.progress[a.id].finished);assert.ok(result.room.event.finished);
  assert.ok(!JSON.stringify(f.data()).includes('money'));
});
test('new electric bikes and snowmobile join unrestricted parks but not ATV-only rooms',async()=>{
  const f=fixture(),all=await create(f),atv=await create(f,{restriction:'atv'});
  for(const vehicle of ['volt-mx','flux-trail','tundra']){
    const joined=await f.call({action:'join',code:all.room.code,build:{...build,vehicle}});assert.equal(joined.status,200);
    assert.equal(joined.room.players.at(-1).build.vehicle,vehicle);
    assert.equal((await f.call({action:'join',code:atv.room.code,build:{...build,vehicle}})).status,400);
  }
});
