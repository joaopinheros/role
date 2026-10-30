/* ================= props novos (v3): boteco, pijama, balada, piscina ================= */

/* ---------- piscina: dá para entrar. As casas da água deixam de ser bloqueadas e viram "nado" ---------- */
function swimIn(x0,y0,w,d){
  B.swim=B.swim||new Set();
  for(let i=0;i<w;i++)for(let j=0;j<d;j++){B.blocked.delete(key(x0+i,y0+j));B.swim.add(key(x0+i,y0+j));}
}
const swimAt=a=>SCN&&SCN.swim&&SCN.swim.has(key(Math.round(a.fx),Math.round(a.fy)));

/* ---------- TV e telas do Rolê FM (mostram capa e título; tocar nelas liga o "Ouvir junto") ---------- */
/* TV de móvel de 2 casas contra a parede de trás (o player do YouTube fica no quadro do canto: o YouTube exige player visível) */
function fmTv(gx,gy,w){
  w=w||2;for(let i=1;i<w;i++)B.blocked.add(key(gx+i,gy));
  addF(gx,gy,()=>{
    bx(gx+.04,gy+.18,w-.08,.64,18,0,'#4a3424');box(gx+.02,gy+.14,w-.04,.72,3,18,'#6a4a32','#4a3424','#3a2a1c');
    box(gx+.1,gy+.3,w-.2,.14,50,21,'#1a1a20','#101014','#15151a');
    const D=S(gx+.1,gy+.44),W_=Math.round((w-.2)*32);
    ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);R(3,-68,W_-6,44,'#000');fmScreen(ctx,5,-66,W_-10,40);R(W_/2-6,-21,12,2,'#3a3a44');ctx.restore();
    FMVIS.tvs.set('tv'+gx+'_'+gy,{x:D[0],y:D[1]-70,w:W_,h:W_/2+30});
  },{block:true,dz:(w-1)/2+.05});
  glowG(gx+w/2,gy+1.2,80,'#9fd8ff',.22,1);
}
/* tela grande na parede de trás (balada): w casas de largura, h px de altura, z px do chão */
function fmWallScreen(gx,w,h,z){
  addF(gx,0,()=>{onA(gx,()=>{const W_=w*32;R(-3,-z-h-3,W_+6,h+6,'#000');R(-1,-z-h-1,W_+2,h+2,'#1a1a24');fmScreen(ctx,1,-z-h+1,W_-2,h-2);
    for(let k=0;k<w*2;k++)R(k*16+4,-z-h-6,6,3,'#2a2a34');});
    const o=S(gx,0);FMVIS.tvs.set('wall'+gx,{x:o[0],y:o[1]-z-h-4,w:w*32,h:h+w*16});},{block:false,dz:w/2});
  glowG(gx+w/2,1.5,110,'#ff8fc7',.2,1);
}

