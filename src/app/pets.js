
/* ================= pets ================= */
const PET_ART={
  cao:{legs:11,talk:'au au!',art:[
    "..............oo....",
    ".............obbo...",
    "............obbbboo.",
    "............obkbbbbo",
    ".oo.........obbbbbko",
    "obbo.......odbbbppo.",
    ".obbo.oooooobbbbo...",
    "..obbobbbbbbbbbbo...",
    "...obbbbbbbbbbbbo...",
    "...obblbbbbbbbbdo...",
    "...odbbbddddbbbdo...",
    "....obo.....obo.....",
    "....obo.....obo.....",
    "....oo......oo......"]},
  gato:{legs:11,talk:'miau',art:[
    "............o...o.",
    "...........obo.obo",
    "..o........obbbbbo",
    ".obo.......obkbkbo",
    ".obo.......obbnbbo",
    "..obo.......obbbo.",
    "..obooooooooobbbo.",
    "...obbbbbbbbbbbbo.",
    "...obbbbbbbbbbbbo.",
    "...obblbbbbbbbbdo.",
    "...odbbbdddddbbdo.",
    "....obo.....obo...",
    "....oo......oo...."]},
  capivara:{legs:10,talk:'...',art:[
    "..............oo..o...",
    ".............obboobo..",
    "............obbbbbbbo.",
    "....oooooooobbkbbbbbo.",
    "...obbbbbbbbbbbbbbbbo.",
    "..obbbbbbbbbbbbbbbkbo.",
    "..obbbbbbbbbbbbbbbbo..",
    "..obbbbbbbbbbbbbbbo...",
    "..obblbbbbbbbbbbbdo...",
    "..odbbbbddddddbbbdo...",
    "...odbddo....odbdo....",
    "...obo.......obo......",
    "...oo........oo......."]},
  coelho:{legs:12,talk:'*pula*',art:[
    "........oo.oo.",
    ".......obo.obo",
    ".......opo.opo",
    ".......obo.obo",
    "......obbbbbbo",
    "......obkbbbbo",
    ".....obbbbbbno",
    "..oooobbbbbbo.",
    ".owobbbbbbbo..",
    ".owbbbbbbbbo..",
    "..obbbbbbbbo..",
    "..odbbbddbbo..",
    "...obo..obo...",
    "...oo...oo...."]},
  pato:{legs:11,talk:'quack!',art:[
    "......ooo....",
    ".....obbbo...",
    ".....obkbyy..",
    ".....obbbyyo.",
    "......obbo...",
    ".o....obbo...",
    "obo..obbbbo..",
    "obbooobbbbbo.",
    ".obbbbbbbbbo.",
    ".obbbbdbbbo..",
    "..obbdddbo...",
    "....oyo.oyo..",
    "....yy...yy.."]}
};
const PET_TYPES=[
  {t:'cao',nome:'Caramelo',c:'#c98a4a'},{t:'cao',nome:'Pretinha',c:'#3a3434'},{t:'cao',nome:'Bolinha',c:'#ece6da'},{t:'cao',nome:'Paçoca',c:'#a8784a'},
  {t:'gato',nome:'Mingau',c:'#efe9e0'},{t:'gato',nome:'Laranja',c:'#e08a3a'},{t:'gato',nome:'Sombra',c:'#2e2c34'},{t:'gato',nome:'Fumaça',c:'#8a8a94'},
  {t:'capivara',nome:'Capitu',c:'#8a5a3a'},{t:'coelho',nome:'Pipoca',c:'#f2efe9'},{t:'coelho',nome:'Nescau',c:'#9a6a4a'},{t:'pato',nome:'Quaquá',c:'#f6f4ee'}
];
const petCache=new Map();
function petSprite(type,col,frame){const k=type+col+frame;let c=petCache.get(k);if(c)return c;const A=PET_ART[type],rows=A.art.map(r=>[...r]);
  if(frame===1){const w=rows[0].length,mid=w/2;for(let y=A.legs;y<rows.length;y++){const src=rows[y],out=Array(w).fill('.');src.forEach((ch,x)=>{if(ch==='.')return;const nx=x<mid?x-1:x+1;if(nx>=0&&nx<w)out[nx]=ch;});rows[y]=out;}}
  const base=hx(col),L=lum(col),pal={b:col,d:mul(col,.78),l:L>.8?'#ffffff':lt(lt(col)),o:mix(mul(col,.42),'#140c10',.55),k:'#141016',w:'#f6f4f0',p:'#e8889a',n:'#e8889a',y:'#f0a030'};
  c=document.createElement('canvas');c.width=rows[0].length;c.height=rows.length;const g=c.getContext('2d');rows.forEach((r,y)=>r.forEach((ch,x)=>{if(ch==='.')return;g.fillStyle=pal[ch]||col;g.fillRect(x,y,1,1);}));petCache.set(k,c);return c;}
