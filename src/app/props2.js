
/* ================= objetos novos de cenário ================= */
const pixRect=(x,y,w,h,c)=>R(Math.round(x),Math.round(y),Math.round(w),Math.round(h),c);
/* mesa de som: toca-discos + mixer + caixinha. Clicar liga o house */
function mixer(gx,gy,style){B.mixer=[gx,gy];addF(gx,gy,()=>{const st=style||'pro';
  if(st==='radio'){bx(gx+.2,gy+.25,.6,.5,22,0,'#7a5a3a');const c=up(S(gx+.5,gy+.5),22);box(gx+.28,gy+.35,.44,.3,14,22,'#c23b3b','#9a2a2a','#8a2424');
    const D=S(gx+.28,gy+.65);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);circ(5,-29,3.5*(1+.15*beatPulse),'#1a1414');circ(13,-29,3.5*(1+.15*beatPulse),'#1a1414');R(2,-35,14,2,'#e8d8b0');ctx.restore();return;}
  box(gx+.05,gy+.2,.9,.6,24,0,'#2d2a33','#211e27','#1a1820');
  const D=S(gx+.05,gy+.8);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);R(3,-20,22,2,MUSIC.on?'#43d9e8':'#5a5468');ctx.globalAlpha=MUSIC.on?.6+.4*beatPulse:.3;R(3,-14,22,2,'#ff4fa3');ctx.globalAlpha=1;ctx.restore();
  const top=24,a=up(S(gx+.27,gy+.5),top),b=up(S(gx+.73,gy+.5),top),m=up(S(gx+.5,gy+.5),top);
  for(const p of[a,b]){ell(p[0],p[1],8,4,'#141018');ell(p[0],p[1],5.5,2.8,'#2c2545');const ang=MUSIC.on?now/260:0;R(Math.round(p[0]+Math.cos(ang)*4)-1,Math.round(p[1]+Math.sin(ang)*2)-1,2,2,'#ffb347');}
  R(m[0]-3,m[1]-4,6,7,'#3a3646');for(let k=0;k<3;k++)R(m[0]-2+k*2,m[1]-3,1,5,['#43d9e8','#ff4fa3','#ffd84a'][k]);
  // fone e notebook
  const n=up(S(gx+.5,gy+.3),top);poly([[n[0]-7,n[1]],[n[0]+7,n[1]],[n[0]+5,n[1]-9],[n[0]-5,n[1]-9]],'#b9bec6');R(n[0]-4,n[1]-8,8,6,MUSIC.on?'#7fe7ff':'#3a4050');
  if(MUSIC.on){for(let k=0;k<2;k++){const ph=((now/900)+k*.5)%1;ctx.globalAlpha=1-ph;ctx.fillStyle='#ffd84a';ctx.font='700 9px Anybody, sans-serif';ctx.fillText('♪',m[0]-6+k*10,m[1]-14-ph*24);}ctx.globalAlpha=1;}
});glowA(gx+.5,gy+.5,30,22,'#7fe7ff',.35,1);}
/* fogueira com toras pra sentar em volta */
function campfire(gx,gy,ring){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);ell(c[0],c[1],15,7.5,'#5a5048');ell(c[0],c[1]-1,12,6,'#3a302a');
  for(let k=0;k<6;k++){const a=k/6*Math.PI*2;ell(c[0]+Math.cos(a)*13,c[1]+Math.sin(a)*6.5,3.5,2.5,'#8a8278');}
  poly([[c[0]-9,c[1]+1],[c[0]+7,c[1]-5],[c[0]+9,c[1]-2],[c[0]-7,c[1]+4]],'#6e4a32');poly([[c[0]-8,c[1]-5],[c[0]+8,c[1]+2],[c[0]+6,c[1]+4],[c[0]-9,c[1]-2]],'#5a3b28');
  const t=now/90;for(let k=0;k<6;k++){const h=14+8*Math.abs(Math.sin(t*.13+k*1.7)),x=c[0]-8+k*3.2;poly([[x-3,c[1]-2],[x+3,c[1]-2],[x+Math.sin(t*.2+k)*2,c[1]-2-h]],k%2?'#ff9a3a':'#ffd24a');}
  poly([[c[0]-3,c[1]-2],[c[0]+3,c[1]-2],[c[0],c[1]-12-4*Math.abs(Math.sin(t*.17))]],'#fff3b0');
  for(let k=0;k<4;k++){const ph=((now/1400)+k/4)%1;ctx.globalAlpha=(1-ph)*.9;R(Math.round(c[0]+Math.sin(ph*9+k)*8),Math.round(c[1]-20-ph*50),2,2,'#ffb347');}ctx.globalAlpha=1;});
  glowG(gx+.5,gy+.5,150,'#ff8a3a',.4,1);glowA(gx+.5,gy+.5,18,40,'#ffb347',.5,1);
  if(ring)ring.forEach(([x,y,f])=>logSeat(x,y,f));}
function logSeat(gx,gy,face){seatAt(gx,gy,face,1);addF(gx,gy,()=>{const c=S(gx+.5,gy+.5),vert=face==='x'||face==='nx';
  if(vert){box(gx+.3,gy+.1,.4,.8,18,0,'#9a6a44','#7a5234','#6a4630');const e=up(S(gx+.5,gy+.9),9);ell(e[0],e[1],6,8,'#c99a6a');ell(e[0],e[1],3,4,'#b07a4a');}
  else{box(gx+.1,gy+.3,.8,.4,18,0,'#9a6a44','#7a5234','#6a4630');const e=up(S(gx+.9,gy+.5),9);ell(e[0],e[1],6,8,'#c99a6a');ell(e[0],e[1],3,4,'#b07a4a');}},{block:false,dz:-.01});}
