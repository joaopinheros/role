/* ================= atividades (jogos e passatempos da sala) =================
 * Cada cenário registra os seus pontos de atividade (actReg). Quem chega perto vê o botão da atividade, entra na fila,
 * e quando a mesa enche (2 pessoas na sinuca e no xadrez, 4 no truco) a partida começa numa tela própria
 * (a câmera "afunda" na mesa). Quem está na sala só vê o que acontece no mundo.
 * As mensagens vão pela sala (live.send) e todo mundo mantém o mesmo estado. Cada jogo se registra em G.defs.
 *
 * Mensagens (tipo "act"): invite, accept, lobby, leave, cancel, start, snap, hi, quit e as próprias de cada jogo.
 * Um jogo define: name, verb, n (jogadores), team(i) (se for em duplas), stand(a,i), init, toWire, fromWire, onMsg, tick,
 * stageOpen, stageClose, plates(idx) (onde ficam os cartões) e, se quiser, tag(a,st) (texto sobre a mesa).
 */
const G={defs:{},acts:{},on:false,unsub:null,chk:0,stage:null,quitAt:0,hudKey:[]};
const actReg=(type,x,y,w,d)=>B.acts.push({id:type+'@'+x+'_'+y,type,x,y,w,d});
const gAct=id=>SCN&&SCN.acts&&SCN.acts.find(a=>a.id===id);
const gSt=id=>G.acts[id]||(G.acts[id]={id,status:'idle',players:[],host:null,m:null,ts:0,over:-1,winners:[],miss:{}});
const gMe=()=>({u:ME.usuario,n:ME.nome,f:encode(me.fig),peer:live.me});
const gSend=(a,t,d,to)=>live&&live.send&&live.send('act',{a:a.id,t,...d},to);
const gMine=st=>st.players.findIndex(p=>p.u===ME.usuario);
const gFirst=n=>String(n||'').split(' ')[0];
const gN=type=>G.defs[type].n||2;
function gReset(st){const def=G.defs[st.id.split('@')[0]];if(def&&def.onReset&&st.status!=='idle')def.onReset(st);Object.assign(st,{status:'idle',players:[],host:null,m:null,ts:0,over:-1,winners:[],miss:{}});}
const gcx=a=>a.x+(a.w-1)/2,gcy=a=>a.y+(a.d-1)/2;

/* ---------- ligar e desligar com a sala ---------- */
function gamesSetup(){
  gamesStop();
  G.on=!!(live&&live.send&&live.onMsg&&live.me&&SCN&&SCN.acts&&SCN.acts.length);   // só no modo que tem mensagens pela sala
  if(!G.on){show($('#rAct'),false);return;}
  G.unsub=live.onMsg((k,d,from)=>{if(k==='act'&&d)gRecv(d,from);else if(k==='lava'&&d)lavaRecv(d,from);});
  lavaSetup();
  SCN.acts.forEach(a=>gSend(a,'hi',{}));   // quem já está jogando me conta como está a mesa
  G.chk=setInterval(gTick,300);
}
function gamesStop(){
  if(G.unsub){G.unsub();G.unsub=null;}
  clearInterval(G.chk);G.on=false;
  gStageClose(true);G.acts={};lavaStop();
  const b=$('#rAct');if(b)show(b,false);
}
const gActive=type=>Object.values(G.acts).some(s=>s.id.startsWith(type+'@')&&(s.status==='playing'||s.status==='over'));

