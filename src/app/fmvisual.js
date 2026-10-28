/* ================= Rolê FM: o visual =================
 * Computador: um DIRIGÍVEL atravessa o céu (camada do céu, atrás da ilha), na cor do cartucho da sala, com telão
 * lateral (capa + título correndo em LED) e um alto-falante pendurado que pulsa. Só aparece com música tocando.
 * Celular: um PALCO na borda de trás da ilha (fora das casas onde dá para andar), com telão inclinado no grid e um
 * paredão de caixas. Cada cenário diz onde (stageSpot no catalog.js).
 * Tocar no dirigível ou no palco liga o "Ouvir junto". Tudo que é fixo é desenhado uma vez em cache.
 */
const FMVIS={sky:null,stage:null,notes:[],hulls:new Map(),stages:new Map(),leds:new Map(),glow:null,perf:{sky:0,stage:0,n:0}};

/* ---------- letreiro de LED: fonte 3x5 desenhada à mão ---------- */
/* cada letra: 5 linhas de 3 pontos */
const FM_FONT=(()=>{const g={"0":"### #.# #.# #.# ###","1":".#. ##. .#. .#. ###","2":"##. ..# .#. #.. ###","3":"##. ..# .#. ..# ##.","4":"#.# #.# ### ..# ..#","5":"### #.. ##. ..# ##.","6":".## #.. ### #.# ###","7":"### ..# .#. .#. .#.","8":"### #.# ### #.# ###","9":"### #.# ### ..# ##.","A":".#. #.# ### #.# #.#","B":"##. #.# ##. #.# ##.","C":".## #.. #.. #.. .##","D":"##. #.# #.# #.# ##.","E":"### #.. ##. #.. ###","F":"### #.. ##. #.. #..","G":".## #.. #.# #.# .##","H":"#.# #.# ### #.# #.#","I":"### .#. .#. .#. ###","J":"..# ..# ..# #.# .#.","K":"#.# #.# ##. #.# #.#","L":"#.. #.. #.. #.. ###","M":"#.# ### ### #.# #.#","N":"##. #.# #.# #.# #.#","O":".#. #.# #.# #.# .#.","P":"##. #.# ##. #.. #..","Q":".#. #.# #.# ##. .##","R":"##. #.# ##. #.# #.#","S":".## #.. .#. ..# ##.","T":"### .#. .#. .#. .#.","U":"#.# #.# #.# #.# ###","V":"#.# #.# #.# #.# .#.","W":"#.# #.# ### ### #.#","X":"#.# #.# .#. #.# #.#","Y":"#.# #.# .#. .#. .#.","Z":"### ..# .#. #.. ###","-":"... ... ### ... ...",".":"... ... ... ... .#.",",":"... ... ... .#. #..","!":".#. .#. .#. ... .#.","?":"##. ..# .#. ... .#.",":":"... .#. ... .#. ...","'":".#. .#. ... ... ...","&":".#. #.# .#. #.# .##","/":"..# ..# .#. #.. #..","(":".#. #.. #.. #.. .#.",")":".#. ..# ..# ..# .#.","@":"### #.# #.# #.. .##"," ":"... ... ... ... ..."};
  for(const k in g)g[k]=g[k].split(' ').join('');return g;})();
/* tira de LED com o texto (acesa) sobre a grade apagada; fica em cache por texto */
function fmLed(text,on,off){
  const key=text+'|'+on;let c=FMVIS.leds.get(key);if(c)return c;
  const t=' '+String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase()+'   ';
  c=document.createElement('canvas');c.width=t.length*4;c.height=5;const g=c.getContext('2d');
  g.fillStyle=off;for(let x=0;x<c.width;x++)for(let y=0;y<5;y++)if(x%4!==3)g.fillRect(x,y,1,1);
  g.fillStyle=on;[...t].forEach((ch,i)=>{const f=FM_FONT[ch]||FM_FONT[' '];for(let k=0;k<15;k++)if(f[k]==='#')g.fillRect(i*4+k%3,Math.floor(k/3),1,1);});
  if(FMVIS.leds.size>8)FMVIS.leds.delete(FMVIS.leds.keys().next().value);
  FMVIS.leds.set(key,c);return c;
}
/* desenha uma janela da tira correndo (x0,y0 = canto, w = largura visível) no contexto g */
function fmLedRun(g,strip,x0,y0,w,speed){
  const off=Math.floor((RM?0:now/speed)%strip.width);
  g.drawImage(strip,off,0,Math.min(w,strip.width-off),5,x0,y0,Math.min(w,strip.width-off),5);
  if(strip.width-off<w)g.drawImage(strip,0,0,w-(strip.width-off),5,x0+strip.width-off,y0,w-(strip.width-off),5);
}
/* chiado de TV (300 ms ao trocar de música) */
function fmStatic(g,x,y,w,h){for(let j=0;j<h;j+=1)for(let i=0;i<w;i+=2){const v=Math.random()*200|0;g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(x+i,y+j,2,1);}}

