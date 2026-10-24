/**
 * ============================================================
 *  Multimilliardær — server i Google Apps Script
 *  Lagrer spilltilstand, hendelseslogg og resultater i et Google Regneark.
 *
 *  Oppsett står i apps-script/OPPSETT.md. Kort fortalt:
 *    1. Lag et nytt Google Regneark
 *    2. Utvidelser -> Apps Script, lim inn denne filen
 *    3. Kjør funksjonen klargjor() én gang
 *    4. Prosjektinnstillinger -> Skriptegenskaper -> PASSORD = Starveien
 *    5. Distribuer -> Ny distribusjon -> Nettapp
 *         Kjør som:  Meg
 *         Tilgang:   Alle
 *    6. Kopier nettapp-URL-en inn i js/config.js
 * ============================================================
 */

var ARK_SPILL = 'Spill';
var ARK_HENDELSER = 'Hendelser';
var ARK_RESULTATER = 'Resultater';
var MAKS_CELLE = 45000;          // Google tillater 50 000 tegn per celle
var GAMMELT_SPILL_DAGER = 14;

/* ------------------------------------------------------------
   Engangsoppsett
   ------------------------------------------------------------ */
function klargjor() {
  var bok = SpreadsheetApp.getActiveSpreadsheet();
  lagArk(bok, ARK_SPILL, ['kode', 'v', 'fase', 'opprettet', 'oppdatert', 'tilstand']);
  lagArk(bok, ARK_HENDELSER, ['tidspunkt', 'kode', 'seq', 'type', 'tekst', 'data']);
  lagArk(bok, ARK_RESULTATER, ['tidspunkt', 'kode', 'plass', 'navn', 'figur', 'formue', 'statistikk']);
  var e = PropertiesService.getScriptProperties();
  if (!e.getProperty('PASSORD')) e.setProperty('PASSORD', 'Starveien');
  SpreadsheetApp.getUi().alert(
    'Multimilliardær er klargjort.\n\n' +
    'Passord: ' + e.getProperty('PASSORD') + '\n\n' +
    'Neste steg: Distribuer -> Ny distribusjon -> Nettapp (kjør som Meg, tilgang Alle).'
  );
}

function lagArk(bok, navn, rad) {
  var ark = bok.getSheetByName(navn);
  if (!ark) ark = bok.insertSheet(navn);
  if (ark.getLastRow() === 0) {
    ark.appendRow(rad);
    ark.getRange(1, 1, 1, rad.length).setFontWeight('bold').setBackground('#1b2232').setFontColor('#ffffff');
    ark.setFrozenRows(1);
  }
  return ark;
}

function ark(navn) {
  var bok = SpreadsheetApp.getActiveSpreadsheet();
  var a = bok.getSheetByName(navn);
  if (!a) {
    klargjorStille();
    a = bok.getSheetByName(navn);
  }
  return a;
}

function klargjorStille() {
  var bok = SpreadsheetApp.getActiveSpreadsheet();
  lagArk(bok, ARK_SPILL, ['kode', 'v', 'fase', 'opprettet', 'oppdatert', 'tilstand']);
  lagArk(bok, ARK_HENDELSER, ['tidspunkt', 'kode', 'seq', 'type', 'tekst', 'data']);
  lagArk(bok, ARK_RESULTATER, ['tidspunkt', 'kode', 'plass', 'navn', 'figur', 'formue', 'statistikk']);
}

/* ------------------------------------------------------------
   Svarhjelpere
   ------------------------------------------------------------ */
