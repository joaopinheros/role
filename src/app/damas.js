/* ================= damas (templo, 2 pessoas) =================
 * Regras brasileiras em src/engine/damas.js. Quem convidou joga com as claras (embaixo, começa).
 * Quem está na sala vê o tabuleiro sobre a mesinha baixa do templo, com as peças.
 *   move {n, p, b}   lance de quem está na vez: p é o caminho de casas; b é o tabuleiro depois (quem recebe confere)
 */
let DS=null;   // tela aberta: { a, st, idx, cv, g, raf, sel, hint }

G.defs.damas={
  name:'Damas',verb:'Jogar damas',icon:'dice',n:2,plates:()=>['tl','tr'],
  stand(a,i){return i===0?[[a.x-1,a.y]]:[[a.x+1,a.y]];},
  init(){const m=dmNew();m.anim=null;return m;},
  toWire(m){return{b:m.b,turn:m.turn,n:m.n,quiet:m.quiet,last:m.last,over:m.over};},
  fromWire(w){return{b:w.b.slice(),turn:w.turn|0,n:w.n|0,quiet:w.quiet|0,last:w.last||null,over:w.over==null?-1:w.over,anim:null};},
  onMsg:dsOnMsg,tick(){},stageOpen:dsStageOpen,stageClose:dsStageClose,
  dbg:m=>({b:m.b.join(''),vez:m.turn,lances:m.n,claras:dmCount(m,0),escuras:dmCount(m,1),over:m.over}),
};

function dsApply(a,st,path,mover){
  const m=st.m,before=m.b.slice(),mv=dmPlay(m,path);
  if(!mv)return false;
  m.anim={path:path.slice(),piece:m.b[path[path.length-1]],taken:mv.taken.map(v=>[v,before[v]]),t:now};
  if(DS&&DS.st===st){DS.sel=null;DS.hint=0;}
  if(m.last.crown)addLog(null,gFirst(st.players[mover].n)+' fez dama!');
  if(m.over===2)gFinish(a,st,-1,'empate');
  else if(m.over>=0)gFinish(a,st,m.over,'sem lances do adversário');
  return true;
}
function dsOnMsg(a,st,d,from){
  const m=st.m;if(!m||st.status!=='playing'||d.t!=='move')return;
  if(st.players[m.turn].peer!==from||d.n!==m.n+1)return;
  const mover=m.turn;
  if(!dsApply(a,st,(d.p||[]).map(Number),mover)&&Array.isArray(d.b)&&d.b.length===64){   // lance que não entendi: confio no tabuleiro de quem jogou
    Object.assign(m,{b:d.b.map(Number),turn:1-mover,n:d.n,anim:null});
  }
}

/* ---------- o mundo: mesinha baixa com o tabuleiro ---------- */
function damasTable(gx,gy){actReg('damas',gx,gy,1,1);addF(gx,gy,()=>{
  bx(gx+.12,gy+.15,.76,.7,10,0,'#4a2a1c');
  box(gx+.06,gy+.08,.88,.84,3,10,'#7a4a32','#5a3424','#4a2a1c');
  const P=(u,v)=>up(S(gx+.12+u*.76,gy+.12+v*.76),13);
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)poly([P(c/8,r/8),P((c+1)/8,r/8),P((c+1)/8,(r+1)/8),P(c/8,(r+1)/8)],(r+c)%2?'#3a2418':'#e8d2a0');
  const s=G.acts['damas@'+gx+'_'+gy],b=s&&s.m&&(s.status==='playing'||s.status==='over')?s.m.b:DM_IDLE||(DM_IDLE=dmNew().b);
  b.forEach((p,i)=>{if(!p)return;const[x,y]=P(((i&7)+.5)/8,((i>>3)+.5)/8),X=Math.round(x),Y=Math.round(y);
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(X-1,Y,3,1);
    ctx.fillStyle=dmSide(p)===0?'#f6efe0':'#c23b3b';ctx.fillRect(X-1,Y-(dmKing(p)?3:2),3,dmKing(p)?3:2);
    if(dmKing(p)){ctx.fillStyle='#ffd23f';ctx.fillRect(X,Y-3,1,1);}});
});}
let DM_IDLE=null;

