
/* ================= caminho ================= */
let WALK_NPC=false;   // true enquanto um NPC decide por onde andar: ele pode usar SCN.keep (atrás do balcão)
function walkable(x,y,tx,ty){if(!SCN||x<0||y<0||x>=GW||y>=GH)return false;const k=key(x,y);if(SCN.blocked.has(k)&&!(WALK_NPC&&SCN.keep&&SCN.keep.has(k)))return false;const s=SCN.seats.get(k);return !s||s.soft||(x===tx&&y===ty);}   // tapete (soft) dá para atravessar; só senta se o caminho terminar nele
function findPath(sx,sy,tx,ty){
  if(!walkable(tx,ty,tx,ty))return null;if(sx===tx&&sy===ty)return[];
  const prev=new Map([[key(sx,sy),null]]),q=[[sx,sy]],W=(x,y)=>walkable(x,y,tx,ty);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while(q.length){const[x,y]=q.shift();
    for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(prev.has(k)||!W(nx,ny))continue;if(dx&&dy&&(!W(x+dx,y)||!W(x,y+dy)))continue;
      prev.set(k,[x,y]);
      if(nx===tx&&ny===ty){const path=[[nx,ny]];let c=[x,y];while(c&&!(c[0]===sx&&c[1]===sy)){path.unshift(c);c=prev.get(key(c[0],c[1]));}return path;}
      q.push([nx,ny]);}}
  return null;
}

/* ================= avatares ================= */
let avatars=[];
function makeAv(name,fig,gx,gy,o={}){prewarm(fig);const a={name,fig,gx,gy,fx:gx,fy:gy,path:[],back:false,mirror:false,action:null,actionUntil:0,bubble:null,bot:!!o.bot,peer:o.peer||null,user:o.user||null,next:0,seed:ri(900),sx:0,sy:0,head:0,sitKind:2};avatars.push(a);return a;}
function walkTo(a,tx,ty){const sx=a.path.length?a.path[0][0]:a.gx,sy=a.path.length?a.path[0][1]:a.gy;const p=findPath(sx,sy,tx,ty);if(!p)return false;a.path=a.path.length?[a.path[0],...p]:p;a.action=null;a.onArrive=null;return true;}
function setDir(a,dx,dy){const sx=dx-dy,sy=dx+dy;if(!sx&&!sy)return;a.back=sy<0;if(sx)a.mirror=sx<0;}
function faceTo(a,tx,ty){setDir(a,Math.sign(tx-a.gx),Math.sign(ty-a.gy));}
function sit(a){const s=SCN&&SCN.seats.get(key(a.gx,a.gy));a.path=[];a.action='sit';a.sitKind=s?s.kind:2;if(s){a.back=s.back;a.mirror=s.mirror;}}
function update(a,dt){
  if(a.path.length){
    const[tx,ty]=a.path[0],dx=tx-a.fx,dy=ty-a.fy,dist=Math.hypot(dx,dy),step=dt*(a.slowv||2.6);
    setDir(a,Math.sign(Math.round(dx*100)),Math.sign(Math.round(dy*100)));
    if(dist<=step){a.fx=a.gx=tx;a.fy=a.gy=ty;a.path.shift();
      if(!a.path.length){if(SCN.seats.has(key(a.gx,a.gy)))sit(a);if(a.onArrive){const f=a.onArrive;a.onArrive=null;f();}}}
    else{a.fx+=dx/dist*step;a.fy+=dy/dist*step;}
  }
  if(a.action==='wave'&&now>a.actionUntil)a.action=null;
}
function poseOf(a){
  if(a.burnUntil>now)return{p:'dance',f:Math.floor(now/90)%4};   // queimou no chão de lava: fica pulando
  if(a.npc){const n=npcPose(a);if(n)return n;}
  if(a.ovr)return a.ovr.pose||IDLE;                               // posição e pose controladas por um jogo (vôlei)
  if(a.path.length)return{p:'walk',f:Math.floor(now/150)%4};
  if(a.action==='sit')return{p:a.sitKind===1?'sit1':'sit2',f:0};
  if(a.action==='dance')return{p:'dance',f:Math.floor((now+a.seed)/280)%4};
  if(a.action==='wave')return{p:'wave',f:Math.floor(now/260)%2};
  return{p:Math.floor((now+a.seed*7)/950)%2?'bob':'idle',f:0};
}
function drawAv(a){
  const o=a.ovr,z=o&&o.z||0,[sx,gy]=S((o?o.fx:a.fx)+.5,(o?o.fy:a.fy)+.5),sy=gy-z;a.sx=sx;a.sy=sy;
  const spr=getSprite(a.fig,a.back?'b':'f',poseOf(a));a.head=spr.headY;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);const X=Math.round(sx*WS),Y=Math.round(sy*WS),Yg=Math.round(gy*WS);
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(X,Yg+1,24-Math.min(10,z/3),8-Math.min(3,z/9),0,0,7);ctx.fill();
  const swim=!o&&swimAt(a),cut=swim?132:spr.height;   // na piscina só aparece da cintura para cima, com a água em volta
  if(a.mirror){ctx.translate(X,0);ctx.scale(-1,1);ctx.drawImage(spr,0,0,spr.width,cut,-AV.PX,Y-FB,spr.width,cut);if(a.npc)npcProp(a,-AV.PX,Y-FB);}
  else{ctx.drawImage(spr,0,0,spr.width,cut,X-AV.PX,Y-FB,spr.width,cut);if(a.npc)npcProp(a,X-AV.PX,Y-FB);}
  ctx.restore();
  if(swim){const wy=Y-FB+cut,t=now/400+a.seed;ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='rgba(70,170,230,.55)';ctx.beginPath();ctx.ellipse(X,wy,30,10,0,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;for(let k=0;k<2;k++){const r=((t+k*.5)%1);ctx.globalAlpha=1-r;ctx.beginPath();ctx.ellipse(X,wy,30+r*18,10+r*6,0,0,7);ctx.stroke();}
    ctx.globalAlpha=1;ctx.fillStyle='rgba(255,255,255,.6)';ctx.fillRect(X-22+Math.round(Math.sin(t*3)*4),wy-2,6,2);ctx.restore();}
}
const headWorld=a=>a.sy-(FB-(a.head||40))/WS;
const occupied=(x,y,self)=>avatars.some(a=>a!==self&&((a.gx===x&&a.gy===y)||(a.path.length&&a.path[a.path.length-1][0]===x&&a.path[a.path.length-1][1]===y)));
function randFree(self){for(let i=0;i<300;i++){const x=ri(GW),y=ri(GH);if(walkable(x,y,-1,-1)&&!occupied(x,y,self))return[x,y];}return[0,0];}
function freeNear(x0,y0,self){for(let r=0;r<6;r++)for(let i=0;i<40;i++){const x=x0+ri(r*2+1)-r,y=y0+ri(r*2+1)-r;if(walkable(x,y,-1,-1)&&!occupied(x,y,self))return[x,y];}return randFree(self);}

/* ================= armazenamento ================= */
const ARTIFACT_URL='https://claude.ai/artifact/5fD5HTSZ1J6BbrfMs9A3tS';
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const genId=n=>{const a='abcdefghijkmnpqrstuvwxyz23456789';let s='';for(let i=0;i<n;i++)s+=a[ri(a.length)];return s;};
function LocalDB(){
  const K='role-db-v1';let mem=LS.get(K,{});const subs=new Set();
  const save=()=>LS.set(K,mem),fire=()=>subs.forEach(f=>{try{f()}catch(e){console.warn(e)}});
  addEventListener('storage',e=>{if(e.key===K){mem=LS.get(K,{});fire();}});
  const kids=p=>Object.keys(mem).filter(k=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')).map(k=>({id:k.slice(p.length+1),data:{...mem[k]}}));
  const clone=d=>JSON.parse(JSON.stringify(d));
  return{local:true,
    async get(p){return mem[p]?clone(mem[p]):null},
    async set(p,d){mem[p]=clone(d);save();fire();},
    async update(p,d){mem[p]={...(mem[p]||{}),...clone(d)};save();fire();},
    async del(p){delete mem[p];save();fire();},
    async list(p){return kids(p)},
    async add(p,d){const id=Date.now().toString(36)+genId(4);mem[p+'/'+id]=clone(d);save();fire();return id;},
    watchDoc(p,cb){const f=()=>cb(mem[p]?clone(mem[p]):null);subs.add(f);f();return()=>subs.delete(f);},
    watchColl(p,cb,o={}){const f=()=>{let l=kids(p);if(o.order)l.sort((a,b)=>(a.data[o.order]||0)-(b.data[o.order]||0));if(o.limit)l=l.slice(-o.limit);cb(l);};subs.add(f);f();return()=>subs.delete(f);},
    findConta(q){const k=Object.keys(mem).find(k=>/^data\/users\/[^/]+\/conta$/.test(k)&&(mem[k].email===q||mem[k].tel===q));return k?{uid:k.split('/')[2],c:clone(mem[k])}:null;}
  };}
function RemoteDB(db){const d=p=>db.doc(p),c=p=>db.collection(p);
  return{local:false,
    async get(p){const s=await d(p).get();return s.exists?s.data():null},
    set:(p,x)=>d(p).set(x),update:(p,x)=>d(p).update(x),del:p=>d(p).delete(),
    async list(p){const s=await c(p).get();return s.docs.map(x=>({id:x.id,data:x.data()}))},
    async add(p,x){const r=await c(p).add(x);return r.id},
    watchDoc(p,cb){return d(p).onSnapshot(s=>cb(s.exists?s.data():null),e=>console.warn('db',e))},
    watchColl(p,cb,o={}){let q=c(p);if(o.order)q=q.orderBy(o.order,'desc');if(o.limit)q=q.limit(o.limit);
      return q.onSnapshot(s=>{let l=s.docs.map(x=>({id:x.id,data:x.data()}));if(o.order)l.reverse();cb(l);},e=>console.warn('db',e));},
    findConta:null};}
/* sala ao vivo local (outras abas do mesmo navegador) — mesma forma do room.join */
function LocalRoom(name){
  const id=genId(8),bc='BroadcastChannel' in window?new BroadcastChannel('role-room-'+name):null;let mine={};const others=new Map(),hs=new Set();
  const emitPeers=(j=[],l=[],u=[])=>{const peers=[...others.values()];hs.forEach(h=>h({peers,joined:j,left:l,updated:u}));};
  const send=m=>{try{bc&&bc.postMessage({...m,from:id})}catch(e){}};
  if(bc)bc.onmessage=({data:m})=>{if(!m||m.from===id)return;
    if(m.t==='hello')send({t:'p',presence:mine});
    if(m.t==='p'||m.t==='hello'){const had=others.has(m.from),p={peer:m.from,isMe:false,presence:m.presence||{},updatedAt:Date.now()};others.set(m.from,p);had?emitPeers([],[],[p]):emitPeers([p]);}
    if(m.t==='bye'){const p=others.get(m.from);if(p){others.delete(m.from);emitPeers([],[p]);}}};
  addEventListener('pagehide',()=>send({t:'bye'}));
  return{local:true,async presence(patch){mine={...mine,...patch};send({t:'p',presence:mine});},peers:()=>[...others.values()],
    onPeers(h){hs.add(h);return()=>hs.delete(h);},async leave(){send({t:'bye'});bc&&bc.close();hs.clear();},start(){send({t:'hello',presence:mine});}};}

let DB=LocalDB(),UID=null,ROOMCAP=null,REMOTE=false,SRV=false,NET=null;
const MAX_SALA=8,SALA_MS=8*3600e3;   // até 8 pessoas e 8 h no ar (mesmos números do banco e do servidor)
async function initCaps(){
  if(window.ROLE_SERVER){SRV=REMOTE=true;NET=Net();DB=ServerDB(NET);ROOMCAP={join:n=>NET.join(n),fm:NET.fm};
    const a=LS.get('role-auth',null);if(a&&a.token){try{const r=await NET.hello(a.token);UID=r.uid;}catch(e){if(e.code!=='timeout')LS.del('role-auth');}}
    if(!UID)UID='anon';return;}
  if(window.ROLE_SUPABASE&&window.RoleSupabase){try{const s=await RoleSupabase.connect(window.ROLE_SUPABASE);SRV=REMOTE=true;NET=s.net;DB=s.db;UID=s.uid||'anon';ROOMCAP={join:s.room,voice:s.voice,fm:s.fm};if(s.conta)sessao.set(s.conta);return;}
    catch(e){console.warn('supabase',e);toast('Sem conexão com o servidor. Usando o modo local.',5000);}}
  try{if(window.claude&&claude.use){
    const t=new Promise(r=>setTimeout(()=>r([null,null,null]),9000));
    const [db,user,room]=await Promise.race([Promise.all([claude.use('db'),claude.use('user'),claude.use('room')]),t]);
    if(db&&user){const id=await user.id();if(id){DB=RemoteDB(db);UID=id;REMOTE=true;}}
    ROOMCAP=room||null;}}catch(e){console.warn(e)}
  if(!UID){UID=LS.get('role-uid',null);if(!UID){UID='local-'+genId(10);LS.set('role-uid',UID);}}
}

/* ================= utilidades de UI ================= */
const show=(el,on=true)=>{el.hidden=!on;};
function toast(t,ms=2600){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>el.hidden=true,ms);}
function errOn(id,t){const el=$(id);el.textContent=t||'';el.hidden=!t;}
const onlyDigits=s=>String(s||'').replace(/\D/g,'');
function fmtTel(d){d=onlyDigits(d).slice(0,11);if(d.length<3)return d.length?'('+d:'';const a=d.slice(0,2),b=d.slice(2);
  if(b.length<=4)return`(${a}) ${b}`;if(d.length<=10)return`(${a}) ${b.slice(0,4)}-${b.slice(4)}`;return`(${a}) ${b.slice(0,5)}-${b.slice(5)}`;}
