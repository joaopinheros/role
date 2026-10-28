/* ================= sinuca (bola 8) =================
 * Os dois jogadores veem a mesa de cima, numa tela própria. Quem está na sala vê a mesa no mundo, com as bolas e o taco
 * do jogador da vez. Só a tacada viaja pela rede: todo mundo simula igual (src/engine/poolsim.js).
 *   aim     (jogador da vez, ~8/s)  para o taco aparecer no mundo
 *   shot    {n, x, y, p}            direção e força da tacada (inteiros)
 *   settle  {n, b, g, t, w, ...}    quem tacou manda a foto final e de quem é a vez, que vira a verdade para todos
 * Na tela do jogo não há legendas: só a barra de força, os cartões dos jogadores (com as bolas que ainda faltam) e,
 * quando uma bola cai, ela afunda na caçapa e voa até o cartão de quem encaçapou.
 */
const SW=480,SH=290,TX=40,TY=64,TBW=POOL.W,TBH=POOL.H;
const BALLC={1:'#f0c24a',2:'#3b6fd6',3:'#d84a3a',4:'#8e5ac8',5:'#f08a3a',6:'#3f9a4a',7:'#8a3a2a',8:'#1c1a22'};
const ballCol=id=>id===0?'#f2efe9':BALLC[id>8?id-8:id];
const POOL_FLY=900;   // ms que a bola encaçapada fica em destaque antes de sair da lista do cartão
let PS=null;   // tela aberta: { a, st, idx, cv, g, raf, drag, aimAt, table }

/* ---------- o mundo: bolas na mesa e taco ---------- */
function gamePoolPlaying(gx,gy){const s=G.acts['sinuca@'+gx+'_'+gy];return !!(s&&(s.status==='playing'||s.status==='over')&&s.m);}
function gamePoolDraw(gx,gy){
  if(!gamePoolPlaying(gx,gy))return false;
  const m=G.acts['sinuca@'+gx+'_'+gy].m;
  const P=(lx,ly)=>up(S(gx+.12+(lx/TBW)*2.76,gy+.17+(ly/TBH)*.66),27);
  for(const b of m.balls){
    if(b.in)continue;const[x,y]=P(b.x,b.y);
    circ(x,y+.9,1.8,'rgba(0,0,0,.35)');
    circ(x,y,1.9,b.id>8?'#f2efe9':ballCol(b.id));
    if(b.id>8){ctx.fillStyle=ballCol(b.id);ctx.fillRect(Math.round(x)-1,Math.round(y)-.5,3,1);}
  }
  if(m.aim&&!m.sim&&now-m.aim.t<700&&!m.balls[0].in){
    const c=m.balls[0],l=Math.sqrt(m.aim.x*m.aim.x+m.aim.y*m.aim.y)||1,ux=m.aim.x/l,uy=m.aim.y/l,pull=6+m.aim.p/1000*16;
    const a1=P(c.x-ux*(pull+4),c.y-uy*(pull+4)),a2=P(c.x-ux*(pull+70),c.y-uy*(pull+70));
    ctx.strokeStyle='#d8b57e';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(a1[0],a1[1]);ctx.lineTo(a2[0],a2[1]);ctx.stroke();
    ctx.strokeStyle='#6a4a32';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(a2[0],a2[1]);ctx.lineTo(a2[0]+(a2[0]-a1[0])*.12,a2[1]+(a2[1]-a1[1])*.12);ctx.stroke();
  }
  return true;
}

/* ---------- o jogo (registro) ---------- */
G.defs.sinuca={
  name:'Sinuca',verb:'Jogar sinuca',icon:'dice',n:2,
  /* onde os jogadores ficam em volta da mesa: um de cada lado */
  stand(a,i){const{x,y,w}=a,row=yy=>[1,0,2].filter(k=>k<w).map(k=>[x+k,yy]);return i===0?[...row(y+1),[x-1,y],[x+w,y]]:[...row(y-1),[x+w,y],[x-1,y]];},   // qualquer casa ao longo da mesa
  plates:()=>['tl','tr'],
  init(seed,players){return {balls:poolRack(seed),groups:[null,null],turn:0,shotN:0,sim:null,aim:null,winner:-1,fx:[],potted:[[],[]]};},
  toWire(m){return {b:poolSnap(m.balls),g:m.groups,t:m.turn,n:m.shotN,pt:m.potted};},
  fromWire(w){return {balls:poolFromSnap(w.b),groups:w.g,turn:w.t,shotN:w.n,sim:null,aim:null,winner:-1,fx:[],potted:w.pt||[[],[]]};},
  onMsg:poolOnMsg,tick:poolTick,stageOpen:poolStageOpen,stageClose:poolStageClose,
};

