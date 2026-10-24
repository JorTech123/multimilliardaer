/* ============================================================
   Multimilliardær — nettverkslag
   To likeverdige adaptere bak samme grensesnitt:

     Sky   = Google Apps Script + Google Regneark (ekte flerspiller)
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
    _venter: null
  };

  N.init = function (cfg) {
    N.url = (cfg && cfg.url) || (MM.CONFIG && MM.CONFIG.API_URL) || '';
    N.modus = N.url ? 'sky' : 'lokal';
    N.hemmelig = MM.hent('hemmelig', '') || '';
    return N.modus;
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

  function settTilstand(s, hendelser) {
    if (!s) return;
    if (N.tilstand && s.v < N.versjon) return;      // ikke gå bakover
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
     SKY — Google Apps Script
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
      /* Ren tekst som kropp gir ingen preflight-sjekk mot Apps Script */
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
    var forsok = 0;

    function runde() {
      forsok++;
      var grunnlag = N.tilstand;
      if (!grunnlag) return Promise.reject(new Error('Ingen tilstand enda'));

      var res;
      try {
        res = MM.Engine.handling(grunnlag, handling);
      } catch (e) {
        return Promise.reject(e);
      }
      var ny = res.state;
      ny.v = grunnlag.v + 1;

      if (!N.erSky()) {
        var naa = Lokal.les(N.kode);
        if (naa && naa.v !== grunnlag.v) {
          settTilstand(naa);
          if (forsok < 5) return runde();
          return Promise.reject(new Error('Klarte ikke lagre — prøv igjen'));
        }
        Lokal.skriv(N.kode, ny);
        N._sisteSeq = ny.seq;
        settTilstand(ny, res.hendelser);
        return Promise.resolve(res);
      }

      return Sky.post({
        handling: 'lagre',
        kode: N.kode,
        forventetV: grunnlag.v,
        tilstand: ny,
        hendelser: res.hendelser
      }).then(function (svar) {
        N.sisteFeil = null;
        N._sisteSeq = ny.seq;
        settTilstand(svar.tilstand || ny, res.hendelser);
        return res;
      }).catch(function (e) {
        if (e.kode === 'konflikt' && e.tilstand && forsok < 5) {
          settTilstand(e.tilstand);
          return runde();
        }
        throw e;
      });
    }

    return runde().catch(function (e) {
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
