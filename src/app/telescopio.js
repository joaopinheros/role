/* ================= telescópio (rooftop, 1 pessoa por vez) =================
 * Olhando pela luneta, dá para passear pelos prédios da cidade (arraste, setas ou toque) e dar zoom.
 * A cidade é viva: luzes acendendo e apagando, gente passando nas janelas, um casal se beijando, alguém cantando
 * no chuveiro (só a sombra no vidro embaçado), uma festa, o vizinho vendo futebol, um gato no telhado, um avião,
 * um vigilante de capa no prédio mais alto e, de vez em quando, um disco voador. Cada coisa achada entra na lista
 * (e fica guardada neste aparelho). Quem está na sala vê a pessoa na luneta e fica sabendo do que ela achou.
 *   achou {e}   achei a coisa e (só para avisar a sala)
 */
const TPW=1000,TPH=400,TR_=118;   // tamanho da cidade e raio da luneta (em pixels da tela do jogo)
const TEV=[   // o que dá para achar: nome curto (aviso), frase para a sala
  {id:'casal',n:'CASAL!',f:'um casal se beijando'},
  {id:'chuveiro',n:'CHUVEIRO!',f:'alguém cantando no chuveiro'},
  {id:'vigilante',n:'VIGILANTE!',f:'um vigilante de capa no alto do prédio'},
  {id:'gato',n:'GATO!',f:'um gato passeando no telhado'},
  {id:'festa',n:'FESTA!',f:'uma festa num apartamento'},
  {id:'futebol',n:'GOL!',f:'o vizinho comemorando gol'},
  {id:'yoga',n:'YOGA!',f:'alguém fazendo yoga'},
  {id:'chef',n:'COZINHEIRO!',f:'alguém cozinhando (e queimando)'},
  {id:'aviao',n:'AVIÃO!',f:'um avião passando'},
  {id:'ovni',n:'DISCO VOADOR?!',f:'um DISCO VOADOR'},
];
let TS_=null;   // tela aberta

G.defs.telescopio={
  name:'Telescópio',verb:'Olhar no telescópio',icon:'dice',n:1,solo:true,plates:()=>null,
  stand(a){return[[a.x-1,a.y],[a.x-1,a.y-1]];},
  startLog:st=>gFirst(st.players[0].n)+' foi espiar a cidade pelo telescópio.',
  init(){return{};},toWire(){return{};},fromWire(){return{};},
  onMsg(a,st,d,from){const e=TEV.find(x=>x.id===d.e);if(d.t==='achou'&&e&&st.players[0].peer===from)addLog(null,`${gFirst(st.players[0].n)} viu ${e.f} pelo telescópio!`);},
  tag:()=>false,
  stageOpen:tsStageOpen,stageClose:tsStageClose,
  dbg:()=>TS_?{x:Math.round(TS_.cx),y:Math.round(TS_.cy),z:TS_.z,achados:[...TS_.found],spots:TS_.spots}:null,
  test(cmd,arg){if(!TS_)return null;if(cmd==='look'){const e=tsEvents().find(x=>x.id===arg);if(!e)return false;TS_.cx=e.x;TS_.cy=e.y;return true;}return null;},
};

