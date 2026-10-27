/* ===== guarda-roupa Y2K ===== */
(function(AV){
const{W,H,mixc,clamp,torsoPoly,headShape,drawHand}=AV;
const xy=v=>[v[0],v[1]];
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const ITENS={};const reg=(slot,id,nome,o)=>{(ITENS[slot]=ITENS[slot]||[]).push(Object.assign({id,nome,slot},o));};
AV.ITENS=ITENS;
const WHITE=AV.ramp('#ecebe6'),BLACK=AV.ramp('#232228'),SILVER=AV.ramp('#b9bec2'),RED=AV.ramp('#a3283a'),GOLD=AV.ramp('#e2b84a');
AV.FIX={WHITE,BLACK,SILVER,RED,GOLD};

/* ---------- utilidades de roupa ---------- */
function bodyCloth(cv,sk,C,o){const d=sk.d,{off=2,hem=6,crop=false,neck='crew',fit=0,flare=0}=o;
  const p=cv.part_({mat:C.r1,mat2:C.r2,pat:o.pat,round:6,group:o.group||'top',bias:o.bias||0});
  const pts=torsoPoly(sk,d,off+fit);
  p.poly(pts);
  const pe=sk.pelvis,hemY=crop?sk.waist[1]+hem:pe[1]+hem;
  if(d.F&&sk.view==='f'){const c=sk.chest;p.ell(c[0]-6.5,c[1]+1,6.2+off*.6,5.4+off*.5);p.ell(c[0]+6.5,c[1]+1,6.2+off*.6,5.4+off*.5);}
  if(d.belly){p.ell(sk.waist[0],sk.waist[1]+4,d.waistH+d.belly*.6+off,10+off);}
  if(flare){p.poly([[pe[0]-d.hipH-off-1,pe[1]-2],[pe[0]+d.hipH+off+1,pe[1]-2],[pe[0]+d.hipH+off+flare,hemY],[pe[0]-d.hipH-off-flare,hemY]]);}
  p.poly([[0,hemY],[W,hemY],[W,H],[0,H]],true);
  const n=sk.neck;
  if(sk.view==='f'){if(neck==='crew')p.ell(n[0],n[1]-2.5,d.neckR+2.2,4.2,true);
    else if(neck==='v')p.poly([[n[0]-d.neckR-2,n[1]-4],[n[0]+d.neckR+2,n[1]-4],[n[0],n[1]+9]],true);
    else if(neck==='scoop')p.ell(n[0],n[1]+1,d.neckR+5,6.5,true);
    else if(neck==='halter')p.poly([[n[0]-d.neckR-1,n[1]-6],[sk.shL[0]-8,sk.shL[1]-6],[sk.shL[0]-8,sk.chest[1]+3],[n[0]-4,sk.chest[1]-4],[n[0]+4,sk.chest[1]-4],[sk.shR[0]+8,sk.chest[1]+3],[sk.shR[0]+8,sk.shR[1]-6],[n[0]+d.neckR+1,n[1]-6]],true);
    else if(neck==='tank')p.poly([[n[0]-d.neckR-2.5,n[1]-6],[n[0]-d.neckR-3,n[1]+3],[n[0],n[1]+6],[n[0]+d.neckR+3,n[1]+3],[n[0]+d.neckR+2.5,n[1]-6]],true);}
  else p.ell(n[0],n[1]-4.5,d.neckR+1.8,3,true);
  if(neck==='tank'){const sL=sk.shL,sR=sk.shR;p.poly([[sL[0]-9,sL[1]-8],[sL[0]+5,sL[1]-8],[sL[0]+4,sL[1]+2],[sL[0]+3,sk.chest[1]+2],[sL[0]-9,sk.chest[1]+2]],true);
    p.poly([[sR[0]+9,sR[1]-8],[sR[0]-5,sR[1]-8],[sR[0]-4,sR[1]+2],[sR[0]-3,sk.chest[1]+2],[sR[0]+9,sk.chest[1]+2]],true);}
  p.commit();return p;}
AV.bodyCloth=bodyCloth;
function sleeve(cv,sk,n,C,o){const d=sk.d,s=sk['sh'+n],e=sk['el'+n],w=sk['wr'+n],{len=.55,off=2.6,cuff=1.5,pat}=o;
  const proj=(x,y)=>{const f=(A,B)=>{const vx=B[0]-A[0],vy=B[1]-A[1],ll=vx*vx+vy*vy||1;const t=((x-A[0])*vx+(y-A[1])*vy)/ll;const px=A[0]+vx*t,py=A[1]+vy*t;return[t,Math.hypot(x-px,y-py),(-vy*(x-A[0])+vx*(y-A[1]))/Math.sqrt(ll)];};
    const a=f(s,e);if(a[0]<=1||len<=1)return[a[0],a[2]/(d.uA[0]+off)];const b=f(e,w);return[1+b[0],b[2]/(d.uA[1]+off)];};
  const p=cv.part_({mat:C.r1,mat2:C.r2,pat:pat?((x,y)=>{const[u,ss]=proj(x,y);return pat(x,y,u,ss);}):null,round:4,group:o.group||'top',bias:o.bias||0,auto:true});
  const seg=(A,B,r0,r1,ext0)=>{const vx=B[0]-A[0],vy=B[1]-A[1],L=Math.hypot(vx,vy)||1,ux=vx/L,uy=vy/L,px=-uy,py=ux;const a0=[A[0]-ux*ext0,A[1]-uy*ext0];
    p.poly([[a0[0]+px*r0,a0[1]+py*r0],[B[0]+px*r1,B[1]+py*r1],[B[0]-px*r1,B[1]-py*r1],[a0[0]-px*r0,a0[1]-py*r0]]);};
  const r0=d.uA[0]+off;
  p.ell(s[0],s[1]-1,r0,r0*.95);
  if(len<=1){const t=lerp(s,e,len);seg(xy(s),t,r0,d.uA[0]+off*.75+cuff*.5,0);}
  else{const t=lerp(e,w,len-1);seg(xy(s),xy(e),r0,d.uA[1]+off,0);p.ell(e[0],e[1],d.uA[1]+off,d.uA[1]+off);seg(xy(e),t,d.uA[1]+off,d.fA[1]+off+cuff,0);}
  p.commit();
  if(len<=1){const t=lerp(s,e,len);const vx=e[0]-s[0],vy=e[1]-s[1],L=Math.hypot(vx,vy)||1;const px=-vy/L,py=vx/L,r=d.uA[0]+off*.75+cuff*.5;
    cv.ink(p,[[t[0]+px*r-vx/L*1.5,t[1]+py*r-vy/L*1.5],[t[0]-px*r-vx/L*1.5,t[1]-py*r-vy/L*1.5]],{dt:-1});}
  return p;}
AV.sleeve=sleeve;
function folds(cv,p,list,dt=-1){list.forEach(l=>{cv.ink(p,l,{dt});cv.ink(p,l.map(([x,y])=>[x-1,y]),{dt:1});});}

/* ================= TOPS (por baixo) ================= */
const printStar=(cv,p,sk,C)=>{if(sk.view!=='f')return;const c=sk.chest,x=Math.round(c[0])+1,y=Math.round(c[1])+5,R=12;const pts=[];
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?R*.45:R;pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}
  cv.fillIn(p,(px,py)=>AV.inPoly(pts,px,py),{rgb:C.print[1]});cv.ink(p,pts,{rgb:C.print2[2]},true);
  cv.fillIn(p,(px,py)=>{const dx=px-x-.5,dy=py-y;return dx*dx/16+dy*dy/12<1;},{rgb:[232,232,226]});
  [[x-2,y],[x+2,y]].forEach(([a,b])=>cv.dot(p.id,a,b,{rgb:[30,28,34]}));
  [[x-12,y-6],[x+11,y-7],[x+12,y+5]].forEach(([a,b])=>{cv.dot(p.id,a,b,{rgb:[200,200,196]});cv.dot(p.id,a+1,b,{rgb:[200,200,196]});cv.dot(p.id,a,b+1,{rgb:[200,200,196]});cv.dot(p.id,a-1,b,{rgb:[200,200,196]});cv.dot(p.id,a,b-1,{rgb:[200,200,196]});});};
const printHeart=(cv,p,sk,C)=>{if(sk.view!=='f')return;const c=sk.chest,x=c[0]+1,y=c[1]+2;
  cv.fillIn(p,(px,py)=>{const X=(px-x)/9,Y=-(py-y)/9+.25;return Math.pow(X*X+Y*Y-1,3)-X*X*Y*Y*Y<0;},{rgb:C.print[2]});
  cv.fillIn(p,(px,py)=>{const X=(px-x+2)/2,Y=(py-y+2)/1.3;return X*X+Y*Y<1;},{rgb:C.print[4]});};
const printButterfly=(cv,p,sk,C)=>{if(sk.view!=='f')return;const c=sk.chest,x=c[0]+1,y=c[1]+2;
  cv.fillIn(p,(px,py)=>{const dx=Math.abs(px-x),dy=py-y;return dx>1&&((dx-5)**2/16+(dy+2)**2/12<1||(dx-4)**2/9+(dy-4)**2/6<1);},{rgb:C.print[2]});
  cv.fillIn(p,(px,py)=>{const dx=Math.abs(px-x),dy=py-y;return dx>2&&(dx-5)**2/3+(dy+2)**2/3<1;},{rgb:C.print[4]});
  cv.ink(p,[[x,y-5],[x,y+6]],{rgb:[30,28,34]});};
const textBaby=(cv,p,sk,C)=>{if(sk.view!=='f')return;const c=sk.chest,x=Math.round(c[0])-8,y=Math.round(c[1])+1;
  const G={B:['11.','1.1','11.','1.1','11.'],A:['.1.','1.1','111','1.1','1.1'],Y:['1.1','1.1','.1.','.1.','.1.']};
  ['B','A','B','Y'].forEach((ch,k)=>G[ch].forEach((row,r)=>[...row].forEach((v,cc)=>{if(v==='1')cv.dot(p.id,x+k*4+cc,y+r,{rgb:C.print[3]});})));};

const sec=(c,k)=>mixc(c,[255,255,255],k);
reg('top_under','camiseta','Camiseta estampa',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:2.4,hem:9,flare:2});printStar(cv,p,sk,C);
    folds(cv,p,[[[sk.waist[0]-9,sk.waist[1]+4],[sk.waist[0]-4,sk.pelvis[1]+5]],[[sk.waist[0]+12,sk.waist[1]],[sk.waist[0]+8,sk.pelvis[1]+6]]]);return p;},
  sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:.62,off:2.6,cuff:2.4})}});