const poolMyTurn=(st,m)=>st.players[m.turn]&&st.players[m.turn].u===ME.usuario;

function poolStartShot(m,x,y,p){m.aim=null;m.shotN++;poolShoot(m.balls,x,y,p);m.sim={shooter:m.turn,acc:0,potted:[],done:false,deadline:0};}

function poolOnMsg(a,st,d,from){
  const m=st.m;if(!m||st.status!=='playing')return;
  const turnPeer=st.players[m.turn]&&st.players[m.turn].peer;
  if(d.t==='aim'){if(from===turnPeer&&!m.sim)m.aim={x:d.x|0,y:d.y|0,p:Math.max(0,Math.min(1000,d.p|0)),t:now};}
  else if(d.t==='shot'){if(from===turnPeer&&!m.sim&&d.n===m.shotN+1)poolStartShot(m,d.x|0,d.y|0,Math.max(0,Math.min(1000,d.p|0)));}
  else if(d.t==='settle'&&from===turnPeer&&d.n===m.shotN)poolApply(a,st,{snap:d.b,groups:d.g,turn:d.t2,winner:d.w,note:d.nt});
}

/* a simulação anda em todo mundo; quem tacou fecha a conta e avisa */
function poolTick(a,st,dt){
  const m=st.m;if(!m)return;
  m.fx=m.fx.filter(f=>now-f.t<POOL_FLY+250);
  if(!m.sim)return;
  const s=m.sim;
  if(!s.done){
    s.acc+=dt;let n=0;
    while(s.acc>=POOL.DT&&n++<12){
      s.acc-=POOL.DT;
      for(const id of poolStep(m.balls,POOL.DT)){
        s.potted.push(id);
        const b=m.balls.find(v=>v.id===id);
        m.fx.push({id,x:b.x,y:b.y,t:now,pl:s.shooter});                  // a bola afunda na caçapa e aparece em destaque ao lado do cartão
        poolPop(id,s.shooter);
        if(id!==0)m.potted[s.shooter].push(id);
      }
      if(!poolMoving(m.balls)){s.done=true;s.deadline=now+2500;break;}
    }
  }
  if(!s.done)return;
  const shooter=st.players[s.shooter];
  if(shooter.u===ME.usuario&&!s.sent){
    s.sent=true;
    const r=poolRules(m,s.potted,s.shooter);
    if(r.foul)poolRespotCue(m.balls);
    if(r.respot8)poolRespot8(m.balls);
    const note=poolNote(st,r,s.potted,s.shooter);
    gSend(a,'settle',{n:m.shotN,b:poolSnap(m.balls),g:r.groups,t2:r.turn,w:r.winner,nt:note});
    poolApply(a,st,{groups:r.groups,turn:r.turn,winner:r.winner,note});
  }else if(shooter.u!==ME.usuario&&now>s.deadline){    // a mensagem não chegou: segue com a conta local
    const r=poolRules(m,s.potted,s.shooter);
    if(r.foul)poolRespotCue(m.balls);
    if(r.respot8)poolRespot8(m.balls);
    poolApply(a,st,{groups:r.groups,turn:r.turn,winner:r.winner,note:poolNote(st,r,s.potted,s.shooter)});
  }
}
function poolNote(st,r,potted,shooter){
  const who=gFirst(st.players[shooter].n);
  if(r.winner>=0)return '';
  if(r.respot8)return 'A 8 caiu na abertura e voltou pra mesa.';
  if(r.foul)return 'Falta de '+who+': a branca caiu.';
  return '';
}
function poolApply(a,st,r){
  const m=st.m;if(!m)return;
  if(r.snap)m.balls=poolFromSnap(r.snap);
  m.groups=r.groups||m.groups;m.turn=r.turn;m.sim=null;m.aim=null;
  if(r.note)addLog(null,r.note);
  if(r.winner>=0){m.winner=r.winner;gFinish(a,st,r.winner);}
}