function rock(gx,gy,big,col){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5),C=col||'#6a6460',s=big?1.5:1;
  poly([[c[0]-16*s,c[1]],[c[0]-12*s,c[1]-14*s],[c[0]-2*s,c[1]-20*s],[c[0]+10*s,c[1]-16*s],[c[0]+16*s,c[1]-2*s],[c[0]+6*s,c[1]+6*s],[c[0]-8*s,c[1]+6*s]],mul(C,.8));
  poly([[c[0]-12*s,c[1]-14*s],[c[0]-2*s,c[1]-20*s],[c[0]+10*s,c[1]-16*s],[c[0]+2*s,c[1]-8*s],[c[0]-10*s,c[1]-6*s]],lt(C));
  poly([[c[0]+2*s,c[1]-8*s],[c[0]+10*s,c[1]-16*s],[c[0]+16*s,c[1]-2*s],[c[0]+6*s,c[1]+6*s]],mul(C,.62));},{block:!!big});if(!big)seatAt(gx,gy,'y',1);}
function torch(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);R(c[0]-2,c[1]-70,4,70,'#7a5234');R(c[0]-2,c[1]-70,1,70,'#9a6a44');for(let k=0;k<4;k++)R(c[0]-3,c[1]-60+k*12,6,2,'#4a3020');
  R(c[0]-5,c[1]-80,10,10,'#5a3b28');const t=now/80;poly([[c[0]-5,c[1]-80],[c[0]+5,c[1]-80],[c[0]+Math.sin(t*.2)*3,c[1]-96-4*Math.abs(Math.sin(t*.15))]],'#ffb347');poly([[c[0]-2,c[1]-80],[c[0]+2,c[1]-80],[c[0],c[1]-89]],'#fff1b0');});
  glowG(gx+.5,gy+.5,70,'#ff9a3a',.25,1);glowA(gx+.5,gy+.5,86,30,'#ffb347',.55,1);}
function palm(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5),r=rng(gx*9+gy*5);let x=c[0],y=c[1];const lean=(r()-.5)*1.4;
  for(let k=0;k<14;k++){R(Math.round(x)-3,Math.round(y)-8,7,8,k%2?'#8a6a48':'#a07e58');R(Math.round(x)-3,Math.round(y)-8,7,1,'#6a5038');x+=lean*k*.18;y-=8;}
  const tx=x,ty=y;[[-1,0],[1,0],[-.7,-.5],[.7,-.5],[0,-.8],[-.9,.4],[.9,.4]].forEach(([dx,dy],i)=>{ctx.strokeStyle=i%2?'#2f8a4a':'#3fa85a';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(tx,ty);ctx.quadraticCurveTo(tx+dx*26,ty+dy*20-14,tx+dx*44,ty+dy*30+8);ctx.stroke();
    ctx.strokeStyle='#5ac06a';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(tx,ty-1);ctx.quadraticCurveTo(tx+dx*26,ty+dy*20-15,tx+dx*42,ty+dy*30+6);ctx.stroke();});
  circ(tx-3,ty+3,3.5,'#6a4a2a');circ(tx+3,ty+4,3.5,'#5a3e22');});}
function sakura(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5),cr=rng(gx*13+gy*7+5);poly([[c[0]-5,c[1]],[c[0]+5,c[1]],[c[0]+2,c[1]-70],[c[0]-4,c[1]-72]],'#4a3030');
  ctx.strokeStyle='#4a3030';ctx.lineWidth=3;[[-26,-96],[24,-102],[-6,-112]].forEach(([dx,dy])=>{ctx.beginPath();ctx.moveTo(c[0],c[1]-60);ctx.lineTo(c[0]+dx,c[1]+dy);ctx.stroke();});
  const cx=c[0],cy=c[1]-112,P=['#d77aa0','#f2a5c4','#ffd0e2','#fff0f6'];const bl=[];for(let i=0;i<24;i++){const a=cr()*Math.PI*2,d=Math.sqrt(cr())*40;bl.push([cx+Math.cos(a)*d*1.3,cy+Math.sin(a)*d*.75,10+cr()*8]);}
  bl.forEach(([x,y,r])=>circ(x,y+3,r+1,P[0]));bl.forEach(([x,y,r])=>circ(x,y,r,P[1]));bl.forEach(([x,y,r])=>circ(x+2,y-3,r*.6,P[2]));bl.forEach(([x,y,r])=>circ(x+3,y-5,r*.25,P[3]));});
  B.air.push(()=>{const c=S(gx+.5,gy+.5),r=rng(gx+gy*3);for(let k=0;k<10;k++){const ph=((now/(5200+k*300))+r())%1,x=c[0]-50+r()*100+Math.sin(ph*8+k)*12,y=c[1]-120+ph*130;ctx.globalAlpha=1-ph*.6;R(Math.round(x),Math.round(y),3,2,'#ffc6dc');}ctx.globalAlpha=1;});}
