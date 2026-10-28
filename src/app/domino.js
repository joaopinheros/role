/* ================= dominó (parque, 2 pessoas) =================
 * Regras em src/engine/domino.js. O embaralhamento vem da semente da partida, então todo mundo aplica as mesmas
 * jogadas no mesmo monte. Na tela, cada um vê só a própria mão (as pedras do outro aparecem viradas).
 *   play {n, t, e}   pedra t na ponta e (0 esquerda, 1 direita)      buy {n}   comprou do monte      pass {n}   passou
 * Como não há servidor no meio, quem fuçar no navegador consegue ver as pedras do outro: é jogo entre amigos.
 */
let DO=null;   // tela aberta: { a, st, idx, cv, g, raf, rects, hover, pick }
const DOW=15;  // meia pedra na mesa (pedra deitada: 30x15)

G.defs.domino={
  name:'Dominó',verb:'Jogar dominó',icon:'dice',n:2,plates:idx=>idx===0?['tl','tr']:['tr','tl'],   // eu à esquerda, o outro à direita (embaixo fica o chat)
  stand(a,i){return i===0?[[a.x-1,a.y]]:[[a.x+1,a.y]];},
  init(seed){const m=doNew(seed);m.seed=seed;m.fx=null;return m;},
  toWire(m){const{fx,...w}=m;return w;},
  fromWire(w){return{...w,hands:w.hands.map(h=>h.slice()),pile:w.pile.slice(),chain:w.chain.map(c=>({...c})),fx:null};},
  onMsg:doOnMsg,tick(){},stageOpen:doStageOpen,stageClose:doStageClose,
  dbg:(m,st)=>({vez:m.turn,mesa:m.chain.length,monte:m.pile.length,maos:m.hands.map(h=>h.length),n:m.n,over:m.over,why:m.why,
    jogaveis:doPlayable(m,m.turn),mine:gMine(st)>=0?m.hands[gMine(st)].slice():null}),
  test(cmd){   // para os testes: joga a primeira pedra que serve (ou compra/passa)
    if(cmd!=='auto'||!DO)return null;const{st,idx}=DO,m=st.m;if(m.turn!==idx)return 'não é a vez';
    const p=doPlayable(m,idx);if(p.length){doDo('play',p[0],doFits(m,p[0])[0]);return 'jogou';}
    if(m.pile.length){doDo('buy');return 'comprou';}doDo('pass');return 'passou';},
};

/* aplica uma jogada (minha ou de quem está na vez) */
function doApply(a,st,kind,p,t,e){
  const m=st.m;let r;
  if(kind==='play')r=doPlay(m,p,t,e);else if(kind==='buy')r=doBuy(m,p);else r=doPass(m,p);
  if(!r.ok)return false;
  m.fx={kind,p,t:now,tile:t,end:r.end};
  if(DO&&DO.st===st){DO.pick=null;}
  if(kind==='pass')addLog(null,gFirst(st.players[p].n)+' passou.');
  if(m.over!==-1){
    const why=m.why==='bateu'?`bateu, +${m.pts} pontos`:m.over===2?'trancou':`trancou, +${m.pts} pontos`;
    gFinish(a,st,m.over===2?-1:m.over,why);
  }
  return true;
}
function doOnMsg(a,st,d,from){
  const m=st.m;if(!m||st.status!=='playing'||!['play','buy','pass'].includes(d.t))return;
  if(st.players[m.turn].peer!==from||d.n!==m.n+1)return;
  doApply(a,st,d.t,m.turn,d.t==='play'?d.tl|0:0,d.e|0);
}
function doDo(kind,t,e){
  const{a,st,idx}=DO,m=st.m,n=m.n+1;
  if(doApply(a,st,kind,idx,t,e))gSend(a,kind,kind==='play'?{n,tl:t,e}:{n});
}

