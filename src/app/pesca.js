/* ================= pesca de carpas (templo, 1 pessoa por banquinho) =================
 * Senta num banquinho da beira do lago e a câmera vira para a água, vista de cima.
 * Clique na água para lançar a boia. Uma carpa chega, belisca (não clique ainda!) e, quando a boia afunda de vez,
 * você tem um instante para fisgar. Aí começa a briga: segure (mouse, toque ou espaço) para subir a faixa amarela
 * e mantenha a carpa dentro dela até a barra encher. Solte demais e ela escapa.
 * Quem está na sala vê a vara, a linha, a boia e a carpa saindo da água.
 *   f {s, x, y, k, cm}   estado de quem pesca: cast, bite, reel, catch, lost, idle (x, y: onde a boia caiu, de 0 a 1)
 */
const KOI=[   // nome, cores (base, mancha, terceira), peso no sorteio, tamanho mínimo e máximo (cm)
  {n:'Kohaku',c:['#f6f2ea','#e2402e',null],w:30,cm:[28,62]},
  {n:'Sanke',c:['#f6f2ea','#e2402e','#1c1418'],w:20,cm:[28,60]},
  {n:'Showa',c:['#1c1418','#e2402e','#f6f2ea'],w:14,cm:[30,64]},
  {n:'Ogon',c:['#f2c23a','#ffe27a',null],w:10,cm:[32,70],shine:1},
  {n:'Asagi',c:['#5a7898','#e8743a','#9ab4cc'],w:10,cm:[30,62]},
  {n:'Chagoi',c:['#8a6038','#a8784a',null],w:8,cm:[45,92]},
  {n:'Tancho',c:['#f8f6f0','#e2302a',null],w:4,cm:[35,70],tancho:1},
  {n:'Kin Ginrin',c:['#ffd23f','#fff4b0','#e8a020'],w:2,cm:[40,80],shine:2},
  {n:'chinelo velho',c:['#3a7ad8','#f2efe9',null],w:3,cm:[24,28],junk:1},
];
let PE=null;   // tela aberta

G.defs.pesca={
  name:'Pesca',verb:'Pescar carpas',icon:'dice',n:1,solo:true,plates:()=>null,
  stand(a){return[[a.x,a.y]];},
  startLog:st=>gFirst(st.players[0].n)+' foi pescar no lago.',
  init(){return{s:'idle',x:.5,y:.5,k:-1,cm:0,t:0,got:0};},
  toWire(m){return{s:m.s,x:m.x,y:m.y,k:m.k,cm:m.cm,got:m.got};},
  fromWire(w){return{s:String(w.s||'idle'),x:+w.x||.5,y:+w.y||.5,k:w.k|0,cm:w.cm|0,t:now,got:w.got|0};},
  onMsg(a,st,d,from){
    if(d.t!=='f'||!st.m||st.players[0].peer!==from)return;
    Object.assign(st.m,{s:String(d.s),x:+d.x||.5,y:+d.y||.5,k:d.k|0,cm:d.cm|0,t:now});
    if(d.s==='catch'){st.m.got++;peLogCatch(st.players[0].n,d.k|0,d.cm|0);}
  },
  tag(a,st){const m=st.m;if(m&&m.s==='catch'&&now-m.t<3500&&KOI[m.k])return{t:KOI[m.k].junk?'um chinelo!':`${KOI[m.k].n} · ${m.cm} cm`,c:'#ffd23f'};return false;},
  stageOpen:peStageOpen,stageClose:peStageClose,
  dbg:m=>({s:m.s,k:m.k,cm:m.cm,got:m.got,local:PE?PE.s:null}),
  test(cmd){if(!PE)return null;PE.tut=0;if(cmd==='cast'){peCast(.5,.45);return PE.s;}if(cmd==='bite'){PE.s='bite';PE.t=now;PE.biteT=now;peSend('bite');return PE.s;}if(cmd==='strike'){peAction();return PE.s;}if(cmd==='win'){PE.prog=1.2;return PE.s;}return PE.s;},
};
function peLogCatch(nome,k,cm){const f=KOI[k];if(!f)return;addLog(null,f.junk?`${gFirst(nome)} fisgou... um chinelo velho. Devolveu pro lago.`:`${gFirst(nome)} pescou uma carpa ${f.n} de ${cm} cm!`);}

/* banquinho na beira do lago; dir = para onde ele olha (a água) */
function fishSpot(gx,gy,face){
  seatAt(gx,gy,face);addF(gx,gy,()=>{   // banquinho baixo de madeira
    [[.3,.3],[.62,.3],[.3,.62],[.62,.62]].forEach(([dx,dy])=>bx(gx+dx,gy+dy,.08,.08,12,0,'#4a2e1c'));
    box(gx+.24,gy+.24,.52,.52,4,12,'#a8743c','#7a4a2a','#6a3e22');},{block:false,dz:-.01});
  actReg('pesca',gx,gy,1,1);
  const act=B.acts[B.acts.length-1];act.dir={x:[1,0],y:[0,1],nx:[-1,0],ny:[0,-1]}[face];
  B.air.push(()=>gamePescaDraw(act));
}