function bamboo(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5),r=rng(gx*3+gy*17);for(let k=0;k<5;k++){const x=c[0]-14+k*7+r()*3,h=90+r()*50;for(let y=0;y<h;y+=14){R(Math.round(x),Math.round(c[1]-y-13),4,13,k%2?'#5a9a4a':'#6ab05a');R(Math.round(x),Math.round(c[1]-y-14),4,1,'#3a6a32');}
  ctx.strokeStyle='#4a8a3a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+2,c[1]-h);ctx.lineTo(x+14,c[1]-h-6);ctx.stroke();ell(x+14,c[1]-h-6,7,2,'#5aa04a');}});}
function stoneLantern(gx,gy){addF(gx,gy,()=>{bx(gx+.32,gy+.32,.36,.36,10,0,'#8a8680');bx(gx+.4,gy+.4,.2,.2,18,10,'#9a968e');box(gx+.25,gy+.25,.5,.5,12,28,'#a6a29a','#8a8680','#7a766e');
  const D=S(gx+.25,gy+.75);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);R(5,-38,8,7,SCN&&SCN.night?'#ffd890':'#4a4640');ctx.restore();
  const t=up(S(gx+.5,gy+.5),40);poly([[t[0]-22,t[1]+4],[t[0],t[1]-6],[t[0]+22,t[1]+4],[t[0],t[1]+14]],'#6a665e');poly([[t[0]-6,t[1]-2],[t[0],t[1]-12],[t[0]+6,t[1]-2]],'#7a766e');});
  glowG(gx+.5,gy+.5,60,'#ffd890',.25);glowA(gx+.5,gy+.5,36,22,'#ffe2a0',.5);}
function torii(gx,gy,len){addF(gx,gy,()=>{const L=len||2;const a=S(gx+.5,gy+.5),b=S(gx+.5+L,gy+.5);
  [a,b].forEach(p=>{R(p[0]-4,p[1]-120,8,120,'#c8352c');R(p[0]-4,p[1]-120,2,120,'#e04a3e');R(p[0]-6,p[1]-6,12,6,'#2a2420');});
  const t1=up(a,128),t2=up(b,128);poly([[t1[0]-20,t1[1]-4],[t2[0]+20,t2[1]-4],[t2[0]+22,t2[1]-14],[t1[0]-22,t1[1]-14]],'#2a2420');poly([[t1[0]-16,t1[1]+4],[t2[0]+16,t2[1]+4],[t2[0]+16,t2[1]-4],[t1[0]-16,t1[1]-4]],'#c8352c');
  const m1=up(a,104),m2=up(b,104);poly([[m1[0]-10,m1[1]+3],[m2[0]+10,m2[1]+3],[m2[0]+10,m2[1]-3],[m1[0]-10,m1[1]-3]],'#c8352c');},{dz:.6});B.blocked.add(key(gx,gy));B.blocked.add(key(gx+(len||2),gy));}
function bridge(x0,y,len){for(let i=0;i<len;i++){const gx=x0+i;B.blocked.delete(key(gx,y));B.bridge=B.bridge||new Set();B.bridge.add(key(gx,y));}
  B.ground.push(()=>{const arch=t=>Math.sin(t*Math.PI)*14;for(let i=0;i<len*4;i++){const t=i/(len*4),t2=(i+1)/(len*4),fx=x0+t*len,fx2=x0+t2*len;
    poly([up(S(fx,y+.1),arch(t)),up(S(fx2,y+.1),arch(t2)),up(S(fx2,y+.9),arch(t2)),up(S(fx,y+.9),arch(t))],i%2?'#b5403a':'#c8483e','rgba(60,20,20,.4)');}
    for(const side of[.08,.92])for(let i=0;i<=len*2;i++){const t=i/(len*2),p=up(S(x0+t*len,y+side),arch(t));R(p[0]-1,p[1]-14,3,14,'#e05a4e');}
    for(const side of[.08,.92]){ctx.strokeStyle='#e05a4e';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<=20;i++){const t=i/20,p=up(S(x0+t*len,y+side),arch(t)+14);i?ctx.lineTo(...p):ctx.moveTo(...p);}ctx.stroke();}});}
function koi(){B.ground.push(()=>{for(const W of SCN.water){if(W.kind!=='koi')continue;const r=rng(W.x0*7+W.y0);for(let k=0;k<5;k++){const sp=.00025+r()*.0002,ph=r()*6,t=now*sp+ph;
  const fx=W.x0+W.w/2+Math.cos(t)*(W.w/2-.6),fy=W.y0+W.d/2+Math.sin(t*1.3)*(W.d/2-.6),[x,y]=S(fx,fy),dx=-Math.sin(t)*(W.w/2-.6),dy=Math.cos(t*1.3)*1.3*(W.d/2-.6),[vx,vy]=[(dx-dy)*32,(dx+dy)*16],L=Math.hypot(vx,vy)||1,ux=vx/L,uy=vy/L;
  const col=['#ff7a2a','#f2efe9','#ffb347','#e8433a','#f2efe9'][k];for(let s=0;s<6;s++){const w=s<2?3:s<4?2:1;R(Math.round(x-ux*s*2.2)-1,Math.round(y-uy*s*2.2)-1,w+1,w,s===2&&k%2?'#e8433a':col);}
  R(Math.round(x-ux*13),Math.round(y-uy*13)-1,3,2,col);}}});}
function zabuton(gx,gy,col){B.seats.set(key(gx,gy),{...FACES.y,kind:2});addF(gx,gy,()=>{box(gx+.15,gy+.15,.7,.7,5,0,lt(col),mul(col,.82),mul(col,.68));const c=up(S(gx+.5,gy+.5),5);R(c[0]-1,c[1]-1,2,2,mul(col,.6));},{block:false,dz:-.02});}
function lowTable(gx,gy,items){addF(gx,gy,()=>{bx(gx+.15,gy+.2,.7,.6,12,0,'#5a3424');box(gx+.1,gy+.15,.8,.7,3,12,'#7a4a32','#5a3424','#4a2a1c');(items||[]).forEach(it=>drawItem(it,15));});}
function pagoda(){/* templo ao fundo, nas paredes */
  onA(0,()=>{const n=night();R(40,-150,300,150,'#efe4cc');for(let i=0;i<5;i++){R(52+i*58,-140,46,110,n?'#f0c070':'#e8dcc0');R(52+i*58,-140,46,110,'rgba(0,0,0,0)');ctx.fillStyle='rgba(90,60,40,.55)';for(let x=0;x<46;x+=9)ctx.fillRect(52+i*58+x,-140,1,110);for(let y=0;y<110;y+=12)ctx.fillRect(52+i*58,-140+y,46,1);}
    R(30,-30,320,30,'#5a3424');R(30,-34,320,4,'#3a2014');
    poly([[10,-150],[370,-150],[350,-176],[30,-176]],'#3a3a44');poly([[30,-176],[350,-176],[330,-196],[50,-196]],'#4a4a56');R(10,-152,360,4,'#2a2a30');});
  onB(GH,()=>{R(0,-120,GH*32,120,'#d8cdb4');ctx.fillStyle='rgba(90,70,50,.25)';for(let x=0;x<GH*32;x+=24)ctx.fillRect(x,-120,3,120);R(0,-124,GH*32,6,'#5a3424');});}
