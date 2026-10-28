/* ================= xadrez =================
 * Duas pessoas jogam numa tela própria; quem está na sala vê o tabuleiro sobre a mesa do parque, com as peças.
 * As regras (lances legais, xeque-mate, empate) vêm da biblioteca chess.js, embutida no build (globalThis.__Chess).
 *   move  {n, from, to, p, f}   lance de quem está na vez; f é o FEN depois do lance (quem recebe confere)
 * Brancas = quem convidou. Promoção de peão: sempre dama.
 */
const CBS=28,CBX=128,CBY=42;   // casa de 28px, tabuleiro de 224px na tela de 480x270
const CP_FILES='abcdefgh';
const CP_BITS={
  p:['............','............','....####....','...######...','...######...','....####....','.....##.....','....####....','...######...','...######...','..########..','..########..'],
  r:['............','.##.####.##.','.##.####.##.','.##########.','..########..','...######...','...######...','...######...','...######...','..########..','.##########.','.##########.'],
  n:['............','....##......','...####.....','..#######...','.########...','.####.####..','.###..#####.','......#####.','.....######.','....#######.','...#########','...#########'],
  b:['.....##.....','....####....','...######...','...##.###...','...######...','....####....','.....##.....','....####....','...######...','..########..','.##########.','.##########.'],
  q:['.#..#..#..#.','.#..#..#..#.','.##.####.##.','..########..','...######...','...######...','...######...','....####....','...######...','..########..','.##########.','.##########.'],
  k:['.....##.....','....####....','.....##.....','..########..','.##########.','..########..','...######...','...######...','....####....','...######...','..########..','.##########.'],
};
let CS=null;   // tela aberta: { a, st, idx, cv, g, raf, sel, legal }

const cpMyTurn=(st,m)=>st.players[m.eng.turn()==='w'?0:1].u===ME.usuario;
const cpIdxOfTurn=m=>m.eng.turn()==='w'?0:1;

G.defs.xadrez={
  name:'Xadrez',verb:'Jogar xadrez',icon:'dice',n:2,plates:()=>['tl','tr'],
  stand(a,i){return i===0?[[a.x-1,a.y],[a.x-1,a.y+1],[a.x,a.y+1]]:[[a.x+1,a.y],[a.x+1,a.y+1],[a.x,a.y-1]];},
  init(seed,players){const eng=new globalThis.__Chess();return{eng,last:null,hist:[],n:0,note:'Brancas: '+gFirst(players[0].n),noteAt:0};},
  toWire(m){return{f:m.eng.fen(),l:m.last,h:m.hist.slice(-6),n:m.n};},
  fromWire(w){return{eng:new globalThis.__Chess(w.f),last:w.l||null,hist:w.h||[],n:w.n|0,note:'',noteAt:0};},
  onMsg:cpOnMsg,tick(){},stageOpen:cpStageOpen,stageClose:cpStageClose,
};

function cpApply(a,st,from,to,promo,mover){
  const m=st.m;let mv=null;
  try{mv=m.eng.move({from,to,promotion:promo||'q'});}catch(_){return false;}
  m.n++;m.last=[from,to];m.hist.push(mv.san);if(m.hist.length>40)m.hist.shift();m.note='';m.noteAt=now;
  if(CS&&CS.st===st){CS.sel=null;CS.legal=[];}
  if(m.eng.isCheckmate())gFinish(a,st,mover,'xeque-mate');
  else if(m.eng.isStalemate())gFinish(a,st,-1,'afogamento');
  else if(m.eng.isDraw())gFinish(a,st,-1,'empate');
  else if(m.eng.isCheck())addLog(null,'Xeque!');
  return true;
}
function cpOnMsg(a,st,d,from){
  const m=st.m;if(!m||st.status!=='playing'||d.t!=='move')return;
  const ti=cpIdxOfTurn(m);if(st.players[ti].peer!==from||d.n!==m.n+1)return;
  if(!cpApply(a,st,String(d.from),String(d.to),d.p,ti)&&d.f)st.m=G.defs.xadrez.fromWire({f:d.f,l:[d.from,d.to],h:m.hist,n:d.n});   // lance que não entendi: confio no FEN de quem jogou
}

