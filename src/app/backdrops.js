/* ================= cenários de fundo: a cidade lá fora, em camadas que se mexem com a câmera (paralaxe) =================
 * Cada camada é uma faixa larga desenhada uma vez (por cenário, dia ou noite) e repetida na tela com um deslocamento
 * proporcional ao movimento da câmera: o que está mais longe anda menos. 'havana' fica atrás do boteco (cidade boêmia,
 * discreta para não ofuscar o que está dentro); 'gotham' atrás do rooftop (torres de um lado a outro, vistas de cima).
 */
const BD={cache:new Map()};
const pastel=['#e8a07a','#7ac0b4','#f0d078','#d88aa8','#8aa6d8','#e8c0a0','#a8d078','#e07a6a'];

function bdLayerHavana(seed,far,night){
  const r=rng(seed),W=960,H=far?150:120,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const R_=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const dim=col=>night?mul(col,far?.3:.4):far?mix(col,'#a8c8e0',.45):col;
  let x=-10;
  while(x<W){
    const w=36+Math.floor(r()*34),h=(far?64:44)+Math.floor(r()*(far?62:46)),col=pastel[Math.floor(r()*pastel.length)],top=H-h;
    R_(x,top,w,h,'#000');R_(x+1,top+1,w-2,h-1,dim(col));R_(x+1,top+1,w-2,3,dim(lt(col)));R_(x,top-3,w,4,dim(mul(col,.8)));R_(x+3,top-5,w-6,2,dim(mul(col,.7)));   // parede, cornija e platibanda
    R_(x+1,top+1,3,h-1,night?'rgba(0,0,0,.3)':'rgba(255,255,255,.18)');
    const floors=Math.max(1,Math.floor((h-12)/22));
    for(let f=0;f<floors;f++){const y=top+8+f*22;
      for(let k=0;k<Math.floor((w-6)/14);k++){const wx=x+5+k*14,lit=night&&r()<.55;   // janelas com venezianas
        R_(wx,y,8,13,'#1c1428');R_(wx+1,y+1,6,11,lit?'#ffcf80':night?'#2a2038':far?'#9ab8d0':'#7aa0b8');
        if(!lit)for(let s=0;s<5;s++)R_(wx+1,y+2+s*2,6,1,night?'#3a3048':'rgba(255,255,255,.3)');
        R_(wx-1,y,2,13,night?'#3a2a20':'#4a7a5a');R_(wx+7,y,2,13,night?'#3a2a20':'#4a7a5a');}
      if(f===1&&r()<.7){R_(x+2,y+14,w-4,2,'#1c1428');for(let k=0;k<w-6;k+=4)R_(x+3+k,y+9,1,6,'#1c1428');}   // varanda com grade de ferro
    }
    if(r()<.4){R_(x+3,top+h-16,w-6,1,'#6a5a48');for(let k=0;k<4;k++)R_(x+6+k*8,top+h-15,4,5,night?'#3a2a20':['#f2efe9','#e86a6a','#4a8ad8'][k%3]);}   // varal
    if(r()<.3&&!far){const nc=['#ff4f9a','#43d9e8','#ffd23f'][Math.floor(r()*3)];R_(x+4,top+h-30,w-8,9,'#1c1428');R_(x+5,top+h-29,w-10,7,night?nc:mul(nc,.8));}   // letreiro de bar
    if(r()<.3){const px=x+w-10;R_(px,top-22,2,22,'#4a3020');[[-7,-6],[7,-6],[-4,-12],[4,-12]].forEach(([dx,dy])=>R_(px+dx,top-22+dy,7,2,night?'#1a4a2a':'#2f8a4a'));}   // palmeira
    x+=w+(r()<.25?10:2);
  }
  if(!far){R_(0,H-6,W,6,night?'#18141c':'#6a6070');for(let k=0;k<W;k+=80){R_(k,H-30,2,30,'#2a2630');R_(k-4,H-33,10,4,'#2a2630');R_(k-2,H-31,6,2,night?'#ffd890':'#e8e2cc');}}   // calçada e postes
  return c;
}
function bdLayerGotham(seed,depth,night){   // depth 0 = longe, 2 = perto
  const r=rng(seed),W=1100,H=[300,250,200][depth],c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const R_=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const base=night?['#262c4c','#181c38','#0e1024'][depth]:['#8a9ab8','#5a6888','#3a4660'][depth];
  let x=-10;
  while(x<W){
    const w=[34,44,56][depth]+Math.floor(r()*[30,36,44][depth]),h=[130,110,70][depth]+Math.floor(r()*[160,120,90][depth]),top=H-h;
    const col=mix(base,night?'#3a4478':'#b8c8e0',r()*.25);
    R_(x,top,w,h,'#05060c');R_(x+1,top+1,w-2,h-1,col);R_(x+1,top+1,3,h-1,night?'rgba(120,140,220,.14)':'rgba(255,255,255,.2)');
    if(depth<2&&r()<.7){const sw=Math.floor(w*.55);R_(x+(w-sw)/2,top-18,sw,19,'#05060c');R_(x+(w-sw)/2+1,top-17,sw-2,18,col);R_(x+(w-sw)/2+1,top-17,2,18,night?'rgba(120,140,220,.14)':'rgba(255,255,255,.2)');}   // recuo
    const sp=r();
    if(sp<.35){const cx=x+w/2;for(let k=0;k<22;k++)R_(cx-Math.max(1,(22-k)/5),top-18-k,Math.max(2,(22-k)/2.5),1,k<2?'#05060c':col);R_(cx,top-44,1,14,'#05060c');}   // pináculo gótico
    else if(sp<.5)R_(x+w/2,top-30,1,30,'#05060c');   // antena
    else if(depth===2&&sp<.8){R_(x+4,top-10,10,10,'#05060c');R_(x+5,top-9,8,8,mul(col,.8));R_(x+6,top-14,6,4,'#05060c');R_(x+w-12,top-6,8,6,'#05060c');R_(x+w-4,top-12,2,12,'#05060c');}   // caixa-d'água e gárgula
    const ws=[3,4,5][depth],gp=[6,7,9][depth];
    for(let wy=top+8;wy<H-6;wy+=gp)for(let wx=x+4;wx<x+w-5;wx+=gp){
      const on=r()<(night?.34:.12);
      if(on)R_(wx,wy,ws,ws+1,night?(r()<.75?'#ffcf80':'#9fd8ff'):'#cfe4ff');else if(r()<.5)R_(wx,wy,ws,ws+1,night?'rgba(5,6,14,.5)':'rgba(30,40,70,.25)');}
    x+=w+(r()<.3?[6,10,16][depth]:1);
  }
  if(depth<2){const gr=g.createLinearGradient(0,H*.45,0,H);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,night?'rgba(70,60,120,.35)':'rgba(220,230,245,.45)');g.fillStyle=gr;g.fillRect(0,H*.45,W,H*.55);}   // neblina de baixo
  return c;
}