function volcanoBack(){/* vulcão gigante ao fundo, atrás do canto de trás */
  const top=S(0,0),bx_=top[0],by=top[1];
  poly([[bx_-420,by+60],[bx_-90,by-250],[bx_-40,by-262],[bx_+30,by-258],[bx_+90,by-240],[bx_+430,by+60]],'#3a2e2c');
  poly([[bx_-90,by-250],[bx_-40,by-262],[bx_+30,by-258],[bx_+90,by-240],[bx_+20,by-150],[bx_-60,by-170]],'#4a3a36');
  for(let k=0;k<4;k++){const x=bx_-60+k*38;poly([[x,by-250+k*2],[x+10,by-252],[x+30-k*6,by-100+k*20],[x+16,by-110+k*20]],'#ff6a2a');poly([[x+4,by-248],[x+8,by-250],[x+18,by-160+k*18],[x+12,by-164+k*18]],'#ffc24a');}
  poly([[bx_-300,by+60],[bx_-140,by-60],[bx_-60,by+10],[bx_+40,by-30],[bx_+150,by-80],[bx_+300,by+60]],'#2a2220');}
function lavaRiver(cells){cells.forEach(([x,y])=>{B.blocked.add(key(x,y));B.lava=B.lava||[];B.lava.push([x,y]);});
  B.ground.push(()=>{for(const[x,y]of SCN.lava||[]){poly([S(x,y),S(x+1,y),S(x+1,y+1),S(x,y+1)],'#c2341a');const r=rng(x*7+y*3);
    for(let k=0;k<6;k++){const ph=(now/2400+r())%1,fx=x+((r()+ph*.6)%1),fy=y+r(),[px,py]=S(fx,fy);R(Math.round(px)-3,Math.round(py)-1,7,2,ph<.5?'#ffb347':'#ff7a2a');}
    if(!SCN.bridge||!SCN.bridge.has(key(x,y)))for(let k=0;k<2;k++){const ph=(now/1600+r())%1,[px,py]=S(x+r(),y+r());ctx.globalAlpha=1-ph;circ(px,py-ph*18,2+ph*3,'#ffd24a');}ctx.globalAlpha=1;}});
  cells.forEach(([x,y],i)=>{if(i%2===0)glowG(x+.5,y+.5,70,'#ff6a2a',.3,1);});}
function smoke(fx,fy,h,col){B.air.push(()=>{const[x,y]=up(S(fx,fy),h);for(let k=0;k<7;k++){const ph=((now/4000)+k/7)%1;ctx.globalAlpha=.35*(1-ph);circ(x+Math.sin(ph*4+k)*20+ph*40,y-ph*160,10+ph*30,col||'#8a7a76');}ctx.globalAlpha=1;});}
function tikiHead(gx,gy){addF(gx,gy,()=>{bx(gx+.25,gy+.25,.5,.5,60,0,'#8a5a34');const D=S(gx+.25,gy+.75);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);
  R(3,-52,10,4,'#3a2414');R(3,-44,4,4,'#ffd24a');R(9,-44,4,4,'#ffd24a');R(5,-34,6,8,'#3a2414');R(2,-22,12,3,'#3a2414');ctx.restore();});}
