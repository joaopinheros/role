/* ================= truco mineiro (4 pessoas, 2 duplas) =================
 * As regras ficam em src/engine/truco.js e as cartas em src/app/cards.js. Aqui: a mesa, a rede e a tela.
 * Cada um vê só a própria mão. Quem abriu a fila (o anfitrião) embaralha e manda a mão de cada pessoa só para ela
 * (mensagem com destinatário). O resto é público e cada um aplica as mesmas jogadas nas mesmas regras:
 *   deal {h}            começou a mão h (todos)             hand {h, c}   as 3 cartas de quem recebe (só ele)
 *   play {h, p, c}      carta jogada pelo lugar p           call {h, p}   pediu truco (ou subiu)
 *   ans  {h, p, r}      resposta: ok, run ou raise
 * Como não há servidor no meio, o anfitrião enxerga todas as mãos: serve para jogar com amigos, não para valer dinheiro.
 */
const TSLOT=[[220,162],[168,132],[220,102],[272,132]];       // onde a carta cai na mesa, por posição na tela: 0 eu, 1 esquerda, 2 parceiro, 3 direita
const TORIG=[[240,262],[26,150],[240,48],[454,150]];         // de onde ela sai
let TS=null;   // tela aberta

G.defs.truco={
  name:'Truco mineiro',verb:'Jogar truco (4 pessoas)',icon:'dice',n:4,team:trTeam,
  /* os quatro lugares em volta da mesa (0 e 2 são uma dupla) */
  stand(a,i){return [[[a.x-1,a.y]],[[a.x,a.y-1]],[[a.x+1,a.y]],[[a.x,a.y+1]]][i];},
  plates:idx=>{const pos=['b','l','t','rr'];return[0,1,2,3].map(i=>pos[(i-idx+4)%4]);},
  init(){const m=trNew();m.mine=null;m.shown=null;return m;},
  toWire(m){const{mine,hands,shown,...pub}=m;return pub;},          // a mão de ninguém vai junto
  fromWire(w){return{...w,mine:null,shown:null};},
  onBegin:trucoHostDeal,onMsg:trucoOnMsg,tick(){},stageOpen:trucoStageOpen,stageClose:trucoStageClose,tag:trucoTag,
};

const tFirst=(st,i)=>gFirst(st.players[i].n);
const tSeat=st=>gMine(st);

/* ---------- o anfitrião embaralha e distribui ---------- */
function trucoHostDeal(a,st){
  const m=st.m;if(st.status!=='playing'||st.m!==m)return;
  trStartHand(m);
  const hands=trDeal((Date.now()^Math.floor(Math.random()*4e9))>>>0);
  m.shown=null;m.dealAt=now;
  st.players.forEach((p,i)=>{
    if(p.u===ME.usuario)m.mine={h:m.hand,c:hands[i].slice()};
    else gSend(a,'hand',{h:m.hand,c:hands[i]},p.peer);
  });
  gSend(a,'deal',{h:m.hand});
  trucoLog(st,`Mão ${m.hand}: ${tFirst(st,m.mao)} abre.`);
}
const trucoLog=(st,t)=>addLog(null,t);

function trucoOnMsg(a,st,d,from){
  const m=st.m;if(!m||st.status!=='playing')return;
  const seat=st.players.findIndex(p=>p.peer===from);
  if(d.t==='deal'){if(from===st.host&&d.h===m.hand+1){trStartHand(m);m.shown=null;m.dealAt=now;}return;}
  if(d.t==='hand'){if(from===st.host&&d.h>=1&&Array.isArray(d.c)&&d.c.length===3)m.mine={h:d.h,c:d.c.map(Number)};return;}
  if(seat<0||d.p!==seat||d.h!==m.hand)return;
  if(d.t==='play'){const r=trPlay(m,seat,d.c);if(r.ok)trucoApplied(a,st,seat,'play',r,d.c);}
  else if(d.t==='call'){if(trCall(m,seat).ok)trucoApplied(a,st,seat,'call');}
  else if(d.t==='ans'){const r=trAnswer(m,seat,d.r);if(r.ok)trucoApplied(a,st,seat,'ans',r,d.r);}
}