/* ---------- a cidade (parte fixa, desenhada uma vez) ---------- */
function tsCity(night){
  const c=document.createElement('canvas');c.width=TPW;c.height=TPH;const g=c.getContext('2d'),r=rng(77);
  const sky=g.createLinearGradient(0,0,0,TPH);
  if(night){sky.addColorStop(0,'#05081c');sky.addColorStop(.6,'#1a1840');sky.addColorStop(1,'#3d2c56');}else{sky.addColorStop(0,'#3f8ed8');sky.addColorStop(.7,'#9cd0f0');sky.addColorStop(1,'#e8f0f0');}
  g.fillStyle=sky;g.fillRect(0,0,TPW,TPH);
  if(night)for(let i=0;i<160;i++){g.fillStyle=r()<.2?'#fff1d6':'#ffffff';g.fillRect(r()*TPW|0,r()*TPH*.5|0,1,1);}
  // prédios lá do fundo
  for(let x=0;x<TPW;){const w=30+r()*50,h=120+r()*160;g.fillStyle=night?'#151a34':'#7f9cb8';g.fillRect(x|0,TPH-h|0,w|0,h|0);
    if(night)for(let k=0;k<w*h/260;k++)if(r()<.5){g.fillStyle='rgba(255,216,144,.55)';g.fillRect(x+r()*w|0,TPH-h+r()*h|0,2,2);}x+=w;}
  // prédios da frente, com janelas
  const bs=[];
  for(let x=-10;x<TPW;){
    const w=70+Math.floor(r()*70),h=150+Math.floor(r()*190),top=TPH-h,style=Math.floor(r()*3);
    const col=night?['#2a2840','#30283a','#22303a'][style]:['#b8a890','#a87a62','#8aa0b8'][style];
    g.fillStyle='#000';g.fillRect(x-1,top-1,w+2,h+1);g.fillStyle=col;g.fillRect(x,top,w,h);
    g.fillStyle=night?'rgba(255,255,255,.05)':'rgba(255,255,255,.18)';g.fillRect(x,top,3,h);
    const wins=[];
    for(let yy=top+14;yy<TPH-20;yy+=18)for(let xx=x+8;xx<x+w-12;xx+=14){
      const lit=night?r()<.42:false;wins.push([xx,yy,lit]);
      g.fillStyle=lit?(r()<.7?'#ffd890':'#cfe4ff'):night?'#141428':(r()<.5?'#7ab0d8':'#a8d0ec');g.fillRect(xx,yy,8,11);
      g.fillStyle=night?'rgba(0,0,0,.35)':'rgba(255,255,255,.35)';g.fillRect(xx,yy+10,8,1);
    }
    // coisas no telhado
    if(r()<.5){g.fillStyle=night?'#3a3048':'#6a5a4a';g.fillRect(x+w*.6|0,top-16,16,16);g.fillRect(x+w*.6+2|0,top-20,12,4);}
    if(r()<.4){g.fillStyle='#000';g.fillRect(x+w*.3|0,top-30,1,30);}
    bs.push({x,w,h,top,wins});x+=w+(r()<.35?8+Math.floor(r()*14):0);
  }
  // chão da rua
  g.fillStyle=night?'#0c0c18':'#5a5a60';g.fillRect(0,TPH-10,TPW,10);
  return{c,bs};
}

/* onde fica cada coisa (centro, em pixels da cidade): sai dos prédios gerados, sempre igual */
function tsEvents(){
  if(!TS_.spots){   // cada janela especial num prédio diferente (o mais alto fica para o vigilante)
    const bs=TS_.city.bs,tall=bs.reduce((a,b)=>b.h>a.h?b:a,bs[0]),free=bs.filter(b=>b!==tall&&b.x>20&&b.x+b.w<TPW-20);
    const W=['casal','futebol','chuveiro','chef','festa','yoga'],FY=[.35,.62,.5,.25,.3,.5],sp={};
    W.forEach((id,k)=>{const i=Math.min(free.length-1,Math.floor((k+.5)*free.length/W.length)),b=free[i],twice=free.length<W.length&&k%2;
      sp[id]={x:Math.round(b.x+b.w*(twice?.72:.42)),y:Math.round(b.top+b.h*(twice?.7:FY[k]))};});
    const roof=free[Math.floor(free.length*.7)]||tall,ufo=free[Math.floor(free.length*.3)]||tall;
    sp.vigilante={x:Math.round(tall.x+tall.w*.8),y:tall.top-8};sp.gato={x:Math.round(roof.x+roof.w/2),y:roof.top-4};sp.ovni={x:Math.round(ufo.x+ufo.w/2),y:ufo.top-50};
    TS_.spots=sp;
  }
  const sp=TS_.spots;
  return[...Object.entries(sp).map(([id,p])=>({id,...p,on:id==='ovni'?tsUfoOn():undefined})),{id:'aviao',x:Math.round((now/40)%(TPW+200))-100,y:60}];
}
const tsUfoOn=()=>(now/1000)%70<9;