/* ---------- o mundo: mesa de madeira com as pedras ---------- */
function dominoTable(gx,gy){actReg('domino',gx,gy,1,1);addF(gx,gy,()=>{
  [[.18,.18],[.76,.18],[.18,.76],[.76,.76]].forEach(([dx,dy])=>bx(gx+dx,gy+dy,.07,.07,20,0,'#4a3424'));
  bx(gx+.06,gy+.06,.88,.88,3,20,'#a8743c');
  const s=G.acts['domino@'+gx+'_'+gy],live_=s&&s.m&&(s.status==='playing'||s.status==='over');
  const P=(u,v)=>up(S(gx+.1+u*.8,gy+.1+v*.8),23);
  const pip=(x,y,w,h)=>{ctx.fillStyle='#1c1428';ctx.fillRect(x-1,y-1,w+2,h+2);ctx.fillStyle='#f6f0e0';ctx.fillRect(x,y,w,h);ctx.fillStyle='#1c1428';ctx.fillRect(x+Math.floor(w/2),y,1,h);};
  if(!live_){   // pedras emborcadas esperando
    for(let i=0;i<6;i++){const[x,y]=P(.25+(i%3)*.22,.35+Math.floor(i/3)*.25);ctx.fillStyle='#1c1428';ctx.fillRect(Math.round(x)-3,Math.round(y)-2,7,4);ctx.fillStyle='#3a3060';ctx.fillRect(Math.round(x)-2,Math.round(y)-1,5,2);}
    return;}
  const m=s.m,n=Math.min(9,m.chain.length),from=Math.max(0,Math.floor((m.chain.length-n)/2));
  for(let i=0;i<n;i++){const[x,y]=P(.1+(i+.5)/n*.8,.5);pip(Math.round(x)-3,Math.round(y)-1,6,3);}
  [[.15,.15,0],[.85,.85,1]].forEach(([u,v,p])=>{const k=Math.min(7,m.hands[p].length),[x,y]=P(u,v);for(let i=0;i<k;i++){ctx.fillStyle='#1c1428';ctx.fillRect(Math.round(x)-4+i,Math.round(y)-4-i,2,4);ctx.fillStyle='#f6f0e0';ctx.fillRect(Math.round(x)-4+i,Math.round(y)-3-i,1,2);}});
});}

/* ---------- a tela do jogo ---------- */
function doStageOpen(a,st,idx,cv){
  doStageClose();
  cv.width=SW;cv.height=SH;
  DO={a,st,idx,cv,g:cv.getContext('2d'),raf:0,rects:[],hover:-1,pick:null};
  const loc=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*SW,(e.clientY-r.top)/r.height*SH];};
  const hit=([x,y])=>DO.rects.findIndex(r=>x>=r.x&&x<r.x+r.w&&y>=r.y-8&&y<r.y+r.h);
  cv.onpointermove=e=>{if(!DO)return;DO.hover=hit(loc(e));cv.style.cursor=DO.hover>=0?'pointer':'default';};
  cv.onpointerleave=()=>{if(DO)DO.hover=-1;};
  cv.onpointerdown=e=>{
    if(!DO)return;const{st,idx}=DO,m=st.m;if(st.status!=='playing'||m.turn!==idx)return;
    const h=hit(loc(e));if(h<0){DO.pick=null;return;}
    const t=DO.rects[h].t,f=doFits(m,t);if(!f.length)return;
    const ends=doEnds(m);
    if(f.length===2&&ends&&ends[0]!==ends[1]){DO.pick=t;return;}   // serve nas duas pontas: escolhe nos botões
    doDo('play',t,f[0]);
  };
  const loop=()=>{if(!DO)return;doDraw();DO.raf=requestAnimationFrame(loop);};
  DO.raf=requestAnimationFrame(loop);
}
function doStageClose(){if(!DO)return;cancelAnimationFrame(DO.raf);DO.cv.onpointermove=DO.cv.onpointerleave=DO.cv.onpointerdown=null;DO=null;}