/* ---------- mensagens ---------- */
function gRecv(d,from){
  const a=gAct(d.a);if(!a||!G.defs[a.type])return;
  const def=G.defs[a.type],st=gSt(a.id),n=gN(a.type);
  switch(d.t){
    case 'invite':{
      if(st.status==='playing'||st.status==='over')return;
      if(st.status==='waiting'&&st.host===live.me){
        if(st.ts<d.ts||(st.ts===d.ts&&live.me<from))return;   // o meu convite é mais antigo: o dele que se ajuste
        gReset(st);                                            // o dele chegou antes: largo o meu
      }
      Object.assign(st,{status:'waiting',host:from,players:[d.who],ts:d.ts});
      addLog(null,`${gFirst(d.who.n)} quer jogar ${def.name.toLowerCase()}. Chega perto da mesa pra topar.`);
      break;}
    case 'lobby':   // a fila mudou (alguém entrou ou saiu)
      if(st.status==='waiting'&&st.host===from&&Array.isArray(d.p))st.players=d.p;
      break;
    case 'accept':
      if(st.status==='waiting'&&st.host===live.me&&d.who&&st.players.length<n&&!st.players.some(p=>p.u===d.who.u)){
        st.players.push({...d.who,peer:from});
        gSend(a,'lobby',{p:st.players});
        if(st.players.length===n)gBegin(a,st);
      }
      break;
    case 'leave':
      if(st.status==='waiting'&&st.host===live.me){st.players=st.players.filter(p=>p.peer!==from);gSend(a,'lobby',{p:st.players});}
      break;
    case 'cancel': if(st.status==='waiting'&&st.host===from)gReset(st);break;
    case 'start':
      if(Array.isArray(d.p)&&d.p.length===n){Object.assign(st,{status:'playing',host:from,players:d.p,m:def.fromWire(d.m),over:-1,winners:[]});gEnter(a,st);}
      break;
    case 'hi':   // alguém entrou na sala: o dono da mesa conta o que está acontecendo
      if(st.host===live.me){
        if(st.status==='waiting'){gSend(a,'invite',{ts:st.ts,who:st.players[0]},from);if(st.players.length>1)gSend(a,'lobby',{p:st.players},from);}
        else if(st.status==='playing')gSend(a,'snap',{p:st.players,m:def.toWire(st.m)},from);
      }
      break;
    case 'snap':
      if(st.status==='idle'||st.status==='waiting'){Object.assign(st,{status:'playing',host:from,players:d.p,m:def.fromWire(d.m),over:-1,winners:[]});gEnter(a,st,true);}
      break;
    case 'quit':{
      const qi=st.players.findIndex(p=>p.peer===from);
      if(qi>=0&&st.status==='playing'){if(def.solo)gSoloEnd(a,st);else gFinish(a,st,gOpp(def,qi),'desistência',gOppAll(def,qi,st));}
      break;}
    default: if(def.onMsg)def.onMsg(a,st,d,from);
  }
}

/* quem vence quando o jogador qi sai: o adversário (2 jogadores) ou a outra dupla (4) */
function gOppAll(def,qi,st){return st.players.map((_,i)=>i).filter(i=>def.team?def.team(i)!==def.team(qi):i!==qi);}
function gOpp(def,qi){return def.team?1-def.team(qi):1-qi;}

/* a mesa encheu: o dono da fila começa a partida */
function gBegin(a,st){
  const def=G.defs[a.type],seed=(Date.now()^Math.floor(Math.random()*4e9))>>>0;
  st.status='playing';st.over=-1;st.winners=[];
  st.m=def.init(seed,st.players);
  gSend(a,'start',{p:st.players,m:def.toWire(st.m)});
  gEnter(a,st);
  if(def.onBegin)def.onBegin(a,st);
}

function gEnter(a,st,late){
  const def=G.defs[a.type],i=gMine(st);
  if(!late)addLog(null,def.startLog?def.startLog(st):`${st.players.map(p=>gFirst(p.n)).join(', ')} começaram uma partida de ${def.name.toLowerCase()}.`);
  if(i>=0){gSeat(a,def,i);gStageOpen(a,st,i);}
}
/* atividade de uma pessoa só (pesca, telescópio, karaokê): acaba quando ela sai, sem vencedor */
function gSoloEnd(a,st){const def=G.defs[a.type];if(def.onEnd)def.onEnd(a,st);if(G.stage&&G.stage.st===st)gStageClose();gReset(st);}

