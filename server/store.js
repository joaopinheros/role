/*
 * Banco de documentos em memória com persistência em arquivo JSON.
 * Caminhos no formato "colecao/doc/subcolecao/doc" (mesmo modelo do app).
 * Escrita atômica (arquivo temporário + rename) a cada poucos segundos e ao desligar.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHAT_KEEP = 300; // mensagens guardadas por sala

class Store {
  constructor(file) {
    this.file = file;
    this.docs = new Map();      // caminho -> objeto
    this.kids = new Map();      // caminho da coleção -> Set(ids)
    this.listeners = new Set(); // fn(caminho)
    this.dirty = false;
    this._load();
    this.timer = setInterval(() => this.flush(), 2000);
    this.timer.unref();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const [p, d] of Object.entries(raw.docs || {})) this._put(p, d);
      console.log(`[store] ${this.docs.size} documentos carregados de ${this.file}`);
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('[store] não deu pra ler o banco:', e.message);
    }
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const tmp = this.file + '.tmp';
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify({ v: 1, docs: Object.fromEntries(this.docs) }));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      this.dirty = true;
      console.error('[store] falha ao salvar:', e.message);
    }
  }

  static split(p) {
    const i = p.lastIndexOf('/');
    return [p.slice(0, i), p.slice(i + 1)];
  }

  _put(p, d) {
    const [coll, id] = Store.split(p);
    this.docs.set(p, d);
    let s = this.kids.get(coll);
    if (!s) this.kids.set(coll, (s = new Set()));
    s.add(id);
  }

  _changed(p) {
    this.dirty = true;
    for (const fn of this.listeners) fn(p);
  }

  get(p) {
    const d = this.docs.get(p);
    return d ? structuredClone(d) : null;
  }

  set(p, d) {
    this._put(p, structuredClone(d));
    this._changed(p);
  }

  update(p, d) {
    this._put(p, { ...(this.docs.get(p) || {}), ...structuredClone(d) });
    this._changed(p);
  }

  del(p) {
    if (!this.docs.has(p)) return;
    const [coll, id] = Store.split(p);
    this.docs.delete(p);
    const s = this.kids.get(coll);
    if (s) s.delete(id);
    this._changed(p);
  }

  list(coll) {
    const s = this.kids.get(coll);
    if (!s) return [];
    return [...s].map(id => ({ id, data: structuredClone(this.docs.get(coll + '/' + id)) }));
  }

  add(coll, d) {
    const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    this.set(coll + '/' + id, d);
    if (/\/chat$/.test(coll)) this._trim(coll, CHAT_KEEP);
    return id;
  }

  _trim(coll, keep) {
    const s = this.kids.get(coll);
    if (!s || s.size <= keep) return;
    const ids = [...s].sort((a, b) => (this.docs.get(coll + '/' + a).at || 0) - (this.docs.get(coll + '/' + b).at || 0));
    ids.slice(0, ids.length - keep).forEach(id => this.del(coll + '/' + id));
  }

  /* procura a conta por e-mail ou celular (dados privados: só o servidor usa) */
  findConta(q) {
    for (const [p, d] of this.docs) {
      if (/^data\/users\/[^/]+\/conta$/.test(p) && (d.email === q || d.tel === q)) return { uid: p.split('/')[2], conta: structuredClone(d) };
    }
    return null;
  }

  close() {
    clearInterval(this.timer);
    this.flush();
  }
}

module.exports = { Store };