/* ---------- o mundo: peças sobre a mesa ---------- */
function gameChessPlaying(gx,gy){const s=G.acts['xadrez@'+gx+'_'+gy];return !!(s&&(s.status==='playing'||s.status==='over')&&s.m);}
function gameChessDraw(gx,gy){
  const playing=gameChessPlaying(gx,gy),m=playing?G.acts['xadrez@'+gx+'_'+gy].m:null;
  if(!playing&&!globalThis.__Chess)return false;
  const board=playing?m.eng.board():(CP_IDLE||(CP_IDLE=new globalThis.__Chess().board()));
  const P=(u,v)=>up(S(gx+.12+u*.76,gy+.12+v*.76),23);
  board.forEach((row,r)=>row.forEach((pc,c)=>{
    if(!pc)return;
    const[x,y]=P((c+.5)/8,(r+.5)/8),h=({p:2.5,r:3.5,n:3.5,b:4,q:4.5,k:5})[pc.type];
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(Math.round(x)-1,Math.round(y),3,1);
    ctx.fillStyle=pc.color==='w'?'#f6f2ff':'#2a1f45';ctx.fillRect(Math.round(x)-1,Math.round(y-h),3,h);
    ctx.fillStyle=pc.color==='w'?'#cfc6e8':'#6a4fd0';ctx.fillRect(Math.round(x),Math.round(y-h),1,1);
  }));
  return true;
}

/* ---------- a tela do jogo ---------- */
function cpStageOpen(a,st,idx,cv){
  cpStageClose();
  cv.width=SW;cv.height=SH;
  CS={a,st,idx,cv,g:cv.getContext('2d'),raf:0,sel:null,legal:[]};
  cv.onpointerdown=cpDown;
  const loop=()=>{if(!CS)return;cpDraw();CS.raf=requestAnimationFrame(loop);};
  CS.raf=requestAnimationFrame(loop);
}
function cpStageClose(){if(!CS)return;cancelAnimationFrame(CS.raf);CS.cv.onpointerdown=null;CS=null;}

/* casa na tela: quem joga de pretas vê o tabuleiro virado */
const cpFlip=()=>CS.idx===1;
function cpSquareAt(e){
  const r=CS.cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*SW-CBX,y=(e.clientY-r.top)/r.height*SH-CBY;
  if(x<0||y<0||x>=CBS*8||y>=CBS*8)return null;
  let c=Math.floor(x/CBS),rw=Math.floor(y/CBS);
  if(cpFlip()){c=7-c;rw=7-rw;}
  return CP_FILES[c]+(8-rw);
}
function cpDown(e){
  const{st,a}=CS,m=st.m;if(!m||st.status!=='playing'||!cpMyTurn(st,m))return;
  const sq=cpSquareAt(e);if(!sq)return;
  const pc=m.eng.get(sq),me_=CS.idx===0?'w':'b';
  if(CS.sel&&CS.legal.some(l=>l.to===sq)){
    const mv=CS.legal.find(l=>l.to===sq),from=CS.sel,n=m.n+1;
    if(cpApply(a,st,from,sq,mv.promotion?'q':undefined,CS.idx)){gSend(a,'move',{n,from,to:sq,p:mv.promotion?'q':undefined,f:m.eng.fen()});}
    return;
  }
  if(pc&&pc.color===me_){CS.sel=sq;CS.legal=m.eng.moves({square:sq,verbose:true});}
  else{CS.sel=null;CS.legal=[];}
}

function cpPiece(g,type,color,x,y,s){   // s = tamanho do pixel (2 na tela, 1 nas capturas)
  const bits=CP_BITS[type],fill=color==='w'?'#ffffff':'#4a3a7a',shade=color==='w'?'#c9c0e6':'#2c2150',line=color==='w'?'#1c1428':'#000';
  g.fillStyle=line;
  bits.forEach((row,ry)=>{for(let rx=0;rx<12;rx++)if(row[rx]==='#'){for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]])g.fillRect(x+rx*s+dx*s,y+ry*s+dy*s,s,s);}});
  bits.forEach((row,ry)=>{for(let rx=0;rx<12;rx++)if(row[rx]==='#'){g.fillStyle=ry>8||rx>8?shade:fill;g.fillRect(x+rx*s,y+ry*s,s,s);}});
}

const CP_START={p:8,r:2,n:2,b:2,q:1,k:1};
function cpCaptured(m){   // o que cada lado já perdeu (contando o tabuleiro)
  const have={w:{p:0,r:0,n:0,b:0,q:0,k:0},b:{p:0,r:0,n:0,b:0,q:0,k:0}};
  m.eng.board().forEach(row=>row.forEach(pc=>{if(pc)have[pc.color][pc.type]++;}));
  const lost={w:[],b:[]};
  for(const col of['w','b'])for(const t of['q','r','b','n','p'])for(let i=have[col][t];i<CP_START[t];i++)lost[col].push(t);
  return lost;
}


