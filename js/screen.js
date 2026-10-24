/* ============================================================
   Multimilliardær — storskjerm
   Ren visning for TV eller projektor. Ingen hemmeligheter her,
   bare brettet, børsen og hva som skjer.
   ============================================================ */
(function (MM) {
  'use strict';

  var T = null, brettApi = null, minId, seremoniKjort = false;
  var forrigeKurs = {}, E = {};

  function start() {
    MM.adopterIdFraUrl();
    minId = MM.Sesjon.minId();
    var kode = MM.kodeFraUrl() || MM.Sesjon.les().kode;
    if (!kode) { location.href = 'index.html'; return; }

    bygg(kode);
    MM.Nett.koble(kode).then(function (s) {
      if (!s) throw new Error('Fant ikke spillet ' + kode);
      MM.Nett.pa(oppdater);
      MM.Nett.start();
    }).catch(function (e) {
      MM.toast(MM.esc(e.message), 'feil', 8000);
    });
  }

  function bygg(kode) {
    var rot = MM.$('#app');
    rot.innerHTML = '';

    E.klokke = MM.el('span', { class: 'tall dim' });
    E.vertknapper = MM.el('div', { class: 'rad', style: 'gap:.4rem' });

    var topp = MM.el('div', { class: 'topplinje' }, [
      MM.el('span', { class: 'logo', text: 'Multimilliardær' }),
      MM.el('span', { class: 'vokse' }),
      MM.el('span', { class: 'liten svak', text: 'Spillkode' }),
      MM.el('span', { class: 'kodelapp', text: kode }),
      E.klokke,
      E.vertknapper,
      MM.lydknapp(),
      MM.musikknapp(),
      MM.el('a', {
        class: 'knapp knapp-tom knapp-liten',
        href: 'index.html',
        title: 'Tilbake til forsiden',
        html: '↩ Forsiden'
      })
    ]);

    E.spillere = MM.el('div', { class: 'kolonne venstre' });
    E.brett = MM.el('div', { class: 'brettramme' });
    E.hoyre = MM.el('div', { class: 'kolonne hoyre' });

    var skjerm = MM.el('div', { class: 'skjerm' }, [topp, E.spillere, E.brett, E.hoyre]);
    rot.appendChild(skjerm);

    brettApi = MM.Brett.lag(E.brett, {});

    E.bors = MM.el('div', { class: 'panel' });
    E.strom = MM.el('div', { class: 'panel vokse', style: 'overflow:hidden' });
    E.hoyre.appendChild(E.bors);
    E.hoyre.appendChild(E.strom);
  }

  function oppdater(s, hendelser) {
    if (!s) return;
    T = s;
    MM.Brett.oppdater(brettApi, s);
    tegnSpillere(s);
    tegnBors(s);
    tegnStrom(s, hendelser);
    tegnTopp(s);

    if (hendelser && hendelser.length) animer(s, hendelser);

    if (s.fase === 'ferdig' && !seremoniKjort) {
      seremoniKjort = true;
      setTimeout(function () { MM.Seremoni.vis(s, { lagre: false }); }, 1200);
    }
  }

  function tegnTopp(s) {
    if (s.regler.tidsgrenseMin > 0 && s.startet > 1) {
      var igjen = s.regler.tidsgrenseMin * 60000 - (Date.now() - s.startet);
      E.klokke.textContent = '⏱ ' + MM.klokke(igjen);
    } else {
      E.klokke.textContent = '';
    }

    E.vertknapper.innerHTML = '';
    if (s.vertId === minId && s.fase === 'spiller') {
      E.vertknapper.appendChild(MM.el('button', {
        class: 'knapp knapp-tom knapp-liten', title: 'Hopp over turen hvis noen er borte',
        text: 'Hopp tur',
        onclick: function () {
          if (confirm('Hoppe over turen til ' + (MM.Engine.aktiv(s) || {}).navn + '?')) {
            MM.Nett.send({ type: 'VERT_OVERSTYR', pid: minId, hva: 'hoppTur' });
          }
        }
      }));
      if (s.auksjon) {
        E.vertknapper.appendChild(MM.el('button', {
          class: 'knapp knapp-tom knapp-liten', text: 'Avbryt auksjon',
          onclick: function () { MM.Nett.send({ type: 'VERT_OVERSTYR', pid: minId, hva: 'avbrytAuksjon' }); }
        }));
      }
      E.vertknapper.appendChild(MM.el('button', {
        class: 'knapp knapp-tom knapp-liten', text: 'Avslutt spillet',
        onclick: function () {
          if (confirm('Avslutte spillet nå? Rikest vinner.')) {
            MM.Nett.send({ type: 'VERT_OVERSTYR', pid: minId, hva: 'avslutt' });
          }
        }
      }));
    }
  }

  /* ------------------------------------------------------------
     Spillerkort
     ------------------------------------------------------------ */
  function tegnSpillere(s) {
    var aktivP = MM.Engine.aktivId(s);
    E.spillere.innerHTML = '';
    E.spillere.appendChild(MM.el('div', { class: 'panel-tittel', text: 'Spillere' }));

    var rangert = s.spillere.slice().sort(function (a, b) {
      return MM.Engine.formue(s, b) - MM.Engine.formue(s, a);
    });

    rangert.forEach(function (p) {
      var f = MM.figur(p.figur);
      var formue = MM.Engine.formue(s, p);
      var pst = Math.min(100, Math.max(0, formue / s.regler.mal * 100));
      var antTomter = 0, antAksjer = 0, antHus = 0;
      for (var pos in s.tomter) {
        var d = s.tomter[pos];
        if (d.eier !== p.id) continue;
        antTomter++;
        antHus += (d.hus || 0) + (d.hotell ? 4 : 0) + (d.slott ? 5 : 0);
      }
      MM.SERIES.forEach(function (se) { antAksjer += p.aksjer[se.id] || 0; });

      E.spillere.appendChild(MM.el('div', {
        class: 'sk' + (p.id === aktivP ? ' aktiv' : '') + (p.konkurs ? ' konkurs' : ''),
        style: '--pfarge:' + f.farge
      }, [
        MM.el('span', { class: 'em', text: f.emoji }),
        MM.el('div', { style: 'min-width:0' }, [
          MM.el('div', { class: 'nv' }, [
            MM.el('span', { text: (p.erBot ? '🤖 ' : '') + p.navn }),
            p.id === s.vertId ? MM.el('span', { class: 'lapp lapp-gull', style: 'margin-left:.35rem', text: 'Vert' }) : null
          ]),
          MM.el('div', { class: 'detalj' }, [
            MM.el('span', { text: '🏠 ' + antTomter }),
            antHus ? MM.el('span', { text: '🏗 ' + antHus }) : null,
            MM.el('span', { text: '📈 ' + antAksjer }),
            p.gjeld ? MM.el('span', { style: 'color:var(--rod)', text: '🧾 ' + p.gjeld }) : null,
            p.paaFerie ? MM.el('span', { style: 'color:var(--bla)', text: '🏖' }) : null
          ])
        ]),
        MM.el('div', { class: 'formue' }, [
          MM.el('span', { text: MM.kort(formue) }),
          MM.el('span', { class: 'maal', text: 'kontant ' + MM.kort(p.cash) })
        ]),
        MM.el('div', { class: 'sk-stolpe' }, [MM.el('i', { style: 'width:' + pst.toFixed(1) + '%' })])
      ]));
    });

    E.spillere.appendChild(MM.el('div', { class: 'panel', style: 'margin-top:.4rem' }, [
      MM.el('div', { class: 'panel-tittel', text: 'Mål' }),
      MM.el('div', { class: 'tall gull', style: 'font-size:1.2rem;font-weight:700', text: MM.fmt(s.regler.mal) }),
      MM.el('div', { class: 'liten svak', text: 'kontanter + tomter + bygg + aksjer − gjeld' })
    ]));
  }

  /* ------------------------------------------------------------
     Børstavle
     ------------------------------------------------------------ */
  function tegnBors(s) {
    E.bors.innerHTML = '';
    E.bors.appendChild(MM.el('div', { class: 'panel-tittel', text: 'Børsen' }));

    MM.SERIES.forEach(function (se) {
      var niva = s.kurs[se.id];
      var kurs = MM.STOCK_LADDER[niva];
      var retning = '';
      if (forrigeKurs[se.id] !== undefined && forrigeKurs[se.id] !== niva) {
        retning = niva > forrigeKurs[se.id] ? ' opp' : ' ned';
      }
      forrigeKurs[se.id] = niva;

      var eier = MM.Engine.serieEier(s, se.id);
      var eierP = eier ? MM.Engine.sp(s, eier) : null;
      var stor = MM.Engine.storAksjonar(s, se.id);

      var stige = MM.el('div', { class: 'bors-stige', style: 'color:' + se.farge });
      for (var i = 1; i < MM.STOCK_LADDER.length; i++) {
        stige.appendChild(MM.el('i', {
          class: i <= niva ? 'på' : '',
          style: 'height:' + (20 + i / MM.STOCK_LADDER.length * 80) + '%'
        }));
      }

      E.bors.appendChild(MM.el('div', { class: 'bors-rad' }, [
        MM.el('span', { class: 'bors-prikk', style: 'background:' + se.farge + ';color:' + se.farge }),
        MM.el('div', { style: 'min-width:0' }, [
          MM.el('div', { class: 'bors-navn', text: se.navn }),
          MM.el('div', { class: 'bors-ticker' }, [
            MM.el('span', { text: se.ticker }),
            eierP ? MM.el('span', { style: 'color:' + MM.figur(eierP.figur).farge, text: ' · hel serie: ' + eierP.navn }) : null,
            stor ? MM.el('span', { class: 'gull', text: ' · utbytte: ' + stor.navn }) : null
          ])
        ]),
        stige,
        MM.el('span', { class: 'bors-kurs' + retning + (kurs ? '' : ' null'), text: kurs ? MM.kort(kurs) : '0' })
      ]));
    });
  }

  /* ------------------------------------------------------------
     Hendelsesstrøm
     ------------------------------------------------------------ */
  function tegnStrom(s, nye) {
    var nyeSeq = (nye || []).map(function (h) { return h.seq; });
    E.strom.innerHTML = '';
    E.strom.appendChild(MM.el('div', { class: 'panel-tittel', text: 'Hva skjer' }));
    var liste = MM.el('div', { class: 'storstrom' });
    (s.logg || []).slice().reverse().slice(0, 26).forEach(function (h) {
      liste.appendChild(MM.el('div', {
        class: 'strom-rad e-' + h.type + (nyeSeq.indexOf(h.seq) >= 0 ? ' ny' : ''),
        text: h.tekst
      }));
    });
    E.strom.appendChild(liste);
  }

  /* ------------------------------------------------------------
     Store øyeblikk
     ------------------------------------------------------------ */
  function mega(em, tittel, under, varighet) {
    var boks = MM.el('div', { class: 'boks' }, [
      MM.el('div', { class: 'em', text: em }),
      MM.el('div', { class: 't', text: tittel }),
      under ? MM.el('div', { class: 'u', text: under }) : null
    ]);
    var lag = MM.el('div', { class: 'megamelding' }, [boks]);
    document.body.appendChild(lag);
    setTimeout(function () {
      lag.classList.add('ut');
      setTimeout(function () { lag.remove(); }, 440);
    }, varighet || 2600);
  }

  function animer(s, hendelser) {
    hendelser.forEach(function (h) {
      switch (h.type) {
        case 'ola-flytt':
        case 'flytt':
          if (h.data && h.data.terning && h.data.terning.length === 2) {
            MM.kastTerninger(brettApi.terningplass, h.data.terning, { storrelse: 62 });
          }
          if (h.data && typeof h.data.til === 'number') MM.Brett.blink(brettApi, h.data.til);
          break;
        case 'ferie-reis':
          if (h.data && h.data.terning) MM.kastTerninger(brettApi.terningplass, h.data.terning, { storrelse: 62 });
          break;
        case 'leie':
        case 'ola-leie':
          MM.Lyd.kasse();
          if (h.data && h.data.sum >= 40000) {
            mega('💸', MM.fmt(h.data.sum) + ' i leie!', h.tekst, 2400);
            MM.skjelv(document.body, 6);
          }
          break;
        case 'utbytte': MM.Lyd.opp(); break;
        case 'kurs-opp': MM.Lyd.opp(); break;
        case 'kurs-ned': MM.Lyd.ned(); break;
        case 'bygg':
          MM.Lyd.opp();
          if (h.data && (h.data.niva === 'slott' || h.data.niva === 'hotell')) {
            mega(h.data.niva === 'slott' ? '🏰' : '🏨', h.tekst, '', 2600);
            MM.konfetti({ antall: 70, varighet: 2400 });
          }
          break;
        case 'casino-vinn':
          MM.Lyd.jubel();
          mega('🎲', 'SEKSER!', h.tekst, 2800);
          MM.konfetti({ antall: 140, varighet: 3400 });
          break;
        case 'casino-tap': MM.Lyd.minus(); break;
        case 'auksjon-start':
          MM.Lyd.hammer();
          mega('🔨', 'Auksjon!', MM.BOARD[h.data.pos].navn, 2200);
          break;
        case 'auksjon-slutt': MM.Lyd.hammer(); break;
        case 'bud': MM.Lyd.klikk(); break;
        case 'konkurs':
          MM.Lyd.minus();
          mega('💥', 'Konkurs', h.tekst, 3200);
          MM.skjelv(document.body, 12);
          break;
        case 'kort':
          MM.Lyd.varsel();
          break;
        case 'tur':
          if (h.data && h.data.pid) {
            var p = MM.Engine.sp(s, h.data.pid);
            if (p) mega(MM.figur(p.figur).emoji, p.navn, 'det er din tur', 1700);
          }
          break;
        case 'slutt':
          MM.Lyd.fanfare();
          break;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () { MM.boot(start); });

})(window.MM = window.MM || {});