/* ---------- o mundo: vara, linha, boia e a carpa saindo da água ---------- */
function gamePescaDraw(act){
  const st=G.acts[act.id];if(!st||st.status!=='playing'||!st.m)return;
  const m=st.m,[dx,dy]=act.dir,px=-dy,py=dx,cx=act.x+.5,cy=act.y+.5;
  const hand=up(S(cx+dx*.2,cy+dy*.2),34),tip=up(S(cx+dx*1.1,cy+dy*1.1),74);
  ctx.strokeStyle='#3a2414';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...hand);ctx.lineTo(...tip);ctx.stroke();
  ctx.strokeStyle='#c9a26a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(hand[0]+(tip[0]-hand[0])*.5,hand[1]+(tip[1]-hand[1])*.5);ctx.lineTo(...tip);ctx.stroke();
  if(m.s==='idle')return;
  const e=now-m.t,off=(m.x-.5)*1.4,dist=1.5+(1-m.y)*.9;
  let fl=S(cx+dx*dist+px*off,cy+dy*dist+py*off);
  if(m.s==='cast'&&e<450){const k=e/450;fl=[tip[0]+(fl[0]-tip[0])*k,tip[1]+(fl[1]-tip[1])*k-Math.sin(k*Math.PI)*24];}
  const bob=m.s==='bite'?3+Math.sin(now/50)*1.5:m.s==='reel'?Math.sin(now/70)*2:Math.sin(now/400)*.8;
  ctx.strokeStyle='rgba(240,240,240,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...tip);
  ctx.quadraticCurveTo((tip[0]+fl[0])/2,Math.max(tip[1],fl[1])+(m.s==='reel'?0:10),fl[0],fl[1]+bob);ctx.stroke();
  if(m.s==='bite'||m.s==='reel'){const r=4+((now/120)%6);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(fl[0],fl[1]+2,r,r/2,0,0,7);ctx.stroke();}
  if(m.s!=='bite'){R(Math.round(fl[0])-1,Math.round(fl[1]+bob)-3,3,2,'#e83a3a');R(Math.round(fl[0])-1,Math.round(fl[1]+bob)-1,3,2,'#ffffff');}
  if(m.s==='catch'&&e<2600&&KOI[m.k]){   // a carpa (ou o chinelo) pula da água até a mão
    const k=Math.min(1,e/700),x=fl[0]+(hand[0]-fl[0])*k,y=fl[1]+(hand[1]-24-fl[1])*k-Math.sin(k*Math.PI)*30,f=KOI[m.k];
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(k<1?-1.2+k*2:Math.sin(now/90)*.4);
    if(f.junk){R(-4,-2,9,4,'#1c1428');R(-3,-1,7,2,f.c[0]);}
    else{R(-6,-2,11,5,'#1c1428');R(-5,-1,9,3,f.c[0]);R(-2,-1,3,2,f.c[1]);R(5,-3,3,7,'#1c1428');R(5,-2,2,5,f.c[0]);}
    ctx.restore();
    if(e>700&&e<2000){ctx.fillStyle='#ffd23f';for(let i=0;i<4;i++){const a=now/200+i*1.57;ctx.fillRect(Math.round(hand[0]+Math.cos(a)*12),Math.round(hand[1]-24+Math.sin(a)*8),2,2);}}
  }
}

/* ---------- a tela: o lago visto de cima ---------- */
const PE_POND={x:16,y:14,w:SW-32,h:SH-40};
function peStageOpen(a,st,idx,cv){
  peStageClose();cv.width=SW;cv.height=SH;
  const fish=[];for(let i=0;i<7;i++)fish.push(peFish());
  PE={a,st,cv,g:cv.getContext('2d'),raf:0,s:'idle',t:now,fx:SW/2,fy:SH/2,fish,target:null,nib:0,nextNib:0,biteT:0,
    hold:false,bar:.5,barV:0,zone:.5,zoneV:0,prog:.3,catch:null,msg:'',msgT:0,last:now,bg:peBg(),petals:[],rec:LS.get('role-pesca',{n:0,best:null}),tut:LS.get('role-pesca-tut',0)?0:1};
  cv.onpointerdown=e=>{if(!PE)return;const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*SW,y=(e.clientY-r.top)/r.height*SH;if(peTutClick(x,y))return;peAction(x,y);};
  cv.onpointerup=cv.onpointercancel=()=>{if(PE)PE.hold=false;};
  PE.key=e=>{if(!PE||e.code!=='Space'||document.activeElement&&document.activeElement.tagName==='INPUT')return;e.preventDefault();if(e.type==='keydown'){if(!e.repeat){if(PE.tut)peTutNext();else peAction();}}else PE.hold=false;};
  addEventListener('keydown',PE.key);addEventListener('keyup',PE.key);
  gInfo(PE.tut?'Veja como jogar':'Clique na água para lançar');
  const loop=()=>{if(!PE)return;peStep();peDraw();PE.raf=requestAnimationFrame(loop);};
  PE.raf=requestAnimationFrame(loop);
}
function peStageClose(){if(!PE)return;cancelAnimationFrame(PE.raf);PE.cv.onpointerdown=PE.cv.onpointerup=PE.cv.onpointercancel=null;removeEventListener('keydown',PE.key);removeEventListener('keyup',PE.key);PE=null;}

function peSend(s,extra){
  const st=PE.st;if(!st.m)return;
  const w={s,x:+((PE.fx-PE_POND.x)/PE_POND.w).toFixed(3),y:+((PE.fy-PE_POND.y)/PE_POND.h).toFixed(3),k:-1,cm:0,...(extra||{})};
  Object.assign(st.m,w,{t:now});gSend(PE.a,'f',w);
}
function peSay(t){PE.msg=t;PE.msgT=now;}