function hammock(x0,y,len){for(let i=0;i<len;i++)B.seats.set(key(x0+i,y),{...FACES.y,kind:2});
  addF(x0+len-1,y,()=>{const a=S(x0,y+.5),b=S(x0+len,y+.5);[a,b].forEach(p=>{R(p[0]-2,p[1]-70,5,70,'#7a5234');});
    ctx.strokeStyle='#e8d8b0';ctx.lineWidth=1;const sag=22;for(let k=0;k<6;k++){ctx.beginPath();for(let i=0;i<=16;i++){const t=i/16,x=a[0]+(b[0]-a[0])*t,y=a[1]-52+(b[1]-a[1])*t+Math.sin(t*Math.PI)*sag+k*2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
    ctx.lineWidth=10;ctx.strokeStyle='#e86a4a';ctx.beginPath();for(let i=2;i<=14;i++){const t=i/16,x=a[0]+(b[0]-a[0])*t,y=a[1]-46+(b[1]-a[1])*t+Math.sin(t*Math.PI)*sag;i>2?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    ctx.lineWidth=2;ctx.strokeStyle='#ffd24a';ctx.beginPath();for(let i=2;i<=14;i++){const t=i/16,x=a[0]+(b[0]-a[0])*t,y=a[1]-46+(b[1]-a[1])*t+Math.sin(t*Math.PI)*sag-2;i>2?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();},{block:false,dz:.4});}
function porch(depth,h){/* varanda: telhado com caibros e pilares, desenhado no ar */
  B.air.push(()=>{const p1=up(S(0,depth),h),p2=up(S(GW,depth),h),q1=up(S(0,0),h+30),q2=up(S(GW,0),h+30);
    poly([q1,q2,p2,p1],'#a2523a');for(let i=0;i<=12;i++){const t=i/12;ctx.strokeStyle='rgba(60,20,10,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q1[0]+(q2[0]-q1[0])*t,q1[1]+(q2[1]-q1[1])*t);ctx.lineTo(p1[0]+(p2[0]-p1[0])*t,p1[1]+(p2[1]-p1[1])*t);ctx.stroke();}
    poly([p1,p2,[p2[0],p2[1]+6],[p1[0],p1[1]+6]],'#6e3a28');});
  for(let gx=1;gx<GW;gx+=4)addF(gx,depth,()=>{const c=S(gx,depth+.02);R(c[0]-3,c[1]-h,6,h,'#efe6d4');R(c[0]-3,c[1]-h,2,h,'#fffaf0');R(c[0]-5,c[1]-8,10,8,'#c9bfa8');},{block:false,dz:.3});}
function pergola(depth,h){B.air.push(()=>{for(let i=0;i<=24;i++){const fx=i/2,a=up(S(fx,0),h+20),b=up(S(fx,depth),h);poly([[a[0]-2,a[1]],[a[0]+2,a[1]],[b[0]+2,b[1]],[b[0]-2,b[1]]],i%2?'#8a5e38':'#9a6a44');}
    const p1=up(S(0,depth),h),p2=up(S(GW,depth),h);poly([p1,p2,[p2[0],p2[1]+6],[p1[0],p1[1]+6]],'#6e4a2a');
    const r=rng(9);for(let k=0;k<40;k++){const t=r(),fx=t*GW,fy=r()*depth,p=up(S(fx,fy),h+(1-fy/depth)*20+2);circ(p[0],p[1],3+r()*3,r()<.5?'#3f8a46':'#5aa858');if(r()<.25)circ(p[0]+2,p[1]-2,1.6,'#ff8fc7');}});
  for(let gx=1;gx<GW;gx+=4)addF(gx,depth,()=>{const c=S(gx,depth+.02);R(c[0]-3,c[1]-h,6,h,'#8a5e38');R(c[0]-3,c[1]-h,2,h,'#a8784a');},{block:false,dz:.3});}
function houseWall(c,H,opts={}){/* parede de casa com janelas e porta no fundo (A) */
  box(-.25,-.25,GW+.25,.25,H,0,'#6a4e44',c,mul(c,.86));
  onA(0,()=>{const n=night();R(0,-10,GW*32,10,mul(c,.6));for(let y=-H+8;y<-10;y+=8){ctx.fillStyle='rgba(0,0,0,.05)';ctx.fillRect(0,y,GW*32,1);}
    win(30,-100,44,54,n?'lit':'day');win(280,-100,44,54,n?'lit':'day');
    R(150,-120,70,120,'#5a3a2a');R(154,-116,62,116,'#7a4e36');R(158,-112,26,50,'#8a5a40');R(188,-112,24,50,'#8a5a40');R(206,-60,4,4,'#e3b84a');
    if(opts.sign){R(110,-H+12,140,22,'#c23b3b');ctx.font='700 11px Anybody, sans-serif';ctx.textBaseline='middle';ctx.fillStyle='#fff3d0';ctx.fillText(opts.sign,118,-H+23);}});}
function planter(gx,gy,flowers){addF(gx,gy,()=>{box(gx+.08,gy+.25,.84,.5,12,0,'#a2523a','#7a3a28','#6a3020');const r=rng(gx*3+gy);
  for(let k=0;k<9;k++){const[x,y]=up(S(gx+.15+r()*.7,gy+.32+r()*.36),12);R(Math.round(x),Math.round(y)-6,2,6,'#3f8a46');R(Math.round(x)-1,Math.round(y)-8,4,3,flowers?['#ff8fc7','#ffe27a','#ff6a5a','#c49bff'][k%4]:'#5ab05a');}});}
function crates(gx,gy){addF(gx,gy,()=>{for(let k=0;k<3;k++){box(gx+.15,gy+.2,.7,.6,14,k*14,'#e8c03a','#c09a2a','#a88624');const t=up(S(gx+.5,gy+.5),k*14+14);for(let i=0;i<6;i++)circ(t[0]-10+(i%3)*10,t[1]-2+Math.floor(i/3)*4,2.4,'#6a3a14');}});}
function ceilingFan(fx,fy,h){B.air.push(()=>{const[x,y]=up(S(fx,fy),h);R(x-1,y-20,2,20,'#4a4040');ell(x,y,5,3,'#6a5a50');const a=now/90;for(let k=0;k<3;k++){const an=a+k*2.09;poly([[x,y],[x+Math.cos(an)*30,y+Math.sin(an)*8],[x+Math.cos(an+.25)*30,y+Math.sin(an+.25)*8]],'#8a6a50');}});}
function foodCase(gx,gy){addF(gx,gy,()=>{bx(gx+.05,gy+.15,.9,.7,22,0,'#d8d2c4');box(gx+.08,gy+.2,.84,.6,18,22,'rgba(210,240,255,.45)','rgba(180,220,240,.5)','rgba(170,210,230,.5)');
  for(let k=0;k<6;k++){const[x,y]=up(S(gx+.2+(k%3)*.28,gy+.35+Math.floor(k/3)*.3),24);ell(x,y,4,2.5,['#d89a4a','#c27a3a','#e8b860'][k%3]);}
  const t=up(S(gx+.5,gy+.5),40);R(t[0]-12,t[1]-2,24,2,'#c23b3b');});glowG(gx+.5,gy+.6,50,'#ffe2a0',.25);}
function chalkboard(){/* lousa de preços no B */}
function foodTruck(gx,gy){[[gx,gy],[gx+1,gy]].forEach(([x,y],i)=>{B.blocked.add(key(x,y));});addF(gx+1,gy,()=>{box(gx+.05,gy+.1,1.9,.85,62,8,'#f2efe9','#e8708a','#c95a74');
  const D=S(gx+.05,gy+.95);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);R(10,-56,40,24,'#2a2630');R(12,-54,36,20,'#ffe2a0');R(6,-60,48,4,'#ffd84a');ctx.font='700 8px Anybody, sans-serif';ctx.fillStyle='#fff';ctx.fillText('AÇAÍ',16,-66);ctx.restore();
  [[gx+.4,gy+.95],[gx+1.5,gy+.95]].forEach(([fx,fy])=>{const p=S(fx,fy);circ(p[0],p[1]-5,6,'#26242b');circ(p[0],p[1]-5,2.5,'#9a9a9a');});});glowG(gx+1,gy+1.3,70,'#ffe2a0',.3);}
function iceCart(gx,gy){addF(gx,gy,()=>{bx(gx+.2,gy+.25,.6,.5,28,4,'#7fd8ff');const p=S(gx+.3,gy+.8);circ(p[0],p[1]-4,4,'#26242b');umbrellaTop(gx+.5,gy+.5,72,'#ff8fc7','#fff');});}
function umbrellaTop(fx,fy,h,c1,c2){const c=up(S(fx,fy),0);R(c[0]-1,c[1]-h,2,h-10,'#e8e2d4');for(let k=0;k<8;k++){const a0=k/8*Math.PI*2,a1=(k+1)/8*Math.PI*2;poly([[c[0],c[1]-h-12],[c[0]+Math.cos(a0)*26,c[1]-h+Math.sin(a0)*10],[c[0]+Math.cos(a1)*26,c[1]-h+Math.sin(a1)*10]],k%2?c1:c2);}}
function picnicTable(gx,gy){/* mesa com bancos (senta dos dois lados) */
  B.blocked.add(key(gx,gy));seatAt(gx,gy-1,'y',1);seatAt(gx,gy+1,'ny',1);
  addF(gx,gy,()=>{bx(gx+.1,gy+.15,.8,.7,22,0,'#a87a4e');box(gx+.05,gy+.1,.9,.8,3,22,'#c9965e','#9a6a40','#8a5e38');drawItem([gx+.4,gy+.4,'prato','#c96a3a'],25);drawItem([gx+.65,gy+.55,'copo','#ff8fc7'],25);});
  [[gx,gy-1],[gx,gy+1]].forEach(([x,y])=>addF(x,y,()=>{bx(x+.08,y+.35,.84,.3,12,0,'#a87a4e');},{block:false,dz:-.01}));}
function poolFloat(fx,fy,kind){B.ground.push(()=>{const t=now/1200,[x,y]=S(fx+Math.sin(t)*.15,fy+Math.cos(t*.8)*.15);
  if(kind==='donut'){ell(x,y+2,16,8,'rgba(0,40,80,.25)');ell(x,y,15,7.5,'#ff8fc7');ell(x,y-1,6,3,'#4fb6e8');for(let k=0;k<6;k++)R(Math.round(x-10+k*4),Math.round(y-4+(k%2)*5),2,1,['#ffd84a','#7fe7ff','#fff'][k%3]);}
  else{ell(x,y,16,7,'#ff7fb0');ell(x-3,y-2,10,4,'#ffa0c8');R(Math.round(x+8),Math.round(y-22),4,20,'#ff7fb0');ell(x+11,y-24,5,4,'#ff7fb0');R(Math.round(x+14),Math.round(y-25),4,2,'#2a2630');}});}
function surfboard(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);poly([[c[0]-5,c[1]],[c[0]+5,c[1]],[c[0]+6,c[1]-50],[c[0],c[1]-66],[c[0]-6,c[1]-50]],'#7fe7ff');R(Math.round(c[0])-1,c[1]-60,2,58,'#ff8fc7');});}
function beachChair(gx,gy,face,col){seatAt(gx,gy,face,1);addF(gx,gy,()=>{const C=col||'#ff7a5a';const st=(i)=>i%2?C:'#f2efe9';
  if(face==='ny'){bx(gx+.2,gy+.15,.6,.7,10,0,'#c9a06a');for(let i=0;i<4;i++)box(gx+.22+i*.14,gy+.18,.14,.64,2,10,st(i),mul(st(i),.85),mul(st(i),.7));box(gx+.22,gy+.7,.56,.12,22,10,C,mul(C,.85),mul(C,.7));}
  else{bx(gx+.15,gy+.2,.7,.6,10,0,'#c9a06a');for(let i=0;i<4;i++)box(gx+.18,gy+.22+i*.14,.64,.14,2,10,st(i),mul(st(i),.85),mul(st(i),.7));box(gx+.18,gy+.22,.12,.56,22,10,C,mul(C,.85),mul(C,.7));}},{block:false,dz:-.01});}
function drinkHut(gx,gy){[[gx,gy],[gx+1,gy]].forEach(([x,y])=>B.blocked.add(key(x,y)));addF(gx+1,gy,()=>{box(gx+.05,gy+.2,1.9,.6,34,0,'#a87a4e','#8a5e38','#7a5230');
  const D=S(gx+.05,gy+.8);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);for(let i=0;i<8;i++)R(4+i*7,-34,2,34,'#7a5230');ctx.restore();
  for(let k=0;k<4;k++)drawItem([gx+.3+k*.4,gy+.45,'copo',['#ff8fc7','#ffd84a','#7fe7ff','#ff7a5a'][k]],34);
  [S(gx+.1,gy+.25),S(gx+1.9,gy+.25)].forEach(p=>R(p[0]-2,p[1]-96,4,96,'#7a5230'));const a=up(S(gx-.1,gy+.5),100),b=up(S(gx+2.1,gy+.5),100);
  poly([[a[0]-10,a[1]+16],[b[0]+10,b[1]+16],[b[0],b[1]-20],[a[0],a[1]-20]],'#d8b860');for(let i=0;i<14;i++){const t=i/13;R(Math.round(a[0]-10+(b[0]-a[0]+20)*t),Math.round(a[1]+12+(b[1]-a[1])*t),3,10,'#c9a050');}});}
