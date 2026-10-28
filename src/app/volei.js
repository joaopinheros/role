/* ================= vôlei de praia (luau, 2 pessoas) =================
 * Cada um defende um lado da rede, numa tela de lado. Um toque só: chegue embaixo da bola e clique (ou espaço)
 * para pular e mandar para o outro lado. Onde você bate na bola decide para onde ela vai: na frente do corpo
 * ela vai funda, atrás vai curtinha; bater cedo (bola alta) faz balão, bater tarde faz cortada.
 * Ponto para quem a bola cair do outro lado. Ganha quem fizer 11.
 * Quem está na sala vê os dois correndo e pulando na quadra da areia, e a bola passando por cima da rede.
 *   pos {x}                      posição de quem joga (umas 8 vezes por segundo, só quando muda)
 *   hit {r, h, x0, z0, x1, T, H} batida número h do ponto r: a bola sai de (x0, z0), cai em x1 depois de T ms
 *   pt  {r, w}                   a bola caiu: ponto para w (quem manda é o dono do lado onde ela caiu)
 */
const VG=250,VNET=240,VNH=80,VL=30,VR=450,VREACH=42,VWIN=11;   // chão, rede, altura da rede, limites da quadra
const VCOURT={x0:3,x1:11,y:3};   // a quadra no mundo (luau): de x=3 a 11, na linha y=3
let VS=null;   // tela aberta

G.defs.volei={
  name:'Vôlei de praia',verb:'Jogar vôlei',icon:'dice',n:2,plates:()=>['tl','tr'],noClick:true,
  stand(a,i){return i===0?[[4,3],[3,3],[5,3]]:[[9,3],[10,3],[8,3]];},
  init(){return{score:[0,0],r:0,h:0,srv:0,px:[VL+90,VR-90],ball:null,jt:[0,0],tx:[VL+90,VR-90],srvAt:now};},
  toWire(m){return{score:m.score,r:m.r,h:m.h,srv:m.srv,px:m.px.map(Math.round)};},
  fromWire(w){return{score:w.score.slice(),r:w.r|0,h:w.h|0,srv:w.srv|0,px:w.px.slice(),tx:w.px.slice(),ball:null,jt:[0,0],srvAt:now};},
  onMsg:vOnMsg,tick:vTick,stageOpen:vStageOpen,stageClose:vStageClose,onReset:vReset,
  tag:(a,st)=>({t:`${gFirst(st.players[0].n)} ${st.m.score[0]} x ${st.m.score[1]} ${gFirst(st.players[1].n)}`,c:'#43d9e8'}),
  dbg:(m,st)=>({placar:m.score,r:m.r,h:m.h,srv:m.srv,px:m.px.map(Math.round),bola:m.ball?{by:m.ball.by,x1:Math.round(m.ball.x1)}:null,eu:gMine(st)}),
  test(cmd,arg){   // para os testes: põe o meu jogador onde a bola vai cair e bate
    if(!VS)return null;const m=VS.st.m,i=VS.idx;
    if(cmd==='go'){VS.keyX=null;VS.aimX=+arg;return true;}
    if(cmd==='where'){const b=m.ball;if(!b)return{srv:m.srv};const p=vBall(b,now);return{by:b.by,x1:b.x1,u:p.u,x:p.x,z:p.z,eu:m.px[i]};}
    if(cmd==='hit'){vPress();return true;}
    return null;},
};

/* posição da bola agora: parábola de (x0, z0) até (x1, 0) em T ms, com altura extra H */
function vBall(b,t){const u=Math.max(0,Math.min(1,(t-b.t)/b.T));return{x:b.x0+(b.x1-b.x0)*u,z:b.z0*(1-u)+4*b.H*u*(1-u),u};}
const vSide=x=>x<VNET?0:1;
const vClamp=(i,x)=>i===0?Math.max(VL+14,Math.min(VNET-16,x)):Math.max(VNET+16,Math.min(VR-14,x));

