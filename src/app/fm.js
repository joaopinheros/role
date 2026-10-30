/* ================= Rolê FM: música do YouTube sincronizada na sala =================
 * Ninguém retransmite áudio: cada pessoa toca o vídeo no próprio aparelho, pelo player oficial do YouTube, e só
 * quando toca em "Ouvir junto" (quem não quer ouvir não baixa nada do YouTube). O servidor guarda o que está tocando,
 * desde quando (relógio dele) e a fila; aqui a gente acerta o relógio e calcula em que segundo a música está.
 * Comandos no chat (/music, /skip, /pause, /play, /fila, /tocando, /limpar, /tirar) com regras em
 * src/engine/fmcore.js. O desenho (dirigível no computador, palco no celular) fica em fmvisual.js.
 * Ajustes visuais e de tempo: FMV.
 */
const FMV={
  player:200,        // lado do player (mínimo do YouTube: 200x200)
  mobileMax:760,     // até essa largura (ou com toque) vale o visual de celular
  pollMs:60000,      // relê o estado de vez em quando, mesmo sem aviso
  bpm:120,           // pulso simulado das caixas (o áudio do player não pode ser analisado)
  crossMs:40000,     // o dirigível atravessa o céu nesse tempo
  staticMs:300,      // chiado do telão ao trocar de música
  notesSky:8,notesStage:6,
};
const FM={on:false,ok:false,api:null,role:null,st:null,off:0,listen:false,yt:null,ytReady:false,vid:null,ver:-1,
  houseWas:false,timers:[],unsub:null,poke:0,busy:false,advancing:-1,durSent:-1,lastDrift:0,muted:false,min:false,
  changeAt:0,coverVid:null,covers:null,seenVer:-1,err:null};

const FM_ERR={
  auth:'Entra de novo na sua conta pra usar o Rolê FM.',perm:'Só o dono ou os DJs podem fazer isso.',
  privada:'O Rolê FM é só para salas privadas.',closed:'Esse rolê está encerrado.',djs:'Nesta sala só o dono e os DJs põem música.',
  fila_cheia:'A fila está cheia. Espera andar um pouco.',limite:'Você já tem 3 músicas na fila. Espera uma tocar.',
  rapido:'Calma! Muitos pedidos em pouco tempo. Tenta daqui a pouco.',longo:'Esse vídeo passa de 15 minutos. Escolhe um mais curto.',
  link:'Não entendi esse link. Cola um link do YouTube.',embed:'Esse vídeo não deixa tocar fora do YouTube. Tenta outro.',
  notfound:'Não achei esse vídeo no YouTube.',live:'Transmissão ao vivo não dá. Escolhe um vídeo.',vazio:'Não tem música sua na fila.',
  ninguem:'Não achei essa pessoa no rolê.',dono:'O dono já é DJ.',cedo:'A música ainda não acabou.',
  ocupado:'Já tem uma busca rodando nesta sala. Espera um instante.',buscas:'Você já fez 10 buscas nesta hora. Cola o link, que funciona sempre.',
  cota:'A busca por nome está no limite de hoje. Cola o link que funciona.',semchave:'Falta a YOUTUBE_API_KEY. Rodando local: ponha no arquivo .env e reinicie o servidor. No Supabase: Edge Functions > Secrets. Por enquanto cola o link.',
  nada:'Não achei nada com esse nome. Tenta outras palavras ou cola o link.',tarde:'Já passou o tempo de trocar (60 segundos).',
  fnvelha:'A busca por nome precisa da função music-resolve nova: publica de novo (supabase functions deploy music-resolve --no-verify-jwt) e guarda a YOUTUBE_API_KEY.',
  nofn:'O Rolê FM ainda não está ligado aqui (falta publicar a função music-resolve).',
  off:'O Rolê FM ainda não está ligado neste servidor.',server:'Não deu pra falar com o servidor agora. Tenta de novo.',
};
const fmErr=e=>FM_ERR[e&&e.code]||FM_ERR.server;
const fmMobile=()=>innerWidth<=FMV.mobileMax||matchMedia('(pointer: coarse)').matches;
const fmSnow=()=>Date.now()+FM.off;                       // relógio do servidor
const fmNp=()=>FM.st&&FM.st.np||{status:'parado',version:0};
const fmPlaying=()=>fmNp().status==='tocando';
const fmCurPos=()=>fmPos(fmNp(),fmSnow());

