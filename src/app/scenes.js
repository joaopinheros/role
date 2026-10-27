/* ================= mundo: motor de cenários ================= */
const GW=12,GH=12,TW=32,TH=16,ox=520,oy=372,WW=1040,WHt=860;
const S=(fx,fy)=>[ox+(fx-fy)*TW,oy+(fx+fy)*TH];
const up=(p,h)=>[p[0],p[1]-h];
const key=(x,y)=>x+','+y;
const WB=WW*WS,HB=WHt*WS;const wb=document.createElement('canvas');wb.width=WB;wb.height=HB;const wctx=wb.getContext('2d');
const mk=document.createElement('canvas');mk.width=WB;mk.height=HB;const mkc=mk.getContext('2d');
let ctx=wctx,now=0,beatPulse=0;
function poly(pts,fill,stroke,lw){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=lw||1;ctx.strokeStyle=stroke;ctx.stroke();}}
function box(fx,fy,w,d,h,z,top,lf,rt){const A=S(fx,fy),B_=S(fx+w,fy),C_=S(fx+w,fy+d),D=S(fx,fy+d),t=z+h;
  poly([up(D,z),up(C_,z),up(C_,t),up(D,t)],lf);poly([up(C_,z),up(B_,z),up(B_,t),up(C_,t)],rt);poly([up(A,t),up(B_,t),up(C_,t),up(D,t)],top);}
const bx=(fx,fy,w,d,h,z,c)=>box(fx,fy,w,d,h,z,lt(c),mul(c,.82),mul(c,.68));
const circ=(x,y,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
const ell=(x,y,rx,ry,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fill();};
const onA=(fx,fn)=>{const o=S(fx,0);ctx.save();ctx.transform(1,.5,0,1,o[0],o[1]);fn();ctx.restore();};
const onB=(fy,fn)=>{const o=S(0,fy);ctx.save();ctx.transform(1,-.5,0,1,o[0],o[1]);fn();ctx.restore();};
const onFaceY=(fx,fy,fn)=>{const o=S(fx,fy);ctx.save();ctx.transform(1,.5,0,1,o[0],o[1]);fn();ctx.restore();};
const R=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)};
const FACES={x:{back:false,mirror:false},y:{back:false,mirror:true},nx:{back:true,mirror:true},ny:{back:true,mirror:false}};

let B=null,SCN=null;
function addF(gx,gy,draw,opt={}){B.furn.push({gx,gy,depth:gx+gy+(opt.dz||0),draw,furn:true});if(opt.block!==false)B.blocked.add(key(gx,gy));}
const seatAt=(gx,gy,face,kind=1)=>B.seats.set(key(gx,gy),{...FACES[face],kind});
const glowG=(fx,fy,r,col,a,flick)=>B.glowsG.push({fx,fy,r,col,a,flick});
const glowA=(fx,fy,h,r,col,a,flick)=>B.glowsA.push({fx,fy,h,r,col,a,flick});
const night=()=>B?B.night:SCN.night;