/* ---------- notinhas musicais em pixel (sobem e somem) ---------- */
const FM_NOTE=['..##','..#.','..#.','###.','##..'];
function fmNoteSpawn(list,x,y,max){if(RM||list.length>=max)return;list.push({x,y,vx:(Math.random()-.5)*.012,t:now,c:['#ff3d8b','#ffd23f','#43d9e8','#8fd42a'][Math.random()*4|0]});}
function fmNotesDraw(g,list,k,life){
  for(let i=list.length-1;i>=0;i--){const n=list[i],e=(now-n.t)/life;if(e>=1){list.splice(i,1);continue;}
    g.globalAlpha=1-e;g.fillStyle=n.c;const X=n.x+n.vx*(now-n.t)*k+Math.sin(e*6+i)*2*k,Y=n.y-e*36*k;
    FM_NOTE.forEach((row,y)=>{for(let x=0;x<4;x++)if(row[x]==='#')g.fillRect(Math.round(X+x*k),Math.round(Y+y*k),Math.ceil(k),Math.ceil(k));});}
  g.globalAlpha=1;
}

/* ============================================================ DIRIGÍVEL (computador) */
const FM_HW=140,FM_HH=70;   // tamanho do desenho em pixels de mundo
/* casco, aletas, gôndola e moldura do telão: um desenho por cor de sala (e por dia/noite, por causa das janelas) */
function fmHull(col,night){
  const key=col+(night?'N':'D');let c=FMVIS.hulls.get(key);if(c)return c;
  c=document.createElement('canvas');c.width=FM_HW;c.height=FM_HH;const g=c.getContext('2d');
  const ink='#1c1428',light=lt(col),dark=mul(col,.68),cx=66,cy=24,rx=58,ry=19;
  const half=y=>rx*Math.pow(Math.max(0,1-Math.pow(Math.abs(y)/ry,2.3)),1/2.3);
  // aletas (atrás, à esquerda)
  const fin=(pts,f)=>{g.fillStyle=ink;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.fillStyle=f;g.beginPath();pts.forEach(([x,y],i)=>{const[ax,ay]=[x+(x<20?1:-1),y+(y<cy?1:-1)];i?g.lineTo(ax,ay):g.moveTo(ax,ay);});g.closePath();g.fill();};
  fin([[6,2],[24,14],[24,20],[4,18]],dark);fin([[6,46],[24,34],[24,28],[4,30]],dark);
  // casco: contorno, 3 tons, faixa clara em cima, emendas
  for(let y=-ry-1;y<=ry+1;y++){const w=half(Math.max(-ry,Math.min(ry,y)))+1;g.fillStyle=ink;g.fillRect(Math.round(cx-w),cy+y,Math.round(w*2),1);}
  for(let y=-ry;y<=ry;y++){const w=half(y);if(w<1)continue;const t=y/ry;g.fillStyle=t<-.45?light:t>.42?dark:col;g.fillRect(Math.round(cx-w),cy+y,Math.round(w*2),1);}
  g.fillStyle='rgba(255,255,255,.35)';for(let x=cx-38;x<cx+34;x++)g.fillRect(x,cy-ry+3,1,2);
  g.fillStyle='rgba(0,0,0,.12)';for(let x=cx-44;x<cx+46;x+=12){const h=Math.round(half(0)*0)+ry*2-6;g.fillRect(x,cy-ry+4,1,h);}
  // gôndola com janelinhas
  g.fillStyle=ink;g.fillRect(48,42,38,10);g.fillStyle=mul(col,.55);g.fillRect(49,43,36,8);
  for(let i=0;i<5;i++){g.fillStyle=night?'#ffd890':'#bfe3fa';g.fillRect(52+i*7,45,4,3);}
  g.fillStyle=ink;g.fillRect(54,52,1,6);g.fillRect(79,52,1,6);   // cabos do alto-falante (o resto anima)
  // moldura do telão lateral
  g.fillStyle=ink;g.fillRect(34,8,74,32);g.fillStyle='#120c1c';g.fillRect(35,9,72,30);
  if(FMVIS.hulls.size>6)FMVIS.hulls.delete(FMVIS.hulls.keys().next().value);
  FMVIS.hulls.set(key,c);return c;
}
/* brilho do telão à noite (um gradiente feito uma vez) */
function fmGlow(){if(FMVIS.glow)return FMVIS.glow;const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,200,120,.55)');gr.addColorStop(1,'rgba(255,200,120,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return FMVIS.glow=c;}