/* ---------- ligar e desligar com a sala ---------- */
async function fmSetup(eid){
  fmStop();
  if(!ROOMCAP||!ROOMCAP.fm||!live)return;
  Object.assign(FM,{on:true,ok:false,api:ROOMCAP.fm,role:eid,st:null,err:null});
  $('#fmVol').value=LS.get('role-fm-vol',80);
  FM.unsub=live.onMsg?live.onMsg(k=>{if(k==='fm')fmPoke();}):null;
  FM.timers.push(setInterval(fmTick,1000),setInterval(()=>fmRefresh(),FMV.pollMs));
  await fmSyncClock();
  await fmRefresh();
}
function fmStop(){
  FM.timers.forEach(clearInterval);FM.timers=[];
  if(FM.unsub){FM.unsub();FM.unsub=null;}
  fmListen(false,true);
  Object.assign(FM,{on:false,ok:false,st:null,role:null,covers:null,coverVid:null,vid:null});FMVIS.tvs.clear();
  fmUi();fmHint('');
}
/* diferença entre o relógio daqui e o do servidor: 3 medidas, descontando metade da ida e volta */
async function fmSyncClock(){
  const ms=[];
  for(let i=0;i<3;i++){try{const t0=Date.now(),server=await FM.api.now(),t1=Date.now();ms.push({t0,t1,server});}catch(_){}}
  FM.off=fmOffset(ms);
}
function fmPoke(){clearTimeout(FM.poke);FM.poke=setTimeout(()=>fmRefresh(),120);}
async function fmRefresh(){
  if(!FM.on||FM.busy)return;
  FM.busy=true;
  try{const st=await FM.api.state(FM.role);if(!FM.on)return;FM.st=st;FM.ok=true;FM.err=null;fmApply();}
  catch(e){FM.err=e&&e.code;if(['perm','auth'].includes(FM.err))FM.ok=false;else if(!FM.st)FM.ok=false;}
  finally{FM.busy=false;fmUi();}
}
/* avisa a sala (no Supabase não há aviso do servidor) e relê */
function fmChanged(){try{live&&live.send&&live.send('fm',{});}catch(_){}fmRefresh();}

/* ---------- o estado mudou: capa, player e house ---------- */
function fmApply(){
  const np=fmNp();
  if(np.video&&np.video!==FM.vid){FM.changeAt=now;fmCover(np);}
  if(!np.video){FM.covers=null;FM.coverVid=null;}
  FM.vid=np.video||null;
  fmSyncPlayer(true);
  fmHouse();
}
/* o house da sala para enquanto a pessoa ouve o Rolê FM e volta quando a fila acaba (ou ela para de ouvir) */
function fmHouse(){
  const want=FM.listen&&fmNp().status!=='parado';
  if(want&&MUSIC.on){MUSIC.stop();FM.houseWas=true;updSom();}
  else if(!want&&FM.houseWas){FM.houseWas=false;MUSIC.start();updSom();}
}

