/* Cosmetic articulated Matter rig: it cannot destabilize the vehicle solver. */
window.MudRider=(()=>{
  const {Engine,Bodies,Body,Composite,Constraint}=Matter;
  const rest=[{x:0,y:-27},{x:9,y:-51},{x:19,y:-72},{x:29,y:-42},{x:42,y:-52},{x:-17,y:-3},{x:10,y:15}];
  function create(){
    const engine=Engine.create({gravity:{x:0,y:0},constraintIterations:5});
    const nodes=rest.map((p,i)=>{const b=Bodies.circle(p.x,p.y,i===2?10:4,{collisionFilter:{mask:0},frictionAir:.09});Body.setMass(b,.15);return b;});
    const joints=[[0,1],[1,2],[1,3],[3,4],[0,5],[5,6]].map(([a,b])=>Constraint.create({bodyA:nodes[a],bodyB:nodes[b],length:Math.hypot(rest[a].x-rest[b].x,rest[a].y-rest[b].y),stiffness:.85,damping:.18}));
    const anchors=[0,4,6].map(i=>Constraint.create({pointA:{...rest[i]},bodyB:nodes[i],length:0,stiffness:i===0?.35:.055,damping:.15}));
    Composite.add(engine.world,[...nodes,...joints,...anchors]);let last={vx:0,vy:0,angle:0},accumulator=0;
    return {points:()=>nodes.map(n=>({...n.position})),step(s,dt=1/60){
      accumulator+=Math.min(.05,dt);const ax=Math.max(-8,Math.min(8,(s.vx||0)-last.vx)),ay=Math.max(-8,Math.min(8,(s.vy||0)-last.vy));
      const pitch=Math.atan2(Math.sin(s.angle-last.angle),Math.cos(s.angle-last.angle));
      while(accumulator>=1/60){
        const loose=Math.abs(Math.sin(s.angle))>.7||Math.abs(pitch)>.1;
        anchors[1].stiffness=loose?.006:.055;anchors[2].stiffness=loose?.008:.065;
        for(const node of nodes){const fx=-ax*.00013+Math.sin(s.angle)*.00008-pitch*.0008,fy=-ay*.00013+Math.cos(s.angle)*.00008;Body.applyForce(node,node.position,{x:fx,y:fy});}
        Engine.update(engine,1000/60);accumulator-=1/60;
        for(let i=0;i<nodes.length;i++)if(!Number.isFinite(nodes[i].position.x)||Math.hypot(nodes[i].position.x,nodes[i].position.y)>155){Body.setPosition(nodes[i],rest[i]);Body.setVelocity(nodes[i],{x:0,y:0});}
      }
      last={vx:s.vx||0,vy:s.vy||0,angle:s.angle};
    }};
  }
  function draw(c,points,v,dirt=0){
    const p=points||rest;
    const limb=(a,b,color,w)=>{c.beginPath();c.moveTo(p[a].x,p[a].y);c.lineTo(p[b].x,p[b].y);c.strokeStyle='#13262d';c.lineWidth=w+3;c.lineCap='round';c.stroke();c.strokeStyle=color;c.lineWidth=w;c.stroke();};
    c.save();if(v.sxs)c.translate(14,-3);
    limb(0,5,'#273e4d',10);limb(5,6,'#354e59',8);
    limb(0,1,v.trim,17);limb(1,3,'#526571',8);limb(3,4,'#b79a7d',6);
    c.strokeStyle='#132a33';c.lineWidth=7;c.beginPath();c.moveTo(p[6].x-3,p[6].y);c.lineTo(p[6].x+13,p[6].y+2);c.stroke();
    const h=p[2];c.save();c.translate(h.x,h.y);c.rotate(Math.atan2(p[1].y-h.y,p[1].x-h.x)-Math.PI/2);
    c.fillStyle=v.trim;c.strokeStyle='#13262d';c.lineWidth=2;c.beginPath();c.ellipse(0,0,13,14,0,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle='#172e39';c.fillRect(1,-6,14,8);c.strokeStyle='#b4e2df';c.lineWidth=2;c.beginPath();c.moveTo(3,-5);c.lineTo(12,-3);c.stroke();
    c.fillStyle=v.body;c.beginPath();c.moveTo(4,-12);c.lineTo(21,-8);c.lineTo(9,-6);c.fill();c.restore();
    if(dirt>.1){c.fillStyle=`rgba(105,77,46,${dirt*.85})`;for(let i=0;i<14*dirt;i++){const q=p[i%p.length];c.beginPath();c.arc(q.x+Math.sin(i*9)*6,q.y+Math.cos(i*7)*5,2+i%3,0,Math.PI*2);c.fill();}}
    c.restore();
  }
  return {create,draw};
})();