/* ---------- placar do truco na parede (ao vivo; no fim mostra os campeões) ---------- */
function wallBoard(gx,gy,actId){
  addF(gx,gy,()=>{onA(gx,()=>{
    R(-3,-110,100,64,'#000');R(-1,-108,96,60,'#1d3a2a');R(1,-106,92,56,'#244a34');
    ctx.font='900 8px Anybody, sans-serif';ctx.textBaseline='middle';ctx.fillStyle='#f2efe9';ctx.fillText('PLACAR DO TRUCO',17,-100);
    const st=G.acts[actId],m=st&&st.m&&(st.status==='playing'||st.status==='over')?st.m:null,last=TRUCO_LAST;
    const nm=(i,j)=>st&&st.players&&st.players[i]&&st.players[j]?gFirst(st.players[i].n).slice(0,5)+' & '+gFirst(st.players[j].n).slice(0,5):'';
    if(m){
      ctx.font='800 6px Anybody, sans-serif';ctx.fillStyle='#ffd23f';ctx.fillText(nm(0,2),5,-91);ctx.fillStyle='#8fd8ff';ctx.fillText(nm(1,3),5,-61);
      ctx.font='900 18px Anybody, sans-serif';ctx.fillStyle='#ffd23f';ctx.fillText(String(m.score[0]),68,-86);ctx.fillStyle='#8fd8ff';ctx.fillText(String(m.score[1]),68,-62);
      const rs=m.rounds||[];[0,1,2].forEach(k=>{const w=rs[k];R(5+k*14,-80,11,11,'#0e1c14');if(w!=null)R(7+k*14,-78,7,7,w<0?'#8a8a8a':w===0?'#ffd23f':'#8fd8ff');});
      ctx.font='700 6px Anybody, sans-serif';ctx.fillStyle='#f2efe9';ctx.fillText('rodadas',5,-66+10);ctx.fillText('vale '+m.stake,46,-56);
    }else if(last&&Date.now()-last.at<10*60e3){
      ctx.font='900 8px Anybody, sans-serif';ctx.fillStyle='#ffd23f';ctx.fillText('CAMPEÕES',5,-90);
      R(66,-93,22,22,'#ffd23f');R(70,-71,14,3,'#d8a020');R(75,-76,4,6,'#d8a020');R(64,-90,4,10,'#d8a020');R(86,-90,4,10,'#d8a020');
      ctx.font='900 8px Anybody, sans-serif';ctx.fillStyle='#f2efe9';ctx.fillText(last.names[0],5,-78);ctx.fillText(last.names[1],5,-66);
      ctx.font='700 7px Anybody, sans-serif';ctx.fillStyle='#8fd8ff';ctx.fillText(last.score,5,-55);
    }else{ctx.font='700 7px Anybody, sans-serif';ctx.fillStyle='#9ab8a4';ctx.fillText('mesa livre',28,-78);ctx.fillText('4 pra jogar',26,-66);}
    ctx.textBaseline='alphabetic';
  });},{block:false,dz:1});
}

/* ---------- boteco ---------- */
function cueRack(gx){   // tacos escorados na parede de trás
  addF(gx,0,()=>{onA(gx,()=>{
    R(-2,-30,34,3,'#3a2416');R(-2,-8,34,3,'#3a2416');
    [[4,0],[11,0],[18,2],[25,3]].forEach(([x,t],i)=>{const h=92-i*3;ctx.save();ctx.translate(x,0);ctx.transform(1,0,t/60,1,0,0);
      R(0,-h,3,h,'#c98a4a');R(0,-h,3,12,'#e6b070');R(0,-h+12,3,2,'#241408');R(0,-14,3,14,'#241408');R(0,-h,3,2,'#5a8ad8');ctx.restore();});
  });},{block:false,dz:.2});
}
function baleiro(gx,gy){   // pote de balas em cima do balcão
  addF(gx,gy,()=>{const c=up(S(gx+.5,gy+.55),36);
    R(c[0]-6,c[1]-18,12,2,'#c23b3b');R(c[0]-7,c[1]-16,14,16,'rgba(210,235,255,.55)');R(c[0]-7,c[1]-16,1,16,'rgba(255,255,255,.8)');
    ['#ff4f9a','#ffd23f','#43d9e8','#8fd42a','#ff7a3a','#fff'].forEach((col,i)=>{R(c[0]-5+(i%3)*4,c[1]-12+Math.floor(i/3)*5+(i%2),3,3,col);R(c[0]-5+(i%3)*4,c[1]-4+(i%2),3,3,col);});
    R(c[0]-6,c[1]-1,12,2,'#8a5a3a');},{block:false,dz:.3});
}
function beerCrates(gx,gy,n){   // caixas de cerveja empilhadas
  addF(gx,gy,()=>{for(let k=0;k<(n||3);k++){
      box(gx+.12,gy+.18,.76,.64,13,k*13,'#d8b030','#b08a22','#8a6a18');
      const D=S(gx+.12,gy+.82);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);R(3,-k*13-10,22,6,'#c23b3b');R(5,-k*13-9,18,1,'#fff3d0');ctx.restore();
      const t=up(S(gx+.5,gy+.5),k*13+13);for(let i=0;i<6;i++)R(Math.round(t[0])-9+(i%3)*7-(Math.floor(i/3)*3),Math.round(t[1])-3+Math.floor(i/3)*3,3,3,['#5a3a1a','#3a5a1a'][(i+k)%2]);}
  });}