/* depois de qualquer jogada válida (minha ou dos outros): efeitos, avisos e fim de mão */
function trucoApplied(a,st,seat,kind,r,x){
  const m=st.m;
  if(kind==='play'){
    const pl=m.plays.flat().find(p=>p.c===x);if(pl){pl.t=now;}
    if(r.round){const rr=m.rounds.length-1,list=m.plays[rr].map(p=>({...p}));m.shown={plays:list,w:r.round.w,t:now};}
  }else if(kind==='call'){
    if(TS&&TS.st===st)gBanner(TR_CALLNAME[m.pend.v]+'!','#ff3d8b');
    trucoLog(st,`${tFirst(st,seat)}: ${TR_CALLNAME[m.pend.v]}! (vale ${m.pend.v})`);
  }else if(kind==='ans'){
    const word={ok:'ACEITO!',run:'CORREU!',raise:m.pend?TR_CALLNAME[m.pend.v]+'!':''}[x];
    if(TS&&TS.st===st)gBanner(word,x==='run'?'#ffd23f':'#8fd42a');
    trucoLog(st,`${tFirst(st,seat)}: ${x==='ok'?'aceito':x==='run'?'correu':'subiu para '+TR_CALLNAME[m.pend.v]}.`);
  }
  if(m.phase==='done')trucoHandOver(a,st);
}
function trucoHandOver(a,st){
  const m=st.m,me_=tSeat(st),pts=m.score;
  const w=m.handWin,names=[0,1,2,3].filter(i=>trTeam(i)===w).map(i=>tFirst(st,i)).join(' e ');
  trucoLog(st,`${names} ${m.run?'levaram a mão (o outro lado correu)':'levaram a mão'}: ${pts[0]} x ${pts[1]}.`);
  if(TS&&TS.st===st&&me_>=0)gBanner(trTeam(me_)===w?'NOSSA!':'ELES',trTeam(me_)===w?'#8fd42a':'#ff8fc7');
  if(m.over>=0){
    if(TS&&TS.st===st&&me_>=0)setTimeout(()=>gBanner(trTeam(me_)===m.over?'VOCÊS VENCERAM!':'ELES VENCERAM',trTeam(me_)===m.over?'#8fd42a':'#ff3d8b'),700);
    gFinish(a,st,m.over,`${pts[0]} x ${pts[1]}`,[0,1,2,3].filter(i=>trTeam(i)===m.over));
  }else if(st.host===live.me){
    const mm=m;setTimeout(()=>{if(st.status==='playing'&&st.m===mm&&mm.phase==='done')trucoHostDeal(a,st);},3400);
  }
}

/* ---------- as minhas jogadas ---------- */
function trucoPlay(c){
  const{a,st,idx}=TS,m=st.m;
  if(st.status!=='playing'||!m.mine||m.mine.h!==m.hand||!m.mine.c.includes(c))return;
  const r=trPlay(m,idx,c);if(!r.ok)return;
  m.mine.c=m.mine.c.filter(x=>x!==c);
  gSend(a,'play',{h:m.hand,p:idx,c});
  trucoApplied(a,st,idx,'play',r,c);
}
function trucoCall(){const{a,st,idx}=TS,m=st.m;if(trCall(m,idx).ok){gSend(a,'call',{h:m.hand,p:idx});trucoApplied(a,st,idx,'call');}}
function trucoAns(ans){const{a,st,idx}=TS,m=st.m,r=trAnswer(m,idx,ans);if(r.ok){gSend(a,'ans',{h:m.hand,p:idx,r:ans});trucoApplied(a,st,idx,'ans',r,ans);}}