/* a bola que caiu aparece grande, com o número, ao lado do cartão de quem encaçapou */
function poolPop(id,pl){
  const box=$('#shud');if(!box||!PS)return;
  const e=document.createElement('div');e.className='pop '+(pl===0?'p0':'p1')+(id>8?' s':'');
  e.style.setProperty('--c',ballCol(id));e.innerHTML=id?'<b>'+id+'</b>':'';
  box.append(e);setTimeout(()=>e.remove(),1400);
}

/* ---------- a tela do jogo ---------- */
function poolStageOpen(a,st,idx,cv){
  poolStageClose();
  cv.width=SW;cv.height=SH;
  PS={a,st,idx,cv,g:cv.getContext('2d'),raf:0,drag:null,aimAt:0,table:poolTableImg()};
  cv.onpointerdown=poolDown;cv.onpointermove=poolMove;cv.onpointerup=poolUp;cv.onpointercancel=()=>{if(PS)PS.drag=null;};
  const loop=()=>{if(!PS)return;poolDraw();PS.raf=requestAnimationFrame(loop);};
  PS.raf=requestAnimationFrame(loop);
}
function poolStageClose(){
  if(!PS)return;
  cancelAnimationFrame(PS.raf);PS.cv.onpointerdown=PS.cv.onpointermove=PS.cv.onpointerup=PS.cv.onpointercancel=null;PS=null;
}

const pLocal=e=>{const r=PS.cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*SW-TX,(e.clientY-r.top)/r.height*SH-TY];};
function poolCanAim(){const m=PS.st.m;return PS.st.status==='playing'&&m&&!m.sim&&m.winner<0&&poolMyTurn(PS.st,m);}
function poolDown(e){
  if(!PS||!poolCanAim())return;
  const[x,y]=pLocal(e);PS.drag={x0:x,y0:y,x,y,id:e.pointerId};
  try{PS.cv.setPointerCapture(e.pointerId);}catch(_){}
}
function poolAimOf(){
  const d=PS.drag;if(!d)return null;
  const dx=d.x0-d.x,dy=d.y0-d.y,len=Math.sqrt(dx*dx+dy*dy);
  if(len<6)return null;
  return{x:Math.round(dx/len*10000),y:Math.round(dy/len*10000),p:Math.round(Math.min(1,len/90)*1000),len};
}
function poolMove(e){
  if(!PS||!PS.drag)return;
  const[x,y]=pLocal(e);PS.drag.x=x;PS.drag.y=y;
  const q=poolAimOf();
  if(q&&performance.now()>PS.aimAt){PS.aimAt=performance.now()+125;gSend(PS.a,'aim',{x:q.x,y:q.y,p:q.p});}
}
function poolUp(e){
  if(!PS||!PS.drag)return;
  poolMove(e);
  const q=poolAimOf();PS.drag=null;
  if(!q||q.p<40||!poolCanAim())return;
  const m=PS.st.m;
  gSend(PS.a,'shot',{n:m.shotN+1,x:q.x,y:q.y,p:q.p});
  poolStartShot(m,q.x,q.y,q.p);
}

/* ---------- desenho em pixel ---------- */
function pxDisc(g,cx,cy,r,col){g.fillStyle=col;for(let dy=-r;dy<=r;dy++){const w=Math.floor(Math.sqrt(r*r-dy*dy)+.5);g.fillRect(cx-w,cy+dy,w*2+1,1);}}
/* bola em (cx,cy) da tela, com raio r */
function pxBallAt(g,cx,cy,id,R){
  cx=Math.round(cx);cy=Math.round(cy);R=Math.max(1,Math.round(R));
  pxDisc(g,cx+1,cy+Math.max(1,Math.round(R*.4)),R,'rgba(0,0,0,.35)');
  pxDisc(g,cx,cy,R+1,'#150f1c');
  pxDisc(g,cx,cy,R,id>8||id===0?'#f2efe9':ballCol(id));
  if(id>8){g.fillStyle=ballCol(id);for(let dy=-Math.round(R*.4);dy<=Math.round(R*.4);dy++){const w=Math.floor(Math.sqrt(R*R-dy*dy)+.5);g.fillRect(cx-w,cy+dy,w*2+1,1);}}
  if(id>0&&R>=4){const k=R>=8?2:1;g.fillStyle='#f2efe9';g.fillRect(cx-k,cy-k,k*2+1,k*2+1);g.fillStyle=ballCol(id);g.fillRect(cx,cy,1,1);}
  if(R>=4){g.fillStyle='rgba(255,255,255,.75)';g.fillRect(cx-Math.round(R*.6),cy-Math.round(R*.6),Math.max(2,Math.round(R*.4)),1);}
}
const pxBall=(g,x,y,id)=>pxBallAt(g,TX+x,TY+y,id,5);

