/* ============================================================
   Multimilliardær — felles oppstart
   Sesjon, passordlås, nettstatus og hjelpetekster.
   ============================================================ */
(function (MM) {
  'use strict';

  /* ------------------------------------------------------------
     Sesjon — hvem er jeg, og hvilket spill er jeg i
     ------------------------------------------------------------ */
  /* Sesjonen bor i sessionStorage, som er egen per fane. Da kan to
     faner på samme maskin være to forskjellige spillere — nyttig når
     dere tester, og nødvendig hvis to deler én PC.
     En kopi ligger i localStorage, slik at man kan plukke opp igjen
     spillet etter at fanen er lukket. */
  MM.Sesjon = {
    les: function () {
      return MM.sHent('sesjon', { pid: null, kode: null, navn: '', figur: null });
    },
    skriv: function (o) {
      var s = MM.Sesjon.les();
      Object.keys(o).forEach(function (k) { s[k] = o[k]; });
      if (!s.pid) s.pid = MM.uid('sp');
      MM.sLagre('sesjon', s);
      MM.lagre('sisteSesjon', s);
      return s;
    },
    minId: function () {
      var s = MM.Sesjon.les();
      if (!s.pid) {
        s.pid = MM.uid('sp');
        MM.sLagre('sesjon', s);
        MM.lagre('sisteSesjon', s);
      }
      return s.pid;
    },
    /* Forrige økt fra denne nettleseren — brukes til "fortsett som ..." */
    forrige: function () {
      var f = MM.hent('sisteSesjon', null);
      return (f && f.pid && f.kode) ? f : null;
    },
    gjenoppta: function (f) {
      MM.sLagre('sesjon', f);
      return f;
    },
    /* Har denne fanen alt en egen identitet? */
    harEgen: function () {
      var s = MM.sHent('sesjon', null);
      return !!(s && s.pid);
    },
    tom: function () { MM.sGlem('sesjon'); }
  };

  /* ------------------------------------------------------------
     Passordlås
     ------------------------------------------------------------ */
  MM.erApnet = function () {
    return MM.hent('apnet', false) === MM.CONFIG.PASSORD_HASH;
  };

  MM.sjekkPassord = function (tekst) {
    var h = MM.hash(String(tekst || '').trim());
    if (h !== MM.CONFIG.PASSORD_HASH) return false;
    MM.lagre('apnet', h);
    MM.Nett.settHemmelig(String(tekst).trim());
    return true;
  };

  MM.laasOpp = function () { MM.glem('apnet'); };

  /* Krev passord før siden vises. Kaller cb() når det er greit. */
  MM.krevPassord = function (cb) {
    if (MM.erApnet() && MM.hent('hemmelig', '')) { cb(); return; }
    var inn = MM.el('input', {
      class: 'felt', type: 'password', placeholder: 'Passord',
      autocomplete: 'current-password', spellcheck: 'false'
    });
    var feil = MM.el('div', { class: 'liten', style: 'color:var(--rod);min-height:1.3em;margin-top:.4rem' });
    var knapp = MM.el('button', { class: 'knapp knapp-gull knapp-blokk knapp-stor', text: 'Lås opp' });

    function prov() {
      MM.Lyd.vekk();
      if (MM.sjekkPassord(inn.value)) {
        MM.Lyd.jubel();
        lag.style.animation = 'toast-ut .4s ease forwards';
        setTimeout(function () { lag.remove(); cb(); }, 380);
      } else {
        feil.textContent = 'Feil passord. Prøv igjen.';
        MM.Lyd.feil();
        MM.skjelv(boks, 10);
        inn.value = '';
        inn.focus();
      }
    }
    knapp.addEventListener('click', prov);
    inn.addEventListener('keydown', function (e) { if (e.key === 'Enter') prov(); });

    var boks = MM.el('div', { class: 'kort midtboks steg' }, [
      MM.el('div', { class: 'laas-ikon', text: '🔐' }),
      MM.el('h1', { class: 'logo logo-stor midt', text: 'Multimilliardær' }),
      MM.el('div', { class: 'logo-under midt', style: 'margin-bottom:1.6rem', text: 'Privat bord · passord kreves' }),
      inn, feil,
      MM.el('div', { style: 'height:.9rem' }),
      knapp
    ]);
    var lag = MM.el('div', { class: 'side', style: 'position:fixed;inset:0;z-index:9800;background:var(--bg)' }, [boks]);
    document.body.appendChild(lag);
    setTimeout(function () { inn.focus(); }, 120);
  };

  /* ------------------------------------------------------------
     Nettstatus-lampe
     ------------------------------------------------------------ */
  MM.nettstatus = function () {
    var lampe = MM.el('span', { class: 'lampe' });
    var tekst = MM.el('span', { text: MM.Nett.erSky() ? 'Sky' : 'Lokal' });
    var e = MM.el('div', { class: 'nettstatus' + (MM.Nett.erSky() ? '' : ' lokal'), title: '' }, [lampe, tekst]);
    document.body.appendChild(e);
    setInterval(function () {
      if (MM.Nett.sisteFeil) {
        e.className = 'nettstatus feil';
        tekst.textContent = 'Ingen kontakt';
        e.title = MM.Nett.sisteFeil;
      } else {
        e.className = 'nettstatus' + (MM.Nett.erSky() ? '' : ' lokal');
        tekst.textContent = MM.Nett.erSky() ? 'Sky' : 'Lokal';
        e.title = MM.Nett.erSky() ? 'Lagrer i Google Regneark' : 'Lokal modus — bare faner på denne maskinen';
      }
    }, 2000);
    return e;
  };

  /* ------------------------------------------------------------
     Lydbryter
     ------------------------------------------------------------ */
  MM.lydknapp = function () {
    var k = MM.el('button', {
      class: 'knapp knapp-tom knapp-liten',
      title: 'Lyd av/på',
      text: MM.Lyd.av ? '🔇' : '🔊'
    });
    k.addEventListener('click', function () {
      var pa = MM.Lyd.veksle();
      k.textContent = pa ? '🔊' : '🔇';
    });
    return k;
  };

  /* ------------------------------------------------------------
     Modal
     ------------------------------------------------------------ */
  MM.modal = function (innhold, valg) {
    valg = valg || {};
    var boks = MM.el('div', { class: 'modal kort' }, [].concat(innhold));
    var lag = MM.el('div', { class: 'modallag' }, [boks]);
    if (!valg.fast) {
      lag.addEventListener('click', function (e) { if (e.target === lag) lukk(); });
    }
    function lukk() {
      lag.style.animation = 'toast-ut .3s ease forwards';
      setTimeout(function () { if (lag.parentNode) lag.remove(); }, 280);
    }
    lag.lukk = lukk;
    document.body.appendChild(lag);
    return lag;
  };

  /* ------------------------------------------------------------
     Hjelpetekster — kort forklaring for den som ikke kan spillet
     ------------------------------------------------------------ */
  MM.HJELP = {
    ola: 'Ola Nordmann er bankens brikke. Du kaster for ham først, og lander han på noens tomt, betaler <b>banken</b> leia til eieren. Derfor er det ingen lønn ved START — Ola er inntekten i spillet.',
    bors: 'Hver tomteserie er et aksjeselskap med 10 aksjer. Kurs opp ett steg for hver hele 20&nbsp;000 kr som kreves inn i leie på serien. Betaler du selv 20&nbsp;000+ i leie, faller kursen på alle hele serier du eier.',
    utbytte: 'Eier du <b>8 eller flere</b> av de 10 aksjene i et selskap, får du 50&nbsp;% av all leie som kreves inn på serien — selv om en annen eier tomtene. Eier du <b>alle 10</b>, slipper du å betale leie der.',
    gjeld: 'Du kan ta opp inntil 3 gjeldsbrev på 50&nbsp;000 kr hver, når som helst. Det koster 2&nbsp;500 kr i rente per gjeldsbrev <b>hver tur</b>, så lån sparsomt.',
    bygg: 'Eier du alle tomtene i en serie, får du dobbel grunnleie og kan bygge. Bygg jevnt: alle tomtene i serien må ha like mange hus (±1). 4 hus blir hotell. På Slottsplassen kan hotellet bli slott.',
    ferie: 'Feriehotellet er ikke fengsel. Du velger selv om du vil stå over. Første opphold er gratis, neste koster 10&nbsp;000, så 20&nbsp;000 og så videre. Du kommer ut ved å kaste én terning.',
    mal: 'Spillet er over når noen når målformuen, alle andre er konkurs, eller tiden er ute. Formue = kontanter + tomter + bygg + aksjer til dagens kurs − gjeld.'
  };

  MM.hjelpeknapp = function (nokkel, tekst) {
    var k = MM.el('button', {
      class: 'lapp',
      style: 'cursor:pointer;border-style:dashed',
      html: '? ' + (tekst || 'Hvordan?')
    });
    k.addEventListener('click', function () {
      MM.Lyd.klikk();
      MM.modal([
        MM.el('h3', { text: 'Kort forklart' }),
        MM.el('div', { html: MM.HJELP[nokkel] || '' }),
        MM.el('div', { style: 'height:1rem' }),
        MM.el('button', {
          class: 'knapp knapp-blokk', text: 'Skjønner',
          onclick: function (e) { e.target.closest('.modallag').lukk(); }
        })
      ]);
    });
    return k;
  };

  /* ------------------------------------------------------------
     Oppstart
     ------------------------------------------------------------ */
  MM.boot = function (cb) {
    MM.Nett.init();
    MM.Nett.pollMs = MM.CONFIG.POLL_MS || 1600;
    document.addEventListener('click', function en() {
      MM.Lyd.vekk();
      document.removeEventListener('click', en);
    }, { once: true });
    MM.krevPassord(function () {
      MM.nettstatus();
      cb();
    });
  };

  /* Les spillkode fra adressen */
  MM.kodeFraUrl = function () {
    var m = /[?&]kode=([A-Za-z0-9]{4,6})/.exec(location.search);
    return m ? m[1].toUpperCase() : null;
  };

  /* ?som=<spiller-id> lar en ny fane overta identiteten din.
     Brukes når du åpner storskjermen fra venterommet, slik at
     vertsknappene følger med over i den nye fana. */
  MM.adopterIdFraUrl = function () {
    var m = /[?&]som=([A-Za-z0-9_]+)/.exec(location.search);
    if (!m || MM.Sesjon.harEgen()) return false;
    var kode = MM.kodeFraUrl();
    var f = MM.Sesjon.forrige();
    MM.Sesjon.gjenoppta({
      pid: m[1],
      kode: kode,
      navn: (f && f.pid === m[1]) ? f.navn : '',
      figur: (f && f.pid === m[1]) ? f.figur : null
    });
    return true;
  };

})(window.MM = window.MM || {});
