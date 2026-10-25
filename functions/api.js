/**
 * ============================================================
 *  Multimillionær — server på Cloudflare
 *
 *  Dette er en Pages Function. Den kjører på samme adresse som
 *  spillet selv, så kallene går til /api uten CORS og uten at
 *  config.js trenger å vite noen URL.
 *
 *  Protokollen er den samme som den gamle Apps Script-serveren brukte,
 *  gjorde, slik at js/net.js ikke måtte endres i det hele tatt.
 *
 *  Oppsett står i cloudflare/OPPSETT.md. Kort fortalt trengs:
 *    - en D1-database bundet som  DB
 *    - en hemmelighet som heter   PASSORD
 * ============================================================
 */

const MAKS_ALDER_DAGER = 14;        // spill eldre enn dette ryddes bort
const LISTE_TIMER = 3;              // et venterom som ikke er rørt på tre timer er forlatt
const MAKS_TILSTAND = 900000;       // vern mot en tilstand som har løpt løpsk

/* ------------------------------------------------------------
   Svarhjelpere
   ------------------------------------------------------------ */
const HODER = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  /* Samme opphav i drift, men dette lar deg kjøre spillet lokalt
     mot den publiserte serveren mens du utvikler. */
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function svar(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HODER });
}

function feil(melding, kodeFeil, ekstra) {
  return svar({ feil: melding, ...(kodeFeil ? { kodeFeil } : {}), ...(ekstra || {}) });
}

/* ------------------------------------------------------------
   Inngang
   ------------------------------------------------------------ */
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HODER });
  }

  if (!env.DB) {
    return feil('Databasen er ikke koblet til. Bind en D1-database som DB.', 'oppsett');
  }

  try {
    await sikreTabeller(env.DB);

    if (request.method === 'GET') {
      const p = new URL(request.url).searchParams;
      switch (p.get('handling')) {
        case 'ping':       return svar({ ok: true, tid: new Date().toISOString(), motor: 'cloudflare' });
        case 'tilstand':   return hentTilstand(env.DB, p);
        case 'liste':      return hentListe(env.DB);
        case 'resultater': return hentResultater(env.DB);
        default:           return feil('Ukjent handling');
      }
    }

    if (request.method === 'POST') {
      /* net.js sender ren tekst for å slippe preflight-sjekk */
      const d = JSON.parse(await request.text());

      if (!sjekkPassord(env, d.hemmelig)) return feil('Feil passord', 'passord');

      switch (d.handling) {
        case 'opprett':  return opprett(env.DB, d);
        case 'lagre':    return lagre(env.DB, d);
        case 'resultat': return lagreResultat(env.DB, d);
        default:         return feil('Ukjent handling');
      }
    }

    return feil('Metoden støttes ikke');
  } catch (e) {
    return feil('Serverfeil: ' + (e && e.message ? e.message : String(e)));
  }
}

function sjekkPassord(env, oppgitt) {
  const riktig = env.PASSORD || 'Starveien';
  return String(oppgitt || '') === String(riktig);
}

/* ------------------------------------------------------------
   Tabeller
   Lages ved første kall, så du slipper å kjøre skjemaet manuelt.
   ------------------------------------------------------------ */
let tabellerKlare = false;