function sambaPainting(x,y){   // quadro: uma sambista com turbante, brincos de argola e microfone (pintura em plano da parede)
  R(x-3,y-3,48,64,'#2a1a10');R(x-1,y-1,44,60,'#d8a63a');R(x,y,42,58,'#f0c870');
  for(let k=0;k<5;k++)R(x+2+k*8,y+2,3,54,'rgba(255,255,255,.12)');
  R(x+8,y+46,26,12,'#c23b3b');R(x+10,y+44,22,4,'#e0584a');                  // blusa
  R(x+15,y+40,12,8,'#9a5a30');                                                // pescoço
  R(x+11,y+18,20,24,'#a8683a');R(x+12,y+20,18,20,'#b87a46');                  // rosto
  R(x+9,y+8,24,12,'#f6f2ea');R(x+7,y+12,6,10,'#f6f2ea');R(x+10,y+9,22,3,'#3a6ad8');R(x+10,y+14,22,2,'#3a6ad8');   // turbante
  R(x+14,y+26,4,2,'#1c1010');R(x+24,y+26,4,2,'#1c1010');R(x+15,y+25,2,1,'#fff');R(x+25,y+25,2,1,'#fff');           // olhos
  R(x+19,y+33,6,3,'#c8283a');R(x+19,y+35,6,1,'#8a1a22');                      // batom
  R(x+8,y+32,3,3,'#ffd23f');R(x+8,y+35,3,3,'#ffd23f');R(x+32,y+32,3,3,'#ffd23f');R(x+32,y+35,3,3,'#ffd23f');         // argolas
  R(x+28,y+40,4,12,'#1c1428');R(x+27,y+37,6,5,'#8a8aa0');                     // microfone
  R(x+8,y+51,26,6,'#fff7d6');R(x+10,y+52,22,4,'#8a5a30');                     // plaquinha
}
let TRUCO_LAST=null;   // último campeão do truco (para o placar da parede)