function sea(){B.ground.push(()=>{const t=now/700;for(let y=0;y<GH;y++){const p=S(GW,y),q=S(GW,y+1);poly([p,q,[q[0]+260,q[1]+130],[p[0]+260,p[1]+130]],'#2f86b8');}
    for(let k=0;k<5;k++){const off=((t*.4+k*.2)%1);const a=S(GW-.15+off*1.6,0),b=S(GW-.15+off*1.6,GH);ctx.globalAlpha=1-off;ctx.strokeStyle='#dff3ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}ctx.globalAlpha=1;
    const w1=S(GW-.05,0),w2=S(GW-.05,GH);ctx.strokeStyle='#f2fbff';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<=40;i++){const tt=i/40,x=w1[0]+(w2[0]-w1[0])*tt,y=w1[1]+(w2[1]-w1[1])*tt+Math.sin(tt*30+now/300)*1.5;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();});}
function skyline(){onA(0,()=>{});const base=S(0,0);const r=rng(21),n=night();
  for(let k=0;k<16;k++){const w=30+r()*40,h=80+r()*220,x=base[0]-420+k*56+r()*10,y=base[1]+40-k*0;R(Math.round(x),Math.round(y-h),Math.round(w),Math.round(h),['#3a4258','#2e3448','#444c66'][k%3]);
    for(let wy=y-h+8;wy<y-6;wy+=10)for(let wx=x+5;wx<x+w-6;wx+=8)if(r()<.55)R(Math.round(wx),Math.round(wy),4,5,n?(r()<.7?'#ffd890':'#7fe7ff'):'#9cb4cc');}}
function glassRail(){box(-.15,-.15,GW+.15,.15,30,0,'rgba(200,230,255,.35)','rgba(180,220,250,.35)','rgba(160,200,240,.35)');box(-.15,0,.15,GH,30,0,'rgba(200,230,255,.35)','rgba(180,220,250,.35)','rgba(160,200,240,.35)');
  ctx.strokeStyle='#cfd6e0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...up(S(0,GH),30));ctx.lineTo(...up(S(0,0),30));ctx.lineTo(...up(S(GW,0),30));ctx.stroke();}
function jacuzzi(x0,y0){water(x0,y0,2,2,'jacuzzi');B.ground.push(()=>{const c=S(x0+1,y0+1);for(let k=0;k<12;k++){const ph=((now/900)+k/12)%1,a=k*2.4;ctx.globalAlpha=1-ph;circ(c[0]+Math.cos(a)*22*ph,c[1]+Math.sin(a)*11*ph-ph*4,2,'#ffffff');}ctx.globalAlpha=1;});glowG(x0+1,y0+1,90,'#7fe7ff',.3);}
function pouf(gx,gy,col){B.seats.set(key(gx,gy),{...FACES.y,kind:1});addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);R(c[0]-12,c[1]-16,24,16,mul(col,.8));ell(c[0],c[1],12,6,mul(col,.7));ell(c[0],c[1]-16,12,6,lt(col));},{block:false,dz:-.01});}
function neonSign(wall,pos,h,text,col){B.air.push(()=>{const fn=wall==='A'?onA:onB;fn(wall==='A'?0:GH,()=>{ctx.save();ctx.font='700 16px Anybody, sans-serif';ctx.textBaseline='middle';ctx.shadowColor=col;ctx.shadowBlur=12;ctx.fillStyle=col;ctx.globalAlpha=.8+.2*beatPulse;ctx.fillText(text,pos,-h);ctx.restore();});});}
function telescope(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);ctx.strokeStyle='#3a3646';ctx.lineWidth=2;[[-8,0],[8,0],[0,6]].forEach(([dx,dy])=>{ctx.beginPath();ctx.moveTo(c[0],c[1]-30);ctx.lineTo(c[0]+dx,c[1]+dy);ctx.stroke();});
  ctx.save();ctx.translate(c[0],c[1]-34);ctx.rotate(-.6);R(-14,-4,30,8,'#e8e2d4');R(-16,-5,6,10,'#3a3646');ctx.restore();});}