const telOk=d=>/^\d{10,11}$/.test(d);
const mailOk=m=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m);
const userOk=u=>/^[a-z0-9._]{3,16}$/.test(u);
/* a sala dura 8 h depois de criada; salas antigas (sem "criado") contam como no ar */
const roomLeft=r=>r&&r.criado?r.criado+SALA_MS-Date.now():SALA_MS;
function leftTxt(r){const ms=roomLeft(r);if(ms<=0)return'Encerrado';const m=Math.ceil(ms/60000),h=Math.floor(m/60);return'Restam '+(h?h+'h '+String(m%60).padStart(2,'0')+'min':m+' min');}
const ownOrigin=()=>/^https?:$/.test(location.protocol)&&!(window.claude&&claude.use);
const inviteLink=eid=>SRV||ownOrigin()?location.origin+'/r/'+eid:ARTIFACT_URL+'#r-'+eid;
async function copyText(text,btn){const done=()=>{if(btn){const o=btn.innerHTML;setBtn(btn,'check','Copiado');setTimeout(()=>btn.innerHTML=o,1500);}toast('Link copiado. Agora é só colar no grupo.');};
  try{await navigator.clipboard.writeText(text);done();}catch(e){const i=document.createElement('textarea');i.value=text;document.body.append(i);i.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}i.remove();ok?done():toast('Não deu pra copiar sozinho. Seleciona o link e copia.');}}
/* a paleta dos cartuchos: as cores chapadas dos cartazes de MF DOOM e Kanye (lima, rosa, índigo, laranja, roxo, vermelho) */
const CART={churrasco:'#f7e817',festa:'#e8302a',pijama:'#2f7fd0',parque:'#b8b9c4',boate:'#0b0b0b',boteco:'#e8302a',piscina:'#2f7fd0',vulcao:'#f7e817',templo:'#b8b9c4',praia:'#f7e817',rooftop:'#1560b0'};
const cartColor=id=>CART[id]||'#6c3ce0';
function setTime(n){document.body.dataset.time=n?'night':'day';}
function chipsFor(el,r){el.innerHTML='';const sc=sceneById(r.cena);
  [[r.nome?null:null],[leftTxt(r),''],[sc.nome,''],[r.noite?'Noite':'Dia',r.noite?'moon':'sun']].forEach(([t,c])=>{if(!t)return;const s=document.createElement('span');s.className='chip '+(c||'');s.textContent=t;el.append(s);});}

/* ================= cenas, miniaturas e vitrine ================= */
const sceneCache=new Map();
function getScene(id,n){const k=id+(n?'N':'D');let s=sceneCache.get(k);if(!s){s=buildScene(id,n);if(sceneCache.size>=(innerWidth<760?2:3))sceneCache.delete(sceneCache.keys().next().value);sceneCache.set(k,s);}return s;}
const thumbCache=new Map();
function paintSkyTo(g,w,h,scn){const day=!scn.night,gr=g.createLinearGradient(0,0,0,h);
  if(day&&scn.sc.outdoor){gr.addColorStop(0,'#6fb8e8');gr.addColorStop(1,'#cfe9f5');}else if(day){gr.addColorStop(0,'#3d3a35');gr.addColorStop(1,'#2a2825');}else{gr.addColorStop(0,'#232220');gr.addColorStop(1,'#141413');}
  g.fillStyle=gr;g.fillRect(0,0,w,h);}
function sceneThumb(id,n,cvs){const k=id+(n?'N':'D');let img=thumbCache.get(k);
  if(!img){const prev=SCN,s=getScene(id,n);img=document.createElement('canvas');img.width=480;img.height=400;const g=img.getContext('2d');paintSkyTo(g,480,400,s);
    const keepNow=now;drawWorld(s,[]);g.imageSmoothingEnabled=true;g.drawImage(wb,110*WS,170*WS,820*WS,683*WS,0,0,480,400);now=keepNow;SCN=prev;thumbCache.set(k,img);}
  const g=cvs.getContext('2d');g.clearRect(0,0,cvs.width,cvs.height);g.imageSmoothingEnabled=true;g.drawImage(img,0,0,cvs.width,cvs.height);}
let mode='vitrine'; // vitrine | sala
function setScene(id,n){SCN=getScene(id,n);setTime(n);avatars.forEach(a=>{const[x,y]=randFree(a);a.gx=a.fx=x;a.gy=a.fy=y;a.path=[];a.action=null;});spawnPets(id+'v',2);MUSIC.scene(id);}
function seedBots(){avatars=avatars.filter(a=>!a.bot);for(let i=0;i<6;i++){const[x,y]=randFree(null);const b=makeAv('',randomFig(),x,y,{bot:true});b.next=600+i*700;if(i%3===0)b.action='dance';}}
function botThink(b){
  if(b.npc){npcThink(b);return;}
  if(now<b.next||b.path.length)return;b.next=now+2500+Math.random()*5000;const r=Math.random();
  if(b.action==='sit'&&r<.6)return;
  if(r<.4){const t=randFree(b);walkTo(b,...t);}
  else if(r<.62){const opts=[...SCN.seats.keys()].map(k=>k.split(',').map(Number)).filter(([x,y])=>!occupied(x,y,b));const t=opts[ri(opts.length)];if(t&&walkTo(b,...t)){b.onArrive=()=>sit(b);b.next+=5000;}}
  else if(r<.82){b.path=[];b.action='dance';}
  else{b.action='wave';b.actionUntil=now+2000;}
}

/* ================= estado do app ================= */
let ME=null,fig={...DEFAULT},PEND=null,PENDING_INVITE=LS.get('role-convite',null),CUR=null;
const sessao={get:()=>LS.get('role-sessao',null),set:c=>LS.set('role-sessao',{usuario:c.usuario,uid:UID,at:Date.now()}),clear:()=>LS.del('role-sessao')};
const contaPath=()=>`data/users/${UID}/conta`;
async function loadSession(){const s=sessao.get();if(!s)return null;
  if(!REMOTE&&s.uid)UID=s.uid;
  try{const c=await DB.get(contaPath());if(c&&c.verificado&&c.usuario===s.usuario)return c;}catch(e){}return null;}

const SCREENS=['#scrInvite','#scrLanding','#scrAuth','#scrVerify','#scrHome','#scrCreate'];
function go(scr){SCREENS.forEach(s=>show($(s),s===scr));show($('#roomUI'),scr==='room');frame.classList.toggle('inroom',scr==='room');
  if(scr!=='room'&&mode==='sala')leaveRoom();
  const f=scr&&scr!=='room'&&document.querySelector(scr+' input:not([readonly]), '+scr+' button.hot');if(f&&matchMedia('(min-width:761px)').matches)setTimeout(()=>f.focus(),30);}

/* ---------- conta ---------- */
function authTab(login){$('#tabSignup').setAttribute('aria-selected',String(!login));$('#tabLogin').setAttribute('aria-selected',String(login));show($('#fSignup'),!login);show($('#fLogin'),login);errOn('#suErr');errOn('#liErr');}
$('#tabSignup').addEventListener('click',()=>authTab(false));
$('#tabLogin').addEventListener('click',()=>authTab(true));
$('#suUser').addEventListener('input',e=>{const v=e.target.value.toLowerCase().replace(/[^a-z0-9._]/g,'');if(v!==e.target.value)e.target.value=v;});
$('#suTel').addEventListener('input',e=>{e.target.value=fmtTel(e.target.value);});
function openLanding(){go('#scrLanding');vitrine('churrasco',true);}
$('#landEnter').addEventListener('click',()=>openAuth());
function openAuth(){const inv=PENDING_INVITE;show($('#authBanner'),!!inv);if(inv)$('#authBannerName').textContent=inv.nome||'';authTab(false);go('#scrAuth');vitrine(inv?inv.cena:'churrasco',inv?inv.noite:true);}
function sendCode(dev){PEND.code=SRV?null:String(1000+ri(9000));PEND.tries=0;$('#vTel').textContent=fmtTel(PEND.tel);$('#vCode').value='';errOn('#vErr');
  const shown=SRV?dev:PEND.code;if(!shown){show($('#sms'),false);go('#scrVerify');return;}
  $('#smsText').textContent='Seu código do The Other Place é '+shown;show($('#sms'));clearTimeout(sendCode.h);sendCode.h=setTimeout(()=>show($('#sms'),false),15000);go('#scrVerify');}