/* ---------- o mundo: as cartas sobre a mesa do boteco e o placar na etiqueta ---------- */
/* carta pequenininha no tampo: de costas (roxa) ou aberta (com o naipe), torta de leve */
function tMini(x,y,c,tilt){
  const X=Math.round(x)-3,Y=Math.round(y)-4,sk=tilt||0;
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(X+1,Y+2,7,9);
  ctx.fillStyle='#000';for(let r=0;r<10;r++)ctx.fillRect(X-1+Math.round(sk*r/9),Y-1+r,8,1);
  for(let r=0;r<8;r++){const o=Math.round(sk*(r+1)/9);
    if(c<0){ctx.fillStyle=r===0||r===7?'#ff3d8b':'#3a1c8a';ctx.fillRect(X+o,Y+r,6,1);if(r>1&&r<6&&(r%2)){ctx.fillStyle='#6a40d8';ctx.fillRect(X+o+2,Y+r,2,1);}}
    else{ctx.fillStyle='#fbf6e6';ctx.fillRect(X+o,Y+r,6,1);}}
  if(c>=0){const su=trSuit(c),o=Math.round(sk*.5);ctx.fillStyle=su===1||su===3?'#c8283a':'#221838';ctx.fillRect(X+2+o,Y+3,2,3);ctx.fillRect(X+1+o,Y+1,1,1);if(trIsManilha(c)){ctx.fillStyle='#f0b823';ctx.fillRect(X+o,Y,6,1);}}
}
/* mesa parada: baralho no meio e umas cartas largadas da última partida */
const T_IDLE=[[.5,.47,-1,0],[.52,.45,-1,0],[.3,.4,3,2],[.7,.6,16,-2],[.66,.3,-1,-1],[.36,.7,24,1]];
function gameTrucoDraw(gx,gy){
  const s=G.acts['truco@'+gx+'_'+gy];
  if(!s||!s.m||(s.status!=='playing'&&s.status!=='over')){
    for(const[u,v,c,t]of T_IDLE){const[x,y]=up(S(gx+u,gy+v),23);tMini(x,y,c,t);}
    return false;
  }
  const m=s.m,r=m.rounds.length,cur=m.plays[r]||[],old=m.shown&&now-m.shown.t<1500&&!cur.length;
  const list=old?m.shown.plays:cur;
  const OFF=[[.2,.5],[.5,.2],[.8,.5],[.5,.8]];   // lugar 0 oeste, 1 norte, 2 leste, 3 sul
  {const[x,y]=up(S(gx+.5,gy+.5),23);tMini(x,y-1,-1,0);tMini(x+1,y-2,-1,0);}   // o monte no meio
  for(const p of list){const[x,y]=up(S(gx+OFF[p.p][0],gy+OFF[p.p][1]),23);tMini(x,y,p.c,0);}
  return true;
}
function trucoTag(a,st){
  const m=st.m;if(!m)return null;
  if(m.pend)return{t:TR_CALLNAME[m.pend.v]+'! (vale '+m.pend.v+')',c:'#ff3d8b'};
  const p=i=>tFirst(st,i);
  return{t:`${p(0)}&${p(2)} ${m.score[0]}x${m.score[1]} ${p(1)}&${p(3)}`+(m.stake>2?` · vale ${m.stake}`:''),c:'#8fd42a'};
}

/* ---------- a tela do jogo ---------- */
function trucoStageOpen(a,st,idx,cv){
  trucoStageClose();
  cv.width=SW;cv.height=SH;
  TS={a,st,idx,cv,g:cv.getContext('2d'),raf:0,hover:-1,rects:[],bg:trucoBg()};
  cv.onpointermove=e=>{if(!TS)return;const p=tLocal(e);TS.hover=tHit(p);cv.style.cursor=TS.hover>=0&&trucoCanPlay()?'pointer':'default';};
  cv.onpointerleave=()=>{if(TS)TS.hover=-1;};
  cv.onpointerdown=e=>{if(!TS)return;const h=tHit(tLocal(e));if(h>=0&&trucoCanPlay())trucoPlay(TS.rects[h].c);};
  const loop=()=>{if(!TS)return;trucoDraw();TS.raf=requestAnimationFrame(loop);};
  TS.raf=requestAnimationFrame(loop);
}
function trucoStageClose(){if(!TS)return;cancelAnimationFrame(TS.raf);TS.cv.onpointermove=TS.cv.onpointerleave=TS.cv.onpointerdown=null;TS=null;}