function tsStageOpen(a,st,idx,cv){
  tsStageClose();cv.width=SW;cv.height=SH;
  const night=!!(SCN&&SCN.night),saved=LS.get('role-telescopio',[]);
  TS_={a,st,cv,g:cv.getContext('2d'),raf:0,city:tsCity(night),night,cx:TPW/2,cy:TPH*.55,z:2,drag:null,keys:{},found:new Set(saved),seen:{},last:now};
  cv.onpointerdown=e=>{TS_.drag={x:e.clientX,y:e.clientY,cx:TS_.cx,cy:TS_.cy};try{cv.setPointerCapture(e.pointerId);}catch(_){}};
  cv.onpointermove=e=>{const d=TS_&&TS_.drag;if(!d)return;const r=cv.getBoundingClientRect(),k=SW/r.width/TS_.z;TS_.cx=d.cx-(e.clientX-d.x)*k;TS_.cy=d.cy-(e.clientY-d.y)*k;tsClamp();};
  cv.onpointerup=cv.onpointercancel=()=>{if(TS_)TS_.drag=null;};
  TS_.key=e=>{if(!TS_||document.activeElement&&document.activeElement.tagName==='INPUT')return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS'].includes(e.code)){TS_.keys[e.code]=e.type==='keydown';e.preventDefault();}};
  addEventListener('keydown',TS_.key);addEventListener('keyup',TS_.key);
  cv.style.cursor='grab';
  const loop=()=>{if(!TS_)return;tsStep();tsDraw();TS_.raf=requestAnimationFrame(loop);};
  TS_.raf=requestAnimationFrame(loop);
}
function tsStageClose(){if(!TS_)return;cancelAnimationFrame(TS_.raf);const cv=TS_.cv;cv.onpointerdown=cv.onpointermove=cv.onpointerup=cv.onpointercancel=null;cv.style.cursor='';removeEventListener('keydown',TS_.key);removeEventListener('keyup',TS_.key);TS_=null;}
function tsClamp(){const v=TR_/TS_.z;TS_.cx=Math.max(v,Math.min(TPW-v,TS_.cx));TS_.cy=Math.max(v*.7,Math.min(TPH-v*.6,TS_.cy));}

function tsStep(){
  const T=TS_,dt=Math.min(.05,(now-T.last)/1000);T.last=now;
  const kx=(T.keys.ArrowRight||T.keys.KeyD?1:0)-(T.keys.ArrowLeft||T.keys.KeyA?1:0),ky=(T.keys.ArrowDown||T.keys.KeyS?1:0)-(T.keys.ArrowUp||T.keys.KeyW?1:0);
  if(kx||ky){T.cx+=kx*160*dt/T.z*2;T.cy+=ky*160*dt/T.z*2;tsClamp();}
  // achou? a coisa precisa ficar perto do centro por um instante (e estar acontecendo)
  for(const e of tsEvents()){
    if(T.found.has(e.id)||e.on===false)continue;
    const near=Math.hypot(e.x-T.cx,e.y-T.cy)<46/T.z+12;
    if(near){T.seen[e.id]=(T.seen[e.id]||0)+dt;if(T.seen[e.id]>.7){T.found.add(e.id);LS.set('role-telescopio',[...T.found]);const ev=TEV.find(x=>x.id===e.id);T.toast={t:'ACHOU: '+ev.n,at:now};gSend(T.a,'achou',{e:e.id});addLog(null,`Você viu ${ev.f}!`);}}
    else T.seen[e.id]=0;
  }
  gBtns([{t:'ZOOM '+(T.z===2?'3x':'2x'),hot:false,f:()=>{T.z=T.z===2?3:2;tsClamp();}}]);
  gInfo(`Achados: ${T.found.size} de ${TEV.length}\n`+TEV.map(e=>(T.found.has(e.id)?'✓ ':'· ')+(T.found.has(e.id)?e.n.replace(/[!?]+$/,'').toLowerCase():'???')).join('\n'));
}

/* ---------- coisas vivas (desenhadas por cima da cidade, em pixels da cidade) ---------- */
function tsLive(g){
  const T=TS_,n=T.night,R=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h);};
  const ev=Object.fromEntries(tsEvents().map(e=>[e.id,e]));
  // janelas que acendem e apagam, e gente passando
  T.city.bs.forEach((b,bi)=>b.wins.forEach(([x,y,lit],wi)=>{
    if((bi*7+wi*13)%11!==0)return;
    const on=n?(Math.sin(now/(2600+wi*37)+wi)>.2):false;
    if(n&&on!==lit)R(x,y,8,11,on?'#ffd890':'#141428');
    if((wi+bi)%3===0){const k=((now/(5200+wi*91))+wi*.37)%1;if(k<.5)R(x+k*2*10-2,y+3,3,8,n?'rgba(20,10,30,.8)':'rgba(30,30,50,.55)');}
  }));
  const frame=(e,w,h,col)=>{R(e.x-w/2-2,e.y-h/2-2,w+4,h+4,'#000');R(e.x-w/2,e.y-h/2,w,h,col);R(e.x-w/2,e.y+h/2,w,2,n?'#3a3048':'#d8d0c0');};
  const sil=n?'#1a0c20':'#2a2440';
  { // casal se beijando: as cabeças se aproximam, e sai um coração
    const e=ev.casal,t=(now/4200)%1,d=t<.4?9-t/.4*5:t<.75?4:4+(t-.75)/.25*5;frame(e,30,20,n?'#ffcf80':'#e8c890');
    R(e.x-d-4,e.y-3,4,4,sil);R(e.x-d-6,e.y+1,7,9,sil);R(e.x+d,e.y-3,4,4,sil);R(e.x+d-1,e.y+1,7,9,sil);R(e.x+d+1,e.y-4,4,2,sil);
    if(t>.42&&t<.78){const k=(t-.42)/.36;g.globalAlpha=1-k;R(e.x-2,e.y-9-k*10,2,2,'#ff3d8b');R(e.x+1,e.y-9-k*10,2,2,'#ff3d8b');R(e.x-2,e.y-7-k*10,5,2,'#ff3d8b');R(e.x-1,e.y-5-k*10,3,1,'#ff3d8b');g.globalAlpha=1;}
  }
  { // chuveiro: vidro embaçado, só a sombra da cabeça e dos braços se mexendo, e vapor
    const e=ev.chuveiro;frame(e,18,22,n?'#bfe0ef':'#d8eef6');
    for(let i=0;i<10;i++)R(e.x-8+((i*5+Math.floor(now/300))%16),e.y-10+((i*7)%20),1,2,'rgba(255,255,255,.6)');
    g.globalAlpha=.55;R(e.x-2,e.y-5,5,5,'#5a6a7a');R(e.x-4,e.y,9,10,'#5a6a7a');const a=Math.sin(now/180)*2;R(e.x-6,e.y-6+a,2,7,'#5a6a7a');R(e.x+5,e.y-6-a,2,7,'#5a6a7a');g.globalAlpha=1;
    R(e.x-8,e.y-11,6,2,'#8a8a98');
    for(let i=0;i<4;i++){const k=((now/1600)+i/4)%1;g.globalAlpha=.5*(1-k);R(e.x-6+i*4+Math.sin(k*6)*2,e.y-14-k*14,4,3,'#ffffff');}g.globalAlpha=1;
    R(e.x+6,e.y+12,3,2,'#ffd23f');R(e.x+8,e.y+11,1,1,'#ff8a3a');   // patinho na janela
  }
  { // vigilante de capa no alto do prédio mais alto (some de vez em quando) e o holofote no céu
    const e=ev.vigilante,gone=(now/1000)%45>38;
    R(e.x-8,e.y+4,16,4,n?'#3a3048':'#6a6a70');R(e.x-5,e.y+1,10,3,n?'#3a3048':'#6a6a70');
    if(!gone){const fl=Math.floor(now/220)%2;
      R(e.x-3,e.y-10,6,6,'#0a0a10');R(e.x-3,e.y-12,1,3,'#0a0a10');R(e.x+2,e.y-12,1,3,'#0a0a10');   // capuz com orelhinhas
      R(e.x-5,e.y-4,10,6,'#0a0a10');R(e.x-6-fl,e.y-3,2,7,'#0a0a10');R(e.x+5+fl,e.y-3,2,7,'#0a0a10');R(e.x-7-fl*2,e.y+1,2,3,'#0a0a10');
      if(n){R(e.x-2,e.y-8,1,1,'#fff');R(e.x+1,e.y-8,1,1,'#fff');}}
    if(n){   // holofote com o morceguinho nas nuvens
      const bx=e.x-160,by=60;g.globalAlpha=.16;g.fillStyle='#fff6c0';g.beginPath();g.moveTo(e.x-120,TPH);g.lineTo(e.x-110,TPH);g.lineTo(bx+22,by+8);g.lineTo(bx-22,by-8);g.fill();g.globalAlpha=1;
      g.fillStyle='rgba(255,240,170,.75)';g.beginPath();g.ellipse(bx,by,24,13,0,0,7);g.fill();
      R(bx-12,by-1,24,3,'#1a1420');R(bx-4,by-4,8,7,'#1a1420');R(bx-2,by-6,1,2,'#1a1420');R(bx+1,by-6,1,2,'#1a1420');R(bx-14,by-3,3,3,'#1a1420');R(bx+11,by-3,3,3,'#1a1420');R(bx-9,by+2,3,2,'#1a1420');R(bx+6,by+2,3,2,'#1a1420');
    }
  }
  { // gato andando no telhado, rabo pra cima
    const e=ev.gato,k=Math.sin(now/2600),x=e.x+k*30,dir=Math.cos(now/2600)>0?1:-1;
    R(x-4,e.y-3,8,3,'#1a1418');R(x+dir*4,e.y-6,4,4,'#1a1418');R(x+dir*4,e.y-7,1,1,'#1a1418');R(x+dir*6,e.y-7,1,1,'#1a1418');R(x-dir*5,e.y-8,1,5,'#1a1418');
    R(x-3,e.y,1,2,'#1a1418');R(x+2,e.y,1,2,'#1a1418');if(n){R(x+dir*5,e.y-5,1,1,'#bfff60');}
  }
  { // festa: luz colorida trocando e três dançando
    const e=ev.festa,c=['#ff3d8b','#43d9e8','#ffd23f','#8fd42a'][Math.floor(now/400)%4];frame(e,34,20,c);
    for(let i=0;i<3;i++){const b=Math.abs(Math.sin(now/200+i*2))*3;R(e.x-11+i*9,e.y-4-b,4,4,sil);R(e.x-12+i*9,e.y-b,6,9,sil);if(i===1&&b>2)R(e.x-13+i*9,e.y-8-b,2,5,sil);}
  }
  { // futebol: TV piscando verde; no gol, ele pula de braços pra cima
    const e=ev.futebol,goal=(now/1000)%14<1.6;frame(e,26,18,n?'#5a7a9a':'#c0d0e0');R(e.x+5,e.y-4,9,7,'#1a1a20');R(e.x+6,e.y-3,7,5,Math.floor(now/500)%2?'#3fbf5a':'#2f9a4a');
    const j=goal?Math.abs(Math.sin(now/90))*4:0;R(e.x-8,e.y-3-j,4,4,sil);R(e.x-9,e.y+1-j,6,8,sil);if(goal){R(e.x-11,e.y-8-j,2,6,sil);R(e.x-4,e.y-8-j,2,6,sil);g.font='700 7px Anybody, sans-serif';g.fillStyle='#ffd23f';g.fillText('GOL!',e.x-14,e.y-14);}
  }
  { // yoga: posições trocando
    const e=ev.yoga,p=Math.floor(now/2200)%3;frame(e,22,22,n?'#e8c0ff':'#e8e0f8');R(e.x-1,e.y-8,3,3,sil);R(e.x-1,e.y-5,3,7,sil);
    if(p===0){R(e.x-5,e.y-9,2,5,sil);R(e.x+3,e.y-9,2,5,sil);R(e.x-1,e.y+2,1,8,sil);R(e.x+1,e.y+2,3,1,sil);R(e.x+3,e.y+2,1,4,sil);}
    else if(p===1){R(e.x-6,e.y-4,14,2,sil);R(e.x-3,e.y+2,1,8,sil);R(e.x+2,e.y+2,1,8,sil);}
    else{R(e.x-1,e.y-12,3,4,sil);R(e.x-4,e.y+2,9,2,sil);R(e.x-5,e.y+4,2,6,sil);R(e.x+4,e.y+4,2,6,sil);}
  }
  { // cozinheiro: frigideira jogando a comida pra cima, fumaça saindo
    const e=ev.chef,k=(now/1400)%1;frame(e,24,18,n?'#ffe0a0':'#f0e8d8');R(e.x-6,e.y-4,4,4,sil);R(e.x-7,e.y,6,8,sil);R(e.x-7,e.y-6,6,2,'#fff');
    R(e.x+1,e.y+1,8,2,'#1a1a20');R(e.x-1,e.y+1,3,1,'#1a1a20');const fy=k<.5?e.y-k*16:e.y-8+(k-.5)*16;R(e.x+4,fy-1,3,2,'#e8a03a');
    for(let i=0;i<3;i++){const s=((now/1200)+i/3)%1;g.globalAlpha=.45*(1-s);R(e.x+2+i*3,e.y-12-s*16,4,3,'#cfcfcf');}g.globalAlpha=1;
  }
  { // avião cruzando o céu (luzinhas piscando)
    const e=ev.aviao;R(e.x-6,e.y,12,2,n?'#3a3a4a':'#e8e8f0');R(e.x-2,e.y-2,4,6,n?'#3a3a4a':'#e8e8f0');
    if(Math.floor(now/400)%2){R(e.x-7,e.y,1,1,'#ff3a3a');R(e.x+6,e.y,1,1,'#3aff6a');}if(Math.floor(now/300)%3===0)R(e.x,e.y-3,1,1,'#fff');
  }
  if(tsUfoOn()){ // disco voador, de vez em quando
    const e=ev.ovni,w=Math.sin(now/300)*3;g.globalAlpha=.25;g.fillStyle='#8fffb0';g.beginPath();g.moveTo(e.x-4+w,e.y+4);g.lineTo(e.x+4+w,e.y+4);g.lineTo(e.x+14+w,e.y+50);g.lineTo(e.x-14+w,e.y+50);g.fill();g.globalAlpha=1;
    R(e.x-10+w,e.y,20,4,'#8a9aa8');R(e.x-5+w,e.y-4,10,4,'#bfefff');for(let i=0;i<4;i++)R(e.x-8+i*5+w,e.y+1,2,2,Math.floor(now/150+i)%2?'#ffd23f':'#ff3d8b');
  }
}