/* sorteia a próxima carpa (o peso diz quão rara é) */
function peRoll(){let tot=0;KOI.forEach(k=>tot+=k.w);let r=Math.random()*tot;for(let i=0;i<KOI.length;i++){r-=KOI[i].w;if(r<=0)return i;}return 0;}
function peFish(k){
  k=k==null?peRoll():k;const f=KOI[k];
  return{k,x:PE_POND.x+30+Math.random()*(PE_POND.w-60),y:PE_POND.y+30+Math.random()*(PE_POND.h-60),a:Math.random()*6.28,v:14+Math.random()*10,
    len:f.junk?16:22+(f.cm[1]-30)/3+Math.random()*6,ph:Math.random()*6,turn:0,flee:0,seed:Math.random()*1e4|0};
}

/* clique, toque ou espaço: lança, fisga ou puxa, dependendo do momento */
function peAction(x,y){
  const P=PE;if(!P||P.st.status!=='playing'||P.tut)return;
  if(P.s==='catch'){if(now-P.t>900){P.s='idle';P.t=now;peSend('idle');}return;}
  if(P.s==='reel'){P.hold=true;return;}
  if(P.s==='bite'){P.s='reel';P.t=now;P.prog=.3;P.bar=.5;P.barV=0;P.zone=.5;P.zoneV=0;P.hold=true;peSay('Fisgou! Segure para puxar');peSend('reel');return;}
  if(P.s==='nibble'){peScare('Cedo demais! A carpa se assustou');return;}
  if(x==null){x=SW/2;y=SH*.45;}
  if(x<PE_POND.x+10||x>PE_POND.x+PE_POND.w-10||y<PE_POND.y+10||y>PE_POND.y+PE_POND.h-14)return;
  peCast((x-PE_POND.x)/PE_POND.w,(y-PE_POND.y)/PE_POND.h);
}
function peCast(u,v){
  const P=PE;P.fx=PE_POND.x+u*PE_POND.w;P.fy=PE_POND.y+v*PE_POND.h;
  P.s='cast';P.t=now;P.target=null;P.wait=now+450+1200+Math.random()*2600;
  peSend('cast');gInfo('Espere a boia afundar de vez…');
}
function peScare(t){const P=PE;if(P.target){P.target.flee=now+2500;}P.target=null;P.s='wait';P.wait=now+1500+Math.random()*2500;peSay(t);peSend('cast');}

function peStep(){
  const P=PE,dt=Math.min(.05,(now-P.last)/1000);P.last=now;
  // carpas nadando (devagar, desviando da borda); a escolhida vai até a boia
  for(const f of P.fish){
    let ta=null;
    if(f===P.target&&(P.s==='wait'||P.s==='nibble'||P.s==='bite')){const dx=P.fx-f.x,dy=P.fy-f.y;ta=Math.atan2(dy,dx);if(Math.hypot(dx,dy)<f.len*.55){f.v=Math.max(0,f.v-dt*40);}else f.v=Math.min(26,f.v+dt*20);}
    else if(f.flee>now){const dx=f.x-P.fx,dy=f.y-P.fy;ta=Math.atan2(dy,dx);f.v=46;}
    else{f.turn+=(Math.random()-.5)*dt*2;f.turn*=.98;f.a+=f.turn*dt;f.v+=(18-f.v)*dt;}
    const m=26;if(f.x<PE_POND.x+m)ta=0;else if(f.x>PE_POND.x+PE_POND.w-m)ta=Math.PI;if(f.y<PE_POND.y+m)ta=Math.PI/2;else if(f.y>PE_POND.y+PE_POND.h-m)ta=-Math.PI/2;
    if(ta!=null){let d=ta-f.a;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;f.a+=Math.max(-2.4*dt,Math.min(2.4*dt,d));}
    f.x+=Math.cos(f.a)*f.v*dt;f.y+=Math.sin(f.a)*f.v*dt;f.ph+=dt*(3+f.v/6);
  }
  if(P.s==='cast'&&now-P.t>450){P.s='wait';}
  if(P.s==='wait'&&now>P.wait&&!P.target){   // a carpa mais perto que não está fugindo vem ver
    const c=P.fish.filter(f=>f.flee<now).sort((p,q)=>Math.hypot(p.x-P.fx,p.y-P.fy)-Math.hypot(q.x-P.fx,q.y-P.fy))[0];
    if(c){P.target=c;}
  }
  if(P.s==='wait'&&P.target&&Math.hypot(P.target.x-P.fx,P.target.y-P.fy)<P.target.len*.6){P.s='nibble';P.t=now;P.nib=1+Math.floor(Math.random()*3);P.nextNib=now+500;}
  if(P.s==='nibble'&&now>P.nextNib){
    if(P.nib>0){P.nib--;P.nibT=now;P.nextNib=now+650+Math.random()*700;}
    else{P.s='bite';P.t=now;P.biteT=now;peSend('bite');gInfo('AGORA! Clique!');}
  }
  if(P.s==='bite'&&now-P.biteT>(KOI[P.target?P.target.k:0].junk?1200:820)){peScare('Ela escapou… espere a próxima');gInfo('Espere a boia afundar de vez…');}
  if(P.s==='reel'){
    // a carpa puxa: a faixa verde (onde ela está) dá trancos; a amarela (você) sobe segurando e cai soltando
    const f=P.target?KOI[P.target.k]:KOI[0],hard=f.junk?.3:.6+(f.cm[1]-60)/60+(f.w<5?.5:0);
    if(Math.random()<dt*(1.2+hard))P.zoneV=(Math.random()-.5)*(1.6+hard*1.6);
    P.zone+=P.zoneV*dt;P.zoneV*=Math.pow(.6,dt);if(P.zone<.1){P.zone=.1;P.zoneV=Math.abs(P.zoneV);}if(P.zone>.9){P.zone=.9;P.zoneV=-Math.abs(P.zoneV);}
    P.barV+=(P.hold?2.6:-2.2)*dt;P.barV*=Math.pow(.25,dt);P.bar+=P.barV*dt;if(P.bar<.08){P.bar=.08;P.barV=0;}if(P.bar>.92){P.bar=.92;P.barV=0;}
    const inside=Math.abs(P.bar-P.zone)<.11;
    P.prog+=(inside?.3:-.2)*dt;
    if(P.target){P.target.x+=Math.sin(now/90)*.6;P.target.a+=Math.sin(now/120)*.05;}
    if(P.prog>=1)peCatch();
    else if(P.prog<=0){P.s='lost';P.t=now;if(P.target){P.target.flee=now+3000;}P.target=null;peSay('A linha afrouxou e ela escapou!');peSend('lost');gInfo('Clique na água para lançar');}
  }
  if(P.s==='lost'&&now-P.t>1500){P.s='idle';P.t=now;peSend('idle');}
  // pétalas de cerejeira caindo na água
  if(Math.random()<dt*.8)P.petals.push({x:Math.random()*SW,y:-4,v:6+Math.random()*6,a:Math.random()*6,life:now});
  P.petals=P.petals.filter(p=>{p.y+=p.v*dt;p.x+=Math.sin(now/600+p.a)*dt*6;return p.y<SH&&now-p.life<40000;});
}
function peCatch(){
  const P=PE,f=P.target||peFish(0),k=f.k,K=KOI[k],cm=Math.round(K.cm[0]+(K.cm[1]-K.cm[0])*Math.pow(Math.random(),1.6));
  P.s='catch';P.t=now;P.hold=false;P.catch={k,cm};
  const i=P.fish.indexOf(f);if(i>=0)P.fish[i]=peFish();   // ela volta pro lago (e outra aparece)
  P.target=null;
  const rec=P.rec;rec.n=(rec.n||0)+1;let novo=false;
  if(!K.junk&&(!rec.best||cm>rec.best.cm)){rec.best={k,cm};novo=true;}
  P.catch.novo=novo;LS.set('role-pesca',rec);
  P.st.m.got++;peSend('catch',{k,cm});peLogCatch(ME.nome,k,cm);
  P.msg='';
  gInfo('Clique para soltar e lançar de novo');
}

