/* ================= NPCs: gente que mora no cenário =================
 * Cada cenário registra os seus com npc(gx, gy, spec) no build. Eles aparecem como bonecos de verdade (o mesmo desenho
 * da galera), ficam em pé ou sentados, ou passeiam, e soltam uma fala de vez em quando no balão. Não contam como gente
 * na sala (são "bot") e ninguém clica neles. O que carregam (pano, viola, leque, coqueteleira) é desenhado por cima do boneco.
 * spec: { name, fig, face:'x'|'y'|'nx'|'ny', sit, lines:[…] | ()=>texto, every:[ms,ms], prop, shake:fn(a)->bool, wander:{x0,y0,x1,y1}, slow }
 */
const NPC_NOTES=['Dó','Ré','Mi','Fá','Sol','Lá','Si'];
const npcFig=o=>({...DEFAULT,g:0,b:1,alt:0,face:'na-boa',headwear:null,glasses:null,bag:null,neck:null,belt:null,top_over:null,...o});

function npc(gx,gy,spec){
  B.npcs.push({gx,gy,...spec});
  if(!spec.wander)B.blocked.add(key(gx,gy));
}
/* chamado ao entrar na sala: cria os bonecos dos NPCs do cenário */
function npcSpawn(){
  avatars=avatars.filter(a=>!a.npc);
  if(!SCN||!SCN.npcs)return;
  SCN.npcs.forEach((s,i)=>{
    const a=makeAv(s.name,s.fig,s.gx,s.gy,{bot:true});a.npc=s;a.seed=i*131+7;
    const f=FACES[s.face||'x'];a.back=f.back;a.mirror=f.mirror;
    if(s.sit){a.action='sit';a.sitKind=s.sit===2?2:1;}
    a.npcNext=now+1500+i*1700;a.next=now+3000;a.slowv=s.slow||0;
  });
}
const npcLine=(a,s)=>{const l=Array.isArray(s.lines)?s.lines[ri(s.lines.length)]:s.lines;return typeof l==='function'?l(a):l;};
function npcThink(a){
  WALK_NPC=true;try{npcThink_(a);}finally{WALK_NPC=false;}}
function npcThink_(a){
  const s=a.npc;
  if(now>=a.npcNext&&s.lines){
    a.bubble={text:npcLine(a,s),t:now};
    const[lo,hi]=s.every||[7000,14000];a.npcNext=now+lo+Math.random()*(hi-lo);
  }
  if(s.wander&&!a.path.length&&now>=a.next){   // passeia por dentro da área e para um pouco
    a.next=now+2500+Math.random()*5500;
    const w=s.wander;
    for(let k=0;k<20;k++){const x=w.x0+ri(w.x1-w.x0+1),y=w.y0+ri(w.y1-w.y0+1);
      if(walkable(x,y,x,y)&&!occupied(x,y,a)&&walkTo(a,x,y))break;}
  }
}
/* a pose do NPC: sobrescreve a padrão quando o NPC tem pose própria */
function npcPose(a){const s=a.npc;return s&&s.pose?s.pose(a):null;}

