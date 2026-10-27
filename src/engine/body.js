/* ===== esqueleto, corpo base, rosto e montagem ===== */
(function(AV){
const{W,H,PX,PY,ramp,hx,mixc,clamp}=AV;
const rad=d=>d*Math.PI/180;

/* ---------- medidas ---------- */
function dims(g,b,alt){const k=[.86,1,1.22][b],F=g===1;
  const up=-6*alt-(F?3:0)+7;
  return{g,b,alt,F,k,
    sole:PY,ankle:PY-12,knee:PY-56-3*alt,hip:PY-100-6*alt,pelvis:PY-111+up,waist:PY-127+up,chest:PY-145+up,shoulder:PY-160+up,neck:PY-167+up,chin:PY-170+up,headC:PY-189+up,skull:PY-207+up,
    shW:(F?15:17)*(.92+.08*k),hipW:(F?9.6:8.6)*(.9+.1*k),waistH:(F?11.2:14)*k,hipH:(F?16.5:15.5)*k,chestH:(F?14.5:17)*k,neckR:(F?3.9:4.7)*(.9+.1*k),
    uA:[(F?4.8:6)*k,(F?4:5)*k],fA:[(F?4:4.9)*k,(F?3.1:3.7)*k],th:[(F?9.6:9)*k,(F?6:6.4)*k],sh:[(F?5.8:6.3)*k,(F?3.8:4.3)*k],
    hrx:F?14.8:15.4,hry:F?16:16.6,belly:b===2?(F?3:5):0,
    uLen:33,fLen:28,hLen:13};}
AV.dims=dims;

/* ---------- poses ---------- */
const Z={dx:0,dy:0,lean:0,tilt:0,aL:{abd:6,flex:0,elb:6},aR:{abd:6,flex:0,elb:6},lL:{abd:2,flex:0,knee:0},lR:{abd:2,flex:0,knee:0},sit:0};
function P(o){return JSON.parse(JSON.stringify(Object.assign({},Z,o)));}
const POSES={
  idle:[P({dx:1,tilt:1,aL:{abd:7,flex:2,elb:10},aR:{abd:9,flex:-2,elb:16},lL:{abd:1,flex:0,knee:0},lR:{abd:6,flex:6,knee:12}})],
  bob:[P({dx:1,dy:1,tilt:1,aL:{abd:7,flex:2,elb:12},aR:{abd:9,flex:-2,elb:18},lL:{abd:1,flex:0,knee:0},lR:{abd:6,flex:6,knee:12}})],
  walk:[0,1,2,3].map(f=>{const s=[1,0,-1,0][f],up=[0,1,0,1][f];
    return P({dy:up?-1:0,aL:{abd:7,flex:-16*s,elb:10+6*Math.max(0,-s)},aR:{abd:7,flex:16*s,elb:10+6*Math.max(0,s)},
      lL:{abd:2,flex:24*s,knee:s>0?30:s<0?8:14},lR:{abd:2,flex:-24*s,knee:s<0?30:s>0?8:14}});}),
  sit1:[P({sit:1,aL:{abd:8,flex:30,elb:40},aR:{abd:8,flex:30,elb:40},lL:{abd:6,flex:88,knee:88},lR:{abd:6,flex:88,knee:88}})],
  sit2:[P({sit:2,aL:{abd:14,flex:28,elb:30},aR:{abd:14,flex:28,elb:30},lL:{abd:34,flex:78,knee:140},lR:{abd:34,flex:78,knee:140}})],
  wave:[0,1].map(f=>P({aR:{abd:150+(f?14:-6),flex:0,elb:f?36:20},tilt:f?2:0})),
  dance:[0,1,2,3].map(f=>{const s=[1,0,-1,0][f];return P({dx:2*s,dy:f%2?2:0,tilt:3*s,aL:{abd:f===0?150:40,flex:10,elb:f===0?20:90},aR:{abd:f===2?150:40,flex:10,elb:f===2?20:90},
    lL:{abd:4+4*Math.max(0,-s),flex:f%2?10:0,knee:f%2?18:4},lR:{abd:4+4*Math.max(0,s),flex:f%2?10:0,knee:f%2?18:4}});})
};
AV.POSES=POSES;

/* ---------- esqueleto (3D simples -> tela) ---------- */
function dirL(side,abd,flex){const a=rad(abd),f=rad(flex);return[side*Math.sin(a)*Math.cos(f),Math.cos(a)*Math.cos(f),Math.sin(f)];}
const add=(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
function skeleton(d,pose,view){const p=pose,j={};
  const pel=[PX+p.dx,d.pelvis+p.dy,0];
  j.pelvis=pel;j.hipL=[pel[0]-d.hipW,d.hip+p.dy,0];j.hipR=[pel[0]+d.hipW,d.hip+p.dy,0];
  const thL=d.knee-d.hip,shL=d.ankle-d.knee;
  for(const[s,n,lg]of[[-1,'L',p.lL],[1,'R',p.lR]]){const h=j['hip'+n],t=dirL(s,lg.abd,lg.flex),k=add(h,t,thL),sd=dirL(s,lg.abd*.4,lg.flex-lg.knee),a=add(k,sd,shL);
    j['knee'+n]=k;j['ank'+n]=a;}
  const sx=p.lean||0;
  j.waist=[pel[0]+sx*.3,d.waist+p.dy,0];j.chest=[pel[0]+sx*.6,d.chest+p.dy,0];
  j.shL=[pel[0]-d.shW+sx,d.shoulder+p.dy,0];j.shR=[pel[0]+d.shW+sx,d.shoulder+p.dy,0];
  j.neck=[pel[0]+sx,d.neck+p.dy,0];j.head=[pel[0]+sx+p.tilt*.6,d.headC+p.dy,0];
  for(const[s,n,am]of[[-1,'L',p.aL],[1,'R',p.aR]]){const sh=j['sh'+n],u=dirL(s,am.abd,am.flex),e=add(sh,u,d.uLen);
    const f=dirL(s,am.abd+(am.abd>90?am.elb*.6:-am.elb*.25),am.flex+am.elb*(am.abd>90?.3:1)),w=add(e,f,d.fLen),ht=add(w,f,d.hLen);
    j['el'+n]=e;j['wr'+n]=w;j['ha'+n]=ht;j['fd'+n]=f;}
  // projeção: câmera levemente de cima
  const pr={},flip=view==='b';
  for(const k in j){const v=j[k];if(k.startsWith('fd')){pr[k]=v;continue;}let x=v[0],z=v[2];if(flip){x=2*PX-x;z=-z;}pr[k]=[x,v[1]+.42*z,z];}
  if(flip){for(const a of['hip','knee','ank','sh','el','wr','ha']){const L=pr[a+'L'];pr[a+'L']=pr[a+'R'];pr[a+'R']=L;}const L=pr.fdL;pr.fdL=[-pr.fdR[0],pr.fdR[1],-pr.fdR[2]];pr.fdR=[-L[0],L[1],-L[2]];}
  // assentar: pé no chão / bunda no chão
  let shift=0;
  if(p.sit===1)shift=PY-Math.max(pr.ankL[1],pr.ankR[1])-12;
  else if(p.sit===2)shift=(PY-20)-(pr.pelvis[1]+10);
  else shift=PY-Math.max(pr.ankL[1],pr.ankR[1])-12;
  for(const k in pr){if(k.startsWith('fd'))continue;pr[k]=[pr[k][0],pr[k][1]+shift,pr[k][2]];}
  pr.view=view;pr.d=d;pr.pose=p;pr.flip=flip;return pr;}
AV.skeleton=skeleton;

/* ---------- partes do corpo ---------- */
const xy=v=>[v[0],v[1]];
function torsoPoly(sk,d,o=0,yTop=null,yBot=null){const n=sk.neck,sL=sk.shL,sR=sk.shR,w=sk.waist,pe=sk.pelvis,F=d.F,dy=pe[1]-d.pelvis-0;
  const ch=d.chestH+o,wa=d.waistH+o+(d.belly?d.belly*.6:0),hp=d.hipH+o,cx=n[0];
  const cY=sk.chest[1],wY=w[1],hY=pe[1]+4;
  const pts=[[cx-d.neckR-1-o*.5,n[1]-1-o],[sL[0]-1,sL[1]-3-o],[sL[0]-4-o,sL[1]+1],[cx-ch,cY-2],[cx-wa,wY],[cx-hp,hY],[cx-hp+1,hY+7],[cx,hY+11],[cx+hp-1,hY+7],[cx+hp,hY],[cx+wa,wY],[cx+ch,cY-2],[sR[0]+4+o,sR[1]+1],[sR[0]+1,sR[1]-3-o],[cx+d.neckR+1+o*.5,n[1]-1-o]];
  return pts;}
AV.torsoPoly=torsoPoly;

function drawBody(cv,sk,f,R,order){const d=sk.d;
  const skin=R.skin;
  const ops={};
  ops.torso=()=>{const p=cv.part_({mat:skin,round:7,group:'skin'});p.poly(torsoPoly(sk,d));
    if(d.F&&sk.view==='f'){const c=sk.chest;p.ell(c[0]-6.5,c[1]+1,6.2,5.4);p.ell(c[0]+6.5,c[1]+1,6.2,5.4);}
    if(d.belly){p.ell(sk.waist[0],sk.waist[1]+4,d.waistH+d.belly*.6,10);}
    p.cap(xy(sk.neck),[sk.neck[0],sk.neck[1]-10],d.neckR,d.neckR);p.commit();
    if(sk.view==='f'){// clavículas, linha do peito/umbigo
      const n=sk.neck;cv.ink(p,[[n[0]-3,n[1]+3],[n[0]-8,n[1]+4]],{dt:-1});cv.ink(p,[[n[0]+3,n[1]+3],[n[0]+8,n[1]+4]],{dt:-1});cv.ink(p,[[n[0]-3,n[1]-6],[n[0]+3,n[1]-6]],{dt:-1});
      cv.dot(p.id,Math.round(sk.waist[0]),Math.round(sk.waist[1]+3),{tone:0});
}
    return p;};
  ops.leg=(n)=>{const h=sk['hip'+n],k=sk['knee'+n],a=sk['ank'+n];const p=cv.part_({mat:skin,group:'skin'});p.cap(xy(h),xy(k),d.th[0],d.th[1]).cap(xy(k),xy(a),d.sh[0],d.sh[1]);
    p.ell(a[0],a[1]+6,d.sh[1]+1.5,6);p.commit();return p;};
  ops.arm=(n)=>{const s=sk['sh'+n],e=sk['el'+n],w=sk['wr'+n];const p=cv.part_({mat:skin,group:'skin'});p.cap(xy(s),xy(e),d.uA[0],d.uA[1]).cap(xy(e),xy(w),d.fA[0],d.fA[1]);p.commit();return p;};
  ops.hand=(n)=>drawHand(cv,sk,n,skin);
  ops.head=()=>drawHead(cv,sk,R);
  return ops;}

function drawHand(cv,sk,n,mat,glove){const d=sk.d,w=sk['wr'+n],t=sk['ha'+n],fd=sk['fd'+n];const p=cv.part_({mat,group:glove?'glove':'skin'});
  const s=d.F?.85:1;p.cap(xy(w),[w[0]+(t[0]-w[0])*.55,w[1]+(t[1]-w[1])*.55],3.6*s*d.k**.3,4.2*s*d.k**.3).cap([w[0]+(t[0]-w[0])*.4,w[1]+(t[1]-w[1])*.4],xy(t),3.8*s,2.6*s);
  const side=(sk.flip?-1:1)*(n==='L'?-1:1);// polegar pra frente
  p.cap([w[0]-side*1.5,w[1]+2],[w[0]-side*3.8,w[1]+7],1.7,1.4);p.commit();
  if(fd&&Math.abs(fd[1])>.5){const yy=Math.round(w[1]+(t[1]-w[1])*.72);cv.ink(p,[[Math.round(t[0])-2,yy],[Math.round(t[0])+2,yy]],{dt:-1});}
  return p;}
AV.drawHand=drawHand;

/* ---------- cabeça e rosto ---------- */
function headShape(sk,d,o=0){const h=sk.head,cx=h[0],cy=h[1],j=d.hry/14.2,q=d.hrx/13.4;return{cx,cy,rx:d.hrx+o,ry:d.hry+o,
  jaw:[[cx-d.hrx-o+.5,cy-1],[cx-d.hrx-o+1.5,cy+7*j],[cx-6.5*q,cy+13.5*j+o*.5],[cx-1.5*q,cy+16*j+o],[cx+3*q,cy+16*j+o],[cx+8.5*q,cy+12.5*j],[cx+d.hrx+o-.5,cy+6*j],[cx+d.hrx+o,cy-1]]};}
AV.headShape=headShape;
function drawHead(cv,sk,R){const d=sk.d,hs=headShape(sk,d),skin=R.skin;
  const p=cv.part_({mat:skin,round:7,group:'skin',auto:true});
  p.ell(hs.cx,hs.cy-2,hs.rx,hs.ry).poly(hs.jaw);
  if(sk.view==='f'){p.ell(hs.cx-hs.rx+.5,hs.cy+2,2.6,4.2);}
  else{p.ell(hs.cx-hs.rx+.5,hs.cy+2,2.6,4.2);p.ell(hs.cx+hs.rx-.5,hs.cy+2,2.6,4.2);}
  p.commit();
  if(sk.view==='f'){// sombra da orelha e do queixo
    cv.ink(p,[[hs.cx-hs.rx,hs.cy+1],[hs.cx-hs.rx,hs.cy+4]],{dt:-1});}
  return p;}

const FACES={
  neutro:{eye:'normal',mouth:'reta',brow:0},
  'na-boa':{eye:'normal',mouth:'sorriso',brow:0},
  serio:{eye:'normal',mouth:'reta',brow:2},
  sonolento:{eye:'sono',mouth:'reta',brow:0},
  piscando:{eye:'pisca',mouth:'sorriso',brow:0},
  rindo:{eye:'feliz',mouth:'aberta',brow:-1},
  delineado:{eye:'delineado',mouth:'reta',brow:1}
};
AV.FACES=FACES;
/* olhos em baixa resolução (3 px). K=traço, W=branco, P=pupila, S=olheira */
const EYES={
  normal:{r:['KKK','WPP'],l:['KKK','PPW']},
  sono:{r:['...','KKK','WPP','SS.'],l:['...','KKK','PPW','.SS']},
  delineado:{r:['KKKK','WPPK'],l:['KKKK','KPPW']},
  pisca:{r:['...','KKK'],l:['...','KKK']},
  feliz:{r:['.K.','K.K'],l:['.K.','K.K']}
};
function drawFace(cv,sk,R,faceId,headPart){if(sk.view!=='f')return;const K=AV.K,LW=AV.LW,LH=AV.LH,h=sk.head;
  const cx=Math.round(h[0]*K),cy=Math.round(h[1]*K);const F=FACES[faceId]||FACES.neutro;
  const sr=R.skin,KC=[20,15,22],white=[244,242,236],PUP=R.iris[0],put=(x,y,c)=>{if(x<0||y<0||x>=LW||y>=LH)return;const i=y*LW+x;if(cv.part[i]!==headPart.id)return;cv.fix[i]=(c[0]<<16)|(c[1]<<8)|c[2];};
  const eye=(ex,ey,t)=>t.forEach((row,r)=>[...row].forEach((ch,c)=>{const col=ch==='K'?KC:ch==='W'?white:ch==='P'?(c===1||row.indexOf('P')===c?PUP:[12,9,14]):ch==='S'?sr[1]:null;if(col)put(ex+c,ey+r,col);}));
  const ey=cy,rk=F.eye==='pisca'?'pisca':F.eye,lk=F.eye==='pisca'?'normal':F.eye,E=EYES;
  const lt=E[lk]||E.normal,rt=E[rk]||E.normal;
  eye(cx-6-(lt.l[0].length-3),ey,lt.l);eye(cx+2,ey,rt.r);
  // sobrancelhas
  const bc=R.brow,by=ey-(F.eye==='sono'?1:2),bs=F.brow||0;
  for(let i=0;i<3;i++){put(cx-6+i,by+(bs>0&&i===2?1:bs<0&&i===1?-1:0),bc);put(cx+2+i,by+(bs>0&&i===0?1:bs<0&&i===1?-1:0),bc);}
  // nariz e boca
  put(cx,cy+3,sr[1]);put(cx,cy+4,sr[0]);
  const lip=mixc(sr[0],[150,40,50],.45),my=cy+6;
  if(F.mouth==='reta'){put(cx-1,my,lip);put(cx,my,lip);}
  else if(F.mouth==='sorriso'){put(cx-2,my-1,lip);put(cx-1,my,lip);put(cx,my,lip);put(cx+1,my-1,lip);}
  else if(F.mouth==='aberta'){put(cx-2,my-1,lip);put(cx+1,my-1,lip);put(cx-1,my,KC);put(cx,my,KC);put(cx-1,my+1,[170,60,70]);put(cx,my+1,[170,60,70]);}
  if(F.mouth==='aberta'||F.eye==='feliz'){const bl=mixc(sr[2],[230,110,110],.4);put(cx-5,cy+2,bl);put(cx+3,cy+2,bl);}
}
AV.drawFace=drawFace;
AV._dims=dims;AV.drawBody=drawBody;
})(AV);