/* ---------- chão ---------- */
const FLOOR={
  grass:(gx,gy,r)=>{tile(gx,gy,['#4f9a4e','#549f52','#4a934a'][r()*3|0]);specks(gx,gy,r,18,['#3f853f','#69b062']);},
  concrete:(gx,gy,r)=>{tile(gx,gy,(gx+gy)%2?'#bdb9b1':'#b5b1a9','#a29e96');if(r()<.2){const[x,y]=S(gx+.3+r()*.4,gy+.3+r()*.4);R(x|0,y|0,6,1,'#9a968e');}},
  stone:(gx,gy,r)=>{tile(gx,gy,(gx+gy)%2?'#aeaba5':'#a4a19b','#8c8984');},
  wood:(gx,gy,r)=>planks(gx,gy,'#b5804f','#8e5c35','#c99260'),
  deck:(gx,gy,r)=>planks(gx,gy,'#cf9a63','#a2703f','#ddb07a'),
  carpet:(gx,gy,r)=>{tile(gx,gy,B.cfg.carpet||'#c7b4d8');specks(gx,gy,r,10,[mul(B.cfg.carpet||'#c7b4d8',.92),lt(B.cfg.carpet||'#c7b4d8')]);},
  tiles:(gx,gy,r)=>{const n=2,s=1/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const fx=gx+i*s,fy=gy+j*s;poly([S(fx,fy),S(fx+s,fy),S(fx+s,fy+s),S(fx,fy+s)],(i+j)%2?'#e9dcc2':'#c96f4d','rgba(90,60,40,.35)');}},
  club:(gx,gy,r)=>{tile(gx,gy,(gx+gy)%2?'#2a2631':'#25222c','#34303d');},
  dirt:(gx,gy,r)=>{tile(gx,gy,['#b48c5c','#ad8656'][r()*2|0]);specks(gx,gy,r,10,['#987448','#c9a675']);}
};
function tile(gx,gy,c,line){poly([S(gx,gy),S(gx+1,gy),S(gx+1,gy+1),S(gx,gy+1)],c,line||null);}
function specks(gx,gy,r,n,cols){for(let k=0;k<n;k++){const[x,y]=S(gx+.08+r()*.84,gy+.08+r()*.84);R(x|0,y|0,r()<.5?1:2,r()<.5?2:1,cols[r()*cols.length|0]);}}
function planks(gx,gy,base,seam,hi){tile(gx,gy,base);ctx.lineWidth=1;
  for(let k=1;k<3;k++){const a=S(gx,gy+k/3),b=S(gx+1,gy+k/3);ctx.strokeStyle=seam;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
  const o=((gx*7+gy*3)%3)/3;for(let k=0;k<3;k++){const fx=gx+((o+k*.37)%1),p1=S(fx,gy+k/3),p2=S(fx,gy+(k+1)/3);ctx.strokeStyle=seam;ctx.beginPath();ctx.moveTo(...p1);ctx.lineTo(...p2);ctx.stroke();}
  const a=S(gx,gy+.02),b=S(gx+1,gy+.02);ctx.strokeStyle=hi;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}

/* ---------- penhasco / fundação ---------- */
function cliff(outdoor,kind){
  const r=rng(7),D=64,cols=kind==='building'?['#4a4e5c','#3a3e4a','#5a5e6c']:kind==='sand'?['#c9a86a','#a8884e','#dcc08a']:kind==='rock'?['#3a3230','#2a2422','#4a4240']:outdoor?['#7a5236','#5e3d27','#946446']:['#8d867d','#6f6961','#a39b91'];
  const face=(P,Q,base,dark,light)=>{
    const n=Math.ceil(Math.hypot(Q[0]-P[0],Q[1]-P[1])/8),L=(t,dy)=>[P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t+dy];
    const bottom=[];for(let i=n;i>=0;i--)bottom.push(L(i/n,D+(r()*16|0)));
    poly([P,Q,...bottom],base);
    [[16,dark,3],[30,light,2],[44,dark,4]].forEach(([dy,col,th])=>{ctx.strokeStyle=col;ctx.lineWidth=th;ctx.beginPath();for(let i=0;i<=n;i++){const[x,y]=L(i/n,dy+Math.sin(i*1.7+dy)*2);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();});
    for(let i=0;i<n*5;i++){const[x,y]=L(r(),6+r()*(D-12));R(x|0,y|0,2,2,r()<.5?dark:light);}
    if(kind==='building'){for(let i=0;i<n*2;i++){const[x,y]=L((i+.5)/(n*2),18);R(Math.round(x)-3,Math.round(y),6,9,r()<.5?'#ffd890':'#2a2e3a');const[x2,y2]=L((i+.5)/(n*2),40);R(Math.round(x2)-3,Math.round(y2),6,9,r()<.5?'#ffd890':'#2a2e3a');}}
    else if(outdoor&&!kind){poly([P,Q,[Q[0],Q[1]+5],[P[0],P[1]+5]],'#4a8f48');for(let i=0;i<=n*2;i++){const[x,y]=L(i/(n*2),4);R(x|0,y|0,3,2+(r()*7|0),r()<.5?'#4a8f48':'#3c7a3b');}}
    else poly([P,Q,[Q[0],Q[1]+6],[P[0],P[1]+6]],'#b9b2a6');
  };
  face(S(-.3,GH),S(GW,GH),cols[0],cols[1],cols[2]);face(S(GW,GH),S(GW,-.3),mul(cols[0],.82),mul(cols[1],.82),mul(cols[2],.82));
}

/* ---------- paredes ---------- */
function win(x,y,w,h,mode){R(x-2,y-2,w+4,h+4,'#3a3330');
  if(mode==='day'){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#d6efff');g.addColorStop(1,'#9ccdf0');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);R(x+3,y+3,3,h-8,'rgba(255,255,255,.55)');}
  else if(mode==='lit'){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#ffe08a');g.addColorStop(1,'#f0a23a');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);}
  else{R(x,y,w,h,'#1b2442');[[.3,.3],[.7,.2],[.5,.7]].forEach(([a,b])=>R(x+a*w|0,y+b*h|0,1,1,'#e8e4d8'));}
  R(x+w/2-1,y,2,h,'#3a3330');R(x,y+Math.round(h*.45),w,2,'#3a3330');R(x-3,y+h+2,w+6,3,'#6a5e54');}
function roomWalls(c,H,decoA,decoB){
  const cb=mul(c,.86),cap='#4a423a';
  box(-.25,-.25,GW+.25,.25,H,0,cap,c,cb);box(-.25,0,.25,GH,H,0,cap,cb,cb);
  onA(0,()=>{R(0,-10,GW*32,10,mul(c,.62));decoA&&decoA();});
  onB(GH,()=>{R(0,-10,GH*32,10,mul(cb,.62));decoB&&decoB();});
}
function fenceWalls(c,H){const cap=lt(c);
  box(-.2,-.2,GW+.2,.2,H,0,cap,c,mul(c,.8));box(-.2,0,.2,GH,H,0,cap,mul(c,.86),mul(c,.86));
  const brick=(len)=>()=>{ctx.fillStyle='rgba(60,30,20,.22)';for(let y=-H+6,i=0;y<0;y+=7,i++){ctx.fillRect(0,y,len,1);for(let x=(i%2)*8;x<len;x+=16)ctx.fillRect(x,y,1,7);}};
  onA(0,brick(GW*32));onB(GH,brick(GH*32));}
function houseFacade(c,H){
  box(-.25,-3,GW+.25,3,H,0,'#6a4e44',c,mul(c,.82));
  onA(0,()=>{R(0,-10,GW*32,10,mul(c,.6));R(0,-H,GW*32,8,'#8c6a5a');
    const n=night(),wr=rng(4);
    for(let i=0;i<5;i++)win(14+i*76,-H+30,30,46,n?(wr()<.7?'lit':'dark'):'day');
    // porta de vidro
    R(140,-112,92,112,'#3a3330');const g=ctx.createLinearGradient(0,-108,0,0);g.addColorStop(0,n?'#ffd88a':'#d6efff');g.addColorStop(1,n?'#e89a3a':'#8fc4ea');ctx.fillStyle=g;ctx.fillRect(144,-108,84,108);R(185,-108,2,108,'#3a3330');
    win(40,-96,40,52,n?'lit':'day');win(290,-96,40,52,n?'lit':'day');});
}

/* ---------- móveis e objetos ---------- */
function tree(gx,gy,pal){const P=pal||['#1f5a2e','#2b7a3c','#3d9a4c','#62b862'];
  addF(gx,gy,()=>{const c=S(gx+.5,gy+.5),cr=rng(gx*13+gy*7+1);
    poly([[c[0]-5,c[1]],[c[0]+5,c[1]],[c[0]+3,c[1]-90],[c[0]-2,c[1]-90]],'#6e4a32');R(c[0]-5,c[1]-88,3,88,'#553724');
    ctx.strokeStyle='#5a3b28';ctx.lineWidth=3;[[-18,-108],[20,-114],[2,-126]].forEach(([dx,dy])=>{ctx.beginPath();ctx.moveTo(c[0],c[1]-76);ctx.lineTo(c[0]+dx,c[1]+dy);ctx.stroke();});
    const cx=c[0],cy=c[1]-128,bl=[];for(let i=0;i<26;i++){const a=cr()*Math.PI*2,d=Math.sqrt(cr())*38;bl.push([cx+Math.cos(a)*d*1.25,cy+Math.sin(a)*d*.85,11+cr()*9]);}
    bl.forEach(([x,y,r])=>circ(x,y+3,r+1,P[0]));bl.forEach(([x,y,r])=>circ(x,y,r,P[1]));bl.forEach(([x,y,r])=>circ(x+2,y-3,r*.7,P[2]));bl.forEach(([x,y,r])=>circ(x+4,y-6,r*.32,P[3]));
    for(let i=0;i<90;i++){const a=cr()*Math.PI*2,d=Math.sqrt(cr())*48;R((cx+Math.cos(a)*d*1.25)|0,(cy+Math.sin(a)*d*.75)|0,2,2,cr()<.5?P[3]:P[0]);}});}
function bush(gx,gy,pal){const P=pal||['#2b6a35','#3b8a45','#5aa85a'];addF(gx,gy,()=>{const c=S(gx+.5,gy+.5),r=rng(gx*5+gy*11);
  for(let i=0;i<7;i++){const x=c[0]+(r()-.5)*24,y=c[1]-10-r()*12,rr=7+r()*5;circ(x,y+2,rr,P[0]);circ(x,y,rr*.85,P[1]);circ(x+1,y-2,rr*.4,P[2]);}});}
function plant(gx,gy){addF(gx,gy,()=>{bx(gx+.3,gy+.3,.4,.4,16,0,'#c46a3d');const c=S(gx+.5,gy+.5);
  [[0,-30,11,'#2f8f5b'],[-8,-25,8,'#25744a'],[8,-26,8,'#3fae6e'],[2,-42,7,'#3fae6e'],[-4,-37,6,'#2f8f5b']].forEach(([dx,dy,r,col])=>circ(c[0]+dx,c[1]+dy,r,col));});}
function bench(gx,gy,face){seatAt(gx,gy,face);
  addF(gx,gy,()=>{const W='#a86e44',leg=(fx,fy)=>bx(fx,fy,.06,.06,20,0,'#3a3236');
    if(face==='x'||face==='nx'){const bk=face==='x'?gx+.16:gx+.76;leg(gx+.28,gy+.15);leg(gx+.72,gy+.15);leg(gx+.28,gy+.8);leg(gx+.72,gy+.8);
      if(face==='x')bx(bk,gy+.1,.08,.8,28,20,W);bx(gx+.22,gy+.1,.56,.8,4,20,W);if(face==='nx')bx(bk,gy+.1,.08,.8,28,20,W);}
    else{const bk=face==='y'?gy+.16:gy+.76;leg(gx+.15,gy+.28);leg(gx+.8,gy+.28);leg(gx+.15,gy+.72);leg(gx+.8,gy+.72);
      if(face==='y')bx(gx+.1,bk,.8,.08,28,20,W);bx(gx+.1,gy+.22,.8,.56,4,20,W);if(face==='ny')bx(gx+.1,bk,.8,.08,28,20,W);}
  },{block:false,dz:-.01});}
function chair(gx,gy,face,col,h=20){seatAt(gx,gy,face);const C=col||'#8a5a3a';
  addF(gx,gy,()=>{const leg=(fx,fy)=>bx(fx,fy,.05,.05,h,0,mul(C,.7));
    leg(gx+.3,gy+.3);leg(gx+.65,gy+.3);leg(gx+.3,gy+.65);leg(gx+.65,gy+.65);
    const back=()=>{if(face==='x')bx(gx+.26,gy+.26,.07,.48,22,h,C);if(face==='y')bx(gx+.26,gy+.26,.48,.07,22,h,C);};
    const backF=()=>{if(face==='nx')bx(gx+.67,gy+.26,.07,.48,22,h,C);if(face==='ny')bx(gx+.26,gy+.67,.48,.07,22,h,C);};
    back();bx(gx+.26,gy+.26,.48,.48,3,h,C);backF();},{block:false,dz:-.01});}
function stool(gx,gy,face,col){seatAt(gx,gy,face);addF(gx,gy,()=>{bx(gx+.46,gy+.46,.08,.08,22,0,'#3a3236');ell(...up(S(gx+.5,gy+.5),24),9,4.5,col||'#b8323a');ell(...up(S(gx+.5,gy+.5),25),8,4,lt(col||'#b8323a'));},{block:false,dz:-.01});}
function sofa(gx,gy,face,col){seatAt(gx,gy,face);const C=col||'#6a4a8a';
  addF(gx,gy,()=>{if(face==='x'){bx(gx+.08,gy,.25,1,34,0,C);bx(gx+.08,gy,.85,1,14,0,mul(C,.95));bx(gx+.3,gy+.05,.6,.9,4,14,lt(C));}
    else if(face==='y'){bx(gx,gy+.08,1,.25,34,0,C);bx(gx,gy+.08,1,.85,14,0,mul(C,.95));bx(gx+.05,gy+.3,.9,.6,4,14,lt(C));}
    else if(face==='nx'){bx(gx+.07,gy,.85,1,14,0,mul(C,.95));bx(gx+.1,gy+.05,.6,.9,4,14,lt(C));bx(gx+.67,gy,.25,1,34,0,C);}
    else{bx(gx,gy+.07,1,.85,14,0,mul(C,.95));bx(gx+.05,gy+.1,.9,.6,4,14,lt(C));bx(gx,gy+.67,1,.25,34,0,C);}},{block:false,dz:-.01});}
function beanbag(gx,gy,col){B.seats.set(key(gx,gy),{...FACES.y,kind:2});addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);ell(c[0],c[1]-6,15,9,mul(col,.75));ell(c[0],c[1]-9,14,9,col);ell(c[0]-4,c[1]-13,6,3,lt(col));},{block:false,dz:-.01});}
function table(x0,y0,w,d,h,col,items){const T={x:x0+.1,y:y0+.1,w:w-.2,d:d-.2};
  for(let i=0;i<w;i++)for(let j=0;j<d;j++){const gx=x0+i,gy=y0+j;addF(gx,gy,()=>{
    const fx=Math.max(T.x,gx),fy=Math.max(T.y,gy),fw=Math.min(T.x+T.w,gx+1)-fx,fd=Math.min(T.y+T.d,gy+1)-fy;
    [[T.x+.04,T.y+.04],[T.x+T.w-.1,T.y+.04],[T.x+.04,T.y+T.d-.1],[T.x+T.w-.1,T.y+T.d-.1]].forEach(([lx,ly])=>{if(lx>=gx&&lx<gx+1&&ly>=gy&&ly<gy+1)bx(lx,ly,.06,.06,h,0,mul(col,.7));});
    box(fx,fy,fw,fd,3,h,lt(col),mul(col,.82),mul(col,.68));
    (items||[]).forEach(it=>{if(it[0]>=gx&&it[0]<gx+1&&it[1]>=gy&&it[1]<gy+1)drawItem(it,h+3);});});}}
function drawItem([fx,fy,kind,c],z){const p=up(S(fx,fy),z);
  if(kind==='prato'){ell(p[0],p[1],6,3,'#f2efe9');ell(p[0],p[1]-1,4,2,c||'#c96a3a');}
  else if(kind==='copo'){R(p[0]-1,p[1]-6,3,6,'rgba(220,240,255,.85)');R(p[0]-1,p[1]-3,3,3,c||'#f0c24a');}
  else if(kind==='garrafa'){R(p[0]-1,p[1]-11,3,11,c||'#3f8a4a');R(p[0],p[1]-14,1,3,c||'#3f8a4a');}
  else if(kind==='bolo'){ell(p[0],p[1]-2,8,4,'#f3d8e0');R(p[0]-8,p[1]-8,16,6,'#e8a7b8');ell(p[0],p[1]-8,8,4,'#fbe6ec');R(p[0]-1,p[1]-14,2,5,'#ffe08a');}
  else if(kind==='pipoca'){ell(p[0],p[1]-2,7,4,'#c23b3b');ell(p[0],p[1]-5,6,3,'#fff1c8');}
  else if(kind==='pizza'){ell(p[0],p[1],9,4.5,'#e8a84a');ell(p[0],p[1],7,3.5,'#d84a2a');}
  else if(kind==='tabua'){ell(p[0],p[1],9,4,'#a87a4e');R(p[0]-4,p[1]-2,8,2,'#9a3f2a');}}
function cooler(gx,gy){addF(gx,gy,()=>{bx(gx+.2,gy+.25,.6,.5,16,0,'#3b7bd6');bx(gx+.18,gy+.23,.64,.54,4,16,'#efece6');});}
function speaker(gx,gy){addF(gx,gy,()=>{box(gx+.15,gy+.15,.7,.7,48,0,'#3a3540','#2a2630','#201d26');const D=S(gx+.15,gy+.85);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);
  const ring=(x,y,r)=>{circ(x,y,r+1.5,'#4a4458');circ(x,y,r,'#141018');circ(x,y,r*.3,'#5a5468');};ring(11,-17,7*(1+.12*beatPulse));ring(11,-36,3.5);ctx.restore();});}