function svar(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------
   Hurtigbuffer

   Et regnearkoppslag koster nesten et sekund. Pollingen spør
   stadig om det samme, så vi holder tilstanden og versjonen i
   CacheService, som svarer på millisekunder.

   Regnearket er fortsatt fasiten: all skriving går dit, og
   versjonssjekken ved lagring leser derfra. Hurtigbufferen gjør
   bare lesingen raskere, den bestemmer ingenting.
   ------------------------------------------------------------ */
var CACHE_SEKUNDER = 21600;   // 6 timer, som er taket i Apps Script
var CACHE_MAKS = 90000;       // 100 kB per nøkkel; vi holder god margin

function buffer() {
  try { return CacheService.getScriptCache(); } catch (e) { return null; }
}

function bufferLes(kode) {
  var c = buffer();
  if (!c) return null;
  try { return c.get('st_' + kode); } catch (e) { return null; }
}

function bufferVersjon(kode) {
  var c = buffer();
  if (!c) return null;
  try {
    var v = c.get('v_' + kode);
    return v === null ? null : Number(v);
  } catch (e) { return null; }
}

function bufferSkriv(kode, json, v) {
  var c = buffer();
  if (!c) return;
  try {
    c.put('v_' + kode, String(v), CACHE_SEKUNDER);
    if (json && json.length < CACHE_MAKS) c.put('st_' + kode, json, CACHE_SEKUNDER);
    else c.remove('st_' + kode);
  } catch (e) { /* full buffer er ikke en feil */ }
}

function feil(melding, kodeFeil, ekstra) {
  var o = { feil: melding };
  if (kodeFeil) o.kodeFeil = kodeFeil;
  if (ekstra) for (var k in ekstra) o[k] = ekstra[k];
  return svar(o);
}

function sjekkPassord(p) {
  var riktig = PropertiesService.getScriptProperties().getProperty('PASSORD') || 'Starveien';
  return String(p || '') === String(riktig);
}

/* ------------------------------------------------------------
   Lesing
   ------------------------------------------------------------ */
function doGet(e) {
  try {
    var p = e.parameter || {};
    switch (p.handling) {
      case 'tilstand': return hentTilstand(p);
      case 'resultater': return hentResultater();
      case 'liste': return hentListe();
      case 'ping': return svar({ ok: true, tid: new Date().toISOString() });
      default: return feil('Ukjent handling: ' + p.handling);
    }
  } catch (err) {
    return feil('Serverfeil: ' + err.message);
  }
}

function finnRad(kode) {
  var a = ark(ARK_SPILL);
  var siste = a.getLastRow();
  if (siste < 2) return null;
  var koder = a.getRange(2, 1, siste - 1, 1).getValues();
  for (var i = 0; i < koder.length; i++) {
    if (String(koder[i][0]).toUpperCase() === String(kode).toUpperCase()) return i + 2;
  }
  return null;
}

function hentTilstand(p) {
  var kode = String(p.kode || '').toUpperCase();
  if (!kode) return feil('Mangler spillkode');
  var siden = p.siden === undefined ? -1 : Number(p.siden);

  /* Raskeste vei: pollingen spør om noe har endret seg. Stemmer
     versjonen i hurtigbufferen, slipper vi regnearket helt. */
  var bv = bufferVersjon(kode);
  if (bv !== null && siden >= 0 && bv === siden) {
    return svar({ uendret: true, v: bv });
  }

  /* Nest raskest: tilstanden ligger i hurtigbufferen */
  var bufret = bufferLes(kode);
  if (bufret && bv !== null) {
    return svar({ tilstand: JSON.parse(bufret), v: bv });
  }

  /* Ellers fra regnearket, som alltid er fasiten */
  var rad = finnRad(kode);
  if (!rad) return svar({ tilstand: null });
  var a = ark(ARK_SPILL);
  var v = Number(a.getRange(rad, 2).getValue());
  var json = a.getRange(rad, 6).getValue();
  if (!json) return svar({ tilstand: null });
  bufferSkriv(kode, json, v);
  if (siden >= 0 && v === siden) return svar({ uendret: true, v: v });
  return svar({ tilstand: JSON.parse(json), v: v });
}

function hentResultater() {
  var a = ark(ARK_RESULTATER);
  var siste = a.getLastRow();
  if (siste < 2) return svar({ resultater: [] });
  var fra = Math.max(2, siste - 299);
  var rader = a.getRange(fra, 1, siste - fra + 1, 7).getValues();
  var ut = rader.map(function (r) {
    return {
      t: r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]) || 0,
      kode: r[1], plass: Number(r[2]), navn: r[3], figur: r[4], formue: Number(r[5])
    };
  }).filter(function (r) { return r.navn; });
  return svar({ resultater: ut });
}

/**
 * Aktive spill, med nok informasjon til at en ny spiller kan velge
 * hvilket bord hen vil sette seg ved. Bare spill som er rørt det
 * siste døgnet tas med.
 */
function hentListe() {
  var a = ark(ARK_SPILL);
  var siste = a.getLastRow();
  if (siste < 2) return svar({ spill: [] });

  var rader = a.getRange(2, 1, siste - 1, 6).getValues();
  var grense = Date.now() - 24 * 3600 * 1000;
  var ut = [];

  rader.forEach(function (r) {
    if (!r[0]) return;
    var oppdatert = r[4] instanceof Date ? r[4].getTime() : Date.parse(r[4]) || 0;
    if (oppdatert && oppdatert < grense) return;
    if (r[2] === 'ferdig') return;

    var post = {
      kode: String(r[0]).toUpperCase(),
      v: Number(r[1]),
      fase: r[2],
      oppdatert: oppdatert,
      spillere: [],
      vert: ''
    };

    /* Hent navnene ut av tilstanden, men la ikke en ødelagt rad
       velte hele lista */
    try {
      var s = JSON.parse(r[5]);
      post.vert = (function () {
        for (var i = 0; i < s.spillere.length; i++) {
          if (s.spillere[i].id === s.vertId) return s.spillere[i].navn;
        }
        return '';
      })();
      post.spillere = s.spillere.map(function (p) {
        return { navn: p.navn, figur: p.figur, konkurs: !!p.konkurs };
      });
      post.ledigePlasser = Math.max(0, 6 - s.spillere.length);
    } catch (ignorer) {
      post.ledigePlasser = 0;
    }

    ut.push(post);
  });

  ut.sort(function (x, y) { return y.oppdatert - x.oppdatert; });
  return svar({ spill: ut.slice(0, 25) });
}