/* camadas de cada cenário: c = faixa, par = quanto acompanha a câmera, base = onde ficam os pés (fração da altura da tela) */
function bdLayers(kind,night){
  const key=kind+(night?'N':'D');let L=BD.cache.get(key);if(L)return L;
  if(kind==='havana')L=[{c:bdLayerHavana(5,true,night),par:.05,py:.04,base:.62,k:2,a:night?.8:.72},{c:bdLayerHavana(9,false,night),par:.1,py:.07,base:.86,k:2,a:night?.9:.8}];
  else L=[{c:bdLayerGotham(3,0,night),par:.06,py:.05,base:.66,k:2,a:1},{c:bdLayerGotham(8,1,night),par:.12,py:.1,base:.84,k:2,a:1},{c:bdLayerGotham(13,2,night),par:.22,py:.18,base:1.02,k:2,a:1}];
  BD.cache.set(key,L);return L;
}
function bdDraw(kind,W,H,pxX,pxY,day,px){
  if(BD.off)return;
  const night=!day,L=bdLayers(kind,night);
  sc.save();sc.imageSmoothingEnabled=false;
  L.forEach(l=>{
    const s=Math.max(1,Math.round(l.k*px)),sw=l.c.width*s,h=l.c.height*s;
    let big=l.big&&l.big[s];   // a faixa já ampliada (feita uma vez): na tela é só copiar o pedaço visível
    if(!big){big=document.createElement('canvas');big.width=sw;big.height=h;const g=big.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(l.c,0,0,sw,h);(l.big=l.big||{})[s]=big;}
    const off=(((pxX*l.par)%sw)+sw)%sw,y=Math.round(H*l.base+pxY*l.py-h);
    if(y>=H||y+h<=0)return;
    sc.globalAlpha=l.a;
    for(let x=off-sw;x<W;x+=sw){
      const dx=Math.round(x),x0=Math.max(0,-dx),w=Math.min(sw-x0,W-Math.max(dx,0));
      if(w>0)sc.drawImage(big,x0,0,w,h,Math.max(dx,0),y,w,h);
    }
  });
  sc.globalAlpha=1;
  if(kind==='gotham'&&night){   // sinal do morcego: feixe subindo até uma nuvem, com a silhueta
    const bx=Math.round(W*.78+pxX*.12),by=Math.round(H*.2+pxY*.08),r_=Math.round(26*px*1.4);
    sc.save();sc.globalCompositeOperation='lighter';
    const gr=sc.createLinearGradient(0,H,0,by);gr.addColorStop(0,'rgba(255,246,190,.0)');gr.addColorStop(1,'rgba(255,246,190,.16)');
    sc.fillStyle=gr;sc.beginPath();sc.moveTo(bx-r_*.22,H);sc.lineTo(bx+r_*.22,H);sc.lineTo(bx+r_*.9,by);sc.lineTo(bx-r_*.9,by);sc.fill();
    sc.fillStyle='rgba(255,240,170,.22)';sc.beginPath();sc.ellipse(bx,by,r_,r_*.62,0,0,7);sc.fill();sc.restore();
    sc.fillStyle='rgba(20,16,30,.85)';const u=Math.max(1,Math.round(px));
    [[-9,0,18,3],[-4,-4,8,4],[-12,-3,4,4],[8,-3,4,4],[-6,3,3,3],[3,3,3,3],[-3,-6,2,2],[1,-6,2,2]].forEach(([a,b,w,h])=>sc.fillRect(bx+a*u,by+b*u,w*u,h*u));
  }
  sc.restore();
}
