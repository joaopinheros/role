/* ===== Rolê Y2K — núcleo do renderizador de avatar (pixel art hi-res por esqueleto) ===== */
const AV={};
(function(AV){
const HW=112,HH=280,PX=56,PY=240,K=.5,W=56,H=140;
AV.W=HW;AV.H=HH;AV.PX=PX;AV.PY=PY;AV.K=K;AV.LW=W;AV.LH=H;

/* ---------- cor ---------- */
const hx=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
function rgb2hsl([r,g,b]){r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b),l=(M+m)/2;let h=0,s=0;
  if(M!==m){const d=M-m;s=l>.5?d/(2-M-m):d/(M+m);h=M===r?(g-b)/d+(g<b?6:0):M===g?(b-r)/d+2:(r-g)/d+4;h*=60;}return[h,s,l];}
function hsl2rgb([h,s,l]){h=((h%360)+360)%360;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let r,g,b;
  [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return[(r+m)*255,(g+m)*255,(b+m)*255].map(v=>Math.max(0,Math.min(255,Math.round(v))));}
const mixc=(a,b,k)=>a.map((v,i)=>Math.round(v+(b[i]-v)*k));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function hueToward(h,t,k){let d=((t-h+540)%360)-180;return h+d*k;}
/* rampa de 5 tons: 0 profundo, 1 sombra, 2 base, 3 luz, 4 brilho — sombras puxam pro roxo/azul, luzes pro quente */
function ramp(hex){const c=hx(hex),[h,s,l]=rgb2hsl(c),warm=(h<75||h>320)&&s>.12;const tgt=warm?345:248;
  const L=[clamp(l-(.085+.34*l),0,1),clamp(l-(.05+.15*l),0,1),l,clamp(l+(.055+.06*(1-l)),0,1),clamp(l+(.11+.12*(1-l)),0,1)];
  return L.map((li,i)=>{if(i===2)return c;let hh=h,ss=s;
    if(i<2){hh=hueToward(h,tgt,i===0?.16:.08);ss=warm&&l>.45?clamp(s*(i===0?.72:.86),0,1):clamp(s+(s>.05?.06:.03),0,1);}
    else{hh=hueToward(h,58,i===4?.10:.05);ss=clamp(s*(i===4?.85:.95),0,1);}
    return hsl2rgb([hh,ss,li]);});}
AV.ramp=ramp;AV.hx=hx;
const OUT=[13,11,17];

/* ---------- tela ---------- */
const L3=(()=>{const v=[-.66,-.48,.58],n=Math.hypot(...v);return v.map(x=>x/n);})();
function Canvas(){this.part=new Int16Array(W*H).fill(-1);this.tone=new Int8Array(W*H);this.alt=new Uint8Array(W*H);this.fix=new Int32Array(W*H).fill(-1);this.I=new Float32Array(W*H);this.parts=[];}
Canvas.prototype.part_=function(o){const p=new Part(this,o);return p;};
function Part(cv,o){this.cv=cv;this.o=Object.assign({line:true,outline:true,cast:true,receive:true,bias:0,round:5,group:null},o);
  if(!cv.scr){const n=W*H;cv.scr={mask:new Uint8Array(n),nx:new Float32Array(n),ny:new Float32Array(n),nz:new Float32Array(n),auto:new Uint8Array(n),U:new Float32Array(n),S:new Float32Array(n)};}
  Object.assign(this,cv.scr);this.bb=[W,H,-1,-1];}
Part.prototype._bb=function(x0,y0,x1,y1){x0=Math.max(0,Math.floor(x0));y0=Math.max(0,Math.floor(y0));x1=Math.min(W-1,Math.ceil(x1));y1=Math.min(H-1,Math.ceil(y1));return[x0,y0,x1,y1];};
Part.prototype._mark=function(i,x,y){this.mask[i]=1;const b=this.bb;if(x<b[0])b[0]=x;if(y<b[1])b[1]=y;if(x>b[2])b[2]=x;if(y>b[3])b[3]=y;};
Part.prototype.poly=function(pts,sub){pts=pts.map(q=>[q[0]*K,q[1]*K]);let y0=1e9,y1=-1e9;for(const q of pts){if(q[1]<y0)y0=q[1];if(q[1]>y1)y1=q[1];}
  const ya=Math.max(0,Math.floor(y0)),yb=Math.min(H-1,Math.ceil(y1)),n=pts.length,xs=[];
  for(let y=ya;y<=yb;y++){const yc=y+.5;xs.length=0;
    for(let i=0,j=n-1;i<n;j=i++){const yi=pts[i][1],yj=pts[j][1];if((yi>yc)!==(yj>yc))xs.push(pts[i][0]+(yc-yi)*(pts[j][0]-pts[i][0])/(yj-yi));}
    if(xs.length<2)continue;xs.sort((p,q)=>p-q);
    for(let k=0;k+1<xs.length;k+=2){const xa=Math.max(0,Math.ceil(xs[k]-.5)),xb=Math.min(W-1,Math.ceil(xs[k+1]-.5)-1);
      for(let x=xa;x<=xb;x++){const i=y*W+x;if(sub){this.mask[i]=0;continue;}if(!this.mask[i]||this.auto[i]){this._mark(i,x,y);this.auto[i]=1;this.U[i]=0;this.S[i]=0;}}}}
  return this;};
Part.prototype.cap=function(A,B,ra,rb,sub){A=[A[0]*K,A[1]*K];B=[B[0]*K,B[1]*K];ra*=K;rb*=K;const r=Math.max(ra,rb);const[a,b,c,d]=this._bb(Math.min(A[0],B[0])-r-1,Math.min(A[1],B[1])-r-1,Math.max(A[0],B[0])+r+1,Math.max(A[1],B[1])+r+1);
  const vx=B[0]-A[0],vy=B[1]-A[1],ll=vx*vx+vy*vy||1e-6;
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++){const px=x+.5-A[0],py=y+.5-A[1];const t=clamp((px*vx+py*vy)/ll,0,1);const dx=px-vx*t,dy=py-vy*t,dist=Math.hypot(dx,dy),rr=ra+(rb-ra)*t;
    if(dist>rr)continue;const i=y*W+x;if(sub){this.mask[i]=0;continue;}
    const s=dist/rr,nz=Math.sqrt(Math.max(0,1-s*s)),k=dist>1e-6?s/dist:0;this._mark(i,x,y);this.auto[i]=this.o.auto?1:0;this.nx[i]=dx*k;this.ny[i]=dy*k;this.nz[i]=nz;this.U[i]=t;
    const sx=(-vy*dx+vx*dy)/Math.sqrt(ll);this.S[i]=sx/rr;}
  return this;};
Part.prototype.ell=function(cx,cy,rx,ry,sub){cx*=K;cy*=K;rx*=K;ry*=K;const[a,b,c,d]=this._bb(cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1);
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++){const u=(x+.5-cx)/rx,v=(y+.5-cy)/ry,q=u*u+v*v;if(q>1)continue;const i=y*W+x;if(sub){this.mask[i]=0;continue;}
    this._mark(i,x,y);this.auto[i]=this.o.auto?1:0;this.nx[i]=u;this.ny[i]=v;this.nz[i]=Math.sqrt(Math.max(0,1-q));this.U[i]=u;this.S[i]=v;}
  return this;};
