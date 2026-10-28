/*
 * Damas brasileiras para 2 pessoas: regras do jogo, sem tela e sem rede.
 *
 * Tabuleiro 8x8, só as casas escuras. Casa = linha*8 + coluna, linha 0 em cima.
 * Lado 0 (claras) começa embaixo e sobe; lado 1 (escuras) começa em cima e desce. As claras começam.
 * Peça: 0 vazio, 1 pedra clara, 2 dama clara, 3 pedra escura, 4 dama escura.
 * - Pedra anda 1 casa na diagonal para a frente e captura para a frente e para trás.
 * - Dama anda e captura à distância ("dama voadora"), pousando em qualquer casa livre depois da peça tomada.
 * - Captura é obrigatória e vale a lei da maioria: só valem as sequências que tomam mais peças.
 * - As peças tomadas só saem no fim do lance e não podem ser puladas duas vezes.
 * - A pedra vira dama se terminar o lance na última linha (passar por ela no meio de uma captura não conta).
 * Fim: quem não tem lance (ou peça) na sua vez perde. Empate: 20 lances seguidos só de damas, sem captura.
 */
const DM_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const dmSide = p => (p === 1 || p === 2 ? 0 : p === 3 || p === 4 ? 1 : -1);
const dmKing = p => p === 2 || p === 4;
const dmOn = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const DM_DRAW = 20;

function dmNew() {
  const b = new Array(64).fill(0);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 !== 1) continue;
    if (r < 3) b[r * 8 + c] = 3; else if (r > 4) b[r * 8 + c] = 1;
  }
  return { b, turn: 0, n: 0, quiet: 0, last: null, over: -1 };
}

/* todas as sequências de captura completas que a peça da casa sq consegue fazer */
function dmCaptures(b, sq, piece) {
  const side = dmSide(piece), king = dmKing(piece), out = [], bb = b.slice();
  bb[sq] = 0;   // a peça saiu da casa de origem (pode até voltar a passar por ela)
  const rec = (cur, path, taken) => {
    let more = false;
    const r0 = cur >> 3, c0 = cur & 7;
    for (const [dr, dc] of DM_DIRS) {
      let r = r0 + dr, c = c0 + dc;
      if (king) while (dmOn(r, c) && bb[r * 8 + c] === 0) { r += dr; c += dc; }
      if (!dmOn(r, c)) continue;
      const v = r * 8 + c;
      if (dmSide(bb[v]) !== 1 - side || taken.includes(v)) continue;
      let r2 = r + dr, c2 = c + dc;
      while (dmOn(r2, c2) && bb[r2 * 8 + c2] === 0) {
        more = true;
        const land = r2 * 8 + c2;
        rec(land, path.concat(land), taken.concat(v));
        if (!king) break;
        r2 += dr; c2 += dc;
      }
    }
    if (!more && taken.length) out.push({ path, taken });
  };
  rec(sq, [sq], []);
  return out;
}

function dmSimple(b, sq, piece) {
  const side = dmSide(piece), king = dmKing(piece), out = [], r0 = sq >> 3, c0 = sq & 7;
  for (const [dr, dc] of DM_DIRS) {
    if (!king && dr !== (side === 0 ? -1 : 1)) continue;
    let r = r0 + dr, c = c0 + dc;
    while (dmOn(r, c) && b[r * 8 + c] === 0) {
      out.push({ path: [sq, r * 8 + c], taken: [] });
      if (!king) break;
      r += dr; c += dc;
    }
  }
  return out;
}

/* lances legais de quem está na vez (com captura obrigatória e lei da maioria) */
function dmMoves(m) {
  if (m.over !== -1) return [];
  const caps = [];
  for (let s = 0; s < 64; s++) if (dmSide(m.b[s]) === m.turn) caps.push(...dmCaptures(m.b, s, m.b[s]));
  if (caps.length) {
    let mx = 0; for (const x of caps) if (x.taken.length > mx) mx = x.taken.length;
    return caps.filter(x => x.taken.length === mx);
  }
  const out = [];
  for (let s = 0; s < 64; s++) if (dmSide(m.b[s]) === m.turn) out.push(...dmSimple(m.b, s, m.b[s]));
  return out;
}

const dmSame = (p, q) => p.length === q.length && p.every((v, i) => v === q[i]);

/* faz o lance (caminho de casas, da origem ao destino). Devolve o lance ou null se não vale. */
function dmPlay(m, path) {
  if (!Array.isArray(path)) return null;
  const mv = dmMoves(m).find(x => dmSame(x.path, path));
  if (!mv) return null;
  const from = path[0], to = path[path.length - 1];
  let p = m.b[from];
  const wasKing = dmKing(p);
  m.b[from] = 0;
  for (const v of mv.taken) m.b[v] = 0;
  if (p === 1 && to >> 3 === 0) p = 2;
  if (p === 3 && to >> 3 === 7) p = 4;
  m.b[to] = p;
  m.quiet = mv.taken.length || !wasKing ? 0 : m.quiet + 1;
  m.last = { path: path.slice(), taken: mv.taken.slice(), crown: !wasKing && dmKing(p) };
  m.n++;
  m.turn = 1 - m.turn;
  if (m.quiet >= DM_DRAW) m.over = 2;
  else if (!dmMoves(m).length) m.over = 1 - m.turn;   // quem ficou sem lance perde
  return mv;
}

const dmCount = (m, side) => m.b.filter(p => dmSide(p) === side).length;

if (typeof module !== 'undefined') module.exports = { DM_DRAW, dmSide, dmKing, dmNew, dmCaptures, dmSimple, dmMoves, dmPlay, dmCount };