/* todo segundo: acabou a música? o player desviou? falta a duração? */
function fmTick(){
  if(!FM.on||!FM.ok)return;
  const np=fmNp(),pos=fmCurPos();
  if(np.status==='tocando'&&np.dur&&pos>=np.dur+1&&FM.advancing!==np.version)fmAdvanceLater(np.version);
  if(FM.listen&&FM.ytReady&&np.status==='tocando'){
    if(now-FM.lastDrift>FM_CFG.driftEveryMs){FM.lastDrift=now;const cur=FM.yt.getCurrentTime();if(Math.abs(cur-pos)>FM_CFG.driftMaxS)FM.yt.seekTo(pos,true);}
    const chefe=!!FM.st,d=FM.yt.getDuration&&FM.yt.getDuration();
    if(chefe&&np.dur==null&&d>0&&FM.durSent!==np.version){FM.durSent=np.version;FM.api.act(FM.role,'duracao',{version:np.version,dur:Math.round(d)}).then(fmChanged).catch(()=>{});}
  }
  fmUiTime();
}
/* quem perceber o fim pede a próxima; cada um espera um pouco diferente e o banco só aceita um (versão) */
function fmAdvanceLater(version){
  FM.advancing=version;
  setTimeout(()=>{if(!FM.on||fmNp().version!==version)return;
    FM.api.act(FM.role,'advance',{version,skip:false}).then(r=>{if(r&&r.ok)fmChanged();else fmRefresh();}).catch(()=>{FM.advancing=-1;});},200+Math.random()*1300);
}

/* ---------- comandos ---------- */
function fmSay(t){addBotLine(t,true);}
async function fmCommand(text){
  const c=fmParse(text);if(!c)return false;
  if(c.cmd==='?'){fmSay(`Não conheço /${c.name}. Digita / pra ver os comandos.`);return true;}
  if(!FM.on){fmSay('O Rolê FM só funciona com o servidor (não no modo local).');return true;}
  if(!FM.ok)await fmRefresh();
  if(!FM.ok){fmSay(FM_ERR[FM.err]||FM_ERR.off);return true;}
  const st=FM.st,sala={quem:st.quem,priv:st.priv},papel=st.papel,np=fmNp();
  if(!fmPrivate(sala)){fmSay(FM_ERR.privada);return true;}
  const run=async(p,ok)=>{try{const r=await p;if(ok)ok(r);fmChanged();return r;}catch(e){fmSay(fmErr(e));return null;}};
  const need=a=>{if(fmCan(papel,a,sala))return true;fmSay(a==='dj'||a==='undj'?'Só o dono da sala dá ou tira DJ.':'Não deu pra fazer isso agora.');return false;};
  switch(c.cmd){
    case 'ajuda':fmSay('Comandos: '+FM_HELP.filter(h=>fmHelpOk(h[2])).map(h=>h[1]).join(' · '));break;
    case 'music':
      if(!c.arg){fmSay('Cola um link do YouTube: /music https://youtu.be/…');break;}
      if(!fmCan(papel,'add',sala)){fmSay(FM_ERR.djs);break;}
      if(fmRoomFor(st.queue,st.eu,papel)<=0){fmSay(FM_ERR.limite);break;}
      fmSay(fmIsLink(c.arg)?'Conferindo o link…':'Procurando no YouTube…');
      await run(FM.api.add(FM.role,c.arg),r=>{if(r&&!r.tocando)fmSay(`Na fila (posição ${r.pos}): ${r.title}`);});
      break;
    case 'skip':if(need('skip')){if(np.status==='parado'){fmSay('Não tem nada tocando.');break;}await run(FM.api.act(FM.role,'advance',{version:np.version,skip:true}),r=>{if(r&&!r.ok)fmSay('Alguém já pulou essa.');});}break;
    case 'pause':if(need('pause')){if(np.status!=='tocando'){fmSay('Não tem música tocando.');break;}await run(FM.api.act(FM.role,'pause'));}break;
    case 'play':if(need('play')){if(np.status!=='pausado'){fmSay(np.status==='tocando'?'Já está tocando.':'Não tem música pausada.');break;}await run(FM.api.act(FM.role,'play'));}break;
    case 'limpar':if(need('limpar'))await run(FM.api.act(FM.role,'limpar'),n=>{if(!n)fmSay('A fila já estava vazia.');});break;
    case 'fila':{const q=st.queue;fmSay(q.length?`Próximas (${q.length}): `+q.slice(0,5).map((x,i)=>`${i+1}. ${x.title} (@${x.by})`).join(' · '):'A fila está vazia. Põe uma: /music <link>');break;}
    case 'tocando':fmSay(np.status==='parado'?'Nada tocando agora.':`${np.status==='pausado'?'Pausada':'Tocando'}: ${np.title} · ${fmClock(fmCurPos())}${np.dur?' de '+fmClock(np.dur):''} · por @${np.by}`);break;
    case 'tirar':
      if(c.arg>0&&!(st.queue[c.arg-1]&&st.queue[c.arg-1].by===st.eu)&&!need('tirarQualquer'))break;
      await run(FM.api.act(FM.role,'tirar',{pos:c.arg}),t=>fmSay('Saiu da fila: '+t));break;
  }
  return true;
}
const fmHelpOk=()=>true;