const DO_PIPS={0:[],1:[[1,1]],2:[[0,0],[2,2]],3:[[0,0],[1,1],[2,2]],4:[[0,0],[2,0],[0,2],[2,2]],5:[[0,0],[2,0],[1,1],[0,2],[2,2]],6:[[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]]};
/* meia pedra: quadrado s x s com os pontos do número v */
function doHalf(g,x,y,s,v,col){
  const q=s/4,d=Math.max(2,Math.round(s/7));
  g.fillStyle=col||'#1c1428';
  for(const[i,j]of DO_PIPS[v])g.fillRect(Math.round(x+q*(i+1)-d/2),Math.round(y+q*(j+1)-d/2),d,d);
}
/* pedra: horizontal (v1 à esquerda) ou em pé (v1 em cima) */
function doTile(g,x,y,s,v1,v2,vert,o={}){
  const w=vert?s:s*2,h=vert?s*2:s;
  g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x+2,y+2,w,h);
  g.fillStyle=o.glow||'#000';g.fillRect(x-1,y-1,w+2,h+2);
  g.fillStyle=o.dim?'#b8b0a0':'#fbf6e8';g.fillRect(x,y,w,h);
  g.fillStyle=o.dim?'#a39b8a':'#e6dcc4';if(vert)g.fillRect(x+w-1,y,1,h);else g.fillRect(x,y+h-1,w,1);
  g.fillStyle='#6a5a48';if(vert)g.fillRect(x+2,y+s-1,s-4,1);else g.fillRect(x+s-1,y+2,1,s-4);
  doHalf(g,x,y,s,v1,o.red?'#c8283a':null);doHalf(g,x+(vert?0:s),y+(vert?s:0),s,v2,o.red?'#c8283a':null);
}
function doBack(g,x,y,w,h){g.fillStyle='#000';g.fillRect(x-1,y-1,w+2,h+2);g.fillStyle='#3a1c8a';g.fillRect(x,y,w,h);g.fillStyle='#6a40d8';g.fillRect(x+2,y+2,w-4,1);g.fillRect(x+2,y+h-3,w-4,1);g.fillStyle='#ffd23f';g.fillRect(x+Math.floor(w/2)-1,y+Math.floor(h/2)-1,2,2);}

/* posição de cada pedra da fila na mesa: a primeira no meio; os braços vão para os lados e dobram (cobrinha) */
function doLayout(m){
  const out=new Array(m.chain.length),cx=SW/2,cy=136,L=34,Rr=SW-34,ROW=34;
  const o=m.chain[m.left||0];if(!o)return out;
  const ow=doDouble(o.t)?DOW:DOW*2;
  out[m.left||0]={x:cx-ow/2,y:cy-(doDouble(o.t)?DOW:DOW/2),vert:doDouble(o.t),v:[o.a,o.b]};
  const arm=(ids,dir,rowDir)=>{
    let x=dir>0?cx+ow/2+1:cx-ow/2-1,y=cy,d=dir,row=0;
    for(const i of ids){
      const c=m.chain[i],dbl=doDouble(c.t),w=dbl?DOW:DOW*2,h=dbl?DOW*2:DOW;
      if((d>0&&x+w>Rr)||(d<0&&x-w<L)){row++;y=cy+rowDir*row*ROW;d=-d;x=d>0?L:Rr;}
      const px=d>0?x:x-w;
      // quem fica à esquerda na tela: no braço direito, o lado "a" fica para dentro; no esquerdo, para fora
      const flip=dir>0?d<0:d>0;
      out[i]={x:px,y:y-h/2,vert:dbl,v:flip?[c.b,c.a]:[c.a,c.b]};
      x+=d*(w+1);
    }
  };
  const left=m.left||0,R=[],Lf=[];
  for(let i=left+1;i<m.chain.length;i++)R.push(i);
  for(let i=left-1;i>=0;i--)Lf.push(i);
  arm(R,1,1);arm(Lf,-1,-1);
  return out;
}