function tsDraw(){
  const T=TS_,g=T.g;g.imageSmoothingEnabled=false;
  g.fillStyle='#000';g.fillRect(0,0,SW,SH);
  const cx=SW/2,cy=SH/2-6,shake=Math.sin(now/170)*.5+Math.sin(now/530)*.8,sx=T.cx+Math.sin(now/2300)*1.5+shake/T.z,sy=T.cy+Math.cos(now/1900)*1.2;
  g.save();g.beginPath();g.arc(cx,cy,TR_,0,7);g.clip();
  g.translate(Math.round(cx-sx*T.z),Math.round(cy-sy*T.z));g.scale(T.z,T.z);
  g.drawImage(T.city.c,0,0);tsLive(g);
  g.restore();
  // luneta: anel, mira e escurecido na borda
  const v=g.createRadialGradient(cx,cy,TR_*.7,cx,cy,TR_);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.7)');g.fillStyle=v;g.beginPath();g.arc(cx,cy,TR_,0,7);g.fill();
  g.strokeStyle='#1a1a24';g.lineWidth=10;g.beginPath();g.arc(cx,cy,TR_+5,0,7);g.stroke();g.strokeStyle='#4a4a5a';g.lineWidth=2;g.beginPath();g.arc(cx,cy,TR_+9,0,7);g.stroke();
  g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1;g.beginPath();g.moveTo(cx-14,cy);g.lineTo(cx-4,cy);g.moveTo(cx+4,cy);g.lineTo(cx+14,cy);g.moveTo(cx,cy-14);g.lineTo(cx,cy-4);g.moveTo(cx,cy+4);g.lineTo(cx,cy+14);g.stroke();
  // aviso do que achou (no alto, sem tapar o centro)
  if(T.toast&&now-T.toast.at<2600){const k=Math.min(1,(now-T.toast.at)/180),y=Math.round(cy-TR_-2+k*16);g.font='900 15px Anybody, sans-serif';g.textAlign='center';const w=g.measureText(T.toast.t).width+20;
    g.fillStyle='#000';g.fillRect(Math.round(cx-w/2)-2,y-2,Math.round(w)+4,24);g.fillStyle='#ffd23f';g.fillRect(Math.round(cx-w/2),y,Math.round(w),20);g.fillStyle='#000';g.textBaseline='middle';g.fillText(T.toast.t,cx,y+11);g.textBaseline='alphabetic';g.textAlign='left';}
  // minimapa embaixo: onde estou na cidade
  const mw=160,mx=(SW-mw)/2,my=SH-14;g.fillStyle='#22222e';g.fillRect(mx,my,mw,4);g.fillStyle='#ffd23f';g.fillRect(mx+Math.round(T.cx/TPW*mw)-2,my-1,5,6);
  g.font='700 9px Anybody, sans-serif';g.fillStyle='#8a8aa0';g.textAlign='center';g.fillText('arraste para olhar · setas também',SW/2,SH-20);g.textAlign='left';
}