$('#fSignup').addEventListener('submit',async e=>{e.preventDefault();
  const nome=$('#suNome').value.trim(),usuario=$('#suUser').value.trim(),email=$('#suEmail').value.trim().toLowerCase(),tel=onlyDigits($('#suTel').value);
  if(nome.length<2)return errOn('#suErr','Coloca seu nome.');
  if(!userOk(usuario))return errOn('#suErr','Usuário: 3 a 16 letras minúsculas, números, ponto ou _.');
  if(!mailOk(email))return errOn('#suErr','E-mail inválido.');
  if(!telOk(tel))return errOn('#suErr','Celular com DDD, ex.: (11) 98765-4321.');
  if(SRV){try{const r=await NET.call('authStart',{tipo:'cadastro',conta:{nome,usuario,email,tel}});PEND={tipo:'cadastro',req:{tipo:'cadastro',conta:{nome,usuario,email,tel}},tel};errOn('#suErr');sendCode(r.dev);}
    catch(err){errOn('#suErr',{exists:'Já existe conta com esse e-mail ou celular. Use “Entrar”.',taken:'Esse usuário já está em uso. Tenta outro.',slow:'Muitas tentativas. Espera um minutinho.'}[err.code]||'Não deu pra falar com o servidor agora. Tenta de novo.');}return;}
  try{
    let uid=UID;
    if(REMOTE){const ex=await DB.get(contaPath());if(ex&&ex.verificado&&ex.usuario!==usuario)return errOn('#suErr',`Essa conta já tem cadastro como @${ex.usuario}. Use “Entrar”.`);}
    else{const ex=DB.findConta(email)||DB.findConta(tel);if(ex)return errOn('#suErr','Já existe conta com esse e-mail ou celular. Use “Entrar”.');uid='local-'+genId(10);}
    const p=await DB.get('perfis/'+usuario);if(p&&p.dono!==uid)return errOn('#suErr','Esse usuário já está em uso. Tenta outro.');
    PEND={tipo:'cadastro',uid,conta:{nome,usuario,email,tel},tel};errOn('#suErr');sendCode();
  }catch(err){errOn('#suErr','Não deu pra falar com o servidor agora. Tenta de novo.');console.warn(err);}
});
$('#fLogin').addEventListener('submit',async e=>{e.preventDefault();
  const raw=$('#liId').value.trim().toLowerCase(),q=raw.includes('@')?raw:onlyDigits(raw);
  if(!(mailOk(q)||telOk(q)))return errOn('#liErr','Digita o e-mail ou o celular com DDD.');
  if(SRV){try{const r=await NET.call('authStart',{tipo:'login',q});PEND={tipo:'login',req:{tipo:'login',q},tel:r.tel};errOn('#liErr');sendCode(r.dev);}
    catch(err){errOn('#liErr',{notfound:'Não achamos conta com esse e-mail ou celular. Cria uma em “Criar conta”.',slow:'Muitas tentativas. Espera um minutinho.'}[err.code]||'Não deu pra falar com o servidor agora.');}return;}
  try{let found=null;
    if(REMOTE){const c=await DB.get(contaPath());if(c&&c.verificado&&(c.email===q||c.tel===q))found={uid:UID,c};}
    else found=DB.findConta(q);
    if(!found)return errOn('#liErr','Não achamos conta com esse e-mail ou celular. Cria uma em “Criar conta”.');
    PEND={tipo:'login',uid:found.uid,conta:found.c,tel:found.c.tel};errOn('#liErr');sendCode();
  }catch(err){errOn('#liErr','Não deu pra falar com o servidor agora.');console.warn(err);}
});
$('#vCode').addEventListener('input',e=>{e.target.value=onlyDigits(e.target.value).slice(0,4);if(e.target.value.length===4)$('#fVerify').requestSubmit();});
$('#vResend').addEventListener('click',async()=>{if(!PEND)return;if(!SRV)return sendCode();try{const r=await NET.call('authStart',PEND.req);sendCode(r.dev);toast('Código reenviado.');}catch(e){errOn('#vErr','Não deu pra reenviar agora.');}});
$('#vBack').addEventListener('click',()=>{show($('#sms'),false);openAuth();});
$('#fVerify').addEventListener('submit',async e=>{e.preventDefault();if(!PEND)return openAuth();
  if(SRV){try{const r=await NET.call('authVerify',{code:$('#vCode').value,fig:encode(fig)});UID=r.uid;LS.set('role-auth',{uid:r.uid,token:r.token});await NET.hello(r.token);
      ME=r.conta;const f=parse(ME.fig||'');if(f)fig=f;sessao.set(ME);PEND=null;show($('#sms'),false);afterAuth();}
    catch(err){PEND.tries++;$('#vCode').value='';errOn('#vErr',err.code==='badcode'?(PEND.tries>=3?'Código errado de novo. Toca em “Reenviar código”.':'Código não confere. Tenta de novo.'):err.code==='expired'?'Código expirou. Toca em “Reenviar código”.':'Não deu pra confirmar agora. Tenta de novo.');}return;}
  if($('#vCode').value!==PEND.code){PEND.tries++;$('#vCode').value='';return errOn('#vErr',PEND.tries>=3?'Código errado de novo. Toca em “Reenviar código”.':'Código não confere. Tenta de novo.');}
  try{UID=PEND.uid;if(!REMOTE)LS.set('role-uid',UID);
    let c;
    if(PEND.tipo==='cadastro'){c={...PEND.conta,verificado:true,fig:encode(fig),criado:Date.now()};await DB.set(contaPath(),c);await DB.set('perfis/'+c.usuario,{nome:c.nome,fig:c.fig,dono:UID});}
    else{c=await DB.get(contaPath());}
    ME=c;const f=parse(c.fig||'');if(f)fig=f;sessao.set(c);PEND=null;show($('#sms'),false);afterAuth();
  }catch(err){errOn('#vErr','Não deu pra salvar sua conta. Tenta de novo.');console.warn(err);}
});
$('#logout').addEventListener('click',()=>{sessao.clear();if(SRV){LS.del('role-auth');NET.forget().catch(()=>{});UID='anon';}ME=null;toast('Você saiu.');openLanding();});
async function afterAuth(){applyFig(false);
  if(PENDING_INVITE){const eid=PENDING_INVITE.eid;try{await acceptInvite(eid);}catch(e){console.warn(e);toast('Não deu pra aceitar o convite: '+(e.msg||'tenta de novo'),4200);openHome();}}
  else openHome();}

/* ---------- início ---------- */
async function openHome(){go('#scrHome');$('#homeName').textContent=ME.nome;$('#homeUser').textContent='@'+ME.usuario;drawHomeAv();
  const box=$('#myRoles');box.innerHTML='<div class="empty">Carregando…</div>';vitrine('churrasco',true);
  try{const mine=(await DB.list(`data/users/${UID}`)).filter(d=>d.id.startsWith('r_'));
    const roles=(await Promise.all(mine.map(async m=>{const r=await DB.get('roles/'+m.data.eid);return r&&{...r,eid:m.data.eid,papel:m.data.papel};}))).filter(Boolean).sort((a,b)=>(b.criado||0)-(a.criado||0));
    const vivos=roles.filter(r=>roomLeft(r)>0);   // sala encerrada some da lista
    const cnt=$('#roomsCount');cnt.hidden=!vivos.length;cnt.textContent=vivos.length+(vivos.length===1?' no ar':' no ar');
    box.innerHTML='';if(!vivos.length){box.innerHTML='<div class="empty">Nenhuma sala ativa agora. Cria uma e chama a galera.</div>';return;}
    vivos.forEach(r=>{const row=document.createElement('div');row.className='rrow';row.style.setProperty('--cc',cartColor(r.cena));
      const c=document.createElement('canvas');c.width=192;c.height=160;sceneThumb(r.cena,r.noite,c);
      const t=document.createElement('div');t.className='rt';const b=document.createElement('b');b.textContent=r.nome;
      const m=document.createElement('div');m.className='rm';const c1=document.createElement('span');c1.className='chip live';c1.textContent=leftTxt(r);const c2=document.createElement('span');c2.className='chip';c2.textContent=r.papel==='dono'?'Você criou':'Você foi chamado';m.append(c1,c2);t.append(b,m);
      const bar=document.createElement('div');bar.className='ra';const lk=document.createElement('button');lk.className='px icon';lk.setAttribute('aria-label','Copiar link do convite');setBtn(lk,'link');lk.addEventListener('click',()=>copyText(inviteLink(r.eid),lk));
      const en=document.createElement('button');en.className='px hot';en.textContent='Entrar';en.addEventListener('click',()=>enterRoom(r.eid));bar.append(en,lk);
      row.append(c,t,bar);box.append(row);});
  }catch(e){box.innerHTML='<div class="empty">Não deu pra carregar seus rolês.</div>';console.warn(e);}}
function drawHomeAv(){const g=$('#homeAv').getContext('2d');g.clearRect(0,0,112,236);const sp=getSprite(fig,'f',IDLE);g.drawImage(sp,0,-22);}
$('#homeWard').addEventListener('click',()=>setWard(true));
$('#newRole').addEventListener('click',()=>openCreate());

/* ---------- criar rolê ---------- */
let draft=null,cstep=1;
function openCreate(){
  draft={nome:'',cena:'churrasco',noite:true};
  $('#cNome').value='';errOn('#c1Err');cStep(1);go('#scrCreate');}
function cStep(n){cstep=n;show($('#c1'),n===1);show($('#c2'),n===2);show($('#c3'),n===3);$('#cStepLbl').textContent=n+' de 3';
  document.querySelectorAll('.steps i').forEach((i,k)=>i.classList.toggle('on',k<n));$('#createCard').classList.toggle('wide',n===2);
  show($('#cBack'),n!==3);if(n===2)renderSceneGrid();vitrine('churrasco',true);}
$('#cBack').addEventListener('click',()=>{if(cstep===2)cStep(1);else openHome();});
$('#c1').addEventListener('submit',e=>{e.preventDefault();draft.nome=$('#cNome').value.trim();
  if(draft.nome.length<2)return errOn('#c1Err','Dá um nome pro rolê.');errOn('#c1Err');cStep(2);});
document.querySelectorAll('#c2 [data-n]').forEach(b=>b.addEventListener('click',()=>{draft.noite=b.dataset.n==='1';renderSceneGrid();}));
function renderSceneGrid(){document.querySelectorAll('#c2 [data-n]').forEach(b=>b.setAttribute('aria-checked',String((b.dataset.n==='1')===draft.noite)));
  const g=$('#sceneGrid');g.innerHTML='';SCENES.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='scn';b.setAttribute('role','radio');b.setAttribute('aria-checked',String(s.id===draft.cena));
    b.style.setProperty('--cc',cartColor(s.id));const lab=document.createElement('span');lab.className='label';const c=document.createElement('canvas');c.width=240;c.height=200;const t=document.createElement('b');t.textContent=s.nome;const d=document.createElement('span');d.textContent=s.desc;lab.append(c,t,d);b.append(lab);
    b.addEventListener('click',()=>{draft.cena=s.id;g.querySelectorAll('.scn').forEach(x=>x.setAttribute('aria-checked',String(x===b)));scenePrev();});g.append(b);
    setTimeout(()=>sceneThumb(s.id,draft.noite,c),0);});
  scenePrev();}
