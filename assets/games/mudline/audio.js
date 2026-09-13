window.MudAudio = (()=>{
  let context,master,engine,sub,filter,noise,terrainFilter,terrainGain;
  let muted=false;try{muted=localStorage.getItem('mudline-muted')==='1';}catch{}
  function start(){if(!context){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);
    filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=450;filter.Q.value=.7;filter.connect(master);
    engine=context.createOscillator();engine.type='sawtooth';engine.frequency.value=42;const eGain=context.createGain();eGain.gain.value=.23;engine.connect(eGain);eGain.connect(filter);engine.start();
    sub=context.createOscillator();sub.type='triangle';sub.frequency.value=21;const sGain=context.createGain();sGain.gain.value=.32;sub.connect(sGain);sGain.connect(filter);sub.start();
    const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;terrainFilter=context.createBiquadFilter();terrainFilter.type='bandpass';terrainFilter.Q.value=.6;terrainGain=context.createGain();terrainGain.gain.value=0;noise.connect(terrainFilter);terrainFilter.connect(terrainGain);terrainGain.connect(master);noise.start();
  }if(context.state==='suspended')context.resume().catch(()=>{});}
  function update(speed,gas,material,running){if(!context)return;const t=context.currentTime;master.gain.setTargetAtTime(!muted&&running?.24:0,t,.08);const rpm=35+Math.min(Math.abs(speed),25)*3.2+(gas?44:0);engine.frequency.setTargetAtTime(rpm,t,.12);sub.frequency.setTargetAtTime(rpm*.5,t,.12);filter.frequency.setTargetAtTime(240+rpm*5,t,.1);terrainFilter.frequency.setTargetAtTime(material==='water'?900:material==='mud'?180:1800,t,.12);terrainGain.gain.setTargetAtTime(running?Math.min(Math.abs(speed)/20,.7)*(material==='trail'?.06:.3):0,t,.1);}
  function toggle(){muted=!muted;try{localStorage.setItem('mudline-muted',muted?'1':'0');}catch{}start();return muted;}
  return{start,update,toggle,isMuted:()=>muted,state:()=>({state:context?.state||'not-started',frequency:engine?.frequency.value||0,gain:master?.gain.value||0})};
})();
