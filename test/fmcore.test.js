/* Testes das regras do Rolê FM (node --test test/fmcore.test.js) */
const test = require('node:test');
const assert = require('node:assert');
const F = require('../src/engine/fmcore.js');

test('links do YouTube em todos os formatos viram o id; o resto, null', () => {
  const id = 'dQw4w9WgXcQ';
  for (const l of [
    `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=42s&list=PL123`, `youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`, `https://music.youtube.com/watch?v=${id}&feature=share`, `https://youtu.be/${id}`,
    `youtu.be/${id}?si=abc`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `http://youtube.com/live/${id}`,
  ]) assert.equal(F.fmVideoId(l), id, l);
  for (const l of ['', 'ai se eu te pego', 'https://vimeo.com/12345', 'https://youtube.com/watch?v=curto', 'https://youtube.com/channel/UC123',
    'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)'])
    assert.equal(F.fmVideoId(l), null, l);
  assert.ok(F.fmIsLink('https://youtu.be/x') && F.fmIsLink('youtube.com/watch?v=1') && !F.fmIsLink('ai se eu te pego'));
});

test('comandos do chat', () => {
  assert.deepEqual(F.fmParse('/music https://youtu.be/dQw4w9WgXcQ'), { cmd: 'music', arg: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.deepEqual(F.fmParse('/m ai se eu te pego'), { cmd: 'music', arg: 'ai se eu te pego' });
  assert.deepEqual(F.fmParse('  /SKIP  '), { cmd: 'skip', arg: '' });
  assert.deepEqual(F.fmParse('/tirar'), { cmd: 'tirar', arg: 0 });
  assert.deepEqual(F.fmParse('/tirar 3'), { cmd: 'tirar', arg: 3 });
  assert.equal(F.fmParse('oi gente'), null);
  assert.equal(F.fmParse('/xablau').cmd, '?');
  assert.equal(F.fmParse('url /music x'), null, 'barra no meio não é comando');
});

test('posição da música: andando, pausada e parada; com a diferença de relógio', () => {
  const np = { status: 'tocando', started: 100000, paused: null };
  assert.equal(F.fmPos(np, 130000), 30);
  assert.equal(F.fmPos({ ...np, status: 'pausado', paused: 112000 }, 999999), 12, 'pausada fica congelada');
  assert.equal(F.fmPos({ status: 'parado' }, 5), 0);
  assert.equal(F.fmPos(np, 90000), 0, 'nunca negativa');
  // relógio daqui 5 s adiantado: o servidor responde 5 s "atrás"; ida e volta de 200 ms
  const off = F.fmOffset([{ t0: 10000, t1: 10200, server: 5100 }, { t0: 20000, t1: 20100, server: 15050 }, { t0: 30000, t1: 30300, server: 25150 }]);
  assert.equal(Math.round(off), -5000);
  assert.equal(F.fmPos(np, 135000 + off), 30);
});

test('quem pode o quê', () => {
  const sala = { quem: 'todos', priv: 'link' };
  for (const a of ['add', 'ver', 'tirarMinha']) assert.ok(F.fmCan('membro', a, sala), 'membro ' + a);
  for (const a of ['skip', 'pause', 'play', 'limpar', 'tirarQualquer']) assert.ok(!F.fmCan('membro', a, sala), 'membro não ' + a);
  for (const a of ['skip', 'pause', 'limpar', 'tirarQualquer']) assert.ok(F.fmCan('dj', a, sala), 'dj ' + a);
  assert.ok(!F.fmCan('membro', 'add', { ...sala, quem: 'djs' }) && F.fmCan('dj', 'add', { ...sala, quem: 'djs' }), 'sala fechada para DJs');
  assert.ok(!F.fmCan('dono', 'add', { quem: 'todos', priv: 'publica' }), 'sala pública não tem Rolê FM');
  assert.ok(F.fmCan('dono', 'skip', { quem: 'todos', priv: 'fechado' }));
  assert.ok(!F.fmCan(null, 'ver', sala), 'quem não é da sala não pode nada');
});

test('limite de 3 músicas esperando por pessoa (dono e DJ sem limite)', () => {
  const q = [{ by: 'bia' }, { by: 'bia' }, { by: 'ana' }];
  assert.equal(F.fmRoomFor(q, 'bia', 'membro'), 1);
  assert.equal(F.fmRoomFor([...q, { by: 'bia' }], 'bia', 'membro'), 0);
  assert.equal(F.fmRoomFor([...q, { by: 'bia' }], 'bia', 'dj'), Infinity);
  assert.equal(F.fmRoomFor(q, 'caio', 'membro'), 3);
});

test('duração ISO do YouTube e relógio na tela', () => {
  assert.equal(F.fmIsoDur('PT3M33S'), 213);
  assert.equal(F.fmIsoDur('PT1H2M3S'), 3723);
  assert.equal(F.fmIsoDur('PT45S'), 45);
  assert.equal(F.fmIsoDur('P0D'), 0);
  assert.equal(F.fmIsoDur('lixo'), null);
  assert.equal(F.fmClock(213), '3:33');
  assert.equal(F.fmClock(5), '0:05');
});

test('consulta normalizada (chave do cache)', () => {
  assert.equal(F.fmNorm('  Ai, Se Eu Te Pego!!  '), 'ai se eu te pego');
  assert.equal(F.fmNorm('Ai se eu te PEGO'), F.fmNorm('ai   se eu te pego'));
  assert.equal(F.fmNorm('Açaí — Música (Ao Vivo)'), 'acai musica ao vivo');
  assert.equal(F.fmNorm('???'), '');
  assert.ok(F.fmNorm('x'.repeat(300)).length <= 100);
  assert.ok(!F.fmIsLink('ai se eu te pego') && !F.fmIsLink('youtube clipe') && F.fmIsLink('youtu.be/abc'));
});

test('ordem dos resultados: tira lives e vídeos longos; título "official" sobe uma posição', () => {
  const it = (video, title, dur, live) => ({ video, title, dur, live });
  const r = F.fmRank([it('a', 'Ai Se Eu Te Pego (cover)', 200), it('b', 'Ai Se Eu Te Pego - Clipe Oficial', 210), it('c', 'Ai Se Eu Te Pego ao vivo', 230, true),
    it('d', 'Ai Se Eu Te Pego - 1 hora', 3600), it('e', 'Ai Se Eu Te Pego karaokê', 190), it('f', 'sem duração', 0)]);
  assert.deepEqual(r.map(x => x.video), ['b', 'a', 'e'], 'sem a live, sem o de 1 hora e sem duração zero; o oficial passa o cover');
  assert.deepEqual(F.fmRank([it('a', 'a', 100), it('b', 'b', 100)]).map(x => x.video), ['a', 'b'], 'sem palavra-chave, a ordem do YouTube fica');
  assert.deepEqual(F.fmRank(null), []);
  assert.equal(F.fmThumb('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
});

test('contador de cota: 90% pausa a busca; o dia vira à meia-noite do Pacífico', () => {
  const pct = u => u * 100 / F.FM_CFG.quotaDay;
  assert.ok(pct(F.FM_CFG.searchCost * 89) < F.FM_CFG.quotaWarnPct && pct(F.FM_CFG.searchCost * 90) >= F.FM_CFG.quotaWarnPct, 'cerca de 90 buscas novas por dia');
  assert.equal(F.fmQuotaDay(new Date('2026-11-01T06:59:00Z')), '2026-10-31', '23:59 do Pacífico (PDT) ainda é o dia anterior');
  assert.equal(F.fmQuotaDay(new Date('2026-11-01T07:01:00Z')), '2026-11-01');
});