Part.prototype.rect=function(x0,y0,x1,y1,sub){return this.poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],sub);};
function inPoly(p,x,y){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
AV.inPoly=inPoly;
/* sombreamento "auto": campo de distância até a borda -> altura arredondada -> normal */
let _D=new Float32Array(W*H),_HT=new Float32Array(W*H);
Part.prototype._autoNormals=function(){const[x0,y0,x1,y1]=this.bb;if(x1<0)return;let any=0;
  for(let y=y0;y<=y1&&!any;y++)for(let x=x0;x<=x1;x++)if(this.mask[y*W+x]&&this.auto[y*W+x]){any=1;break;}if(!any)return;
  const w=x1-x0+3,h=y1-y0+3,D=_D,HT=_HT,R=Math.max(1.4,this.o.round*K),BIG=1e4;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const X=x+x0-1,Y=y+y0-1,inside=X>=0&&Y>=0&&X<W&&Y<H&&this.mask[Y*W+X];D[y*w+x]=inside?BIG:0;}
  const a=1,b=1.41;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(!D[i])continue;D[i]=Math.min(D[i],D[i-1]+a,D[i-w]+a,D[i-w-1]+b,D[i-w+1]+b);}
  for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){const i=y*w+x;if(!D[i])continue;D[i]=Math.min(D[i],D[i+1]+a,D[i+w]+a,D[i+w+1]+b,D[i+w-1]+b);}
  for(let i=0;i<w*h;i++){const d=Math.min(D[i],R)/R;HT[i]=Math.sqrt(Math.max(0,1-(1-d)*(1-d)))*R;}
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const X=x+x0-1,Y=y+y0-1,I=Y*W+X;if(!this.mask[I]||!this.auto[I])continue;const i=y*w+x;
    const gx=(HT[i+1]-HT[i-1])/2,gy=(HT[i+w]-HT[i-w])/2,m=Math.hypot(gx,gy,1);this.nx[I]=-gx/m;this.ny[I]=-gy/m;this.nz[I]=1/m;}};
Part.prototype.commit=function(){const cv=this.cv,o=this.o,id=cv.parts.length;cv.parts.push(o);this.id=id;this._autoNormals();
  const[x0,y0,x1,y1]=this.bb;if(x1<0){o.bb=[0,0,-1,-1];return this;}
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x;if(!this.mask[i])continue;
    let I=this.nx[i]*L3[0]+this.ny[i]*L3[1]+this.nz[i]*L3[2];if(o.light)I=o.light(I,(x+.5)/K,(y+.5)/K,this.U[i],this.S[i]);
    let t=I>.8?3:I>0?2:I>-.5?1:0;if(o.flat!=null)t=o.flat;t=clamp(t+o.bias,0,4);if(o.gloss&&I>.86)t=4;
    cv.part[i]=id;cv.tone[i]=t;cv.I[i]=I;cv.fix[i]=-1;cv.alt[i]=o.pat?(o.pat((x+.5)/K,(y+.5)/K,this.U[i],this.S[i])|0):0;}
  o.bb=[x0,y0,x1,y1];
  for(let y=y0;y<=y1;y++){const a=y*W+x0,b=y*W+x1+1;this.mask.fill(0,a,b);this.auto.fill(0,a,b);this.nx.fill(0,a,b);this.ny.fill(0,a,b);this.nz.fill(0,a,b);this.U.fill(0,a,b);this.S.fill(0,a,b);}
  return this;};
