/* ================= cartas de baralho em pixel art =================
 * 40 cartas de 40x56 desenhadas uma vez e guardadas: naipes de verdade, ases grandes, pontos em lugares certos,
 * valete, dama e rei com rosto, manilhas com moldura dourada e um verso do Rolê. Quem usa: o truco (src/app/truco.js).
 * Carta = naipe*10 + posição em A,2,3,4,5,6,7,J,Q,K (veja src/engine/truco.js).
 */
const CW=40,CH=56;
const CD_RANK={
  A:['..#..','.#.#.','#...#','#...#','#####','#...#','#...#'],
  '2':['.###.','#...#','....#','...#.','..#..','.#...','#####'],
  '3':['.###.','#...#','....#','..##.','....#','#...#','.###.'],
  '4':['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],
  '5':['#####','#....','####.','....#','....#','#...#','.###.'],
  '6':['..##.','.#...','#....','####.','#...#','#...#','.###.'],
  '7':['#####','....#','...#.','..#..','.#...','.#...','.#...'],
  J:['..###','...#.','...#.','...#.','...#.','#..#.','.##..'],
  Q:['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],
  K:['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'],
};
/* naipes 7x7 (pontos) e 5x5 (índices): 0 paus, 1 copas, 2 espadas, 3 ouros */
const CD_S7=[
  ['..###..','..###..','#.###.#','#######','#.###.#','...#...','..###..'],
  ['.##.##.','#######','#######','#######','.#####.','..###..','...#...'],
  ['...#...','..###..','.#####.','#######','#######','..#.#..','.#####.'],
  ['...#...','..###..','.#####.','#######','.#####.','..###..','...#...'],
];
const CD_S5=[
  ['.###.','.###.','#####','.#.#.','.###.'],
  ['.#.#.','#####','#####','.###.','..#..'],
  ['..#..','.###.','#####','.#.#.','.###.'],
  ['..#..','.###.','#####','.###.','..#..'],
];
const CD_RED='#c8283a',CD_BLK='#221838',CD_GOLD='#f0b823',CD_GOLD2='#b87a10',CD_PAPER='#fbf6e6';
const cdCol=s=>s===1||s===3?CD_RED:CD_BLK;
const cdCache=new Map();
const cdMk=()=>{const c=document.createElement('canvas');c.width=CW;c.height=CH;const g=c.getContext('2d');g.imageSmoothingEnabled=false;return[c,g];};
function cdPaint(g,rows,x,y,s){s=s||1;rows.forEach((r,ry)=>{for(let rx=0;rx<r.length;rx++)if(r[rx]==='#')g.fillRect(x+rx*s,y+ry*s,s,s);});}
const cdR=(g,col,x,y,w,h)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};

/* contorno com cantos cortados, papel e um sombreado leve embaixo/à direita */
function cdFrame(g,paper,gold){
  cdR(g,'#000',0,0,CW,CH);cdR(g,paper,1,1,CW-2,CH-2);
  cdR(g,'#e2d6b2',1,CH-3,CW-2,2);cdR(g,'#e2d6b2',CW-3,1,2,CH-2);
  for(const[x,y]of[[0,0],[CW-1,0],[0,CH-1],[CW-1,CH-1]])g.clearRect(x,y,1,1);
  for(const[x,y]of[[1,1],[CW-2,1],[1,CH-2],[CW-2,CH-2]]){cdR(g,'#000',x,y,1,1);}
  if(gold){   // manilha: moldura dourada e faíscas
    cdR(g,CD_GOLD,2,2,CW-4,1);cdR(g,CD_GOLD,2,CH-3,CW-4,1);cdR(g,CD_GOLD,2,2,1,CH-4);cdR(g,CD_GOLD,CW-3,2,1,CH-4);
    cdR(g,CD_GOLD2,3,CH-3,CW-6,1);cdR(g,CD_GOLD2,CW-3,3,1,CH-6);
    for(const[x,y]of[[CW-8,6],[7,CH-8],[CW-6,CH-12]]){cdR(g,'#fff3a8',x,y,1,1);cdR(g,CD_GOLD,x-1,y,3,1);cdR(g,CD_GOLD,x,y-1,1,3);}
  }
}

/* pontos de 2 a 7 */
function cdPips(g,n,s,col){
  const X=[9,16,23],Y={t:8,t2:17,m:25,b:42};
  const L={2:[[1,'t'],[1,'b']],3:[[1,'t'],[1,'m'],[1,'b']],4:[[0,'t'],[2,'t'],[0,'b'],[2,'b']],
    5:[[0,'t'],[2,'t'],[1,'m'],[0,'b'],[2,'b']],6:[[0,'t'],[2,'t'],[0,'m'],[2,'m'],[0,'b'],[2,'b']],
    7:[[0,'t'],[2,'t'],[1,'t2'],[0,'m'],[2,'m'],[0,'b'],[2,'b']]}[n];
  g.fillStyle=col;
  for(const[c,r]of L)cdPaint(g,CD_S7[s],X[c],Y[r]);
}
/* ás: naipe grande no centro (o de espadas ganha um aro dourado) */
function cdAce(g,s,col){
  if(s===2){g.fillStyle=CD_GOLD;for(let a=0;a<64;a++){const t=a/64*6.2832;g.fillRect(Math.round(20+Math.cos(t)*14.5),Math.round(28+Math.sin(t)*14.5),1,1);}}
  g.fillStyle=col;cdPaint(g,CD_S7[s],10,18,3);
}

/* valete, dama e rei: busto desenhado em pixels dentro de uma moldura */
function cdFace(g,r,s,col){
  const cloth=cdCol(s)===CD_RED?'#c8283a':'#3a2c63',shade=cdCol(s)===CD_RED?'#8f1a2a':'#221838';
  cdR(g,col,8,10,24,36);cdR(g,'#f1e2b4',9,11,22,34);
  cdR(g,'#e4d2a0',9,11,22,2);   // luz de cima
  // ombros e gola dourada
  for(let k=0;k<12;k++){const w=Math.min(22,8+k*2),x=20-w/2;cdR(g,cloth,x,33+k,w,1);cdR(g,shade,x+w-3,33+k,3,1);}
  cdR(g,CD_GOLD,17,33,1,1);cdR(g,CD_GOLD,18,34,1,1);cdR(g,CD_GOLD,19,35,1,1);cdR(g,CD_GOLD,22,33,1,1);cdR(g,CD_GOLD,21,34,1,1);cdR(g,CD_GOLD,20,35,1,1);
  cdR(g,CD_GOLD,19,38,3,1);cdR(g,CD_GOLD,19,42,3,1);
  // pescoço e cabeça
  cdR(g,'#d9a67c',18,31,4,3);
  cdR(g,'#3a2418',14,20,12,12);cdR(g,'#f0c39a',15,21,10,10);
  cdR(g,'#fff',17,25,2,2);cdR(g,'#fff',22,25,2,2);cdR(g,'#1c1428',18,25,1,2);cdR(g,'#1c1428',23,25,1,2);
  cdR(g,'#e8957a',16,28,2,1);cdR(g,'#e8957a',23,28,2,1);cdR(g,'#d89a78',20,27,1,2);
  if(r==='K'){
    cdR(g,'#e8e2d4',15,28,10,6);cdR(g,'#cfc8b8',15,33,10,1);cdR(g,'#e8e2d4',16,34,8,1);        // barba
    cdR(g,'#f0c39a',17,30,6,1);cdR(g,'#a8403a',18,30,4,1);                                    // boca no meio da barba
    cdR(g,'#cfc8b8',16,27,3,1);cdR(g,'#cfc8b8',22,27,3,1);                                    // bigode
    cdR(g,CD_GOLD2,15,17,10,4);cdR(g,CD_GOLD,15,17,10,3);                                    // coroa
    cdR(g,CD_GOLD,15,14,2,3);cdR(g,CD_GOLD,19,12,2,5);cdR(g,CD_GOLD,23,14,2,3);
    cdR(g,'#c8283a',19,18,2,1);cdR(g,'#43d9e8',16,18,1,1);cdR(g,'#43d9e8',23,18,1,1);cdR(g,'#fff3a8',19,12,2,1);
  }else if(r==='Q'){
    cdR(g,'#6a3a1e',13,20,14,3);cdR(g,'#6a3a1e',13,22,3,13);cdR(g,'#6a3a1e',24,22,3,13);cdR(g,'#8a5230',14,21,12,1);   // cabelo comprido
    cdR(g,'#c8283a',18,29,4,1);                                                                                         // batom
    cdR(g,CD_GOLD2,16,18,8,3);cdR(g,CD_GOLD,16,18,8,2);
    cdR(g,CD_GOLD,16,16,1,2);cdR(g,CD_GOLD,19,14,2,4);cdR(g,CD_GOLD,23,16,1,2);cdR(g,'#fff3a8',19,14,2,1);cdR(g,'#c8283a',19,19,2,1);
    for(let x=16;x<=24;x+=2)cdR(g,'#fff',x,35,1,1);                                                                     // colar de pérolas
    cdR(g,'#fff',20,37,1,1);
  }else{   // valete
    cdR(g,'#6a3a1e',14,21,2,7);cdR(g,'#6a3a1e',24,21,2,7);cdR(g,'#6a3a1e',15,20,10,2);
    cdR(g,shade,12,16,16,4);cdR(g,cloth,12,15,14,4);cdR(g,cloth,14,13,10,3);cdR(g,CD_GOLD,12,19,16,1);   // boina
    cdR(g,CD_GOLD,25,8,2,7);cdR(g,CD_GOLD2,26,8,1,6);cdR(g,CD_GOLD,24,12,2,3);cdR(g,'#fff3a8',26,8,1,1);   // pena
  }
}

function cdBack(){
  const[c,g]=cdMk();
  cdR(g,'#000',0,0,CW,CH);cdR(g,'#3a1c8a',1,1,CW-2,CH-2);
  for(const[x,y]of[[0,0],[CW-1,0],[0,CH-1],[CW-1,CH-1]])g.clearRect(x,y,1,1);
  cdR(g,'#ff3d8b',3,3,CW-6,1);cdR(g,'#ff3d8b',3,CH-4,CW-6,1);cdR(g,'#ff3d8b',3,3,1,CH-6);cdR(g,'#ff3d8b',CW-4,3,1,CH-6);
  for(let y=5;y<CH-5;y++)for(let x=5;x<CW-5;x++){if((x+y)%8===0||(x-y+80)%8===0){cdR(g,'#6a40d8',x,y,1,1);}}
  for(let y=6;y<CH-6;y+=8)for(let x=((y/8)|0)%2?9:5;x<CW-6;x+=8)cdR(g,'#8f6af0',x,y,1,1);
  // emblema no centro: losango dourado com uma estrela rosa
  const cx=20,cy=28;
  for(let k=-9;k<=9;k++){const w=9-Math.abs(k);cdR(g,'#000',cx-w-1,cy+k,w*2+3,1);}
  for(let k=-8;k<=8;k++){const w=8-Math.abs(k);cdR(g,CD_GOLD,cx-w,cy+k,w*2+1,1);}
  for(let k=-5;k<=5;k++){const w=5-Math.abs(k);cdR(g,'#ff3d8b',cx-w,cy+k,w*2+1,1);}
  cdR(g,'#fff3a8',cx,cy-1,1,3);cdR(g,'#fff3a8',cx-1,cy,3,1);
  return c;
}

function cardImg(id){
  if(id<0)return cardBackImg();
  let c=cdCache.get(id);if(c)return c;
  const[cv,g]=cdMk();c=cv;
  const s=trSuit(id),rk=trRank(id),r=TR_RANKS[rk],col=cdCol(s);
  cdFrame(g,CD_PAPER,trIsManilha(id));
  const idx=()=>{g.fillStyle=col;cdPaint(g,CD_RANK[r],3,3);cdPaint(g,CD_S5[s],3,12);};
  idx();g.save();g.translate(CW,CH);g.rotate(Math.PI);idx();g.restore();
  if(rk>=7)cdFace(g,r,s,col);else if(rk===0)cdAce(g,s,col);else cdPips(g,rk+1,s,col);
  cdCache.set(id,c);return c;
}
const cardBackImg=()=>cdCache.get('back')||(cdCache.set('back',cdBack()),cdCache.get('back'));

/* folha com as 40 cartas e o verso (só para olhar e depurar) */
function cardsSheet(){
  const c=document.createElement('canvas');c.width=10*(CW+4)+4;c.height=5*(CH+4)+4;
  const g=c.getContext('2d');g.fillStyle='#0c6a3a';g.fillRect(0,0,c.width,c.height);
  for(let i=0;i<40;i++)g.drawImage(cardImg(i),4+(i%10)*(CW+4),4+Math.floor(i/10)*(CH+4));
  g.drawImage(cardBackImg(),4,4+4*(CH+4));
  return c;
}