/* ------------------------------------------------------------
   Skriving
   ------------------------------------------------------------ */
function doPost(e) {
  var laas = LockService.getScriptLock();
  try {
    if (!laas.tryLock(20000)) return feil('Serveren er travel — prøv igjen', 'travel');
    var d = JSON.parse(e.postData.contents);
    if (!sjekkPassord(d.hemmelig)) return feil('Feil passord', 'passord');

    switch (d.handling) {
      case 'opprett': return opprett(d);
      case 'lagre': return lagre(d);
      case 'resultat': return lagreResultat(d);
      default: return feil('Ukjent handling: ' + d.handling);
    }
  } catch (err) {
    return feil('Serverfeil: ' + err.message);
  } finally {
    try { laas.releaseLock(); } catch (ignorer) { /* tom */ }
  }
}

function opprett(d) {
  var kode = String(d.kode || '').toUpperCase();
  if (!kode) return feil('Mangler spillkode');
  if (finnRad(kode)) return feil('Spillkoden finnes alt', 'finnes');
  var s = d.tilstand;
  s.v = 1;
  var a = ark(ARK_SPILL);
  var json = JSON.stringify(s);
  a.appendRow([kode, 1, s.fase, new Date(), new Date(), json]);
  bufferSkriv(kode, json, 1);
  ryddGamle();
  return svar({ tilstand: s, v: 1 });
}

function lagre(d) {
  var kode = String(d.kode || '').toUpperCase();
  var rad = finnRad(kode);
  if (!rad) return feil('Fant ikke spillet', 'mangler');
  var a = ark(ARK_SPILL);
  var naa = Number(a.getRange(rad, 2).getValue());

  if (Number(d.forventetV) !== naa) {
    var ferskJson = a.getRange(rad, 6).getValue();
    return feil('Noen andre kom deg i forkjøpet', 'konflikt',
      { tilstand: ferskJson ? JSON.parse(ferskJson) : null, v: naa });
  }

  var s = d.tilstand;
  s.v = naa + 1;

  var json = JSON.stringify(s);
  if (json.length > MAKS_CELLE) {          // kutt loggen hvis tilstanden blir for stor
    s.logg = (s.logg || []).slice(-15);
    json = JSON.stringify(s);
  }
  if (json.length > MAKS_CELLE) return feil('Tilstanden er for stor å lagre', 'stor');

  a.getRange(rad, 1, 1, 6).setValues([[kode, s.v, s.fase, a.getRange(rad, 4).getValue(), new Date(), json]]);
  bufferSkriv(kode, json, s.v);

  var h = d.hendelser || [];
  if (h.length) {
    var rader = h.map(function (x) {
      return [new Date(x.t || Date.now()), kode, x.seq || 0, x.type || '', String(x.tekst || '').slice(0, 480),
              x.data ? JSON.stringify(x.data).slice(0, 2000) : ''];
    });
    ark(ARK_HENDELSER).getRange(ark(ARK_HENDELSER).getLastRow() + 1, 1, rader.length, 6).setValues(rader);
  }

  return svar({ tilstand: s, v: s.v });
}

function lagreResultat(d) {
  var kode = String(d.kode || '').toUpperCase();
  var r = d.resultat || [];
  if (!r.length) return svar({ ok: true });
  var a = ark(ARK_RESULTATER);
  var rader = r.map(function (x) {
    return [new Date(), kode, x.plass || 0, x.navn || '', x.figur || '', Math.round(x.formue || 0),
            x.stat ? JSON.stringify(x.stat).slice(0, 2000) : ''];
  });
  a.getRange(a.getLastRow() + 1, 1, rader.length, 7).setValues(rader);
  return svar({ ok: true });
}

/* Rydd bort spill som ikke er rørt på to uker */
function ryddGamle() {
  var a = ark(ARK_SPILL);
  var siste = a.getLastRow();
  if (siste < 2) return;
  var grense = Date.now() - GAMMELT_SPILL_DAGER * 86400000;
  var datoer = a.getRange(2, 5, siste - 1, 1).getValues();
  for (var i = datoer.length - 1; i >= 0; i--) {
    var d = datoer[i][0];
    var t = d instanceof Date ? d.getTime() : Date.parse(d);
    if (t && t < grense) a.deleteRow(i + 2);
  }
}
