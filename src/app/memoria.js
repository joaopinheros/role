/* ================= jogo da memória (noite do pijama, 2 pessoas) =================
 * 20 cartas viradas (10 pares) sobre a mesinha do quarto. Na sua vez, vire duas: se formarem par, ficam com você
 * e você joga de novo; se não, voltam a virar e passa a vez. Quem juntar mais pares ganha.
 * A posição das cartas sai da semente da partida (todo mundo embaralha igual).
 *   flip {n, i}   quem está na vez virou a carta i
 */
let MS=null;   // tela aberta
const MEM_N=20,MCW=44,MCH=54,MGX=(SW-5*(MCW+8)+8)/2,MGY=34;

/* 10 desenhos em pixel (12x12): letras = cores */
const MEM_ART=[
  {n:'pizza',c:{k:'#1c1428',y:'#ffd23f',r:'#d8443a',o:'#c9862e'},b:['oooooooooooo','kyyyyyyyyyyk','.kyryyyyryk.','.kyyyyryyyk.','..kyryyyyk..','..kyyyyryk..','...kyyryk...','...kyyyyk...','....kyyk....','....kyyk....','.....kk.....','............']},
  {n:'estrela',c:{k:'#1c1428',y:'#ffd23f',w:'#fff6c0'},b:['.....kk.....','....kyyk....','....kwyk....','kkkkyyyykkkk','kyyyyyyyyyyk','.kyyyyyyyyk.','..kyyyyyyk..','..kyyyyyyk..','.kyyykkyyyk.','.kyyk..kyyk.','kyyk....kyyk','kkk......kkk']},
  {n:'coração',c:{k:'#1c1428',r:'#ff3d8b',w:'#ffd0e2'},b:['............','.kkk....kkk.','krrrk..krrrk','krwrrkkrrrrk','krrrrrrrrrrk','krrrrrrrrrrk','.krrrrrrrrk.','..krrrrrrk..','...krrrrk...','....krrk....','.....kk.....','............']},
  {n:'gato',c:{k:'#1c1428',o:'#f0a23a',p:'#ff8fc7',w:'#fff'},b:['.k........k.','kok......kok','kook....kook','koookkkkoook','kooooooooook','kookwoookwok','kooooooooook','kooooppooook','kooookkooook','.kooooooook.','..kkkkkkkk..','............']},
  {n:'lua',c:{k:'#1c1428',y:'#fff1a8',s:'#d8c86a'},b:['....kkkk....','..kkyyyk....','.kyyyyk.....','.kyyyk......','kyyyyk......','kyyysk......','kyyyyk......','kyysyyk.....','.kyyyyykkkk.','.kyyyyyyyyk.','..kkyyyykk..','....kkkk....']},
  {n:'fantasma',c:{k:'#1c1428',w:'#f6f2ff',s:'#c9c0e6',p:'#ff8fc7'},b:['....kkkk....','..kkwwwwkk..','.kwwwwwwwwk.','.kwkkwwkkwk.','kwwkkwwkkwwk','kwwwwwwwwwwk','kwwpwwwwpwwk','kwwwwkkwwwwk','kwwwwwwwwwwk','kswwwwwwwwsk','ksswkswksswk','.kk.k.k.kk..']},
  {n:'controle',c:{k:'#1c1428',y:'#43d9e8',d:'#241452',p:'#ff3d8b',g:'#8fd42a'},b:['............','............','.kkkkkkkkkk.','kyyyyyyyyyyk','kydyyyyypyyk','kdddyyygyyyk','kydyyyyyyyyk','kyyyyyyyyyyk','kyyykkkkyyyk','.kkk....kkk.','............','............']},
  {n:'nota',c:{k:'#1c1428',p:'#8e5ac8',l:'#c9a5ff'},b:['......kkkkkk','......kpppkk','......kplkpk','......kpk.kk','......kpk...','......kpk...','......kpk...','..kkkkkpk...','.kppppppk...','kpplpppppk..','kppppppppk..','.kkkkkkkk...']},
  {n:'sorvete',c:{k:'#1c1428',p:'#ff8fc7',w:'#fff',c:'#d8a05a',d:'#a8743c'},b:['....kkkk....','..kkppwpkk..','.kppppppppk.','.kpwpppppwk.','kppppppppppk','kkkkkkkkkkkk','.kcdcdcdcdk.','..kcdcdcdk..','..kdcdcdck..','...kcdcdk...','....kcdk....','.....kk.....']},
  {n:'pato',c:{k:'#1c1428',y:'#ffd23f',o:'#ff8a3a',w:'#fff'},b:['...kkkk.....','..kyyyyk....','.kyywkyyk...','.kyyyyyykkk.','.kyyyyyyoook','..kyyyyykkk.','...kyyyk....','.kkyyyyykkk.','kyyyyyyyyyyk','kyyyyyyyyyk.','.kyyyyyyyk..','..kkkkkkk...']},
];
const memArt=(()=>{const cache={};return i=>{if(cache[i])return cache[i];const a=MEM_ART[i],c=document.createElement('canvas');c.width=12;c.height=12;const g=c.getContext('2d');
  a.b.forEach((row,y)=>{row=row.padEnd(12,'.').slice(0,12);for(let x=0;x<12;x++){const ch=row[x];if(ch!=='.'&&a.c[ch]){g.fillStyle=a.c[ch];g.fillRect(x,y,1,1);}}});return cache[i]=c;};})();