async function sikreTabeller(DB) {
  if (tabellerKlare) return;
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS spill (
      kode TEXT PRIMARY KEY,
      v INTEGER NOT NULL,
      fase TEXT NOT NULL,
      opprettet INTEGER NOT NULL,
      oppdatert INTEGER NOT NULL,
      tilstand TEXT NOT NULL
    )`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS spill_oppdatert ON spill (oppdatert)`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS hendelser (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT NOT NULL,
      seq INTEGER,
      type TEXT,
      tekst TEXT,
      tid INTEGER
    )`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS hendelser_kode ON hendelser (kode, seq)`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS resultater (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT,
      plass INTEGER,
      navn TEXT,
      figur TEXT,
      formue INTEGER,
      tid INTEGER
    )`)
  ]);
  tabellerKlare = true;
}

/* ------------------------------------------------------------
   Lesing
   ------------------------------------------------------------ */
async function hentTilstand(DB, p) {
  const kode = String(p.get('kode') || '').toUpperCase();
  if (!kode) return feil('Mangler spillkode');
  const siden = p.get('siden') === null ? -1 : Number(p.get('siden'));

  /* Pollingen spør bare om noe har endret seg. Da henter vi
     versjonen alene, ikke hele tilstanden. */
  if (siden >= 0) {
    const rad = await DB.prepare('SELECT v FROM spill WHERE kode = ?').bind(kode).first();
    if (!rad) return svar({ tilstand: null });
    if (Number(rad.v) === siden) return svar({ uendret: true, v: Number(rad.v) });
  }

  const rad = await DB.prepare('SELECT v, tilstand FROM spill WHERE kode = ?').bind(kode).first();
  if (!rad) return svar({ tilstand: null });
  return svar({ tilstand: JSON.parse(rad.tilstand), v: Number(rad.v) });
}

async function hentListe(DB) {
  /* Bare bord man faktisk kan sette seg ved.
     Spill som er i gang kan ikke bli med i, så de fylte bare lista
     med rader merket «Stengt». Er man med i et slikt spill fra før,
     kommer man tilbake via «Fortsett som ...» eller ved å taste
     koden. Og et venterom som ikke er rørt på noen timer er forlatt. */
  const grense = Date.now() - LISTE_TIMER * 3600 * 1000;
  const { results } = await DB.prepare(
    `SELECT kode, v, fase, oppdatert, tilstand FROM spill
      WHERE oppdatert > ? AND fase = 'lobby'
      ORDER BY oppdatert DESC LIMIT 25`
  ).bind(grense).all();

  const spill = (results || []).map((r) => {
    const post = {
      kode: r.kode,
      v: Number(r.v),
      fase: r.fase,
      oppdatert: Number(r.oppdatert),
      spillere: [],
      vert: '',
      ledigePlasser: 0
    };
    try {
      const s = JSON.parse(r.tilstand);
      const vert = (s.spillere || []).find((x) => x.id === s.vertId);
      post.vert = vert ? vert.navn : '';
      post.spillere = (s.spillere || []).map((x) => ({
        navn: x.navn, figur: x.figur, konkurs: !!x.konkurs
      }));
      post.ledigePlasser = Math.max(0, 6 - (s.spillere || []).length);
    } catch (ignorer) { /* en ødelagt rad skal ikke velte hele lista */ }
    return post;
  });

  return svar({ spill });
}

async function hentResultater(DB) {
  const { results } = await DB.prepare(
    `SELECT kode, plass, navn, figur, formue, tid FROM resultater
      ORDER BY id DESC LIMIT 300`
  ).all();
  return svar({
    resultater: (results || []).map((r) => ({
      kode: r.kode, plass: Number(r.plass), navn: r.navn,
      figur: r.figur, formue: Number(r.formue), t: Number(r.tid)
    }))
  });
}

/* ------------------------------------------------------------
   Skriving
   ------------------------------------------------------------ */
async function opprett(DB, d) {
  const kode = String(d.kode || '').toUpperCase();
  if (!kode) return feil('Mangler spillkode');

  const finnes = await DB.prepare('SELECT kode FROM spill WHERE kode = ?').bind(kode).first();
  if (finnes) return feil('Spillkoden finnes alt', 'finnes');

  const s = d.tilstand;
  s.v = 1;
  const naa = Date.now();
  await DB.prepare(
    'INSERT INTO spill (kode, v, fase, opprettet, oppdatert, tilstand) VALUES (?, 1, ?, ?, ?, ?)'
  ).bind(kode, s.fase, naa, naa, JSON.stringify(s)).run();

  await rydd(DB);
  return svar({ tilstand: s, v: 1 });
}

async function lagre(DB, d) {
  const kode = String(d.kode || '').toUpperCase();
  const forventetV = Number(d.forventetV);
  const s = d.tilstand;
  s.v = forventetV + 1;

  let json = JSON.stringify(s);
  if (json.length > MAKS_TILSTAND) {
    s.logg = (s.logg || []).slice(-15);
    json = JSON.stringify(s);
    if (json.length > MAKS_TILSTAND) return feil('Tilstanden er for stor', 'stor');
  }

  /* Hele samtidighetskontrollen ligger i denne ene setningen:
     raden oppdateres bare hvis versjonen fortsatt er den vi så.
     SQLite gjør det atomisk, så to samtidige lagringer kan ikke
     begge lykkes. */
  const res = await DB.prepare(
    `UPDATE spill SET v = ?, fase = ?, oppdatert = ?, tilstand = ?
      WHERE kode = ? AND v = ?`
  ).bind(s.v, s.fase, Date.now(), json, kode, forventetV).run();

  if (!res.meta || res.meta.changes !== 1) {
    const fersk = await DB.prepare('SELECT v, tilstand FROM spill WHERE kode = ?').bind(kode).first();
    if (!fersk) return feil('Fant ikke spillet', 'mangler');
    return feil('Noen andre kom deg i forkjøpet', 'konflikt', {
      tilstand: JSON.parse(fersk.tilstand),
      v: Number(fersk.v)
    });
  }

  /* Hendelsesloggen er til å lese gjennom partiet etterpå.
     Den er ikke kritisk, så en feil her skal ikke velte lagringen. */
  const h = d.hendelser || [];
  if (h.length) {
    try {
      await DB.batch(h.slice(0, 40).map((x) =>
        DB.prepare('INSERT INTO hendelser (kode, seq, type, tekst, tid) VALUES (?, ?, ?, ?, ?)')
          .bind(kode, x.seq || 0, x.type || '', String(x.tekst || '').slice(0, 400), x.t || Date.now())
      ));
    } catch (ignorer) { /* loggen er ikke verdt å feile på */ }
  }

  return svar({ tilstand: s, v: s.v });
}

async function lagreResultat(DB, d) {
  const kode = String(d.kode || '').toUpperCase();
  const r = d.resultat || [];
  if (!r.length) return svar({ ok: true });
  await DB.batch(r.map((x) =>
    DB.prepare('INSERT INTO resultater (kode, plass, navn, figur, formue, tid) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(kode, x.plass || 0, x.navn || '', x.figur || '', Math.round(x.formue || 0), Date.now())
  ));
  return svar({ ok: true });
}

/* Rydd bort gamle spill. Kjøres når noen oppretter et nytt. */
async function rydd(DB) {
  try {
    const grense = Date.now() - MAKS_ALDER_DAGER * 86400000;
    await DB.prepare('DELETE FROM hendelser WHERE kode IN (SELECT kode FROM spill WHERE oppdatert < ?)')
      .bind(grense).run();
    await DB.prepare('DELETE FROM spill WHERE oppdatert < ?').bind(grense).run();
  } catch (ignorer) { /* opprydding er ikke verdt å feile på */ }
}