function cpDraw(){
  const{g,st,idx}=CS,m=st.m;if(!m)return;
  g.imageSmoothingEnabled=false;
  g.fillStyle='#1d1233';g.fillRect(0,0,SW,SH);
  for(let y=0;y<SH;y+=8)for(let x=((y/8)%2)*8;x<SW;x+=16){g.fillStyle='#22163b';g.fillRect(x,y,8,8);}
  // moldura e casas
  g.fillStyle='#000';g.fillRect(CBX-8,CBY-8,CBS*8+16,CBS*8+16);
  g.fillStyle='#6a3f22';g.fillRect(CBX-6,CBY-6,CBS*8+12,CBS*8+12);
  const lastSet=new Set(m.last||[]);
  const kingSq=m.eng.isCheck()?(()=>{let s=null;m.eng.board().forEach((row,r)=>row.forEach((pc,c)=>{if(pc&&pc.type==='k'&&pc.color===m.eng.turn())s=CP_FILES[c]+(8-r);}));return s;})():null;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const rr=cpFlip()?7-r:r,cc=cpFlip()?7-c:c,sq=CP_FILES[cc]+(8-rr),x=CBX+c*CBS,y=CBY+r*CBS;
    g.fillStyle=(rr+cc)%2?'#a8743c':'#ecd9ae';g.fillRect(x,y,CBS,CBS);
    if(lastSet.has(sq)){g.fillStyle='rgba(255,210,63,.45)';g.fillRect(x,y,CBS,CBS);}
    if(sq===CS.sel){g.fillStyle='rgba(143,212,42,.7)';g.fillRect(x,y,CBS,CBS);}
    if(sq===kingSq){g.fillStyle='rgba(255,61,139,.6)';g.fillRect(x,y,CBS,CBS);}
    const pc=m.eng.get(sq);
    if(pc)cpPiece(g,pc.type,pc.color,x+2,y+2,2);
    if(CS.legal.some(l=>l.to===sq)){g.fillStyle='rgba(0,0,0,.55)';if(pc){g.fillRect(x,y,CBS,3);g.fillRect(x,y+CBS-3,CBS,3);g.fillRect(x,y,3,CBS);g.fillRect(x+CBS-3,y,3,CBS);}else g.fillRect(x+CBS/2-3,y+CBS/2-3,6,6);}
  }
  g.fillStyle='#e8d6a8';g.font='700 7px Anybody, sans-serif';g.textBaseline='top';
  for(let k=0;k<8;k++){const f=CP_FILES[cpFlip()?7-k:k],n=cpFlip()?k+1:8-k;g.fillText(f,CBX+k*CBS+CBS/2-2,CBY+CBS*8+1);g.fillText(String(n),CBX-6,CBY+k*CBS+CBS/2-3);}
  // cartões dos jogadores (HTML) e as peças que cada lado já perdeu
  const turn=cpIdxOfTurn(m),playing=st.status==='playing'&&!m.eng.isGameOver();
  gHudSet(0,{active:playing&&turn===0,sub:'BRANCAS'});gHudSet(1,{active:playing&&turn===1,sub:'PRETAS'});
  const lost=cpCaptured(m);
  [[lost.b,8,60],[lost.w,SW-120,60]].forEach(([list,x0,y0])=>{   // coluna da esquerda: pretas perdidas; da direita: brancas perdidas
    list.forEach((t,i)=>cpPiece(g,t,list===lost.b?'b':'w',x0+(i%5)*22,y0+Math.floor(i/5)*20,1.5));
  });
  g.textAlign='left';
  if(st.status==='over'){
    g.fillStyle='rgba(10,6,24,.75)';g.fillRect(0,SH/2-34,SW,68);
    const mine=st.over===idx,t=st.over<0?'EMPATE':mine?'VOCÊ VENCEU!':gFirst(st.players[st.over].n).toUpperCase()+' VENCEU';
    g.font='900 26px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#000';g.fillText(t,SW/2+2,SH/2+2);g.fillStyle=st.over<0?'#ffd23f':mine?'#8fd42a':'#ff3d8b';g.fillText(t,SW/2,SH/2);g.textAlign='left';
  }
}
