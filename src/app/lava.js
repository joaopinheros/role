/* ================= o chão é lava! (ilha do vulcão) =================
 * De tempos em tempos (ou quando alguém bate o gongo), o chão começa a esquentar: em cada rodada uma parte das casas
 * brilha em laranja (aviso) e, logo depois, vira lava. Quem estiver numa casa de lava queima: fica 1,5 s pulando,
 * sem conseguir andar. São 8 rodadas, cada vez com mais lava. No fim sai quem queimou menos.
 * Quem começa manda só a semente; cada um sorteia as mesmas casas e cuida do próprio boneco.
 *   lava {t:'start', seed, by}     começou (by = quem bateu o gongo, ou vazio se foi sozinho)
 *   lava {t:'burn', r}             eu queimei na rodada r
 * A rodada automática sai do primeiro da sala (menor id), uns 2 a 4 minutos depois da última.
 */
const LV_INTRO=2600,LV_WARN=1700,LV_HOT=1800,LV_COOL=900,LV_ROUNDS=8,LV_ROUND=LV_WARN+LV_HOT+LV_COOL,LV_BURN=1500;
const LV={on:false,seed:0,t0:0,cells:new Set(),round:-1,burns:{},burned:-1,next:0,timer:0,lastEnd:0,inScene:false};

function lavaSetup(){
  lavaStop();
  LV.inScene=!!(SCN&&SCN.id==='vulcao');if(!LV.inScene)return;
  LV.next=Date.now()+90000+Math.random()*60000;
  LV.timer=setInterval(lavaAuto,1000);
}
function lavaStop(){clearInterval(LV.timer);LV.timer=0;LV.on=false;LV.cells=new Set();LV.round=-1;LV.inScene=false;if(me)me.burnUntil=0;}

/* o primeiro da sala dispara a rodada automática */
function lavaAuto(){
  if(!LV.inScene||LV.on||!live||!live.me)return;
  if(Date.now()<LV.next)return;
  const ids=[live.me,...peerAvs.keys()].map(String).sort();
  if(ids[0]!==String(live.me)){LV.next=Date.now()+20000;return;}   // outro puxa; se ele sumir, eu tento depois
  lavaBegin('');
}
function lavaBegin(by){
  const seed=(Date.now()^Math.floor(Math.random()*4e9))>>>0;
  live.send('lava',{t:'start',seed,by});
  lavaStart(seed,by);
}
function lavaStart(seed,by){
  if(LV.on)return;
  Object.assign(LV,{on:true,seed,t0:now,round:-1,cells:new Set(),burns:{},burned:-1});
  lavaBan(by?`${gFirst(by)} bateu o gongo!`:'O CHÃO É LAVA!',by?'O CHÃO É LAVA!':'Fuja das casas que brilharem');
  addLog(null,'O chão é lava! Fuja das casas que começarem a brilhar.');
}
function lavaRecv(d,from){
  if(!LV.inScene)return;
  if(d.t==='start')lavaStart(d.seed>>>0,String(d.by||''));
  else if(d.t==='burn'&&LV.on){
    const a=peerAvs.get(from);if(!a)return;
    a.burnUntil=now+LV_BURN;a.bubble={text:'AI! QUEIMEI!',t:now};
    LV.burns[a.user]=(LV.burns[a.user]||0)+1;
  }
}

/* as casas de lava da rodada r: sorteio igual em todo mundo (a semente veio na mensagem) */
function lavaCells(r){
  const free=[];for(let y=0;y<GH;y++)for(let x=0;x<GW;x++)if(!SCN.blocked.has(key(x,y)))free.push([x,y]);
  const rnd=rng((LV.seed+r*7919)>>>0),share=.22+r*.05;
  for(let i=free.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[free[i],free[j]]=[free[j],free[i]];}
  return new Set(free.slice(0,Math.round(free.length*share)).map(([x,y])=>key(x,y)));
}
/* fase agora: {r, ph: 'intro' | 'warn' | 'hot' | 'cool' | 'end', k (0..1 dentro da fase)} */
function lavaPhase(){
  const t=now-LV.t0;if(t<LV_INTRO)return{r:-1,ph:'intro',k:t/LV_INTRO};
  const u=t-LV_INTRO,r=Math.floor(u/LV_ROUND);if(r>=LV_ROUNDS)return{r,ph:'end',k:0};
  const e=u-r*LV_ROUND;
  if(e<LV_WARN)return{r,ph:'warn',k:e/LV_WARN};
  if(e<LV_WARN+LV_HOT)return{r,ph:'hot',k:(e-LV_WARN)/LV_HOT};
  return{r,ph:'cool',k:(e-LV_WARN-LV_HOT)/LV_COOL};
}