function scenePrev(){const s=SCENES.find(x=>x.id===draft.cena)||SCENES[0];$('#spName').textContent=s.nome;$('#spDesc').textContent=s.desc;setTimeout(()=>sceneThumb(s.id,draft.noite,$('#spCv')),0);}
$('#c2Next').addEventListener('click',async()=>{const btn=$('#c2Next');btn.disabled=true;
  try{const eid=genId(10),r={nome:draft.nome,cena:draft.cena,noite:draft.noite,dono:ME.usuario,donoNome:ME.nome,criado:Date.now()};
    await DB.set('roles/'+eid,r);await DB.set(`roles/${eid}/gente/${ME.usuario}`,{nome:ME.nome,at:Date.now(),papel:'dono'});await DB.set(`data/users/${UID}/r_${eid}`,{eid,papel:'dono',at:Date.now()});
    draft.eid=eid;$('#c3Link').value=inviteLink(eid);chipsFor($('#c3Meta'),r);cStep(3);
  }catch(e){toast('Não deu pra criar o rolê. Tenta de novo.');console.warn(e);}btn.disabled=false;});
$('#c3Copy').addEventListener('click',()=>copyText($('#c3Link').value,$('#c3Copy')));
$('#c3Link').addEventListener('focus',e=>e.target.select());
$('#c3Enter').addEventListener('click',()=>enterRoom(draft.eid));

/* ---------- convite ---------- */
async function openInvite(eid){go('#scrInvite');errOn('#invErr');$('#invName').textContent='…';$('#invMeta').innerHTML='';$('#invBy').textContent='';show($('#invAccept'));
  let r=null;try{r=await DB.get('roles/'+eid);}catch(e){}
  if(!r){$('#invName').textContent='Convite não encontrado';errOn('#invErr','Esse link não leva a nenhum rolê. Confere com quem te mandou.');show($('#invAccept'),false);LS.del('role-convite');PENDING_INVITE=null;vitrine('parque',true);return;}
  $('#invName').textContent=r.nome;chipsFor($('#invMeta'),r);PENDING_INVITE={eid,nome:r.nome,cena:r.cena,noite:r.noite};
  if(roomLeft(r)<=0||r.status==='encerrado'){errOn('#invErr','Esse rolê já encerrou (as salas duram 8 horas). Pede pra quem te chamou criar outro.');show($('#invAccept'),false);}
  let n=0;try{n=(await DB.list(`roles/${eid}/gente`)).length;}catch(e){}
  $('#invBy').textContent=`${r.donoNome||'@'+r.dono} te chamou.`+(n>1?` ${n} pessoas já confirmaram.`:'');$('#invCart').style.setProperty('--cc',cartColor(r.cena));
  sceneThumb(r.cena,r.noite,$('#invThumb'));vitrine(r.cena,r.noite);
  PENDING_INVITE={eid,nome:r.nome,cena:r.cena,noite:r.noite};}
$('#invAccept').addEventListener('click',async()=>{if(!PENDING_INVITE)return;LS.set('role-convite',PENDING_INVITE);
  if(ME){try{await acceptInvite(PENDING_INVITE.eid);}catch(e){errOn('#invErr',e.msg||'Não deu pra entrar agora.');}}else openAuth();});
$('#invLater').addEventListener('click',()=>{LS.del('role-convite');PENDING_INVITE=null;clearHash();ME?openHome():openAuth();});
async function acceptInvite(eid){
  try{await DB.set(`roles/${eid}/gente/${ME.usuario}`,{nome:ME.nome,at:Date.now(),papel:'convidado'});
    const mine=await DB.get(`data/users/${UID}/r_${eid}`);if(!mine)await DB.set(`data/users/${UID}/r_${eid}`,{eid,papel:'convidado',at:Date.now()});}
  catch(e){const err=new Error('write');err.msg=e&&e.code==='cheia'?'Esse rolê já tem 8 pessoas, que é o máximo.':e&&e.code==='closed'?'Esse rolê já encerrou (as salas duram 8 horas).':(e&&(e.code==='not_granted'||e.code==='not_permitted'))?'Seu acesso a esse link é só de leitura. Pede pra quem te chamou te dar acesso de colaborador.':'Não deu pra salvar o convite.';throw err;}
  LS.del('role-convite');PENDING_INVITE=null;clearHash();await enterRoom(eid,true);}