/* água, pedras da borda e vitórias-régias (desenhado uma vez) */
function peBg(){
  const c=document.createElement('canvas');c.width=SW;c.height=SH;const g=c.getContext('2d'),P=PE_POND;
  g.fillStyle='#7a7670';g.fillRect(0,0,SW,SH);
  let s=3;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let i=0;i<260;i++){const x=rnd()*SW,y=rnd()*SH,w=6+rnd()*14,h=4+rnd()*8;g.fillStyle=['#8a8680','#6a6660','#9a968e','#5a5650'][rnd()*4|0];g.fillRect(x|0,y|0,w|0,h|0);}
  const gr=g.createLinearGradient(0,P.y,0,P.y+P.h);gr.addColorStop(0,'#1f5a6a');gr.addColorStop(1,'#15404e');g.fillStyle=gr;g.fillRect(P.x,P.y,P.w,P.h);
  g.fillStyle='#000';g.fillRect(P.x-2,P.y-2,P.w+4,2);g.fillRect(P.x-2,P.y+P.h,P.w+4,2);g.fillRect(P.x-2,P.y,2,P.h);g.fillRect(P.x+P.w,P.y,2,P.h);
  for(let i=0;i<500;i++){g.fillStyle=rnd()<.5?'#1c5262':'#22606f';g.fillRect(P.x+(rnd()*P.w|0),P.y+(rnd()*P.h|0),2,1);}
  for(let i=0;i<6;i++){const x=P.x+40+rnd()*(P.w-80),y=P.y+30+rnd()*(P.h-60),r=9+rnd()*6;
    for(let j=-r;j<=r;j++){const w=Math.floor(Math.sqrt(r*r-j*j));g.fillStyle='#2f7a3a';g.fillRect(x-w|0,y+j*.7|0,w*2,1);}
    g.fillStyle='#15404e';g.fillRect(x|0,y-1|0,r|0,2);g.fillStyle='#4f9a4e';g.fillRect(x-r*.5|0,y-r*.3|0,4,2);
    if(rnd()<.5){g.fillStyle='#ff9ac8';g.fillRect(x-3|0,y-4|0,6,4);g.fillStyle='#ffe0f0';g.fillRect(x-1|0,y-5|0,2,2);g.fillStyle='#ffd23f';g.fillRect(x|0,y-3|0,1,1);}}
  return c;
}