function lampPost(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);bx(gx+.38,gy+.38,.24,.24,6,0,'#3a3e4a');
  R(c[0]-2,c[1]-118,4,114,'#2e323c');R(c[0]-2,c[1]-118,1,114,'#4a505e');R(c[0]-7,c[1]-134,14,16,'#2e323c');R(c[0]-5,c[1]-132,10,12,night()||SCN&&SCN.night?'#ffe9a8':'#e8e2cc');R(c[0]-8,c[1]-136,16,3,'#2e323c');});
  glowG(gx+.5,gy+.5,80,'#ffe2a0',.22);glowA(gx+.5,gy+.5,126,26,'#ffe9a8',.6);}
function grill(gx,gy){addF(gx,gy,()=>{bx(gx+.12,gy+.15,.76,.7,34,0,'#c27b54');
  const D=S(gx+.12,gy+.85);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);ctx.fillStyle='rgba(70,30,15,.3)';for(let y=-32,i=0;y<0;y+=6,i++){ctx.fillRect(0,y,24,1);for(let x=(i%2)*6;x<24;x+=12)ctx.fillRect(x,y,1,6);}ctx.restore();
  box(gx+.16,gy+.2,.68,.6,3,34,'#2a2626','#1a1818','#201d1d');const c=up(S(gx+.5,gy+.5),37);
  ctx.globalAlpha=.6+.4*Math.abs(Math.sin(now/200));R(c[0]-10,c[1]+1,20,1,'#ff7a2a');ctx.globalAlpha=1;
  R(c[0]-8,c[1]-2,7,2,'#8a3f22');R(c[0]+1,c[1]+1,7,2,'#9a4a28');R(c[0]-3,c[1]+3,6,2,'#7a3418');R(c[0]-6,c[1]+4,4,2,'#c9a03a');
  bx(gx+.58,gy+.2,.24,.24,40,34,'#b06a46');const ch=up(S(gx+.7,gy+.32),76);
  for(let i=0;i<5;i++){const ph=((now/1000)*.3+i/5)%1;ctx.globalAlpha=.22*(1-ph);circ(ch[0]+Math.sin(ph*5+i)*6,ch[1]-ph*60,5+ph*10,'#d8d4cc');}ctx.globalAlpha=1;});
  glowG(gx+.5,gy+.6,90,'#ff8a3a',.28,1);glowA(gx+.5,gy+.5,38,26,'#ffb347',.4,1);}