function clearHash(){try{if(location.hash||/^\/r\//.test(location.pathname))history.replaceState(null,'',(/^\/r\//.test(location.pathname)?'/':location.pathname)+location.search);}catch(e){}}

/* ---------- sala ---------- */
let unsubRole=null,unsubChat=null,live=null,me=null,joinedAt=0,lastPres='',chatSeen=new Set();
const peerAvs=new Map();
function playInsert(r){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const o=document.createElement('div');o.className='insert';o.style.setProperty('--cc',cartColor(r.cena));
  o.innerHTML='<div class="flash"></div><div class="slot"></div><div class="ct"><i></i></div>';o.querySelector('i').textContent=r.nome;frame.append(o);setTimeout(()=>o.remove(),900);}
async function enterRoom(eid,fresh){
  let r=null;try{r=await DB.get('roles/'+eid);}catch(e){}
  if(!r){toast('Rolê não encontrado.');return openHome();}
  if(roomLeft(r)<=0){toast('Esse rolê já encerrou: as salas duram 8 horas.',4200);return openHome();}
  playInsert(r);CUR={eid,...r};mode='sala';go('room');setTime(r.noite);setWard(false);zoom=frame.clientWidth<700?.5:1;resize();updZoomBtns();
  avatars=[];peerAvs.clear();SCN=getScene(r.cena,r.noite);MUSIC.scene(r.cena);
  const[sx,sy]=spawnTile();me=makeAv(ME.nome,{...fig},sx,sy,{user:ME.usuario});npcSpawn();
  $('#rName').textContent=r.nome;roomClock();updDayBtn();
  $('#log').innerHTML='';chatSeen=new Set();joinedAt=Date.now();centerOn(...S(sx+.5,sy+.5).map((v,i)=>i?v-50:v));
  addLog(null,fresh?`Você entrou em ${r.nome}. Bem-vindo!`:`Você está em ${r.nome}.`);spawnPets(eid);if(SCN.mixer)addLog(null,`Toca na mesa de som (ou no botão Som) pra soltar o ${MUSIC.name()}. Tem ${pets.map(p=>p.name).join(' e ')} passeando por aí.`);updSom();
  unsubRole=DB.watchDoc('roles/'+eid,d=>{if(!d||mode!=='sala')return;const ch=d.cena!==CUR.cena||!!d.noite!==!!CUR.noite;CUR={eid,...d};if(ch){SCN=getScene(d.cena,d.noite);setTime(d.noite);updDayBtn();avatars.forEach(a=>{if(!walkable(a.gx,a.gy,a.gx,a.gy)){const[x,y]=freeNear(a.gx,a.gy,a);a.gx=a.fx=x;a.gy=a.fy=y;a.path=[];}});}});
  unsubChat=DB.watchColl(`roles/${eid}/chat`,list=>{list.forEach(({id,data:m})=>{if(chatSeen.has(id))return;chatSeen.add(id);
      if(m.k==='bot'){fmBotFromChat(id,m,m.at>=joinedAt-2000);return;}   // Rolê FM
      const a=avatars.find(v=>v.user===m.u);addLog(m.n||m.u,m.t,a?logColor(a):'#ffb347');if(a&&m.at>=joinedAt-2000)a.bubble={text:m.t,t:now};});},{order:'at',limit:60});
  // presença ao vivo
  try{live=ROOMCAP?await ROOMCAP.join('role-'+eid):LocalRoom('role-'+eid);}catch(e){if(e&&e.code==='full')return salaCheia();console.warn('room',e);live=LocalRoom('role-'+eid);}
  if(mode!=='sala'||!CUR||CUR.eid!==eid){live&&live.leave();return;}
  live.onPeers(ch=>syncPeers(ch.peers));setupVoz(eid);gamesSetup();fmSetup(eid);let wasDown=false;live.onStatus&&live.onStatus(st=>{if(st==='down'&&!wasDown){wasDown=true;toast('Sem conexão com a sala ao vivo. Reconectando…',4500);}else if(st==='up'&&wasDown){wasDown=false;toast('Reconectado.');}});pushPres(true);live.start&&live.start();syncPeers(live.peers());
  /* nasceu em cima de alguém que já estava aqui (com o visual padrão parece um boneco só): sai do lugar */
  {const o=avatars.find(v=>v!==me&&Math.round(v.gx)===me.gx&&Math.round(v.gy)===me.gy);if(o){const[x,y]=freeNear(me.gx,me.gy,me);me.gx=me.fx=x;me.gy=me.fy=y;me.path=[];pushPres(true);}}
  setTimeout(()=>{if(mode==='sala'&&avatars.filter(a=>!a.bot).length===1)addLog(null,'Só você por aqui por enquanto. Toca em “Convidar” e manda o link pra galera.');},2500);
}
function salaCheia(){if(live){try{live.leave()}catch(e){}live=null;}toast('Essa sala tá cheia agora. Tenta de novo daqui a pouco.',4200);openHome();}
function spawnTile(){const[x0,y0]=SCN.sc.spawn;for(let i=0;i<60;i++){const x=x0+ri(5)-2,y=y0+ri(5)-2;if(walkable(x,y,-1,-1)&&!occupied(x,y,null))return[x,y];}return freeNear(x0,y0,null);}
let roomTimer=0,roomWarn=0;
/* o relógio da sala: mostra quanto falta e, no fim das 8 h, manda todo mundo para o início */
function roomClock(){clearInterval(roomTimer);roomWarn=0;const tick=()=>{if(mode!=='sala'||!CUR){clearInterval(roomTimer);return;}
    const ms=roomLeft(CUR);$('#rWhen').textContent=leftTxt(CUR);
    if(ms<=0){clearInterval(roomTimer);toast('O rolê acabou: as salas duram 8 horas. Cria outro quando quiser!',5200);leaveRoom();return openHome();}
    if(ms<=5*60e3&&roomWarn<2){roomWarn=2;addLog(null,'Faltam 5 minutos pro rolê acabar.');}else if(ms<=15*60e3&&roomWarn<1){roomWarn=1;addLog(null,'Faltam 15 minutos pro rolê acabar.');}};
  tick();roomTimer=setInterval(tick,10000);}
function leaveRoom(){clearInterval(roomTimer);frame.classList.remove('chaton','more');vozStop();gamesStop();fmStop();mode='vitrine';MUSIC.stop();updSom&&updSom();unsubRole&&unsubRole();unsubChat&&unsubChat();unsubRole=unsubChat=null;if(live){try{live.leave()}catch(e){}live=null;}avatars=[];peerAvs.clear();me=null;CUR=null;vitrine.k=null;seedBots();}
function presObj(){const t=me.path.length?me.path[me.path.length-1]:[me.gx,me.gy];return{u:ME.usuario,n:ME.nome,j:joinedAt,f:encode(me.fig),x:t[0],y:t[1],a:me.action||'',b:me.back?1:0,m:me.mirror?1:0};}
function pushPres(force){if(!live||!me)return;const p=presObj(),s=JSON.stringify(p);if(!force&&s===lastPres)return;lastPres=s;live.presence(p).catch(e=>console.warn(e));}
function syncPeers(peers){if(mode!=='sala')return;const seen=new Set();
  /* lotação: quem chegou depois da 50ª pessoa volta pro início (só aparece quando acontece) */
  if(peers.filter(p=>!p.isMe&&(+(p.presence||{}).j||0)>0&&+p.presence.j<joinedAt).length>=MAX_SALA)return salaCheia();
  for(const p of peers){if(p.isMe)continue;const pr=p.presence||{};if(!pr.u||typeof pr.u!=='string')continue;seen.add(p.peer);
    const f=parse(String(pr.f||''))||DEFAULT;const name=String(pr.n||pr.u).slice(0,24);let a=peerAvs.get(p.peer);
    const tx=Math.max(0,Math.min(GW-1,pr.x|0)),ty=Math.max(0,Math.min(GH-1,pr.y|0));
    if(!a){const[x,y]=walkable(tx,ty,tx,ty)?[tx,ty]:freeNear(tx,ty,null);a=makeAv(name,f,x,y,{peer:p.peer,user:pr.u});peerAvs.set(p.peer,a);
      if(pr.a==='sit')sit(a);else a.action=pr.a||null;a.back=!!pr.b;a.mirror=!!pr.m;if(pr.a==='sit'){a.back=!!pr.b;a.mirror=!!pr.m;}
      if(now>3000)addLog(null,name+' chegou no rolê.');continue;}
    a.name=name;a.fig=f;a.user=pr.u;
    const dest=a.path.length?a.path[a.path.length-1]:[a.gx,a.gy];
    if(dest[0]!==tx||dest[1]!==ty){if(!walkTo(a,tx,ty)){a.gx=a.fx=tx;a.gy=a.fy=ty;a.path=[];}if(pr.a)a.onArrive=()=>applyPeerAct(a,pr);}
    else if(!a.path.length)applyPeerAct(a,pr);}
  for(const[peer,a]of[...peerAvs]){if(!seen.has(peer)){peerAvs.delete(peer);avatars=avatars.filter(v=>v!==a);addLog(null,a.name+' saiu.');}}
  $('#count').textContent=avatars.filter(a=>!a.bot).length+' na sala';}
function applyPeerAct(a,pr){if(pr.a==='sit'){sit(a);a.back=!!pr.b;a.mirror=!!pr.m;}else if(pr.a==='dance')a.action='dance';else if(pr.a==='wave'){a.action='wave';a.actionUntil=now+2500;}else{if(a.action==='sit'||a.action==='dance')a.action=null;a.back=!!pr.b;a.mirror=!!pr.m;}}
function updDayBtn(){const b=$('#rDay');const own=CUR&&ME&&CUR.dono===ME.usuario;show(b,!!own);setBtn(b,CUR&&CUR.noite?'sun':'moon',CUR&&CUR.noite?'Dia':'Noite');b.setAttribute('aria-label',CUR&&CUR.noite?'Mudar pra dia':'Mudar pra noite');}
$('#rDay').addEventListener('click',async()=>{if(!CUR)return;try{await DB.update('roles/'+CUR.eid,{noite:!CUR.noite});}catch(e){toast('Não deu pra mudar agora.');}});
$('#rInvite').addEventListener('click',()=>{if(CUR)copyText(inviteLink(CUR.eid),$('#rInvite'));});
$('#rHome').addEventListener('click',()=>openHome());

const log=$('#log');
function addLog(name,text,color){const d=document.createElement('div');
  if(name){const b=document.createElement('b');b.textContent=name+': ';b.style.color=color;d.append(b,document.createTextNode(text));}else{d.className='sys';d.textContent=text;}
  log.append(d);while(log.children.length>(innerWidth<760?3:4))log.firstChild.remove();log.scrollTop=log.scrollHeight;}
const logColor=a=>{const c=topColor(a.fig);return lum(c)<.32?'#5a2fc4':lum(c)>.55?mul(c,.45):mul(c,.7)};
function doAct(act){if(!me)return;
  if(act==='dance'){me.path=[];me.action='dance';}
  else if(act==='wave'){if(me.action!=='sit'){me.action='wave';me.actionUntil=now+2500;}}
  else if(act==='sit'){sit(me);}
  else me.action=null;pushPres();}
document.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>doAct(b.dataset.act)));
$('#chatForm').addEventListener('submit',async e=>{e.preventDefault();const t=$('#msg').value.trim();if(!t||!CUR)return;$('#msg').value='';const c=t.toLowerCase();
  if(t[0]==='/'){fmHint('');fmCommand(t);return;}   // comandos do Rolê FM
  if([':dançar',':dancar'].includes(c))return doAct('dance');if(c===':acenar')return doAct('wave');if(c===':sentar')return doAct('sit');if(c===':levantar')return doAct('stop');
  me.bubble={text:t,t:now};
  try{await DB.add(`roles/${CUR.eid}/chat`,{u:ME.usuario,n:ME.nome,t,at:Date.now()});}
  catch(err){addLog(ME.nome,t,logColor(me));addLog(null,'Sua mensagem não foi salva (acesso só de leitura?).');}});

/* ================= câmera e tela ================= */
const frame=$('#frame'),cv=$('#room'),sc=cv.getContext('2d');
let zoom=1,dpr=1,scale=2,bs=1,camX=0,camY=0;
const vw=()=>cv.width/scale,vh=()=>cv.height/scale;
function clampCam(){const w=vw(),h=vh();camX=Math.max(-w*.5,Math.min(WW-w*.5,camX));camY=Math.max(-h*.5,Math.min(WHt-h*.5,camY));}
function centerOn(x,y){camX=x-vw()/2;camY=y-vh()/2;clampCam();}
function vitrineCam(){const wide=frame.clientWidth>760,shift=wide?Math.min(260,vw()*.22):0;centerOn(WW/2-shift,WHt/2+(wide?50:150));}
function resize(){const cx=camX+vw()/2,cy=camY+vh()/2,firstTime=!resize.done;dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.max(1,Math.round(frame.clientWidth*dpr));cv.height=Math.max(1,Math.round(frame.clientHeight*dpr));
  bs=zoom<1?(mode==='sala'?.5:.42)*Math.max(1,Math.round(dpr)):Math.max(1,Math.round(dpr*zoom));scale=WS*bs;resize.done=true;
  if(firstTime||mode!=='sala')vitrineCam();else centerOn(cx,cy);}
new ResizeObserver(resize).observe(frame);
$('#zIn').addEventListener('click',()=>zoomAt(1));
$('#zOut').addEventListener('click',()=>zoomAt(-1));
const ZL=[.5,1,2];
function zoomAt(dir,cx,cy){if(mode!=='sala')return;let i=ZL.indexOf(zoom);if(i<0)i=1;const ni=Math.max(0,Math.min(ZL.length-1,i+dir));if(ni===i)return;
  const r=cv.getBoundingClientRect();if(cx==null){cx=r.left+r.width/2;cy=r.top+r.height/2;}const px=(cx-r.left)*dpr,py=(cy-r.top)*dpr,wx=camX+px/scale,wy=camY+py/scale;
  zoom=ZL[ni];resize();camX=wx-px/scale;camY=wy-py/scale;clampCam();updZoomBtns();}
function updZoomBtns(){$('#zIn').disabled=zoom>=ZL[ZL.length-1];$('#zOut').disabled=zoom<=ZL[0];}
const toScreen=(wx,wy)=>[(wx*scale-Math.round(camX*scale))/dpr,(wy*scale-Math.round(camY*scale))/dpr];
function vitrine(id,n){if(mode==='sala')return;zoom=.5;const k=id+(n?'N':'D');if(vitrine.k!==k){vitrine.k=k;setScene(id,n);}resize();}

/* ================= céu: atmosfera, sol/lua, nuvens cúmulo em pixel e estrelas ================= */
const stars=[];{const r=rng(99);for(let i=0;i<340;i++){const t=r();stars.push([r(),r(),t<.05?3:t<.22?2:1,r()*6,['#ffffff','#fff1d6','#d6e4ff','#ffd9e8','#ffffff'][Math.floor(r()*5)]]);}}
const BAYER=[[0,2],[3,1]];
function makeCloud(seed,w,h,night){const r=rng(seed),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  const base=h*.8,blobs=[],n=5+Math.floor(r()*4);
  for(let i=0;i<n;i++){const t=i/(n-1),rad=h*(.2+.26*Math.sin(Math.PI*(.15+.7*t))*(.75+r()*.45));blobs.push([w*(.16+.68*t)+(r()-.5)*w*.05,base-rad*.5,rad]);}
  for(let i=0;i<2+Math.floor(r()*2);i++){const t=.3+r()*.4,rad=h*(.2+r()*.1);blobs.push([w*t,base-h*.42-r()*h*.08,rad]);}
  const P=night?['#9aa0c8','#7b80ab','#5d6290','#474b78']:['#ffffff','#f3f7fb','#dbe5ef','#bdcbdb'];
  const img=g.createImageData(w,h),d=img.data,rgb=P.map(hx);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(y>base)continue;let best=null,bk=-1;
    for(const b of blobs){const dx=x+.5-b[0],dy=y+.5-b[1],k=1-Math.hypot(dx,dy)/b[2];if(k>bk){bk=k;best=b;}}
    if(bk<0)continue;const dy=(y+.5-best[1])/best[2],dx=(x+.5-best[0])/best[2];
    let L=.62-dy*.55-dx*.18-(y/base)*.35+Math.min(.25,bk*.4);L+=(BAYER[y&1][x&1]-1.5)*.025;
    const ti=L>.62?0:L>.36?1:L>.12?2:3,o=(y*w+x)*4;d[o]=rgb[ti][0];d[o+1]=rgb[ti][1];d[o+2]=rgb[ti][2];d[o+3]=255;}
  g.putImageData(img,0,0);return c;}
const CLOUDS={day:null,night:null};
function cloudSet(night){const k=night?'night':'day';if(CLOUDS[k])return CLOUDS[k];const r=rng(night?41:17),L=[];
  for(let i=0;i<(night?4:7);i++)L.push({c:makeCloud(100+i,40+Math.floor(r()*26),16+Math.floor(r()*6),night),x:r(),y:.04+r()*.2,s:2,v:.35+r()*.2,a:night?.35:.62,p:.04});
  for(let i=0;i<(night?3:6);i++)L.push({c:makeCloud(200+i,80+Math.floor(r()*50),30+Math.floor(r()*10),night),x:r(),y:.1+r()*.26,s:3,v:.8+r()*.4,a:night?.42:.96,p:.09});
  return CLOUDS[k]=L;}
function pixDisc(cx,cy,R,s,col){sc.fillStyle=col;for(let j=-R;j<=R;j++){const w=Math.floor(Math.sqrt(R*R-j*j)+.35);sc.fillRect(Math.round(cx-w*s),Math.round(cy+j*s),w*2*s,s);}}
let skyCache=null,mwCanvas=null;
function milkyWay(){if(mwCanvas)return mwCanvas;const r=rng(7),c=document.createElement('canvas');c.width=200;c.height=60;const g=c.getContext('2d');
  for(let i=0;i<900;i++){const x=r()*200,t=(r()+r()+r())/3,y=30+(t-.5)*56,a=.05+r()*.12;g.fillStyle=`rgba(${200+r()*55|0},${190+r()*50|0},255,${a})`;g.fillRect(x|0,y|0,1+(r()*3|0),1+(r()*2|0));}
  return mwCanvas=c;}
