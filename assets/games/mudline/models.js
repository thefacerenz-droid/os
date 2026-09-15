/* Detailed, code-drawn cartoon rigs; no external image or audio requests. */
window.MudModels = (() => {
  const ink='#142a32';
  function path(c,p,fill,stroke=ink,w=2){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}}
  function line(c,p,color,w){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=w;c.lineJoin='round';c.lineCap='round';c.stroke();}
  function disc(c,x,y,r,color,stroke,w=2){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}}
  function shade(c,color,y1,y2){const g=c.createLinearGradient(0,y1,0,y2);g.addColorStop(0,'#ffffff');g.addColorStop(.18,color);g.addColorStop(.72,color);g.addColorStop(1,'#31444c');return g;}
  function stains(c,shape,amount,seed=0){if(amount<.01)return;c.save();c.beginPath();shape.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();c.fillStyle=`rgba(100,74,43,${amount*.76})`;c.fillRect(-160,-150,320,250);for(let i=0;i<180*amount;i++){const x=Math.sin(i*173.3+seed)*130,y=Math.cos(i*92.1)*65-15;disc(c,x,y,2+(i%7)*1.1,i%3?'#513b27de':'#a08052cb');if(i%5===0)line(c,[[x,y],[x-2,y+13]],'#4e392bbc',3);}c.restore();}
  function bike(c,v,dirt){
    const a=v.length/2;
    line(c,[[-a*.8,30],[-22,7],[23,18],[a*.77,30]],'#96a6a7',5);
    line(c,[[-25,-20],[-36,17],[15,22],[28,-38],[-25,-20],[15,22]],v.frame,6);
    path(c,[[-19,-19],[20,-30],[13,10],[-14,8]],shade(c,'#384750',-30,20));
    for(let i=0;i<6;i++)line(c,[[-14,-12+i*3],[8,-15+i*3]],'#7a8c90',1);
    disc(c,-6,17,11,'#465a62',ink,2);disc(c,-6,17,5,'#93a4a5');
    line(c,[[24,-35],[a*.8,29]],'#d4ddda',5);line(c,[[31,-18],[a*.8,29]],'#9daeb0',2);
    line(c,[[25,-34],[28,-53],[43,-54]],'#435d67',4);
    const shell=[[-a,-24],[-a+10,-33],[-13,-31],[15,-43],[31,-36],[24,-13],[-6,-17],[-26,-23]];
    path(c,shell,shade(c,v.body,-45,-10),ink,2);path(c,[[-15,-28],[12,-40],[23,-33],[15,-18]],v.trim);
    path(c,[[-a+9,-33],[-15,-35],[-8,-29],[-a+4,-26]],'#182d35');
    path(c,[[27,-31],[a+5,-27],[a+16,-21],[a-6,-20],[31,-23]],v.body);
    line(c,[[-a*.75,25],[-6,17]],'#171f23',2);line(c,[[-a*.75,30],[-6,24]],'#7a898c',1);
    line(c,[[-10,27],[3,27]],'#c0cac5',4);path(c,[[28,-47],[43,-46],[43,-36],[31,-36]],v.body);
    stains(c,shell,dirt,v.length);stains(c,[[-35,-10],[28,-16],[30,29],[-35,30]],dirt,3);
  }
  function snow(c,v,dirt){
    const shell=[[-92,-13],[-83,-31],[-27,-32],[0,-55],[55,-48],[90,-17],[75,-4],[-65,8]];
    line(c,[[-81,16],[40,16],[76,29]],'#778f98',5);
    path(c,shell,shade(c,v.body,-57,10),ink,3);
    path(c,[[-78,-31],[-25,-35],[5,-29],[-8,-16],[-77,-17]],'#1d3039');
    path(c,[[3,-49],[19,-71],[35,-67],[39,-44]],'#8ec6cf99','#76959a',2);
    path(c,[[14,-40],[57,-40],[78,-19],[46,-12]],v.trim);
    for(let i=0;i<5;i++)line(c,[[23+i*6,-33],[34+i*6,-21]],'#263e46',3);
    line(c,[[54,-36],[70,-28]],'#fff3b9',5);line(c,[[-1,-39],[2,-53],[18,-54]],'#253e49',4);
    stains(c,shell,dirt,7);
  }
  function body(c,v,dirt=0){
    if(v.bike)return bike(c,v,dirt);
    if(v.snow)return snow(c,v,dirt);
    const a=v.length/2;
    const shell=[[-a-4,-13],[-a+3,-31],[-a+32,-34],[-22,-18],[21,-18],[a-29,-37],[a+8,-29],[a+13,-12],[a-10,0],[-a+14,0]];
    // Chassis, exposed engine, radiator and footboards.
    line(c,[[-a+17,2],[-a+31,22],[a-28,22],[a+1,-9]],v.frame,5);
    path(c,[[-35,-6],[25,-8],[34,11],[18,25],[-24,25],[-40,9]],'#293b43');
    disc(c,-2,9,16,'#65777a',ink,3);disc(c,-2,9,8,'#30444d','#95aaaa',2);
    for(let i=0;i<5;i++)line(c,[[20+i*3,-9],[23+i*3,6]],'#a4b7b4',1.5);
    line(c,[[-a+31,15],[-25,31],[30,31]],'#8b9c9b',5);
    for(let i=0;i<6;i++)line(c,[[-20+i*8,28],[-17+i*8,33]],'#1d323a',2);
    path(c,shell,shade(c,v.body,-38,6),ink,3);
    path(c,[[-a+7,-29],[-a+27,-30],[-29,-18],[-a+14,-16]],v.trim);
    path(c,[[31,-21],[a-26,-34],[a+4,-27],[a-4,-16]],v.trim);
    path(c,[[-a+13,-10],[-a+23,-25],[-a+42,-17],[-a+37,1]],'#253b43');
    path(c,[[a-40,-15],[a-20,-29],[a-2,-12],[a-15,1]],'#253b43');
    line(c,[[-a+7,-33],[-a+35,-35]],'#273e44',5);
    line(c,[[a-22,-38],[a+3,-35]],'#273e44',5);
    for(let i=0;i<4;i++)line(c,[[-a+10+i*7,-37],[-a+11+i*7,-31]],'#50636a',2);
    path(c,[[-29,-23],[-20,-35],[21,-35],[32,-25]],shade(c,v.trim,-38,-20),ink,3);
    line(c,[[-18,-32],[16,-32]],'#ffffff55',1);
    // Chromed bumper, skid plate and winch.
    line(c,[[a+4,-5],[a+19,-8],[a+19,-32],[a+8,-35]],'#172f38',7);
    line(c,[[a+4,-5],[a+18,-8],[a+18,-31]],'#839999',2);
    path(c,[[a-8,-20],[a+12,-20],[a+10,-12],[a-7,-12]],'#203741');
    line(c,[[a-4,-17],[a+8,-17]],'#eff8bf',4);
    disc(c,a+10,-3,5,'#1a2e37','#a4b6b4',1);line(c,[[a+10,1],[a+13,12],[a+10,15]],v.trim,3);
    if(!v.sxs){
      const h=v.id==='silverback'||v.id==='paddle'?75:62;
      line(c,[[a-22,-22],[a-28,-h],[a-15,-h-3]],v.frame,7);
      path(c,[[a-35,-31],[a-42,-h+5],[a-18,-h-6],[a-5,-36]],shade(c,v.frame,-h,-26));
      path(c,[[a-35,-h+8],[a-21,-h+1],[a-13,-41],[a-28,-37]],'#253d48');
      for(let i=0;i<5;i++)line(c,[[a-32+i*2,-h+9],[a-27+i*2,-42]],'#a9c4c4',1);
    }
    const pipeX=v.sxs?v.length*.35:a-10,pipeHeight=v.snorkelHeight||75;
    line(c,[[pipeX,-15],[pipeX,-pipeHeight-9]],'#172d35',8);
    line(c,[[pipeX-2,-20],[pipeX-2,-pipeHeight-7]],'#9cbbc0',2);
    path(c,[[pipeX-7,-pipeHeight-9],[pipeX-7,-pipeHeight-17],[pipeX+8,-pipeHeight-17],[pipeX+8,-pipeHeight-9]],v.trim);
    if(v.sxs){
      path(c,[[-a+12,-17],[-a+18,-89],[a-25,-89],[a-7,-15]],'#91cfd334',null);
      path(c,[[12,-21],[12,-49],[34,-52],[38,-17]],'#1c303b');
      line(c,[[-a+7,-9],[-a+15,-91],[a-26,-91],[a-6,-10]],v.frame,7);
      line(c,[[-18,-88],[-16,-8]],v.frame,5);
      line(c,[[-a+10,-13],[-a+55,-86]],'#368989',3);
      path(c,[[-a+10,-10],[-a+18,-36],[-27,-33],[-23,-9]],shade(c,v.body,-38,0));
      path(c,[[-13,-9],[-10,-32],[a-19,-33],[a-10,-9]],shade(c,v.body,-38,0));
      line(c,[[-a+24,-25],[-a+43,-25]],'#20505a',3);line(c,[[10,-24],[29,-24]],'#20505a',3);
      path(c,[[-a+2,-90],[-a+9,-102],[a-17,-102],[a-10,-90]],'#213e48');
      path(c,[[-a+3,-103],[-a+16,-114],[a-9,-114],[a-20,-103]],'#e4e0cd');line(c,[[-a+21,-109],[a-26,-109]],v.body,4);
      for(let i=0;i<5;i++){disc(c,-a+26+i*21,-78,8,'#172f3b',v.rim,2);disc(c,-a+26+i*21,-78,4,'#417d89','#93e7db',1);}
      for(let i=0;i<7;i++)disc(c,-49+i*15,-95,2,'#f5ffd4');
    }else{
      if(v.backrest)line(c,[[-32,-29],[-40,-60],[-52,-60]],'#21363f',10);
      line(c,[[23,-35],[36,-54],[52,-54]],'#364d54',4);
    }
    line(c,[[-a+8,-26],[-a+22,-28]],'#ffffffa0',1.5);
    stains(c,shell,dirt,v.length);
    stains(c,[[-a+26,0],[a-19,0],[a-29,27],[-a+33,25]],dirt*.85,8);
    if(v.sxs)stains(c,[[-a+17,-33],[a-18,-33],[a-9,-6],[-a+10,-6]],dirt,2);
  }
  function wheel(c,x,y,r,angle,v,tire,dirt){c.save();c.translate(x,y);c.rotate(angle);
    if(v.bike){disc(c,0,0,r,'#1a262b',ink,2);for(let i=0;i<28;i++){c.save();c.rotate(i*Math.PI/14);line(c,[[-2,-r],[2,-r]],dirt>.3?'#7d5c36':'#455259',4);line(c,[[0,-5],[0,-r*.79]],'#b3c0c1',.8);c.restore();}disc(c,0,0,r*.8,'#00000000','#95a7a8',2);disc(c,0,0,6,v.rim,ink,1);if(dirt>.1){c.strokeStyle=`rgba(126,93,53,${dirt*.8})`;c.lineWidth=r*.22;c.beginPath();c.arc(0,0,r*.85,0,Math.PI*2);c.stroke();}c.restore();return;}
    const g=c.createRadialGradient(-r*.3,-r*.4,2,0,0,r);g.addColorStop(0,'#58676c');g.addColorStop(.68,'#26353d');g.addColorStop(1,'#111f28');disc(c,0,0,r,g,ink,2);
    const n=tire==='paddle'?9:tire==='mud'?12:20;
    for(let i=0;i<n;i++){c.save();c.rotate(i/n*Math.PI*2);path(c,[[-8,-r+8],[-9,-r-2],[-2,-r-7],[6,-r-4],[9,-r+5],[2,-r+10]],i%2?'#34444b':'#435359',ink,1.5);line(c,[[-6,-r+1],[-1,-r-3],[5,-r]],'#617177',1.4);if(dirt>.08)line(c,[[-5,-r+7],[3,-r+3]],`rgba(116,86,54,${dirt})`,4);c.restore();}
    disc(c,0,0,r*.69,'#152732',v.rim,3);disc(c,0,0,r*.59,v.disc?v.rim:'#253b45','#a0b8b7',1);
    for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);if(!v.disc){path(c,[[-3,-5],[-5,-r*.54],[0,-r*.6],[5,-10]],shade(c,v.rim,-r,0),ink,.6);line(c,[[0,-r*.53],[1,-12]],'#e6f7ec',1);}disc(c,0,-r*.63,1.4,'#ecf7ee');c.restore();}
    disc(c,0,0,r*.18,'#a5bec0',ink,2);disc(c,0,0,r*.08,'#354d58');
    for(let i=0;i<6;i++)disc(c,Math.cos(i*Math.PI/3)*r*.25,Math.sin(i*Math.PI/3)*r*.25,1.4,'#dceee6');
    if(dirt>0){disc(c,0,0,r*.7,`rgba(103,75,41,${dirt*.68})`);for(let i=0;i<dirt*45;i++)disc(c,Math.sin(i*17)*r*.7,Math.cos(i*9)*r*.7,2+i%4,'#795d3bdb');}
    c.restore();
  }
  function track(c,positions,r,angle,v,spin,dirt){
    c.save();c.translate(positions[0].x,positions[0].y);c.rotate(angle);
    c.beginPath();c.roundRect(-50,-20,111,r+20,20);c.fillStyle='#1b282d';c.fill();c.strokeStyle=dirt>.2?'#816039':'#455b61';c.lineWidth=6;c.stroke();
    for(let i=0;i<6;i++)disc(c,-36+i*16,r-15,9,'#354c56','#8c9fa1',2);
    for(let i=0;i<14;i++){const x=-51+(i*9+spin*9)%117;line(c,[[x,r-2],[x+3,r+5]],dirt>.3?'#8b693c':'#506269',4);}c.restore();
    c.save();c.translate(positions[1].x,positions[1].y);c.rotate(angle);line(c,[[0,-18],[8,r-2]],'#b4c4c2',5);line(c,[[-33,r-2],[32,r-2],[44,r-13]],v.trim,7);line(c,[[-30,r+1],[33,r+1]],'#192c33',3);c.restore();
  }
  return {body,wheel,track};
})();