function umbrella(gx,gy,c1,c2){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);R(c[0]-1,c[1]-78,3,78,'#e8e2d4');
  for(let k=0;k<8;k++){const a0=k/8*Math.PI*2,a1=(k+1)/8*Math.PI*2;poly([[c[0],c[1]-92],[c[0]+Math.cos(a0)*34,c[1]-74+Math.sin(a0)*14],[c[0]+Math.cos(a1)*34,c[1]-74+Math.sin(a1)*14]],k%2?c1:c2);}});}
function lounger(gx,gy,face){seatAt(gx,gy,face);addF(gx,gy,()=>{const W='#efe6d4';
  if(face==='ny'){bx(gx+.25,gy+.05,.5,.9,8,0,W);box(gx+.25,gy+.62,.5,.3,16,8,'#3a8fd0','#2f74ab','#2a6799');}
  else{bx(gx+.05,gy+.25,.9,.5,8,0,W);box(gx+.62,gy+.25,.3,.5,16,8,'#3a8fd0','#2f74ab','#2a6799');}},{block:false,dz:-.01});}
function water(x0,y0,w,d,kind){B.water.push({x0,y0,w,d,kind});for(let i=0;i<w;i++)for(let j=0;j<d;j++)B.blocked.add(key(x0+i,y0+j));}
function balloons(gx,gy,cols){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);cols.forEach((col,i)=>{const bx_=c[0]-10+i*9,by=c[1]-88-((i*7)%13);ctx.strokeStyle='#d8d4cc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(c[0],c[1]-4);ctx.lineTo(bx_,by+9);ctx.stroke();ell(bx_,by,7,9,col);ell(bx_-2,by-3,2,3,'rgba(255,255,255,.6)');});},{block:false,dz:.5});}
function bed(x0,y0,dir,col){const cells=dir==='x'?[[x0,y0],[x0+1,y0]]:[[x0,y0],[x0,y0+1]];
  cells.forEach(([gx,gy],i)=>{B.seats.set(key(gx,gy),{...FACES.y,kind:2});addF(gx,gy,()=>{
    bx(gx+(dir==='x'?(i?0:.08):.1),gy+(dir==='y'?(i?0:.08):.1),dir==='x'?.92:.8,dir==='y'?.92:.8,8,0,'#f2efe9');
    if(i===1)box(gx+(dir==='x'?0:.1),gy+(dir==='y'?0:.1),dir==='x'?.84:.8,dir==='y'?.84:.8,2,8,lt(col),mul(col,.82),mul(col,.7));
    else{const c=up(S(gx+.5,gy+.45),10);ell(c[0],c[1],10,5,'#ffffff');ell(c[0],c[1]+1,10,4,'#e6e2da');}},{block:false,dz:-.01});});}
function tv(gx,gy){addF(gx,gy,()=>{bx(gx+.1,gy+.2,.8,.5,20,0,'#5a4636');box(gx+.15,gy+.32,.7,.08,40,20,'#222','#151515','#1a1a1a');
  const D=S(gx+.15,gy+.4);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);const cs=['#4fb6e8','#e8708a','#f0c24a','#56cf78'];ctx.fillStyle=cs[Math.floor(now/1400)%4];ctx.fillRect(2,-58,18,34);ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(3,-56,5,10);ctx.restore();});
  glowG(gx+.5,gy+1.2,70,'#9fd8ff',.22,1);}
function lampTable(gx,gy){addF(gx,gy,()=>{bx(gx+.25,gy+.25,.5,.5,20,0,'#7a5a3a');const c=up(S(gx+.5,gy+.5),22);R(c[0]-1,c[1]-14,2,14,'#4a3a2a');poly([[c[0]-8,c[1]-14],[c[0]+8,c[1]-14],[c[0]+5,c[1]-26],[c[0]-5,c[1]-26]],'#f3e2b8');});
  glowG(gx+.5,gy+.5,70,'#ffd890',.3);glowA(gx+.5,gy+.5,42,24,'#ffe2a0',.5);}
function fridge(gx,gy){addF(gx,gy,()=>{box(gx+.12,gy+.15,.76,.7,72,0,'#e9e7e2','#cfccc6','#bdbab4');const D=S(gx+.12,gy+.85);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);
  R(2,-66,20,56,'#9ec7d8');['#c23b3b','#3f8a4a','#f0c24a','#3f8a4a','#c96a3a'].forEach((c,i)=>{R(4+(i%3)*6,-60+Math.floor(i/3)*18,3,12,c);R(4+(i%3)*6,-42+Math.floor(i/3)*18,3,12,c);});R(2,-70,20,4,'#c23b3b');ctx.restore();});
  glowG(gx+.5,gy+1,50,'#bfe9ff',.25);}