reg('top_under','baby-tee','Baby tee',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:1.2,hem:4,crop:true,neck:'scoop'});printHeart(cv,p,sk,C);return p;},
  sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:.36,off:1.6,cuff:.6})}});
reg('top_under','regata','Regata canelada',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:1.5,hem:sk.d.F?2:6,crop:sk.d.F,neck:'tank'});
    cv.fillIn(p,(x)=>Math.floor(x)%3===0,{dt:-1});return p;}}});
reg('top_under','manga-listrada','Manga longa listrada',{sec:c=>'#26242b',draw:{body:(cv,sk,C)=>bodyCloth(cv,sk,C,{off:2,hem:7,pat:(x,y)=>Math.floor(y/4)%2}),
  sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:1.98,off:1.2,cuff:.8,pat:(x,y,u)=>Math.floor(u*4.6+.3)%2})}});
reg('top_under','frente-unica','Top tomara que caia',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:1,hem:0,crop:true,neck:'halter'});
    const n=sk.neck;cv.ink(p,[[n[0]-1,n[1]+8],[n[0]-1,sk.waist[1]-2]],{dt:-1});return p;}}});
reg('top_under','camisa-time','Camisa de time',{sec:c=>'#f2efe9',draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:3.6,hem:10,neck:'v',pat:(x,y)=>Math.abs(x-sk.neck[0]-1)<2.2?1:0});
    if(sk.view==='f'){const c=sk.chest;const nx=Math.round(c[0])+5,ny=Math.round(c[1])+4;const G=['111','..1','.1.','1..','111'];G.forEach((r,i)=>[...r].forEach((v,j)=>{if(v==='1'){cv.dot(p.id,nx+j*2,ny+i*2,{alt:1});cv.dot(p.id,nx+j*2+1,ny+i*2,{alt:1});cv.dot(p.id,nx+j*2,ny+i*2+1,{alt:1});cv.dot(p.id,nx+j*2+1,ny+i*2+1,{alt:1});}}));}
    else{const c=sk.chest;const nx=Math.round(c[0])-5,ny=Math.round(c[1])-2;const G=['111','..1','.1.','1..','111'];G.forEach((r,i)=>[...r].forEach((v,j)=>{if(v==='1')for(let a=0;a<3;a++)for(let b=0;b<3;b++)cv.dot(p.id,nx+j*3+a,ny+i*3+b,{alt:1});}));}
    return p;},
  sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:.7,off:4,cuff:2.6,pat:(x,y,u)=>u>.55?1:0})}});


const text90=(cv,p,sk,C)=>{if(sk.view!=='f')return;const K=AV.K,c=sk.chest,x0=Math.round(c[0]*K)-5,y0=Math.round(c[1]*K)-4,INK=[30,28,34];
  const put=(gl,ox,oy,col)=>gl.forEach((r,j)=>[...r].forEach((v,i)=>{if(v==='1')cv._dot(p.id,x0+ox+i,y0+oy+j,{rgb:typeof col==='function'?col(i,j):col});}));
  put(['111','.1.','.1.','.1.','111'],0,0,INK);
  put(['11.11','11111','11111','.111.','..1..'],5,0,(i,j)=>(j===1&&i===1)?[240,170,175]:j>2?[150,28,38]:[196,40,50]);
  put(['111','1.1','111','..1','111'],0,6,INK);put(['111','1.1','1.1','1.1','111'],4,6,INK);put(['.11','.1.','..1','11.'],8,7,INK);};
reg('top_under','moletom-90s','Moletom I ♥ 90s',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:4,hem:7,neck:'crew'});text90(cv,p,sk,C);
    const pe=sk.pelvis;cv.ink(p,[[pe[0]-sk.d.hipH-5,pe[1]+4],[pe[0]+sk.d.hipH+5,pe[1]+4]],{dt:-1});return p;},
  sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:1.97,off:3.4,cuff:1.4})}});

/* ================= TOPS (por cima) ================= */
function zipper(cv,p,sk,C){const n=sk.neck,x=Math.round(n[0]);for(let y=Math.round(n[1])+1;y<sk.pelvis[1]+14;y++){cv.dot(p.id,x,y,{tone:0});if(y%3===0)cv.dot(p.id,x+1,y,{rgb:SILVER[3]});}
  cv.dot(p.id,x+1,Math.round(n[1])+3,{rgb:SILVER[4]});cv.dot(p.id,x+1,Math.round(n[1])+4,{rgb:SILVER[2]});}
reg('top_over','moletom-ziper','Moletom zíper',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:4.4,hem:12,neck:sk.view==='f'?'none':'crew',group:'over',bias:0});
    if(sk.view==='f'){zipper(cv,p,sk,C);const pe=sk.pelvis;cv.ink(p,[[pe[0]-sk.d.hipH-4,pe[1]+9],[pe[0]+sk.d.hipH+4,pe[1]+9]],{dt:-1});
      const c=sk.chest;cv.ink(p,[[c[0]-10,pe[1]-2],[c[0]-5,pe[1]+4]],{tone:0});cv.ink(p,[[c[0]+10,pe[1]-2],[c[0]+5,pe[1]+4]],{tone:0});}
    // capuz
    const n=sk.neck,hp=cv.part_({mat:C.r1,round:3,group:'over'});
    if(sk.view==='f'){hp.poly([[n[0]-11,n[1]-3],[n[0]-6,n[1]-7],[n[0]+6,n[1]-7],[n[0]+11,n[1]-3],[n[0]+7,n[1]+2],[n[0],n[1]+4],[n[0]-7,n[1]+2]]);hp.ell(n[0],n[1]-3.6,d0(sk)+.5,3.4,true);hp.commit();
      cv.ink(hp,[[n[0]-3,n[1]+2],[n[0]-3,n[1]+8]],{rgb:WHITE[2]});cv.ink(hp,[[n[0]+3,n[1]+2],[n[0]+3,n[1]+9]],{rgb:WHITE[2]});}
    else{hp.poly([[n[0]-12,n[1]-8],[n[0]+12,n[1]-8],[n[0]+10,n[1]+12],[n[0],n[1]+16],[n[0]-10,n[1]+12]]);hp.commit();cv.ink(hp,[[n[0],n[1]-6],[n[0],n[1]+14]],{dt:-1});}
    return p;},
  sleeve:(cv,sk,n,C)=>{const p=sleeve(cv,sk,n,C,{len:1.95,off:3.6,cuff:1,group:'over'});return p;}}});