/* disco em pixel (sem borda borrada) */
function peDisc(g,cx,cy,r){cx=Math.round(cx);cy=Math.round(cy);const R=Math.max(1,Math.round(r));for(let j=-R;j<=R;j++){const w=Math.round(Math.sqrt(R*R-j*j));g.fillRect(cx-w,cy+j,w*2+1,1);}}
/* carpa vista de cima: corpo feito de discos ao longo da espinha (o rabo balança), manchas conforme a variedade */
function peKoi(g,f,x,y,a,len,ph,alpha){
  const K=KOI[f.k],ca=Math.cos(a),sa=Math.sin(a);g.globalAlpha=alpha==null?1:alpha;
  if(K.junk){   // chinelo boiando
    g.save();g.translate(Math.round(x),Math.round(y));g.rotate(a);g.fillStyle='#000';g.fillRect(-9,-5,18,10);g.fillStyle=K.c[0];g.fillRect(-8,-4,16,8);g.fillStyle=K.c[1];g.fillRect(-2,-4,2,8);g.fillRect(-4,-1,6,2);g.restore();g.globalAlpha=1;return;}
  const n=Math.max(10,Math.round(len*.55)),pts=[];
  for(let i=0;i<n;i++){const t=i/(n-1),sw=Math.sin(ph-t*3.2)*t*t*len*.2,d=(.5-t)*len,r=len*.15*(t<.28?.72+t/.28*.28:1-(t-.28)/.72*.78);
    pts.push({x:x+ca*d-sa*sw,y:y+sa*d+ca*sw,r});}
  const col=i=>{const s=(i+f.seed)%5,mid=i>=1&&i<n-3;
    switch(K.n){
      case 'Kohaku':return mid&&s<2?K.c[1]:K.c[0];
      case 'Sanke':return mid&&s<2?K.c[1]:K.c[0];
      case 'Showa':return mid&&s<2?K.c[1]:mid&&s===3?K.c[2]:K.c[0];
      case 'Asagi':return i<n*.35?K.c[2]:i>n-4?K.c[1]:K.c[0];
      case 'Chagoi':return s===0&&mid?K.c[1]:K.c[0];
      default:return mid&&K.c[1]&&s===0?K.c[1]:K.c[0];}};
  // sombra no fundo
  g.fillStyle='rgba(0,0,0,.22)';pts.forEach(p=>peDisc(g,p.x+3,p.y+4,p.r));
  // rabo (dois lóbulos) e barbatanas do peito
  const tl=pts[n-1],tw=Math.sin(ph-3.2)*2.5,fin=K.n==='Asagi'?K.c[2]:'rgba(255,255,255,.55)';
  g.fillStyle=fin;
  for(let k=1;k<=5;k++){const bx=tl.x-ca*k,by=tl.y-sa*k,sp=k*.8;g.fillRect(Math.round(bx-sa*(sp+tw)),Math.round(by+ca*(sp+tw)),2,2);g.fillRect(Math.round(bx+sa*(sp-tw)),Math.round(by-ca*(sp-tw)),2,2);}
  const hd=pts[Math.round(n*.22)],fl=hd.r+2+Math.sin(ph*1.3)*1;
  g.fillRect(Math.round(hd.x-sa*fl-1),Math.round(hd.y+ca*fl-1),3,2);g.fillRect(Math.round(hd.x+sa*fl-1),Math.round(hd.y-ca*fl-1),3,2);
  // contorno e corpo (do rabo para a cabeça)
  g.fillStyle='#0c1a20';pts.forEach(p=>peDisc(g,p.x,p.y,p.r+1));
  for(let i=n-1;i>=0;i--){g.fillStyle=col(i);peDisc(g,pts[i].x,pts[i].y,pts[i].r);}
  if(K.n==='Sanke'){g.fillStyle=K.c[2];for(let i=2;i<n-3;i+=3)if((i+f.seed)%2)g.fillRect(Math.round(pts[i].x+sa),Math.round(pts[i].y-ca),2,2);}
  if(K.tancho){g.fillStyle=K.c[1];peDisc(g,pts[1].x,pts[1].y,pts[1].r*.62);}
  // olhos e brilho (ogon e ginrin brilham)
  const e=pts[0];g.fillStyle='#0c1a20';g.fillRect(Math.round(e.x-sa*e.r*.6),Math.round(e.y+ca*e.r*.6),1,1);g.fillRect(Math.round(e.x+sa*e.r*.6),Math.round(e.y-ca*e.r*.6),1,1);
  g.fillStyle='rgba(255,255,255,.35)';for(let i=1;i<n-2;i+=2)g.fillRect(Math.round(pts[i].x-sa*pts[i].r*.4),Math.round(pts[i].y+ca*pts[i].r*.4),1,1);
  if(K.shine){g.fillStyle='#fff';const k=Math.floor(now/110+f.seed)%n;g.fillRect(Math.round(pts[k].x),Math.round(pts[k].y),1+K.shine,1+K.shine);}
  g.globalAlpha=1;
}