/* autocompletar: digitou "/" e aparece a lista do que a pessoa pode usar */
function fmHint(v){
  const box=$('#fmHint');if(!box)return;
  const m=/^\/(\w*)$/.exec(v||'');
  const list=m&&FM.on?FM_HELP.filter(h=>h[0].startsWith(m[1].toLowerCase())&&fmHelpOk(h[2])):[];
  box.hidden=!list.length;box.innerHTML='';
  list.forEach(h=>{const b=document.createElement('button');b.type='button';b.textContent=h[1];
    b.addEventListener('mousedown',e=>e.preventDefault());
    b.addEventListener('click',()=>{const i=$('#msg');i.value='/'+h[0]+' ';i.focus();fmHint('');});box.append(b);});
}
$('#msg').addEventListener('input',e=>fmHint(e.target.value));
$('#msg').addEventListener('keydown',e=>{
  if(e.key==='Tab'&&/^\/\w*$/.test(e.target.value)){const b=$('#fmHint button');if(b){e.preventDefault();b.click();}}
  if(e.key==='Escape')fmHint('');
});
$('#msg').addEventListener('blur',()=>setTimeout(()=>fmHint(''),150));

/* ---------- mensagens do bot no chat (chip sun com a nota) ---------- */
function addBotLine(text,mine){
  const d=document.createElement('div');d.className='bot'+(mine?' mine':'');
  d.innerHTML=pix('note');const s=document.createElement('span');s.textContent=text;d.append(s);
  log.append(d);while(log.children.length>(innerWidth<760?3:10))log.firstChild.remove();log.scrollTop=log.scrollHeight;
}
function fmBotFromChat(id,m,fresh){
  addBotLine(m.t,false);
  if(fresh)fmPoke();
  const d=m.d||{};
  // "Não era essa?": só para quem pediu, enquanto dá tempo de trocar (60 s)
  if(fresh&&d.k==='colocou'&&d.alts&&d.alts.length&&ME&&d.u===ME.usuario&&Date.now()-m.at<FM_CFG.swapS*1000)fmAlts(id,d.alts,m.at);
}
function fmDur(s){return s?fmClock(s):'';}
function fmCard(it,label){
  const b=document.createElement('button');b.type='button';b.className='fmcard';
  const im=document.createElement('img');im.alt='';im.loading='lazy';im.src='https://i.ytimg.com/vi/'+it.video+'/default.jpg';
  const t=document.createElement('span');t.className='ct';t.textContent=it.title;
  const s=document.createElement('span');s.className='cs';s.textContent=[it.canal,fmDur(it.dur)].filter(Boolean).join(' · ');
  const tx=document.createElement('span');tx.className='cx';tx.append(t,s);
  b.append(im,tx);if(label){const l=document.createElement('i');l.textContent=label;b.append(l);}
  return b;
}
function fmAlts(id,alts,at){
  const box=document.createElement('div');box.className='bot alts';
  const h=document.createElement('b');h.textContent='Não era essa?';box.append(h);
  const row=document.createElement('div');row.className='fmcards';box.append(row);
  alts.slice(0,FM_CFG.altCount).forEach((it,i)=>{
    const c=fmCard(it);c.addEventListener('click',async()=>{
      box.remove();
      try{await FM.api.act(FM.role,'trocar',{msg:id,idx:i});fmChanged();}catch(e){fmSay(fmErr(e));}});
    row.append(c);});
  log.append(box);log.scrollTop=log.scrollHeight;
  setTimeout(()=>box.remove(),Math.max(1000,FM_CFG.swapS*1000-(Date.now()-at)));
}
/* /buscar: os resultados só para quem pediu, cada um com "Pôr na fila" */
function fmShowResults(list){
  if(!list.length){fmSay(FM_ERR.nada);return;}
  const box=document.createElement('div');box.className='bot mine alts';
  const h=document.createElement('b');h.textContent='Resultados (só você vê)';box.append(h);
  const row=document.createElement('div');row.className='fmcards';box.append(row);
  list.slice(0,5).forEach(it=>{
    const c=fmCard(it,'Pôr na fila');c.addEventListener('click',async()=>{
      c.disabled=true;
      try{const r=await FM.api.add(FM.role,'https://youtu.be/'+it.video);fmChanged();if(r&&!r.tocando)fmSay(`Na fila (posição ${r.pos}): ${r.title}`);}
      catch(e){fmSay(fmErr(e));c.disabled=false;}});
    row.append(c);});
  log.append(box);log.scrollTop=log.scrollHeight;
}

