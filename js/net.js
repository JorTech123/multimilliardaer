/* ============================================================
   Multimillionær — nettverkslag
   To likeverdige adaptere bak samme grensesnitt:

     Sky   = Cloudflare Worker + D1 (ekte flerspiller)
     Lokal = localStorage + BroadcastChannel (flere faner på samme PC)

   Skriving bruker optimistisk samtidighetskontroll: klienten regner ut
   ny tilstand selv og sender den med forventet versjonsnummer. Serveren
   godtar bare hvis versjonen stemmer, ellers får vi fersk tilstand og
   prøver på nytt. Spillet er turbasert, så kollisjoner er sjeldne.
   ============================================================ */
(function (MM) {
  'use strict';

  var N = MM.Nett = {
    modus: 'lokal',
    url: '',
    hemmelig: '',
    kode: null,
    tilstand: null,
    versjon: -1,
    lyttere: [],
    sisteFeil: null,
    pollMs: 1600,
    _timer: null,
    _kanal: null,
    _venter: null,
    synkroniserer: false
  };

  N.init = function (cfg) {
    N.url = (cfg && cfg.url) || (MM.CONFIG && MM.CONFIG.API_URL) || '';
    /* En relativ adresse peker på serveren som leverte siden. Åpnes
       spillet rett fra disk finnes det ingen slik server, og da er
       lokal modus det eneste som gir mening. */
    if (N.url && N.url.charAt(0) === '/' && location.protocol === 'file:') N.url = '';
    N.modus = N.url ? 'sky' : 'lokal';
    N.hemmelig = MM.hent('hemmelig', '') || '';
    return N.modus;
  };

  /* Finn ut om serveren faktisk svarer der vi tror. Gjør den ikke
     det, og det finnes en reserve, bytter vi dit. Kjøres én gang
     ved oppstart, mens brukeren uansett taster passord. */
  N.velgServer = function () {
    var reserve = (MM.CONFIG && MM.CONFIG.API_RESERVE) || '';
    var flyttet = (MM.CONFIG && MM.CONFIG.FLYTTET_TIL) || '';
    if (!N.url) return Promise.resolve(N.modus);

    return fetch(N.url + '?handling=ping', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) {
        if (o && o.ok) { N.serverNavn = o.motor || 'sky'; return N.modus; }
        throw new Error('svarte ikke som ventet');
      })
      .catch(function () {
        if (reserve && reserve !== N.url) {
          N.url = reserve;
          N.serverNavn = 'reserve';
          return N.modus;
        }
        /* Ingen server her. Ligger spillet et annet sted nå, er det
           bedre å si det rett ut enn å la folk spille videre mot
           ingenting — eller, enda verre, mot en annen database. */
        N.serverNavn = 'borte';
        if (flyttet && location.href.indexOf(flyttet) !== 0) N.flyttetTil = flyttet;
        return N.modus;
      });
  };

  N.erSky = function () { return N.modus === 'sky'; };
  N.settHemmelig = function (p) { N.hemmelig = p; MM.lagre('hemmelig', p); };

  /* ---------- Lyttere ---------- */
  N.pa = function (cb) {
    N.lyttere.push(cb);
    if (N.tilstand) cb(N.tilstand, []);
    return function () {
      var i = N.lyttere.indexOf(cb);
      if (i >= 0) N.lyttere.splice(i, 1);
    };
  };

  function varsle(hendelser) {
    N.lyttere.slice().forEach(function (cb) {
      try { cb(N.tilstand, hendelser || []); } catch (e) { console.error(e); }
    });
  }

  function settTilstand(s, hendelser, tving) {
    if (!s) return;
    /* Normalt går vi aldri bakover i versjon. Unntaket er når en
       handling ble avvist og vi må rulle tilbake det vi viste. */
    if (!tving && N.tilstand && s.v < N.versjon) return;
    var gammel = N.versjon;
    N.tilstand = s;
    N.versjon = s.v;
    varsle(gammel === s.v ? [] : (hendelser || nyeHendelser(s, gammel)));
  }

  /* Hendelser vi ikke har sett før, utledet fra loggen i tilstanden */
  function nyeHendelser(s, framV) {
    if (!s.logg) return [];
    if (framV < 0) return [];
    return s.logg.filter(function (h) { return h.seq > (N._sisteSeq || 0); });
  }

  /* ============================================================
     SKY — serveren
     ============================================================ */
  var Sky = {
    get: function (params) {
      var q = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      return fetch(N.url + '?' + q, { method: 'GET', redirect: 'follow' })
        .then(function (r) { return r.text(); })
        .then(tolk);
    },
    post: function (data) {
      data.hemmelig = N.hemmelig;
      /* Ren tekst som kropp gir ingen preflight-sjekk */
      return fetch(N.url, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify(data)
      }).then(function (r) { return r.text(); }).then(tolk);
    }
  };

  function tolk(tekst) {
    var o;
    try { o = JSON.parse(tekst); }
    catch (e) { throw new Error('Uventet svar fra serveren. Er nettappen publisert for "alle"?'); }
    if (o && o.feil) {
      var f = new Error(o.feil);
      f.kode = o.kodeFeil || null;
      f.tilstand = o.tilstand || null;
      throw f;
    }
    return o;
  }

  /* ============================================================
     LOKAL — localStorage + BroadcastChannel
     ============================================================ */
  var Lokal = {
    nokkel: function (kode) { return 'spill.' + kode; },
    les: function (kode) { return MM.hent(Lokal.nokkel(kode), null); },
    skriv: function (kode, s) {
      MM.lagre(Lokal.nokkel(kode), s);
      try {
        if (N._kanal) N._kanal.postMessage({ v: s.v });
      } catch (e) { /* ignorer */ }
    },
    lytt: function (kode) {
      try {
        N._kanal = new BroadcastChannel('mm.' + kode);
        N._kanal.onmessage = function () { N.hentNå(); };
      } catch (e) { N._kanal = null; }
      addEventListener('storage', function (e) {
        if (e.key === 'mm.' + Lokal.nokkel(kode)) N.hentNå();
      });
    },
    alleSpill: function () {
      var ut = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('mm.spill.') === 0) {
            try { ut.push(JSON.parse(localStorage.getItem(k))); } catch (e) { /* hopp over */ }
          }
        }
      } catch (e) { /* ignorer */ }
      return ut;
    }
  };

  /* ============================================================
     Felles API
     ============================================================ */

  N.opprett = function (regler) {
    var kode = MM.spillkode();
    var s = MM.Engine.nyttSpill(kode, regler);
    s.v = 1;
    if (N.erSky()) {
      return Sky.post({ handling: 'opprett', kode: kode, tilstand: s })
        .then(function (svar) {
          N.kode = kode;
          settTilstand(svar.tilstand || s);
          return kode;
        });
    }
    Lokal.skriv(kode, s);
    N.kode = kode;
    settTilstand(s);
    return Promise.resolve(kode);
  };

  N.finnes = function (kode) {
    if (N.erSky()) {
      return Sky.get({ handling: 'tilstand', kode: kode })
        .then(function (svar) { return !!svar.tilstand; })
        .catch(function () { return false; });
    }
    return Promise.resolve(!!Lokal.les(kode));
  };

  N.koble = function (kode) {
    N.kode = String(kode).toUpperCase().trim();
    N.tilstand = null;
    N.versjon = -1;
    N._sisteSeq = 0;
    if (!N.erSky()) Lokal.lytt(N.kode);
    /* tving: vi må ha et ferskt svar her, ikke et pågående oppslag
       fra kodefeltet eller fra pollingen */
    return N.hentNå(true).then(function (s) {
      if (!s) {
        throw new Error(N.sisteFeil
          ? 'Får ikke kontakt med serveren. ' + N.sisteFeil
          : 'Fant ikke spillkoden ' + N.kode);
      }
      N.start();
      return s;
    });
  };

  /* Ett oppslag om gangen. Kalles det mens et annet pågår, får man
     det samme løftet tilbake — ikke en halvferdig tilstand. */
  N.hentNå = function (tving) {
    if (!N.kode) return Promise.resolve(null);
    if (N._venter && !tving) return N._venter;

    var p;
    if (N.erSky()) {
      p = Sky.get({ handling: 'tilstand', kode: N.kode, siden: N.versjon })
        .then(function (svar) {
          N.sisteFeil = null;
          if (svar.uendret) return N.tilstand;
          if (svar.tilstand) {
            var nye = svar.tilstand.logg
              ? svar.tilstand.logg.filter(function (h) { return h.seq > (N._sisteSeq || 0); })
              : [];
            N._sisteSeq = svar.tilstand.seq || 0;
            settTilstand(svar.tilstand, nye);
          }
          return N.tilstand;
        })
        .catch(function (e) {
          N.sisteFeil = e.message;
          varsle([]);
          return N.tilstand;
        });
    } else {
      var s = Lokal.les(N.kode);
      if (s && s.v !== N.versjon) {
        var nye = (s.logg || []).filter(function (h) { return h.seq > (N._sisteSeq || 0); });
        N._sisteSeq = s.seq || 0;
        settTilstand(s, nye);
      }
      p = Promise.resolve(s);
    }

    N._venter = p;
    /* Slipp vakta uansett hvordan det gikk, så den ikke låser seg */
    p.then(function () { N._venter = null; }, function () { N._venter = null; });
    return p;
  };

  N.start = function () {
    N.stopp();
    N._timer = setInterval(function () {
      if (document.hidden) return;
      N.hentNå();
    }, N.pollMs);
  };

  N.stopp = function () {
    if (N._timer) clearInterval(N._timer);
    N._timer = null;
  };

  /* ------------------------------------------------------------
     send() — regn ut lokalt, lagre med versjonssjekk, prøv på nytt
     ------------------------------------------------------------ */
  N.send = function (handling, valg) {
    valg = valg || {};

    var start = N.tilstand;
    if (!start) return Promise.reject(new Error('Ingen tilstand enda'));

    /* 1. Regn ut lokalt. Er trekket ulovlig, stopper vi her og
          serveren blir aldri plaget. */
    var res;
    try {
      res = MM.Engine.handling(start, handling);
      res.state.v = start.v + 1;
    } catch (e) {
      if (!valg.stille) MM.toast(MM.esc(e.message), 'feil');
      return Promise.reject(e);
    }

    /* 2. Vis det med en gang. Spillet er turbasert, så i praksis er
          det bare én som endrer noe av gangen — da er det ingen grunn
          til å la spilleren vente på rundturen til Google. */
    var tilbakefall = start;
    var seqFor = N._sisteSeq;
    N.synkroniserer = true;
    N._sisteSeq = res.state.seq;
    settTilstand(res.state, res.hendelser);

    /* 3. Lagre i bakgrunnen */
    var forsok = 0;

    function lagre(r, forventetV) {
      if (!N.erSky()) {
        var naa = Lokal.les(N.kode);
        if (naa && naa.v !== forventetV) return paaNytt(naa);
        Lokal.skriv(N.kode, r.state);
        return ferdig(r);
      }
      return Sky.post({
        handling: 'lagre',
        kode: N.kode,
        forventetV: forventetV,
        tilstand: r.state,
        hendelser: r.hendelser
      }).then(function (svar) {
        N.sisteFeil = null;
        /* Serverens svar er fasit, men hendelsene har vi alt spilt av */
        settTilstand(svar.tilstand || r.state, [], true);
        return ferdig(r);
      }).catch(function (e) {
        if (e.kode === 'konflikt' && e.tilstand) return paaNytt(e.tilstand);
        throw e;
      });
    }

    /* Noen andre rakk å skrive først: legg handlingen oppå deres
       ferske tilstand i stedet for å kaste den. */
    function paaNytt(fersk) {
      if (++forsok > 4) throw new Error('Klarte ikke lagre — prøv igjen');
      settTilstand(fersk, [], true);
      var r2;
      try {
        r2 = MM.Engine.handling(fersk, handling);
        r2.state.v = fersk.v + 1;
      } catch (e) {
        /* Handlingen gir ikke mening lenger — vis serverens versjon */
        N.synkroniserer = false;
        throw e;
      }
      N._sisteSeq = r2.state.seq;
      settTilstand(r2.state, r2.hendelser);
      return lagre(r2, fersk.v);
    }

    function ferdig(r) {
      N.synkroniserer = false;
      N._sisteSeq = r.state.seq;
      return r;
    }

    return lagre(res, start.v).catch(function (e) {
      N.synkroniserer = false;
      /* Lagringen feilet for godt: ta bort det vi viste på forskudd,
         så ingen tror trekket gikk gjennom */
      if (N.tilstand && N.tilstand.v > tilbakefall.v) {
        N._sisteSeq = seqFor;
        settTilstand(tilbakefall, [], true);
      }
      if (!valg.stille) MM.toast(MM.esc(e.message), 'feil');
      throw e;
    });
  };

  /* ------------------------------------------------------------
     Resultatlister (evig høyscore)
     ------------------------------------------------------------ */
  N.lagreResultat = function (resultat) {
    if (N.erSky()) {
      return Sky.post({ handling: 'resultat', kode: N.kode, resultat: resultat })
        .catch(function () { /* ikke kritisk */ });
    }
    var alle = MM.hent('resultater', []);
    resultat.forEach(function (r) {
      alle.push({ t: Date.now(), kode: N.kode, navn: r.navn, figur: r.figur, formue: r.formue, plass: r.plass });
    });
    MM.lagre('resultater', alle.slice(-300));
    return Promise.resolve();
  };

  N.hentResultater = function () {
    if (N.erSky()) {
      return Sky.get({ handling: 'resultater' })
        .then(function (s) { return s.resultater || []; })
        .catch(function () { return []; });
    }
    return Promise.resolve(MM.hent('resultater', []));
  };

  N.lokaleSpill = function () { return Lokal.alleSpill(); };

  /* ------------------------------------------------------------
     Opprydding
     ------------------------------------------------------------ */

  /* Slett ett spill. Serveren slipper det bare gjennom hvis du er
     vert, eller hvis bordet er tomt eller ferdigspilt. */
  N.slettSpill = function (kode, pid) {
    if (!N.erSky()) {
      MM.glem('spill.' + String(kode).toUpperCase());
      return Promise.resolve({ ok: true, slettet: 1 });
    }
    return Sky.post({ handling: 'slett', kode: String(kode).toUpperCase(), pid: pid });
  };

  /* Be serveren rydde bort forlatte og ferdigspilte bord nå */
  N.ryddOpp = function () {
    if (!N.erSky()) {
      var grense = Date.now() - 2 * 3600000;
      var n = 0;
      Lokal.alleSpill().forEach(function (s) {
        if (!s || !s.id) return;
        var gammel = (s.oppdatert || 0) < grense;
        if (s.fase === 'ferdig' || (s.fase === 'lobby' && gammel)) {
          MM.glem('spill.' + s.id);
          n++;
        }
      });
      return Promise.resolve({ ok: true, slettet: n });
    }
    return Sky.post({ handling: 'rydd' });
  };

  /* ------------------------------------------------------------
     Aktive spill — så man kan velge bord i stedet for å taste kode
     ------------------------------------------------------------ */
  N.hentSpill = function () {
    if (N.erSky()) {
      return Sky.get({ handling: 'liste' })
        .then(function (s) { return s.spill || []; })
        .catch(function () { return []; });
    }
    var grense = Date.now() - 24 * 3600 * 1000;
    var ut = Lokal.alleSpill().filter(function (s) {
      return s && s.fase !== 'ferdig' && (s.oppdatert || 0) > grense;
    }).map(function (s) {
      var vert = '';
      (s.spillere || []).forEach(function (p) { if (p.id === s.vertId) vert = p.navn; });
      return {
        kode: s.id,
        fase: s.fase,
        oppdatert: s.oppdatert || 0,
        vert: vert,
        spillere: (s.spillere || []).map(function (p) {
          return { navn: p.navn, figur: p.figur, konkurs: !!p.konkurs };
        }),
        ledigePlasser: Math.max(0, MM.MAKS_SPILLERE - (s.spillere || []).length)
      };
    });
    ut.sort(function (a, b) { return b.oppdatert - a.oppdatert; });
    return Promise.resolve(ut);
  };

})(window.MM = window.MM || {});