function peDraw(){
  const P=PE,g=P.g;g.imageSmoothingEnabled=false;
  g.drawImage(P.bg,0,0);
  const pond=PE_POND;g.save();g.beginPath();g.rect(pond.x,pond.y,pond.w,pond.h);g.clip();
  // ondinhas
  for(let i=0;i<40;i++){const x=pond.x+((i*97+now*.006*(1+i%3))%pond.w),y=pond.y+((i*53)%pond.h),l=3+Math.sin(now/500+i)*2;g.fillStyle='rgba(220,245,255,.22)';g.fillRect(Math.round(x),Math.round(y),Math.round(l),1);}
  for(const f of P.fish)peKoi(g,f,f.x,f.y,f.a,f.len,f.ph,f===P.target&&P.s==='reel'?1:.9);
  P.petals.forEach(p=>{g.fillStyle='#ffc6dc';g.fillRect(Math.round(p.x),Math.round(p.y),2,1);g.fillRect(Math.round(p.x)+1,Math.round(p.y)+1,1,1);});
  // linha e boia
  const showFloat=P.s!=='idle'&&P.s!=='catch';
  if(showFloat){
    let fx=P.fx,fy=P.fy;const e=now-P.t;
    if(P.s==='cast'&&e<450){const k=e/450;fx=SW/2+(P.fx-SW/2)*k;fy=SH+(P.fy-SH)*k-Math.sin(k*Math.PI)*60;}
    const nib=P.s==='nibble'&&now-(P.nibT||0)<260,dip=P.s==='bite'?3:nib?1.5:0,bob=Math.sin(now/380)*.7;
    g.strokeStyle='rgba(240,240,240,.8)';g.lineWidth=1;g.beginPath();g.moveTo(SW/2,SH);g.quadraticCurveTo(SW/2,(SH+fy)/2,fx,fy);g.stroke();
    if(P.s==='bite'||nib){const r=3+((now-(P.s==='bite'?P.biteT:P.nibT))/40)%12;g.strokeStyle='rgba(255,255,255,.6)';g.beginPath();g.arc(fx,fy,r,0,7);g.stroke();}
    if(P.s==='bite'){g.fillStyle='rgba(255,255,255,.7)';for(let k=0;k<6;k++){const a=k*1.05+now/80;g.fillRect(Math.round(fx+Math.cos(a)*7),Math.round(fy+Math.sin(a)*5),2,2);}}
    if(P.s!=='bite'){g.fillStyle='#000';g.fillRect(Math.round(fx)-3,Math.round(fy+bob+dip)-4,7,8);g.fillStyle='#e83a3a';g.fillRect(Math.round(fx)-2,Math.round(fy+bob+dip)-3,5,3);g.fillStyle='#fff';g.fillRect(Math.round(fx)-2,Math.round(fy+bob+dip),5,3);}
    else{g.fillStyle='#e83a3a';g.fillRect(Math.round(fx)-1,Math.round(fy)-1,3,2);}
  }
  g.restore();
  // a ponta da vara (embaixo, onde você está)
  g.fillStyle='#000';g.fillRect(SW/2-3,SH-26,6,26);g.fillStyle='#6a4024';g.fillRect(SW/2-2,SH-26,4,26);g.fillStyle='#c9a26a';g.fillRect(SW/2-1,SH-26,1,26);
  // briga
  if(P.s==='reel'){
    const bx=SW-58,by=46,bh=200,bw=22;
    g.fillStyle='#000';g.fillRect(bx-3,by-3,bw+6,bh+6);g.fillStyle='#1c2a3a';g.fillRect(bx,by,bw,bh);
    const zy=by+(1-P.zone)*bh,zh=bh*.22,yy=by+(1-P.bar)*bh,yh=bh*.17;
    g.fillStyle='rgba(143,212,42,.55)';g.fillRect(bx,Math.round(zy-zh/2),bw,Math.round(zh));
    peKoi(g,P.target||{k:0,seed:1},bx+bw/2,zy,-Math.PI/2,16,now/80,1);
    const inside=Math.abs(P.bar-P.zone)<.11;
    g.fillStyle='#000';g.fillRect(bx-2,Math.round(yy-yh/2)-1,bw+4,Math.round(yh)+2);g.fillStyle=inside?'#ffd23f':'#c9a03a';g.fillRect(bx,Math.round(yy-yh/2),bw,Math.round(yh));
    g.globalAlpha=.75;peKoi(g,P.target||{k:0,seed:1},bx+bw/2,zy,-Math.PI/2,16,now/80,1);g.globalAlpha=1;
    const px=bx+bw+8;g.fillStyle='#000';g.fillRect(px-2,by-2,10,bh+4);g.fillStyle='#2a2033';g.fillRect(px,by,6,bh);
    g.fillStyle=P.prog>.66?'#8fd42a':P.prog>.33?'#ffd23f':'#ff3d8b';g.fillRect(px,Math.round(by+bh*(1-P.prog)),6,Math.round(bh*P.prog));
    gInfo(P.hold?'Puxando!':'Segure para puxar');
  }
  // peixe pego
  if(P.s==='catch'&&P.catch){
    const K=KOI[P.catch.k],w=230,h=128,x=(SW-w)/2,y=56,e=now-P.t,k=Math.min(1,e/220);
    g.fillStyle='rgba(10,6,24,.55)';g.fillRect(0,0,SW,SH);
    g.save();g.translate(SW/2,y+h/2);g.scale(k,k);g.translate(-SW/2,-(y+h/2));
    g.fillStyle='#000';g.fillRect(x-3,y-3,w+6,h+6);g.fillStyle='#fbf6e8';g.fillRect(x,y,w,h);g.fillStyle='#ffd23f';g.fillRect(x,y,w,4);
    peKoi(g,{k:P.catch.k,seed:3},SW/2,y+46,Math.sin(now/300)*.15,K.junk?30:58,now/120,1);
    g.textAlign='center';g.textBaseline='middle';g.fillStyle='#1c1428';g.font='900 18px Anybody, sans-serif';
    g.fillText(K.junk?'Um chinelo velho':'Carpa '+K.n,SW/2,y+86);
    g.font='800 12px Anybody, sans-serif';g.fillStyle='#6a4fd0';
    g.fillText(K.junk?'Devolva pro lago (ou pro dono)':`${P.catch.cm} cm${P.catch.novo?' · NOVO RECORDE!':''}`,SW/2,y+106);
    const stars=K.junk?0:K.w>=20?1:K.w>=10?2:K.w>=5?3:K.w>=3?4:5;
    for(let i=0;i<5;i++){g.fillStyle=i<stars?'#ffb300':'#ddd';g.fillRect(SW/2-34+i*14,y+116,10,6);}
    g.restore();g.textAlign='left';
  }
  if(P.msg&&now-P.msgT<2200){g.font='800 13px Anybody, sans-serif';g.textAlign='center';g.fillStyle='#000';g.fillText(P.msg,SW/2+1,SH-38+1);g.fillStyle='#fff';g.fillText(P.msg,SW/2,SH-38);g.textAlign='left';}
  else if(P.s==='idle'&&!P.tut){gInfo('Clique na água para lançar');}
  if(!P.tut&&P.s==='idle'){g.fillStyle='#000';g.fillRect(SW-38,10,28,28);g.fillStyle='#ffd23f';g.fillRect(SW-36,12,24,24);g.fillStyle='#000';g.font='900 17px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('?',SW-24,25);g.textAlign='left';}
  if(P.tut)peTutDraw(g);
  // recorde no canto
  if(P.rec.best){g.font='700 9px Anybody, sans-serif';g.fillStyle='#fff';g.textAlign='right';g.fillText(`Recorde: ${KOI[P.rec.best.k].n} ${P.rec.best.cm} cm · ${P.rec.n} pescados`,SW-22,SH-10);g.textAlign='left';}
}

/* ---------- tutorial: 3 passos animados (lançar, fisgar, puxar), com as palavras certas para toque ou mouse ---------- */
const PE_TUT=3;
function peTouch(){return matchMedia('(pointer:coarse)').matches;}
function peTutNext(){const P=PE;if(!P||!P.tut)return;if(P.tut>=PE_TUT){P.tut=0;LS.set('role-pesca-tut',1);gInfo('Clique na água para lançar');}else P.tut++;P.tutT=now;}
function peTutClick(x,y){const P=PE;
  if(!P.tut){if(x>=SW-40&&x<=SW-8&&y>=8&&y<=40&&P.s==='idle'){P.tut=1;P.tutT=now;return true;}return false;}
  if(x>=SW-92&&x<=SW-34&&y>=44&&y<=64){P.tut=0;LS.set('role-pesca-tut',1);return true;}   // pular
  if(x>=150&&x<=330&&y>=214&&y<=248)peTutNext();
  return true;}
function peTutDraw(g){
  const P=PE,n=P.tut,touch=peTouch(),e=(now-(P.tutT||P.t))/1000;
  g.fillStyle='rgba(10,6,24,.72)';g.fillRect(0,0,SW,SH);
  const x=28,y=26,w=SW-56,h=SH-52;
  g.fillStyle='#000';g.fillRect(x-4,y-4,w+8,h+8);g.fillStyle='#fbf6e8';g.fillRect(x,y,w,h);g.fillStyle='#ffd23f';g.fillRect(x,y,w,6);
  // título e texto
  const T=[['Lance a boia',touch?'Toque na água, onde você quiser.':'Clique na água, onde você quiser.'],
           ['Espere e fisgue',touch?'Quando a boia afundar, toque na hora!':'Quando a boia afundar, clique na hora!'],
           ['Segure e puxe',touch?'Segure o dedo e mantenha o quadrado amarelo na carpa.':'Segure o mouse e mantenha o quadrado amarelo na carpa.']][n-1];
  g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#1c1428';g.font='900 20px Anybody, sans-serif';g.fillText(n+'. '+T[0],x+16,y+34);
  g.font='700 14px Anybody, sans-serif';g.fillStyle='#3b3355';
  const words=T[1].split(' ');let line='',ly=y+56;const maxW=w-32;
  for(const wd of words){const tst=line?line+' '+wd:wd;if(g.measureText(tst).width>maxW&&line){g.fillText(line,x+16,ly);line=wd;ly+=18;}else line=tst;}
  g.fillText(line,x+16,ly);
  // desenho animado (área de 190x120 à direita? em cima: centralizada abaixo do texto)
  const ax=SW/2,ay=y+136,ph=(e%3.2);
  const pond=(cx,cy,pw,ph2)=>{g.fillStyle='#000';g.fillRect(cx-pw/2-3,cy-ph2/2-3,pw+6,ph2+6);g.fillStyle='#2f86b5';g.fillRect(cx-pw/2,cy-ph2/2,pw,ph2);g.fillStyle='rgba(220,245,255,.25)';for(let i=0;i<5;i++)g.fillRect(cx-pw/2+10+i*38,cy-ph2/2+14+(i%2)*30,14,1);};
  const flo=(fx,fy,dip)=>{g.fillStyle='#000';g.fillRect(fx-4,fy-5+dip,9,10);g.fillStyle='#e83a3a';g.fillRect(fx-3,fy-4+dip,7,4);g.fillStyle='#fff';g.fillRect(fx-3,fy+dip,7,4);};
  const hand=(hx,hy,press)=>{g.fillStyle='#000';if(touch){g.fillRect(hx-5,hy-2,11,16);g.fillRect(hx-5,hy-14,11,14);g.fillStyle=press?'#ffd23f':'#ffe0c8';g.fillRect(hx-3,hy-1,7,12);g.fillRect(hx-3,hy-12,7,12);}else{g.fillRect(hx,hy,3,18);g.fillRect(hx,hy,14,3);g.fillRect(hx+3,hy+3,3,12);g.fillStyle=press?'#ffd23f':'#fff';g.fillRect(hx+1,hy+3,2,13);g.fillRect(hx+3,hy+1,10,2);g.fillRect(hx+3,hy+4,2,9);}if(press){g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.arc(hx+(touch?0:2),hy+(touch?-6:2),9+((now/90)%8),0,7);g.stroke();}};
  if(n===1){
    pond(ax,ay,220,88);const k=Math.min(1,ph/1.3),tx=ax+30,ty=ay-6;
    const hx=ax-80+(tx-(ax-80))*Math.min(1,ph/1),hy=ay+30+(ty-(ay+30))*Math.min(1,ph/1);
    if(ph>1.1){const r=((ph-1.1)*22)%26;g.strokeStyle='rgba(255,255,255,.65)';g.lineWidth=1;g.beginPath();g.ellipse(tx,ty+2,r,r/2,0,0,7);g.stroke();flo(tx,ty,Math.sin(now/380)*.7);}
    hand(Math.round(hx),Math.round(hy),ph>.95&&ph<1.5);
  }else if(n===2){
    pond(ax,ay,220,88);const fx=ax,fy=ay,c=e%2.6,dip=c>1.5?5:Math.sin(now/380)*.7;
    if(c>1.5){const r=3+((now/40)%12);g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=1;g.beginPath();g.arc(fx,fy,r,0,7);g.stroke();}
    flo(fx,fy,dip);
    if(c>1.5){g.fillStyle='#000';g.fillRect(fx+26,fy-48,78,26);g.fillStyle=Math.floor(now/160)%2?'#ffd23f':'#ff3d8b';g.fillRect(fx+28,fy-46,74,22);g.fillStyle='#000';g.font='900 16px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('AGORA!',fx+65,fy-35);g.textAlign='left';g.textBaseline='alphabetic';hand(fx+30,fy+14,c>1.9&&c<2.3);}
    else{g.fillStyle='#fff';g.font='700 12px Anybody, sans-serif';g.textAlign='center';g.fillText('esperando…',fx,fy+34);g.textAlign='left';}
  }else{
    const bx=ax-70,by=ay-42,bh=84,bw=26;
    g.fillStyle='#000';g.fillRect(bx-3,by-3,bw+6,bh+6);g.fillStyle='#1c2a3a';g.fillRect(bx,by,bw,bh);
    const z=.5+Math.sin(now/700)*.32,pos=Math.max(.1,Math.min(.9,z+Math.sin(now/260)*.04-(e%6<3?0:.0)));
    const hold=e%6<4.6,yb=Math.max(.09,Math.min(.91,hold?z+Math.sin(now/310)*.05:z-(e%6-4.6)*.35));
    g.fillStyle='rgba(143,212,42,.6)';g.fillRect(bx,Math.round(by+(1-z)*bh-12),bw,24);
    peKoi(g,{k:0,seed:1},bx+bw/2,by+(1-z)*bh,-Math.PI/2,16,now/80,1);
    const inside=Math.abs(yb-z)<.12;g.fillStyle='#000';g.fillRect(bx-2,Math.round(by+(1-yb)*bh-9)-1,bw+4,20);g.fillStyle=inside?'#ffd23f':'#c9a03a';g.fillRect(bx,Math.round(by+(1-yb)*bh-9),bw,18);
    // medidor de progresso
    const px=bx+bw+10;g.fillStyle='#000';g.fillRect(px-2,by-2,10,bh+4);g.fillStyle='#2a2033';g.fillRect(px,by,6,bh);const pr=hold?Math.min(1,(e%6)/4.6):0;g.fillStyle='#8fd42a';g.fillRect(px,Math.round(by+bh*(1-pr)),6,Math.round(bh*pr));
    hand(bx+bw+36,by+bh-28,hold);
    g.fillStyle='#1c1428';g.font='700 12px Anybody, sans-serif';g.textAlign='left';
    g.fillText(hold?'segurando: sobe a barra':'soltou: a carpa escapa',px+60,by+bh/2-6);g.fillText(hold?'verde cheio = pescou!':'',px+60,by+bh/2+10);
  }
  // pontinhos, pular e botão
  for(let i=1;i<=PE_TUT;i++){g.fillStyle='#000';g.fillRect(x+16+(i-1)*16,y+h-16,12,8);g.fillStyle=i<=n?'#ff3d8b':'#ddd';g.fillRect(x+17+(i-1)*16,y+h-15,10,6);}
  g.font='800 12px Anybody, sans-serif';g.fillStyle='#6a4fd0';g.textAlign='right';g.fillText('Pular',SW-38,y+28);g.textAlign='left';
  const bgc=Math.floor(now/500)%2?'#4ee07a':'#6af093';g.fillStyle='#000';g.fillRect(146,210,188,42);g.fillStyle=bgc;g.fillRect(150,214,180,34);
  g.fillStyle='#111';g.font='900 15px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(n<PE_TUT?'Próximo':'Bora pescar!',240,232);g.textAlign='left';g.textBaseline='alphabetic';
}