function jukebox(gx,gy){addF(gx,gy,()=>{box(gx+.15,gy+.2,.7,.6,50,0,'#6a2a3a','#4e1f2c','#421a25');const c=up(S(gx+.5,gy+.5),50);ell(c[0],c[1],18,9,'#8a3a4e');
  const D=S(gx+.15,gy+.8);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);const cs=['#ffb347','#ff4fa3','#43d9e8'];for(let i=0;i<3;i++){R(3+i*6,-44,4,30,cs[(i+Math.floor(now/400))%3]);}ctx.restore();});
  glowG(gx+.5,gy+1,60,'#ff8fc7',.25,1);}
function poolTable(gx,gy){[[gx,gy],[gx+1,gy]].forEach(([x,y],i)=>addF(x,y,()=>{
  const fx=i?x:x+.1,fw=i?.9:.9;[[x+.15,gy+.2],[x+.8,gy+.7]].forEach(([lx,ly])=>bx(lx,ly,.08,.08,22,0,'#4a3020'));
  box(fx,gy+.12,fw,.76,4,22,'#7a4a2a','#5a3420','#4a2a18');box(fx+(i?0:.08),gy+.2,fw-.08,.6,1,26,'#2f8a5a','#256f48','#1f5f3e');
  if(i){const c=up(S(x+.4,gy+.5),27);[['#f2efe9',-6,0],['#c23b3b',4,2],['#f0c24a',8,-1],['#2f4f7a',10,3],['#26242b',0,4]].forEach(([col,dx,dy])=>circ(c[0]+dx,c[1]+dy,1.6,col));}
  else{const c=up(S(x+.5,gy+.5),27);ctx.strokeStyle='#d8b57e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(c[0]-14,c[1]+6);ctx.lineTo(c[0]+12,c[1]-6);ctx.stroke();}}));}
function plasticTable(gx,gy,col){addF(gx,gy,()=>{bx(gx+.46,gy+.46,.08,.08,22,0,mul(col,.8));const c=up(S(gx+.5,gy+.5),22);ell(c[0],c[1]+1,17,9,mul(col,.75));ell(c[0],c[1],17,9,col);
  drawItem([gx+.4,gy+.45,'garrafa','#b9822a'],22);drawItem([gx+.6,gy+.55,'copo','#f0c24a'],22);});}
function barCounter(fx,y0,n,face){for(let j=0;j<n;j++){const gy=y0+j;addF(fx,gy,()=>{bx(fx+.05,gy,.75,1,32,0,'#7a4a2e');box(fx,gy,.85,1,4,32,'#c98a5a','#9a6440','#b07048');
  if(j%2===0)drawItem([fx+.4,gy+.4,'garrafa',['#3f8a4a','#c23b3b','#b9822a'][j%3]],36);else drawItem([fx+.4,gy+.5,'copo'],36);});}}
function djBooth(x0,gy,n){for(let i=0;i<n;i++){const gx=x0+i;addF(gx,gy,()=>{box(gx,gy+.15,1,.85,32,0,'#2e2838','#221d2c','#1b1724');
  const D=S(gx,gy+1);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);ctx.globalAlpha=.5+.5*beatPulse;R(2,-24,28,3,i%2?'#43d9e8':'#ff4fa3');ctx.globalAlpha=1;ctx.restore();
  const c=up(S(gx+.5,gy+.58),32);if(i!==Math.floor(n/2)){ell(c[0],c[1],11,5.5,'#120d1a');ell(c[0],c[1],8,4,'#2c2545');const a=now/300*(i?1:-1);R(Math.round(c[0]+Math.cos(a)*5)-1,Math.round(c[1]+Math.sin(a)*2.5)-1,2,2,'#ffb347');}
  else{poly([[c[0]-10,c[1]],[c[0],c[1]-5],[c[0]+10,c[1]],[c[0],c[1]+5]],'#c9c3e3');poly([[c[0]-10,c[1]],[c[0],c[1]-5],[c[0],c[1]-19],[c[0]-10,c[1]-14]],'#43d9e8');}});}}
function hedge(gx,gy){addF(gx,gy,()=>{bx(gx+.04,gy+.08,.92,.84,30,0,'#3b7d48');const r=rng(gx*31+gy);for(let i=0;i<26;i++){const[x,y]=S(gx+.08+r()*.84,gy+.1+r()*.8);R(x|0,(y-30)|0,2,2,r()<.5?'#5aa060':'#2c6036');}});}
function tuft(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5),tr=rng(gx*7+gy*13);ctx.lineWidth=1.5;for(let i=0;i<14;i++){const bx_=c[0]-12+tr()*24,by=c[1]-2+tr()*6,h=14+tr()*18;ctx.strokeStyle=['#3f8a46','#55a258','#2f6f36'][i%3];ctx.beginPath();ctx.moveTo(bx_,by);ctx.quadraticCurveTo(bx_+2,by-h*.6,bx_+(tr()*8-4),by-h);ctx.stroke();}},{block:false,dz:.5});}
function coffeeTable(gx,gy){addF(gx,gy,()=>{bx(gx+.15,gy+.15,.7,.7,12,0,'#6a4a32');drawItem([gx+.4,gy+.4,'pipoca'],12);drawItem([gx+.65,gy+.6,'copo','#c23b3b'],12);});}
function trash(gx,gy){addF(gx,gy,()=>{bx(gx+.35,gy+.35,.3,.3,20,0,'#3f6b48');});}

/* ---------- efeitos ---------- */
function stringLights(pts,h,sag){B.air.push(()=>{const BUL=['#ff8fc7','#fff3c9','#7fe7ff','#ffd84a'],lit=SCN.night;
  for(let s=0;s<pts.length-1;s++){const P=up(S(...pts[s]),h),Q=up(S(...pts[s+1]),h),n=Math.max(6,Math.round(Math.hypot(Q[0]-P[0],Q[1]-P[1])/9));
    ctx.strokeStyle='rgba(30,25,30,.6)';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=n;i++){const t=i/n,x=P[0]+(Q[0]-P[0])*t,y=P[1]+(Q[1]-P[1])*t+Math.sin(t*Math.PI)*sag;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    for(let i=1;i<n;i++){const t=i/n,x=P[0]+(Q[0]-P[0])*t,y=P[1]+(Q[1]-P[1])*t+Math.sin(t*Math.PI)*sag,tw=RM?1:.55+.45*Math.sin(now/300+i*1.7+s);
      ctx.globalAlpha=lit?tw:.9;ctx.fillStyle=lit?BUL[(i+s)%4]:'#e8e4d8';ctx.fillRect(Math.round(x)-1,Math.round(y),3,3);if(lit){ctx.globalAlpha=tw*.35;ctx.beginPath();ctx.arc(x+.5,y+1.5,4,0,7);ctx.fill();}}}ctx.globalAlpha=1;});}
function neon(wall,h,col,a0,a1){B.air.push(()=>{ctx.save();ctx.shadowColor=col;ctx.shadowBlur=10;ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=.75+.25*beatPulse;ctx.beginPath();
  if(wall==='A'){ctx.moveTo(...up(S(a0,0),h));ctx.lineTo(...up(S(a1,0),h));}else{ctx.moveTo(...up(S(0,a0),h));ctx.lineTo(...up(S(0,a1),h));}ctx.stroke();ctx.restore();});}
function discoBall(fx,fy,h){B.air.push(()=>{const[x,y]=up(S(fx,fy),h);ctx.strokeStyle='#6b6680';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-80);ctx.lineTo(x,y-14);ctx.stroke();
  const g=ctx.createRadialGradient(x-5,y-5,2,x,y,15);g.addColorStop(0,'#ffffff');g.addColorStop(.5,'#c9c3e3');g.addColorStop(1,'#5b5480');circ(x,y,14,g);
  ctx.save();ctx.beginPath();ctx.arc(x,y,14,0,7);ctx.clip();ctx.strokeStyle='rgba(26,16,38,.45)';const off=(now/120)%5;for(let i=-20;i<=20;i+=5){ctx.beginPath();ctx.moveTo(x+i+off,y-15);ctx.lineTo(x+i+off,y+15);ctx.stroke();ctx.beginPath();ctx.moveTo(x-15,y+i);ctx.lineTo(x+15,y+i);ctx.stroke();}ctx.restore();
  if(SCN.night){ctx.save();ctx.globalCompositeOperation='lighter';['#ff4fa3','#43d9e8','#ffb347'].forEach((col,i)=>{const t=RM?i*1000:now,sx=fx+1.6*Math.sin(t*.0007+i*2.1),sy=fy+1.6*Math.cos(t*.0009+i*1.3),[px,py]=S(sx,sy);ctx.globalAlpha=.06;poly([[x,y],[px-24,py],[px+24,py]],col);const gg=ctx.createRadialGradient(px,py,2,px,py,36);gg.addColorStop(0,col);gg.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=.4;ctx.fillStyle=gg;ctx.beginPath();ctx.ellipse(px,py,36,18,0,0,7);ctx.fill();});ctx.restore();}});}