/* ---------- capa (miniatura pública do YouTube, reduzida uma vez por música) ---------- */
function fmCover(np){
  if(FM.coverVid===np.video)return;
  FM.coverVid=np.video;FM.covers=null;
  const load=cors=>{const img=new Image();if(cors)img.crossOrigin='anonymous';
    img.onload=()=>{if(FM.coverVid!==np.video)return;
      const cut=(w,h,sx,sy,sw,sh)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(img,sx,sy,sw,sh,0,0,w,h);return c;};
      const W=img.naturalWidth||480,H=img.naturalHeight||360,band=W*9/16,y0=(H-band)/2;   // hqdefault tem faixas pretas em cima e embaixo
      FM.covers={sq:cut(28,28,(W-band)/2,y0,band,band),wide:cut(40,24,W*.03,y0,W*.94,band)};};
    img.onerror=()=>{if(cors&&FM.coverVid===np.video)load(false);};   // sem CORS dá para desenhar igual (ninguém lê os pixels do mundo)
    img.src=np.thumb||`https://i.ytimg.com/vi/${np.video}/hqdefault.jpg`;};
  load(true);
}

/* ---------- player (só para quem toca em "Ouvir junto") ---------- */
function fmLoadYT(){
  if(window.YT&&YT.Player)return Promise.resolve();
  if(fmLoadYT.p)return fmLoadYT.p;
  return fmLoadYT.p=new Promise((res,rej)=>{
    const prev=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{if(prev)try{prev();}catch(_){}res();};
    const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.async=true;
    s.onerror=()=>{fmLoadYT.p=null;rej(new Error('yt'));};document.head.append(s);});
}
async function fmListen(on,quiet){
  if(!on){
    if(FM.yt){try{FM.yt.destroy();}catch(_){}}
    FM.yt=null;FM.ytReady=false;
    const box=$('#fmBox');if(box){box.hidden=true;$('#fmYT')&&($('#fmYT').outerHTML='<div id="fmYT"></div>');}
    if(FM.listen){FM.listen=false;fmHouse();if(!quiet)addLog(null,'Você parou de ouvir o Rolê FM.');}
    fmUi();return;
  }
  if(!FM.on||!FM.ok)return;
  FM.listen=true;fmUi();fmHouse();
  if(!quiet)addLog(null,fmPlaying()?'Ouvindo junto! O house da sala dá uma pausa.':'Pronto: quando alguém puser música, toca aqui.');
  try{await fmLoadYT();}catch(_){FM.listen=false;fmUi();fmSay('Não deu pra carregar o player do YouTube agora.');return;}
  fmSyncPlayer(true);
}
/* cria o player, troca de música, pausa ou volta, conforme o estado da sala */
function fmSyncPlayer(force){
  if(!FM.listen||!(window.YT&&YT.Player))return;
  const np=fmNp(),box=$('#fmBox');
  if(np.status==='parado'||!np.video){box.hidden=true;fmLayout();if(FM.ytReady)try{FM.yt.stopVideo();}catch(_){}FM.ver=np.version;return;}
  box.hidden=false;fmLayout();
  const pos=fmCurPos();
  if(!FM.yt){
    FM.ytVid=np.video;FM.ver=np.version;
    FM.yt=new YT.Player('fmYT',{width:FMV.player,height:FMV.player,videoId:np.video,
      playerVars:{autoplay:np.status==='tocando'?1:0,playsinline:1,controls:0,disablekb:1,fs:0,rel:0,iv_load_policy:3,modestbranding:1,start:Math.floor(pos),origin:location.origin},
      events:{onReady:()=>{FM.ytReady=true;try{FM.yt.setVolume(LS.get('role-fm-vol',80));}catch(_){}fmSyncPlayer(true);fmAutoplayCheck();},
        onStateChange:e=>{if(e.data===0&&fmPlaying())fmAdvanceLater(fmNp().version);},
        onError:()=>{const chefe=!!FM.st;fmSay('Esse vídeo não tocou aqui. Pulando…');
          if(chefe&&fmPlaying())FM.api.act(FM.role,'advance',{version:fmNp().version,skip:true}).then(fmChanged).catch(()=>{});}}});
    return;
  }
  if(!FM.ytReady)return;
  if(np.video!==FM.ytVid){FM.ytVid=np.video;FM.ver=np.version;FM.yt.loadVideoById({videoId:np.video,startSeconds:pos});if(np.status==='pausado')setTimeout(()=>{try{FM.yt.pauseVideo();}catch(_){}},400);fmAutoplayCheck();return;}
  if(np.version!==FM.ver||force){
    FM.ver=np.version;
    if(np.status==='pausado'){FM.yt.pauseVideo();FM.yt.seekTo(pos,true);}
    else{if(Math.abs(FM.yt.getCurrentTime()-pos)>FM_CFG.driftMaxS)FM.yt.seekTo(pos,true);if(FM.yt.getPlayerState()!==1)FM.yt.playVideo();}
  }
}
/* o navegador pode barrar som sem um toque antes: aí toca mudo e o próximo toque em qualquer lugar liga o som */
function fmAutoplayCheck(){
  setTimeout(()=>{
    if(!FM.ytReady||!fmPlaying())return;
    if(FM.yt.getPlayerState()===1&&!FM.yt.isMuted())return;
    FM.yt.mute();FM.yt.playVideo();FM.muted=true;fmUi();
    const un=()=>{document.removeEventListener('pointerdown',un,true);if(FM.yt){FM.yt.unMute();FM.yt.playVideo();}FM.muted=false;fmUi();};
    document.addEventListener('pointerdown',un,true);
  },1600);
}
/* tocar no dirigível, no palco ou no botão: liga o "Ouvir junto" (ou mostra o player) */
function fmActivate(){
  if(!FM.on)return;
  if(!FM.listen){fmListen(true);return;}
  if(FM.min){FM.min=false;fmUi();}
}