const d0=sk=>sk.d.neckR+2;
reg('top_over','jaqueta-racing','Jaqueta racing',{sec:c=>'#f2efe9',draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:4.2,hem:7,neck:'none',group:'over',pat:(x,y)=>{const c=sk.chest;return (Math.abs(y-c[1]-2+(x-c[0])*.0)<2&&Math.abs(x-c[0])>4)?1:0;}});
    if(sk.view==='f'){zipper(cv,p,sk,C);const n=sk.neck;// gola
      const g=cv.part_({mat:C.r1,round:2,group:'over'});g.poly([[n[0]-9,n[1]-5],[n[0]-2,n[1]-3],[n[0],n[1]+1],[n[0]+2,n[1]-3],[n[0]+9,n[1]-5],[n[0]+10,n[1]],[n[0]+2,n[1]+4],[n[0]-2,n[1]+4],[n[0]-10,n[1]]]);g.ell(n[0],n[1]-4,d0(sk),3,true);g.commit();
      cv.dot(p.id,Math.round(sk.chest[0])+8,Math.round(sk.chest[1])-6,{rgb:C.r2[4]});cv.dot(p.id,Math.round(sk.chest[0])+9,Math.round(sk.chest[1])-6,{rgb:C.r2[4]});}
    return p;},
  sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:1.95,off:3.2,cuff:.6,group:'over',pat:(x,y,u,s)=>(s>.2&&s<.55)?1:0})}});
reg('top_over','camisa-aberta','Camisa aberta',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:4,hem:10,neck:'v',group:'over',pat:(x,y)=>(Math.floor(x/3)+Math.floor(y/3))%2});
    if(sk.view==='f'){const n=sk.neck;cv.fillIn(p,(x,y)=>Math.abs(x-n[0])<4.5&&y>n[1]-2,{});p.mask;}
    return p;},
  sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:.6,off:3.8,cuff:1.6,group:'over',pat:(x,y)=>(Math.floor(x/3)+Math.floor(y/3))%2})},sec:c=>mixc(AV.hx(c),[20,18,24],.45).map(v=>v.toString(16).padStart(2,'0')).reduce((a,b)=>a+b,'#')});
reg('top_over','colete-puffer','Colete puffer',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:6,hem:8,neck:'crew',group:'over',bias:0});
    const c=sk.chest;for(let k=0;k<5;k++){const y=c[1]-8+k*8;cv.ink(p,[[c[0]-24,y],[c[0]+24,y]],{tone:1});cv.ink(p,[[c[0]-24,y+1],[c[0]+24,y+1]],{dt:1});}
    if(sk.view==='f')zipper(cv,p,sk,C);return p;}}});

/* ================= BAIXO ================= */
function hipPiece(cv,sk,C,o){const d=sk.d,pe=sk.pelvis,top=pe[1]-(o.rise||2),w=d.hipH+(o.off||3);
  const p=cv.part_({mat:C.r1,mat2:C.r2,pat:o.pat,round:5,group:'bottom'});
  p.poly([[pe[0]-w+.5,top],[pe[0]+w-.5,top],[pe[0]+w+1.5,pe[1]+12],[pe[0]+3,pe[1]+17],[pe[0]-3,pe[1]+17],[pe[0]-w-1.5,pe[1]+12]]);
  if(d.belly)p.ell(pe[0],top+2,w+1,5);p.commit();
  cv.ink(p,[[pe[0]-w+1,top+3],[pe[0]+w-1,top+3]],{dt:-1});// cós
  if(sk.view==='f'&&o.fly!==false){cv.ink(p,[[pe[0]+1,top+4],[pe[0]+1,pe[1]+12]],{tone:0});}
  if(o.loops)[-.7,-.25,.25,.7].forEach(k=>cv.ink(p,[[pe[0]+w*k,top+.5],[pe[0]+w*k,top+3]],{dt:-1}));
  return p;}
function legPiece(cv,sk,n,C,o){const d=sk.d,h=sk['hip'+n],k=sk['knee'+n],a=sk['ank'+n];const{top=4,knee=5,bot=8,len=1,bunch=0,pat}=o;
  const p=cv.part_({mat:C.r1,mat2:C.r2,pat,round:o.round||5,group:'bottom',light:o.light});
  const side=(h[0]<sk.pelvis[0])?-1:1;const H0=[h[0]-side*1.5,h[1]-5];
  if(len<=1){const e=lerp(k,a,0);const tt=len<1?lerp(h,k,len):xy(k);p.cap(H0,tt,d.th[0]+top,d.th[0]+top+(knee-top)*len);}
  else{p.cap(H0,xy(k),d.th[0]+top,d.th[1]+knee);const end=lerp(k,a,len-1);p.cap(xy(k),[end[0],end[1]+(len>=2?6:0)],d.th[1]+knee,d.sh[1]+bot);
    if(bunch){p.ell(end[0],end[1]+3,d.sh[1]+bot+1.5,6);}}
  if(len>=2){const sole=a[1]+12;p.poly([[0,sole-(o.hemLift||2)],[W,sole-(o.hemLift||2)],[W,H],[0,H]],true);}
  p.commit();return p;}
AV.legPiece=legPiece;AV.hipPiece=hipPiece;
const stackFolds=(cv,p,sk,n,count=4,from=.45)=>{const k=sk['knee'+n],a=sk['ank'+n];for(let i=0;i<count;i++){const t=from+i*(1-from)/count,c=lerp(k,a,t),w=10+i*1.5;
  cv.ink(p,[[c[0]-w,c[1]+2],[c[0]-2,c[1]-1+(i%2)],[c[0]+w,c[1]+3]],{tone:0});cv.ink(p,[[c[0]-w+2,c[1]+1],[c[0]-2,c[1]-2+(i%2)],[c[0]+w-2,c[1]+2]],{dt:1});}};
reg('bottom','cargo','Cargo larga',{draw:{
  hip:(cv,sk,C)=>hipPiece(cv,sk,C,{rise:1,off:4,loops:true}),
  leg:(cv,sk,n,C)=>{const p=legPiece(cv,sk,n,C,{top:5,knee:8,bot:9,len:2,bunch:1,hemLift:1});stackFolds(cv,p,sk,n,4,.5);
    const h=sk['hip'+n],k=sk['knee'+n],side=(h[0]<sk.pelvis[0])?-1:1;const m=lerp(h,k,.62),x=m[0]+side*8;// bolso cargo
    if(sk.pose.sit!==2){cv.fillIn(p,(px,py)=>px>x-4&&px<x+4&&py>m[1]-6&&py<m[1]+7,{tone:2});cv.ink(p,[[x-4,m[1]-6],[x+4,m[1]-6],[x+4,m[1]+7],[x-4,m[1]+7],[x-4,m[1]-6]],{tone:0});cv.ink(p,[[x-3,m[1]-2],[x-3,m[1]+6]],{tone:3});cv.ink(p,[[x-4,m[1]-3],[x+4,m[1]-3]],{tone:0});cv.ink(p,[[x-3,m[1]-5],[x+3,m[1]-5]],{dt:1});
      cv.dot(p.id,Math.round(x),Math.round(m[1]-2),{rgb:SILVER[3]});}
    cv.ink(p,[[h[0]-side*3,h[1]+4],[k[0]-side*2,k[1]-6]],{dt:-1});return p;}}});
reg('bottom','flare','Jeans flare cintura baixa',{sec:c=>'#e9c46a',draw:{
  hip:(cv,sk,C)=>{const p=hipPiece(cv,sk,C,{rise:-3,off:2,loops:true});return p;},
  leg:(cv,sk,n,C)=>{const p=legPiece(cv,sk,n,C,{top:2,knee:1.5,bot:11,len:2,hemLift:1,
      light:(I,x,y)=>I+.18*Math.sin(x*.9+y*.3)*.5});
    const h=sk['hip'+n],k=sk['knee'+n],a=sk['ank'+n],side=(h[0]<sk.pelvis[0])?-1:1;
    cv.ink(p,[[h[0]+side*7,h[1]],[k[0]+side*6,k[1]],[a[0]+side*12,a[1]+8]],{alt:1});// costura
    cv.ink(p,[[h[0]-side*2,h[1]+6],[h[0]+side*3,h[1]+10]],{dt:1});cv.ink(p,[[h[0]-side*1,h[1]+11],[h[0]+side*4,h[1]+14]],{dt:1});
    cv.ink(p,[[k[0]-4,k[1]-1],[k[0]+3,k[1]]],{dt:-1});return p;}}});
