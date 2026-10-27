/*
 * Chat de voz da sala: áudio direto entre as pessoas (WebRTC, malha completa), sem servidor de mídia.
 * O Supabase Realtime só serve para combinar a conexão (quem está na voz + mensagens de sinalização).
 * Quem entra depois liga para quem já estava; cada par troca oferta, resposta e candidatos ICE.
 * Limite de MAX pessoas por conversa: cada uma mantém uma conexão com todas as outras.
 * Sem TURN, redes mais restritas (alguns 4G/Wi-Fi corporativo) podem não conectar: veja ICE_SERVERS_JSON.
 */
export const VOICE_MAX = 8;
export const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];

const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const coded = code => Object.assign(new Error(code), { code });

/* erros do microfone viram códigos que o app sabe explicar */
function micError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return coded('mic_denied');
  if (n === 'NotFoundError' || n === 'OverconstrainedError' || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return coded('mic_none');
  return coded('mic_error');
}

export function makeVoice(sb, roomId, ice) {
  const key = rid();
  const iceServers = ice && ice.length ? ice : DEFAULT_ICE;
  const hs = new Set();
  const peersMap = new Map();          // peer -> { pc, audio, pending: [], src }
  const speaking = new Set();          // chaves de quem está falando agora
  let ch = null, stream = null, ctx = null, localAn = null, meta = { u: '', t: 0, m: false };
  let active = false, joining = false, timer = 0, firstSub = true, sorted = [];

  /* ---------- estado para a tela */
  const members = () => Object.entries(ch ? ch.presenceState() : {}).map(([peer, metas]) => {
    const m = metas[metas.length - 1] || {};
    return { peer, user: m.u || '', muted: !!m.m, isMe: peer === key, speaking: speaking.has(peer) };
  });
  const emit = extra => { const st = { active, muted: meta.m, members: members(), ...extra }; hs.forEach(h => h(st)); };

  /* ---------- quem está falando: volume do áudio, medido 8x por segundo */
  function analyser(mediaStream) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(mediaStream).connect(an);
      return { an, buf: new Uint8Array(an.fftSize) };
    } catch (_) { return null; }
  }
  const loud = a => {
    if (!a) return false;
    a.an.getByteTimeDomainData(a.buf);
    let s = 0;
    for (let i = 0; i < a.buf.length; i++) { const v = (a.buf[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / a.buf.length) > 0.03;
  };
  function measure() {
    let changed = false;
    const now = new Set();
    if (localAn && !meta.m && loud(localAn)) now.add(key);
    peersMap.forEach((p, k) => { if (loud(p.an)) now.add(k); });
    for (const k of now) if (!speaking.has(k)) { speaking.add(k); changed = true; }
    for (const k of [...speaking]) if (!now.has(k)) { speaking.delete(k); changed = true; }
    if (changed) emit();
  }

  /* ---------- sinalização */
  const send = (to, kind, data) => ch && ch.send({ type: 'broadcast', event: 'sig', payload: { to, from: key, kind, data } });

  function closePeer(k) {
    const p = peersMap.get(k);
    if (!p) return;
    peersMap.delete(k);
    speaking.delete(k);
    try { p.pc.close(); } catch (_) {}
    if (p.audio) { p.audio.srcObject = null; p.audio.remove(); }
  }

  function createPeer(k) {
    const pc = new RTCPeerConnection({ iceServers });
    const p = { pc, audio: null, an: null, pending: [] };
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = e => { if (e.candidate) send(k, 'ice', e.candidate.toJSON()); };
    pc.ontrack = e => {
      const a = new Audio();
      a.autoplay = true; a.playsInline = true; a.srcObject = e.streams[0];
      a.style.display = 'none'; document.body.append(a);
      a.play().catch(() => {});
      p.audio = a; p.an = analyser(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && peersMap.get(k) === p) { closePeer(k); setTimeout(sync, 1500); }   // o lado que liga tenta de novo
    };
    peersMap.set(k, p);
    return p;
  }

  async function call(k) {
    const p = createPeer(k);
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    send(k, 'offer', p.pc.localDescription.toJSON());
  }

  async function onSig({ to, from, kind, data }) {
    if (to !== key || !active || !from) return;
    try {
      if (kind === 'offer') {
        if (peersMap.size >= VOICE_MAX) return;
        closePeer(from);
        const p = createPeer(from);
        await p.pc.setRemoteDescription(data);
        for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        const answer = await p.pc.createAnswer();
        await p.pc.setLocalDescription(answer);
        send(from, 'answer', p.pc.localDescription.toJSON());
      } else {
        const p = peersMap.get(from);
        if (!p) return;
        if (kind === 'answer') {
          await p.pc.setRemoteDescription(data);
          for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        } else if (kind === 'ice') {
          if (p.pc.remoteDescription) await p.pc.addIceCandidate(data).catch(() => {}); else p.pending.push(data);
        }
      }
    } catch (e) { console.warn('voz', kind, e); }
  }

  /* quem entrou por último liga para quem já estava (evita os dois ligarem ao mesmo tempo) */
  function sync() {
    if (!active || !ch) return;
    const st = ch.presenceState();
    sorted = Object.entries(st).map(([k, m]) => ({ k, t: (m[m.length - 1] || {}).t || 0 })).sort((a, b) => a.t - b.t || (a.k < b.k ? -1 : 1));
    if (sorted.findIndex(x => x.k === key) >= VOICE_MAX) { leave().then(() => emit({ full: true })); return; }   // entrou junto com outras e perdeu a vaga
    for (const { k, t } of sorted) {
      if (k === key || peersMap.has(k)) continue;
      if (meta.t > t || (meta.t === t && key > k)) call(k).catch(e => { console.warn('voz', e); closePeer(k); });
    }
    for (const k of [...peersMap.keys()]) if (!st[k]) closePeer(k);
    emit();
  }

  const track = () => ch && ch.track(meta).catch(() => {});

  async function join(user) {
    if (active || joining) return;
    joining = true;
    try {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) throw coded('mic_none');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) { throw micError(e); }

      ch = sb.channel('voz:' + roomId, { config: { presence: { key }, broadcast: { self: false } } });
      ch.on('presence', { event: 'sync' }, sync);
      ch.on('broadcast', { event: 'sig' }, ({ payload }) => onSig(payload || {}));
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(coded('timeout')), 10000);
        ch.subscribe(status => {
          if (status === 'SUBSCRIBED') { clearTimeout(t); if (firstSub) { firstSub = false; res(); } else track(); }   // reconectou: reenvia a presença
          else if (status === 'CHANNEL_ERROR' && firstSub) { clearTimeout(t); rej(coded('rt')); }
        });
      });

      meta = { u: String(user || ''), t: Date.now(), m: false };
      active = true;
      localAn = analyser(stream);
      timer = setInterval(measure, 125);
      await track();
      emit();
    } catch (e) {
      await leave();
      throw e;
    } finally { joining = false; }
  }

  async function leave() {
    const was = active || !!ch || !!stream;
    active = false;
    clearInterval(timer);
    for (const k of [...peersMap.keys()]) closePeer(k);
    speaking.clear();
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (ctx) { try { ctx.close(); } catch (_) {} ctx = null; localAn = null; }
    if (ch) { const c = ch; ch = null; try { await c.untrack(); } catch (_) {} try { await sb.removeChannel(c); } catch (_) {} }
    firstSub = true;
    if (was) emit();
  }

  function setMuted(m) {
    meta = { ...meta, m: !!m };
    if (stream) stream.getAudioTracks().forEach(t => { t.enabled = !m; });
    if (m) speaking.delete(key);
    track(); emit();
  }

  return {
    get active() { return active; },
    join, leave, setMuted,
    members,
    onChange(h) { hs.add(h); return () => hs.delete(h); },
  };
}