/* adereços, em pixels do boneco (ox,oy = canto de cima à esquerda do desenho; pés em y=240, centro em x=56) */
function npcProp(a,ox,oy){
  const s=a.npc;if(!s||!s.prop)return;
  const g=ctx,R_=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(ox+x),Math.round(oy+y),w,h);};
  const sit=a.action==='sit'?24:0;
  if(s.prop==='pano'){   // pano de prato xadrez vermelho no ombro, pendurado na frente
    R_(31,80,18,6,'#6a1a1a');R_(32,81,16,4,'#c23b3b');R_(30,86,20,50,'#5a1414');
    for(let y=0;y<46;y+=6)for(let x=0;x<18;x+=6){R_(31+x,87+y,6,6,(x+y)%12?'#fff3e0':'#c23b3b');}
    R_(31,134,18,3,'#5a1414');
  }else if(s.prop==='viola'){   // viola no colo, braço para cima
    g.save();g.translate(Math.round(ox+66),Math.round(oy+178+(a.sitKind===2?30:0)));g.rotate(-.5);
    g.fillStyle='#1c0c04';g.beginPath();g.ellipse(0,0,25,19,0,0,7);g.fill();g.beginPath();g.ellipse(-16,3,16,15,0,0,7);g.fill();
    g.fillStyle='#b8743a';g.beginPath();g.ellipse(0,0,23,17,0,0,7);g.fill();g.beginPath();g.ellipse(-16,3,14,13,0,0,7);g.fill();
    g.fillStyle='#e0a064';g.beginPath();g.ellipse(2,-3,12,7,0,0,7);g.fill();
    g.fillStyle='#1c0c04';g.beginPath();g.arc(-6,0,5,0,7);g.fill();   // boca
    g.fillStyle='#241008';g.fillRect(20,-4,62,7);g.fillStyle='#8a5a30';g.fillRect(20,-3,62,4);                    // braço
    g.fillStyle='#241008';g.fillRect(80,-7,15,12);g.fillStyle='#d8c08a';[0,4,8].forEach(k=>g.fillRect(84+k,-10,2,5));   // cabeça e tarraxas
    g.fillStyle='#e8e0c8';g.fillRect(-14,-1,100,1);g.restore();
  }else if(s.prop==='leque'){   // leque aberto na mão
    const f=Math.sin(now/700+a.seed)*.12;
    g.save();g.translate(Math.round(ox+82),Math.round(oy+148-sit));g.rotate(-.9+f);
    for(let k=-5;k<=5;k++){g.rotate(.11);g.fillStyle=k%2?'#c8283a':'#f2efe9';g.fillRect(-2,-34,4,32);}
    g.restore();g.save();g.translate(Math.round(ox+82),Math.round(oy+148-sit));g.rotate(-.9+f);
    g.strokeStyle='#d8a63a';g.lineWidth=2;g.beginPath();g.arc(0,0,34,-1.75,-.6);g.stroke();g.restore();
  }else if(s.prop==='shaker'){   // coqueteleira: balança no alto quando está "fazendo o dring"
    const sh=s.shake&&s.shake(a);const dx=sh?Math.round(Math.sin(now/60)*5):0,dy=sh?Math.round(Math.cos(now/60)*6):0;
    const x=sh?86:78,y=sh?42:132;
    R_(x+dx,y+dy,12,28,'#1c1428');R_(x+1+dx,y+1+dy,10,26,'#c9ced8');R_(x+1+dx,y+1+dy,3,26,'#f2f4fa');R_(x+dx-1,y+dy-5,14,6,'#1c1428');R_(x+dx,y+dy-4,12,4,'#8a90a0');
    if(sh)for(let k=0;k<3;k++){const p=((now/300)+k/3)%1;g.globalAlpha=1-p;R_(x+4+dx+(k-1)*8,y-14-p*16,3,3,['#ff3d8b','#43d9e8','#ffd23f'][k]);g.globalAlpha=1;}
  }
}

/* ---------- os NPCs de cada cenário ---------- */
const NPC_BALCAO=['Fiado só amanhã!','Mais uma gelada?','Hoje tem pastel de carne e queijo.','Sinuca é cultura, meu amigo.','Quem pediu a saideira?',
  'Esse bar já viu de tudo… e não conta nada.','Cuidado com a bola oito!','Tá quente? Eu também.','O jogo do Timão é hoje, hein.','Cerveja estupidamente gelada!',
  'Aqui é família: paga e some.','Tem coxinha fresquinha saindo.','Sem confusão, que o Zé tá de olho.'];
const NPC_VIOLA=[()=>'Agora sai!',()=>'Agora sim é '+NPC_NOTES[ri(7)]+'!',()=>'Peraí, essa corda tá frouxa…',()=>'Ré… não, '+NPC_NOTES[ri(7)]+'!',
  ()=>'A prima tá desafinada, calma.',()=>'Agora vai, agora vai… '+NPC_NOTES[ri(7)]+'!',()=>'Silêncio que o artista tá afinando.',()=>'Quase… falta só um pouquinho.',
  ()=>'Agora sim é '+NPC_NOTES[ri(7)]+' sustenido!'];
const NPC_BARMAN=['Um martini combina com você.','Dring dring! Saiu mais um.','Você não é um drinque, mas me deixa tonto.','Qual o seu veneno hoje?',
  'Tem espelho aqui? Porque só vejo você.','O seu sorriso tá pedindo um mojito.','Você veio de longe? Porque sua beleza é de outro mundo.',
  'Cuidado: o gelo derrete, mas eu não.','Meu drinque especial leva o seu nome.','Vem cá, te preparo algo que não está no cardápio.','Mais um cosmopolitan?'];
const NPC_GEISHA=['…','Que graminha bonita.','*abana o leque*','Hm, o capim cresceu.','Silêncio é ouro.','Que dia bonito para ver a grama.'];