/* o boneco vai para o seu lugar na mesa e olha para ela */
function gSeat(a,def,i){
  if(!me)return;
  /* quem já está num lugar da mesa (ou sentado no banco) fica onde está: mandar "andar" até ali levantaria o boneco */
  const ok=gN(a.type)>2?def.stand(a,i):def.stand(a,0).concat(def.stand(a,1));
  /* cadeira já olha para a mesa; almofada e tapete não (turnSeat): aí o boneco se vira para ela */
  const look=()=>{if(def.face)setDir(me,...def.face);else if(me.action!=='sit'||def.turnSeat)faceTo(me,gcx(a),gcy(a));};
  if(!me.path.length&&ok.some(([x,y])=>x===me.gx&&y===me.gy)){look();pushPres();return;}
  const c=def.stand(a,i).find(([x,y])=>walkable(x,y,x,y)&&!occupied(x,y,me));
  if(!c)return;
  if(walkTo(me,c[0],c[1])){me.onArrive=()=>{look();pushPres();};pushPres();}
}

/* fim da partida: win = índice (ou dupla) que venceu, winners = os jogadores que ganharam */
function gFinish(a,st,win,why,winners){
  const def=G.defs[a.type],mine=gMine(st);
  const W=winners||(win>=0?[win]:[]);
  st.status='over';st.over=win;st.winners=W;
  if(W.length)addLog(null,(W.length>1?'A dupla ':'')+W.map(i=>gFirst(st.players[i].n)).join(' e ')+' venceu o '+def.name.toLowerCase()+(why?' ('+why+')':'')+'.');
  else addLog(null,`A partida de ${def.name.toLowerCase()} terminou${why?' em '+why:''}.`);
  setTimeout(()=>{if(mine>=0)gStageClose();gReset(st);},mine>=0?4200:2400);
}

/* ---------- botão, fila e "alguém saiu" ---------- */
/* a atividade do botão: entre as que estão perto, vale primeiro onde tem gente esperando (convite) ou onde eu jogo;
 * depois a mais próxima. E o botão não troca à toa enquanto a atual continua ao alcance (andando entre duas mesas,
 * ele mudava no meio do clique). */