reg('bottom','saia-xadrez','Saia xadrez',{sec:c=>'#1d1c22',draw:{
  hip:(cv,sk,C)=>{const d=sk.d,pe=sk.pelvis,top=pe[1]-1,w=d.hipH+3,bot=pe[1]+30;const p=cv.part_({mat:C.r1,mat2:C.r2,round:4,group:'bottom',
      pat:(x,y)=>((Math.floor((x+2)/4)%3===0)||(Math.floor((y)/4)%3===0))?1:0});
    p.poly([[pe[0]-w,top],[pe[0]+w,top],[pe[0]+w+9,bot],[pe[0]-w-9,bot]]);p.commit();
    for(let k=-3;k<=3;k++){const x=pe[0]+k*5;cv.ink(p,[[x,top+6],[x+k*1.6,bot-1]],{tone:0});}
    cv.ink(p,[[pe[0]-w,top+3],[pe[0]+w,top+3]],{dt:-1});return p;},
  leg:null}});
reg('bottom','moletom-listra','Calça de moletom',{sec:c=>'#f2efe9',draw:{
  hip:(cv,sk,C)=>hipPiece(cv,sk,C,{rise:2,off:4,fly:false}),
  leg:(cv,sk,n,C)=>{const p=legPiece(cv,sk,n,C,{top:4,knee:5,bot:5,len:2,bunch:1,pat:(x,y,u,s)=>{const side=(sk['hip'+n][0]<sk.pelvis[0])?-1:1;return (s*side>.62&&s*side<.86)?1:0;}});stackFolds(cv,p,sk,n,2,.75);return p;}}});
reg('bottom','bermuda','Bermuda cargo',{draw:{
  hip:(cv,sk,C)=>hipPiece(cv,sk,C,{rise:1,off:4,loops:true}),
  leg:(cv,sk,n,C)=>{const p=legPiece(cv,sk,n,C,{top:4.5,knee:6.5,len:1.16});const h=sk['hip'+n],k=sk['knee'+n],side=(h[0]<sk.pelvis[0])?-1:1,m=lerp(h,k,.6),x=m[0]+side*9;
    cv.ink(p,[[x-4,m[1]-5],[x+4,m[1]-5],[x+4,m[1]+6],[x-4,m[1]+6],[x-4,m[1]-5]],{tone:0});return p;}}});
reg('bottom','mini-jeans','Mini saia jeans',{draw:{
  hip:(cv,sk,C)=>{const d=sk.d,pe=sk.pelvis,top=pe[1]-2,w=d.hipH+2.5,bot=pe[1]+20;const p=cv.part_({mat:C.r1,round:4,group:'bottom'});
    p.poly([[pe[0]-w,top],[pe[0]+w,top],[pe[0]+w+4,bot],[pe[0]-w-4,bot]]);p.commit();cv.ink(p,[[pe[0]-w,top+3],[pe[0]+w,top+3]],{dt:-1});
    if(sk.view==='f')cv.ink(p,[[pe[0]+1,top+3],[pe[0]+1,bot-6]],{tone:0});cv.ink(p,[[pe[0]-w-4,bot-1],[pe[0]+w+4,bot-1]],{dt:1});return p;},leg:null}});

/* ================= CALÇADOS ================= */
function shoeBase(cv,sk,n,C,o){const a=sk['ank'+n],side=(sk['hip'+n][0]<sk.pelvis[0])?-1:1,x=a[0]+side*1.5,y=a[1];const{h=7,w=9.5,sole=3,top=0}=o;
  const p=cv.part_({mat:C.r1,mat2:C.r2,round:3,group:'shoe'});
  p.ell(x,y+12-sole-h*.55,w,h).rect(x-w,y+12-sole-h*.55,x+w,y+12-sole);if(top)p.rect(x-w+2.5,y-top,x+w-2.5,y+6);p.commit();
  const s=cv.part_({mat:o.soleR||WHITE,round:2,group:'shoe'});s.rect(x-w-1,y+12-sole,x+w+1,y+12);s.ell(x,y+12-sole,w+1,1.5);s.commit();
  cv.ink(s,[[x-w,y+12-sole+1],[x+w,y+12-sole+1]],{dt:-1});
  return{p,s,x,y,side};}
reg('shoes','skate','Tênis de skate',{sec:c=>'#a3283a',draw:{leg:(cv,sk,n,C)=>{const{p,s,x,y}=shoeBase(cv,sk,n,C,{h:7,w:10,sole:3.5,soleR:BLACK});
  cv.ink(s,[[x-10,y+10],[x+10,y+10]],{rgb:C.r2[2]});
  cv.ink(p,[[x-6,y+4],[x+5,y+3]],{tone:0});cv.ink(p,[[x-5,y+6],[x+6,y+5]],{tone:0});cv.dot(p.id,Math.round(x-3),Math.round(y+5),{rgb:WHITE[3]});cv.dot(p.id,Math.round(x+2),Math.round(y+4),{rgb:WHITE[3]});
  cv.ink(p,[[x-9,y+7],[x-4,y+3]],{alt:1});cv.ink(p,[[x-9,y+8],[x-3,y+4]],{alt:1});return p;}}});
reg('shoes','plataforma','Tênis plataforma',{draw:{leg:(cv,sk,n,C)=>{const{p,s,x,y}=shoeBase(cv,sk,n,C,{h:6.5,w:9,sole:7});
  for(let k=0;k<3;k++)cv.ink(s,[[x-9,y+6+k*2],[x+9,y+6+k*2]],{dt:-1});cv.ink(p,[[x-4,y+1],[x+4,y+1]],{tone:0});cv.ink(p,[[x-4,y+3],[x+4,y+3]],{tone:0});return p;}}});
reg('shoes','cano-alto','All star cano alto',{draw:{leg:(cv,sk,n,C)=>{const{p,s,x,y}=shoeBase(cv,sk,n,C,{h:6,w:8.5,sole:3,top:10});
  const t=cv.part_({mat:WHITE,round:2,group:'shoe'});t.ell(x,y+8,7,3.4);t.commit();cv.ink(s,[[x-9,y+10],[x+9,y+10]],{rgb:RED[2]});
  for(let k=0;k<4;k++)cv.ink(p,[[x-2,y-8+k*3],[x+2,y-7+k*3]],{rgb:WHITE[3]});cv.dot(p.id,Math.round(x)-6,Math.round(y)-3,{rgb:WHITE[4]});return p;}}});
reg('shoes','bota-plataforma','Bota plataforma',{draw:{leg:(cv,sk,n,C)=>{const k=sk['knee'+n],a=sk['ank'+n],side=(sk['hip'+n][0]<sk.pelvis[0])?-1:1;
  const b=cv.part_({mat:C.r1,round:3,group:'shoe',gloss:true});b.cap(lerp(k,a,.25),xy(a),sk.d.sh[0]+2.5,sk.d.sh[1]+3.5);b.commit();
  const{p,s,x,y}=shoeBase(cv,sk,n,C,{h:6.5,w:9,sole:8,soleR:BLACK});
  for(let i=0;i<3;i++){const c=lerp(k,a,.4+i*.18);cv.ink(b,[[c[0]-6,c[1]],[c[0]+6,c[1]+1]],{rgb:SILVER[3]});cv.dot(b.id,Math.round(c[0]+side*5),Math.round(c[1]),{rgb:SILVER[4]});}
  for(let i=0;i<3;i++)cv.ink(s,[[x-9,y+5+i*2.5],[x+9,y+5+i*2.5]],{dt:-1});return p;}}});

/* ================= PESCOÇO ================= */
reg('neck','fone','Fone no pescoço',{draw:{neck:(cv,sk,C)=>{if(sk.view==='b'){const n=sk.neck;const b=cv.part_({mat:BLACK,round:2});b.cap([n[0]-8,n[1]-1],[n[0]+8,n[1]-1],2,2);b.commit();return;}
  const n=sk.neck,y=n[1]+1;const band=cv.part_({mat:BLACK,round:2});band.cap([n[0]-10,y+4],[n[0],y+7],1.8,1.8).cap([n[0],y+7],[n[0]+10,y+4],1.8,1.8);band.commit();
  for(const s of[-1,1]){const c=cv.part_({mat:C.r1,round:3,gloss:true});c.ell(n[0]+s*10,y+1,5,6.5);c.commit();
    const q=cv.part_({mat:BLACK,round:2});q.ell(n[0]+s*10+s*1.5,y+1,2.6,4.4);q.commit();cv.dot(c.id,Math.round(n[0]+s*10-2),Math.round(y-3),{rgb:C.r1[4]});}}}});
reg('neck','choker','Choker',{draw:{neck:(cv,sk,C)=>{const n=sk.neck,y=n[1]-5;const b=cv.part_({mat:BLACK,round:1,gloss:true});b.rect(n[0]-sk.d.neckR-.5,y,n[0]+sk.d.neckR+.5,y+2.2);b.commit();
  if(sk.view==='f'){const c=cv.part_({mat:SILVER,round:1,gloss:true});c.ell(n[0]+.5,y+4,1.6,1.8);c.commit();}}}});