function skyBase(W,H,day,out,skc,sun){const k=[W,H,day,out,skc&&skc.join(),sun].join('|');if(skyCache&&skyCache.k===k)return skyCache.c;
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,H);
  if(skc){gr.addColorStop(0,skc[0]);gr.addColorStop(1,skc[1]);}
  else if(day&&out){gr.addColorStop(0,'#2f7fd0');gr.addColorStop(.45,'#69aee6');gr.addColorStop(.8,'#b8dcf2');gr.addColorStop(1,'#f3e9d6');}
  else if(!day&&out){gr.addColorStop(0,'#05081c');gr.addColorStop(.5,'#0f1538');gr.addColorStop(.85,'#26204e');gr.addColorStop(1,'#3d2c56');}
  else if(day){gr.addColorStop(0,'#34322e');gr.addColorStop(1,'#22211f');}
  else{gr.addColorStop(0,'#232220');gr.addColorStop(.55,'#1c1b1a');gr.addColorStop(1,'#151514');}
  g.fillStyle=gr;g.fillRect(0,0,W,H);
  if(out){const hz=g.createLinearGradient(0,H*.55,0,H);hz.addColorStop(0,'rgba(255,255,255,0)');hz.addColorStop(1,day?'rgba(255,236,205,.35)':'rgba(120,80,140,.22)');g.fillStyle=hz;g.fillRect(0,H*.55,W,H*.45);}
  skyCache={k,c};return c;}
let shoot=null;
function sky(){
  const W=cv.width,H=cv.height,day=SCN&&!SCN.night,out=SCN&&SCN.sc.outdoor,skc=SCN&&SCN.sc.sky&&(day?SCN.sc.sky.day:SCN.sc.sky.night);
  const px=Math.max(1,Math.round(dpr)),pxX=-camX*scale,pxY=-camY*scale;
  sc.drawImage(skyBase(W,H,day,out,skc,0),0,0);
  if(out&&day){const sx=W*.8+pxX*.03,sy=H*.13+pxY*.03,R=Math.min(W,H)*.32,h=sc.createRadialGradient(sx,sy,0,sx,sy,R);
    h.addColorStop(0,'rgba(255,250,225,.75)');h.addColorStop(.18,'rgba(255,240,200,.35)');h.addColorStop(1,'rgba(255,240,200,0)');sc.fillStyle=h;sc.fillRect(sx-R,sy-R,R*2,R*2);pixDisc(sx,sy,7,2*px,'#fffbea');}
  if(out&&!day){const mw=milkyWay();sc.save();sc.globalAlpha=.4;sc.translate(W*.5+pxX*.05,H*.32+pxY*.05);sc.rotate(-.42);sc.imageSmoothingEnabled=true;sc.drawImage(mw,-W*.75,-H*.16,W*1.5,H*.32);sc.restore();
    stars.forEach(([x,y,s,ph,col])=>{const X=((x*W*1.6+pxX*.12)%W+W)%W,Y=((y*H*1.3+pxY*.12)%H+H)%H;if(Y>H*.85)return;
      sc.globalAlpha=RM?.75:Math.max(.15,.5+.45*Math.sin(now/(700+ph*160)+ph*7));sc.fillStyle=col;const q=s*px;sc.fillRect(Math.round(X),Math.round(Y),q,q);
      if(s===3&&!RM){sc.globalAlpha*=.5;sc.fillRect(Math.round(X)-q,Math.round(Y)+q/3|0,q*3,Math.max(1,q/3|0));sc.fillRect(Math.round(X)+q/3|0,Math.round(Y)-q,Math.max(1,q/3|0),q*3);}});
    sc.globalAlpha=1;
    const mx=W*.18+pxX*.03,my=H*.14+pxY*.03,R=Math.min(W,H)*.2,h=sc.createRadialGradient(mx,my,0,mx,my,R);h.addColorStop(0,'rgba(220,225,255,.35)');h.addColorStop(1,'rgba(220,225,255,0)');sc.fillStyle=h;sc.fillRect(mx-R,my-R,R*2,R*2);
    const s=2*px;pixDisc(mx,my,8,s,'#f2efe2');sc.fillStyle='#d8d2bd';[[-3,-2,2],[2,1,3],[-1,4,1],[4,-4,1]].forEach(([a,b,w])=>sc.fillRect(Math.round(mx+a*s),Math.round(my+b*s),w*s,w*s));
    if(!RM){if(!shoot&&Math.random()<.0025)shoot={x:Math.random()*W*.8+W*.1,y:Math.random()*H*.3,t:now};
      if(shoot){const k=(now-shoot.t)/700;if(k>1)shoot=null;else{const x=shoot.x+k*W*.18,y=shoot.y+k*H*.08,gr=sc.createLinearGradient(x,y,x-W*.08,y-H*.035);gr.addColorStop(0,`rgba(255,255,255,${1-k})`);gr.addColorStop(1,'rgba(255,255,255,0)');sc.strokeStyle=gr;sc.lineWidth=px*1.5;sc.beginPath();sc.moveTo(x,y);sc.lineTo(x-W*.08,y-H*.035);sc.stroke();}}}}
  if(out){sc.imageSmoothingEnabled=false;cloudSet(!day).forEach(cl=>{const s=cl.s*px,w=cl.c.width*s,span=W+w*2,X=((cl.x*span+now*.004*cl.v*px+pxX*cl.p)%span+span)%span-w,Y=cl.y*H+pxY*cl.p*.6;
    sc.globalAlpha=cl.a*(skc?.8:1);sc.drawImage(cl.c,Math.round(X),Math.round(Y),w,cl.c.height*s);});sc.globalAlpha=1;}
  if(SCN&&SCN.sc.backdrop)bdDraw(SCN.sc.backdrop,W,H,pxX,pxY,day,px);   // cidade lá fora (parallax)
  fmSky();
  if(!out){const cx=(WW/2-camX)*scale,cy=(WHt/2-camY)*scale,n1=sc.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*.65);
    n1.addColorStop(0,day?'rgba(255,248,225,.18)':'rgba(255,236,200,.07)');n1.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=n1;sc.fillRect(0,0,W,H);}
}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function bubble(a){
  if(!a.bubble)return;const age=now-a.bubble.t;if(age>6500){a.bubble=null;return;}
  const[x0,y0]=toScreen(a.sx,headWorld(a));
  sc.globalAlpha=age>5900?(6500-age)/600:1;
  sc.font='800 12px "Atkinson Hyperlegible Next", system-ui, sans-serif';const lab=a.name+': ',lw=sc.measureText(lab).width;
  sc.font='400 12px "Atkinson Hyperlegible Next", system-ui, sans-serif';let t=a.bubble.text;if(t.length>48)t=t.slice(0,47)+'…';const tw=sc.measureText(t).width;
  const fw=frame.clientWidth,w=lw+tw+20,h=24,x=Math.max(6,Math.min(fw-w-6,x0-w/2)),y=y0-h-10;
  sc.fillStyle='#f6f2ff';sc.strokeStyle='#1c1428';sc.lineWidth=2;rr(sc,x,y,w,h,7);sc.fill();sc.stroke();
  sc.beginPath();sc.moveTo(x0-5,y+h-1);sc.lineTo(x0,y+h+6);sc.lineTo(x0+5,y+h-1);sc.fill();sc.beginPath();sc.moveTo(x0-5,y+h);sc.lineTo(x0,y+h+6);sc.lineTo(x0+5,y+h);sc.stroke();
  sc.textBaseline='middle';sc.font='800 12px "Atkinson Hyperlegible Next", system-ui, sans-serif';sc.fillStyle=lum(topColor(a.fig))<.32?'#6a4fd0':dk(topColor(a.fig));sc.fillText(lab,x+10,y+h/2+1);
  sc.font='400 12px "Atkinson Hyperlegible Next", system-ui, sans-serif';sc.fillStyle='#1c1428';sc.fillText(t,x+10+lw,y+h/2+1);sc.globalAlpha=1;
}
function petBubble(p){if(!p.bubble)return;const age=now-p.bubble.t;if(age>2200){p.bubble=null;return;}const[x,y]=toScreen(p.sx,p.sy-p.head-4);sc.font='700 11px Anybody, sans-serif';const t=p.name+': '+p.bubble.text,w=sc.measureText(t).width+12;
  sc.globalAlpha=age>1800?(2200-age)/400:1;sc.fillStyle='rgba(255,250,240,.95)';rr(sc,x-w/2,y-20,w,17,5);sc.fill();sc.fillStyle='#2a2026';sc.textBaseline='middle';sc.fillText(t,x-w/2+6,y-11);sc.globalAlpha=1;}
function tag(a,mine){const[x,y]=toScreen(a.sx,headWorld(a));sc.font='700 11px Anybody, sans-serif';const w=sc.measureText(a.name).width+12;
  sc.fillStyle='rgba(16,15,14,.85)';rr(sc,x-w/2,y-18,w,17,4);sc.fill();sc.fillStyle=mine?'#43d9e8':'#ffb347';sc.textBaseline='middle';sc.fillText(a.name,x-w/2+6,y-9);}

/* ---- entrada ---- */
let hover=null,hoverAv=null,drag=null;
const toWorld=e=>{const r=cv.getBoundingClientRect();return[camX+(e.clientX-r.left)*dpr/scale,camY+(e.clientY-r.top)*dpr/scale];};
const tileAt=(x,y)=>{const u=(x-ox)/TW,v=(y-oy)/TH;return[Math.floor((u+v)/2),Math.floor((v-u)/2)];};
const avAt=(x,y)=>[...avatars].filter(a=>!a.bot).sort((a,b)=>(b.fx+b.fy)-(a.fx+a.fy)).find(a=>x>a.sx-9&&x<a.sx+9&&y>headWorld(a)&&y<a.sy+3)||null;
/* toque: 1 dedo arrasta/anda, 2 dedos fazem pinça (zoom); mouse: roda dá zoom no ponto do cursor */
const pts=new Map();let pinch=null,wAcc=0,wLock=0;
const pDist=()=>{const[a,b]=[...pts.values()];return Math.hypot(a.x-b.x,a.y-b.y);},pMid=()=>{const[a,b]=[...pts.values()];return[(a.x+b.x)/2,(a.y+b.y)/2];};
cv.addEventListener('wheel',e=>{if(mode!=='sala')return;e.preventDefault();if(performance.now()<wLock)return;
  wAcc+=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1);const th=e.ctrlKey?18:60;
  if(Math.abs(wAcc)>=th){zoomAt(wAcc<0?1:-1,e.clientX,e.clientY);wAcc=0;wLock=performance.now()+220;}},{passive:false});
cv.addEventListener('pointerdown',e=>{if(mode!=='sala')return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2){pinch={d:pDist()};drag=null;cv.classList.remove('grab');return;}
  if(pts.size>2)return;drag={x:e.clientX,y:e.clientY,cx:camX,cy:camY,moved:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}});
const dropPt=e=>{pts.delete(e.pointerId);};
cv.addEventListener('pointercancel',e=>{dropPt(e);if(!pts.size)pinch=null;drag=null;cv.classList.remove('grab');});
cv.addEventListener('pointermove',e=>{if(mode!=='sala')return;if(pts.has(e.pointerId))pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&pts.size===2){const d=pDist(),k=d/pinch.d;if(k>1.3||k<.77){const[mx,my]=pMid();zoomAt(k>1?1:-1,mx,my);pinch.d=d;}return;}
  const[x,y]=toWorld(e);hover=tileAt(x,y);hoverAv=avAt(x,y);
  if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)>6){drag.moved=true;cv.classList.add('grab');}
    if(drag.moved){camX=drag.cx-dx*dpr/scale;camY=drag.cy-dy*dpr/scale;clampCam();}}});