function gNear(){
  if(!me||!SCN||!SCN.acts)return null;
  const d=a=>(me.gx-gcx(a))**2+(me.gy-gcy(a))**2;
  const mineSpot=a=>{const def=G.defs[a.type];if(!def||!def.stand)return false;for(let i=0;i<gN(a.type);i++)if(def.stand(a,i).some(([x,y])=>x===me.gx&&y===me.gy))return true;return false;};   // estou num lugar desta mesa
  const pri=a=>{if(mineSpot(a))return 0;const st=G.acts[a.id];return st&&(st.status==='waiting'||gMine(st)>=0)?1:2;};
  const near=SCN.acts.filter(a=>Math.abs(me.gx-gcx(a))<=a.w/2+1.2&&Math.abs(me.gy-gcy(a))<=a.d/2+1.2);
  const best=near.sort((p,q)=>pri(p)-pri(q)||d(p)-d(q))[0]||null;
  const cur=near.find(a=>a.id===G.nearId);
  const pick=cur&&best&&pri(cur)<=pri(best)&&d(cur)<=d(best)+1.01?cur:best;
  G.nearId=pick&&pick.id;
  return pick;
}
function gUpdateBtn(){
  const b=$('#rAct');if(!b)return;
  if(!G.on||mode!=='sala'||G.stage){show(b,false);return;}
  const a=gNear();if(!a){show(b,false);return;}
  const def=G.defs[a.type],st=gSt(a.id),n=gN(a.type);let label=null;
  const inQ=st.players.some(p=>p.u===ME.usuario);
  if(def.instant)label=def.label(a);   // botão de ação na hora (ex.: o gongo do chão é lava), sem fila nem tela
  else if(st.status==='idle')label=def.verb;
  else if(st.status==='waiting'){
    if(st.host===live.me)label=`Cancelar convite${n>2?` (${st.players.length}/${n})`:''}`;
    else if(inQ)label=`Sair da fila (${st.players.length}/${n})`;
    else label=n>2?`Entrar na mesa (${st.players.length}/${n})`:'Jogar com '+gFirst(st.players[0].n);
  }
  else if(st.status==='playing'&&gMine(st)>=0)label='Voltar ao jogo';
  show(b,!!label);
  if(label){setBtn(b,def.icon||'dice',label);b.dataset.act=a.id;b.setAttribute('aria-label',label);}
}
function gTick(){
  if(!G.on)return;
  gUpdateBtn();
  const here=new Set(avatars.filter(v=>!v.bot&&v.user).map(v=>v.user));
  for(const st of Object.values(G.acts)){
    const a=gAct(st.id);if(!a)continue;
    const def=G.defs[a.type];
    /* "saiu" só depois de 6 s sem aparecer na sala: quem chega agora ainda não recebeu os bonecos dos outros */
    const lost=p=>{st.miss=st.miss||{};if(here.has(p.u)){delete st.miss[p.u];return false;}st.miss[p.u]=st.miss[p.u]||performance.now();return performance.now()-st.miss[p.u]>6000;};
    if(st.status==='waiting'){
      if(st.host!==live.me&&lost(st.players[0]))gReset(st);                                   // quem convidou foi embora
      else if(st.host===live.me&&st.players.some((p,i)=>i>0&&lost(p))){                      // alguém da fila foi embora
        st.players=st.players.filter((p,i)=>i===0||here.has(p.u));gSend(a,'lobby',{p:st.players});
      }
    }
    if(st.status==='playing'){
      const gone=st.players.findIndex(lost);
      if(gone>=0){if(def.solo)gSoloEnd(a,st);else gFinish(a,st,gOpp(def,gone),'saiu da sala',gOppAll(def,gone,st));}
    }
  }
}
$('#rAct').addEventListener('click',()=>{
  const a=gAct($('#rAct').dataset.act);if(!a)return;
  const def=G.defs[a.type],st=gSt(a.id),n=gN(a.type);
  const inQ=st.players.some(p=>p.u===ME.usuario);
  if(def.instant){def.instant(a);gUpdateBtn();return;}
  if(st.status==='idle'&&def.solo){Object.assign(st,{host:live.me,ts:Date.now(),players:[gMe()]});gBegin(a,st);}
  else if(st.status==='idle'){
    Object.assign(st,{status:'waiting',host:live.me,ts:Date.now(),players:[gMe()]});
    gSend(a,'invite',{ts:st.ts,who:st.players[0]});
    addLog(null,n>2?`Mesa de ${def.name.toLowerCase()} aberta. Faltam ${n-1} pessoas.`:'Convite feito. Esperando alguém topar '+def.name.toLowerCase()+'…');
  }else if(st.status==='waiting'){
    if(st.host===live.me){gSend(a,'cancel',{});gReset(st);}
    else if(inQ){gSend(a,'leave',{},st.host);st.players=st.players.filter(p=>p.u!==ME.usuario);}
    else gSend(a,'accept',{who:gMe()},st.host);
  }else if(st.status==='playing'&&gMine(st)>=0)gStageOpen(a,st,gMine(st));
  gUpdateBtn();
});

/* clicar na própria mesa leva o boneco até ela */
function gClickTile(tx,ty){
  if(!G.on||!SCN||!SCN.acts||!me)return false;
  const a=SCN.acts.find(v=>tx>=v.x&&tx<v.x+v.w&&ty>=v.y&&ty<v.y+v.d&&!G.defs[v.type].noClick);   // a quadra de vôlei é chão: clicar nela é andar
  if(!a)return false;
  const def=G.defs[a.type];let spots=[];for(let i=0;i<gN(a.type);i++)spots=spots.concat(def.stand(a,i));
  const c=spots.filter(([x,y])=>walkable(x,y,x,y)&&!occupied(x,y,me))
    .sort((p,q)=>Math.abs(p[0]-me.gx)+Math.abs(p[1]-me.gy)-Math.abs(q[0]-me.gx)-Math.abs(q[1]-me.gy))[0];
  if(c&&walkTo(me,c[0],c[1])){me.onArrive=()=>{faceTo(me,gcx(a),gcy(a));pushPres();gUpdateBtn();};pushPres();}
  return true;
}