const tLocal=e=>{const r=TS.cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*SW,(e.clientY-r.top)/r.height*SH];};
const tHit=([x,y])=>{for(let i=TS.rects.length-1;i>=0;i--){const r=TS.rects[i];if(x>=r.x&&x<r.x+CW&&y>=r.y-10&&y<r.y+CH)return i;}return -1;};
const trucoCanPlay=()=>{const{st,idx}=TS,m=st.m;return st.status==='playing'&&m.phase==='play'&&m.turn===idx&&m.mine&&m.mine.h===m.hand;};

/* feltro verde com borda de madeira */
function trucoBg(){
  const c=document.createElement('canvas');c.width=SW;c.height=SH;const g=c.getContext('2d');
  g.fillStyle='#1d1233';g.fillRect(0,0,SW,SH);
  for(let y=0;y<SH;y+=8)for(let x=((y/8)%2)*8;x<SW;x+=16){g.fillStyle='#22163b';g.fillRect(x,y,8,8);}
  const R=(col,x,y,w,h)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
  R('#000',60,34,360,236);R('#6a3f22',62,36,356,232);R('#8a5530',62,36,356,3);R('#4a2a16',62,265,356,3);
  R('#1f6a45',72,46,336,212);R('#2f8a5a',75,49,330,206);
  let s=11;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let i=0;i<900;i++){R(rnd()<.5?'#2b8053':'#349260',75+Math.floor(rnd()*330),49+Math.floor(rnd()*206),1,1);}
  g.fillStyle='rgba(255,255,255,.16)';
  for(let x=84;x<396;x+=8){g.fillRect(x,58,4,1);g.fillRect(x,246,4,1);}
  for(let y=58;y<246;y+=8){g.fillRect(84,y,1,4);g.fillRect(395,y,1,4);}
  // emblema discreto no centro
  g.fillStyle='rgba(0,0,0,.14)';for(let k=-12;k<=12;k++){const w=12-Math.abs(k);g.fillRect(240-w,152+k,w*2+1,1);}
  return c;
}

const tBackSmall=(()=>{let c=null;return()=>{if(c)return c;c=document.createElement('canvas');c.width=20;c.height=28;const g=c.getContext('2d');
  g.fillStyle='#000';g.fillRect(0,0,20,28);g.fillStyle='#3a1c8a';g.fillRect(1,1,18,26);g.fillStyle='#ff3d8b';g.fillRect(2,2,16,1);g.fillRect(2,25,16,1);g.fillRect(2,2,1,24);g.fillRect(17,2,1,24);
  g.fillStyle='#6a40d8';for(let y=4;y<24;y++)for(let x=4;x<16;x++)if((x+y)%5===0||(x-y+40)%5===0)g.fillRect(x,y,1,1);
  g.fillStyle='#ffd23f';for(let k=-4;k<=4;k++){const w=4-Math.abs(k);g.fillRect(10-w,14+k,w*2+1,1);}g.fillStyle='#ff3d8b';g.fillRect(9,13,3,3);
  return c;};})();

