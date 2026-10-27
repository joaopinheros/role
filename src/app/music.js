
/* ================= som: house gerado na hora (WebAudio) ================= */
const MUSIC=(()=>{
  const PRESETS={
    deep:{bpm:120,prog:[[50,53,57,60],[45,48,52,55],[43,46,50,53],[48,52,55,59]],bass:[38,33,31,36],cut:900,hat:.5},
    disco:{bpm:124,prog:[[52,56,59,63],[49,52,56,59],[45,49,52,56],[47,51,54,57]],bass:[40,37,33,35],cut:1600,hat:.7},
    tropical:{bpm:112,prog:[[55,59,62,66],[52,55,59,62],[48,52,55,59],[50,54,57,60]],bass:[43,40,36,38],cut:1300,hat:.4},
    tech:{bpm:126,prog:[[45,48,52,55],[45,48,52,55],[41,45,48,52],[43,47,50,53]],bass:[33,33,29,31],cut:700,hat:.8},
    lofi:{bpm:96,prog:[[53,57,60,64],[50,53,57,60],[46,50,53,57],[48,52,55,58]],bass:[41,38,34,36],cut:600,hat:.3}
  };
  const BY_SCENE={churrasco:'tropical',festa:'disco',pijama:'lofi',parque:'deep',boate:'tech',boteco:'disco',piscina:'tropical',vulcao:'tech',templo:'deep',praia:'tropical',rooftop:'deep'};
  let ac=null,master=null,comp=null,chordBus=null,noiseBuf=null,timer=null,step=0,nextT=0,P=PRESETS.deep,vol=.55;
  const st={on:false,beat:0,lastKick:0,preset:'deep'};
  const mtof=m=>440*Math.pow(2,(m-69)/12);
  function init(){if(ac)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ac=new AC();
    comp=ac.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;master=ac.createGain();master.gain.value=0;comp.connect(master);master.connect(ac.destination);
    chordBus=ac.createGain();chordBus.gain.value=.5;chordBus.connect(comp);
    noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  function kick(t){const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(45,t+.12);g.gain.setValueAtTime(1,t);g.gain.exponentialRampToValueAtTime(.001,t+.42);o.connect(g);g.connect(comp);o.start(t);o.stop(t+.45);
    chordBus.gain.setValueAtTime(.18,t);chordBus.gain.linearRampToValueAtTime(.55,t+.22);}
  function noise(t,dur,f,type,gain){const s=ac.createBufferSource();s.buffer=noiseBuf;const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;const g=ac.createGain();g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(fl);fl.connect(g);g.connect(comp);s.start(t,Math.random()*.5);s.stop(t+dur+.02);}
  function bass(t,m,dur){const o=ac.createOscillator(),f=ac.createBiquadFilter(),g=ac.createGain();o.type='sawtooth';o.frequency.value=mtof(m);f.type='lowpass';f.frequency.setValueAtTime(P.cut*.9,t);f.frequency.exponentialRampToValueAtTime(140,t+dur);f.Q.value=6;
    g.gain.setValueAtTime(.32,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(f);f.connect(g);g.connect(comp);o.start(t);o.stop(t+dur+.02);}
  function stab(t,notes,dur){const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(P.cut*2,t);f.frequency.exponentialRampToValueAtTime(P.cut*.6,t+dur);f.Q.value=3;const g=ac.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.11,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    f.connect(g);g.connect(chordBus);notes.forEach(m=>[-6,6].forEach(det=>{const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=mtof(m);o.detune.value=det;o.connect(f);o.start(t);o.stop(t+dur+.02);}));}
  function pad(t,notes,dur){const g=ac.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.035,t+.5);g.gain.linearRampToValueAtTime(.0001,t+dur);const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=1200;f.connect(g);g.connect(chordBus);
    notes.forEach(m=>{const o=ac.createOscillator();o.type='triangle';o.frequency.value=mtof(m+12);o.connect(f);o.start(t);o.stop(t+dur+.05);});}
  function schedule(){const spb=60/P.bpm,s16=spb/4;
    while(nextT<ac.currentTime+.12){const t=nextT,i=step%16,bar=Math.floor(step/16)%4,ch=P.prog[bar];
      if(i%4===0){kick(t);st.lastKick=t;}
      if(i===4||i===12)noise(t,.18,1600,'bandpass',.35);
      if(i%4===2)noise(t,.09,8000,'highpass',.22*P.hat+.05);
      if(i%2===1)noise(t,.03,9500,'highpass',.06);
      if([2,6,10,14].includes(i))bass(t,P.bass[bar]+(i===14?12:0),s16*1.8);
      if([3,6,11].includes(i)||(i===14&&bar%2))stab(t,ch,s16*1.6);
      if(i===0)pad(t,ch,spb*4);
      nextT+=s16;step++;}}
  function on(){init();if(!ac)return false;ac.resume();if(st.on)return true;st.on=true;nextT=ac.currentTime+.06;step=0;master.gain.cancelScheduledValues(ac.currentTime);master.gain.linearRampToValueAtTime(vol,ac.currentTime+.6);timer=setInterval(schedule,25);return true;}
  function off(){if(!ac||!st.on)return;st.on=false;clearInterval(timer);master.gain.cancelScheduledValues(ac.currentTime);master.gain.linearRampToValueAtTime(0,ac.currentTime+.3);}
  st.toggle=()=>{st.on?off():on();return st.on;};st.start=on;st.stop=off;
  st.scene=id=>{const k=BY_SCENE[id]||'deep';st.preset=k;P=PRESETS[k];};
  st.setVol=v=>{vol=v;if(master&&st.on)master.gain.linearRampToValueAtTime(v,ac.currentTime+.1);};
  st.pulse=()=>{if(!st.on||!ac)return null;const spb=60/P.bpm,ph=((ac.currentTime-st.lastKick)%spb)/spb;return Math.max(0,1-ph*1.6);};
  st.name=()=>({deep:'Deep house',disco:'Disco house',tropical:'Tropical house',tech:'Tech house',lofi:'Lo-fi house'})[st.preset];
  return st;})();