/* quem bate escolhe a jogada; a mesma conta roda em todo mundo a partir da mensagem */
function vShot(m,i,bx,bz,px){
  const dir=i===0?1:-1,off=Math.max(-1,Math.min(1,(bx-px)/VREACH))*dir;   // positivo = bola na frente do corpo
  const depth=Math.max(.12,Math.min(.95,.55+off*.38+(Math.random()-.5)*.16));
  const x1=VNET+dir*(12+depth*(VR-VNET-24));
  const early=Math.max(0,Math.min(1,(bz-60)/110));    // bola alta = balão; baixa = cortada
  const speed=Math.min(1.6,1+m.h*.03);                // o ponto vai ficando mais rápido
  const un=(VNET-bx)/(x1-bx),need=un>0&&un<1?(VNH+26-bz*(1-un))/(4*un*(1-un)):0;
  const H=Math.max(need,70+early*110);
  const T=Math.round((700+H*3.2+Math.abs(x1-bx)*1.4)/speed);
  return{x0:Math.round(bx),z0:Math.round(bz),x1:Math.round(x1),T,H:Math.round(H)};
}
function vApplyHit(st,i,d){
  const m=st.m;
  m.ball={x0:+d.x0,z0:+d.z0,x1:+d.x1,T:Math.max(300,+d.T),H:+d.H,by:i,t:now,done:false};
  m.h=d.h;m.jt[i]=now;
}
function vOnMsg(a,st,d,from){
  const m=st.m;if(!m||st.status!=='playing')return;
  const i=st.players.findIndex(p=>p.peer===from);if(i<0)return;
  if(d.t==='pos'){m.tx[i]=vClamp(i,+d.x||0);return;}
  if(d.t==='hit'&&d.r===m.r&&d.h===m.h+1){vApplyHit(st,i,d);return;}
  if(d.t==='pt'&&d.r===m.r&&(d.w===0||d.w===1)&&i===1-d.w)vPoint(a,st,d.w);
}
function vPoint(a,st,w){
  const m=st.m;
  m.score[w]++;m.r++;m.h=0;m.ball=null;m.srv=w;m.srvAt=now;
  if(VS&&VS.st===st)gBanner(w===VS.idx?'PONTO!':'PONTO DELES',w===VS.idx?'#8fd42a':'#ff8fc7');
  if(m.score[w]>=VWIN)gFinish(a,st,w,`${m.score[0]} x ${m.score[1]}`);
}

/* todo quadro (em todo mundo): bonecos na quadra; quem é dono do lado decide se a bola caiu */
function vTick(a,st,dt){
  const m=st.m,mine=gMine(st);
  for(let i=0;i<2;i++){if(i===mine)continue;m.px[i]+=(m.tx[i]-m.px[i])*Math.min(1,dt*10);}
  if(m.ball&&!m.ball.done&&mine>=0&&m.ball.by!==mine&&now-m.ball.t>=m.ball.T){   // caiu do meu lado
    m.ball.done=true;const w=1-mine,r=m.r;gSend(a,'pt',{r,w});vPoint(a,st,w);
  }
  if(!m.ball&&mine===m.srv&&now-m.srvAt>6000&&st.status==='playing'){vServe(a,st);}   // saque automático
  // os bonecos no mundo seguem a posição do jogo
  st.players.forEach((p,i)=>{
    const av=avatars.find(v=>!v.bot&&v.user===p.u);if(!av)return;
    const jx=now-m.jt[i],z=jx<450?Math.sin(jx/450*Math.PI)*18:0,moving=Math.abs(m.tx[i]-m.px[i])>1.5||(i===mine&&VS&&Math.abs((VS.aimX??m.px[i])-m.px[i])>2);
    av.ovr={fx:vWorldX(m.px[i])-.5,fy:VCOURT.y,z,pose:jx<450?{p:'wave',f:0}:moving?{p:'walk',f:Math.floor(now/120)%4}:{p:'idle',f:0}};
    av.back=i===1;av.mirror=i===1;
  });
}
const vWorldX=x=>VCOURT.x0+(x-VL)/(VR-VL)*(VCOURT.x1-VCOURT.x0);
function vReset(st){
  st.players.forEach(p=>{const av=avatars.find(v=>!v.bot&&v.user===p.u);if(!av||!av.ovr)return;
    if(av===me){const x=Math.round(av.ovr.fx),y=VCOURT.y;if(walkable(x,y,x,y)){me.gx=me.fx=x;me.gy=me.fy=y;me.path=[];}}
    delete av.ovr;});
  if(me)pushPres(true);
}

function vServe(a,st){
  const m=st.m,i=gMine(st);if(m.ball||i!==m.srv)return;
  const s=vShot(m,i,m.px[i]+(i===0?10:-10),150,m.px[i]);s.H=Math.max(s.H,120);
  const d={r:m.r,h:1,...s};vApplyHit(st,i,d);gSend(a,'hit',d);
}
/* apertou: pula; se a bola está ao alcance, bate */
function vPress(){
  const{a,st,idx}=VS,m=st.m;if(st.status!=='playing')return;
  if(!m.ball){if(m.srv===idx)vServe(a,st);return;}
  if(now-m.jt[idx]<380)return;
  m.jt[idx]=now;
  const b=m.ball;if(b.by===idx||b.done)return;
  const p=vBall(b,now),px=m.px[idx];
  if(Math.abs(p.x-px)<VREACH&&p.z>28&&p.z<190&&vSide(p.x)===idx){
    const s=vShot(m,idx,p.x,p.z,px),d={r:m.r,h:m.h+1,...s};vApplyHit(st,idx,d);gSend(a,'hit',d);
  }
}