/* controle de videogame (pixel art) sobre quem está esperando adversário */
const GAMEPAD=['..##########..','.#yyyyyyyyyy#.','#yyykyyyyypyy#','#yykkkyyycyyy#','#yyykyyyyyyyy#','#yyyyyyyyyyyy#','#yyyy#yy#yyyy#','.###..##..###.'];
function gGamepad(x,y){   // (x,y) = centro de baixo do ícone, em px da tela
  const s=3,w=14*s,h=8*s,X=Math.round(x-w/2),Y=Math.round(y-h+Math.sin(now/260)*2.5);
  const C={'#':'#000',y:'#ffd23f',k:'#241452',p:'#ff3d8b',c:'#43d9e8'};
  GAMEPAD.forEach((row,ry)=>{for(let rx=0;rx<14;rx++){const ch=row[rx];if(ch!=='.'){sc.fillStyle=C[ch];sc.fillRect(X+rx*s,Y+ry*s,s,s);}}});
  sc.fillStyle='rgba(0,0,0,.25)';sc.fillRect(X+3*s,Y+h+3,w-6*s,2);   // sombrinha no ar
}

/* etiqueta sobre a mesa: quem está esperando e quem está jogando */
function gOverlay(){
  if(!G.on||!SCN||!SCN.acts)return;
  for(const a of SCN.acts){
    const st=G.acts[a.id];if(!st||st.status==='idle')continue;
    const def=G.defs[a.type],n=gN(a.type);
    if(st.status==='waiting'){   // o controle fica em cima da cabeça de cada um que está esperando
      for(const p of st.players){
        const v=avatars.find(x=>!x.bot&&x.user&&x.user===p.u);
        if(v){const[hx,hy]=toScreen(v.sx,headWorld(v));gGamepad(hx,hy-30);}
      }
    }
    let t=st.status==='waiting'?(n>2?`${def.name}: ${st.players.length}/${n} na mesa`:gFirst(st.players[0].n)+' quer jogar'):st.players.map(p=>gFirst(p.n)).join(' x ');
    let col=st.status==='waiting'?'#ffd23f':'#8fd42a';
    if(st.status!=='waiting'&&def.tag){const o=def.tag(a,st);if(o===false)continue;if(o){t=o.t;if(o.c)col=o.c;}}
    const[x,y]=toScreen(...up(S(a.x+a.w/2,a.y+a.d/2),54));
    sc.font='700 11px Anybody, sans-serif';const w=sc.measureText(t).width+14;
    sc.fillStyle=col;sc.strokeStyle='#000';sc.lineWidth=2;rr(sc,x-w/2,y-12,w,18,6);sc.fill();sc.stroke();
    sc.fillStyle='#000';sc.textAlign='center';sc.textBaseline='middle';sc.fillText(t,x,y-2);sc.textAlign='left';
  }
}

/* todos os quadros: os jogos andam (a física roda igual em todo mundo) */
function gSimTick(dt){
  if(!G.on)return;
  for(const st of Object.values(G.acts)){
    if(st.status!=='playing'||!st.m)continue;
    const a=gAct(st.id);if(a&&G.defs[a.type].tick)G.defs[a.type].tick(a,st,dt);
  }
}

