
/* ================= avatar Y2K: ponte entre o motor e o app ================= */
const SPW=AV.W,SPH=AV.H,FB=AV.PY,WS=3; /* mundo em 3x: avatar (2px por pixel lógico) fica 2/3 do tamanho anterior em relação aos móveis */
function hx(c){return[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]}
function mul(c,k){const f=v=>Math.max(0,Math.min(255,Math.round(v*k))).toString(16).padStart(2,'0');const[r,g,b]=hx(c);return'#'+f(r)+f(g)+f(b)}
function mix(a,b,k){const A=hx(a),B=hx(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*k).toString(16).padStart(2,'0')).join('');}
const dk=c=>mul(c,.76),lt=c=>mul(c,1.18);
const lum=c=>{const[r,g,b]=hx(c);return(.299*r+.587*g+.114*b)/255};
function rng(seed){return()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const ri=n=>Math.floor(Math.random()*n);
const pick=a=>a[ri(a.length)];
const PAL=AV.PAL;
const BUILDS=['magro','medio','largo'];
const SLOTS=[
  {key:'hair',label:'Cabelo',cores:'cabelo',crop:[20,14,72,64]},
  {key:'face',label:'Rosto',cores:null,crop:[34,34,44,44]},
  {key:'top_under',label:'Camiseta',cores:'roupa',vazio:'Nenhuma',crop:[10,62,92,92]},
  {key:'top_over',label:'Por cima',cores:'roupa',vazio:'Nenhum',crop:[10,62,92,92]},
  {key:'bottom',label:'Baixo',cores:'roupa',crop:[8,112,96,132]},
  {key:'shoes',label:'Pés',cores:'roupa',crop:[22,204,68,44]},
  {key:'neck',label:'Pescoço',cores:'roupa',vazio:'Nada',crop:[28,58,56,48]},
  {key:'belt',label:'Cinto',cores:'roupa',vazio:'Nada',crop:[22,108,68,52]},
  {key:'headwear',label:'Cabeça',cores:'roupa',vazio:'Nada',crop:[20,10,72,60]},
  {key:'glasses',label:'Óculos',cores:'roupa',vazio:'Nada',crop:[34,38,44,30]},
  {key:'bag',label:'Bolsa',cores:'roupa',vazio:'Nada',crop:[4,72,104,104]},
  {key:'pele',label:'Pele',cores:'pele'}
];
function itensDo(slot){if(slot==='hair')return Object.entries(AV.HAIR).map(([id,h])=>({id,nome:h.nome}));
  if(slot==='face')return Object.keys(AV.FACES).map(id=>({id,nome:{neutro:'Neutro','na-boa':'Na boa',serio:'Sério',sonolento:'Sonolento',piscando:'Piscando',rindo:'Rindo',delineado:'Delineado'}[id]||id}));
  return(AV.ITENS[slot]||[]).map(i=>({id:i.id,nome:i.nome}));}
const DEFAULT={g:0,b:1,alt:0,pele:'pele2',hair:['franja-emo','vinho'],face:'sonolento',top_under:['camiseta','preto'],top_over:null,bottom:['cargo','preto'],shoes:['skate','preto'],neck:['fone','grafite'],belt:['tachas','preto'],headwear:null,glasses:null,bag:null};
const bodyId=f=>`${f.g?'f':'m'}-${BUILDS[f.b]}`;
function encode(f){const s=(k,v)=>`${k}:${v==null?'-':Array.isArray(v)?v.join(':'):v}`;
  return[`body:${bodyId(f)}:${f.pele}:alt${f.alt||0}`,...SLOTS.filter(s=>s.key!=='pele').map(sl=>s(sl.key,f[sl.key]))].join(';');}
function parse(str){
  const f=JSON.parse(JSON.stringify(DEFAULT));if(!str||!/^body:/.test(String(str)))return null;
  for(const part of String(str).trim().split(';')){if(!part)continue;const[k,...v]=part.split(':');
    if(k==='body'){const m=/^([mf])-(magro|medio|largo)$/.exec(v[0]||'');if(!m||!PAL.pele[v[1]])return null;f.g=m[1]==='f'?1:0;f.b=BUILDS.indexOf(m[2]);const a=/^alt([0-2])$/.exec(v[2]||'alt0');if(!a)return null;f.alt=+a[1];f.pele=v[1];continue;}
    const sl=SLOTS.find(s=>s.key===k);if(!sl)continue;
    if(v[0]==='-'||v[0]===undefined){if(!sl.vazio)return null;f[k]=null;continue;}
    if(!itensDo(k).some(i=>i.id===v[0]))return null;
    if(sl.cores){if(!PAL[sl.cores][v[1]])return null;f[k]=[v[0],v[1]];}else f[k]=v[0];}
  return f;}
const Y2K=['preto','preto','branco','rosa-bebe','azul-bebe','lilas','jeans','jeans-escuro','prata','vermelho','rosa','verde-lima','turquesa','grafite','creme','militar','vinho','roxo','amarelo','laranja','bege'];
function randomFig(){const g=ri(2),ids=s=>itensDo(s).map(i=>i.id),c=()=>pick(Y2K);
  const hair=g?pick(['chanel','longo-liso','coque-duplo','maria-chiquinha','repartido','wolf','cacheado','black','franja-emo']):pick(['chanel','franja-emo','repartido','espetado','wolf','raspado','cacheado','black','longo-liso']);
  return{g,b:pick([0,1,1,1,2]),alt:pick([0,0,1,2]),pele:pick(Object.keys(PAL.pele)),hair:[hair,Math.random()<.65?pick(['preto','preto','cafe','castanho','caramelo','loiro']):pick(Object.keys(PAL.cabelo))],
    face:pick(['neutro','neutro','na-boa','serio','sonolento','piscando','rindo','delineado']),
    top_under:[pick(ids('top_under')),c()],top_over:Math.random()<.4?[pick(ids('top_over')),c()]:null,
    bottom:[pick(g?ids('bottom'):ids('bottom').filter(i=>!/saia/.test(i))),pick(['preto','jeans','jeans-escuro','militar','bege','grafite','rosa','marinho','branco'])],
    shoes:[pick(ids('shoes')),pick(['preto','branco','branco','rosa-bebe','vermelho','prata'])],
    neck:Math.random()<.4?[pick(ids('neck')),c()]:null,belt:Math.random()<.35?[pick(ids('belt')),pick(['preto','branco','marrom'])]:null,
    headwear:Math.random()<.3?[pick(ids('headwear')),c()]:null,glasses:Math.random()<.18?[pick(ids('glasses')),pick(['rosa','azul-bebe','prata','amarelo','preto'])]:null,bag:Math.random()<.2?[pick(ids('bag')),c()]:null};}
const topColor=f=>f.top_over?PAL.roupa[f.top_over[1]]:f.top_under?PAL.roupa[f.top_under[1]]:PAL.pele[f.pele];
const IDLE={p:'idle',f:0};
const cache=new Map();
function getSprite(f,view,pose){pose=pose||IDLE;const k=encode(f)+'|'+view+'|'+pose.p+(pose.f||0);let s=cache.get(k);if(s)return s;
  const r=AV.render(f,view,pose.p,pose.f||0),lo=document.createElement('canvas');lo.width=AV.LW;lo.height=AV.LH;const id=lo.getContext('2d').createImageData(AV.LW,AV.LH);id.data.set(r.rgba);lo.getContext('2d').putImageData(id,0,0);
  const c=document.createElement('canvas');c.width=SPW;c.height=SPH;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(lo,0,0,SPW,SPH);
  c.headY=Math.round(r.sk.head[1]-r.sk.d.hry-6);
  if(cache.size>700){let n=0;for(const key of cache.keys()){cache.delete(key);if(++n>200)break;}}cache.set(k,c);return c;}
/* pré-aquecimento: renderiza quadros de animação nas folgas */
const warmQ=[];
function prewarm(f){['f','b'].forEach(v=>{[['walk',0],['walk',1],['walk',2],['walk',3],['bob',0],['idle',0]].forEach(([p,i])=>warmQ.push([f,v,{p,f:i}]));});}
function warmStep(budget=12){const t0=performance.now();while(warmQ.length&&performance.now()-t0<budget){const[f,v,p]=warmQ.shift();getSprite(f,v,p);}}
const onAtlas=f=>f();