function doDraw(){
  const{g,st,idx}=DO,m=st.m;if(!m)return;
  g.imageSmoothingEnabled=false;
  // feltro azul de bar
  g.fillStyle='#10233a';g.fillRect(0,0,SW,SH);
  g.fillStyle='#000';g.fillRect(14,40,SW-28,190);g.fillStyle='#6a3f22';g.fillRect(16,42,SW-32,186);g.fillStyle='#1f4f7a';g.fillRect(22,48,SW-44,174);
  let s=7;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let i=0;i<500;i++){g.fillStyle=rnd()<.5?'#1c4870':'#245886';g.fillRect(22+Math.floor(rnd()*(SW-44)),48+Math.floor(rnd()*174),1,1);}
  const playing=st.status==='playing',myTurn=playing&&m.turn===idx;
  // pedras do outro (viradas) e o monte
  const other=1-idx,no=m.hands[other].length;
  for(let i=0;i<no;i++)doBack(g,SW/2-no*7+i*14,10,11,22);
  for(let i=0;i<m.pile.length;i++)doBack(g,30+(i%7)*6,196+Math.floor(i/7)*11,5,9);
  if(m.pile.length){g.font='700 8px Anybody, sans-serif';g.fillStyle='#bcd4ea';g.fillText('monte: '+m.pile.length,30,190);}
  // a fila na mesa (a última jogada brilha um pouco)
  const lay=doLayout(m),fx=m.fx,fresh=fx&&fx.kind==='play'&&now-fx.t<900;
  lay.forEach((p,i)=>{if(!p)return;const c=m.chain[i],isNew=fresh&&c.t===fx.tile,drop=isNew?Math.max(0,1-(now-fx.t)/220):0;
    doTile(g,Math.round(p.x),Math.round(p.y-drop*16),DOW,p.v[0],p.v[1],p.vert,{glow:isNew?'#ffd23f':null});});
  // pontas: no pedido de escolher, as duas piscam
  if(DO.pick!=null&&m.chain.length){const L0=lay[0],R0=lay[m.chain.length-1],bl=Math.floor(now/250)%2;
    if(bl){g.strokeStyle='#ff3d8b';g.lineWidth=2;[L0,R0].forEach(p=>{const w=p.vert?DOW:DOW*2,h=p.vert?DOW*2:DOW;g.strokeRect(p.x-3,p.y-3,w+6,h+6);});}}
  // a minha mão
  DO.rects=[];
  const mine=m.hands[idx].slice().sort((a,b)=>doPips(b)-doPips(a)),n=mine.length,TS_=17,gap=4,W=n*(TS_+gap)-gap,x0=Math.round(SW/2-W/2);
  mine.forEach((t,i)=>{
    const ok=myTurn&&doFits(m,t).length>0,hov=DO.hover===i&&ok,picked=DO.pick===t,lift=picked?12:hov?8:ok?3:0,x=x0+i*(TS_+gap),y=SH-TS_*2-8-lift;
    DO.rects.push({t,x,y:SH-TS_*2-8,w:TS_,h:TS_*2});
    doTile(g,x,y,TS_,DO_T[t][0],DO_T[t][1],true,{dim:myTurn&&!ok,glow:picked?'#ff3d8b':null});
  });
  // botões
  const btns=[];
  if(myTurn){
    if(DO.pick!=null){const t=DO.pick;btns.push({t:'◀ PONTA ESQUERDA',hot:true,f:()=>doDo('play',t,0)});btns.push({t:'PONTA DIREITA ▶',hot:true,f:()=>doDo('play',t,1)});}
    else if(!doPlayable(m,idx).length){if(m.pile.length)btns.push({t:'COMPRAR',hot:true,f:()=>doDo('buy')});else btns.push({t:'PASSAR',hot:true,f:()=>doDo('pass')});}
  }
  gBtns(btns);
  gHudSet(0,{active:playing&&m.turn===0,sub:m.hands[0].length+' pedras'});gHudSet(1,{active:playing&&m.turn===1,sub:m.hands[1].length+' pedras'});
  const hint=(myTurn?(m.must>=0&&!m.chain.length?'Sua vez: abra com a bucha':DO.pick!=null?'Em qual ponta?':doPlayable(m,idx).length?'Sua vez':m.pile.length?'Nenhuma serve: compre':'Nenhuma serve: passe'):playing?'Vez de '+gFirst(st.players[m.turn].n):'');
  if(hint){g.font='800 11px Anybody, sans-serif';g.textAlign='center';g.fillStyle='#000';g.fillText(hint,SW/2+1,61);g.fillStyle=myTurn?'#ffd23f':'#bcd4ea';g.fillText(hint,SW/2,60);g.textAlign='left';}
  if(fx&&fx.kind==='buy'&&now-fx.t<700&&fx.p!==idx){g.font='900 14px Anybody, sans-serif';g.fillStyle='#ffd23f';g.textAlign='center';g.fillText('comprou!',SW/2,44);g.textAlign='left';}
  if(st.status==='over'){
    g.fillStyle='rgba(10,6,24,.75)';g.fillRect(0,SH/2-34,SW,68);
    const mine_=st.over===idx,t=st.over<0?'EMPATE':mine_?(m.why==='bateu'?'VOCÊ BATEU!':'VOCÊ VENCEU!'):gFirst(st.players[st.over].n).toUpperCase()+' VENCEU';
    g.font='900 26px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#000';g.fillText(t,SW/2+2,SH/2+2);g.fillStyle=st.over<0?'#ffd23f':mine_?'#8fd42a':'#ff3d8b';g.fillText(t,SW/2,SH/2);g.textAlign='left';
  }
}