/* chamado no fim do céu (sky): desenha em pixels da tela, atrás da ilha */
function fmSky(){
  FMVIS.sky=null;
  if(FMV.hide)return;
  if(mode!=='sala'||!FM.on||!FM.ok||!fmPlaying()||fmMobile()||!CUR)return;
  const t0=performance.now();
  const W=cv.width,H=cv.height,k=Math.max(1,Math.round(Math.min(scale,3*dpr))),cross=FMV.crossMs*(RM?2:1);
  const ph=(now%(cross*2))/cross,dir=ph<1?1:-1,u=ph<1?ph:ph-1,w=FM_HW*k,h=FM_HH*k;
  const pxX=-camX*scale,pxY=-camY*scale;
  let X=-w+u*(W+w*2);if(dir<0)X=W-u*(W+w*2);
  X=Math.round(X+pxX*.04);
  const Y=Math.round(H*.1+pxY*.03+(RM?0:Math.sin(now/1700)*3*k));
  if(X>W||X+w<0){FMVIS.perf.sky+=performance.now()-t0;return;}
  const night=!!(SCN&&SCN.night),hull=fmHull(cartColor(CUR.cena),night);
  sc.save();sc.imageSmoothingEnabled=false;
  // o casco vira para o lado em que anda (a aleta fica sempre atrás)
  if(dir<0){sc.translate(X+w,Y);sc.scale(-1,1);sc.drawImage(hull,0,0,w,h);}else sc.drawImage(hull,X,Y,w,h);
  sc.restore();
  sc.imageSmoothingEnabled=false;
  const L=(lx,ly)=>[dir>0?X+lx*k:X+(FM_HW-lx)*k,Y+ly*k];   // ponto do desenho → tela
  const R_=(lx,ly,lw,lh,col)=>{const[x,y]=L(dir>0?lx:lx+lw,ly);sc.fillStyle=col;sc.fillRect(Math.round(x),Math.round(y),Math.ceil(lw*k),Math.ceil(lh*k));};
  // telão: capa 28x28 e o título correndo em LED (o conteúdo nunca fica espelhado)
  const[tx,ty]=L(dir>0?36:106,9);
  const np=fmNp(),fresh=now-FM.changeAt<FMV.staticMs;
  if(fresh)fmStatic(sc,Math.round(tx),Math.round(ty),70*k,30*k);
  else{
    if(FM.covers)sc.drawImage(FM.covers.sq,Math.round(tx+k),Math.round(ty+k),28*k,28*k);else{sc.fillStyle='#2a1f45';sc.fillRect(Math.round(tx+k),Math.round(ty+k),28*k,28*k);}
    const strip=fmLed(np.title||'ROLÊ FM','#ffb02e','#3a2410');
    sc.save();sc.translate(Math.round(tx+32*k),Math.round(ty+12*k));sc.scale(k,k);fmLedRun(sc,strip,0,0,37,70);sc.restore();
    const strip2=fmLed('@'+(np.by||''),'#43d9e8','#10262a');
    sc.save();sc.translate(Math.round(tx+32*k),Math.round(ty+20*k));sc.scale(k,k);sc.drawImage(strip2,4,0,Math.min(37,strip2.width-4),5,0,0,Math.min(37,strip2.width-4),5);sc.restore();
  }
  if(night){sc.save();sc.globalCompositeOperation='lighter';sc.globalAlpha=.5;const gw=110*k;sc.drawImage(fmGlow(),Math.round(tx+35*k-gw/2),Math.round(ty+15*k-gw/3),gw,gw*.66);sc.restore();}
  // luzes de posição (piscam à noite)
  if(night&&Math.floor(now/600)%2){R_(dir>0?122:8,22,2,2,'#ff3a3a');R_(70,4,2,1,'#ffffff');}
  // alto-falante pendurado: corneta + cone que pulsa
  const beat=fmBeat(),sw=RM?0:Math.sin(now/900)*1.2;
  R_(52+sw,58,32,9,'#1c1428');R_(53+sw,59,30,7,'#3a3448');R_(60+sw,56,16,3,'#1c1428');
  const[cx,cy]=L(dir>0?68+sw:68+sw,62.5),r=(3.4+beat*1.2)*k;
  sc.fillStyle='#1c1428';sc.beginPath();sc.arc(Math.round(cx),Math.round(cy),r+k,0,7);sc.fill();sc.fillStyle='#6a6488';sc.beginPath();sc.arc(Math.round(cx),Math.round(cy),r,0,7);sc.fill();
  sc.fillStyle='#ffd23f';sc.fillRect(Math.round(cx-k/2),Math.round(cy-k/2),k,k);
  if(beat>.9&&Math.random()<.5)fmNoteSpawn(FMVIS.notes,cx,cy+4*k,FMV.notesSky);
  fmNotesDraw(sc,FMVIS.notes,k,1800);
  // "toque para ouvir" para quem ainda não está ouvindo
  if(!FM.listen){const s2=Math.max(1,Math.round(k/2)),up_=Y-6*k-20*s2>0;fmBalloon(sc,Math.round(X+w/2),up_?Math.round(Y-6*k):Math.round(Y+h+8*k+20*s2),k,!up_);}
  FMVIS.sky={x:X/dpr,y:Y/dpr,w:w/dpr,h:h/dpr};
  FMVIS.perf.sky+=performance.now()-t0;FMVIS.perf.n++;
}
/* balão "Toque para ouvir" (em pixels da tela) */
function fmBalloon(g,x,y,k,below){
  const s=Math.max(1,Math.round(k/2));g.font=`800 ${11*s}px Anybody, sans-serif`;const t='Toque para ouvir',w=g.measureText(t).width+16*s,h=20*s;
  const bx=Math.round(x-w/2),by=Math.round(y-h),bob=RM?0:Math.round(Math.sin(now/300)*2*s);
  g.fillStyle='#000';g.fillRect(bx+2*s,by+2*s+bob,w,h);g.fillStyle='#ffd23f';g.fillRect(bx,by+bob,w,h);g.fillStyle='#000';g.fillRect(bx,by+bob,w,2*s);g.fillRect(bx,by+h-2*s+bob,w,2*s);g.fillRect(bx,by+bob,2*s,h);g.fillRect(bx+w-2*s,by+bob,2*s,h);
  if(below)g.fillRect(Math.round(x)-3*s,by-3*s+bob,6*s,3*s);else g.fillRect(Math.round(x)-3*s,by+h+bob,6*s,3*s);g.textAlign='center';g.textBaseline='middle';g.fillText(t,Math.round(x),by+h/2+bob+s);g.textAlign='left';g.textBaseline='alphabetic';
}