/* ---------- cartões dos jogadores (HTML: fonte nítida) ---------- */
function gHudBuild(st,idx){
  const def=G.defs[G.stage.a.type],pos=def.plates?def.plates(idx):['tl','tr'],box=$('#shud');
  box.innerHTML='<div class="sinfo" id="sinfo"></div><div class="sban" id="sban"></div>';
  if(pos)st.players.forEach((p,i)=>{
    const el=document.createElement('div');el.className='pcard '+pos[i];el.id='pc'+i;
    el.innerHTML='<canvas class="pf" width="32" height="32"></canvas><div class="pt"><b class="pn"></b><i class="pu"></i><div class="pr"></div></div>';
    el.querySelector('.pn').textContent=p.n;el.querySelector('.pu').textContent='@'+p.u;
    box.append(el);gHudFace(i,p);
  });
  G.hudKey=[];$('#sbtns').innerHTML='';
  [250,1200].forEach(ms=>setTimeout(()=>{if(G.stage&&G.stage.st===st)st.players.forEach((p,i)=>gHudFace(i,p));},ms));   // o sprite pode demorar a carregar
}
function gHudFace(i,p){
  const c=document.querySelector('#pc'+i+' .pf');if(!c)return;
  const g=c.getContext('2d');g.clearRect(0,0,32,32);g.imageSmoothingEnabled=false;
  try{const sp=getSprite(parse(String(p.f||''))||DEFAULT,'f',IDLE);g.drawImage(sp,0,22,sp.width,Math.min(sp.height-22,sp.width*1.05),0,0,32,32);}catch(_){}
}
/* o = { active, sub, row:[{c,s,gone}] }: só mexe no HTML quando algo mudou */
function gHudSet(i,o){
  const key=JSON.stringify(o);if(G.hudKey[i]===key)return;G.hudKey[i]=key;
  const el=$('#pc'+i);if(!el)return;
  el.classList.toggle('on',!!o.active);
  const r=el.querySelector('.pr');r.innerHTML='';
  if(o.sub){const s=document.createElement('span');s.className='sub';s.textContent=o.sub;r.append(s);}
  (o.row||[]).forEach(b=>{const s=document.createElement('span');s.className='bl'+(b.s?' s':'')+(b.gone?' gone':'');s.style.setProperty('--c',b.c);r.append(s);});
}
/* aviso grande no meio da tela (TRUCO!, ACEITO!…) */
function gBanner(t,col){const el=$('#sban');if(!el)return;el.textContent=t;el.style.color=col||'#fff';el.classList.remove('on');void el.offsetWidth;el.classList.add('on');}
function gInfo(t){const el=$('#sinfo');if(el&&el.textContent!==t)el.textContent=t;}
/* botões de ação do jogo (ex.: TRUCO!): [{t, hot, f}] */
function gBtns(list){
  const box=$('#sbtns'),key=JSON.stringify(list.map(b=>[b.t,b.hot]));
  if(box.dataset.k===key)return;box.dataset.k=key;box.innerHTML='';
  list.forEach(b=>{const e=document.createElement('button');e.className='px'+(b.hot?' hot':'');e.type='button';e.textContent=b.t;e.addEventListener('click',b.f);box.append(e);});
}

/* ---------- a tela do jogo ("afunda" na mesa) ---------- */
function gStageOpen(a,st,idx){
  if(G.stage||!G.defs[a.type].stageOpen)return;
  const el=$('#stage');G.stage={a,st,idx};
  el.hidden=false;frame.classList.add('instage','diving');frame.classList.remove('chaton');if(typeof chatUi==='function')chatUi();
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('on')));
  G.quitAt=0;$('#stageExit').textContent='Sair do jogo';
  gHudBuild(st,idx);
  G.defs[a.type].stageOpen(a,st,idx,$('#stageCv'));
  gUpdateBtn();
}
function gStageClose(instant){
  const s=G.stage;if(!s)return;
  G.stage=null;
  const el=$('#stage');
  if(G.defs[s.a.type].stageClose)G.defs[s.a.type].stageClose();
  $('#shud').innerHTML='';$('#sbtns').innerHTML='';$('#sbtns').dataset.k='';
  el.classList.remove('on');frame.classList.remove('diving');
  const done=()=>{if(!G.stage){el.hidden=true;frame.classList.remove('instage','chaton');if(typeof chatUi==='function')chatUi();}};
  if(instant)done();else setTimeout(done,520);
  gUpdateBtn();
}
$('#stageExit').addEventListener('click',()=>{
  const s=G.stage;if(!s)return;
  if(s.st.status!=='playing'){gStageClose();return;}
  if(G.defs[s.a.type].solo){gSend(s.a,'quit',{});gSoloEnd(s.a,s.st);return;}
  if(performance.now()>G.quitAt){G.quitAt=performance.now()+3000;$('#stageExit').textContent='Desistir? Toque de novo';return;}
  gSend(s.a,'quit',{});addLog(null,'Você desistiu da partida.');
  const st=s.st;gStageClose();gReset(st);
});