cv.addEventListener('pointerup',e=>{const wasPinch=!!pinch;dropPt(e);if(!pts.size)pinch=null;const d=drag;drag=null;cv.classList.remove('grab');if(wasPinch||!d||d.moved||!me)return;
  if(me.burnUntil>now)return;   // queimando na lava: 1,5 s parado
  const[x,y]=toWorld(e),[tx,ty]=tileAt(x,y);const pt=petAt(x,y);
  if(fmHit(e,x,y))return;
  if(pt){pt.heart=now+1400;pt.bubble={text:PET_ART[pt.type].talk,t:now};pt.path=[];return;}
  if(SCN.mixer&&tx===SCN.mixer[0]&&ty===SCN.mixer[1]){toggleSom();const[fx,fy]=freeNear(tx,ty+1,me);if(Math.abs(me.gx-tx)+Math.abs(me.gy-ty)>2)walkTo(me,fx,fy);pushPres();return;}
  if(gClickTile(tx,ty))return;
  if(walkTo(me,tx,ty))pushPres();});
function updSom(){const b=$('#rSom');if(!b)return;b.setAttribute('aria-pressed',String(MUSIC.on));setBtn(b,'note',MUSIC.on?MUSIC.name():'Som');}
function toggleSom(){const on=MUSIC.toggle();updSom();addLog(null,on?`Som ligado: ${MUSIC.name()}.`:'Som desligado.');}
$('#rSom').addEventListener('click',toggleSom);

/* ---------- chat de voz (modo Supabase): áudio direto entre as pessoas, até 8 por vez ---------- */
let voz=null,vozSt={active:false,muted:false,members:[]},vozOff=null,vozPrev=new Set();
function setupVoz(eid){show($('#rVoz'),false);show($('#rMute'),false);vozStop();
  if(!ROOMCAP||!ROOMCAP.voice)return;voz=ROOMCAP.voice(eid);
  vozOff=voz.onChange(st=>{vozSt=st;updVoz();
    if(st.full)toast('A conversa de voz está cheia (8 pessoas). Tenta de novo daqui a pouco.',4200);
    const cur=new Set(st.members.filter(m=>!m.isMe).map(m=>m.user));
    if(st.active){cur.forEach(u=>{if(!vozPrev.has(u))addLog(null,u?'@'+u+' entrou na voz.':'Alguém entrou na voz.');});vozPrev.forEach(u=>{if(!cur.has(u))addLog(null,'@'+u+' saiu da voz.');});}
    vozPrev=st.active?cur:new Set();});
  show($('#rVoz'));updVoz();}
function updVoz(){const b=$('#rVoz'),m=$('#rMute');if(!b)return;
  b.setAttribute('aria-pressed',String(vozSt.active));setBtn(b,'mic',vozSt.active?'Voz · '+vozSt.members.length:'Voz');
  b.setAttribute('aria-label',vozSt.active?'Sair do chat de voz':'Entrar no chat de voz');
  show(m,vozSt.active);m.setAttribute('aria-pressed',String(vozSt.muted));setBtn(m,vozSt.muted?'micoff':'mic','Mudo');
  m.setAttribute('aria-label',vozSt.muted?'Ligar meu microfone':'Silenciar meu microfone');}
function vozStop(){if(vozOff){vozOff();vozOff=null;}if(voz){voz.leave().catch(()=>{});voz=null;}vozSt={active:false,muted:false,members:[]};vozPrev=new Set();}
$('#rVoz').addEventListener('click',async()=>{if(!voz)return;const b=$('#rVoz');
  if(vozSt.active){await voz.leave();addLog(null,'Você saiu da voz.');return;}
  b.disabled=true;
  try{await voz.join(ME.usuario);addLog(null,'Você entrou na voz. Quem estiver na voz te ouve.');}
  catch(e){toast({mic_denied:'Libera o microfone no navegador pra entrar na voz.',mic_none:'Não achei um microfone neste aparelho.',timeout:'Não deu pra conectar a voz agora. Tenta de novo.',rt:'Não deu pra conectar a voz agora. Tenta de novo.'}[e&&e.code]||'Não deu pra entrar na voz.',4200);}
  b.disabled=false;});
$('#rMute').addEventListener('click',()=>{if(voz)voz.setMuted(!vozSt.muted);});
addEventListener('pagehide',()=>{if(voz)voz.leave();});
function speakMark(a){if(!a.user||!vozSt.active)return;const m=vozSt.members.find(x=>x.user===a.user);if(!m||!m.speaking)return;
  const[x0,y0]=toScreen(a.sx,headWorld(a)),t=now/110;
  sc.fillStyle='#8fd42a';sc.strokeStyle='#000';sc.lineWidth=2;rr(sc,x0+12,y0-18,22,16,5);sc.fill();sc.stroke();
  sc.fillStyle='#000';for(let i=0;i<3;i++){const h=RM?7:3+Math.abs(Math.sin(t+i*1.7))*7;sc.fillRect(x0+17+i*5,y0-10-h/2,3,h);}}

cv.addEventListener('pointerleave',()=>{hover=null;hoverAv=null;});

/* ================= guarda-roupa ================= */
let cat='top_under',pdir=0;const DIRS=[[false,false],[false,true],[true,true],[true,false]];
const PW=112,PH=240;
function renderPreview(){const c=$('#preview'),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,PW,PH);
  const[back,mir]=DIRS[pdir],spr=getSprite(fig,back?'b':'f',IDLE);
  if(mir){g.save();g.translate(PW,0);g.scale(-1,1);g.drawImage(spr,0,-22);g.restore();}else g.drawImage(spr,0,-22);}
const TAB_ORDER=['corpo','face','hair','headwear','glasses','neck','top_under','top_over','belt','bottom','shoes','bag'];
const TAB_LABEL={corpo:'Corpo e pele',face:'Expressão',hair:'Cabelo',headwear:'Cabeça',glasses:'Óculos',neck:'Pescoço',top_under:'Blusa',top_over:'Por cima',belt:'Cinto',bottom:'Baixo',shoes:'Calçados',bag:'Bolsa e costas'};
function renderTabs(){const t=$('#tabs');t.innerHTML='';TAB_ORDER.forEach(k=>{const b=document.createElement('button');b.className='ri';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(k===cat));b.setAttribute('aria-label',TAB_LABEL[k]);
  b.innerHTML=pix('s_'+k)+'<span class="tip">'+TAB_LABEL[k]+'</span>';
  b.addEventListener('click',()=>{cat=k;renderTabs();renderStyles();renderColors();});t.append(b);});
  $('#secName').textContent=TAB_LABEL[cat];const n=cat==='corpo'?0:(itensDo(cat).length);$('#secHint').textContent=cat==='corpo'?'':n+' opções';}
const slotNow=()=>cat==='corpo'?SLOTS.find(s=>s.key==='pele'):SLOTS.find(s=>s.key===cat);
const curId=k=>{const v=fig[k];return v==null?null:Array.isArray(v)?v[0]:v;};
function withItem(f,sl,id){const g={...f};if(id===null)g[sl.key]=null;else g[sl.key]=sl.cores?[id,(Array.isArray(f[sl.key])?f[sl.key][1]:null)||'preto']:id;
  if(sl.key==='hair')g.headwear=null;if(sl.key==='face'){g.glasses=null;g.hair=['raspado',(f.hair||['','preto'])[1]];}if(sl.key==='top_under')g.top_over=null;if(sl.key==='top_over'||sl.key==='top_under'){g.neck=null;g.bag=null;}if(sl.key==='belt'){g.top_over=null;}return g;}
let styleJob=0;
function renderStyles(){const box=$('#styles');box.innerHTML='';const sl=slotNow();const has=sl.key!=='pele';box.hidden=!has;$('#bodyPick').hidden=has;if(!has)return;const[cx,cy,cw,ch]=sl.crop,sz=Math.max(cw,ch);
  const opts=[...(sl.vazio?[{id:null,nome:sl.vazio}]:[]),...itensDo(sl.key)];const job=++styleJob;const jobs=[];
  opts.forEach(it=>{const b=document.createElement('button');b.className='opt'+(it.id===null?' none':'');b.setAttribute('aria-pressed',curId(sl.key)===it.id);b.title=it.nome;
    const cvs=document.createElement('canvas');cvs.width=sz;cvs.height=sz;
    jobs.push(()=>{const g=cvs.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(getSprite(withItem(fig,sl,it.id),'f',IDLE),cx,cy,cw,ch,Math.floor((sz-cw)/2),Math.floor((sz-ch)/2),cw,ch);});
    const s=document.createElement('span');s.textContent=it.nome;b.append(cvs,s);b.addEventListener('click',()=>{const prev=fig[sl.key];fig={...fig,[sl.key]:it.id===null?null:sl.cores?[it.id,(Array.isArray(prev)&&prev[1])||(sl.cores==='cabelo'?'preto':'preto')]:it.id};applyFig();});box.append(b);});
  const step=()=>{if(job!==styleJob)return;const t=performance.now();while(jobs.length&&performance.now()-t<24)jobs.shift()();if(jobs.length)setTimeout(step,16);};step();}
function renderColors(){const box=$('#colors');box.innerHTML='';const sl=slotNow();const showC=!!sl.cores&&(sl.key==='pele'||fig[sl.key]!=null);box.parentElement.hidden=!showC;if(!showC)return;
  $('#colLbl').textContent=sl.key==='pele'?'Tom de pele':sl.key==='hair'?'Cor do cabelo':'Cor da peça';
  Object.entries(PAL[sl.cores]).forEach(([nome,col])=>{const b=document.createElement('button');b.className='sw';b.style.background=col;
    const sel=sl.key==='pele'?fig.pele===nome:fig[sl.key][1]===nome;b.setAttribute('aria-pressed',sel);b.setAttribute('aria-label',nome);b.title=nome;
    b.addEventListener('click',()=>{if(sl.key==='pele')fig.pele=nome;else fig[sl.key]=[fig[sl.key][0],nome];applyFig();});box.append(b);});}
let saveT=0;
function saveFig(){LS.set('role-avatar-y2k',{code:encode(fig)});if(!ME)return;clearTimeout(saveT);saveT=setTimeout(async()=>{const code=encode(fig);if(ME.fig===code)return;ME.fig=code;
  try{await DB.update(contaPath(),{fig:code});await DB.update('perfis/'+ME.usuario,{fig:code});}catch(e){console.warn(e);}},900);}
function applyFig(persist=true){document.querySelectorAll('[data-g]').forEach(b=>b.setAttribute('aria-checked',String(+b.dataset.g===fig.g)));$('#peso').value=fig.b;$('#alt').value=fig.alt||0;
  if(me){me.fig={...fig};pushPres();}renderPreview();renderStyles();renderColors();if(ME)drawHomeAv();if(persist)saveFig();}