function memDeck(seed){
  const d=[];for(let i=0;i<10;i++)d.push(i,i);
  let s=(seed>>>0)||1;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let i=d.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}

G.defs.memoria={
  name:'Jogo da memória',verb:'Jogar memória (pares)',icon:'dice',n:2,plates:()=>['tl','tr'],turnSeat:true,
  stand(a,i){return i===0?[[a.x-1,a.y]]:[[a.x+1,a.y]];},
  init(seed){return{cards:memDeck(seed),found:new Array(MEM_N).fill(-1),open:[],miss:null,turn:0,n:0,score:[0,0],fx:null};},
  toWire(m){return{cards:m.cards,found:m.found,open:m.open,turn:m.turn,n:m.n,score:m.score};},
  fromWire(w){return{cards:w.cards.slice(),found:w.found.slice(),open:w.open.slice(),miss:null,turn:w.turn|0,n:w.n|0,score:w.score.slice(),fx:null};},
  onMsg:memOnMsg,tick(){},stageOpen:memStageOpen,stageClose:memStageClose,
  tag:(a,st)=>({t:`${gFirst(st.players[0].n)} ${st.m.score[0]} x ${st.m.score[1]} ${gFirst(st.players[1].n)}`,c:'#c9a5ff'}),
  dbg:(m,st)=>({vez:m.turn,n:m.n,placar:m.score,abertas:m.open.slice(),achadas:m.found.filter(x=>x>=0).length,cards:m.cards.slice()}),
};

function memFlip(a,st,i,p){
  const m=st.m;
  if(st.status!=='playing'||m.turn!==p||!(i>=0&&i<MEM_N)||m.found[i]>=0||m.open.includes(i))return false;
  m.miss=null;m.open.push(i);m.n++;m.fx={i,t:now};
  if(m.open.length===2){
    const[x,y]=m.open;
    if(m.cards[x]===m.cards[y]){
      m.found[x]=m.found[y]=p;m.score[p]++;m.open=[];m.fx={i,t:now,pair:[x,y]};
      if(MS&&MS.st===st)gBanner(p===MS.idx?'PAR!':'PAR DE '+gFirst(st.players[p].n).toUpperCase(),'#8fd42a');
      if(m.found.every(f=>f>=0)){const[s0,s1]=m.score;gFinish(a,st,s0===s1?-1:s0>s1?0:1,`${s0} x ${s1} pares`);}
    }else{m.miss={a:x,b:y,t:now};m.open=[];m.turn=1-p;}
  }
  return true;
}
function memOnMsg(a,st,d,from){
  const m=st.m;if(!m||d.t!=='flip'||st.players[m.turn].peer!==from||d.n!==m.n+1)return;
  memFlip(a,st,d.i|0,m.turn);
}