/* ---------- bichos novos: o panda do templo e o dragão-de-Komodo do vulcão (desenhados por geometria e com contorno automático) ---------- */
function petGrid(W,H,paint){
  const g=Array.from({length:H},()=>Array(W).fill('.'));
  const set=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<W&&y>=0&&y<H)g[y][x]=c;};
  const ell=(cx,cy,rx,ry,c)=>{for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)set(x,y,c);};
  paint(set,ell);
  const o=g.map(r=>r.slice());
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(g[y][x]==='.'&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>(g[y+dy]||[])[x+dx]&&g[y+dy][x+dx]!=='.'))o[y][x]='o';
  return o.map(r=>r.join(''));
}
PET_ART.panda={legs:12,talk:'*nhac nhac bambu*',art:petGrid(25,17,(set,ell)=>{
  [[4,13,1.6,2.4],[8,13.5,1.6,2],[13,13,1.6,2.4],[16.5,13.5,1.6,2]].forEach(([x,y,rx,ry])=>ell(x,y,rx,ry,'k'));   // as quatro patas pretas
  ell(10,9.5,8,5,'w');ell(13.5,9.5,2.4,4,'k');                                                                  // corpo e a faixa preta dos ombros
  ell(19,7,4.4,3.8,'w');ell(16,3.2,1.6,1.6,'k');ell(22,3.2,1.6,1.6,'k');                                         // cabeça e orelhas
  ell(17.4,7,1.2,1.6,'k');ell(20.8,7,1.2,1.6,'k');set(17.6,6.5,'w');set(21,6.5,'w');set(23,8,'k');set(22.4,8.6,'k');   // olhos e nariz
})};
PET_ART.dragao={legs:10,talk:'*sssss*',art:petGrid(32,15,(set,ell)=>{
  for(let x=1;x<=13;x++)ell(x,8.4-(13-x)*.05,.9,.8+x*.15,'b');                                                   // cauda que afina
  [[12,10],[14.6,10],[20,10],[22.6,10]].forEach(([x,y])=>{ell(x,y+1.2,.9,2,'d');set(x-1,y+3,'d');set(x+1,y+3,'d');});   // patas
  ell(17,7.5,7.4,3.4,'b');ell(17,9,6.4,1.4,'l');ell(26,6.6,4.2,2.3,'b');ell(29.8,7.2,2.4,1.4,'b');                // corpo, barriga, cabeça e focinho
  for(let x=10;x<=22;x+=2){set(x,3.8,'d');set(x,4.6,'d');}                                                       // espinhos nas costas
  set(27,5.6,'y');set(27.8,5.6,'k');set(31,6.6,'k');set(31.8,8.2,'p');set(32.4,8.8,'p');
})};

/* dragão: de tempos em tempos solta fogo para a frente por ~1,3 s; quem estiver na frente queima por 1,5 s */
function dragonThink(p){
  if(!p.fireAt)p.fireAt=now+4000+Math.random()*5000;
  if(p.fire&&now-p.fire.t>p.fire.dur){p.fire=null;}
  if(!p.fire&&now>=p.fireAt){
    p.fire={t:now,dur:1400,hit:false};p.fireAt=now+7000+Math.random()*7000;p.path=[];
    p.bubble={text:'*RAAAWR!*',t:now};
  }
  if(p.fire&&!p.fire.hit&&now-p.fire.t>400&&me&&mode==='sala'&&!(me.burnUntil>now)){
    p.fire.hit=true;
    const dir=p.mirror?-1:1,dx=(me.sx-p.sx)*dir,dy=me.sy-p.sy;
    if(dx>-4&&dx<75&&Math.abs(dy)<28+dx*.18){   // na frente do bicho, dentro do cone das chamas
      me.burnUntil=now+LV_BURN;me.path=[];me.onArrive=null;me.bubble={text:'AI! QUEIMEI!',t:now};
      if(me.action==='sit')me.action=null;
      if(live&&live.send)live.send('lava',{t:'fire'});pushPres();
    }
  }
}
function dragonFlames(p,sx,sy,spr){
  const dir=p.mirror?-1:1,e=(now-p.fire.t)/p.fire.dur,x0=sx+dir*(spr.width/2-1),y0=sy-spr.height+6;
  const grow=Math.min(1,e*4),fade=e>.75?(1-e)/.25:1;
  for(let i=0;i<22;i++){
    const t=((now/260)+i/22)%1,len=70*grow*t,sp=3+t*13,x=x0+dir*len,y=y0+Math.sin(i*5.1+now/90)*sp*.5+t*4;
    ctx.globalAlpha=Math.max(0,fade*(1-t*.55));
    ctx.fillStyle=t<.25?'#fff0a0':t<.55?'#ffb02e':t<.8?'#ff6a1a':'#c8280a';
    const r_=2+t*5.5;ctx.beginPath();ctx.arc(Math.round(x),Math.round(y),r_,0,7);ctx.fill();
  }
  ctx.globalAlpha=1;
}