/* ============================================================ PALCO (celular) */
/* o palco fica atrás da linha y=0 (borda de trás da ilha ou encostado na parede): nada muda nas casas de andar.
 * spot = { x: onde começa ao longo da parede, len: largura em casas (padrão 3) } */
function fmStageReg(spot){
  const x0=spot.x,len=spot.len||3,sid=B.id;
  B.furn.push({gx:x0,gy:-1.2,depth:x0-1.2,furn:true,draw:()=>fmStageDraw(sid,x0,len)});
  B.air.push(()=>fmStageAir(x0,len));
}
const FM_TEL={u0:.15,w:1.9,y:-.62,z0:24,h:38};   // telão: começa em x0+u0, largura w (casas), na linha y, de z0 até z0+h
/* caixas: [dx, dy, tamanho, andar, desalinho] relativos ao fim do telão */
const FM_BOX=[[0,-.85,.46,0,0],[.5,-.88,.46,0,.03],[0,-.85,.46,1,.02],[.5,-.88,.44,1,-.02],[.02,-.85,.44,2,.01],[.52,-.86,.42,2,0]];
const FM_SMALL=[[.08,-.32,.22],[.58,-.3,.22],[.12,-.85,.2,3],[.6,-.86,.2,3]];
function fmStageBounds(x0,len){
  const pts=[S(x0-.2,-1.3),S(x0+len+.2,-1.3),S(x0-.2,.1),S(x0+len+.2,.1)];
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  return{x:Math.floor(Math.min(...xs))-4,y:Math.floor(Math.min(...ys))-84,w:Math.ceil(Math.max(...xs)-Math.min(...xs))+8,h:Math.ceil(Math.max(...ys)-Math.min(...ys))+90};   // o desenho sobe uns 75 px acima do deque
}
/* o que não mexe: deque, colunas, moldura do telão, corpos das caixas */
function fmStageStatic(sid,x0,len){
  const key=sid+x0+'_'+len;let c=FMVIS.stages.get(key);if(c)return c;
  const bd=fmStageBounds(x0,len);c={bd,cv:document.createElement('canvas')};c.cv.width=bd.w*WS;c.cv.height=bd.h*WS;
  const prev=ctx;ctx=c.cv.getContext('2d');ctx.setTransform(WS,0,0,WS,-bd.x*WS,-bd.y*WS);
  // deque na borda
  box(x0-.1,-1.25,len+.2,1.2,6,0,'#4a3a5a','#2e2440','#241c34');
  for(let i=0;i<len*3;i++){const a=S(x0-.1+i/3,-1.25),b=S(x0-.1+i/3,-.05);ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a[0],a[1]-6);ctx.lineTo(b[0],b[1]-6);ctx.stroke();}
  // colunas e moldura do telão (painel no plano da parede, virado para a sala)
  const T=FM_TEL,tx=x0+T.u0;
  [tx+.06,tx+T.w-.12].forEach(px=>box(px,T.y-.06,.08,.08,T.z0,6,'#5a5468','#3a3646','#2a2636'));
  const o=S(tx,T.y);ctx.save();ctx.transform(1,.5,0,1,o[0],o[1]);
  const W_=T.w*32;R(-2,-T.z0-T.h-8,W_+4,T.h+4,'#000');R(0,-T.z0-T.h-6,W_,T.h,'#120c1c');
  R(-2,-T.z0-4,W_+4,2,'#3a3646');
  ctx.restore();
  // caixas grandes (2 colunas x 3 andares, levemente desalinhadas) e pequenas
  const bx0=tx+T.w+.08;
  FM_BOX.forEach(([dx,dy,s,lvl,mis])=>{if(bx0+dx+s>x0+len+.15)return;box(bx0+dx+mis,dy,s,s,s*30,6+lvl*s*30,'#3a3448','#26222f','#1e1a26');});
  FM_SMALL.forEach(([dx,dy,s,lvl])=>{if(bx0+dx+s>x0+len+.15)return;box(bx0+dx,dy,s,s,s*28,6+(lvl?lvl*.46*30:0),'#4a4458','#302c3a','#26222f');});
  // cabos no chão
  ctx.strokeStyle='#120c1c';ctx.lineWidth=1.2;const c1=up(S(tx+.3,T.y+.1),6),c2=up(S(bx0+.2,-.3),6);ctx.beginPath();ctx.moveTo(...c1);ctx.quadraticCurveTo((c1[0]+c2[0])/2,c1[1]+10,c2[0],c2[1]);ctx.stroke();
  ctx=prev;
  if(FMVIS.stages.size>4)FMVIS.stages.delete(FMVIS.stages.keys().next().value);
  FMVIS.stages.set(key,c);return c;
}
/* cone numa face virada para a sala (+y): desenhado uma vez por tamanho e nível de pulso (5 níveis) e só colado depois */
const FM_CONES=new Map();
function fmConeImg(r,lvl){
  const key=Math.round(r*4)+'_'+lvl;let c=FM_CONES.get(key);if(c)return c;
  const rr=r*(1+.14*lvl/4),W=Math.ceil(rr*2+6),H=Math.ceil(rr*3+6),cv_=document.createElement('canvas');cv_.width=W;cv_.height=H;
  const g=cv_.getContext('2d');g.setTransform(1,.5,0,1,W/2,H/2);
  g.fillStyle='#000';g.beginPath();g.ellipse(0,0,rr+1,rr+1,0,0,7);g.fill();g.fillStyle='#4a4458';g.beginPath();g.ellipse(0,0,rr,rr,0,0,7);g.fill();
  g.fillStyle='#1c1428';g.beginPath();g.ellipse(0,0,rr*.4,rr*.4,0,0,7);g.fill();
  c={cv:cv_,w:W,h:H};FM_CONES.set(key,c);return c;
}
function fmCone(fx,fy,z,r,beat){
  const c=fmConeImg(r,Math.round(Math.max(0,Math.min(1,beat))*4)),o=S(fx,fy);
  ctx.drawImage(c.cv,Math.round(o[0]-c.w/2),Math.round(o[1]-z-c.h/2));
}
function fmStageDraw(sid,x0,len){
  FMVIS.stage=null;
  if(FMV.hide)return;
  if(mode!=='sala'||!FM.on||!FM.ok||!fmMobile())return;
  const t0=performance.now();
  const st=fmStageStatic(sid,x0,len),bd=st.bd;
  if(bd.x>camX+vw()||bd.x+bd.w<camX||bd.y>camY+vh()||bd.y+bd.h<camY){FMVIS.perf.stage+=performance.now()-t0;return;}   // fora da tela
  ctx.drawImage(st.cv,bd.x,bd.y,bd.w,bd.h);
  const np=fmNp(),on=np.status!=='parado',beat=fmBeat(),T=FM_TEL,tx=x0+T.u0,W_=Math.round(T.w*32);
  // telão: desenhado numa tela pequena e já inclinado; refeito só a cada 70 ms (o ritmo do letreiro) e colado inteiro por quadro
  const o=S(tx,T.y),ty=-T.z0-T.h-6,th=T.h-4;
  if(!st.tvs||st.tvKey!==W_){st.tv=document.createElement('canvas');st.tv.width=W_;st.tv.height=th;st.tvs=document.createElement('canvas');st.tvs.width=W_;st.tvs.height=th+(W_>>1)+1;st.tvKey=W_;st.tvAt=-1e9;}
  if(now-st.tvAt>=70||now<st.tvAt){
    st.tvAt=now;const g=st.tv.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#120c1c';g.fillRect(0,0,W_,th);
    if(!on){const s=fmLed('ROLE FM','#5a3a1a','#24160c');g.drawImage(s,4,0,30,5,(W_-30)>>1,(th/2-3)|0,30,5);}
    else if(now-FM.changeAt<FMV.staticMs)fmStatic(g,0,0,W_,th-4);
    else{
      if(FM.covers)g.drawImage(FM.covers.wide,3,2,40,24);else{g.fillStyle='#2a1f45';g.fillRect(3,2,40,24);}
      g.fillStyle='#1a1030';g.fillRect(45,2,W_-48,24);g.fillStyle='#ff3d8b';g.fillRect(46,3,Math.round((W_-50)*Math.min(1,np.dur?fmCurPos()/np.dur:0)),2);
      const by=fmLed('@'+(np.by||''),'#43d9e8','#10262a');g.drawImage(by,4,0,Math.min(W_-52,by.width-4),5,47,8,Math.min(W_-52,by.width-4),5);
      fmLedRun(g,fmLed(np.title||'','#ffb02e','#3a2410'),3,29,W_-6,70);
    }
    const k=st.tvs.getContext('2d');k.clearRect(0,0,st.tvs.width,st.tvs.height);   // inclina: fatias de 2 px, cada uma 1 px mais baixa
    for(let x=0;x<W_;x+=2)k.drawImage(st.tv,x,0,2,th,x,x>>1,2,th);
  }
  ctx.drawImage(st.tvs,Math.round(o[0]),Math.round(o[1]+ty));
  // cones pulsando (as pequenas defasadas das grandes) e LED de status
  const bx0=tx+T.w+.08;
  FM_BOX.forEach(([dx,dy,s,lvl,mis],i)=>{if(bx0+dx+s>x0+len+.15)return;const fx=bx0+dx+mis+s/2,fy=dy+s,z=6+lvl*s*30+s*15;
    fmCone(fx,fy,z,s*9,on?beat:0);fmCone(fx,fy,z+s*11,s*3,on?beat:0);
    const p=up(S(fx+s*.35,fy),z-s*11);R(Math.round(p[0]),Math.round(p[1]),1,1,on&&(Math.floor(now/300)+i)%2?'#8fd42a':'#3a5a20');});
  const lag=on?Math.max(0,1-(((now/60000)*FMV.bpm+.5)%1)*1.8):0;
  FM_SMALL.forEach(([dx,dy,s,lvl])=>{if(bx0+dx+s>x0+len+.15)return;fmCone(bx0+dx+s/2,dy+s,6+(lvl?lvl*.46*30:0)+s*14,s*8,lag);});
  
  // notinhas saindo das caixas
  if(on&&beat>.9&&Math.random()<.4){const p=up(S(bx0+.45,-.4),70);fmNoteSpawn(FMVIS.stageNotes||(FMVIS.stageNotes=[]),p[0],p[1],FMV.notesStage);}
  if(FMVIS.stageNotes)fmNotesDraw(ctx,FMVIS.stageNotes,1,1600);
  
  FMVIS.stage={x:bd.x,y:bd.y,w:bd.w,h:bd.h,x0,len};
  FMVIS.perf.stage+=performance.now()-t0;FMVIS.perf.n++;
}
/* à noite, luzes coloridas que piscam no ritmo (somadas à luz, por cima do escuro) */
function fmStageAir(x0,len){
  if(!FMVIS.stage||FMVIS.stage.x0!==x0||!SCN.night&&!SCN.sc.dark||!fmPlaying())return;
  const beat=fmBeat();ctx.save();ctx.globalCompositeOperation='lighter';
  ['#ff3d8b','#43d9e8','#ffd23f'].forEach((c,i)=>{const[x,y]=up(S(x0+.5+i*(len-1)/2,-.5),40);glow(x,y,30+beat*12,c,.18+.25*beat*((i+Math.floor(now/500))%2),.6);});
  ctx.restore();
}

/* ---------- toque no dirigível ou no palco ---------- */
function fmHit(e,wx,wy){
  if(!FM.on||!FM.ok)return false;
  const s=FMVIS.sky;if(s){const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h){fmActivate();return true;}}
  const p=FMVIS.stage;if(p&&wx>=p.x&&wx<=p.x+p.w&&wy>=p.y+60&&wy<=p.y+p.h){fmActivate();return true;}
  return false;
}
/* balão sobre o palco (em pixels da tela, depois do mundo) */
function fmOverlay(){
  const p=FMVIS.stage;if(!p||FM.listen||!fmPlaying())return;
  const[x,y]=toScreen(p.x+p.w/2,p.y+92);fmBalloon(sc,x,y,2);
}
function fmVisDbg(){const n=Math.max(1,FMVIS.perf.n);return{ceu:FMVIS.sky&&{x:Math.round(FMVIS.sky.x),y:Math.round(FMVIS.sky.y),w:Math.round(FMVIS.sky.w)},palco:!!FMVIS.stage,msPorQuadro:+((FMVIS.perf.sky+FMVIS.perf.stage)/n).toFixed(3)};}
