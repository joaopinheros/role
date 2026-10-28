
/* ================= servidor próprio (versão exportada): banco + sala ao vivo por WebSocket ================= */
/* Só é usado quando a página vem do server/server.js (window.ROLE_SERVER). No artifact do Claude nada disso roda. */
function Net(){
  let ws=null,open=false,seq=0,token=null,backoff=500;
  const pend=new Map(),queue=[],watches=new Map(),rooms=new Map();
  const url=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';
  const raw=m=>{if(open&&ws.readyState===1)ws.send(JSON.stringify(m));else queue.push(m);};
  function call(op,a={}){return new Promise((res,rej)=>{const id=++seq;const t=setTimeout(()=>{if(pend.delete(id))rej(Object.assign(new Error('timeout'),{code:'timeout'}));},15000);
    pend.set(id,{res:v=>{clearTimeout(t);res(v)},rej:e=>{clearTimeout(t);rej(e)}});raw({...a,op,id});});}
  function connect(){ws=new WebSocket(url);
    ws.onopen=()=>{open=true;backoff=500;
      if(token)ws.send(JSON.stringify({op:'hello',token}));
      watches.forEach((w,id)=>ws.send(JSON.stringify({op:w.op,id,p:w.p,o:w.o})));
      rooms.forEach((r,name)=>{const id=++seq;pend.set(id,{res:x=>r.reset(x),rej:()=>{}});ws.send(JSON.stringify({op:'join',id,room:name,d:r.mine}));});
      while(queue.length)ws.send(JSON.stringify(queue.shift()));};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(_){return}
      if(m.w!=null){const w=watches.get(m.w);if(w)w.cb(m.v);return;}
      if(m.room){const r=rooms.get(m.room);if(r)r.ev(m);return;}
      if(m.id!=null){const p=pend.get(m.id);if(!p)return;pend.delete(m.id);m.err?p.rej(Object.assign(new Error(m.err),{code:m.err})):p.res(m.r);}};
    ws.onclose=()=>{open=false;setTimeout(connect,backoff);backoff=Math.min(8000,backoff*2);};}
  connect();
  function watch(op,p,o,cb){const id='w'+(++seq);watches.set(id,{op,p,o,cb});raw({op,id,p,o});return()=>{watches.delete(id);raw({op:'unwatch',id});};}
  function join(name,mine={}){const hs=new Set(),ms=new Set(),peers=new Map();let meId=null;
    const list=()=>[...peers.values()].map(p=>({...p,isMe:p.peer===meId}));
    const fire=()=>{const l=list();hs.forEach(h=>h({peers:l,joined:[],left:[],updated:[]}));};
    const r={mine,reset(x){meId=x.peer;peers.clear();x.peers.forEach(p=>peers.set(p.peer,p));fire();},
      ev(m){if(m.ev==='g'){ms.forEach(h=>{try{h(m.t,m.d,m.from)}catch(e){console.warn('jogo',e)}});return;}if(m.ev==='up')peers.set(m.p.peer,m.p);else if(m.ev==='left')peers.delete(m.peer);fire();}};
    return call('join',{room:name,d:mine}).then(x=>{rooms.set(name,r);r.reset(x);
      return{presence:async d=>{r.mine={...r.mine,...d};raw({op:'presence',room:name,d:r.mine});},peers:list,
        onPeers(h){hs.add(h);return()=>hs.delete(h);},
        /* mensagens de jogo para a sala (to = peer de destino, opcional) */
        send(kind,data,to){if(!open||!ws||ws.readyState!==1)return false;raw({op:'g',room:name,t:kind,d:data,to});return true;},
        onMsg(h){ms.add(h);return()=>ms.delete(h);},get me(){return meId;},
        async leave(){rooms.delete(name);hs.clear();ms.clear();raw({op:'leave',room:name});}};});}
  return{call,watch,join,async hello(t){token=t;return call('hello',{token:t});},forget(){token=null;return call('logout');}};}
function ServerDB(n){return{local:false,server:true,
  get:p=>n.call('get',{p}),set:(p,d)=>n.call('set',{p,d}),update:(p,d)=>n.call('update',{p,d}),del:p=>n.call('del',{p}),
  list:p=>n.call('list',{p}),add:(p,d)=>n.call('add',{p,d}),
  watchDoc(p,cb){return n.watch('watchDoc',p,null,cb);},watchColl(p,cb,o={}){return n.watch('watchColl',p,o,cb);},findConta:null};}