function bookshelf(gx,gy){addF(gx,gy,()=>{box(gx+.1,gy+.2,.8,.6,80,0,'#7a5236','#5a3a26','#4a3020');const D=S(gx+.1,gy+.8);ctx.save();ctx.transform(1,.5,0,1,D[0],D[1]);
  for(let s=0;s<4;s++){R(2,-76+s*19,22,1,'#3a2416');for(let b=0;b<6;b++)R(3+b*3.5,-74+s*19,3,15,['#c23b3b','#3f62c4','#f0c24a','#3d8f78','#e8708a','#efe6d4'][(b+s)%6]);}ctx.restore();});}
function floorLamp(gx,gy){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);ell(c[0],c[1],8,4,'#3a3646');R(c[0]-1,c[1]-80,2,80,'#3a3646');poly([[c[0]-12,c[1]-78],[c[0]+12,c[1]-78],[c[0]+8,c[1]-96],[c[0]-8,c[1]-96]],'#f3e2b8');},{block:false});
  glowG(gx+.5,gy+.5,90,'#ffd890',.3);glowA(gx+.5,gy+.5,86,30,'#ffe2a0',.5);}
function rug(x0,y0,w,d,c1,c2,seats){B.ground.push(()=>{for(let i=0;i<w*3;i++)for(let j=0;j<d*3;j++){const fx=x0+.05+i*(w-.1)/(w*3),fy=y0+.05+j*(d-.1)/(d*3),s1=(w-.1)/(w*3),s2=(d-.1)/(d*3);poly([S(fx,fy),S(fx+s1,fy),S(fx+s1,fy+s2),S(fx,fy+s2)],((i+j)%2||(i%3===1&&j%3===1))?c1:c2);}});
  if(seats)for(let i=0;i<w;i++)for(let j=0;j<d;j++)B.seats.set(key(x0+i,y0+j),{...FACES.y,kind:2,soft:true});}
