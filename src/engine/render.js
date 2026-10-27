/* ===== montagem final ===== */
(function(AV){
const{ramp,mixc,ITENS}=AV;
const PAL={pele:{pele1:'#fbe0cc',pele2:'#f1c9ab',pele3:'#e2ae8c',pele4:'#cc9068',pele5:'#a86f4a',pele6:'#7d4f33',pele7:'#55341f'},
  cabelo:{preto:'#1d1a22',cafe:'#3b2a25',castanho:'#5f3c27',caramelo:'#8e5c35',loiro:'#d1a964',platinado:'#ece0bf',prata:'#c9cbd2',vinho:'#7e1f2e',vermelho:'#b0283a',rosa:'#ef7fb4',roxo:'#7c55c9',azul:'#3f62c4',verde:'#3d8f78',laranja:'#e0723a'},
  roupa:{preto:'#26252b',grafite:'#3b3a42',cinza:'#75737b','cinza-claro':'#b8b7bd',branco:'#ecebe6',creme:'#e8dcc0',bege:'#c8b28a',marrom:'#6b4a32',vinho:'#7a2232',vermelho:'#b8323e',rosa:'#ef86b0','rosa-bebe':'#f5bfd6',lilas:'#b49be6',roxo:'#6a3fb5','azul-bebe':'#a9d4f0',jeans:'#5f84b8','jeans-escuro':'#34507e',marinho:'#2c3f6e',turquesa:'#3fb8b0','verde-lima':'#a8d65a',militar:'#5a6440',laranja:'#ec8a3c',amarelo:'#f1cf4f',prata:'#b9bec2'}};
AV.PAL=PAL;
const SLOTS=['hair','face','top_under','top_over','bottom','shoes','neck','belt','headwear','glasses','bag'];
AV.SLOTS=SLOTS;
const itemOf=(slot,id)=>(ITENS[slot]||[]).find(i=>i.id===id);
AV.itemOf=itemOf;
const toHex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
function colorsFor(slot,v){if(!v||!Array.isArray(v))return null;const it=itemOf(slot,v[0]);if(!it)return null;const base=PAL.roupa[v[1]]||v[1]||'#26252b';
  let s2=it.sec?it.sec(base):toHex(mixc(AV.hx(base),AV.hx(base)[0]+AV.hx(base)[1]+AV.hx(base)[2]>360?[30,28,36]:[236,232,226],.55));
  if(typeof s2!=='string')s2='#f2efe9';
  const pr=AV.hx(base);const print=ramp(pr[0]+pr[1]+pr[2]>420?'#b8323e':'#c63a48');
  return{it,r1:ramp(base),r2:ramp(s2),print,print2:ramp('#d8d8d2'),alt:(v[1]||'').length};}

function render(fig,view,poseName,frame){
  const d=AV.dims(fig.g,fig.b,fig.alt||0),list=AV.POSES[poseName]||AV.POSES.idle,pose=list[(frame||0)%list.length],sk=AV.skeleton(d,pose,view);
  const hairHex=PAL.cabelo[fig.hair?fig.hair[1]:'preto']||'#1d1a22';
  const R={skin:ramp(PAL.pele[fig.pele]||PAL.pele.pele3),hair:ramp(hairHex),iris:ramp(fig.iris||'#4a3428'),brow:ramp(hairHex)[0]};
  if(AV.hx(hairHex).reduce((a,b)=>a+b)>500)R.brow=mixc(ramp(hairHex)[1],[90,70,60],.5);
  const cv=new AV.Canvas(),ops=AV.drawBody(cv,sk,fig,R);
  const C={};for(const s of SLOTS)if(s!=='hair'&&s!=='face'){C[s]=colorsFor(s,fig[s]);if(C[s])C[s].skin=R.skin;}
  const call=(slot,part,...a)=>{const c=C[slot];if(c&&c.it.draw&&c.it.draw[part])return c.it.draw[part](cv,sk,...a,c);};
  const has=(slot,part)=>C[slot]&&C[slot].it.draw&&C[slot].it.draw[part];
  const back=view==='b',hatMask=C.headwear&&C.headwear.it.mask;
  // ordem dos membros por profundidade
  const armZ=n=>(sk['el'+n][2]+sk['wr'+n][2])/2,legZ=n=>(sk['knee'+n][2]+sk['ank'+n][2])/2;
  const armsBehind=['L','R'].filter(n=>armZ(n)<-4),armsFront=['L','R'].filter(n=>armZ(n)>=-4).sort((a,b)=>armZ(a)-armZ(b));
  const legs=['L','R'].sort((a,b)=>legZ(a)-legZ(b));
  const drawArm=n=>{ops.arm(n);call('top_under','sleeve',n);call('top_over','sleeve',n);ops.hand(n);};
  if(!back&&fig.hair)AV.drawHairBack(cv,sk,R,fig.hair[0]);
  const behindBag=C.bag&&C.bag.it.behind;if(!back&&behindBag)call('bag','bag');
  armsBehind.forEach(drawArm);
  ops.torso();
  const skirt=has('bottom','hip')&&!has('bottom','leg');
  for(const n of legs){ops.leg(n);if(!skirt)call('shoes','leg',n);call('bottom','leg',n);if(skirt)call('shoes','leg',n);}
  call('bottom','hip');
  call('top_under','body');call('belt','belt');call('top_over','body');
  call('neck','neck');
  if(back&&!behindBag)call('bag','bag');
  armsFront.forEach(drawArm);
  if(!back&&!behindBag)call('bag','bag');
  const head=ops.head();
  AV.drawFace(cv,sk,R,fig.face,head);
  if(fig.hair)AV.drawHair(cv,sk,R,fig.hair[0],hatMask);
  call('glasses','face');
  call('headwear','head');
  if(back&&behindBag)call('bag','bag');
  return{rgba:cv.finish(),sk};
}
AV.render=render;
})(AV);
if(typeof module!=='undefined')module.exports=AV;
