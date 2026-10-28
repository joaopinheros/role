
/* ================= catálogo de cenários (v2) ================= */
Object.assign(FLOOR,{
  sand:(gx,gy,r)=>{tile(gx,gy,['#ecd49a','#e6cd92','#f0d9a2'][r()*3|0]);specks(gx,gy,r,14,['#d6b97a','#fff0c4']);},
  basalt:(gx,gy,r)=>{tile(gx,gy,(gx+gy)%2?'#4a4240':'#433c3a','#3a3432');specks(gx,gy,r,10,['#5a5250','#2e2826']);},
  gravel:(gx,gy,r)=>{tile(gx,gy,'#d8d2c4');ctx.strokeStyle='#c4bdac';ctx.lineWidth=1;for(let k=1;k<4;k++){const a=S(gx,gy+k/4),b=S(gx+1,gy+k/4);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}},
  terrace:(gx,gy,r)=>{tile(gx,gy,(gx+gy)%2?'#c9c2b4':'#d2cbbd','#b0a99a');},
  hydraulic:(gx,gy,r)=>{tile(gx,gy,'#ede2cc','#cbbfa6');const c=S(gx+.5,gy+.5);poly([[c[0],c[1]-12],[c[0]+24,c[1]],[c[0],c[1]+12],[c[0]-24,c[1]]],(gx+gy)%2?'#3f7a8a':'#c25a3a');poly([[c[0],c[1]-6],[c[0]+12,c[1]],[c[0],c[1]+6],[c[0]-12,c[1]]],'#ede2cc');circ(c[0],c[1],2,'#d8a63a');},
  tatami:(gx,gy,r)=>{tile(gx,gy,'#cfc28a','#a89a5a');ctx.strokeStyle='rgba(120,100,50,.25)';for(let k=1;k<6;k++){const a=S(gx+k/6,gy),b=S(gx+k/6,gy+1);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}},
  stonepath:(gx,gy,r)=>{FLOOR.grass(gx,gy,r);for(let k=0;k<3;k++){const[x,y]=S(gx+.2+r()*.6,gy+.2+r()*.6);ell(x,y,9+r()*4,5,'#b8b2a6');ell(x,y-1,8,4,'#cfc9bd');}},
  sandlight:(gx,gy,r)=>{tile(gx,gy,['#f8e8bc','#f5e3b4','#fbedc8'][r()*3|0]);specks(gx,gy,r,10,['#e8d29c','#fffbe8']);},
  rooftop:(gx,gy,r)=>{tile(gx,gy,(gx+gy)%2?'#5a5e6a':'#545866','#484c58');}
});
function fenceB(c,H){box(-.2,0,.2,GH,H,0,lt(c),mul(c,.86),mul(c,.86));onB(GH,()=>{ctx.fillStyle='rgba(60,30,20,.22)';for(let y=-H+6,i=0;y<0;y+=7,i++){ctx.fillRect(0,y,GH*32,1);for(let x=(i%2)*8;x<GH*32;x+=16)ctx.fillRect(x,y,1,7);}});}
function plankBridge(gx,gy){B.ground.push(()=>{for(let k=0;k<5;k++){const fy=gy+.05+k*.18;poly([S(gx-.1,fy),S(gx+1.1,fy),S(gx+1.1,fy+.15),S(gx-.1,fy+.15)],k%2?'#8a5e38':'#9a6a44','rgba(40,20,10,.5)');}
  for(const sx of[-.05,1.05]){const a=up(S(gx+sx,gy),14),b=up(S(gx+sx,gy+1),14);ctx.strokeStyle='#c9a26a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();[S(gx+sx,gy),S(gx+sx,gy+1)].forEach(p=>R(p[0]-1,p[1]-14,3,14,'#6a4a2a'));}});}
function pizza(gx,gy){addF(gx,gy,()=>{bx(gx+.2,gy+.25,.6,.5,3,0,'#c9a26a');const c=up(S(gx+.5,gy+.5),3);ell(c[0],c[1],13,6.5,'#e8a84a');ell(c[0],c[1],11,5.5,'#d84a2a');[[-4,-1],[3,1],[0,-3],[5,-2],[-2,2]].forEach(([dx,dy])=>circ(c[0]+dx,c[1]+dy,1.4,'#8a2a1a'));},{block:false});}
const SCENES=[
 {id:'churrasco',stageSpot:{x:8.6,len:3},nome:'Quintal com varanda',desc:'Varanda com rede, churrasqueira, mesão e fogueira',outdoor:true,spawn:[6,10],build(){
   B.floorAt=(x,y)=>y<=2?'terrace':(x===5||x===6)&&y<=6?'stonepath':'grass';
   B.walls=()=>{houseWall('#e8d6b4',150);fenceB('#b8704e',44);};
   pergola(2.7,112);
   hammock(1,1,2);chair(4,1,'y','#efe6d4');chair(5,1,'y','#efe6d4');lowTable(4,2,[[4.5,2.5,'copo','#ffd84a']]);
   mixer(8,1);speaker(9,1);speaker(10,2);vaso(11,1,true);vaso(0,2,true);planter(7,0,true);
   grill(11,4);cooler(11,5);
   table(2,5,3,1,24,'#9a6a44',[[2.4,5.4,'prato'],[3.5,5.5,'tabua'],[4.4,5.4,'garrafa','#7a3a2a']]);[2,3,4].forEach(x=>{chair(x,4,'y','#c9a37a');chair(x,6,'ny','#c9a37a');});
   campfire(8,8,[[7,8,'x'],[9,8,'nx'],[8,7,'y'],[8,9,'ny']]);
   tree(1,10);tree(11,10,['#2a5a2e','#3a7a3c','#5a9a4c','#8ac062']);bush(0,7);bush(11,8);planter(0,5,true);tuft(4,10);tuft(6,11);tuft(10,6);
   stringLights([[0,3],[6,7],[12,3]],96,12);}},
 {id:'festa',stageSpot:{x:8.4,len:3},nome:'Festa em casa',desc:'Sala com sofá, estante, pista e mesa de comida',outdoor:false,spawn:[6,10],build(){
   B.floorAt=()=>'wood';
   B.walls=()=>roomWalls('#d8c6a8',150,()=>{const n=night();R(36,-128,150,76,'#3a3330');const g=ctx.createLinearGradient(0,-124,0,-56);g.addColorStop(0,n?'#1b2442':'#bfe3fa');g.addColorStop(1,n?'#2c3458':'#e6f4fc');ctx.fillStyle=g;ctx.fillRect(40,-124,142,68);
       if(n){const r=rng(5);for(let k=0;k<10;k++){const x=46+k*14,h=14+r()*36;R(x,-56-h,12,h,'#141a30');for(let w=0;w<3;w++)if(r()<.6)R(x+3+(w%2)*4,-52-h+w*8,2,3,'#ffd890');}}
       R(108,-128,3,76,'#3a3330');poster(0,250,-120,40,54,'#2a2630','#ff8fc7');poster(0,310,-112,30,40,'#f2efe9','#43d9e8');
       ['#c23b3b','#f0c24a','#3f8a4a','#2f6fd6','#e8708a'].forEach((c,i)=>{for(let k=0;k<7;k++){const x=10+k*56+i*11;poly([[x,-140],[x+9,-140],[x+4.5,-131]],c);}});},
     ()=>{R(250,-118,46,118,'#6a4a32');R(254,-114,38,114,'#8a6040');R(282,-60,3,3,'#e3b84a');R(60,-110,56,40,'#2a2830');R(64,-106,48,32,'#d88a5a');R(150,-100,30,30,'#f2efe9');circ(165,-85,10,'#2a2630');circ(165,-85,3,'#c23b3b');});
   rug(2,3,3,4,'#c25a7a','#e8b4c8');sofa(1,3,'x','#3a6a8a');sofa(1,4,'x','#3a6a8a');sofa(1,5,'x','#3a6a8a');sofa(1,6,'x','#3a6a8a');coffeeTable(3,4);pouf(4,6,'#ffd84a');pouf(4,3,'#7fe7ff');
   bookshelf(3,0);bookshelf(4,0);tv(6,0);floorLamp(1,1);mixer(9,1);speaker(10,1);speaker(11,3);
   table(8,7,3,1,26,'#efe6d4',[[8.4,7.4,'bolo'],[9.4,7.5,'pizza'],[10.3,7.4,'copo','#c23b3b'],[10.6,7.6,'garrafa']]);[8,9,10].forEach(x=>chair(x,8,'ny','#efe6d4'));
   vaso(11,10,true);vaso(0,10,true);balloons(11,6,['#c23b3b','#f0c24a','#2f6fd6']);balloons(1,8,['#e8708a','#8e5ac8','#43d9e8']);
   discoBall(7,5,140);glowG(6,6,140,'#ff8fc7',.14,1);glowG(8,4,120,'#7fe7ff',.14,1);
   stringLights([[0,0],[12,0]],138,6);stringLights([[0,0],[0,12]],138,6);}},
 {id:'pijama',stageSpot:{x:7.4,len:3},nome:'Noite do pijama',desc:'Quarto de menina com cabana de lençol, colchões, ursinhos, escrivaninha, TV e pizza',outdoor:false,spawn:[6,10],build(){
   B.cfg.carpet='#c9b4d6';B.floorAt=()=>'carpet';
   B.walls=()=>roomWalls('#e6c9d6',140,()=>{const n=night();[90,250].forEach(x=>{win(x,-112,46,58,n?'dark':'day');R(x-10,-118,10,70,'#b86a8a');R(x+46,-118,10,70,'#b86a8a');});posterSailor(152,-124);posterCruz(318,-118);},
     ()=>{poster(0,80,-104,36,46,'#2f4f7a','#e8708a');poster(0,130,-100,26,34,'#f2efe9','#8e5ac8');R(180,-96,52,30,'#f2efe9');R(186,-90,40,4,'#c23b3b');R(186,-82,30,4,'#2f6fd6');R(250,-110,60,110,'#efe6d4');R(254,-106,26,104,'#d8c8e0');R(282,-106,26,104,'#d8c8e0');});
   bed(1,2,'y','#8e5ac8');bed(2,2,'y','#8e5ac8');tent(9,2);rug(4,5,4,3,'#ffd0e2','#ffffff',true);
   bed(4,9,'x','#43a8b8');bed(7,9,'x','#ff8fc7');beanbag(9,6,'#f0a23a');beanbag(10,8,'#4a68b2');beanbag(3,7,'#3f8a4a');
   fmTv(5,0,2);desk(8,0);taioba(11,0);taioba(0,0);taioba(10,11);taioba(0,11);
   pizza(6,6);pizza(5,5);
   memoryTable(9,4);zabuton(8,4,'#ff8fc7');zabuton(10,4,'#43d9e8');   // jogo da memória na frente da cabana
   lampTable(0,1);lampTable(11,1);mixer(11,5,'radio');vaso(11,11);
   snackTable(2,10,2);cushion(5,3,'#ff8fc7');cushion(7,3,'#c9a5ff');cushion(3,5,'#ffd84a');cushion(8,7,'#43d9e8');cushion(1,9,'#ff8fc7');
   teddy(1,2,'#c98a5a',.5,.5,12);teddy(2,3,'#f2efe9',.5,.55,12);teddy(7,9,'#ffb3d9',.4,.5,10);teddy(9,6,'#e0a060',.5,.5,14);teddy(6,3,'#a8784a',.5,.5,0);teddy(4,6,'#f2efe9',.3,.5,0);teddy(10,8,'#ff8fc7',.5,.5,14);
   stringLights([[0,0],[12,0]],128,6);stringLights([[0,0],[0,12]],128,6);stringLights([[9,1],[12,4]],80,6);}},
 {id:'parque',stageSpot:{x:5,len:3},nome:'Parque com lago',desc:'Lago com patos, food truck, sorvete, balanço e piquenique',outdoor:true,spawn:[5,11],build(){
   B.floorAt=(x,y)=>(x===5||y===5)?'dirt':'grass';
   B.walls=()=>{};
   water(7,7,4,4,'pond');
   [[0,0],[3,0],[10,0],[0,3],[0,8],[11,5],[3,11]].forEach(([x,y])=>tree(x,y));
   chessTable(3,3);stool(2,3,'x','#8a5a3a');stool(4,3,'nx','#8a5a3a');bench(4,4,'y');bench(6,4,'y');bench(4,6,'ny');lampPost(4,7);lampPost(6,3);foodTruck(1,6);iceCart(9,2);swing(1,2);
   picnicTable(2,9);rug(8,0,2,2,'#e8708a','#f2efe9',true);mixer(10,1);
   dominoTable(5,9);stool(4,9,'x','#8a5a3a');stool(6,9,'nx','#8a5a3a');   // dominó na beira do lago
   bush(2,0);bush(11,3);bush(6,11);tuft(9,4);tuft(11,11);trash(6,6);}},
 {id:'boate',stageSpot:{x:9,len:3},nome:'Boate',desc:'Palco do DJ com telão, focos de luz, pista de LED, bar neon com barwoman, puffs e caixas pra sentar',outdoor:false,dark:true,spawn:[6,10],build(){
   B.floorAt=()=>'club';
   B.walls=()=>roomWalls('#211d29',180,()=>{R(130,-172,130,12,'#141018');for(let k=0;k<12;k++){R(20+k*30,-100,2,100,'rgba(255,79,163,.15)');}},
     ()=>{for(let i=0;i<5;i++){R(30+i*22,-120,18,2,'#4a4458');[0,1,2].forEach(k=>R(32+i*22+k*5,-132,3,12,['#3f8a4a','#c23b3b','#b9822a'][(i+k)%3]));}R(30,-92,110,2,'#4a4458');
       R(150,-136,84,58,'#0a0a12');R(152,-134,80,54,'#1c2a3a');for(let k=0;k<5;k++){R(158+k*14,-134,5,54,'rgba(255,255,255,.07)');}R(160,-120,24,3,'rgba(255,255,255,.18)');R(196,-100,18,2,'rgba(255,255,255,.18)');   // espelho
       for(let k=0;k<3;k++){ctx.fillStyle='#0a0a0e';ctx.beginPath();ctx.arc(268+k*34,-112,15,0,7);ctx.fill();ctx.fillStyle=['#ff4fa3','#43d9e8','#ffd23f'][k];ctx.beginPath();ctx.arc(268+k*34,-112,5,0,7);ctx.fill();ctx.strokeStyle='#2a2a3a';ctx.lineWidth=1;ctx.beginPath();ctx.arc(268+k*34,-112,10,0,7);ctx.stroke();}   // discos de vinil
       R(256,-84,90,3,'#4a4458');for(let k=0;k<7;k++){R(260+k*12,-98,8,14,'#2a2a3a');R(262+k*12,-96,4,10,['#ff4fa3','#43d9e8','#ffd23f'][k%3]);}   // prateleira de copos coloridos
       R(30,-70,6,6,'#43d9e8');R(34,-64,14,2,'#43d9e8');R(40,-64,2,10,'#43d9e8');R(36,-54,10,2,'#43d9e8');});   // neon: taça
   stage(4,0,5,2,14);djBooth(5,1,3);B.mixer=[6,1];speaker(3,1);speaker(9,1);speaker(3,0);speaker(9,0);
   danceFloor(3,4,6,4);discoBall(6,6,160);laser();laserShow();fmWallScreen(3,6,52,72);
   barCounter(0,3,6);[3,5,7].forEach(y=>stool(1,y,'nx','#ff4fa3'));[4,6,8].forEach(y=>stool(1,y,'nx','#43d9e8'));
   boothSofa(9,11,3,'#5a2a6a');sofa(11,9,'nx','#5a2a6a');sofa(11,10,'nx','#5a2a6a');lowTable(10,9,[[10.5,9.5,'copo','#ff4fa3']]);
   pouf(1,10,'#ff4fa3');pouf(2,11,'#43d9e8');pouf(5,10,'#ffd84a');pouf(6,11,'#8e5ac8');speakerSeat(3,10);speakerSeat(4,11);speakerSeat(7,10);speakerSeat(8,11);
   npc(0,2,{name:'Lola',fig:npcFig({g:1,b:0,pele:'pele5',hair:['chanel','vermelho'],face:'piscando',top_under:['espartilho','preto'],bottom:['couro-flare','preto'],shoes:['bota-plataforma','preto'],neck:['choker','rosa']}),face:'y',prop:'shaker',lines:NPC_BARMAN,every:[30000,60000],shake:a=>(now+a.seed*500)%9000<2800,pose:a=>(now+a.seed*500)%9000<2800?{p:'wave',f:Math.floor(now/170)%2}:null});
   neonSign('A',150,172,'ROLÊ CLUB','#ff4fa3');neonSign('B',190,60,'BAR','#43d9e8');
   neon('A',172,'#ff4fa3',0,12);neon('B',172,'#43d9e8',0,12);}},
 {id:'boteco',stageSpot:{x:9,len:3},nome:'Boteco de esquina',desc:'Balcão com barman, sinuca, truco, damas, dominó, placar ao vivo e TV',outdoor:false,spawn:[6,11],build(){
   B.floorAt=(x,y)=>y>=9?'concrete':'hydraulic';
   B.walls=()=>roomWalls('#f2e6c8',150,()=>{R(0,-64,GW*32,64,'#2f7a6a');ctx.fillStyle='rgba(255,255,255,.18)';for(let x=0;x<GW*32;x+=12)ctx.fillRect(x,-64,1,64);for(let y=-64;y<0;y+=12)ctx.fillRect(0,y,GW*32,1);
       R(40,-130,70,44,'#2a3a2a');ctx.font='700 7px Anybody, sans-serif';ctx.fillStyle='#f2efe9';ctx.textBaseline='middle';ctx.fillText('CERVEJA 8',46,-120);ctx.fillText('PASTEL 6',46,-110);ctx.fillText('PF 25',46,-100);
       [-98,-122].forEach(y=>{R(122,y,82,3,'#6a4a32');R(122,y+3,82,1,'#3a2a1c');for(let k=0;k<9;k++){const col=['#3f8a4a','#c23b3b','#b9822a','#f0c24a','#efe6d4','#6a8ad8'][(k+(y===-98?2:0))%6],h=9+(k*5%6);R(125+k*9,y-h,4,h,col);R(126+k*9,y-h-3,2,3,col);}});   // prateleiras de garrafas
       sambaPainting(214,-122);
       R(262,-150,98,24,'#c23b3b');R(264,-148,94,20,'#e0584a');ctx.font='900 10px Anybody, sans-serif';ctx.fillStyle='#fff3d0';ctx.fillText('BAR DO ZÉ',276,-137);
       R(40,-80,74,13,'#efe6d4');ctx.font='700 6px Anybody, sans-serif';ctx.fillStyle='#2a2630';ctx.fillText('FIADO SÓ AMANHÃ',46,-74);},
     ()=>{R(0,-64,GH*32,64,'#2f7a6a');ctx.fillStyle='rgba(255,255,255,.18)';for(let x=0;x<GH*32;x+=12)ctx.fillRect(x,-64,1,64);
       for(let i=0;i<3;i++){R(20,-130+i*20,180,2,'#6a4a32');for(let k=0;k<16;k++)R(24+k*11,-142+i*20,4,12,['#3f8a4a','#c23b3b','#b9822a','#f0c24a','#efe6d4'][(k+i)%5]);}
       R(230,-120,90,60,'#3a2a20');R(234,-116,82,52,'#c9a26a');ctx.font='700 7px Anybody, sans-serif';ctx.fillStyle='#3a2a20';ctx.fillText('SINUCA R$2',240,-92);});
   barCounter(1,1,5);foodCase(1,6);[2,3,4].forEach(y=>stool(2,y,'nx','#c23b3b'));fridge(0,8);mixer(1,7,'radio');B.blocked.add(key(1,7));
   [1,2,3,4,5,6,7].forEach(y=>B.blocked.add(key(0,y)));   // o balcão é fechado: ninguém entra atrás dele (só o barman, que passeia lá)
   [1,2,3,4,5,6,7].forEach(y=>B.keep.add(key(0,y)));
   [1,2,3,4,5,6,7].forEach(y=>B.keep.add(key(0,y)));
   baleiro(1,2);baleiro(1,5);
   beerCrates(0,10,4);beerCrates(0,11,3);beerCrates(1,11,2);crates(3,8);
   poolTable(6,4);cueRack(11);ceilingFan(6,6,148);ceilingFan(3,3,148);
   fmTv(4,0,2);wallBoard(8,0,'truco@9_2');
   plasticTable(9,2,'#f0c24a',true);chair(9,1,'y','#f0c24a');chair(10,2,'nx','#f0c24a');chair(9,3,'ny','#f0c24a');chair(8,2,'x','#f0c24a');
   plasticTable(9,10,'#f0c24a');chair(10,10,'nx','#f0c24a');chair(8,10,'x','#f0c24a');chair(9,11,'ny','#f0c24a');
   plasticTable(5,10,'#c23b3b');chair(4,10,'x','#c23b3b');chair(6,10,'nx','#c23b3b');chair(5,11,'ny','#c23b3b');
   plasticTable(4,7,'#c23b3b');chair(3,7,'x','#c23b3b');chair(5,7,'nx','#c23b3b');chair(4,8,'ny','#c23b3b');
   plasticTable(8,7,'#f0c24a');chair(7,7,'x','#f0c24a');chair(9,7,'nx','#f0c24a');chair(8,8,'ny','#f0c24a');
   jukebox(11,6);lampPost(11,11);vaso(11,0,true);
   damasTable(10,4);cushion(9,4,'#c23b3b');cushion(11,4,'#2a4a7a');   // damas e dominó também no boteco
   dominoTable(3,5);stool(2,5,'x','#c23b3b');stool(4,5,'nx','#c23b3b');
   npc(0,3,{name:'Zé do Balcão',fig:npcFig({b:2,pele:'pele3',hair:['raspado','preto'],face:'na-boa',top_under:['camiseta','branco'],bottom:['bermuda','jeans'],shoes:['skate','preto']}),face:'x',prop:'pano',lines:NPC_BALCAO,every:[30000,60000],wander:{x0:0,y0:1,x1:0,y1:7}});
   stringLights([[0,8.6],[12,8.6]],120,4);}},
 {id:'piscina',stageSpot:{x:4.4,len:3},nome:'Casa com piscina',desc:'Piscina de entrar (dá pra nadar!) com boias, bar de drinks, palmeiras e espreguiçadeiras',outdoor:true,spawn:[2,7],build(){
   B.floorAt=(x,y)=>(x>=3&&x<=9&&y>=3&&y<=8)?'deck':'grass';
   B.walls=()=>{houseFacade('#e9dfcf',190);box(-.2,0,.2,GH,44,0,'#e2d8c6','#cfc4b2','#cfc4b2');};
   water(4,4,5,4,'pool');swimIn(4,4,5,4);   // dá para entrar na piscina
   poolFloat(5.3,5.2,'donut');poolFloat(7.4,6.4,'flamingo');
   lounger(4,9,'ny');lounger(6,9,'ny');lounger(8,9,'ny');umbrella(9,9,'#c23b3b','#f2efe9');umbrella(3,2,'#2f6fd6','#f2efe9');
   drinkHut(10,1);stool(10,2,'ny','#ff8fc7');stool(11,2,'ny','#7fe7ff');mixer(1,1);speaker(2,1);
   grill(11,5);table(10,6,1,2,24,'#9a6a44',[[10.4,6.5,'prato'],[10.5,7.4,'copo','#f0c24a']]);chair(11,6,'nx','#efe6d4');chair(11,7,'nx','#efe6d4');chair(9,6,'x','#efe6d4');
   palm(1,11);palm(11,11);palm(0,5);vaso(1,4,true);bush(0,8);tuft(2,10);pouf(2,8,'#ffd84a');
   stringLights([[0,0],[3,6],[0,12]],88,8);stringLights([[3,0],[9,3],[12,0]],100,10);}},
 {id:'vulcao',stageSpot:{x:5.6,len:3},nome:'Ilha do vulcão',desc:'Rio de lava, ponte, tochas tiki, totens, fogueira, o chão é lava e um dragão-de-Komodo que cospe fogo',outdoor:true,spawn:[2,10],petList:[{t:'dragao',nome:'Komodo',c:'#6a7a3a'}],sky:{day:['#e0855a','#f6c890'],night:['#2a1018','#120a0e']},tint:'#5a3a52',cliff:'rock',build(){
   B.floorAt=()=>'basalt';
   B.walls=()=>volcanoBack();
   const lava=[];for(let i=0;i<12;i++){lava.push([i,Math.max(0,Math.min(11,Math.round(5+Math.sin(i*.7)*1.2)))]);}lavaRiver(lava);
   [2,6,9].forEach(bxp=>{const c=lava[bxp];B.blocked.delete(key(c[0],c[1]));B.bridge=B.bridge||new Set();B.bridge.add(key(c[0],c[1]));plankBridge(c[0],c[1]);});
   campfire(3,9,[[2,9,'x'],[4,9,'nx'],[3,8,'y'],[3,10,'ny']]);
   torch(1,1);torch(5,2);torch(9,1);torch(1,7);torch(10,9);torch(7,11);tikiHead(0,3);tikiHead(11,3);tikiHead(11,7);
   rock(8,8,true);rock(10,11,false,'#5a5250');rock(6,9,false,'#5a5250');rock(4,1,true,'#4a4240');
   palm(0,11);palm(11,1);mixer(8,1);speaker(7,1);gong(1,9);smoke(0,0,240,'#6a5a56');smoke(.4,0,260,'#7a6a66');}},
 {id:'templo',stageSpot:{x:5.6,len:3},nome:'Templo e lago de carpas',desc:'Portal torii, ponte vermelha, carpas, cerejeiras e chá',outdoor:true,spawn:[2,11],petList:[{t:'panda',nome:'Panda',c:'#f6f4ee'}],build(){
   B.floorAt=(x,y)=>(x>=6&&y>=4&&x<=10&&y<=9)?'grass':(x===2||y===10)?'stonepath':'gravel';
   B.walls=()=>pagoda();
   water(6,4,5,5,'koi');koi();bridge(6,6,5);
   torii(1,8,2);sakura(10,1);sakura(0,10);sakura(11,10);bamboo(0,1);bamboo(0,2);bamboo(11,4);
   stoneLantern(5,4);stoneLantern(5,9);stoneLantern(11,9);
   zabuton(2,3,'#7a2a3a');zabuton(4,3,'#7a2a3a');zabuton(3,2,'#2a4a7a');zabuton(3,4,'#2a4a7a');lowTable(3,3,[[3.4,3.4,'copo','#7fb85a'],[3.6,3.6,'copo','#7fb85a']]);
   damasTable(2,6);zabuton(1,6,'#7a2a3a');zabuton(3,6,'#2a4a7a');   // um passo à esquerda: (4,6) e (5,6) levam à ponte
   fishSpot(5,5,'x');fishSpot(5,7,'x');fishSpot(8,9,'ny');fishSpot(10,9,'ny');
   rug(7,1,2,2,'#cfc28a','#a89a5a',true);rug(1,0,2,2,'#9a7a5a','#cfc28a',true);rug(9,10,2,1,'#7a2a3a','#e8c0a0',true);   // tatames para sentar
   mixer(9,1);rock(8,11,false,'#8a8680');rock(4,7,true,'#9a968e');}},
 {id:'praia',stageSpot:{x:5,len:3},nome:'Luau na praia',desc:'Mar, coqueiros, fogueira, vôlei, rede, cadeiras, cangas e troncos pra sentar e barraca de drinks',outdoor:true,cliff:'sand',spawn:[2,10],build(){
   B.floorAt=(x,y)=>x>=3&&x<=10&&y>=2&&y<=4?'sandlight':'sand';   // a quadra de vôlei é a areia clarinha
   B.walls=()=>{};
   for(let y=0;y<GH;y++){B.blocked.add(key(11,y));}sea();voleiCourt();
   palm(0,0);palm(4,0);palm(0,5);palm(9,0);hammock(1,2,2);
   campfire(5,6,[[4,6,'x'],[6,6,'nx'],[5,5,'y'],[5,7,'ny']]);
   beachChair(10,8,'x','#ff7a5a');beachChair(10,9,'x','#43d9e8');beachChair(10,10,'x','#ffd84a');beachChair(6,10,'ny','#ff8fc7');beachChair(7,10,'ny','#7fe7ff');
   rug(0,7,2,2,'#ff8fc7','#ffffff',true);rug(8,5,2,2,'#43d9e8','#ffffff',true);rug(5,8,2,1,'#ffd84a','#ff7a5a',true);logSeat(3,6,'x');logSeat(7,6,'nx');logSeat(5,4,'y');   // cangas e troncos
   beachChair(8,9,'ny','#ff7a5a');beachChair(9,9,'ny','#43d9e8');umbrella(9,10,'#ffd84a','#f2efe9');surfboard(10,6);surfboard(10,7);
   drinkHut(2,9);stool(2,8,'y','#ff8fc7');stool(3,8,'y','#ffd84a');torch(1,7);torch(10,1);torch(8,7);mixer(6,1);speaker(7,1);
   stringLights([[0,1],[5,3],[10,1]],90,10);}},
 {id:'rooftop',stageSpot:{x:4.4,len:3},nome:'Rooftop na cidade',desc:'Terraço sobre uma metrópole que não dorme, jacuzzi, puffs, neon e telescópio panorâmico',outdoor:true,cliff:'building',spawn:[6,10],build(){
   B.floorAt=(x,y)=>(x>=7&&y<=4)?'deck':'rooftop';
   B.walls=()=>{glassRail();};
   jacuzzi(8,1);pouf(3,6,'#ff4fa3');pouf(4,7,'#43d9e8');pouf(2,7,'#ffd84a');lowTable(3,7,[[3.5,7.5,'copo','#ff4fa3']]);
   sofa(1,2,'x','#2a2a3a');sofa(1,3,'x','#2a2a3a');sofa(2,1,'y','#2a2a3a');barCounter(11,6,3);stool(10,6,'x','#ff4fa3');stool(10,8,'x','#43d9e8');
   mixer(5,1);speaker(4,1);speaker(6,1);telescope(7,6);actReg('telescopio',7,6,1,1);vaso(0,11,true);vaso(11,10,true);vaso(0,6);rug(2,9,3,2,'#2a2a3a','#43d9e8',true);
   stringLights([[0,0],[6,6],[12,0]],110,14);stringLights([[0,12],[6,6]],100,10);}}
];
const sceneById=id=>SCENES.find(s=>s.id===id)||SCENES[0];