reg('neck','colar-corrente','Corrente grossa',{draw:{neck:(cv,sk,C)=>{if(sk.view==='b')return;const n=sk.neck;for(let i=0;i<9;i++){const t=i/8,x=n[0]-8+16*t,y=n[1]+1+Math.sin(t*Math.PI)*6;
  const c=cv.part_({mat:GOLD,round:1,gloss:true,line:false});c.ell(x,y,1.6,1.3);c.commit();}}}});
reg('neck','gravata','Gravata fina',{draw:{neck:(cv,sk,C)=>{if(sk.view==='b')return;const n=sk.neck;const t=cv.part_({mat:C.r1,round:1});t.poly([[n[0]-1.5,n[1]-2],[n[0]+2.5,n[1]-2],[n[0]+2,n[1]+1],[n[0]+2.5,n[1]+22],[n[0]+.5,n[1]+25],[n[0]-1.5,n[1]+22],[n[0]-1,n[1]+1]]);t.commit();
  cv.ink(t,[[n[0]-1,n[1]+5],[n[0]+2,n[1]+8]],{dt:-1});cv.ink(t,[[n[0]-1,n[1]+11],[n[0]+2,n[1]+14]],{dt:-1});}}});

/* ================= CINTO ================= */
reg('belt','tachas','Cinto de tachinha + corrente',{draw:{belt:(cv,sk,C)=>{const d=sk.d,pe=sk.pelvis,y=pe[1]-1,w=d.hipH+5;const b=cv.part_({mat:BLACK,round:1});
  b.poly([[pe[0]-w,y-2],[pe[0]+w,y-1],[pe[0]+w,y+3.5],[pe[0]-w,y+2.5]]);b.commit();
  for(let x=Math.round(pe[0]-w+3);x<pe[0]+w-2;x+=4){for(const dy of[1])cv.dot(b.id,x,Math.round(y-1+dy+(x-pe[0])*.02),{rgb:SILVER[4]});}
  if(sk.view==='f'){const bk=cv.part_({mat:SILVER,round:1,gloss:true});bk.rect(pe[0]-3,y-2.5,pe[0]+4,y+4);bk.commit();const q=cv.part_({mat:BLACK,round:1});q.rect(pe[0]-1,y-.5,pe[0]+2,y+2);q.commit();
    // corrente de carteira
    const s=sk.pose.sit===2?-1:1;for(let i=0;i<12;i++){const t=i/11,x=pe[0]+w-3-t*8*s+Math.sin(t*Math.PI)*-3,yy=y+3+Math.sin(t*Math.PI)*18;const c=cv.part_({mat:SILVER,round:1,gloss:true,line:false});c.ell(x+4,yy,1.4,1.2);c.commit();}}}}});
reg('belt','cinto-fivela','Cinto fivela grande',{draw:{belt:(cv,sk,C)=>{const d=sk.d,pe=sk.pelvis,y=pe[1]-1,w=d.hipH+5;const b=cv.part_({mat:C.r1,round:1});
  b.poly([[pe[0]-w,y-2],[pe[0]+w,y-1],[pe[0]+w,y+3],[pe[0]-w,y+2]]);b.commit();
  if(sk.view==='f'){const bk=cv.part_({mat:SILVER,round:2,gloss:true});bk.ell(pe[0]+1,y+1,5.5,4);bk.commit();cv.ink(bk,[[pe[0]-2,y+1],[pe[0]+4,y+1]],{tone:1});}}}});

/* ================= CABEÇA ================= */
reg('headwear','gorro','Gorro',{draw:{head:(cv,sk,C)=>{const d=sk.d,h=sk.head;const p=cv.part_({mat:C.r1,round:4});p.ell(h[0],h[1]-6,d.hrx+3,d.hry+1.5);p.rect(0,h[1]-6,W,H,true);
  p.poly([[h[0]-d.hrx-3,h[1]-9],[h[0]+d.hrx+3,h[1]-9],[h[0]+d.hrx+3.5,h[1]-3],[h[0]-d.hrx-3.5,h[1]-3]]);p.commit();
  cv.fillIn(p,(x,y)=>y>h[1]-9&&Math.floor(x)%3===0,{dt:-1});cv.fillIn(p,(x,y)=>y<=h[1]-9&&Math.floor(x)%4===0,{dt:-1});}},mask:true});
reg('headwear','bone','Boné trucker',{sec:c=>'#f2efe9',draw:{head:(cv,sk,C)=>{const d=sk.d,h=sk.head;const p=cv.part_({mat:C.r1,mat2:C.r2,round:4,pat:(x,y)=>y<h[1]-12?0:(x<h[0]-4||x>h[0]+6)?1:0});
  p.ell(h[0],h[1]-6,d.hrx+2.5,d.hry+1);p.rect(0,h[1]-5,W,H,true);p.commit();
  if(sk.view==='f'){cv.fillIn(p,(x,y)=>(x<h[0]-4||x>h[0]+6)&&y>h[1]-13&&(Math.floor(x)+Math.floor(y))%2===0,{dt:-1});
    const v=cv.part_({mat:C.r1,round:2});v.ell(h[0]+2,h[1]-5,d.hrx+4,3.6);v.rect(0,0,W,h[1]-6.2,true);v.commit();
    cv.dot(p.id,Math.round(h[0])+1,Math.round(h[1])-12,{rgb:C.r2[4]});cv.dot(p.id,Math.round(h[0])+2,Math.round(h[1])-12,{rgb:C.r2[4]});}
  else{const v=cv.part_({mat:C.r1,round:2});v.rect(h[0]-4,h[1]-7,h[0]+4,h[1]-4);v.commit();}}},mask:true});
reg('headwear','bandana','Bandana',{draw:{head:(cv,sk,C)=>{const d=sk.d,h=sk.head;const p=cv.part_({mat:C.r1,round:3});p.ell(h[0],h[1]-6,d.hrx+2,d.hry+.8);p.rect(0,h[1]-8,W,H,true);p.commit();
  cv.fillIn(p,(x,y)=>((Math.floor(x)*3+Math.floor(y)*5)%11===0),{rgb:WHITE[3]});
  if(sk.view==='b'){const k=cv.part_({mat:C.r1,round:2});k.poly([[h[0]-3,h[1]-9],[h[0]+3,h[1]-9],[h[0]+6,h[1]+2],[h[0]+1,h[1]-3],[h[0]-4,h[1]+4]]);k.commit();}}},mask:true});
reg('headwear','presilhas','Presilhas borboleta',{draw:{head:(cv,sk,C)=>{const d=sk.d,h=sk.head;if(sk.view==='b')return;
  const cols=[AV.ramp('#ff7bc5'),AV.ramp('#7fd8ff'),AV.ramp('#c8a2ff'),AV.ramp('#ffd25e')];
  [[-9,-11],[-4,-14],[6,-14],[10,-10]].forEach(([dx,dy],i)=>{const x=h[0]+dx,y=h[1]+dy,c=cols[i%4];const p=cv.part_({mat:c,round:1,gloss:true});
    p.ell(x-2,y-1,2.2,2.4).ell(x+2,y-1,2.2,2.4).ell(x-1.5,y+2,1.6,1.4).ell(x+1.5,y+2,1.6,1.4);p.commit();cv.ink(p,[[x,y-2],[x,y+3]],{tone:0});});}}});
reg('headwear','oculos-cabeca','Óculos na cabeça',{draw:{head:(cv,sk,C)=>{if(sk.view==='b')return;const h=sk.head;for(const s of[-1,1]){const p=cv.part_({mat:C.r1,round:2,gloss:true});p.ell(h[0]+s*5.5,h[1]-14,4.6,3);p.commit();}
  const b=cv.part_({mat:SILVER,round:1});b.rect(h[0]-1.5,h[1]-15,h[0]+1.5,h[1]-14);b.commit();}}});

/* ================= ÓCULOS ================= */
reg('glasses','oval','Óculos oval colorido',{draw:{face:(cv,sk,C)=>{if(sk.view==='b')return;const h=sk.head,cx=h[0]+1,y=h[1]+1;
  for(const[ex,w]of[[cx-7,5],[cx+7,5]]){const p=cv.part_({mat:C.r1,round:2,gloss:true});p.ell(ex,y,w,3.2);p.commit();cv.dot(p.id,Math.round(ex-2),Math.round(y-1),{rgb:[255,255,255]});}
  const b=cv.part_({mat:SILVER,round:1,line:false});b.rect(cx-2,y-1,cx+2,y);b.commit();}}});