/* ---------- o mundo: areia clarinha da quadra, rede e a bola ---------- */
function voleiCourt(){
  actReg('volei',VCOURT.x0,2,VCOURT.x1-VCOURT.x0,3);
  B.ground.push(()=>{   // linhas da quadra
    ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1.5;
    poly([S(3.08,2.08),S(10.92,2.08),S(10.92,4.92),S(3.08,4.92)],null,'rgba(255,255,255,.75)',1.5);
  });
  addF(7,4,()=>{   // rede no meio (entre x=6 e x=7)
    const p0=S(7,2),p1=S(7,5),H=52,top0=up(p0,H),top1=up(p1,H);
    [p0,p1].forEach(p=>{R(p[0]-2,p[1]-H-4,4,H+4,'#5a3a24');R(p[0]-2,p[1]-H-4,1,H+4,'#8a5a3a');});
    ctx.strokeStyle='rgba(30,30,40,.55)';ctx.lineWidth=1;
    for(let k=0;k<=12;k++){const t=k/12,a=[p0[0]+(p1[0]-p0[0])*t,p0[1]+(p1[1]-p0[1])*t];ctx.beginPath();ctx.moveTo(a[0],a[1]-H);ctx.lineTo(a[0],a[1]-H+22);ctx.stroke();}
    for(let k=0;k<4;k++){ctx.beginPath();ctx.moveTo(top0[0],top0[1]+k*6);ctx.lineTo(top1[0],top1[1]+k*6);ctx.stroke();}
    ctx.strokeStyle='#f2efe9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...top0);ctx.lineTo(...top1);ctx.stroke();
  },{block:false,dz:.5});
  B.air.push(gameVoleiDraw);
}
function gameVoleiDraw(){
  const st=Object.values(G.acts).find(s=>s.id.startsWith('volei@')&&s.status==='playing'&&s.m);if(!st)return;
  const m=st.m;let bx,bz;
  if(m.ball){const p=vBall(m.ball,now);if(p.u>=1&&now-m.ball.t>m.ball.T+600)return;bx=p.x;bz=p.z;}
  else{bx=m.px[m.srv]+(m.srv===0?10:-10);bz=150+Math.sin(now/200)*4;}
  const g=S(vWorldX(bx),VCOURT.y+.5),k=.62,y=g[1]-bz*k;
  ell(g[0],g[1],4,2,'rgba(0,0,0,.28)');
  circ(g[0],y,4,'#000');circ(g[0],y,3.2,'#fff6d0');ctx.fillStyle='#2f6fd6';ctx.fillRect(Math.round(g[0])-3,Math.round(y)-1,6,1);ctx.fillStyle='#ffd23f';ctx.fillRect(Math.round(g[0])-1,Math.round(y)-3,1,6);
}

/* ---------- a tela do jogo (de lado) ---------- */
function vStageOpen(a,st,idx,cv){
  vStageClose();cv.width=SW;cv.height=SH;
  VS={a,st,idx,cv,g:cv.getContext('2d'),raf:0,aimX:null,keyX:null,keys:{},sentX:-1,sentAt:0,bg:vBg(),last:now};
  const loc=e=>{const r=cv.getBoundingClientRect();return(e.clientX-r.left)/r.width*SW;};
  cv.onpointermove=e=>{if(VS&&(e.pointerType==='mouse'||e.buttons))VS.aimX=loc(e);};
  cv.onpointerdown=e=>{if(!VS)return;if(e.pointerType!=='mouse')VS.aimX=loc(e);vPress();};
  VS.key=e=>{if(!VS||document.activeElement&&document.activeElement.tagName==='INPUT')return;const k=e.code,dn=e.type==='keydown';
    if(['ArrowLeft','KeyA','ArrowRight','KeyD'].includes(k)){VS.keys[k]=dn;VS.aimX=null;e.preventDefault();}
    if(dn&&['Space','ArrowUp','KeyW'].includes(k)){e.preventDefault();if(!e.repeat)vPress();}};
  addEventListener('keydown',VS.key);addEventListener('keyup',VS.key);
  gInfo('');
  const loop=()=>{if(!VS)return;vStep();vDraw();VS.raf=requestAnimationFrame(loop);};
  VS.raf=requestAnimationFrame(loop);
}
function vStageClose(){if(!VS)return;cancelAnimationFrame(VS.raf);VS.cv.onpointermove=VS.cv.onpointerdown=null;removeEventListener('keydown',VS.key);removeEventListener('keyup',VS.key);VS=null;}