function danceFloor(x0,y0,w,d){B.ground.push(()=>{const beat=Math.floor(now/(RM?1500:480)),DC=['#c23b8a','#c9862e','#2a9aa8','#6a3fc0'];
  for(let i=0;i<w;i++)for(let j=0;j<d;j++){const gx=x0+i,gy=y0+j,col=DC[(gx*3+gy*5+beat)%4];tile(gx,gy,col,'rgba(0,0,0,.35)');ctx.globalAlpha=.25*beatPulse;tile(gx,gy,'#ffffff');ctx.globalAlpha=1;}});
  for(let i=0;i<w;i+=2)for(let j=0;j<d;j+=2)glowG(x0+i+1,y0+j+1,60,['#ff4fa3','#43d9e8'][(i+j)%2],.14,1);}
function waterFx(){B.ground.push(()=>{for(const W of SCN.water){const pool=W.kind==='pool'||W.kind==='jacuzzi';
  poly([S(W.x0+.08,W.y0+.08),S(W.x0+W.w-.08,W.y0+.08),S(W.x0+W.w-.08,W.y0+W.d-.08),S(W.x0+.08,W.y0+W.d-.08)],W.kind==='jacuzzi'?'#5fd0e8':pool?'#4fb6e8':W.kind==='koi'?'#2e7f8e':'#3d86b8');
  if(pool){ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;for(let i=1;i<W.w;i++){ctx.beginPath();ctx.moveTo(...S(W.x0+i,W.y0+.1));ctx.lineTo(...S(W.x0+i,W.y0+W.d-.1));ctx.stroke();}for(let j=1;j<W.d;j++){ctx.beginPath();ctx.moveTo(...S(W.x0+.1,W.y0+j));ctx.lineTo(...S(W.x0+W.w-.1,W.y0+j));ctx.stroke();}}
  const r=rng(W.x0*9+W.y0);for(let k=0;k<W.w*W.d*3;k++){const fx=W.x0+.2+r()*(W.w-.4),fy=W.y0+.2+r()*(W.d-.4),ph=r()*6,[x,y]=S(fx,fy),l=4+3*Math.sin(now/500+ph);ctx.globalAlpha=.55;R(Math.round(x-l/2),Math.round(y+Math.sin(now/700+ph)),Math.round(l),1,'#dff3ff');}ctx.globalAlpha=1;
  if(!pool){const r2=rng(3);for(let k=0;k<3;k++){const[x,y]=S(W.x0+.5+r2()*(W.w-1),W.y0+.5+r2()*(W.d-1));ell(x,y,5,2.5,'#4f9a4e');R(x-1,y-2,2,1,'#e8a7c8');}}}});}