reg('glasses','escudo','Óculos escudo',{draw:{face:(cv,sk,C)=>{if(sk.view==='b')return;const h=sk.head,cx=h[0]+1,y=h[1]+1;const p=cv.part_({mat:C.r1,round:2,gloss:true,light:(I,x)=>I+.3*Math.sin(x*.4)});
  p.poly([[cx-14,y-3],[cx+14,y-3],[cx+13,y+2],[cx+3,y+4],[cx,y+2],[cx-3,y+4],[cx-13,y+2]]);p.commit();cv.ink(p,[[cx-11,y-1],[cx-6,y-1]],{rgb:[255,255,255]});}}});

/* ================= BOLSA ================= */
reg('bag','baguete','Bolsa baguete',{draw:{bag:(cv,sk,C)=>{const s=sk.shL,e=sk.elL;const p=cv.part_({mat:C.r1,round:3,gloss:true});const x=e[0]-1,y=e[1]+4;
  p.poly([[x-8,y-3],[x+8,y-3],[x+9,y+6],[x-9,y+6]]);p.commit();cv.ink(p,[[x-8,y],[x+8,y]],{dt:-1});const b=cv.part_({mat:GOLD,round:1,gloss:true});b.rect(x-1.5,y-1,x+1.5,y+1.5);b.commit();
  const st=cv.part_({mat:C.r1,round:1});st.cap([x-6,y-3],[s[0]+2,s[1]-2],1,1);st.commit();},strapFront:true}});
reg('bag','transversal','Bolsa transversal',{draw:{bag:(cv,sk,C)=>{const pe=sk.pelvis,sR=sk.shR,sL=sk.shL;const st=cv.part_({mat:BLACK,round:1});
  if(sk.view==='f')st.cap([sR[0]-2,sR[1]-3],[pe[0]-14,pe[1]+2],1.5,1.5);else st.cap([sL[0]+2,sL[1]-3],[pe[0]+14,pe[1]+2],1.5,1.5);st.commit();
  const x=sk.view==='f'?pe[0]-16:pe[0]+16,y=pe[1]+6;const p=cv.part_({mat:C.r1,round:3});p.poly([[x-8,y-6],[x+8,y-6],[x+8,y+7],[x-8,y+7]]);p.commit();
  const f=cv.part_({mat:C.r1,round:2,bias:1});f.poly([[x-8.5,y-6.5],[x+8.5,y-6.5],[x+8.5,y+1],[x-8.5,y+1]]);f.commit();cv.ink(f,[[x-1,y-1],[x+1,y-1]],{rgb:SILVER[4]});}}});

/* ================= OUSADOS ================= */
const skinOf=C=>C.skin||AV.ramp('#e2ae8c');
reg('top_under','espartilho','Espartilho',{sec:c=>'#f2efe9',draw:{body:(cv,sk,C)=>{const d=sk.d,c=sk.chest,w=sk.waist;
    const p=bodyCloth(cv,sk,C,{off:1,hem:2,crop:true,neck:'tank',group:'top'});
    if(sk.view==='f'){const n=sk.neck;cv.fillIn(p,(x,y)=>y<c[1]-7+Math.abs(x-c[0])*.25&&Math.abs(x-c[0])<d.chestH+3,{alt:0});
      for(let y=c[1]-4;y<w[1]+2;y+=4){cv.ink(p,[[c[0]-3,y],[c[0]+3,y+3]],{alt:1});cv.ink(p,[[c[0]+3,y],[c[0]-3,y+3]],{alt:1});}
      [-8,8].forEach(dx=>cv.ink(p,[[c[0]+dx,c[1]-2],[w[0]+dx*.8,w[1]+2]],{tone:0}));}
    return p;}}});
reg('top_under','arrastao','Blusa arrastão',{sec:c=>'#26252b',draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,{...C,r2:skinOf(C)},{off:1,hem:6,neck:'crew',pat:(x,y)=>((Math.floor((x+y)/3)+Math.floor((x-y+400)/3))%2)});return p;},
  sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,{...C,r2:skinOf(C)},{len:1.97,off:.8,cuff:.6,pat:(x,y)=>((Math.floor((x+y)/3)+Math.floor((x-y+400)/3))%2)})}});
reg('top_under','top-borboleta','Top borboleta',{draw:{body:(cv,sk,C)=>{const d=sk.d,c=sk.chest,n=sk.neck;const p=cv.part_({mat:C.r1,round:3,group:'top',gloss:true});
    if(sk.view==='f'){p.poly([[c[0],c[1]-6],[c[0]-14,c[1]-12],[c[0]-17,c[1]-2],[c[0]-10,c[1]+5],[c[0]-14,c[1]+12],[c[0]-4,c[1]+11],[c[0],c[1]+6],[c[0]+4,c[1]+11],[c[0]+14,c[1]+12],[c[0]+10,c[1]+5],[c[0]+17,c[1]-2],[c[0]+14,c[1]-12]]);}
    else p.rect(c[0]-d.chestH-1,c[1]-2,c[0]+d.chestH+1,c[1]+2);
    p.commit();const st=cv.part_({mat:C.r1,round:1,group:'top'});st.cap([c[0]-6,c[1]-9],[n[0]-3,n[1]-3],1,1).cap([c[0]+6,c[1]-9],[n[0]+3,n[1]-3],1,1);st.commit();
    if(sk.view==='f'){cv.ink(p,[[c[0],c[1]-6],[c[0],c[1]+6]],{tone:0});cv.fillIn(p,(x,y)=>{const dx=Math.abs(x-c[0]);return dx>5&&dx<10&&Math.abs(y-c[1]+3)<3;},{tone:4});}return p;}}});
reg('top_under','tie-dye','Camiseta tie-dye',{sec:c=>'#ffd84a',draw:{body:(cv,sk,C)=>{const c=sk.chest;const pat=(x,y)=>{const a=Math.atan2(y-c[1],x-c[0]),r=Math.hypot(x-c[0],y-c[1]);return Math.floor((a*2+r*.35)/1.2)%2;};
    return bodyCloth(cv,sk,C,{off:3.4,hem:10,flare:2,pat});},sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:.62,off:3,cuff:2.4,pat:(x,y,u)=>Math.floor(u*6+x*.1)%2})}});
reg('top_over','couro-spikes','Jaqueta de couro com spikes',{draw:{body:(cv,sk,C)=>{const p=bodyCloth(cv,sk,C,{off:4,hem:-2,neck:'v',group:'over',bias:0});
    if(sk.view==='f'){const n=sk.neck,c=sk.chest;cv.ink(p,[[n[0]+3,n[1]+3],[c[0]+8,sk.pelvis[1]-4]],{tone:0});cv.ink(p,[[n[0]-6,n[1]+1],[n[0]-12,c[1]-2],[n[0]-4,c[1]+2]],{tone:3});cv.ink(p,[[n[0]+6,n[1]+1],[n[0]+12,c[1]-2],[n[0]+4,c[1]+2]],{tone:3});}
    return p;},sleeve:(cv,sk,n,C)=>{const p=sleeve(cv,sk,n,C,{len:1.96,off:3,cuff:.8,group:'over'});const s=sk['sh'+n];
    for(let k=0;k<3;k++){const sp=cv.part_({mat:SILVER,round:1,gloss:true,line:false});const x=s[0]-6+k*6,y=s[1]-6-(k===1?2:0);sp.poly([[x-2.4,y+3],[x+2.4,y+3],[x,y-4]]);sp.commit();}return p;}},mat:'gloss'});
reg('top_over','casaco-pelucia','Casaco de pelúcia',{draw:{body:(cv,sk,C)=>{const d=sk.d,pe=sk.pelvis;const p=bodyCloth(cv,sk,C,{off:7,hem:34,flare:6,neck:'v',group:'over'});
    cv.fillIn(p,(x,y)=>((Math.floor(x/2)*7+Math.floor(y/2)*5)%6===0),{dt:1});cv.fillIn(p,(x,y)=>((Math.floor(x/2)*3+Math.floor(y/2)*11)%7===0),{dt:-1});
    if(sk.view==='f'){const n=sk.neck;cv.ink(p,[[n[0]-1,n[1]+8],[n[0]-1,pe[1]+34]],{tone:0});}return p;},
  sleeve:(cv,sk,n,C)=>{const p=sleeve(cv,sk,n,C,{len:1.92,off:6,cuff:3,group:'over'});cv.fillIn(p,(x,y)=>((Math.floor(x/2)*7+Math.floor(y/2)*5)%6===0),{dt:1});return p;}}});