function poolTableImg(){
  const c=document.createElement('canvas');c.width=SW;c.height=SH;const g=c.getContext('2d');
  g.fillStyle='#1d1233';g.fillRect(0,0,SW,SH);
  for(let y=0;y<SH;y+=8)for(let x=((y/8)%2)*8;x<SW;x+=16){g.fillStyle='#22163b';g.fillRect(x,y,8,8);}
  const ox=TX-15,oy=TY-15,ow=TBW+30,oh=TBH+30;
  g.fillStyle='#000';g.fillRect(ox-3,oy-3,ow+6,oh+6);
  g.fillStyle='#6a3f22';g.fillRect(ox,oy,ow,oh);
  g.fillStyle='#8a5530';g.fillRect(ox,oy,ow,3);g.fillRect(ox,oy,3,oh);
  g.fillStyle='#4a2a16';g.fillRect(ox,oy+oh-3,ow,3);g.fillRect(ox+ow-3,oy,3,oh);
  g.fillStyle='#e8d6a8';   // losangos na madeira
  for(let k=1;k<8;k++){const x=TX+k*TBW/8-1;g.fillRect(x,oy+6,3,3);g.fillRect(x,oy+oh-9,3,3);}
  for(let k=1;k<4;k++){const y=TY+k*TBH/4-1;g.fillRect(ox+6,y,3,3);g.fillRect(ox+ow-9,y,3,3);}
  g.fillStyle='#1f6a45';g.fillRect(TX-7,TY-7,TBW+14,TBH+14);
  g.fillStyle='#16503a';g.fillRect(TX-7,TY-7,TBW+14,2);g.fillRect(TX-7,TY-7,2,TBH+14);
  g.fillStyle='#2f8a5a';g.fillRect(TX,TY,TBW,TBH);
  let s=7;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let i=0;i<1100;i++){g.fillStyle=rnd()<.5?'#2b8053':'#349260';g.fillRect(TX+Math.floor(rnd()*TBW),TY+Math.floor(rnd()*TBH),1,1);}
  g.fillStyle='rgba(255,255,255,.14)';g.fillRect(TX+100,TY,1,TBH);                       // linha de cabeceira
  g.fillStyle='rgba(255,255,255,.35)';g.fillRect(TX+100,TY+TBH/2-1,3,3);g.fillRect(TX+288,TY+TBH/2-1,3,3);
  for(const[px,py,pr]of POOL.POCKET){pxDisc(g,TX+px,TY+py,pr-1,'#3a2214');pxDisc(g,TX+px,TY+py,pr-3,'#06040a');}
  return c;
}

/* cartões dos jogadores: grupo e as bolas que ainda faltam (a que caiu sai da lista quando termina de voar) */
function poolHud(){
  const{st}=PS,m=st.m,playing=st.status==='playing'&&m.winner<0;
  [0,1].forEach(i=>{
    const grp=m.groups[i];
    const ids=grp==='solid'?[1,2,3,4,5,6,7]:grp==='stripe'?[9,10,11,12,13,14,15]:[];
    const row=ids.map(id=>{const b=m.balls.find(v=>v.id===id),fx=m.fx.find(f=>f.id===id);
      return{c:BALLC[id>8?id-8:id],s:id>8,gone:!!(b&&b.in)&&!(fx&&now-fx.t<POOL_FLY*.8)};});
    const eight=m.balls.find(v=>v.id===8);
    if(grp)row.push({c:BALLC[8],s:false,gone:!!(eight&&eight.in)});
    gHudSet(i,{active:playing&&m.turn===i,sub:grp==='solid'?'LISAS':grp==='stripe'?'LISTRADAS':'',row});
  });
}