/* ---------- montar cena ---------- */
function buildScene(id,isNight){const sc=sceneById(id);
  B={id,sc,night:!!isNight,furn:[],blocked:new Set(),seats:new Map(),ground:[],air:[],glowsG:[],glowsA:[],water:[],cfg:{},rugs:[],dance:null,mixer:null,lava:null,bridge:null,floorAt:()=>'grass',walls:()=>{}};
  sc.build();if(B.water.length){waterFx();B.ground.unshift(B.ground.pop());}
  const st=document.createElement('canvas');st.width=WB;st.height=HB;const prev=ctx;ctx=st.getContext('2d');ctx.setTransform(WS,0,0,WS,0,0);
  cliff(sc.outdoor,sc.cliff);B.walls();
  const fr=rng(11);for(let gy=0;gy<GH;gy++)for(let gx=0;gx<GW;gx++){const t=B.floorAt(gx,gy);(FLOOR[t]||FLOOR.grass)(gx,gy,fr);}
  for(const W of B.water){const P=W.kind==='pool'||W.kind==='jacuzzi';poly([S(W.x0-.08,W.y0-.08),S(W.x0+W.w+.08,W.y0-.08),S(W.x0+W.w+.08,W.y0+W.d+.08),S(W.x0-.08,W.y0+W.d+.08)],P?'#e8e2d4':W.kind==='koi'?'#7a7670':'#8a8a80');
    poly([S(W.x0+.08,W.y0+.08),S(W.x0+W.w-.08,W.y0+.08),S(W.x0+W.w-.08,W.y0+W.d-.08),S(W.x0+.08,W.y0+W.d-.08)],P?'#2f86b8':W.kind==='koi'?'#1f5a6a':'#2a5a7a');}
  B.rugs.forEach(([x0,y0,c1,c2])=>{const n=8,s=(2-.16)/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const fx=x0+.08+i*s,fy=y0+.08+j*s;poly([S(fx,fy),S(fx+s,fy),S(fx+s,fy+s),S(fx,fy+s)],(i+j)%2?c1:c2);}
    for(let i=0;i<2;i++)for(let j=0;j<2;j++)B.seats.set(key(x0+i,y0+j),{...FACES.y,kind:2});});
  if(sc.outdoor){const flr=rng(33),FC=['#ff8fc7','#ffe27a','#9fd3ff','#ffffff','#c49bff'];for(let k=0;k<18;k++){const gx=flr()*12|0,gy=flr()*12|0;if(B.floorAt(gx,gy)!=='grass'||B.blocked.has(key(gx,gy)))continue;
    const c=FC[flr()*FC.length|0];for(let m=0;m<5;m++){const[x,y]=S(gx+.2+flr()*.6,gy+.2+flr()*.6);R(x|0,(y|0)+1,1,3,'#2c6b36');R((x|0)-1,(y|0)-1,3,2,c);}}}
  ctx=prev;B.st=st;B.tint=sc.tint||(sc.dark?'#625a80':sc.outdoor?'#414b78':'#77738f');
  const out=B;B=null;return out;}