/* ---------- a tela do jogo ---------- */
function dsStageOpen(a,st,idx,cv){
  dsStageClose();
  cv.width=SW;cv.height=SH;
  DS={a,st,idx,cv,g:cv.getContext('2d'),raf:0,sel:null,hint:0};
  cv.onpointerdown=dsDown;
  const loop=()=>{if(!DS)return;dsDraw();DS.raf=requestAnimationFrame(loop);};
  DS.raf=requestAnimationFrame(loop);
}
function dsStageClose(){if(!DS)return;cancelAnimationFrame(DS.raf);DS.cv.onpointerdown=null;DS=null;}

const dsFlip=()=>DS.idx===1;   // quem joga de escuras vê o tabuleiro virado (as suas peças embaixo)
const dsXY=sq=>{let r=sq>>3,c=sq&7;if(dsFlip()){r=7-r;c=7-c;}return[CBX+c*CBS,CBY+r*CBS];};
function dsSquareAt(e){
  const r=DS.cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*SW-CBX,y=(e.clientY-r.top)/r.height*SH-CBY;
  if(x<0||y<0||x>=CBS*8||y>=CBS*8)return -1;
  let c=Math.floor(x/CBS),rw=Math.floor(y/CBS);
  if(dsFlip()){c=7-c;rw=7-rw;}
  return rw*8+c;
}
function dsDown(e){
  const{st,a,idx}=DS,m=st.m;if(!m||st.status!=='playing'||m.turn!==idx)return;
  const sq=dsSquareAt(e);if(sq<0)return;
  const moves=dmMoves(m);
  if(DS.sel!=null){
    const mv=moves.find(x=>x.path[0]===DS.sel&&x.path[x.path.length-1]===sq);
    if(mv){const n=m.n+1;if(dsApply(a,st,mv.path,idx))gSend(a,'move',{n,p:mv.path,b:m.b});return;}
  }
  if(dmSide(m.b[sq])===idx){
    if(moves.some(x=>x.path[0]===sq)){DS.sel=sq;DS.hint=0;}
    else{DS.sel=null;DS.hint=now;}   // essa peça não pode: pisca as que podem (a captura é obrigatória)
  }else DS.sel=null;
}

function dsPiece(g,p,x,y,s){   // disco em pixel; s = tamanho (24 na tela)
  const light=dmSide(p)===0,top=light?'#fbf4e2':'#d8443a',side=light?'#c9b48a':'#8a1f22',line='#000',r=s/2,cx=x+r,cy=y+r-2;
  for(let j=-r;j<=r;j++){const w=Math.floor(Math.sqrt(r*r-j*j));g.fillStyle=line;g.fillRect(cx-w-1,cy+j+3,w*2+2,1);}
  for(let j=-r+1;j<r;j++){const w=Math.floor(Math.sqrt((r-1)*(r-1)-j*j));g.fillStyle=side;g.fillRect(cx-w,cy+j+3,w*2,1);g.fillStyle=line;g.fillRect(cx-w-1,cy+j,w*2+2,1);}
  for(let j=-r+2;j<r-1;j++){const w=Math.floor(Math.sqrt((r-2)*(r-2)-j*j));g.fillStyle=top;g.fillRect(cx-w,cy+j,w*2,1);}
  g.fillStyle=light?'#e6d6b2':'#b8302c';for(let j=-r+5;j<r-4;j++){const w=Math.floor(Math.sqrt((r-5)*(r-5)-j*j));if(Math.abs(j)>r-7||w<2)continue;g.fillRect(cx-w,cy+j,1,1);g.fillRect(cx+w-1,cy+j,1,1);}
  if(dmKing(p)){g.fillStyle='#000';g.fillRect(cx-6,cy-4,13,8);g.fillStyle='#ffd23f';g.fillRect(cx-5,cy-1,11,4);[-5,0,5].forEach(dx=>g.fillRect(cx+dx-1+(dx?1:0),cy-3,dx?1:1,2));g.fillStyle='#ff3d8b';g.fillRect(cx,cy,1,1);}
}

