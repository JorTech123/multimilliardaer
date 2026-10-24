/* ============================================================
   Multimilliardær — regelmotor
   Rene funksjoner: handling(state, action) -> { state, hendelser }
   Ingen DOM, ingen nettverk. Samme kode kjører hos alle spillere,
   så alle regner seg fram til nøyaktig samme tilstand.
   ============================================================ */
(function (MM) {
  'use strict';

  var E = MM.Engine = {};

  /* ------------------------------------------------------------
     Hjelpere
     ------------------------------------------------------------ */
  function klon(o) { return JSON.parse(JSON.stringify(o)); }

  function sp(s, id) {
    for (var i = 0; i < s.spillere.length; i++) {
      if (s.spillere[i].id === id) return s.spillere[i];
    }
    return null;
  }
  E.sp = sp;

  function aktivId(s) {
    if (!s.tur || !s.tur.rekkefolge.length) return null;
    return s.tur.rekkefolge[s.tur.i % s.tur.rekkefolge.length];
  }
  E.aktivId = aktivId;

  function aktiv(s) { return sp(s, aktivId(s)); }
  E.aktiv = aktiv;

  function levende(s) {
    return s.spillere.filter(function (p) { return !p.konkurs; });
  }
  E.levende = levende;

  function kursPris(s, serieId) {
    return MM.STOCK_LADDER[s.kurs[serieId]] || 0;
  }
  E.kursPris = kursPris;

  function tomt(s, pos) {
    return s.tomter[String(pos)];
  }
  E.tomt = tomt;

  function hend(ut, type, tekst, data) {
    ut.push({ type: type, tekst: tekst, data: data || null, t: Date.now() });
  }

  function kr(n) {
    return MM.fmt ? MM.fmt(n) : String(n);
  }

  /* Eier spilleren alle tomtene i serien (uten pant)? */
  function eierHelSerie(s, pid, serieId) {
    var t = MM.tomterISerie(serieId);
    for (var i = 0; i < t.length; i++) {
      var d = tomt(s, t[i].pos);
      if (!d || d.eier !== pid) return false;
    }
    return true;
  }
  E.eierHelSerie = eierHelSerie;

  /* Alle hele serier en spiller eier */
  function heleSerier(s, pid) {
    return MM.SERIES.filter(function (se) {
      return eierHelSerie(s, pid, se.id);
    }).map(function (se) { return se.id; });
  }
  E.heleSerier = heleSerier;

  /* Hvem har 8+ aksjer i serien? (utbyttemottaker) */
  function storAksjonar(s, serieId) {
    for (var i = 0; i < s.spillere.length; i++) {
      var p = s.spillere[i];
      if (!p.konkurs && (p.aksjer[serieId] || 0) >= MM.UTBYTTE_GRENSE) return p;
    }
    return null;
  }
  E.storAksjonar = storAksjonar;

  /* ------------------------------------------------------------
     Leie
     ------------------------------------------------------------ */
  function grunnLeie(s, pos) {
    var felt = MM.BOARD[pos];
    var d = tomt(s, pos);
    if (!felt || felt.type !== 'tomt' || !d || !d.eier || d.pant) return 0;
    if (d.slott) return felt.leie[6];
    if (d.hotell) return felt.leie[5];
    if (d.hus > 0) return felt.leie[d.hus];
    var b = felt.leie[0];
    if (eierHelSerie(s, d.eier, felt.serie)) b *= 2;   // hel serie = dobbel grunnleie
    return b;
  }
  E.grunnLeie = grunnLeie;

  /* Hva betaler denne spilleren faktisk? Aksjer gir rabatt. */
  function leieFor(s, pos, betalerId) {
    var felt = MM.BOARD[pos];
    var raa = grunnLeie(s, pos);
    if (!raa) return { sum: 0, raa: 0, rabatt: null };
    var betaler = sp(s, betalerId);
    if (!betaler) return { sum: raa, raa: raa, rabatt: null };
    var eide = betaler.aksjer[felt.serie] || 0;
    if (eide >= MM.LEIEFRITAK_ALLE) return { sum: 0, raa: raa, rabatt: 'alle10' };
    if (eide >= MM.UTBYTTE_GRENSE) return { sum: Math.round(raa / 2), raa: raa, rabatt: 'halv' };
    if (betaler.immun > 0) return { sum: 0, raa: raa, rabatt: 'trafikkfyr' };
    return { sum: raa, raa: raa, rabatt: null };
  }
  E.leieFor = leieFor;

  /* ------------------------------------------------------------
     Penger
     ------------------------------------------------------------ */
  function gi(s, p, sum, ut, aarsak) {
    p.cash += sum;
    if (sum > 0) hend(ut, 'penger-inn', p.navn + ' +' + kr(sum) + (aarsak ? ' (' + aarsak + ')' : ''), { pid: p.id, sum: sum });
    else if (sum < 0) hend(ut, 'penger-ut', p.navn + ' ' + kr(sum) + (aarsak ? ' (' + aarsak + ')' : ''), { pid: p.id, sum: sum });
    if (p.cash < 0) p.maaSkaffe = true;
    else p.maaSkaffe = false;
    return p.cash;
  }
  E.gi = gi;

  /* ------------------------------------------------------------
     Børskurs
     ------------------------------------------------------------ */
  function flyttKurs(s, serieId, delta, ut) {
    if (!delta) return;
    var fra = s.kurs[serieId];
    var til = Math.max(0, Math.min(MM.STOCK_LADDER.length - 1, fra + delta));
    if (til === fra) return;
    s.kurs[serieId] = til;
    var se = MM.serie(serieId);
    hend(ut, delta > 0 ? 'kurs-opp' : 'kurs-ned',
      se.navn + ' ' + (delta > 0 ? '▲' : '▼') + ' ' + kr(MM.STOCK_LADDER[til]),
      { serie: serieId, fra: fra, til: til, delta: til - fra });
  }
  E.flyttKurs = flyttKurs;

  /* Leie som faktisk ble krevd inn på en serie flytter kursen opp */
  function kursOppAvLeie(s, serieId, sum, ut) {
    var steg = Math.floor(sum / MM.BORS_TERSKEL);
    if (steg > 0) flyttKurs(s, serieId, steg, ut);
  }

  /* Betaler du 20 000+ i leie, faller kursen på ALLE hele serier du eier */
  function kursNedAvUtgift(s, betalerId, sum, ut) {
    var steg = Math.floor(sum / MM.BORS_TERSKEL);
    if (steg <= 0) return;
    heleSerier(s, betalerId).forEach(function (sid) {
      flyttKurs(s, sid, -steg, ut);
    });
  }

  /* ------------------------------------------------------------
     Formue
     ------------------------------------------------------------ */
  function formue(s, p) {
    var sum = p.cash;
    for (var pos in s.tomter) {
      var d = s.tomter[pos];
      if (d.eier !== p.id) continue;
      var felt = MM.BOARD[Number(pos)];
      sum += d.pant ? felt.pant : felt.pris;
      var hus = d.hus || 0;
      if (d.hotell || d.slott) hus = 5;        // hotell/slott = 5 hus
      sum += hus * felt.husPris;
    }
    MM.SERIES.forEach(function (se) {
      sum += (p.aksjer[se.id] || 0) * kursPris(s, se.id);
    });
    sum -= (p.gjeld || 0) * MM.GJELDSBREV;
    return sum;
  }
  E.formue = formue;

  /* Kan spilleren skaffe penger på egen hånd? */
  function harUtveier(s, p) {
    if (p.gjeld < MM.GJELDSBREV_MAKS) return true;
    var funnet = false;
    MM.SERIES.forEach(function (se) { if ((p.aksjer[se.id] || 0) > 0) funnet = true; });
    if (funnet) return true;
    for (var pos in s.tomter) {
      var d = s.tomter[pos];
      if (d.eier !== p.id) continue;
      if (d.hus > 0 || d.hotell || d.slott) return true;
      if (!d.pant) return true;
    }
    return false;
  }
  E.harUtveier = harUtveier;

  function konkurs(s, p, ut) {
    p.konkurs = true;
    p.maaSkaffe = false;
    p.cash = 0;
    /* Alt går tilbake til banken — aksjene må leveres inn, ikke
       forsvinne, ellers kan ikke de andre kjøpe dem igjen. */
    MM.SERIES.forEach(function (se) {
      s.bank.aksjer[se.id] += p.aksjer[se.id] || 0;
      p.aksjer[se.id] = 0;
    });
    var tomter = 0;
    for (var pos in s.tomter) {
      if (s.tomter[pos].eier === p.id) {
        s.tomter[pos] = tomNull();
        tomter++;
      }
    }
    p.gjeld = 0;
    hend(ut, 'konkurs',
      p.navn + ' er konkurs og ute av spillet' +
      (tomter ? '. ' + tomter + ' tomt(er) og alle aksjer går tilbake til banken' : ''),
      { pid: p.id, tomter: tomter });
  }

  function tomNull() {
    return { eier: null, hus: 0, hotell: false, slott: false, pant: false };
  }

  /* ------------------------------------------------------------
     Slutt-tilstand
     ------------------------------------------------------------ */
  function sjekkSlutt(s, ut) {
    if (s.fase !== 'spiller') return;
    var lev = levende(s);

    var topp = null;
    lev.forEach(function (p) {
      var f = formue(s, p);
      p.stat.toppFormue = Math.max(p.stat.toppFormue || 0, f);
      if (!topp || f > topp.f) topp = { p: p, f: f };
    });

    var slutt = null;
    if (lev.length <= 1 && s.spillere.length > 1) {
      slutt = { grunn: 'konkurs', vinnerId: lev.length ? lev[0].id : null };
    } else if (topp && topp.f >= s.regler.mal) {
      slutt = { grunn: 'mal', vinnerId: topp.p.id };
    } else if (s.regler.tidsgrenseMin > 0 && s.startet &&
               Date.now() - s.startet > s.regler.tidsgrenseMin * 60000) {
      slutt = { grunn: 'tid', vinnerId: topp ? topp.p.id : null };
    }
    if (!slutt) return;

    s.fase = 'ferdig';
    s.vinner = slutt;
    s.resultat = s.spillere.map(function (p) {
      return {
        id: p.id, navn: p.navn, figur: p.figur,
        formue: p.konkurs ? 0 : formue(s, p),
        konkurs: p.konkurs,
        stat: klon(p.stat)
      };
    }).sort(function (a, b) { return b.formue - a.formue; });
    s.resultat.forEach(function (r, i) { r.plass = i + 1; });
    var v = sp(s, slutt.vinnerId);
    hend(ut, 'slutt',
      (v ? v.navn : 'Ingen') + ' vinner! ' +
      (slutt.grunn === 'mal' ? 'Multimilliardær!' : slutt.grunn === 'tid' ? 'Tiden er ute.' : 'Alle andre er konkurs.'),
      slutt);
  }
  E.sjekkSlutt = sjekkSlutt;

  /* ------------------------------------------------------------
     Nytt spill
     ------------------------------------------------------------ */
  E.nyttSpill = function (id, regler) {
    var s = {
      v: 0,
      id: id,
      fase: 'lobby',
      opprettet: Date.now(),
      oppdatert: Date.now(),
      startet: null,
      regler: {
        mal: (regler && regler.mal) || 2000000,
        startKapital: (regler && regler.startKapital) || 150000,
        tidsgrenseMin: (regler && regler.tidsgrenseMin) || 0
      },
      vertId: null,
      spillere: [],
      ola: { pos: 0 },
      kurs: {},
      bank: { aksjer: {} },
      tomter: {},
      tur: { i: 0, rekkefolge: [], steg: 'lobby', terning: null, olaTerning: null, doble: 0, ventende: null },
      auksjon: null,
      kortstokk: [],
      kortVist: null,
      logg: [],
      seq: 0,
      vinner: null,
      resultat: null
    };
    MM.SERIES.forEach(function (se) {
      s.kurs[se.id] = se.startNiva;
      s.bank.aksjer[se.id] = MM.AKSJER_PER_SERIE;
    });
    MM.tomter.forEach(function (f) { s.tomter[String(f.pos)] = tomNull(); });
    return s;
  };

  function nyKortstokk() {
    var idx = MM.KORT.map(function (_, i) { return i; });
    for (var i = idx.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    return idx;
  }

  /* ------------------------------------------------------------
     handling() — ett inngangspunkt for alle handlinger
     ------------------------------------------------------------ */
  E.handling = function (inn, a) {
    var s = klon(inn);
    var ut = [];
    var fn = HANDLINGER[a.type];
    if (!fn) throw new Error('Ukjent handling: ' + a.type);
    fn(s, a, ut);
    s.oppdatert = Date.now();
    ut.forEach(function (h) { h.seq = ++s.seq; });
    s.logg = s.logg.concat(ut).slice(-60);
    return { state: s, hendelser: ut };
  };

  var HANDLINGER = {};

  /* ---------- Lobby ---------- */
  HANDLINGER.BLI_MED = function (s, a, ut) {
    if (s.fase !== 'lobby') throw new Error('Spillet er alt i gang');
    if (sp(s, a.pid)) return;
    if (s.spillere.length >= MM.MAKS_SPILLERE) throw new Error('Spillet er fullt');
    var tatt = s.spillere.map(function (p) { return p.figur; });
    var figur = a.figur;
    if (!figur || tatt.indexOf(figur) >= 0) {
      figur = (MM.FIGURER.filter(function (f) { return tatt.indexOf(f.id) < 0; })[0] || MM.FIGURER[0]).id;
    }
    var p = {
      id: a.pid,
      navn: (a.navn || 'Spiller').slice(0, 18),
      figur: figur,
      cash: s.regler.startKapital,
      pos: 0,
      aksjer: {},
      gjeld: 0,
      paaFerie: false,
      ferieOpphold: 0,
      immun: 0,
      konkurs: false,
      maaSkaffe: false,
      klar: false,
      sett: Date.now(),
      stat: { leieInn: 0, leieUt: 0, utbytte: 0, kast: 0, doble: 0, casinoNetto: 0, aksjerKjopt: 0, toppFormue: 0, tomter: 0 }
    };
    MM.SERIES.forEach(function (se) { p.aksjer[se.id] = 0; });
    s.spillere.push(p);
    if (!s.vertId) { s.vertId = p.id; }
    hend(ut, 'bli-med', p.navn + ' er med i spillet', { pid: p.id, figur: figur });
  };

  HANDLINGER.VELG_FIGUR = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p || s.fase !== 'lobby') return;
    var tatt = s.spillere.filter(function (q) { return q.id !== p.id; }).map(function (q) { return q.figur; });
    if (tatt.indexOf(a.figur) >= 0) throw new Error('Figuren er tatt');
    p.figur = a.figur;
    hend(ut, 'figur', p.navn + ' valgte ' + MM.figur(a.figur).navn, { pid: p.id, figur: a.figur });
  };

  HANDLINGER.ENDRE_NAVN = function (s, a) {
    var p = sp(s, a.pid);
    if (p) p.navn = (a.navn || p.navn).slice(0, 18);
  };

  HANDLINGER.KLAR = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p) return;
    p.klar = !!a.klar;
    hend(ut, 'klar', p.navn + (p.klar ? ' er klar' : ' er ikke klar lenger'), { pid: p.id });
  };

  HANDLINGER.KREV_VERT = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p) return;
    if (s.vertId && s.vertId !== a.pid) {
      var gammel = sp(s, s.vertId);
      if (gammel && !gammel.konkurs && Date.now() - (gammel.sett || 0) < 60000) {
        throw new Error('Vertsrollen er tatt av ' + gammel.navn);
      }
    }
    s.vertId = a.pid;
    hend(ut, 'vert', p.navn + ' er spillvert', { pid: p.id });
  };

  HANDLINGER.SETT_REGLER = function (s, a, ut) {
    if (a.pid !== s.vertId) throw new Error('Bare spillverten kan endre regler');
    if (s.fase !== 'lobby') throw new Error('For seint');
    if (a.regler.mal) s.regler.mal = Math.max(200000, Number(a.regler.mal));
    if (a.regler.startKapital) {
      s.regler.startKapital = Math.max(50000, Number(a.regler.startKapital));
      s.spillere.forEach(function (p) { p.cash = s.regler.startKapital; });
    }
    if (a.regler.tidsgrenseMin !== undefined) s.regler.tidsgrenseMin = Math.max(0, Number(a.regler.tidsgrenseMin));
    hend(ut, 'regler', 'Reglene er oppdatert', klon(s.regler));
  };

  HANDLINGER.START = function (s, a, ut) {
    if (a.pid !== s.vertId) throw new Error('Bare spillverten kan starte');
    if (s.fase !== 'lobby') throw new Error('Spillet er alt i gang');
    if (s.spillere.length < 2) throw new Error('Minst to spillere');

    // Aksjene fordeles likt. Resten blir liggende i banken.
    var n = s.spillere.length;
    var hver = Math.floor(MM.AKSJER_PER_SERIE / n);
    MM.SERIES.forEach(function (se) {
      s.spillere.forEach(function (p) { p.aksjer[se.id] = hver; });
      s.bank.aksjer[se.id] = MM.AKSJER_PER_SERIE - hver * n;
    });

    // Tilfeldig rekkefølge
    var ids = s.spillere.map(function (p) { return p.id; });
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    s.tur = { i: 0, rekkefolge: ids, steg: 'ola-kast', terning: null, olaTerning: null, doble: 0, ventende: null };
    s.kortstokk = nyKortstokk();
    s.fase = 'spiller';
    s.startet = Date.now();
    hend(ut, 'start', 'Spillet er i gang! ' + hver + ' aksjer per serie til hver spiller.', { rekkefolge: ids, hver: hver });
    hend(ut, 'tur', sp(s, ids[0]).navn + ' starter — kast for Ola Nordmann', { pid: ids[0] });
  };

  HANDLINGER.PULS = function (s, a) {
    var p = sp(s, a.pid);
    if (p) p.sett = Date.now();
  };

  /* ---------- Terningkast for Ola Nordmann ---------- */
  HANDLINGER.KAST_OLA = function (s, a, ut) {
    krevTur(s, a);
    if (s.tur.steg !== 'ola-kast') throw new Error('Ikke riktig steg');
    var p = aktiv(s);
    var d = a.terning;
    var sum = d[0] + d[1];
    s.tur.olaTerning = d;
    p.stat.kast++;

    var fra = s.ola.pos;
    s.ola.pos = (s.ola.pos + sum) % MM.BOARD.length;
    hend(ut, 'ola-flytt',
      MM.OLA.navn + ' kaster ' + d[0] + ' + ' + d[1] + ' og går til ' + MM.BOARD[s.ola.pos].navn,
      { fra: fra, til: s.ola.pos, terning: d, pid: p.id });

    olaOppgjor(s, ut);

    /* Dobbelt gir Ola et nytt kast. Teller også når kastet utløste en
       auksjon eller et valg — da kommer ekstrakastet når det er avklart,
       og etterOppgjor() lar steget stå på 'ola-kast'. */
    if (d[0] === d[1] && s.tur.doble < 2) {
      s.tur.doble++;
      hend(ut, 'doble', 'Dobbelt! ' + MM.OLA.navn + ' går en gang til', { pid: p.id });
      return;                    // steg forblir 'ola-kast'
    }
    s.tur.doble = 0;
    if (!s.tur.ventende) rente(s, ut);
  };

  function olaOppgjor(s, ut) {
    var pos = s.ola.pos;
    var felt = MM.BOARD[pos];
    var p = aktiv(s);

    if (felt.type === 'tomt') {
      var d = tomt(s, pos);
      if (d.eier) {
        var raa = grunnLeie(s, pos);
        if (raa > 0) {
          var eier = sp(s, d.eier);
          gi(s, eier, raa, ut, MM.OLA.navn + ' på ' + felt.navn);
          eier.stat.leieInn += raa;
          hend(ut, 'ola-leie', MM.OLA.navn + ' betaler ' + kr(raa) + ' til ' + eier.navn + ' for ' + felt.navn,
            { pid: eier.id, sum: raa, pos: pos });
          utbytte(s, felt.serie, raa, ut);
          kursOppAvLeie(s, felt.serie, raa, ut);
        }
      } else {
        s.tur.ventende = { type: 'auksjon-start', pos: pos, grunn: 'ola' };
        hend(ut, 'auksjon-varsel', MM.OLA.navn + ' fant ledig tomt: ' + felt.navn + ' går på auksjon', { pos: pos });
      }
    } else if (felt.type === 'bors') {
      var kanSelge = harNoeASelge(s, p.id);
      if (kanSelge) {
        s.tur.ventende = { type: 'bors', antall: 1, grunn: 'ola' };
        hend(ut, 'bors', MM.OLA.navn + ' på ' + felt.navn + ': ' + p.navn + ' kan kjøpe 1 aksje fra en motspiller til dobbel kurs', { pid: p.id });
      }
    }
    // Ola betaler ikke skatt, trekker ikke kort, spiller ikke casino, drar ikke på ferie.
  }

  function harNoeASelge(s, kjoperId) {
    var funnet = false;
    s.spillere.forEach(function (q) {
      if (q.id === kjoperId || q.konkurs) return;
      MM.SERIES.forEach(function (se) { if ((q.aksjer[se.id] || 0) > 0) funnet = true; });
    });
    return funnet;
  }

  /* 8-10 aksjer i en serie = 50 % av leieinntekten, betalt av banken */
  function utbytte(s, serieId, leie, ut) {
    var a = storAksjonar(s, serieId);
    if (!a || leie <= 0) return;
    var sum = Math.round(leie / 2);
    gi(s, a, sum, ut, 'utbytte ' + MM.serie(serieId).navn);
    a.stat.utbytte += sum;
    hend(ut, 'utbytte', a.navn + ' får ' + kr(sum) + ' i utbytte (' +
      (a.aksjer[serieId]) + ' aksjer i ' + MM.serie(serieId).navn + ')',
      { pid: a.id, sum: sum, serie: serieId });
  }

  function rente(s, ut) {
    var p = aktiv(s);
    if (p.gjeld > 0) {
      var sum = p.gjeld * MM.GJELDSBREV_RENTE;
      gi(s, p, -sum, ut, 'rente på ' + p.gjeld + ' gjeldsbrev');
      hend(ut, 'rente', p.navn + ' betaler ' + kr(sum) + ' i rente (' + p.gjeld + ' gjeldsbrev)', { pid: p.id, sum: sum });
    }
    if (p.paaFerie) {
      s.tur.steg = 'ferie-valg';
      hend(ut, 'ferie-valg', p.navn + ' er på Feriehotellet — bli eller reise?', { pid: p.id });
    } else {
      s.tur.steg = 'bil-kast';
    }
    sjekkSlutt(s, ut);
  }

  /* ---------- Terningkast for egen bil ---------- */
  HANDLINGER.KAST_BIL = function (s, a, ut) {
    krevTur(s, a);
    if (s.tur.steg !== 'bil-kast') throw new Error('Ikke riktig steg');
    var p = aktiv(s);
    var d = a.terning;
    s.tur.terning = d;
    p.stat.kast++;
    if (d[0] === d[1]) p.stat.doble++;

    var fra = p.pos;
    var sum = d[0] + d[1];
    p.pos = (p.pos + sum) % MM.BOARD.length;
    var passerteStart = fra + sum >= MM.BOARD.length;
    hend(ut, 'flytt', p.navn + ' kaster ' + d[0] + ' + ' + d[1] + ' og går til ' + MM.BOARD[p.pos].navn,
      { pid: p.id, fra: fra, til: p.pos, terning: d, start: passerteStart });

    bilOppgjor(s, p, ut);

    /* Som for Ola: dobbelt teller selv om kastet utløste et valg */
    if (d[0] === d[1] && s.tur.doble < 2 && !p.paaFerie && s.fase === 'spiller') {
      s.tur.doble++;
      hend(ut, 'doble', 'Dobbelt! ' + p.navn + ' kaster en gang til', { pid: p.id });
      s.tur.steg = 'bil-kast';
      sjekkSlutt(s, ut);
      return;
    }
    s.tur.doble = 0;
    if (!s.tur.ventende && s.fase === 'spiller') s.tur.steg = 'handel';
    sjekkSlutt(s, ut);
  };

  function bilOppgjor(s, p, ut) {
    var pos = p.pos;
    var felt = MM.BOARD[pos];

    switch (felt.type) {
      case 'tomt': {
        var d = tomt(s, pos);
        if (!d.eier) {
          if (felt.auksjonKun) {
            s.tur.ventende = { type: 'auksjon-start', pos: pos, grunn: 'auksjonskun' };
            hend(ut, 'auksjon-varsel', felt.navn + ' selges bare på auksjon', { pos: pos });
          } else {
            s.tur.ventende = { type: 'kjop', pos: pos };
            hend(ut, 'kjop-valg', p.navn + ' kan kjøpe ' + felt.navn + ' for ' + kr(felt.pris), { pid: p.id, pos: pos });
          }
        } else if (d.eier !== p.id) {
          var l = leieFor(s, pos, p.id);
          var eier = sp(s, d.eier);
          if (l.sum <= 0) {
            var grunn = l.rabatt === 'alle10' ? 'eier alle 10 aksjene' :
                        l.rabatt === 'trafikkfyr' ? 'leiefritak fra Trafikkfyr' : 'ingen leie';
            if (l.rabatt === 'trafikkfyr') p.immun = 0;
            hend(ut, 'leiefritak', p.navn + ' slipper leie på ' + felt.navn + ' (' + grunn + ')', { pid: p.id, pos: pos });
          } else {
            gi(s, p, -l.sum, ut, 'leie ' + felt.navn);
            gi(s, eier, l.sum, ut, 'leie fra ' + p.navn);
            p.stat.leieUt += l.sum;
            eier.stat.leieInn += l.sum;
            hend(ut, 'leie', p.navn + ' betaler ' + kr(l.sum) + ' i leie til ' + eier.navn + ' for ' + felt.navn +
              (l.rabatt === 'halv' ? ' (halv leie — 8 aksjer)' : ''),
              { pid: p.id, eier: eier.id, sum: l.sum, pos: pos });
            utbytte(s, felt.serie, l.sum, ut);
            kursOppAvLeie(s, felt.serie, l.sum, ut);
            kursNedAvUtgift(s, p.id, l.sum, ut);
            if (p.cash < 0) trengerPenger(s, p, ut);
          }
        }
        break;
      }
      case 'sjanse': {
        if (!s.kortstokk.length) s.kortstokk = nyKortstokk();
        var ki = s.kortstokk.shift();
        s.kortVist = { kort: ki, pid: p.id, t: Date.now() };
        s.tur.ventende = { type: 'kort', kort: ki };
        hend(ut, 'kort', p.navn + ' trekker et sjansekort', { pid: p.id, kort: ki });
        break;
      }
      case 'ferie': {
        s.tur.ventende = { type: 'ferie-ankomst' };
        hend(ut, 'ferie', p.navn + ' er på Feriehotellet', { pid: p.id });
        break;
      }
      case 'bors': {
        if (harNoeASelge(s, p.id)) {
          s.tur.ventende = { type: 'bors', antall: felt.antall || 2, grunn: 'bil' };
          hend(ut, 'bors', p.navn + ' kan kjøpe ' + (felt.antall || 2) + ' aksje(r) fra en motspiller til dobbel kurs', { pid: p.id });
        }
        break;
      }
      case 'casino': {
        s.tur.ventende = { type: 'casino' };
        hend(ut, 'casino', p.navn + ' er på Casino', { pid: p.id });
        break;
      }
      case 'skatt': {
        var skatt = Math.round(Math.max(0, p.cash) * MM.SKATT_PST / 100) * 100;
        if (skatt > 0) {
          gi(s, p, -skatt, ut, 'formuesskatt');
          hend(ut, 'skatt', p.navn + ' betaler ' + kr(skatt) + ' i formuesskatt', { pid: p.id, sum: skatt });
        }
        break;
      }
      case 'trafikkfyr': {
        p.immun = 2;
        hend(ut, 'trafikkfyr', p.navn + ' har leiefritak til neste tur', { pid: p.id });
        break;
      }
      case 'start':
        hend(ut, 'start-felt', p.navn + ' står på START. Ingen lønn her.', { pid: p.id });
        break;
    }
  }

  function trengerPenger(s, p, ut) {
    p.maaSkaffe = true;
    if (!harUtveier(s, p)) {
      konkurs(s, p, ut);
      if (aktivId(s) === p.id) nesteTur(s, ut);
      return;
    }
    s.tur.ventende = { type: 'skaff-penger', pid: p.id };
    hend(ut, 'skaff-penger', p.navn + ' mangler ' + kr(-p.cash) + ' og må skaffe penger', { pid: p.id });
  }

  /* ---------- Kjøp / auksjon ---------- */
  HANDLINGER.KJOP = function (s, a, ut) {
    krevTur(s, a);
    var v = s.tur.ventende;
    if (!v || v.type !== 'kjop') throw new Error('Ingenting å kjøpe');
    var felt = MM.BOARD[v.pos];
    var p = aktiv(s);
    if (p.cash < felt.pris) throw new Error('Ikke nok penger');
    gi(s, p, -felt.pris, ut, 'kjøp ' + felt.navn);
    s.tomter[String(v.pos)].eier = p.id;
    p.stat.tomter++;
    hend(ut, 'kjopt', p.navn + ' kjøpte ' + felt.navn + ' for ' + kr(felt.pris), { pid: p.id, pos: v.pos, sum: felt.pris });
    s.tur.ventende = null;
    s.tur.steg = 'handel';
    sjekkSlutt(s, ut);
  };

  HANDLINGER.TIL_AUKSJON = function (s, a, ut) {
    var v = s.tur.ventende;
    if (!v || (v.type !== 'kjop' && v.type !== 'auksjon-start')) throw new Error('Ingen auksjon nå');
    if (v.type === 'kjop') krevTur(s, a);
    startAuksjon(s, v.pos, ut);
  };

  function startAuksjon(s, pos, ut) {
    var felt = MM.BOARD[pos];
    var minste = Math.max(1000, Math.round(felt.pris * 0.05 / 1000) * 1000);
    s.auksjon = {
      pos: pos,
      hoyeste: 0,
      hoyesteId: null,
      steg: minste,
      utgaar: Date.now() + MM.AUKSJON_SEKUNDER * 1000,
      passert: []
    };
    s.tur.ventende = { type: 'auksjon' };
    hend(ut, 'auksjon-start', 'Auksjon: ' + felt.navn + ' (takst ' + kr(felt.pris) + ')', { pos: pos, steg: minste });
  }

  HANDLINGER.BUD = function (s, a, ut) {
    var au = s.auksjon;
    if (!au) throw new Error('Ingen auksjon');
    var p = sp(s, a.pid);
    if (!p || p.konkurs) throw new Error('Du kan ikke by');
    if (au.passert.indexOf(a.pid) >= 0) throw new Error('Du har passert');
    var bud = Number(a.sum);
    var minste = au.hoyeste + au.steg;
    if (au.hoyeste === 0) minste = au.steg;
    if (bud < minste) throw new Error('Minste bud er ' + kr(minste));
    if (bud > p.cash) throw new Error('Du har ikke ' + kr(bud));
    au.hoyeste = bud;
    au.hoyesteId = a.pid;
    au.utgaar = Math.max(au.utgaar, Date.now() + 8000);
    hend(ut, 'bud', p.navn + ' byr ' + kr(bud) + ' på ' + MM.BOARD[au.pos].navn, { pid: p.id, sum: bud, pos: au.pos });
  };

  HANDLINGER.PASS = function (s, a, ut) {
    var au = s.auksjon;
    if (!au) return;
    var p = sp(s, a.pid);
    if (!p || au.passert.indexOf(a.pid) >= 0) return;
    au.passert.push(a.pid);
    hend(ut, 'pass', p.navn + ' passerte', { pid: p.id });
    var med = levende(s).filter(function (q) { return au.passert.indexOf(q.id) < 0; });
    if (med.length <= 1 && au.hoyesteId) au.utgaar = Math.min(au.utgaar, Date.now() + 1500);
    if (!med.length) au.utgaar = Date.now();
  };

  HANDLINGER.AUKSJON_SLUTT = function (s, a, ut) {
    var au = s.auksjon;
    if (!au) return;
    if (Date.now() < au.utgaar - 500 && a.tving !== true) throw new Error('Auksjonen pågår');
    var felt = MM.BOARD[au.pos];
    if (au.hoyesteId) {
      var p = sp(s, au.hoyesteId);
      gi(s, p, -au.hoyeste, ut, 'auksjon ' + felt.navn);
      s.tomter[String(au.pos)].eier = p.id;
      p.stat.tomter++;
      hend(ut, 'auksjon-slutt', p.navn + ' vant auksjonen på ' + felt.navn + ' for ' + kr(au.hoyeste),
        { pid: p.id, pos: au.pos, sum: au.hoyeste });
    } else {
      hend(ut, 'auksjon-slutt', 'Ingen bud. ' + felt.navn + ' blir liggende hos banken.', { pos: au.pos });
    }
    s.auksjon = null;
    s.tur.ventende = null;
    etterOppgjor(s, ut);
  };

  /* Etter at et ventende valg er løst: hvor går turen videre? */
  function etterOppgjor(s, ut) {
    if (s.fase !== 'spiller') return;
    var p = aktiv(s);
    if (!p) return;
    if (p.cash < 0) { trengerPenger(s, p, ut); return; }
    if (s.tur.steg === 'ola-kast') {
      if (s.tur.doble > 0) return;
      rente(s, ut);
    } else if (s.tur.steg === 'bil-kast') {
      if (s.tur.doble > 0) return;
      s.tur.steg = 'handel';
    } else if (s.tur.steg !== 'handel' && s.tur.steg !== 'ferie-valg') {
      s.tur.steg = 'handel';
    }
    sjekkSlutt(s, ut);
  }

  /* ---------- Sjansekort ---------- */
  HANDLINGER.KORT_OK = function (s, a, ut) {
    krevTur(s, a);
    var v = s.tur.ventende;
    if (!v || v.type !== 'kort') throw new Error('Ingen kort');
    var kort = MM.KORT[v.kort];
    var p = aktiv(s);
    s.tur.ventende = null;
    s.kortVist = null;
    hend(ut, 'kort-virkning', p.navn + ': ' + kort.t.replace(/<[^>]+>/g, ''), { pid: p.id, kort: v.kort });
    virkning(s, p, kort.fx, ut, a);
    if (!s.tur.ventende) etterOppgjor(s, ut);
  };

  function tilfeldigSerie(s, p, bareEid) {
    var liste = MM.SERIES.map(function (x) { return x.id; });
    if (bareEid) {
      var eid = liste.filter(function (id) { return (p.aksjer[id] || 0) > 0; });
      if (eid.length) liste = eid;
    }
    return liste[Math.floor(Math.random() * liste.length)];
  }

  function virkning(s, p, fx, ut, a) {
    switch (fx.type) {
      case 'kontant':
        gi(s, p, fx.sum, ut, 'sjansekort');
        if (p.cash < 0) trengerPenger(s, p, ut);
        break;
      case 'skattPst': {
        var sum = Math.round(Math.max(0, p.cash) * fx.pst / 100) * 100;
        gi(s, p, -sum, ut, 'sjansekort: skatt');
        break;
      }
      case 'utbyttePerAksje': {
        var n = 0;
        MM.SERIES.forEach(function (se) { n += p.aksjer[se.id] || 0; });
        gi(s, p, n * fx.sum, ut, n + ' aksjer');
        break;
      }
      case 'kreveAlle':
        levende(s).forEach(function (q) {
          if (q.id === p.id) return;
          gi(s, q, -fx.sum, ut, 'til ' + p.navn);
          gi(s, p, fx.sum, ut, 'fra ' + q.navn);
          if (q.cash < 0) q.maaSkaffe = true;
        });
        break;
      case 'betalAlle':
        levende(s).forEach(function (q) {
          if (q.id === p.id) return;
          gi(s, p, -fx.sum, ut, 'til ' + q.navn);
          gi(s, q, fx.sum, ut, 'fra ' + p.navn);
        });
        if (p.cash < 0) trengerPenger(s, p, ut);
        break;
      case 'aksjer': {
        var sid = fx.serie === 'tilfeldig' ? tilfeldigSerie(s, p, fx.antall < 0) : fx.serie;
        var ant = fx.antall;
        if (ant > 0) ant = Math.min(ant, s.bank.aksjer[sid]);
        else ant = -Math.min(-ant, p.aksjer[sid] || 0);
        if (ant !== 0) {
          p.aksjer[sid] += ant;
          s.bank.aksjer[sid] -= ant;
          hend(ut, 'aksjer', p.navn + (ant > 0 ? ' fikk ' : ' mistet ') + Math.abs(ant) +
            ' aksje(r) i ' + MM.serie(sid).navn, { pid: p.id, serie: sid, antall: ant });
        }
        break;
      }
      case 'kurs': {
        if (fx.serie === 'alle') MM.SERIES.forEach(function (se) { flyttKurs(s, se.id, fx.delta, ut); });
        else flyttKurs(s, fx.serie === 'eid' ? tilfeldigSerie(s, p, true) : tilfeldigSerie(s, p, false), fx.delta, ut);
        break;
      }
      case 'ferie':
        p.pos = 10;
        p.paaFerie = true;
        p.ferieOpphold = 0;
        hend(ut, 'ferie', p.navn + ' sendes til Feriehotellet', { pid: p.id });
        break;
      case 'slettGjeld':
        if (p.gjeld > 0) {
          p.gjeld = Math.max(0, p.gjeld - fx.antall);
          hend(ut, 'gjeld', p.navn + ' fikk slettet gjeldsbrev. Nå: ' + p.gjeld, { pid: p.id });
        }
        break;
      case 'laan':
        if (p.gjeld < MM.GJELDSBREV_MAKS) {
          p.gjeld++;
          gi(s, p, MM.GJELDSBREV, ut, 'tvangslån');
          hend(ut, 'gjeld', p.navn + ' tok opp et gjeldsbrev. Nå: ' + p.gjeld, { pid: p.id });
        }
        break;
      case 'immunitet':
        p.immun = 2;
        break;
      case 'tilStart':
        p.pos = 0;
        hend(ut, 'flytt', p.navn + ' går til START', { pid: p.id, til: 0 });
        break;
      case 'flyttTil':
        p.pos = fx.pos;
        hend(ut, 'flytt', p.navn + ' flyttes til ' + MM.BOARD[fx.pos].navn, { pid: p.id, til: fx.pos });
        bilOppgjor(s, p, ut);
        break;
      case 'flyttRel':
        p.pos = ((p.pos + fx.n) % MM.BOARD.length + MM.BOARD.length) % MM.BOARD.length;
        hend(ut, 'flytt', p.navn + ' flyttes til ' + MM.BOARD[p.pos].navn, { pid: p.id, til: p.pos });
        bilOppgjor(s, p, ut);
        break;
      case 'gratisHus': {
        var kand = null;
        MM.SERIES.forEach(function (se) {
          if (!eierHelSerie(s, p.id, se.id)) return;
          MM.tomterISerie(se.id).forEach(function (f) {
            var d = s.tomter[String(f.pos)];
            if (d.hotell || d.slott || d.hus >= 4 || d.pant) return;
            if (!kand || d.hus < s.tomter[String(kand.pos)].hus) kand = f;
          });
        });
        if (kand) {
          s.tomter[String(kand.pos)].hus++;
          hend(ut, 'bygg', p.navn + ' fikk et gratis hus på ' + kand.navn, { pid: p.id, pos: kand.pos });
        } else {
          hend(ut, 'info', p.navn + ' har ingen hel serie å bygge på', { pid: p.id });
        }
        break;
      }
    }
  }

  /* ---------- Feriehotellet ---------- */
  HANDLINGER.FERIE_BLI = function (s, a, ut) {
    krevTur(s, a);
    var p = aktiv(s);
    var steg = Math.min(p.ferieOpphold, MM.FERIE_TRAPP.length - 1);
    var pris = MM.FERIE_TRAPP[steg];
    if (pris > p.cash) throw new Error('Du har ikke ' + kr(pris));
    if (pris > 0) gi(s, p, -pris, ut, 'feriehotell');
    p.paaFerie = true;
    p.pos = 10;
    p.ferieOpphold++;
    hend(ut, 'ferie-bli', p.navn + ' blir på Feriehotellet' + (pris ? ' (' + kr(pris) + ')' : ' (gratis)'),
      { pid: p.id, sum: pris, opphold: p.ferieOpphold });
    s.tur.ventende = null;
    nesteTur(s, ut);
  };

  HANDLINGER.FERIE_REIS = function (s, a, ut) {
    krevTur(s, a);
    var p = aktiv(s);
    var d = a.terning;                       // én terning
    p.paaFerie = false;
    p.ferieOpphold = 0;
    var fra = p.pos;
    p.pos = (p.pos + d[0]) % MM.BOARD.length;
    hend(ut, 'ferie-reis', p.navn + ' forlater Feriehotellet med ' + d[0] + ' og går til ' + MM.BOARD[p.pos].navn,
      { pid: p.id, fra: fra, til: p.pos, terning: d });
    s.tur.ventende = null;
    s.tur.terning = [d[0], 0];
    bilOppgjor(s, p, ut);
    if (!s.tur.ventende) s.tur.steg = 'handel';
    sjekkSlutt(s, ut);
  };

  HANDLINGER.FERIE_ANKOMST = function (s, a, ut) {
    krevTur(s, a);
    var p = aktiv(s);
    s.tur.ventende = null;
    if (a.bli) {
      p.paaFerie = true;
      p.ferieOpphold = 0;
      hend(ut, 'ferie-bli', p.navn + ' sjekker inn på Feriehotellet (første opphold gratis)', { pid: p.id });
      nesteTur(s, ut);
    } else {
      hend(ut, 'ferie-nei', p.navn + ' tar bare en kaffe og drar videre', { pid: p.id });
      etterOppgjor(s, ut);
    }
  };

  /* ---------- Casino ---------- */
  HANDLINGER.CASINO = function (s, a, ut) {
    krevTur(s, a);
    var v = s.tur.ventende;
    if (!v || v.type !== 'casino') throw new Error('Ikke på casino');
    var p = aktiv(s);
    s.tur.ventende = null;
    var innsats = Math.max(0, Math.round(Number(a.innsats) || 0));
    if (!innsats) {
      hend(ut, 'casino', p.navn + ' lot være å spille', { pid: p.id });
      etterOppgjor(s, ut);
      return;
    }
    if (innsats > p.cash) throw new Error('Du har ikke så mye');
    var d = a.terning[0];
    if (d === 6) {
      var gevinst = innsats * 10;
      gi(s, p, gevinst, ut, 'casinogevinst');
      p.stat.casinoNetto += gevinst;
      hend(ut, 'casino-vinn', p.navn + ' kastet SEKS og vant ' + kr(gevinst) + '!', { pid: p.id, sum: gevinst, terning: d });
    } else {
      gi(s, p, -innsats, ut, 'casinotap');
      p.stat.casinoNetto -= innsats;
      hend(ut, 'casino-tap', p.navn + ' kastet ' + d + ' og tapte ' + kr(innsats), { pid: p.id, sum: innsats, terning: d });
    }
    etterOppgjor(s, ut);
  };

  /* ---------- Børs-feltet: kjøp fra motspiller til dobbel kurs ---------- */
  HANDLINGER.BORS_KJOP = function (s, a, ut) {
    krevTur(s, a);
    var v = s.tur.ventende;
    if (!v || v.type !== 'bors') throw new Error('Ikke på børsen');
    var p = aktiv(s);
    var mot = sp(s, a.fra);
    if (!mot || mot.id === p.id) throw new Error('Velg en motspiller');
    var ant = Math.max(1, Math.min(Number(a.antall) || 1, v.antall, mot.aksjer[a.serie] || 0));
    var pris = kursPris(s, a.serie) * 2 * ant;
    if (pris <= 0) throw new Error('Serien er suspendert');
    if (pris > p.cash) throw new Error('Ikke nok penger');
    gi(s, p, -pris, ut, 'aksjekjøp');
    gi(s, mot, pris, ut, 'aksjesalg');
    p.aksjer[a.serie] += ant;
    mot.aksjer[a.serie] -= ant;
    p.stat.aksjerKjopt += ant;
    hend(ut, 'bors-kjop', p.navn + ' kjøpte ' + ant + ' aksje(r) i ' + MM.serie(a.serie).navn +
      ' fra ' + mot.navn + ' for ' + kr(pris) + ' (dobbel kurs)',
      { pid: p.id, fra: mot.id, serie: a.serie, antall: ant, sum: pris });
    v.antall -= ant;
    if (v.antall <= 0) { s.tur.ventende = null; etterOppgjor(s, ut); }
    sjekkSlutt(s, ut);
  };

  HANDLINGER.BORS_HOPP_OVER = function (s, a, ut) {
    krevTur(s, a);
    if (!s.tur.ventende || s.tur.ventende.type !== 'bors') return;
    s.tur.ventende = null;
    hend(ut, 'info', aktiv(s).navn + ' takket nei til børshandelen', { pid: a.pid });
    etterOppgjor(s, ut);
  };

  /* ---------- Fri handel (banken) ---------- */
  HANDLINGER.KJOP_AKSJER = function (s, a, ut) {
    var p = sp(s, a.pid);
    krevEgenTurFri(s, a);
    var pris = kursPris(s, a.serie);
    if (pris <= 0) throw new Error('Serien er suspendert — ingen handel');
    var ant = Math.max(1, Number(a.antall) || 1);
    if (ant > s.bank.aksjer[a.serie]) throw new Error('Banken har bare ' + s.bank.aksjer[a.serie]);
    var sum = pris * ant;
    if (sum > p.cash) throw new Error('Ikke nok penger');
    gi(s, p, -sum, ut, 'aksjekjøp');
    p.aksjer[a.serie] += ant;
    s.bank.aksjer[a.serie] -= ant;
    p.stat.aksjerKjopt += ant;
    hend(ut, 'aksje-kjop', p.navn + ' kjøpte ' + ant + ' ' + MM.serie(a.serie).ticker + ' til ' + kr(pris) + ' = ' + kr(sum),
      { pid: p.id, serie: a.serie, antall: ant, sum: sum });
    sjekkSlutt(s, ut);
  };

  HANDLINGER.SELG_AKSJER = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p) throw new Error('Ukjent spiller');
    if (!p.maaSkaffe) krevEgenTurFri(s, a);
    var pris = kursPris(s, a.serie);
    if (pris <= 0) throw new Error('Serien er suspendert — ingen handel');
    var ant = Math.max(1, Math.min(Number(a.antall) || 1, p.aksjer[a.serie] || 0));
    if (!ant) throw new Error('Du har ingen aksjer der');
    var sum = pris * ant;
    gi(s, p, sum, ut, 'aksjesalg');
    p.aksjer[a.serie] -= ant;
    s.bank.aksjer[a.serie] += ant;
    hend(ut, 'aksje-salg', p.navn + ' solgte ' + ant + ' ' + MM.serie(a.serie).ticker + ' til ' + kr(pris) + ' = ' + kr(sum),
      { pid: p.id, serie: a.serie, antall: ant, sum: sum });
    ryddOppSkaff(s, p, ut);
  };

  /* ---------- Bygging ---------- */
  function kanBygge(s, pid, pos) {
    var felt = MM.BOARD[pos];
    if (!felt || felt.type !== 'tomt') return 'Ikke en tomt';
    var d = tomt(s, pos);
    if (d.eier !== pid) return 'Du eier den ikke';
    if (d.pant) return 'Tomta er pantsatt';
    if (!eierHelSerie(s, pid, felt.serie)) return 'Du må eie hele serien';
    if (d.slott) return 'Slottet er ferdig';
    if (d.hotell) return felt.slott ? null : 'Hotellet er ferdig';
    var sosken = MM.tomterISerie(felt.serie);
    for (var i = 0; i < sosken.length; i++) {
      var o = s.tomter[String(sosken[i].pos)];
      if (o.pant) return 'En tomt i serien er pantsatt';
      var mine = d.hus + (d.hotell ? 4 : 0);
      var andre = o.hus + (o.hotell ? 4 : 0);
      if (andre < mine) return 'Bygg jevnt — ' + sosken[i].navn + ' ligger bak';
    }
    return null;
  }
  E.kanBygge = kanBygge;

  HANDLINGER.BYGG = function (s, a, ut) {
    krevEgenTurFri(s, a);
    var p = sp(s, a.pid);
    var feil = kanBygge(s, a.pid, a.pos);
    if (feil) throw new Error(feil);
    var felt = MM.BOARD[a.pos];
    var d = tomt(s, a.pos);
    var pris = felt.husPris;
    if (pris > p.cash) throw new Error('Ikke nok penger');
    gi(s, p, -pris, ut, 'bygging');

    if (d.hotell && felt.slott) {
      d.slott = true;
      hend(ut, 'bygg', p.navn + ' reiste SLOTT på ' + felt.navn + '!', { pid: p.id, pos: a.pos, niva: 'slott' });
    } else if (d.hus >= 4) {
      d.hus = 0;
      d.hotell = true;
      hend(ut, 'bygg', p.navn + ' bygde HOTELL på ' + felt.navn, { pid: p.id, pos: a.pos, niva: 'hotell' });
    } else {
      d.hus++;
      hend(ut, 'bygg', p.navn + ' bygde hus nr. ' + d.hus + ' på ' + felt.navn + ' (' + kr(pris) + ')',
        { pid: p.id, pos: a.pos, niva: d.hus });
    }
    sjekkSlutt(s, ut);
  };

  HANDLINGER.SELG_BYGG = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p) throw new Error('Ukjent spiller');
    if (!p.maaSkaffe) krevEgenTurFri(s, a);
    var felt = MM.BOARD[a.pos];
    var d = tomt(s, a.pos);
    if (!d || d.eier !== a.pid) throw new Error('Du eier den ikke');
    var halv = Math.round(felt.husPris / 2);
    if (d.slott) { d.slott = false; d.hotell = true; }
    else if (d.hotell) { d.hotell = false; d.hus = 4; }
    else if (d.hus > 0) { d.hus--; }
    else throw new Error('Ingenting å selge');
    gi(s, p, halv, ut, 'solgte bygg på ' + felt.navn);
    hend(ut, 'riv', p.navn + ' solgte et bygg på ' + felt.navn + ' for ' + kr(halv), { pid: p.id, pos: a.pos });
    ryddOppSkaff(s, p, ut);
  };

  /* ---------- Pantsetting ---------- */
  HANDLINGER.PANTSETT = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p) throw new Error('Ukjent spiller');
    if (!p.maaSkaffe) krevEgenTurFri(s, a);
    var felt = MM.BOARD[a.pos];
    var d = tomt(s, a.pos);
    if (!d || d.eier !== a.pid) throw new Error('Du eier den ikke');
    if (d.pant) throw new Error('Alt pantsatt');
    if (d.hus > 0 || d.hotell || d.slott) throw new Error('Selg byggene først');
    d.pant = true;
    gi(s, p, felt.pant, ut, 'pantsatte ' + felt.navn);
    hend(ut, 'pant', p.navn + ' pantsatte ' + felt.navn + ' for ' + kr(felt.pant), { pid: p.id, pos: a.pos });
    ryddOppSkaff(s, p, ut);
  };

  HANDLINGER.INNFRI_PANT = function (s, a, ut) {
    krevEgenTurFri(s, a);
    var p = sp(s, a.pid);
    var felt = MM.BOARD[a.pos];
    var d = tomt(s, a.pos);
    if (!d || d.eier !== a.pid || !d.pant) throw new Error('Ingen pant der');
    var sum = Math.round(felt.pant * (1 + MM.PANT_RENTE));
    if (sum > p.cash) throw new Error('Ikke nok penger');
    gi(s, p, -sum, ut, 'innfridde pant');
    d.pant = false;
    hend(ut, 'pant-innfridd', p.navn + ' innfridde pantet på ' + felt.navn + ' for ' + kr(sum), { pid: p.id, pos: a.pos });
  };

  /* ---------- Gjeldsbrev (lov hele tiden, også utenfor tur) ---------- */
  HANDLINGER.LAAN = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p || p.konkurs) throw new Error('Ukjent spiller');
    if (s.fase !== 'spiller') throw new Error('Spillet er ikke i gang');
    if (p.gjeld >= MM.GJELDSBREV_MAKS) throw new Error('Maks ' + MM.GJELDSBREV_MAKS + ' gjeldsbrev');
    p.gjeld++;
    gi(s, p, MM.GJELDSBREV, ut, 'gjeldsbrev ' + p.gjeld);
    hend(ut, 'gjeld', p.navn + ' tok opp gjeldsbrev nr. ' + p.gjeld + ' (' + kr(MM.GJELDSBREV) +
      ', rente ' + kr(MM.GJELDSBREV_RENTE) + ' per tur)', { pid: p.id });
    ryddOppSkaff(s, p, ut);
  };

  HANDLINGER.INNFRI_LAAN = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p || !p.gjeld) throw new Error('Ingen gjeld');
    if (p.cash < MM.GJELDSBREV) throw new Error('Ikke nok penger');
    gi(s, p, -MM.GJELDSBREV, ut, 'innfridde gjeldsbrev');
    p.gjeld--;
    hend(ut, 'gjeld', p.navn + ' innfridde et gjeldsbrev. Igjen: ' + p.gjeld, { pid: p.id });
  };

  function ryddOppSkaff(s, p, ut) {
    if (p.cash >= 0 && p.maaSkaffe) {
      p.maaSkaffe = false;
      if (s.tur.ventende && s.tur.ventende.type === 'skaff-penger' && s.tur.ventende.pid === p.id) {
        s.tur.ventende = null;
        hend(ut, 'berget', p.navn + ' er i balanse igjen', { pid: p.id });
        etterOppgjor(s, ut);
      }
    }
    sjekkSlutt(s, ut);
  }

  HANDLINGER.GI_OPP = function (s, a, ut) {
    var p = sp(s, a.pid);
    if (!p || p.konkurs) return;
    konkurs(s, p, ut);
    if (s.tur.ventende && s.tur.ventende.pid === p.id) s.tur.ventende = null;
    if (aktivId(s) === p.id) nesteTur(s, ut);
    sjekkSlutt(s, ut);
  };

  /* ---------- Turslutt ---------- */
  HANDLINGER.AVSLUTT_TUR = function (s, a, ut) {
    krevTur(s, a);
    if (s.tur.ventende) throw new Error('Du har noe uavklart');
    if (aktiv(s).cash < 0) throw new Error('Du må skaffe penger først');
    nesteTur(s, ut);
    sjekkSlutt(s, ut);
  };

  function nesteTur(s, ut) {
    var p = aktiv(s);
    if (p && p.immun > 0) p.immun--;
    var forsok = 0;
    do {
      s.tur.i = (s.tur.i + 1) % s.tur.rekkefolge.length;
      forsok++;
    } while (forsok < s.tur.rekkefolge.length && (sp(s, aktivId(s)) || {}).konkurs);

    s.tur.steg = 'ola-kast';
    s.tur.terning = null;
    s.tur.olaTerning = null;
    s.tur.doble = 0;
    s.tur.ventende = null;
    var n = aktiv(s);
    if (n) hend(ut, 'tur', 'Det er ' + n.navn + ' sin tur — kast for Ola Nordmann', { pid: n.id });
  }

  /* ---------- Vertens nødbryter ---------- */
  HANDLINGER.VERT_OVERSTYR = function (s, a, ut) {
    if (a.pid !== s.vertId) throw new Error('Bare spillverten');
    if (a.hva === 'hoppTur') {
      hend(ut, 'vert', 'Spillverten hoppet over turen', {});
      s.auksjon = null;
      nesteTur(s, ut);
    } else if (a.hva === 'gi') {
      var m = sp(s, a.mal);
      if (m) { gi(s, m, Number(a.sum) || 0, ut, 'vertsjustering'); hend(ut, 'vert', 'Spillverten justerte ' + m.navn + ' med ' + kr(Number(a.sum) || 0), {}); }
    } else if (a.hva === 'avbrytAuksjon') {
      s.auksjon = null;
      s.tur.ventende = null;
      hend(ut, 'vert', 'Spillverten avbrøt auksjonen', {});
      etterOppgjor(s, ut);
    } else if (a.hva === 'avslutt') {
      s.fase = 'spiller';
      s.regler.tidsgrenseMin = 0.0001;
      hend(ut, 'vert', 'Spillverten avslutter spillet', {});
      s.startet = 1;
      sjekkSlutt(s, ut);
    }
    sjekkSlutt(s, ut);
  };

  /* ---------- Vakter ---------- */
  function krevTur(s, a) {
    if (s.fase !== 'spiller') throw new Error('Spillet er ikke i gang');
    if (aktivId(s) !== a.pid) throw new Error('Det er ikke din tur');
    var p = aktiv(s);
    if (!p || p.konkurs) throw new Error('Du er ute av spillet');
  }

  /* Fri handel: egen tur, og ingenting uavklart */
  function krevEgenTurFri(s, a) {
    if (s.fase !== 'spiller') throw new Error('Spillet er ikke i gang');
    var p = sp(s, a.pid);
    if (!p || p.konkurs) throw new Error('Du er ute av spillet');
    if (aktivId(s) !== a.pid) throw new Error('Du kan bare handle i din egen tur');
    if (s.tur.ventende && s.tur.ventende.type !== 'skaff-penger') throw new Error('Løs det som venter først');
  }

  /* ------------------------------------------------------------
     Lesehjelpere for UI
     ------------------------------------------------------------ */
  E.kanGjore = function (s, pid) {
    var minTur = s.fase === 'spiller' && aktivId(s) === pid;
    var v = s.tur.ventende;
    var p = sp(s, pid);
    return {
      minTur: minTur,
      steg: s.tur.steg,
      ventende: v,
      kastOla: minTur && s.tur.steg === 'ola-kast' && !v,
      kastBil: minTur && s.tur.steg === 'bil-kast' && !v,
      handel: minTur && s.tur.steg === 'handel' && !v,
      avslutt: minTur && s.tur.steg === 'handel' && !v && p && p.cash >= 0,
      byPaAuksjon: !!s.auksjon && p && !p.konkurs && s.auksjon.passert.indexOf(pid) < 0,
      maaSkaffe: !!(p && p.maaSkaffe)
    };
  };

  E.serieEier = function (s, serieId) {
    var t = MM.tomterISerie(serieId);
    var eier = null;
    for (var i = 0; i < t.length; i++) {
      var d = tomt(s, t[i].pos);
      if (!d || !d.eier) return null;
      if (eier === null) eier = d.eier;
      else if (eier !== d.eier) return null;
    }
    return eier;
  };

})(window.MM = window.MM || {});