/* ---------- desenhar o mundo ---------- */
function glow(x,y,r,col,a,sy=1){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=a;ctx.fillStyle=g;ctx.save();ctx.translate(x,y);ctx.scale(1,sy);ctx.translate(-x,-y);ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.restore();ctx.globalAlpha=1;}
function drawWorld(scn,avs,extra){
  /* só redesenha o retângulo visível (V, em px do buffer): bem mais leve no celular */
  const V=(extra&&extra.view)||[0,0,WB,HB],[vx,vy,vw_,vh_]=V;
  SCN=scn;ctx=wctx;ctx.setTransform(1,0,0,1,0,0);ctx.save();ctx.beginPath();ctx.rect(vx,vy,vw_,vh_);ctx.clip();
  ctx.clearRect(vx,vy,vw_,vh_);ctx.drawImage(scn.st,vx,vy,vw_,vh_,vx,vy,vw_,vh_);ctx.setTransform(WS,0,0,WS,0,0);
  scn.ground.forEach(f=>f());
  extra&&extra.ground&&extra.ground();
  const ents=[...scn.furn,...avs.map(a=>({a,depth:Math.max(a.gx+a.gy,a.path.length?a.path[0][0]+a.path[0][1]:0)}))];
  ents.sort((p,q)=>p.depth-q.depth||(p.furn?1:0)-(q.furn?1:0));
  ents.forEach(e=>e.furn?e.draw():e.a.pet?drawPet(e.a):drawAv(e.a));
  if(scn.night||scn.sc.dark){
    ctx.setTransform(1,0,0,1,0,0);mkc.clearRect(vx,vy,vw_,vh_);mkc.drawImage(wb,vx,vy,vw_,vh_,vx,vy,vw_,vh_);
    ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle=scn.night?scn.tint:'#c9c4d8';ctx.fillRect(vx,vy,vw_,vh_);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mk,vx,vy,vw_,vh_,vx,vy,vw_,vh_);ctx.restore();
    ctx.setTransform(WS,0,0,WS,0,0);
    ctx.save();ctx.globalCompositeOperation='lighter';const fl=RM?1:1+.12*Math.sin(now/90)+.06*Math.sin(now/31);
    scn.glowsG.forEach(g=>{const[x,y]=S(g.fx,g.fy);glow(x,y,g.r*(g.flick?fl:1),g.col,g.a*(scn.night?1:.5),.55);});
    scn.glowsA.forEach(g=>{const[x,y]=up(S(g.fx,g.fy),g.h);glow(x,y,g.r*(g.flick?fl:1),g.col,g.a*(scn.night?1:.5));});ctx.restore();}
  scn.air.forEach(f=>f());
  ctx.setTransform(1,0,0,1,0,0);ctx.restore();ctx.setTransform(WS,0,0,WS,0,0);
}