/* tinta: altera pixels já pintados de uma parte */
Canvas.prototype.ink=function(part,pts,how,closed){const id=part.id;pts=pts.map(q=>[q[0]*K,q[1]*K]);const seg=(A,B)=>{const n=Math.max(1,Math.ceil(Math.max(Math.abs(B[0]-A[0]),Math.abs(B[1]-A[1]))));
    for(let k=0;k<=n;k++){const x=Math.floor(A[0]+(B[0]-A[0])*k/n),y=Math.floor(A[1]+(B[1]-A[1])*k/n);this._dot(id,x,y,how);}};
  for(let i=0;i<pts.length-1;i++)seg(pts[i],pts[i+1]);if(closed&&pts.length>2)seg(pts[pts.length-1],pts[0]);};
Canvas.prototype.dot=function(id,x,y,how){this._dot(id,Math.floor((x+.5)*K),Math.floor((y+.5)*K),how);};
Canvas.prototype._dot=function(id,x,y,how){if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;if(id!=null&&this.part[i]!==id)return;
  if(how.tone!=null)this.tone[i]=clamp(how.tone,0,4);if(how.dt)this.tone[i]=clamp(this.tone[i]+how.dt,0,4);if(how.alt!=null)this.alt[i]=how.alt;if(how.rgb)this.fix[i]=(how.rgb[0]<<16)|(how.rgb[1]<<8)|how.rgb[2];if(how.noline)this.fix[i]=this.fix[i];};
Canvas.prototype.fillIn=function(part,test,how){const id=part.id,b=this.parts[id].bb||[0,0,W-1,H-1];for(let y=b[1];y<=b[3];y++)for(let x=b[0];x<=b[2];x++){const i=y*W+x;if(this.part[i]!==id)continue;if(test((x+.5)/K,(y+.5)/K,i))this._dot(id,x,y,how);}};
/* fecha a imagem: sombra de contato, linhas, cores */
Canvas.prototype.finish=function(){const P=this.parts,part=this.part,tone=this.tone.slice(),out=new Uint8ClampedArray(W*H*4);
  /* limpa pixels de tom isolados (sem função visual) */
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,q=part[i];if(q<0||this.fix[i]>=0)continue;const t=tone[i];let same=0,cnt={};let all=0;
    for(const j of[i-1,i+1,i-W,i+W]){if(part[j]!==q||this.alt[j]!==this.alt[i])continue;all++;if(tone[j]===t)same++;cnt[tone[j]]=(cnt[tone[j]]||0)+1;}
    if(!same&&all>=3){let best=t,bc=0;for(const k in cnt)if(cnt[k]>bc){bc=cnt[k];best=+k;}tone[i]=best;}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,q=part[i];if(q<0||!P[q].receive)continue;
    for(const[dx,dy]of[[-1,-1],[0,-1],[-1,0]]){const X=x+dx,Y=y+dy;if(X<0||Y<0)continue;const p=part[Y*W+X];
      if(p>q&&P[p].cast&&!(P[p].group!=null&&P[p].group===P[q].group)){tone[i]=Math.max(0,tone[i]-1);break;}}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,q=part[i];if(q<0)continue;const o=P[q];let line=0;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;const p=(X<0||Y<0||X>=W||Y>=H)?-1:part[Y*W+X];
      if(p<0){if(o.outline){line=2;break;}}
      else if(p<q&&o.line&&!(o.group!=null&&P[p].group===o.group)&&!P[p].noOverLine)line=Math.max(line,1);}
    const fx=this.fix[i];let c;
    if(line===2)c=o.outCol||mixc((((this.alt[i]&&o.mat2)?o.mat2:o.mat)[0]),OUT,.55);
    else if(fx>=0&&!o.lineOverFix){c=[(fx>>16)&255,(fx>>8)&255,fx&255];if(line===1)c=mixc(c,OUT,.6);}
    else{const r=(this.alt[i]&&o.mat2)?o.mat2:o.mat;c=r[tone[i]];if(line===1)c=o.inner!=null?r[o.inner]:mixc(r[0],OUT,.25);}
    out[i*4]=c[0];out[i*4+1]=c[1];out[i*4+2]=c[2];out[i*4+3]=255;}
  return out;};
AV.Canvas=Canvas;AV.mixc=mixc;AV.clamp=clamp;AV.OUT=OUT;
})(AV);
if(typeof module!=='undefined')module.exports=AV;