/* ---------- noite do pijama ---------- */
function posterSailor(x,y){   // pôster de uma guerreira de marinheiro (cabelo loiro em coques e marias-chiquinhas)
  R(x-2,y-2,48,68,'#000');R(x,y,44,64,'#ff9ccd');R(x,y,44,6,'#ffc2e0');
  [[6,10],[36,8],[38,40],[5,44],[30,56],[10,28]].forEach(([a,b])=>{R(x+a,y+b,3,1,'#fff');R(x+a+1,y+b-1,1,3,'#fff');});
  R(x+30,y+6,8,8,'#fff1a8');R(x+33,y+6,6,7,'#ff9ccd');                          // lua crescente
  R(x+7,y+14,8,8,'#ffe27a');R(x+29,y+14,8,8,'#ffe27a');R(x+8,y+12,6,3,'#ffe27a');R(x+30,y+12,6,3,'#ffe27a');          // coques
  R(x+4,y+20,5,40,'#ffe27a');R(x+35,y+20,5,40,'#ffe27a');R(x+11,y+17,22,10,'#ffe27a');                              // maria-chiquinhas e franja
  R(x+13,y+24,18,14,'#ffe0c8');R(x+14,y+21,16,3,'#ffe27a');R(x+19,y+19,6,4,'#ff4f8a');R(x+20,y+20,4,2,'#ffd23f');   // rosto e tiara
  R(x+16,y+29,3,3,'#3a6ad8');R(x+25,y+29,3,3,'#3a6ad8');R(x+20,y+34,4,1,'#e0584a');                                 // olhos e boca
  R(x+14,y+38,16,10,'#f6f2ea');R(x+10,y+38,24,5,'#2f5fd0');R(x+19,y+42,6,5,'#ff3d6a');                              // blusa, gola e laço
  R(x+11,y+48,22,9,'#2f5fd0');R(x+13,y+57,5,6,'#ffe0c8');R(x+26,y+57,5,6,'#ffe0c8');R(x+12,y+61,7,3,'#c8283a');R(x+25,y+61,7,3,'#c8283a');
}
function posterCruz(x,y){   // pôster de pijama: lua dorminhoca com gorrinho, estrelas e nuvem num céu lilás
  R(x-2,y-2,44,60,'#000');R(x,y,40,56,'#8f7ae6');R(x,y,40,22,'#6f5bd0');R(x,y+22,40,12,'#a794f0');
  [[5,5],[30,4],[33,16],[6,18],[22,9]].forEach(([a,b],i)=>{R(x+a,y+b,2,2,'#fff7c2');if(i%2===0){R(x+a-1,y+b,4,1,'#fff7c2');R(x+a,y+b-1,2,4,'#fff7c2');}});
  R(x+11,y+10,17,17,'#ffe27a');R(x+12,y+9,15,19,'#ffe27a');R(x+19,y+11,11,14,'#8f7ae6');R(x+21,y+10,9,16,'#8f7ae6');   // lua crescente
  R(x+14,y+16,3,1,'#6a4a9a');R(x+14,y+19,2,2,'#ff9ccd');                                                              // olho fechado e bochecha
  R(x+8,y+7,10,3,'#ff6fae');R(x+10,y+5,6,2,'#ff6fae');R(x+15,y+3,3,3,'#fff');                                           // gorrinho de dormir
  R(x+4,y+36,32,10,'#fdf4ff');R(x+8,y+33,12,5,'#fdf4ff');R(x+18,y+31,12,7,'#fdf4ff');R(x+4,y+43,32,3,'#e4d8f7');       // nuvem
  R(x+26,y+22,6,1,'#fff');R(x+29,y+22,1,3,'#fff');R(x+26,y+25,6,1,'#fff');                                              // z
  R(x+4,y+49,32,2,'#ffc2e0');R(x+10,y+52,20,1,'#ffc2e0');
}
function desk(gx,gy){   // escrivaninha com luminária, planta e livros
  addF(gx,gy,()=>{
    bx(gx+.08,gy+.2,.08,.6,26,0,'#8a5a3a');bx(gx+.84,gy+.2,.08,.6,26,0,'#8a5a3a');
    box(gx+.04,gy+.14,.92,.72,3,26,'#c99260','#a87444','#8e5c35');
    box(gx+.12,gy+.22,.3,.5,10,10,'#a87444','#8a5c35','#6a4222');              // gaveta
    const t=up(S(gx+.5,gy+.5),29);
    R(t[0]-14,t[1]-5,9,5,'#c23b3b');R(t[0]-14,t[1]-9,9,4,'#3f62c4');R(t[0]-14,t[1]-12,9,3,'#e8708a');                    // livros
    R(t[0]+2,t[1]-2,1,2,'#3a3646');R(t[0]-1,t[1]-18,2,16,'#3a3646');R(t[0]-6,t[1]-24,14,6,'#ff8fc7');R(t[0]-4,t[1]-26,10,3,'#ffc2e0');   // luminária
    R(t[0]+9,t[1]-8,9,8,'#e8708a');R(t[0]+8,t[1]-10,11,3,'#c85a76');
    [[0,-14,5,'#3fae6e'],[-5,-12,4,'#2f8f5b'],[5,-12,4,'#3fae6e']].forEach(([dx,dy,r,c])=>circ(t[0]+13+dx,t[1]+dy,r,c));  // plantinha
  },{block:true,dz:.1});
  glowG(gx+.5,gy+.5,60,'#ffc2e0',.18);
}
function taioba(gx,gy){   // planta de folha grossa e grande (taioba / orelha-de-elefante)
  addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);bx(gx+.28,gy+.28,.44,.44,14,0,'#c46a3d');
    const L=[[-16,-52,17,'#1f7a46'],[14,-58,18,'#2f9a58'],[-4,-76,17,'#3fb06a'],[-22,-34,12,'#2f9a58'],[22,-36,13,'#1f7a46']];
    L.forEach(([dx,dy,r,col])=>{R(Math.round(c[0]+dx*.3)-1,Math.round(c[1]+dy*.6),2,Math.abs(dy)*.55|0,'#1d5a38');
      ctx.fillStyle='#103a24';ctx.beginPath();ctx.ellipse(c[0]+dx,c[1]+dy,r+1.5,r*.78+1.5,.25,0,7);ctx.fill();
      ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(c[0]+dx,c[1]+dy,r,r*.78,.25,0,7);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.16)';ctx.beginPath();ctx.ellipse(c[0]+dx-r*.25,c[1]+dy-r*.2,r*.45,r*.3,.25,0,7);ctx.fill();
      ctx.strokeStyle='rgba(10,50,30,.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(c[0]+dx-r*.7,c[1]+dy+r*.2);ctx.lineTo(c[0]+dx+r*.7,c[1]+dy-r*.2);ctx.stroke();});
  },{block:true});
}
function teddy(gx,gy,col,fx,fy,z){   // ursinho de pelúcia (em pé ou em cima de algo: z = altura)
  addF(gx,gy,()=>{const c=up(S(gx+(fx==null?.5:fx),gy+(fy==null?.5:fy)),z||0),d=mul(col,.72),l=lt(col);
    ell(c[0],c[1]+1,7,3,'rgba(0,0,0,.2)');
    R(c[0]-6,c[1]-9,12,9,'#1c1428');R(c[0]-5,c[1]-8,10,8,col);R(c[0]-3,c[1]-5,6,4,l);                              // corpo
    R(c[0]-8,c[1]-8,3,5,col);R(c[0]+5,c[1]-8,3,5,col);R(c[0]-5,c[1]-1,3,2,d);R(c[0]+2,c[1]-1,3,2,d);                // braços e pés
    R(c[0]-6,c[1]-17,12,9,'#1c1428');R(c[0]-5,c[1]-16,10,8,col);R(c[0]-7,c[1]-18,4,4,d);R(c[0]+3,c[1]-18,4,4,d);    // cabeça e orelhas
    R(c[0]-3,c[1]-13,6,4,l);R(c[0]-2,c[1]-14,1,1,'#1c1428');R(c[0]+1,c[1]-14,1,1,'#1c1428');R(c[0]-1,c[1]-12,2,1,'#1c1428');
    R(c[0]-4,c[1]-8,8,2,'#ff4f8a');                                                                              // laço
  },{block:false,dz:.4});
}
function cushion(gx,gy,col){   // almofada grande no chão para sentar
  B.seats.set(key(gx,gy),{...FACES.y,kind:2});
  addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);ell(c[0],c[1]+2,17,8,'rgba(0,0,0,.18)');ell(c[0],c[1],16,8,mul(col,.78));ell(c[0],c[1]-3,15,8,col);ell(c[0],c[1]-4,6,3,lt(col));
    R(Math.round(c[0])-1,Math.round(c[1])-6,2,2,'#fff');},{block:false,dz:-.01});
}
function snackTable(gx,gy,w){   // mesa de comida: brigadeiros, bolo, pipoca e suco
  table(gx,gy,w||2,1,16,'#ffd0e2',[[gx+.35,gy+.45,'bolo'],[gx+.95,gy+.5,'pipoca'],[(gx+(w||2))-.55,gy+.4,'copo','#ff4f8a'],[gx+1.4,gy+.6,'prato','#8a4a2a']]);
}