/* desenhado no chão do mundo, todo quadro */
function lavaGround(){
  if(!LV.on||!LV.inScene)return;
  const P=lavaPhase();
  if(P.ph==='end'){lavaEnd();return;}
  if(P.r!==LV.round&&P.r>=0){LV.round=P.r;LV.cells=lavaCells(P.r);}
  if(P.ph==='intro'||P.ph==='cool')return;
  const hot=P.ph==='hot';
  for(const k of LV.cells){
    const[x,y]=k.split(',').map(Number),pts=[S(x+.04,y+.04),S(x+.96,y+.04),S(x+.96,y+.96),S(x+.04,y+.96)];
    if(!hot){   // aviso: brilha cada vez mais rápido
      const blink=.25+.35*Math.abs(Math.sin(now/(160-P.k*90)));
      ctx.globalAlpha=blink;poly(pts,'#ff7a1a','#ffd23f',1.2);ctx.globalAlpha=1;
      continue;
    }
    poly(pts,'#c8280a');
    const c=S(x+.5,y+.5),t=now/260+x*1.7+y*2.3;
    ell(c[0]+Math.sin(t)*5,c[1]+Math.cos(t*1.3)*2,9,4,'#ff6a1a');ell(c[0]-Math.sin(t*.8)*6,c[1]+1,6,3,'#ffb02e');
    if(Math.sin(t*2.1)>.6)circ(c[0]+Math.cos(t)*7,c[1]-2,1.6,'#fff0a0');
  }
  if(hot)lavaCheckMe(P.r);
}
function lavaCheckMe(r){
  if(!me||me.burnUntil>now||LV.burned===r)return;
  const k=key(Math.round(me.fx),Math.round(me.fy));
  if(!LV.cells.has(k))return;
  LV.burned=r;me.burnUntil=now+LV_BURN;me.path=[];me.onArrive=null;me.bubble={text:'AI! QUEIMEI!',t:now};
  if(me.action==='sit')me.action=null;
  LV.burns[ME.usuario]=(LV.burns[ME.usuario]||0)+1;
  live.send('lava',{t:'burn',r});pushPres();
}
function lavaEnd(){
  if(!LV.on)return;LV.on=false;LV.cells=new Set();LV.round=-1;LV.lastEnd=Date.now();LV.next=Date.now()+120000+Math.random()*120000;
  const here=avatars.filter(a=>!a.bot&&a.user),list=here.map(a=>[gFirst(a.name),LV.burns[a.user]||0]).sort((p,q)=>p[1]-q[1]);
  const zero=list.filter(x=>x[1]===0).map(x=>x[0]);
  if(!list.length)return;
  const res=zero.length===list.length?'Ninguém queimou!':zero.length?`Sem queimadura: ${zero.join(', ')}.`:`Quem menos queimou: ${list[0][0]} (${list[0][1]}x).`;
  lavaBan('ACABOU!',res);
  addLog(null,'Fim do chão é lava. '+res+(list.length>1?' '+list.filter(x=>x[1]>0).map(x=>`${x[0]} ${x[1]}x`).join(', '):''));
}

/* brilho da lava por cima do escuro da noite (somado à luz, então até o boneco em cima fica alaranjado) */
function lavaAir(){
  if(!LV.on||!LV.inScene||!LV.cells.size)return;
  const P=lavaPhase();if(P.ph!=='warn'&&P.ph!=='hot')return;
  ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=P.ph==='hot'?.42+.12*Math.sin(now/120):.12+.2*Math.abs(Math.sin(now/(160-P.k*90)));
  for(const k of LV.cells){const[x,y]=k.split(',').map(Number);poly([S(x+.04,y+.04),S(x+.96,y+.04),S(x+.96,y+.96),S(x+.04,y+.96)],P.ph==='hot'?'#ff5a12':'#ff9a2a');}
  ctx.restore();
}