reg('top_over','blazer','Blazer oversized',{draw:{body:(cv,sk,C)=>{const pe=sk.pelvis;const p=bodyCloth(cv,sk,C,{off:5.4,hem:16,flare:3,neck:'v',group:'over'});
    if(sk.view==='f'){const n=sk.neck,c=sk.chest;cv.ink(p,[[n[0]-5,n[1]-2],[n[0]-12,c[1]-4],[n[0]-2,c[1]+12]],{tone:0});cv.ink(p,[[n[0]+5,n[1]-2],[n[0]+12,c[1]-4],[n[0]+2,c[1]+12]],{tone:0});
      cv.ink(p,[[n[0],c[1]+12],[n[0],pe[1]+16]],{tone:0});[c[1]+16,c[1]+24].forEach(y=>cv.dot(p.id,Math.round(n[0])+2,Math.round(y),{rgb:GOLD[3]}));cv.ink(p,[[c[0]-14,pe[1]-2],[c[0]-6,pe[1]-2]],{tone:1});}
    return p;},sleeve:(cv,sk,n,C)=>sleeve(cv,sk,n,C,{len:1.9,off:4.2,cuff:1.4,group:'over'})}});
reg('top_over','puffer-metal','Puffer metalizado',{draw:{body:(cv,sk,C)=>{const p=cv.part_?bodyCloth(cv,sk,C,{off:8,hem:2,neck:'crew',group:'over'}):null;const c=sk.chest;
    for(let k=0;k<5;k++){const y=c[1]-12+k*7;cv.ink(p,[[c[0]-30,y],[c[0]+30,y]],{tone:0});cv.ink(p,[[c[0]-30,y+2],[c[0]+30,y+2]],{tone:4});}
    if(sk.view==='f')zipper(cv,p,sk,C);return p;},
  sleeve:(cv,sk,n,C)=>{const p=sleeve(cv,sk,n,C,{len:1.94,off:6.4,cuff:1,group:'over'});const s=sk['sh'+n],w=sk['wr'+n];for(let k=1;k<5;k++){const q=[s[0]+(w[0]-s[0])*k/5,s[1]+(w[1]-s[1])*k/5];cv.ink(p,[[q[0]-9,q[1]],[q[0]+9,q[1]]],{tone:0});cv.ink(p,[[q[0]-9,q[1]+2],[q[0]+9,q[1]+2]],{tone:4});}return p;}}});
reg('bottom','paraquedas','Calça paraquedas',{draw:{
  hip:(cv,sk,C)=>hipPiece(cv,sk,C,{rise:2,off:5,fly:false}),
  leg:(cv,sk,n,C)=>{const p=legPiece(cv,sk,n,C,{top:7,knee:10,bot:8,len:2,bunch:1,hemLift:0});stackFolds(cv,p,sk,n,5,.35);
    const h=sk['hip'+n],k=sk['knee'+n],side=(h[0]<sk.pelvis[0])?-1:1;const st=cv.part_({mat:BLACK,round:1,line:false});const a=lerp(h,k,.5);st.cap([a[0]-8,a[1]],[a[0]+8,a[1]+2],1.1,1.1);st.commit();
    const bk=cv.part_({mat:SILVER,round:1,gloss:true,line:false});bk.rect(a[0]+side*7-1.5,a[1]-1,a[0]+side*7+1.5,a[1]+3);bk.commit();
    const t=cv.part_({mat:BLACK,round:1,line:false});t.cap([a[0]+side*7,a[1]+3],[a[0]+side*9,a[1]+16],1,1);t.commit();return p;}}});
reg('bottom','quadriculado','Calça quadriculada',{sec:c=>'#f2efe9',draw:{
  hip:(cv,sk,C)=>hipPiece(cv,sk,C,{rise:1,off:4,pat:(x,y)=>(Math.floor(x/6)+Math.floor(y/6))%2}),
  leg:(cv,sk,n,C)=>legPiece(cv,sk,n,C,{top:5,knee:6,bot:7,len:2,hemLift:1,pat:(x,y)=>(Math.floor(x/6)+Math.floor(y/6))%2})}});
reg('bottom','couro-flare','Calça de couro flare',{draw:{
  hip:(cv,sk,C)=>{const p=hipPiece(cv,sk,{...C},{rise:-2,off:2,loops:false});return p;},
  leg:(cv,sk,n,C)=>{const p=legPiece(cv,sk,n,C,{top:2,knee:1.5,bot:12,len:2,hemLift:1,light:(I,x,y)=>I+.5*Math.sin(x*.5+y*.08)});
    const h=sk['hip'+n],k=sk['knee'+n];cv.ink(p,[[h[0]-2,h[1]+6],[k[0]-2,k[1]-4]],{tone:4});return p;}}});
reg('bottom','saia-cargo','Mini saia cargo',{draw:{
  hip:(cv,sk,C)=>{const d=sk.d,pe=sk.pelvis,top=pe[1]-2,w=d.hipH+3,bot=pe[1]+22;const p=cv.part_({mat:C.r1,round:4,group:'bottom'});
    p.poly([[pe[0]-w,top],[pe[0]+w,top],[pe[0]+w+5,bot],[pe[0]-w-5,bot]]);p.commit();cv.ink(p,[[pe[0]-w,top+3],[pe[0]+w,top+3]],{dt:-1});
    [-1,1].forEach(sd=>{const x=pe[0]+sd*(w-2);cv.ink(p,[[x-4,pe[1]+6],[x+4,pe[1]+6],[x+4,bot-3],[x-4,bot-3],[x-4,pe[1]+6]],{tone:0});cv.ink(p,[[x-4,pe[1]+9],[x+4,pe[1]+9]],{tone:0});});
    for(let i=0;i<10;i++){const t=i/9,x=pe[0]-w+2*w*t,y=top+6+Math.sin(t*Math.PI)*10;const c=cv.part_({mat:SILVER,round:1,gloss:true,line:false});c.ell(x,y,1.4,1.2);c.commit();}return p;},leg:null}});
reg('bottom','estrelas','Calça estrelada',{sec:c=>'#ffd84a',draw:{
  hip:(cv,sk,C)=>hipPiece(cv,sk,C,{rise:0,off:3,loops:true}),
  leg:(cv,sk,n,C)=>{const p=legPiece(cv,sk,n,C,{top:4,knee:5,bot:9,len:2,hemLift:1});const r=AV._rng?AV._rng(n==='L'?3:7):null;
    const h=sk['hip'+n],a=sk['ank'+n];for(let k=0;k<5;k++){const t=.12+k*.19,c=lerp(h,a,t),x=c[0]+((k*7)%3-1)*5,y=c[1];[[0,-2],[-2,0],[0,0],[2,0],[0,2],[-1,1],[1,1]].forEach(([dx,dy])=>cv.dot(p.id,Math.round(x+dx),Math.round(y+dy),{alt:1}));}return p;}}});
reg('shoes','buffalo','Buffalo plataforma',{draw:{leg:(cv,sk,n,C)=>{const{p,s,x,y}=shoeBase(cv,sk,n,C,{h:6.5,w:10,sole:14});
  for(let k=0;k<5;k++)cv.ink(s,[[x-10,y+k*3-1],[x+10,y+k*3-1]],{dt:k%2?-1:0});cv.ink(p,[[x-5,y+1],[x+5,y+1]],{tone:0});return p;}}});
reg('shoes','cowboy','Bota cowboy',{draw:{leg:(cv,sk,n,C)=>{const k=sk['knee'+n],a=sk['ank'+n],side=(sk['hip'+n][0]<sk.pelvis[0])?-1:1;
  const b=cv.part_({mat:C.r1,round:3,group:'shoe'});b.cap(lerp(k,a,.35),xy(a),sk.d.sh[0]+2,sk.d.sh[1]+3);b.poly([[a[0]-8,a[1]-12],[a[0]+8,a[1]-12],[a[0]+6,a[1]-20],[a[0]-6,a[1]-20]]);b.commit();
  cv.ink(b,[[a[0]-4,a[1]-16],[a[0],a[1]-10],[a[0]+4,a[1]-16]],{tone:3});cv.ink(b,[[a[0]-3,a[1]-6],[a[0],a[1]-2],[a[0]+3,a[1]-6]],{tone:1});
  const{p,s,x,y}=shoeBase(cv,sk,n,C,{h:6,w:8.5,sole:3,soleR:AV.ramp('#5a3a24')});const t=cv.part_({mat:C.r1,round:2,group:'shoe'});t.poly([[x+side*4,y+4],[x+side*13,y+8],[x+side*4,y+9]]);t.commit();return p;}}});
reg('shoes','moon-boot','Bota peluda',{draw:{leg:(cv,sk,n,C)=>{const k=sk['knee'+n],a=sk['ank'+n];const b=cv.part_({mat:C.r1,round:4,group:'shoe'});
  b.cap(lerp(k,a,.3),xy(a),sk.d.sh[0]+6,sk.d.sh[1]+8);b.commit();cv.fillIn(b,(x,y)=>((Math.floor(x/2)*7+Math.floor(y/2)*5)%5===0),{dt:1});cv.fillIn(b,(x,y)=>((Math.floor(x/2)*3+Math.floor(y/2)*7)%6===0),{dt:-1});
  const{p}=shoeBase(cv,sk,n,C,{h:7,w:11,sole:4});return p;}}});