/* ---------- balada ---------- */
function speakerSeat(gx,gy){   // caixa de som no chão onde dá para sentar
  B.seats.set(key(gx,gy),{...FACES.y,kind:1});
  addF(gx,gy,()=>{box(gx+.12,gy+.12,.76,.76,14,0,'#3a3540','#2a2630','#201d26');
    const D=S(gx+.12,gy+.88);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);
    circ(14,-8,6*(1+.1*beatPulse),'#141018');circ(14,-8,3,'#5a5468');R(2,-13,2,2,'#43d9e8');R(24,-13,2,2,'#ff4fa3');ctx.restore();},{block:false,dz:-.01});
}
/* focos móveis: feixes coloridos que varrem a pista (só em lugar escuro) */
function laserShow(){B.air.push(()=>{
  if(!SCN.night&&!SCN.sc.dark)return;
  ctx.save();ctx.globalCompositeOperation='lighter';
  const cols=['#ff4fa3','#43d9e8','#ffd23f','#8fd42a','#c9a5ff','#ff7a3a'];
  for(let k=0;k<6;k++){
    const src=up(S(2.5+k*1.4,6.5),176),t=(RM?k*900:now)*.0006,tx=S(4+3*Math.sin(t*(1+k*.13)+k*2),6+2.5*Math.cos(t*(.9+k*.1)+k)),w=14+8*beatPulse;
    ctx.globalAlpha=.07+.05*beatPulse;ctx.fillStyle=cols[k];ctx.beginPath();ctx.moveTo(src[0]-3,src[1]);ctx.lineTo(src[0]+3,src[1]);ctx.lineTo(tx[0]+w,tx[1]);ctx.lineTo(tx[0]-w,tx[1]);ctx.fill();
    ctx.globalAlpha=.3+.2*beatPulse;ctx.beginPath();ctx.ellipse(tx[0],tx[1],w,w*.45,0,0,7);ctx.fill();
  }
  ctx.restore();});}
