/* ===== cabelos em mechas ===== */
(function(AV){
const{W,H}=AV;
/* mecha: raiz (x,y) relativa ao centro da cabeça, ângulo (0=pra baixo, + = pra direita da tela), comprimento, largura, curva total, largura da ponta */
function lockPts(cx,cy,[rx,ry,a,len,w,bend=0,tip=0,bulge=0]){const n=Math.max(4,Math.round(len/2.2)),L=[],R=[];let x=cx+rx,y=cy+ry,ang=a*Math.PI/180;const da=(bend*Math.PI/180)/n,st=len/n;
  for(let i=0;i<=n;i++){const t=i/n,ww=(w*Math.pow(1-t,.85)+tip)*(1+bulge*Math.sin(t*Math.PI))/2,dx=Math.sin(ang),dy=Math.cos(ang);
    L.push([x-dy*ww,y+dx*ww]);R.push([x+dy*ww,y-dx*ww]);x+=dx*st;y+=dy*st;ang+=da;}
  return{poly:[...L,...R.reverse()],tip:[x,y]};}
AV.lockPts=lockPts;
function lock(cv,R,cx,cy,spec,opt={}){const{poly}=lockPts(cx,cy,spec);const p=cv.part_({mat:R.hair,round:4,inner:1,group:null,bias:opt.bias||0,outCol:opt.outCol,
  light:(I)=>I<-.15?0:.5});p.poly(poly);p.commit();
  // reflexo ao longo da mecha
  if(opt.shine!==false&&spec[3]>9){const[rx,ry,a,len,w,bend=0]=spec;const s=lockPts(cx,cy,[rx,ry,a,len*.62,w*.18,bend*.62]).poly;const mid=s.slice(0,Math.floor(s.length/2));
    const sh=mid.filter((_,i)=>i>0);cv.ink(p,sh.map(([x,y])=>[x-w*.15,y]),{tone:3});cv.ink(p,sh.slice(0,2).map(([x,y])=>[x-w*.15,y]),{tone:4});}
  return p;}
AV.lock=lock;

/* estilos: calota + anéis de mechas gerados + mechas soltas (franja). Coordenadas relativas ao centro da cabeça. φ: 0=topo, 90=direita, ±180=nuca */
const wrap=a=>{a=((a+180)%360+360)%360-180;return a===-180?180:a;};
function ring(d,c,r){const out=[];const n=r.n;for(let i=0;i<n;i++){const t=n===1?.5:i/(n-1),phi=r.from+(r.to-r.from)*t,j=Math.sin(i*12.9898+r.from)*.5;
    const P=phi*Math.PI/180,rx=d.hrx+c.ox-(r.inset||2.2),ry=d.hry+c.oy-(r.inset||2.2);const x=Math.sin(P)*rx,y=c.dy-Math.cos(P)*ry;
    let a=wrap(180-phi);a=a*(1-r.g);const side=Math.sign(a)||1;const len=r.len*(1+(r.var||.18)*j),w=r.w*(1+.12*j);
    out.push({s:[x,y,a+(r.tilt||0),len,w,side*(r.bend||0),r.tip||0,r.bulge||0],phi});}
  return out;}
const HAIR={
  'franja-emo':{nome:'Franja emo',cap:{dy:-3,ox:3,oy:2.6,line:-6},
    rings:[{from:-150,to:150,n:7,len:10,w:13,g:.2,bend:16,inset:3.5},{from:-165,to:-80,n:4,len:16,w:12,g:.65,bend:14},{from:80,to:165,n:4,len:15,w:12,g:.65,bend:14},{from:-45,to:45,n:4,len:8,w:12,g:0,bend:-12,tilt:-14}],
    front:[[12,-4,6,15,8,10],[-13,-3,-6,15,8,-6],[-4,-16,-46,20,11,-6],[4,-16,-34,25,12,-16],[11,-14,-24,25,11,-20],[1,-13,-30,24,8,-22,0,.3]]},
  repartido:{nome:'Repartido 90s',cap:{dy:-3,ox:2.6,oy:2,line:-7},
    rings:[{from:-170,to:-80,n:5,len:22,w:9,g:.85,bend:6},{from:80,to:170,n:5,len:22,w:9,g:.85,bend:6},{from:-60,to:60,n:4,len:6,w:10,g:0,bend:0}],
    front:[[-1,-15,-30,17,9,-34],[1,-15,30,17,9,34],[-6,-14,-24,24,8,-18],[6,-14,24,24,8,18],[-12,-6,-4,24,7,6],[12,-6,4,24,7,-6]]},
  espetado:{nome:'Espetado frosted',cap:{dy:-2,ox:1.8,oy:1.4,line:-8},tips:true,
    rings:[{from:-95,to:95,n:11,len:12,w:8,g:0,bend:0,tilt:0,var:.3},{from:-120,to:-100,n:2,len:7,w:7,g:.4},{from:100,to:120,n:2,len:7,w:7,g:.4}],
    front:[[-6,-12,-8,8,7],[0,-13,4,8,7],[6,-12,12,8,7]]},
  wolf:{nome:'Wolf cut',cap:{dy:-3,ox:3,oy:2.6,line:-7},
    rings:[{from:-60,to:60,n:6,len:8,w:10,g:0,bend:-12},{from:-150,to:-70,n:5,len:18,w:9,g:.7,bend:16},{from:70,to:150,n:5,len:18,w:9,g:.7,bend:16},{from:-178,to:178,n:2,len:26,w:12,g:1,inset:4}],
    front:[[-7,-14,-16,17,8,-14],[0,-15,-2,15,8],[7,-14,16,17,8,14],[-13,-2,-6,16,6,8],[13,-2,6,16,6,-8]]},
  'longo-liso':{nome:'Longo liso',cap:{dy:-3,ox:2.4,oy:2,line:-7},
    rings:[{from:-175,to:-95,n:5,len:52,w:12,g:1,bend:4,var:.06},{from:95,to:175,n:5,len:52,w:12,g:1,bend:4,var:.06}],
    front:[[-2,-15,-28,15,9,-34],[2,-15,22,15,8,30],[-12,-7,-3,40,8,4],[12,-7,3,40,8,-4],[-8,-12,-12,32,7,-8]]},
  'coque-duplo':{nome:'Coque duplo',cap:{dy:-3,ox:2.2,oy:2,line:-7},buns:[[-11,-13,8],[11,-13,8]],
    rings:[],front:[[-3,-15,-22,14,8,-16],[3,-15,22,14,8,16],[-12,-4,-4,24,7,8],[12,-4,4,24,7,-8]]},
  'maria-chiquinha':{nome:'Maria-chiquinha',cap:{dy:-3,ox:2.2,oy:2,line:-8},tails:[[-14,4,-26,32,11,24,0,.25],[14,4,26,32,11,-24,0,.25]],
    rings:[],front:[[-1,-15,-14,13,9,-12],[3,-15,14,12,8,12],[-12,-5,-6,17,5,6],[12,-5,6,17,5,-6]]},
  chanel:{nome:'Chanel com franja',cap:{dy:-3,ox:3.2,oy:2.6,line:-6},
    rings:[{from:-172,to:-78,n:4,len:20,w:13,g:1,bend:0,var:.04,inset:3},{from:78,to:172,n:4,len:20,w:13,g:1,bend:0,var:.04,inset:3}],
    front:[[-10,-13,-4,11,11,4],[-3,-15,-2,12,11],[4,-15,4,11,11,-4],[11,-12,6,11,10,-6],[-15,-4,0,22,7],[15,-4,0,22,7]]},
  cacheado:{nome:'Cacheado volume',cap:{dy:-6,ox:7,oy:6,line:-7,curly:true},rings:[],front:[]},
  black:{nome:'Black power',cap:{dy:-8,ox:10,oy:8,line:-7,curly:true},rings:[],front:[]},
  raspado:{nome:'Raspado',cap:{dy:-2,ox:.8,oy:.6,line:-8,flat:true},rings:[],front:[]}
};
AV.HAIR=HAIR;
function locksOf(st,d){const L=[];(st.rings||[]).forEach(r=>ring(d,st.cap,r).forEach(o=>L.push(o)));return L;}

/* cabelo como MASSA única: silhueta das mechas + faixas de sombra/luz por dentro (sem contorno entre fios) */
const mirS=(o,b)=>b?[-o[0],o[1],-o[2],o[3],o[4],-(o[5]||0),o[6]||0,o[7]||0]:o;
function strokes(cv,p,cx,cy,list,light=true){list.forEach(s=>{if(s[3]<7)return;const L=lockPts(cx,cy,s),n=L.poly.length/2,left=L.poly.slice(0,n),right=L.poly.slice(n).reverse();
  cv.ink(p,right.slice(Math.floor(n*.25)),{tone:1});
  if(light&&s[3]>10)cv.ink(p,left.slice(1,Math.ceil(n*.55)).map(([x,y],i)=>[x+(right[i+1][0]-x)*.32,y+(right[i+1][1]-y)*.32]),{tone:3});});}
function addLocks(p,cx,cy,list){list.forEach(s=>p.poly(lockPts(cx,cy,s).poly));}
function drawHairBack(cv,sk,R,id){const st=HAIR[id];if(!st||sk.view!=='f')return;const h=sk.head,d=sk.d;
  const L=locksOf(st,d).filter(o=>Math.abs(o.phi)>=150||(o.s[3]>30)).map(o=>o.s).concat(st.tails||[]);if(!L.length)return;
  const p=cv.part_({mat:R.hair,round:7,auto:true,bias:-1});addLocks(p,h[0],h[1],L);p.commit();strokes(cv,p,h[0],h[1],L,false);}
function drawHair(cv,sk,R,id,hatOn){const st=HAIR[id];if(!st)return;const h=sk.head,d=sk.d,cx=h[0],cy=h[1],c=st.cap,back=sk.view==='b';
  const locks=locksOf(st,d);
  if(st.buns&&!hatOn)st.buns.forEach(([x,y,r])=>{const p=cv.part_({mat:R.hair,round:4,auto:true});p.ell(cx+(back?-x:x),cy+y,r,r*.92);p.commit();
    cv.ink(p,[[cx+x-r*.5,cy+y-r*.1],[cx+x+r*.1,cy+y-r*.5]],{tone:3});cv.ink(p,[[cx+x-r*.2,cy+y+r*.5],[cx+x+r*.5,cy+y+r*.1]],{tone:1});});
  const p=cv.part_({mat:R.hair,round:c.curly?4:8,auto:true,bias:c.flat?-1:0,light:c.curly?((I,x,y)=>I+.5*Math.sin(x*.9)*Math.sin(y*.85)):undefined});
  const vis=locks.filter(o=>back||(Math.abs(o.phi)<150&&o.s[3]<=30));
  const top=vis.filter(o=>Math.abs(o.phi)<=60).map(o=>mirS(o.s,back)),sides=vis.filter(o=>Math.abs(o.phi)>60).map(o=>mirS(o.s,back));
  p.ell(cx,cy+c.dy,d.hrx+c.ox,d.hry+c.oy);
  if(c.curly){const n=18;for(let k=0;k<n;k++){const a=k/n*Math.PI*2;p.ell(cx+Math.cos(a)*(d.hrx+c.ox-1),cy+c.dy+Math.sin(a)*(d.hry+c.oy-1),5,5);}}
  if(!hatOn)addLocks(p,cx,cy,top);
  if(!back){const ly=cy+c.line;p.poly([[cx-d.hrx+2.5,ly+(c.curly?2:7)],[cx-d.hrx+4,ly],[cx-6,ly-2],[cx+2,ly-2.5],[cx+8,ly-1.5],[cx+d.hrx-2,ly],[cx+d.hrx,ly+4],[cx+d.hrx+2,cy+30],[cx-d.hrx-2,cy+30]],true);
    if(!c.curly){p.poly([[cx-d.hrx-.5,ly+2],[cx-d.hrx+2.5,ly+2],[cx-d.hrx+2,cy+4],[cx-d.hrx+.5,cy+4]]);p.poly([[cx+d.hrx+.5,ly+2],[cx+d.hrx-2.5,ly+2],[cx+d.hrx-2,cy+4],[cx+d.hrx-.5,cy+4]]);}}
  else p.poly([[cx-40,cy+(c.flat?7:c.curly?13:10)],[cx+40,cy+(c.flat?7:c.curly?13:10)],[cx+40,cy+40],[cx-40,cy+40]],true);
  addLocks(p,cx,cy,sides);
  let extra=[];
  if(back){extra=locks.filter(o=>o.s[3]>30||Math.abs(o.phi)>=150).map(o=>[-o.s[0],o.s[1]+1,-o.s[2],o.s[3],o.s[4],-(o.s[5]||0)]).concat((st.tails||[]).map(s=>mirS(s,true)));
    if(!c.curly&&!c.flat){const long=locks.some(o=>o.s[3]>30);extra=extra.concat([[-10,-12,-14,24,11,10],[-4,-15,-5,27,11,4],[3,-15,5,27,11,-4],[9,-12,14,24,11,-10],[-13,-3,-10,18,9,6],[13,-3,10,18,9,-6]].map(s=>[s[0],s[1],s[2],s[3]+(long?6:0),s[4],s[5]]));
      if(long)extra=extra.concat([[-9,4,-3,44,13,3],[0,6,0,46,14],[9,4,3,44,13,-3]]);}}
  else extra=st.front||[];
  addLocks(p,cx,cy,extra);
  if(hatOn)p.poly([[0,0],[W,0],[W,cy-8],[0,cy-8]],true);
  p.commit();
  if(st.tips)cv.fillIn(p,(x,y)=>y<cy-13,{rgb:AV.mixc(R.hair[4],[245,235,200],.6)});
  if(c.flat)cv.fillIn(p,(x,y)=>((Math.floor(x/2)*7+Math.floor(y/2)*13))%5===0,{tone:1});
  if(!c.curly&&!c.flat){strokes(cv,p,cx,cy,sides,false);strokes(cv,p,cx,cy,extra,true);if(!hatOn)strokes(cv,p,cx,cy,top,false);}
}
AV.drawHairBack=drawHairBack;AV.drawHair=drawHair;
})(AV);