document.querySelectorAll('[data-g]').forEach(b=>b.addEventListener('click',()=>{const g=+b.dataset.g;if(fig.g!==g){fig.g=g;fig.hair=[g?'longo-liso':'franja-emo',fig.hair?fig.hair[1]:'preto'];
}applyFig();}));
$('#peso').addEventListener('input',e=>{fig.b=+e.target.value;applyFig();});
$('#alt').addEventListener('input',e=>{fig.alt=+e.target.value;applyFig();});
$('#rot').addEventListener('click',()=>{pdir=(pdir+1)%4;renderPreview();});
$('#rnd').addEventListener('click',()=>{fig=randomFig();applyFig();});
const ward=$('#wardrobe'),wb2=$('#wardBtn');
function setWard(o){ward.classList.toggle('open',o);wb2.setAttribute('aria-expanded',String(o));if(o){renderPreview();renderStyles();renderColors();}}
wb2.addEventListener('click',()=>setWard(!ward.classList.contains('open')));
$('#wardClose').addEventListener('click',()=>setWard(false));
addEventListener('keydown',e=>{if(e.key==='Escape'&&ward.classList.contains('open'))setWard(false);});

/* ================= loop ================= */
function viewRect(){const pad=4*WS,x=Math.max(0,Math.floor(camX*WS)-pad),y=Math.max(0,Math.floor(camY*WS)-pad);
  return[x,y,Math.max(1,Math.min(WB,Math.ceil((camX+vw())*WS)+pad)-x),Math.max(1,Math.min(HB,Math.ceil((camY+vh())*WS)+pad)-y)];}
let last=performance.now();
function frameLoop(t){
  const dt=Math.min(.05,(t-last)/1000);last=t;now=t;const mp=MUSIC.pulse();beatPulse=mp!=null?mp:1-((t%480)/480);
  if(SCN){
    avatars.forEach(a=>{if(a.bot)botThink(a);update(a,dt);});pets.forEach(p=>petUpdate(p,dt));gSimTick(dt);
    if(me&&mode==='sala'&&me.path.length&&!drag){const cxw=camX+vw()/2,cyw=camY+vh()/2,tx=me.sx,ty=me.sy-50;if(Math.abs(tx-cxw)>vw()*.28||Math.abs(ty-cyw)>vh()*.26){camX+=(tx-cxw)*.04;camY+=(ty-cyw)*.04;clampCam();}}
    warmStep(mode==='sala'?6:10);
    if(me&&mode==='sala'){const was=me._moving;me._moving=me.path.length>0;if(was&&!me._moving)pushPres();
      if(!me.path.length&&now>(me._chk||0)){me._chk=now+700;const o=avatars.find(a=>a!==me&&!a.path.length&&a.gx===me.gx&&a.gy===me.gy);if(o&&String(o.user)<String(me.user)){const[x,y]=freeNear(me.gx,me.gy,me);if(walkTo(me,x,y))pushPres();}}}
    const V=viewRect();drawWorld(SCN,avatars.concat(pets),{view:V,ground:()=>{if(mode==='sala')lavaGround();if(mode==='sala'&&hover&&walkable(hover[0],hover[1],hover[0],hover[1])&&!drag){const[x,y]=hover;poly([S(x,y),S(x+1,y),S(x+1,y+1),S(x,y+1)],'rgba(255,179,71,.16)','#ffb347',1.5);}}});
    sc.setTransform(1,0,0,1,0,0);sky();
    sc.imageSmoothingEnabled=zoom<1;sc.setTransform(bs,0,0,bs,-Math.round(camX*scale),-Math.round(camY*scale));sc.drawImage(wb,V[0],V[1],V[2],V[3],V[0],V[1],V[2],V[3]);
    sc.setTransform(dpr,0,0,dpr,0,0);
    pets.forEach(petBubble);
    if(mode==='sala'){lavaOverlay();avatars.forEach(bubble);avatars.forEach(speakMark);gOverlay();fmOverlay();avatars.forEach(a=>{if(a===hoverAv&&!a.bubble&&!drag)tag(a,a===me);else if(a===me&&!a.bubble&&avatars.length>1)tag(a,true);});}
  }
  requestAnimationFrame(frameLoop);
}

/* ================= início ================= */
window.__role={show:(id,n,z)=>{SCREENS.forEach(x=>show($(x),false));show($('#loading'),false);vitrine.k=null;vitrine(id,n);zoom=z||.5;resize();centerOn(WW/2,WHt/2-40);},avs:()=>avatars.map(a=>({n:a.name,u:a.user,x:a.gx,y:a.gy,p:a.path.length,peer:a.peer})),
  gon:()=>({on:G.on,live:!!live,send:!!(live&&live.send),me:live&&live.me,acts:SCN&&SCN.acts&&SCN.acts.length}),
  scene:id=>{const c=getScene(id,false);return{gw:GW,gh:GH,blocked:[...c.blocked],seats:[...c.seats.keys()],soft:[...c.seats].filter(([,v])=>v.soft).map(([k])=>k),spawn:c.sc.spawn,acts:(c.acts||[]).map(v=>[v.id,v.x,v.y,v.w,v.d]),npcs:(c.npcs||[]).map(v=>[v.name,v.gx,v.gy,!!v.wander])};},
  cards:()=>{const c=cardsSheet(),k=3,o=document.createElement('canvas');o.width=c.width*k;o.height=c.height*k;const g=o.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(c,0,0,o.width,o.height);return o.toDataURL();},
  sink:()=>{if(!/debug=1/.test(location.search))return;const t=Object.values(G.acts).find(x=>x.id.startsWith('sinuca')&&x.m);if(!t)return;const m=t.m,b=m.balls.find(v=>v.id===3);b.x=30;b.y=30;b.vx=-220;b.vy=-220;m.sim={shooter:m.turn,acc:0,potted:[],done:false,deadline:0};},
  look:(x,y)=>{const[wx,wy]=S(x,y);centerOn(wx,wy);},
  go:(x,y)=>{if(me&&walkTo(me,x,y)){pushPres();return true;}return false;},
  games:()=>Object.values(G.acts).map(s=>({id:s.id,status:s.status,turn:s.m&&s.m.turn,shot:s.m&&s.m.shotN,rolando:!!(s.m&&s.m.sim),bolas:s.m&&s.m.balls&&s.m.balls.filter(b=>!b.in).length,pos:s.m&&s.m.balls&&s.m.balls.slice(0,4).map(b=>[+b.x.toFixed(2),+b.y.toFixed(2)]),grupos:s.m&&s.m.groups,fen:s.m&&s.m.eng?s.m.eng.fen():undefined,seat:gMine(s),tmine:s.m&&s.m.mine?s.m.mine.c.slice().sort((x,y)=>trStrength(y)-trStrength(x)):undefined,fase:s.m&&s.m.phase,stake:s.m&&s.m.stake,placar:s.m&&s.m.score,mao:s.m&&s.m.hand,jogadas:s.m&&s.m.plays?s.m.plays.flat().length:undefined,rodadas:s.m&&s.m.rounds?s.m.rounds.length:undefined,players:s.players.length,venceu:s.winners,over:s.over,eu:me?{x:me.gx,y:me.gy}:null,
    d:(df=>df&&df.dbg&&s.m?df.dbg(s.m,s):undefined)(G.defs[s.id.split('@')[0]])})),
  lava:c=>lavaDbg(c),
  fm:()=>fmDbg(),
  fmPerf:()=>{FMVIS.perf={sky:0,stage:0,n:0};},
  fmHide:h=>{FMV.hide=!!h;},
  bdOff:o=>{BD.off=!!o;},
  expira:()=>{CUR.criado=Date.now()-SALA_MS+2000;roomClock();},
  nadando:()=>!!(me&&swimAt(me)),
  pets:()=>pets.map(p=>({t:p.type,x:p.gx,y:p.gy,m:p.mirror})),
  dragonTest:()=>{const p=pets.find(x=>x.type==='dragao');if(!p||!me)return false;p.gx=p.fx=7;p.gy=p.fy=9;p.path=[];p.mirror=false;p.fire=null;p.fireAt=1;p.next=now+1e9;me.gx=me.fx=8;me.gy=me.fy=9;me.path=[];me.burnUntil=0;return true;},
  npcs:()=>avatars.filter(a=>a.npc).map(a=>({n:a.name,x:a.gx,y:a.gy,act:a.action,pose:poseOf(a).p,sit:a.sitKind,back:a.back,mir:a.mirror})),
  fmStats:()=>ROOMCAP&&ROOMCAP.fm&&ROOMCAP.fm.stats&&ROOMCAP.fm.stats(),
  fmFake:q=>ROOMCAP.fm.fake(q),
  lookStage:()=>{const sp=SCN&&SCN.sc.stageSpot;if(sp){const[wx,wy]=S(sp.x+1.5,-.6);centerOn(wx,wy-30);}},
  /* para os testes: escolhe direto (vôlei: posição do meu jogador; pesca: fisga já) */
  act:(type,cmd,arg)=>{const d=G.defs[type];return d&&d.test?d.test(cmd,arg):null;}};
/* abertura: alguém digita rápido, erra o "que", acerta, começa a errar "baderna" e desiste, e termina em caixa alta com ênfase; clicar ou apertar uma tecla pula */
(function intro(){
  const el=$('#intro');if(!el)return;
  if(RM||(navigator.webdriver&&!/intro/.test(location.search))){el.remove();return;}
  const word=$('#introWord'),T=[];let done=false,t=350;
  const at=(ms,fn)=>T.push(setTimeout(fn,ms)),jit=(a,b)=>a+Math.random()*(b-a);
  function end(){if(done)return;done=true;T.forEach(clearTimeout);el.classList.add('out');setTimeout(()=>el.remove(),500);removeEventListener('keydown',end);}
  function type(txt){[...txt].forEach(ch=>{t+=jit(45,85);at(t,()=>{word.textContent+=ch;});});}
  function back(n){for(let i=0;i<n;i++){t+=jit(22,34);at(t,()=>{word.textContent=word.textContent.slice(0,-1);});}}
  el.classList.add('typing');
  type('qeu');t+=140;back(3);type('que ');type('badenr');t+=220;back(10);t+=120;
  type('QUE BADERNA!');
  t+=120;at(t,()=>{el.classList.remove('typing');el.classList.add('enfase');});
  t+=900;at(t,end);
  el.addEventListener('click',end);addEventListener('keydown',end);
})();
(async function boot(){
  const sv=LS.get('role-avatar-y2k',null);if(sv&&sv.code){const f=parse(sv.code);if(f)fig=f;}
  hydrateIcons();renderTabs();
  vitrine('churrasco',true);seedBots();requestAnimationFrame(frameLoop);
  await initCaps();
  const m=/^#r-([a-z0-9]{6,16})$/.exec(location.hash||'')||/^\/r\/([a-z0-9]{6,16})\/?$/.exec(location.pathname||'');
  ME=await loadSession();if(ME){const f=parse(ME.fig||'');if(f)fig=f;}
  onAtlas(()=>{applyFig(false);});applyFig(false);
  show($('#loading'),false);
  if(m){const eid=m[1];
    if(ME){const mine=await DB.get(`data/users/${UID}/r_${eid}`).catch(()=>null);if(mine){clearHash();return enterRoom(eid);}}
    return openInvite(eid);}
  if(PENDING_INVITE&&!ME)return openInvite(PENDING_INVITE.eid);
  if(ME){if(PENDING_INVITE)return openInvite(PENDING_INVITE.eid);return openHome();}
  openLanding();
})();