function dsDraw(){
  const{g,st,idx}=DS,m=st.m;if(!m)return;
  g.imageSmoothingEnabled=false;
  g.fillStyle='#14202a';g.fillRect(0,0,SW,SH);
  for(let y=0;y<SH;y+=8)for(let x=((y/8)%2)*8;x<SW;x+=16){g.fillStyle='#172530';g.fillRect(x,y,8,8);}
  g.fillStyle='#000';g.fillRect(CBX-8,CBY-8,CBS*8+16,CBS*8+16);
  g.fillStyle='#5a2e1e';g.fillRect(CBX-6,CBY-6,CBS*8+12,CBS*8+12);
  const moves=st.status==='playing'&&m.turn===idx?dmMoves(m):[],an=m.anim,anT=an?(now-an.t)/170:99,anOn=an&&anT<an.path.length-1+.6;
  const lastSet=new Set(m.last?m.last.path:[]),dests=DS.sel!=null?moves.filter(x=>x.path[0]===DS.sel):[];
  const can=new Set(moves.map(x=>x.path[0])),blink=DS.hint&&now-DS.hint<900&&Math.floor((now-DS.hint)/150)%2===0;
  for(let sq=0;sq<64;sq++){
    const[x,y]=dsXY(sq),dark=((sq>>3)+(sq&7))%2===1;
    g.fillStyle=dark?'#5b3a26':'#ecd9ae';g.fillRect(x,y,CBS,CBS);
    if(!dark)continue;
    if(lastSet.has(sq)){g.fillStyle='rgba(255,210,63,.32)';g.fillRect(x,y,CBS,CBS);}
    if(sq===DS.sel){g.fillStyle='rgba(143,212,42,.6)';g.fillRect(x,y,CBS,CBS);}
    if(blink&&can.has(sq)){g.fillStyle='rgba(255,61,139,.55)';g.fillRect(x,y,CBS,CBS);}
    const p=m.b[sq],hide=anOn&&sq===an.path[an.path.length-1];
    if(p&&!hide)dsPiece(g,p,x+2,y+3,24);
  }
  if(anOn){
    // peças tomadas somem aos poucos; a que andou passa pelas casas do caminho
    an.taken.forEach(([v,p])=>{const[x,y]=dsXY(v);g.globalAlpha=Math.max(0,1-anT/(an.path.length));dsPiece(g,p,x+2,y+3,24);g.globalAlpha=1;});
    const k=Math.min(an.path.length-1,anT),i=Math.floor(k),f=k-i,[x0,y0]=dsXY(an.path[i]),[x1,y1]=dsXY(an.path[Math.min(i+1,an.path.length-1)]),hop=Math.sin(f*Math.PI)*8;
    dsPiece(g,an.piece,Math.round(x0+(x1-x0)*f)+2,Math.round(y0+(y1-y0)*f-hop)+3,24);
  }
  dests.forEach(mv=>{const[x,y]=dsXY(mv.path[mv.path.length-1]);g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x+CBS/2-3,y+CBS/2-3,6,6);g.fillStyle=mv.taken.length?'#ff3d8b':'#8fd42a';g.fillRect(x+CBS/2-2,y+CBS/2-2,4,4);});
  // cartões e peças que cada lado já perdeu
  const playing=st.status==='playing'&&m.over===-1;
  gHudSet(0,{active:playing&&m.turn===0,sub:'CLARAS'});gHudSet(1,{active:playing&&m.turn===1,sub:'ESCURAS'});
  [[1,8],[0,SW-120]].forEach(([side,x0])=>{const lost=12-dmCount(m,side);for(let i=0;i<lost;i++)dsPiece(g,side===0?1:3,x0+(i%4)*26,62+Math.floor(i/4)*24,20);});
  if(st.status==='over'){
    g.fillStyle='rgba(10,6,24,.75)';g.fillRect(0,SH/2-34,SW,68);
    const mine=st.over===idx,t=st.over<0?'EMPATE':mine?'VOCÊ VENCEU!':gFirst(st.players[st.over].n).toUpperCase()+' VENCEU';
    g.font='900 26px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#000';g.fillText(t,SW/2+2,SH/2+2);g.fillStyle=st.over<0?'#ffd23f':mine?'#8fd42a':'#ff3d8b';g.fillText(t,SW/2,SH/2);g.textAlign='left';
  }
}