let pets=[];
function spawnPets(seedStr,n){pets=[];if(!SCN)return;let h=0;for(const ch of String(seedStr))h=(h*31+ch.charCodeAt(0))|0;const r=rng(h);const count=n||(2+Math.floor(r()*2));
  const used=new Set();for(let i=0;i<count;i++){let p;for(let t=0;t<8;t++){p=PET_TYPES[Math.floor(r()*PET_TYPES.length)];if(!used.has(p.nome))break;}used.add(p.nome);
    let x=0,y=0;for(let t=0;t<200;t++){x=Math.floor(r()*GW);y=Math.floor(r()*GH);if(walkable(x,y,-1,-1)&&!occupied(x,y,null))break;}
    pets.push({pet:true,type:p.t,col:p.c,name:p.nome,gx:x,gy:y,fx:x,fy:y,path:[],mirror:r()<.5,back:false,next:1500+i*900,heart:0,bubble:null,sx:0,sy:0,head:0,seed:i*97});}}
function petThink(p){if(now<p.next||p.path.length)return;p.next=now+2200+Math.random()*4500;const r=Math.random();
  if(r<.35){const people=avatars.filter(a=>!a.pet&&!a.bot);const t=people.length?people[Math.floor(Math.random()*people.length)]:null;
    if(t){for(let k=0;k<12;k++){const x=t.gx+Math.floor(Math.random()*3)-1,y=t.gy+Math.floor(Math.random()*3)-1;if((x!==t.gx||y!==t.gy)&&walkable(x,y,-1,-1)){petWalk(p,x,y);break;}}return;}}
  if(r<.75){for(let k=0;k<20;k++){const x=p.gx+Math.floor(Math.random()*7)-3,y=p.gy+Math.floor(Math.random()*7)-3;if(walkable(x,y,-1,-1)){petWalk(p,x,y);break;}}}}
function petWalk(p,x,y){const path=findPath(p.gx,p.gy,x,y);if(path)p.path=path;}
function petUpdate(p,dt){petThink(p);if(p.path.length){const[tx,ty]=p.path[0],dx=tx-p.fx,dy=ty-p.fy,dist=Math.hypot(dx,dy),st=dt*1.7;const sxd=dx-dy;if(Math.abs(sxd)>.01)p.mirror=sxd<0;
    if(dist<=st){p.fx=p.gx=tx;p.fy=p.gy=ty;p.path.shift();}else{p.fx+=dx/dist*st;p.fy+=dy/dist*st;}}}
function drawPet(p){const[sx,sy]=S(p.fx+.5,p.fy+.5);p.sx=sx;p.sy=sy;const moving=p.path.length>0,fr=moving?Math.floor(now/160)%2:0,spr=petSprite(p.type,p.col,fr);
  const bob=moving?0:(Math.floor((now+p.seed*13)/700)%2);p.head=spr.height+4;
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(sx,sy,spr.width*.42,3,0,0,7);ctx.fill();
  const x=Math.round(sx-spr.width/2),y=Math.round(sy-spr.height+1+bob*0);
  if(p.mirror){ctx.save();ctx.translate(Math.round(sx),0);ctx.scale(-1,1);ctx.drawImage(spr,-Math.round(spr.width/2),y);ctx.restore();}else ctx.drawImage(spr,x,y);
  if(p.heart&&now<p.heart){const ph=1-(p.heart-now)/1400;ctx.globalAlpha=1-ph;const hx_=Math.round(sx)-3,hy=Math.round(sy-spr.height-6-ph*14);[[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[1,2],[2,2],[3,2],[4,2],[5,2],[2,3],[3,3],[4,3],[3,4]].forEach(([a,b])=>R(hx_+a,hy+b,1,1,'#ff4f7a'));ctx.globalAlpha=1;}}
const petAt=(x,y)=>pets.find(p=>Math.abs(x-p.sx)<12&&y<p.sy+3&&y>p.sy-18)||null;