/* ---------- o mundo: mesinha do quarto com as cartas ---------- */
function memoryTable(gx,gy){actReg('memoria',gx,gy,1,1);addF(gx,gy,()=>{
  bx(gx+.1,gy+.15,.8,.7,9,0,'#8a5ac8');box(gx+.04,gy+.08,.92,.84,3,9,'#f2e8ff','#c9a5ff','#a87ae0');
  const s=G.acts['memoria@'+gx+'_'+gy],m=s&&s.m&&(s.status==='playing'||s.status==='over')?s.m:null;
  const P=(u,v)=>up(S(gx+.12+u*.76,gy+.12+v*.76),12);
  for(let i=0;i<MEM_N;i++){
    if(m&&m.found[i]>=0)continue;
    const up_=m&&(m.open.includes(i)||(m.miss&&now-m.miss.t<1100&&(m.miss.a===i||m.miss.b===i)));
    const[x,y]=P(((i%5)+.5)/5,(Math.floor(i/5)+.5)/4),X=Math.round(x),Y=Math.round(y);
    ctx.fillStyle='#1c1428';ctx.fillRect(X-2,Y-1,5,3);ctx.fillStyle=up_?'#ffffff':'#6a40d8';ctx.fillRect(X-1,Y,3,1);
  }
});}

/* ---------- a tela do jogo ---------- */
function memStageOpen(a,st,idx,cv){
  memStageClose();cv.width=SW;cv.height=SH;
  MS={a,st,idx,cv,g:cv.getContext('2d'),raf:0,hover:-1};
  const loc=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*SW,(e.clientY-r.top)/r.height*SH];};
  const hit=([x,y])=>{for(let i=0;i<MEM_N;i++){const[cx,cy]=memXY(i);if(x>=cx&&x<cx+MCW&&y>=cy&&y<cy+MCH)return i;}return -1;};
  cv.onpointermove=e=>{if(!MS)return;MS.hover=hit(loc(e));cv.style.cursor=MS.hover>=0&&memCan(MS.hover)?'pointer':'default';};
  cv.onpointerleave=()=>{if(MS)MS.hover=-1;};
  cv.onpointerdown=e=>{if(!MS)return;const i=hit(loc(e));if(i<0||!memCan(i))return;const{a,st,idx}=MS,n=st.m.n+1;if(memFlip(a,st,i,idx))gSend(a,'flip',{n,i});};
  const loop=()=>{if(!MS)return;memDraw();MS.raf=requestAnimationFrame(loop);};
  MS.raf=requestAnimationFrame(loop);
}
function memStageClose(){if(!MS)return;cancelAnimationFrame(MS.raf);MS.cv.onpointermove=MS.cv.onpointerleave=MS.cv.onpointerdown=null;MS=null;}
const memXY=i=>[Math.round(MGX+(i%5)*(MCW+8)),MGY+Math.floor(i/5)*(MCH+8)];
const memCan=i=>{const{st,idx}=MS,m=st.m;return st.status==='playing'&&m.turn===idx&&m.found[i]<0&&!m.open.includes(i);};