/* fogo em quem queimou (por cima de tudo, na tela) */
function lavaOverlay(){
  if(!LV.inScene)return;
  const k=bs*WS/dpr;   // px de tela por unidade do mundo
  for(const a of avatars){
    if(!(a.burnUntil>now))continue;
    const[x,y]=toScreen(a.sx,a.sy),sz=Math.max(2,Math.round(3*k));
    for(let i=0;i<10;i++){
      const ph=((now/420)+i/10)%1,fx=x+Math.sin(i*2.3+now/90)*9*k,fy=y-3*k-ph*44*k;
      sc.globalAlpha=1-ph;sc.fillStyle=ph<.3?'#fff0a0':ph<.6?'#ffb02e':'#ff4a1a';sc.fillRect(Math.round(fx-sz/2),Math.round(fy),sz,Math.round(sz*1.4));
    }
    sc.globalAlpha=1;
  }
}

/* aviso grande no meio da sala */
function lavaBan(t,sub){
  const el=$('#rban');if(!el)return;
  el.innerHTML='';const b=document.createElement('b');b.textContent=t;el.append(b);
  if(sub){const s=document.createElement('span');s.textContent=sub;el.append(s);}
  el.classList.remove('on');void el.offsetWidth;el.classList.add('on');
}

/* gongo da ilha: bate e começa na hora (um por vez, com 20 s de intervalo depois do último) */
G.defs.lava={
  name:'O chão é lava',n:1,instant:true,noClick:false,
  stand(a){return[[a.x+1,a.y],[a.x,a.y+1],[a.x-1,a.y]];},
  label(){return LV.on?null:Date.now()-LV.lastEnd<20000?null:'Bater o gongo (o chão é lava!)';},
  instant(){if(!LV.on&&live&&live.send)lavaBegin(ME.nome);},
};
function gong(gx,gy){actReg('lava',gx,gy,1,1);B.air.push(lavaAir);addF(gx,gy,()=>{
  const c=S(gx+.5,gy+.5);
  R(c[0]-14,c[1]-62,3,62,'#5a3a24');R(c[0]+11,c[1]-62,3,62,'#5a3a24');R(c[0]-16,c[1]-66,32,5,'#7a4a2e');R(c[0]-16,c[1]-66,32,1,'#9a6a44');
  const sw=Math.sin(now/700)*1.5,gx_=c[0]+sw,gy_=c[1]-38;
  ctx.strokeStyle='#2a1a10';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(c[0]-6,c[1]-61);ctx.lineTo(gx_-5,gy_-10);ctx.moveTo(c[0]+6,c[1]-61);ctx.lineTo(gx_+5,gy_-10);ctx.stroke();
  circ(gx_,gy_,12,'#1c1410');circ(gx_,gy_,11,'#c9902a');circ(gx_,gy_,8,'#e8b040');circ(gx_,gy_,3,'#c9902a');circ(gx_-3,gy_-4,2,'#fff0a0');
  R(c[0]+14,c[1]-30,2,22,'#7a4a2e');circ(c[0]+15,c[1]-31,3,'#d84a2a');
});glowA(gx+.5,gy+.5,38,22,'#ffb347',.35);}

function lavaDbg(cmd){
  if(cmd==='start'&&!LV.on&&live&&live.send){lavaBegin('teste');return true;}
  if(cmd==='fast'&&LV.on){LV.t0=now-LV_INTRO;return true;}   // pula a apresentação
  const P=LV.on?lavaPhase():null;
  return{on:LV.on,inScene:LV.inScene,round:P&&P.r,fase:P&&P.ph,cells:LV.cells.size||0,lista:[...LV.cells],burns:LV.burns,eu:me?[Math.round(me.fx),Math.round(me.fy)]:null,queimando:!!(me&&me.burnUntil>now)};
}