function vStep(){
  const V=VS,m=V.st.m,i=V.idx,dt=Math.min(.05,(now-V.last)/1000);V.last=now;
  if(V.st.status!=='playing')return;
  const kdir=(V.keys.ArrowRight||V.keys.KeyD?1:0)-(V.keys.ArrowLeft||V.keys.KeyA?1:0);
  let x=m.px[i];
  if(kdir)x+=kdir*230*dt;
  else if(V.aimX!=null){const d=vClamp(i,V.aimX)-x;x+=Math.sign(d)*Math.min(Math.abs(d),230*dt);}
  m.px[i]=m.tx[i]=vClamp(i,x);
  if(Math.abs(m.px[i]-V.sentX)>2&&now-V.sentAt>120){V.sentX=m.px[i];V.sentAt=now;gSend(V.a,'pos',{x:Math.round(m.px[i])});}
}

/* céu, mar e areia (dia ou noite, igual ao rolê) */
function vBg(){
  const c=document.createElement('canvas');c.width=SW;c.height=SH;const g=c.getContext('2d'),n=SCN&&SCN.night;
  const sky=g.createLinearGradient(0,0,0,170);sky.addColorStop(0,n?'#0b1030':'#4fa8e8');sky.addColorStop(1,n?'#3a2a5a':'#cfe9f5');g.fillStyle=sky;g.fillRect(0,0,SW,170);
  if(n){let s=5;const r=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};for(let k=0;k<70;k++){g.fillStyle=r()<.2?'#fff1d6':'#fff';g.fillRect(r()*SW|0,r()*120|0,1,1);}
    g.fillStyle='#f2efe2';for(let j=-9;j<=9;j++){const w=Math.floor(Math.sqrt(81-j*j));g.fillRect(400-w,40+j,w*2,1);}}
  else{g.fillStyle='#fffbea';for(let j=-11;j<=11;j++){const w=Math.floor(Math.sqrt(121-j*j));g.fillRect(70-w,44+j,w*2,1);}}
  g.fillStyle=n?'#1c3a6a':'#2f86b8';g.fillRect(0,150,SW,40);
  g.fillStyle=n?'#2a5088':'#5fb0e0';for(let k=0;k<26;k++)g.fillRect((k*53)%SW,154+(k*7)%30,10+(k%4)*4,1);
  g.fillStyle=n?'#9a8a6a':'#ecd49a';g.fillRect(0,186,SW,SH-186);
  g.fillStyle=n?'#b8a882':'#f6e2b2';g.fillRect(VL-6,VG-6,VR-VL+12,12);   // a parte clarinha da quadra
  let s=9;const r=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let k=0;k<500;k++){g.fillStyle=r()<.5?(n?'#8a7a5a':'#d6b97a'):(n?'#a89a78':'#fff0c4');g.fillRect(r()*SW|0,190+r()*(SH-190)|0,r()<.5?1:2,1);}
  g.fillStyle='#fff';g.fillRect(VL,VG+5,VR-VL,1);g.fillRect(VL,VG-6,1,12);g.fillRect(VR,VG-6,1,12);
  // rede
  g.fillStyle='#000';g.fillRect(VNET-3,VG-VNH-10,6,VNH+10);g.fillStyle='#8a5a3a';g.fillRect(VNET-2,VG-VNH-9,4,VNH+9);   // poste
  g.fillStyle='#000';g.fillRect(VNET-6,VG-VNH-2,12,40);g.fillStyle='#e8e2d4';g.fillRect(VNET-5,VG-VNH-1,10,38);   // rede (de lado: uma faixa)
  g.fillStyle='#5a5a6a';for(let y=VG-VNH+4;y<VG-VNH+36;y+=4)for(let x=VNET-5;x<VNET+5;x+=4)g.fillRect(x+((y/4)%2?2:0),y,2,2);
  g.fillStyle='#ff3d8b';g.fillRect(VNET-5,VG-VNH-1,10,4);
  return c;
}

/* boneco pela metade do tamanho (1 pixel do desenho = 1 pixel da tela); o da direita fica espelhado */
function vAvatar(g,p,x,i,z,pose){
  let sp;try{sp=getSprite(parse(String(p.f||''))||DEFAULT,'f',pose);}catch(_){return;}
  const X=Math.round(x),Y=Math.round(VG-z-AV.PY/2);
  g.fillStyle='rgba(0,0,0,.3)';g.fillRect(Math.round(x-12+z/6),VG-1,Math.round(24-z/3),3);
  g.save();g.translate(X,0);if(i===1)g.scale(-1,1);g.drawImage(sp,-AV.PX/2,Y,sp.width/2,sp.height/2);g.restore();
}