reg('headwear','bucket','Bucket hat',{draw:{head:(cv,sk,C)=>{const d=sk.d,h=sk.head;const p=cv.part_({mat:C.r1,round:3});p.ell(h[0],h[1]-7,d.hrx+1,d.hry*.7);p.rect(0,h[1]-6,W,H,true);
  p.poly([[h[0]-d.hrx-7,h[1]-2],[h[0]+d.hrx+7,h[1]-2],[h[0]+d.hrx+2,h[1]-9],[h[0]-d.hrx-2,h[1]-9]]);p.commit();cv.ink(p,[[h[0]-d.hrx-1,h[1]-9],[h[0]+d.hrx+1,h[1]-9]],{tone:0});}},mask:true});
reg('headwear','chapeu-cowboy','Chapéu cowboy',{draw:{head:(cv,sk,C)=>{const d=sk.d,h=sk.head;const p=cv.part_({mat:C.r1,round:3});
  p.poly([[h[0]-d.hrx-12,h[1]-8],[h[0]-d.hrx-4,h[1]-12],[h[0]+d.hrx+4,h[1]-12],[h[0]+d.hrx+12,h[1]-8],[h[0]+d.hrx+6,h[1]-5],[h[0]-d.hrx-6,h[1]-5]]);
  p.poly([[h[0]-d.hrx+1,h[1]-11],[h[0]-d.hrx+3,h[1]-28],[h[0]-2,h[1]-24],[h[0]+2,h[1]-24],[h[0]+d.hrx-3,h[1]-28],[h[0]+d.hrx-1,h[1]-11]]);p.commit();
  cv.ink(p,[[h[0]-d.hrx+1,h[1]-14],[h[0]+d.hrx-1,h[1]-14]],{alt:0,tone:0});}},mask:true});
reg('headwear','chifrinho','Tiara de chifrinho',{draw:{head:(cv,sk,C)=>{if(sk.view==='b')return;const d=sk.d,h=sk.head;const b=cv.part_({mat:BLACK,round:1});b.cap([h[0]-d.hrx-1,h[1]-6],[h[0],h[1]-d.hry-4],1.4,1.4).cap([h[0],h[1]-d.hry-4],[h[0]+d.hrx+1,h[1]-6],1.4,1.4);b.commit();
  [-1,1].forEach(sd=>{const x=h[0]+sd*8,y=h[1]-d.hry-2;const p=cv.part_({mat:C.r1,round:2,gloss:true});p.poly([[x-3.5,y+2],[x+3.5,y+2],[x+sd*3,y-10]]);p.commit();});}}});
reg('headwear','orelha-gato','Tiara orelha de gato',{draw:{head:(cv,sk,C)=>{const d=sk.d,h=sk.head;[-1,1].forEach(sd=>{const x=h[0]+sd*9,y=h[1]-d.hry-1;const p=cv.part_({mat:C.r1,round:2});p.poly([[x-6,y+3],[x+6,y+3],[x+sd*2,y-11]]);p.commit();
  if(sk.view==='f'){const q=cv.part_({mat:AV.ramp('#f5a8c0'),round:1,line:false});q.poly([[x-2.5,y+2],[x+2.5,y+2],[x+sd*1.5,y-6]]);q.commit();}});}}});
reg('headwear','viseira','Viseira',{draw:{head:(cv,sk,C)=>{const d=sk.d,h=sk.head;const p=cv.part_({mat:C.r1,round:2});p.rect(h[0]-d.hrx-1,h[1]-11,h[0]+d.hrx+1,h[1]-7);if(sk.view==='f'){p.ell(h[0]+2,h[1]-6,d.hrx+3,3.2);p.rect(0,0,W,h[1]-7.5,true);}p.commit();}}});
reg('neck','cadeado','Corrente de cadeado',{draw:{neck:(cv,sk,C)=>{if(sk.view==='b')return;const n=sk.neck;for(let i=0;i<9;i++){const t=i/8,x=n[0]-7+14*t,y=n[1]-1+Math.sin(t*Math.PI)*7;const c=cv.part_({mat:SILVER,round:1,gloss:true,line:false});c.ell(x,y,1.7,1.4);c.commit();}
  const l=cv.part_({mat:GOLD,round:2,gloss:true});l.rect(n[0]-3,n[1]+7,n[0]+3,n[1]+13);l.commit();const a=cv.part_({mat:GOLD,round:1,line:false});a.ell(n[0],n[1]+7,2.4,2.6);a.ell(n[0],n[1]+7,1.1,1.4,true);a.commit();}}});
reg('neck','lenco','Lenço de seda',{sec:c=>'#ffd84a',draw:{neck:(cv,sk,C)=>{const n=sk.neck;const p=cv.part_({mat:C.r1,mat2:C.r2,round:2,pat:(x,y)=>(Math.floor(x/3)+Math.floor(y/3))%2});
  p.cap([n[0]-7,n[1]+1],[n[0]+7,n[1]+1],3,3);if(sk.view==='f')p.poly([[n[0]+1,n[1]+3],[n[0]+7,n[1]+4],[n[0]+9,n[1]+16],[n[0]+4,n[1]+12]]);p.commit();}}});
reg('glasses','coracao','Óculos de coração',{draw:{face:(cv,sk,C)=>{if(sk.view==='b')return;const h=sk.head,cx=h[0]+1,y=h[1]+1;
  [cx-7,cx+7].forEach(ex=>{const p=cv.part_({mat:C.r1,round:1.5,gloss:true});p.poly([[ex,y+5],[ex-6,y-1],[ex-5,y-4],[ex-2,y-4],[ex,y-2],[ex+2,y-4],[ex+5,y-4],[ex+6,y-1]]);p.commit();});
  const b=cv.part_({mat:C.r1,round:1,line:false});b.rect(cx-2,y-2,cx+2,y-1);b.commit();}}});
reg('glasses','estrela','Óculos de estrela',{draw:{face:(cv,sk,C)=>{if(sk.view==='b')return;const h=sk.head,cx=h[0]+1,y=h[1]+1;
  [cx-7,cx+7].forEach(ex=>{const pts=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?2.6:6;pts.push([ex+Math.cos(a)*r,y+Math.sin(a)*r]);}const p=cv.part_({mat:C.r1,round:1.5,gloss:true});p.poly(pts);p.commit();});}}});
reg('bag','asas','Asas de anjo',{behind:true,draw:{bag:(cv,sk,C)=>{const c=sk.chest;[-1,1].forEach(sd=>{const p=cv.part_({mat:C.r1,round:4});const x=c[0]+sd*8,y=c[1]-6;
  p.poly([[x,y],[x+sd*22,y-22],[x+sd*36,y-26],[x+sd*40,y-14],[x+sd*34,y-2],[x+sd*38,y+6],[x+sd*28,y+14],[x+sd*30,y+22],[x+sd*16,y+20],[x+sd*6,y+10]]);p.commit();
  for(let k=0;k<4;k++){cv.ink(p,[[x+sd*(10+k*6),y-4+k*3],[x+sd*(24+k*4),y+6+k*4]],{tone:1});}});}}});
reg('bag','mochila-urso','Mochila de ursinho',{behind:false,draw:{bag:(cv,sk,C)=>{const c=sk.chest,back=sk.view==='b';
  if(!back){const st=cv.part_({mat:C.r1,round:1});st.cap([sk.shL[0]+3,sk.shL[1]-2],[sk.shL[0]+4,c[1]+10],1.4,1.4).cap([sk.shR[0]-3,sk.shR[1]-2],[sk.shR[0]-4,c[1]+10],1.4,1.4);st.commit();return;}
  const p=cv.part_({mat:C.r1,round:5});p.ell(c[0],c[1]+6,13,14);p.ell(c[0]-10,c[1]-7,4.5,4.5);p.ell(c[0]+10,c[1]-7,4.5,4.5);p.commit();
  const m=cv.part_({mat:AV.ramp('#f2e2c8'),round:2});m.ell(c[0],c[1]+10,5.5,4.5);m.commit();cv.dot(m.id,Math.round(c[0]),Math.round(c[1]+8),{rgb:[30,24,28]});
  [[-5,2],[5,2]].forEach(([dx,dy])=>cv.dot(p.id,Math.round(c[0]+dx),Math.round(c[1]+dy),{rgb:[30,24,28]}));}}});
})(AV);