/* ---------- HUD: botão "Ouvir junto" e o quadro do player ---------- */
function fmUi(){
  const b=$('#rFm');if(!b)return;
  const np=fmNp(),avail=FM.on&&FM.ok;
  show(b,avail);
  if(avail){b.setAttribute('aria-pressed',String(FM.listen));setBtn(b,'note',FM.listen?'Rádio ligada':'Ligar a rádio');b.setAttribute('aria-label',FM.listen?'Desligar a rádio da sala':'Ligar a rádio da sala');}
  frame.classList.toggle('fmon',FM.listen&&np.status!=='parado');
  const box=$('#fmBox');if(!box)return;
  box.classList.toggle('min',FM.min);
  $('#fmTitle').textContent=np.title||'';
  show($('#fmTap'),FM.muted);
  fmUiTime();fmLayout();
}
function fmUiTime(){const t=$('#fmTime');if(!t||!FM.listen)return;const np=fmNp();t.textContent=np.status==='parado'?'':fmClock(fmCurPos())+(np.dur?' / '+fmClock(np.dur):'');}
/* celular com música ou jogo: opções e chat viram botões (veja o CSS "celular"); o player fica sempre inteiro e visível */
const fmCompact=()=>matchMedia('(max-width:760px),(pointer:coarse) and (max-height:520px)').matches&&(frame.classList.contains('fmon')||frame.classList.contains('instage'));
function fmLayout(){
  const box=$('#fmBox'),dock=document.querySelector('.chat-dock');
  if(dock)dock.style.bottom='';
  if(!box||box.hidden)return;
  if(!fmMobile()){box.style.bottom='';return;}
  const fr=frame.getBoundingClientRect();
  if(fmCompact()){
    if(innerWidth>innerHeight){box.style.bottom='';return;}   // deitado: o player fica à direita e o chat à esquerda
    if(frame.classList.contains('chaton')){const f=$('#chatForm').getBoundingClientRect();box.style.bottom=Math.round(fr.bottom-f.top+8)+'px';}   // chat aberto: o player sobe acima da barra de digitar
    else{box.style.bottom='';if(dock)dock.style.bottom=Math.round(box.offsetHeight+28)+'px';}   // chat fechado: as mensagens claras ficam acima do player
    return;
  }
  const acts=document.querySelector('.chat-dock .acts');
  if(acts){const r=acts.getBoundingClientRect();box.style.bottom=Math.max(12,Math.round(fr.bottom-r.top+8))+'px';}
}
function chatUi(){
  $('#rChat').setAttribute('aria-pressed',String(frame.classList.contains('chaton')));
  $('#rMore').setAttribute('aria-pressed',String(frame.classList.contains('more')));
  fmLayout();
}
$('#rChat').addEventListener('click',()=>{const on=frame.classList.toggle('chaton');chatUi();if(on)setTimeout(()=>$('#msg').focus(),0);});
$('#rMore').addEventListener('click',()=>{frame.classList.toggle('more');chatUi();});
addEventListener('resize',fmLayout);
$('#rFm').addEventListener('click',()=>fmListen(!FM.listen));
$('#fmStop').addEventListener('click',()=>fmListen(false));
$('#fmMin').addEventListener('click',()=>{FM.min=!FM.min;fmUi();fmLayout();});
$('#fmTap').addEventListener('click',()=>{if(FM.yt){FM.yt.unMute();FM.yt.playVideo();}FM.muted=false;fmUi();});
$('#fmVol').addEventListener('input',e=>{const v=+e.target.value;LS.set('role-fm-vol',v);if(FM.ytReady)FM.yt.setVolume(v);});   // o valor salvo entra no fmSetup (LS vem do app.js, carregado depois)

/* pulso simulado (o áudio do iframe não pode ser analisado): ~120 BPM com leve variação, só com música tocando */
function fmBeat(){
  if(!fmPlaying())return 0;
  const bpm=FMV.bpm*(1+.025*Math.sin(now/9000)),ph=((now/60000)*bpm)%1;
  return Math.max(0,1-ph*1.8);
}

function fmDbg(){
  const np=fmNp();
  return{on:FM.on,ok:FM.ok,err:FM.err,listen:FM.listen,ytReady:FM.ytReady,muted:FM.muted,papel:FM.st&&FM.st.papel,status:np.status,video:np.video||null,
    title:np.title||null,version:np.version,pos:+fmCurPos().toFixed(1),dur:np.dur,fila:FM.st?FM.st.queue.map(q=>q.video):[],djs:FM.st?FM.st.djs:[],
    off:Math.round(FM.off),house:MUSIC.on,capa:!!FM.covers,mobile:fmMobile(),visual:typeof fmVisDbg==='function'?fmVisDbg():null,
    yt:FM.ytReady?{t:+FM.yt.getCurrentTime().toFixed(1),state:FM.yt.getPlayerState(),vid:FM.ytVid}:null};
}