function trucoDraw(){
  const{g,st,idx}=TS,m=st.m;if(!m)return;
  g.imageSmoothingEnabled=false;g.drawImage(TS.bg,0,0);
  const scr=p=>(p-idx+4)%4;
  const playing=st.status==='playing';
  // quem joga agora: na rodada, quem está na vez; num pedido, quem responde
  const actor=!playing?-1:m.phase==='call'&&m.pend?m.pend.to:m.phase==='play'?m.turn:-1;
  st.players.forEach((p,i)=>gHudSet(i,{active:actor===i,sub:i===idx?'VOCÊ':trTeam(i)===trTeam(idx)?'PARCEIRO':'ADVERSÁRIO'}));

  // cartas que ainda estão na mão dos outros (só o verso)
  const left=i=>3-m.plays.flat().filter(p=>p.p===i).length;
  if(m.phase!=='wait'){
    const dealt=Math.min(1,(now-(m.dealAt||0))/400);
    for(let k=0;k<left((idx+2)%4);k++)g.drawImage(tBackSmall(),216+k*14,46-Math.round((1-dealt)*20));
    for(let k=0;k<left((idx+1)%4);k++)g.drawImage(tBackSmall(),8,170+k*13);
    for(let k=0;k<left((idx+3)%4);k++)g.drawImage(tBackSmall(),452,170+k*13);
  }

  // cartas na mesa: a rodada atual, ou a que acabou de terminar (por um instante)
  const r=m.rounds.length,cur=m.plays[r]||[],old=m.shown&&now-m.shown.t<1500&&!cur.length,list=old?m.shown.plays:cur;
  for(const p of list){
    const s=scr(p.p),[sx,sy]=TSLOT[s];let x=sx,y=sy;
    const e=now-(p.t||0);
    if(e<260){const k=1-Math.pow(1-e/260,2),[ox,oy]=TORIG[s];x=ox-20+(sx-(ox-20))*k;y=oy-28+(sy-(oy-28))*k;}
    x=Math.round(x);y=Math.round(y);
    g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x+2,y+3,CW,CH);
    g.drawImage(cardImg(p.c),x,y);
    if(old&&m.shown.w>=0&&trTeam(p.p)===m.shown.w){g.strokeStyle='#ffd23f';g.lineWidth=1;g.strokeRect(x-1.5,y-1.5,CW+3,CH+3);}
  }

  // a minha mão
  TS.rects=[];
  const mine=m.mine&&m.mine.h===m.hand?m.mine.c.slice().sort((a,b)=>trStrength(b)-trStrength(a)):[];
  const can=trucoCanPlay(),n=mine.length,x0=240-(n*CW+(n-1)*6)/2;
  mine.forEach((c,i)=>{
    const hover=TS.hover===i&&can,lift=hover?10:can?4:0,x=Math.round(x0+i*(CW+6)),y=SH-CH-4-lift;
    TS.rects[i]={c,x,y:SH-CH-4};
    const slide=Math.min(1,(now-(m.dealAt||0)-i*120)/320);
    if(slide<=0)return;
    g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x+2,y+3,CW,CH);
    g.drawImage(cardImg(c),x,Math.round(y+(1-slide)*40));
  });

  // botões, placar e quem vence a rodada
  trucoUi(st,m,idx);
  const nos=trTeam(idx),eles=1-nos,wins=t=>m.rounds.filter(x=>x===t).length;
  gInfo(`NÓS ${m.score[nos]}  x  ${m.score[eles]} ELES\nMão vale ${m.stake}${m.pend?' · pedido: '+m.pend.v:''}\nRodadas: ${m.rounds.length?m.rounds.map(x=>x<0?'empate':x===nos?'nossa':'deles').join(' · '):'—'}`);
}

function trucoUi(st,m,idx){
  const list=[];
  if(st.status==='playing'){
    if(trCanCall(m,idx))list.push({t:TR_CALLNAME[trNextStake(m.stake)]+'!',hot:true,f:trucoCall});
    if(m.phase==='call'&&m.pend&&m.pend.to===idx){
      list.push({t:'ACEITO',hot:true,f:()=>trucoAns('ok')});
      list.push({t:'CORRER',f:()=>trucoAns('run')});
      if(trNextStake(m.pend.v))list.push({t:'AUMENTAR: '+TR_CALLNAME[trNextStake(m.pend.v)]+'!',f:()=>trucoAns('raise')});
    }
  }
  gBtns(list);
}