function poolDraw(){
  const{g,st,idx}=PS,m=st.m;if(!m)return;
  g.imageSmoothingEnabled=false;g.drawImage(PS.table,0,0);
  poolHud();
  const cue=m.balls[0];
  // linha de mira + taco (só para quem está tacando)
  const q=PS.drag&&poolAimOf();
  if(q&&!cue.in){
    const l=Math.sqrt(q.x*q.x+q.y*q.y),ux=q.x/l,uy=q.y/l,ray=poolRay(m,cue.x,cue.y,ux,uy);
    g.fillStyle='rgba(255,255,255,.85)';
    for(let d=12;d<ray.t-4;d+=7)g.fillRect(Math.round(TX+cue.x+ux*d),Math.round(TY+cue.y+uy*d),2,2);
    const ex=cue.x+ux*ray.t,ey=cue.y+uy*ray.t;
    g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=1;g.beginPath();g.arc(TX+ex,TY+ey,POOL.R,0,6.3);g.stroke();
    stickLine(g,cue.x-ux*(8+q.p/1000*34),cue.y-uy*(8+q.p/1000*34),ux,uy);
  }else if(m.aim&&!m.sim&&!poolMyTurn(st,m)&&now-m.aim.t<700&&!cue.in){   // o taco do adversário
    const l=Math.sqrt(m.aim.x*m.aim.x+m.aim.y*m.aim.y)||1;
    stickLine(g,cue.x-m.aim.x/l*(8+m.aim.p/1000*34),cue.y-m.aim.y/l*(8+m.aim.p/1000*34),m.aim.x/l,m.aim.y/l);
  }
  for(const b of m.balls)if(!b.in)pxBall(g,b.x,b.y,b.id);
  // bola que caiu: afunda na caçapa (o destaque com o número é HTML, em poolPop)
  for(const f of m.fx){const e=now-f.t;if(e<320)pxBallAt(g,TX+f.x,TY+f.y,f.id,5*(1-e/320));}
  // barra de força: só aparece enquanto você arrasta
  if(q){
    const bx=140,by=SH-11,bw=200,bh=7,fill=Math.round(bw*q.p/1000);
    g.fillStyle='#000';g.fillRect(bx-2,by-2,bw+4,bh+4);
    g.fillStyle='#2a1a55';g.fillRect(bx,by,bw,bh);
    for(let x=0;x<fill;x+=4){const t=x/bw;g.fillStyle=t<.5?'#8fd42a':t<.8?'#ffd23f':'#ff3d8b';g.fillRect(bx+x,by,3,bh);}
  }
  // fim de jogo
  if(st.status==='over'&&st.over>=0){
    g.fillStyle='rgba(10,6,24,.72)';g.fillRect(0,SH/2-36,SW,72);
    const mine=st.over===idx,t=mine?'VOCÊ VENCEU!':gFirst(st.players[st.over].n).toUpperCase()+' VENCEU';
    g.font='900 26px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#000';g.fillText(t,SW/2+2,SH/2+2);g.fillStyle=mine?'#8fd42a':'#ff3d8b';g.fillText(t,SW/2,SH/2);g.textAlign='left';
  }
}
function poolRay(m,cx,cy,dx,dy){   // até onde a mira vai: primeira bola ou tabela (só para desenhar a linha)
  let t=1e9,ghost=null;
  for(const b of m.balls){
    if(b.id===0||b.in)continue;
    const ox=b.x-cx,oy=b.y-cy,proj=ox*dx+oy*dy;if(proj<=0)continue;
    const d2=ox*ox+oy*oy-proj*proj,rr=(2*POOL.R)*(2*POOL.R);
    if(d2<rr){const tt=proj-Math.sqrt(rr-d2);if(tt<t){t=tt;ghost=b;}}
  }
  const tw=[dx>0?(TBW-POOL.R-cx)/dx:dx<0?(POOL.R-cx)/dx:1e9,dy>0?(TBH-POOL.R-cy)/dy:dy<0?(POOL.R-cy)/dy:1e9];
  const tm=Math.min(tw[0],tw[1]);
  if(tm<t){t=tm;ghost=null;}
  return{t:Math.max(0,t),ghost};
}
function stickLine(g,x,y,ux,uy){   // taco: de (x,y) para trás, em pixels
  for(let d=0;d<120;d+=1){const px=Math.round(TX+x-ux*d),py=Math.round(TY+y-uy*d);g.fillStyle=d<6?'#6a4a32':d<95?'#d8b57e':'#8a5530';g.fillRect(px,py,2,2);}
}