function tent(gx,gy){addF(gx,gy,()=>{const a=S(gx,gy+.5),b=S(gx+1,gy+.5),c=S(gx+.5,gy);const tp=up(S(gx+.5,gy+.5),70);
  poly([up(S(gx+.05,gy+.95),0),up(S(gx+.95,gy+.95),0),tp],'#f2efe9');poly([up(S(gx+.95,gy+.95),0),up(S(gx+.95,gy+.05),0),tp],'#d8d2c4');
  poly([up(S(gx+.35,gy+.95),0),up(S(gx+.65,gy+.95),0),up(S(gx+.5,gy+.95),40)],'#3a2a4a');
  for(let k=0;k<8;k++){const t=k/8,p=[S(gx+.05,gy+.95)[0]+(tp[0]-S(gx+.05,gy+.95)[0])*t,S(gx+.05,gy+.95)[1]+(tp[1]-S(gx+.05,gy+.95)[1])*t];R(Math.round(p[0]),Math.round(p[1]),2,2,SCN&&SCN.night?['#ffd84a','#ff8fc7','#7fe7ff'][k%3]:'#e8e4d8');}});}
function poster(wall,x,y,w,h,c1,c2){/* usado dentro de onA/onB */R(x,y,w,h,c1);R(x+3,y+3,w-6,h-6,c2);}
function vaso(gx,gy,big){addF(gx,gy,()=>{const c=S(gx+.5,gy+.5);poly([[c[0]-9,c[1]-16],[c[0]+9,c[1]-16],[c[0]+7,c[1]],[c[0]-7,c[1]]],'#c46a3d');R(c[0]-10,c[1]-18,20,3,'#a2523a');
  const r=rng(gx*7+gy);for(let k=0;k<(big?10:6);k++){const a=-Math.PI/2+(r()-.5)*2.4,L=18+r()*(big?40:20);ctx.strokeStyle=k%2?'#2f8f5b':'#3fae6e';ctx.lineWidth=big?5:4;ctx.beginPath();ctx.moveTo(c[0],c[1]-18);ctx.quadraticCurveTo(c[0]+Math.cos(a)*L*.5,c[1]-18+Math.sin(a)*L*.9,c[0]+Math.cos(a)*L,c[1]-18+Math.sin(a)*L*.7);ctx.stroke();}});}
function duckPond(){}
function swing(gx,gy){seatAt(gx,gy,'y',1);addF(gx,gy,()=>{const a=S(gx+.1,gy+.5),b=S(gx+.9,gy+.5);[a,b].forEach(p=>R(p[0]-2,p[1]-100,4,100,'#c23b3b'));const ta=up(a,100),tb=up(b,100);poly([[ta[0],ta[1]-3],[tb[0],tb[1]-3],[tb[0],tb[1]+3],[ta[0],ta[1]+3]],'#c23b3b');
  const sw=Math.sin(now/700)*4;const s1=up(S(gx+.35,gy+.5),24),s2=up(S(gx+.65,gy+.5),24);ctx.strokeStyle='#5a5a60';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(s1[0],ta[1]+2);ctx.lineTo(s1[0]+sw,s1[1]);ctx.moveTo(s2[0],tb[1]+2);ctx.lineTo(s2[0]+sw,s2[1]);ctx.stroke();R(Math.round(s1[0]+sw)-2,s1[1]-2,s2[0]-s1[0]+4,4,'#3f62c4');},{block:false,dz:-.01});}
function laser(){B.air.push(()=>{if(!SCN.night&&!SCN.sc.dark)return;ctx.save();ctx.globalCompositeOperation='lighter';const src=up(S(6,1),120);for(let k=0;k<5;k++){const a=Math.sin(now/900+k*1.3)*.9,len=520;ctx.strokeStyle=['#ff4fa3','#43d9e8','#7cff6a','#ffd84a','#ff4fa3'][k];ctx.globalAlpha=.35+.25*beatPulse;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...src);ctx.lineTo(src[0]+Math.sin(a+k)*len,src[1]+Math.cos(a)*len*.6);ctx.stroke();}ctx.restore();});}
function stage(x0,y0,w,d,h){for(let i=0;i<w;i++)for(let j=0;j<d;j++)B.blocked.add(key(x0+i,y0+j));B.ground.push(()=>{box(x0,y0,w,d,h,0,'#2a2433','#1e1a26','#18141f');
  for(let i=0;i<=w*4;i++){const p=up(S(x0+i/4,y0+d),h/2);ctx.globalAlpha=.4+.6*((i+Math.floor(now/240))%3===0?beatPulse:0);R(p[0]-1,p[1]-1,2,2,['#ff4fa3','#43d9e8','#ffd84a'][i%3]);}ctx.globalAlpha=1;});}
function boothSofa(x0,y,len,col){for(let i=0;i<len;i++)sofa(x0+i,y,'ny',col);}
function tvSoccer(){/* usado nas paredes */const n=now;R(0,0,1,1,'#000');}