function vDraw(){
  const V=VS,g=V.g,st=V.st,m=st.m;g.imageSmoothingEnabled=false;
  g.drawImage(V.bg,0,0);
  // os dois jogadores (quem está do lado direito olha para a esquerda)
  st.players.forEach((p,i)=>{
    const jx=now-m.jt[i],z=jx<450?Math.sin(jx/450*Math.PI)*30:0,moving=i===V.idx?(V.aimX!=null&&Math.abs(vClamp(i,V.aimX)-m.px[i])>2)||Object.values(V.keys).some(Boolean):Math.abs(m.tx[i]-m.px[i])>1.5;
    const pose=jx<450?{p:'wave',f:0}:moving?{p:'walk',f:Math.floor(now/120)%4}:IDLE;
    vAvatar(g,p,m.px[i],i,z,pose);
    if(i===V.idx){g.fillStyle='#ffd23f';g.fillRect(Math.round(m.px[i])-3,VG+10,7,3);g.fillRect(Math.round(m.px[i])-1,VG+8,3,2);}
  });
  // a bola (no saque, fica em cima de quem saca)
  let bx,bz,u=0;
  if(m.ball){const p=vBall(m.ball,now);bx=p.x;bz=p.z;u=p.u;}else{bx=m.px[m.srv]+(m.srv===0?10:-10);bz=150+Math.sin(now/200)*4;}
  if(!(m.ball&&u>=1&&now-m.ball.t>m.ball.T+500)){
    const by=VG-bz,sh=Math.max(3,9-bz/30);
    g.fillStyle='rgba(0,0,0,.28)';g.fillRect(Math.round(bx-sh),VG-1,Math.round(sh*2),3);
    const r=7,cx=Math.round(bx),cy=Math.round(by);
    for(let j=-r-1;j<=r+1;j++){const w=Math.floor(Math.sqrt((r+1)*(r+1)-j*j));g.fillStyle='#000';g.fillRect(cx-w,cy+j,w*2+1,1);}
    for(let j=-r;j<=r;j++){const w=Math.floor(Math.sqrt(r*r-j*j));g.fillStyle=j<-2?'#ffd23f':j>2?'#2f6fd6':'#fff6d0';g.fillRect(cx-w,cy+j,w*2+1,1);}
    g.fillStyle='#fff';g.fillRect(cx-3,cy-4,2,2);
    if(m.ball&&u>=1){g.fillStyle='rgba(255,255,255,.7)';for(let k=0;k<6;k++)g.fillRect(cx-10+k*4,VG-2-(k%2)*3,2,2);}   // areia levantando
  }
  // placar e dica
  g.font='900 26px Anybody, sans-serif';g.textAlign='center';g.textBaseline='top';
  const t=`${m.score[0]}  x  ${m.score[1]}`;g.fillStyle='#000';g.fillText(t,SW/2+2,12);g.fillStyle='#fff';g.fillText(t,SW/2,10);
  g.font='700 10px Anybody, sans-serif';g.fillStyle='#fff';
  const hint=!m.ball&&m.srv===V.idx?'Clique (ou espaço) para sacar':!m.ball?'Saque de '+gFirst(st.players[m.srv].n):m.ball.by!==V.idx?'Vá pra baixo da bola e clique!':'';
  if(st.status==='playing'&&hint){g.fillStyle='#000';g.fillText(hint,SW/2+1,43);g.fillStyle='#fff';g.fillText(hint,SW/2,42);}
  g.textAlign='left';g.textBaseline='alphabetic';
  gHudSet(0,{active:m.ball?m.ball.by===1:m.srv===0,sub:m.score[0]+' pontos'});gHudSet(1,{active:m.ball?m.ball.by===0:m.srv===1,sub:m.score[1]+' pontos'});
  if(st.status==='over'){
    g.fillStyle='rgba(10,6,24,.75)';g.fillRect(0,SH/2-34,SW,68);
    const mine=st.over===V.idx,tt=mine?'VOCÊ VENCEU!':gFirst(st.players[st.over].n).toUpperCase()+' VENCEU';
    g.font='900 26px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#000';g.fillText(tt,SW/2+2,SH/2+2);g.fillStyle=mine?'#8fd42a':'#ff3d8b';g.fillText(tt,SW/2,SH/2);g.textAlign='left';g.textBaseline='alphabetic';
  }
}