/* frente e verso desenhados uma vez só (o quadro só estica na hora de virar) */
const memImg=(()=>{const cache={};return(face,art)=>{const key=face?'f'+art:'b';if(cache[key])return cache[key];
  const c=document.createElement('canvas');c.width=MCW;c.height=MCH;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  if(!face){
    g.fillStyle='#3a1c8a';g.fillRect(0,0,MCW,MCH);g.fillStyle='#ff3d8b';g.fillRect(2,2,MCW-4,1);g.fillRect(2,MCH-3,MCW-4,1);g.fillRect(2,2,1,MCH-4);g.fillRect(MCW-3,2,1,MCH-4);
    g.fillStyle='#6a40d8';for(let y=5;y<MCH-5;y++)for(let x=4;x<MCW-4;x++)if((x+y)%6===0||(x-y+60)%6===0)g.fillRect(x,y,1,1);
    g.fillStyle='#ffd23f';for(let j=-6;j<=6;j++){const w=6-Math.abs(j);g.fillRect(MCW/2-w,MCH/2+j,w*2+1,1);}g.fillStyle='#ff3d8b';g.fillRect(MCW/2-1,MCH/2-1,3,3);
  }else{
    g.fillStyle='#fbf6e8';g.fillRect(0,0,MCW,MCH);g.fillStyle='#e6dcc4';g.fillRect(0,MCH-2,MCW,2);
    g.drawImage(memArt(art),0,0,12,12,4,9,36,36);
  }
  return cache[key]=c;};})();
function memCard(g,x,y,face,art,k,glow){   // k = largura relativa (0..1) para a animação de virar
  const w=Math.max(1,Math.round(MCW*k)),X=x+Math.round((MCW-w)/2);
  g.fillStyle='rgba(0,0,0,.35)';g.fillRect(X+3,y+3,w,MCH);
  g.fillStyle=glow||'#000';g.fillRect(X-1,y-1,w+2,MCH+2);
  g.drawImage(memImg(face,art),X,y,w,MCH);
}

function memDraw(){
  const{g,st,idx}=MS,m=st.m;if(!m)return;
  g.imageSmoothingEnabled=false;
  g.fillStyle='#2a1838';g.fillRect(0,0,SW,SH);
  for(let y=0;y<SH;y+=10)for(let x=((y/10)%2)*10;x<SW;x+=20){g.fillStyle='#31203f';g.fillRect(x,y,10,10);}   // edredom xadrez
  const myTurn=st.status==='playing'&&m.turn===idx;
  for(let i=0;i<MEM_N;i++){
    const[x,y]=memXY(i),f=m.found[i];
    const showMiss=m.miss&&now-m.miss.t<1100&&(m.miss.a===i||m.miss.b===i);
    const isOpen=m.open.includes(i)||showMiss,fresh=m.fx&&m.fx.i===i&&now-m.fx.t<180;
    const k=fresh?Math.abs(1-2*(now-m.fx.t)/180):1;
    if(f>=0){   // par achado: fica de cara pra cima, com a cor de quem achou, e encolhe um pouco
      const pairNew=m.fx&&m.fx.pair&&m.fx.pair.includes(i)&&now-m.fx.t<700;
      g.globalAlpha=pairNew?1:.38;memCard(g,x,y,true,m.cards[i],1,f===0?'#43d9e8':'#ff8fc7');g.globalAlpha=1;continue;
    }
    const hov=MS.hover===i&&myTurn&&memCan(i);
    memCard(g,x,y-(hov?3:0),isOpen&&!(fresh&&(now-m.fx.t)<90),m.cards[i],k,showMiss&&Math.floor(now/140)%2?'#ff3d8b':hov?'#ffd23f':null);
  }
  gHudSet(0,{active:st.status==='playing'&&m.turn===0,sub:m.score[0]+(m.score[0]===1?' par':' pares')});
  gHudSet(1,{active:st.status==='playing'&&m.turn===1,sub:m.score[1]+(m.score[1]===1?' par':' pares')});
  if(st.status==='over'){
    g.fillStyle='rgba(10,6,24,.75)';g.fillRect(0,SH/2-34,SW,68);
    const mine=st.over===idx,t=st.over<0?'EMPATE':mine?'VOCÊ VENCEU!':gFirst(st.players[st.over].n).toUpperCase()+' VENCEU';
    g.font='900 26px Anybody, sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#000';g.fillText(t,SW/2+2,SH/2+2);g.fillStyle=st.over<0?'#ffd23f':mine?'#8fd42a':'#ff3d8b';g.fillText(t,SW/2,SH/2);g.textAlign='left';
  }
}
