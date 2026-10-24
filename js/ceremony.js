/* ============================================================
   Multimillionær — premieutdeling
   Trommevirvel, podium som reiser seg, konfetti og spesialpriser.
   ============================================================ */
(function (MM) {
  'use strict';

  var S = MM.Seremoni = {};
  var kjorer = false;

  /* Spesialpriser plukket ut fra statistikken */
  var PRISER = [
    { em: '📈', tittel: 'Børskongen',     felt: 'utbytte',   enhet: 'kr', tekst: 'mest utbytte fra aksjemajoritet' },
    { em: '💰', tittel: 'Leiehaien',        felt: 'leieInn',   enhet: 'kr', tekst: 'krevde inn mest leie' },
    { em: '🧾', tittel: 'Største offer', felt: 'leieUt',    enhet: 'kr', tekst: 'betalte mest leie til andre' },
    { em: '🏠', tittel: 'Tomtebaronen',     felt: 'tomter',    enhet: 'stk', tekst: 'flest tomter kjøpt' },
    { em: '🎲', tittel: 'Gambleren',        felt: 'casinoNetto', enhet: 'kr', tekst: 'best netto på Casino', tillatNull: false },
    { em: '🎯', tittel: 'Dobbeltmesteren',  felt: 'doble',     enhet: 'dobler', tekst: 'flest dobbeltkast' },
    { em: '📊', tittel: 'Aksjesamleren',    felt: 'aksjerKjopt', enhet: 'aksjer', tekst: 'kjøpte flest aksjer' },
    { em: '🚀', tittel: 'Høyeste topp', felt: 'toppFormue', enhet: 'kr', tekst: 'største formue underveis' }
  ];

  /* ------------------------------------------------------------
     vis() — kjører hele seremonien
     ------------------------------------------------------------ */
  S.vis = function (s, valg) {
    if (kjorer) return;
    kjorer = true;
    valg = valg || {};

    var res = (s.resultat || []).slice();
    if (!res.length) { kjorer = false; return; }

    var lag = MM.el('div', { class: 'seremoni' });
    var tittel = MM.el('div', { class: 'ser-tittel', text: 'Trommevirvel …' });
    var under = MM.el('div', { class: 'ser-under', text: grunnTekst(s) });
    var podium = MM.el('div', { class: 'podium' });
    var liste = MM.el('div', { class: 'ser-liste' });
    var priser = MM.el('div', { class: 'ser-priser' });
    var bunn = MM.el('div', { class: 'rad ser-bunn', style: 'gap:.6rem;margin-top:1.4rem;position:relative;flex-wrap:wrap;justify-content:center' });

    /* Alltid synlig vei ut, uansett hvor langt ned man har rullet */
    var lukk = MM.el('button', {
      class: 'ser-lukk',
      title: 'Lukk premieutdelingen',
      html: '✕'
    });
    lukk.addEventListener('click', function () {
      lag.remove();
      kjorer = false;
      if (stoppTromme) stoppTromme();
    });
    lag.appendChild(lukk);

    lag.appendChild(tittel);
    lag.appendChild(under);
    lag.appendChild(podium);
    lag.appendChild(liste);
    lag.appendChild(priser);
    lag.appendChild(bunn);
    document.body.appendChild(lag);

    /* Senk musikken mens vinneren kåres, så trommevirvelen får plass */
    if (MM.Musikk) MM.Musikk.dukk(16);

    var stoppTromme = MM.Lyd.trommer();

    /* Topp tre i rekkefølge 3 - 2 - 1 */
    var topp3 = res.slice(0, 3);
    var hoyde = [0, 100, 74, 52];

    function lagPod(r, plass) {
      var f = MM.figur(r.figur);
      var pod = MM.el('div', { class: 'pod p' + plass, style: 'opacity:0' }, [
        plass === 1 ? MM.el('div', { class: 'krone', text: '👑' }) : null,
        MM.el('div', { class: 'em', text: f.emoji }),
        MM.el('div', { class: 'nv', text: r.navn }),
        MM.el('div', { class: 'sum', text: MM.fmt(r.formue) }),
        MM.el('div', { class: 'sokkel', text: String(plass) })
      ]);
      podium.appendChild(pod);
      return pod;
    }

    var sekvens = [];
    for (var i = topp3.length - 1; i >= 0; i--) sekvens.push({ r: topp3[i], plass: i + 1 });

    var steg = 0;
    function neste() {
      if (steg >= sekvens.length) { ferdig(); return; }
      var x = sekvens[steg++];
      var pod = lagPod(x.r, x.plass);
      tittel.textContent = x.plass === 1 ? 'Og vinneren er …' : x.plass + '. plass';
      requestAnimationFrame(function () {
        pod.style.transition = 'opacity .5s ease';
        pod.style.opacity = '1';
        var sok = pod.querySelector('.sokkel');
        setTimeout(function () { sok.style.height = hoyde[x.plass] + 'px'; }, 120);
      });

      if (x.plass === 1) {
        stoppTromme();
        MM.Lyd.fanfare();
        MM.konfetti({ antall: 240, varighet: 6500 });
        var r = pod.getBoundingClientRect();
        MM.spruting(r.left + r.width / 2, r.top + 40, '#ffcf47');
        setTimeout(function () {
          tittel.innerHTML = '🏆 ' + MM.esc(x.r.navn);
          tittel.classList.add('logo');
        }, 500);
        setTimeout(neste, 1700);
      } else {
        MM.Lyd.varsel();
        setTimeout(neste, 1500);
      }
    }

    function ferdig() {
      /* Full tabell */
      liste.appendChild(MM.el('div', { class: 'panel-tittel', text: 'Slutt-tabell' }));
      res.forEach(function (r, i) {
        liste.appendChild(MM.el('div', {
          class: 'ser-rad' + (r.konkurs ? ' konkurs' : ''),
          style: 'animation-delay:' + (i * 90) + 'ms'
        }, [
          MM.el('span', { class: 'pl', text: r.plass + '.' }),
          MM.el('span', { class: 'em', text: MM.figur(r.figur).emoji }),
          MM.el('span', {}, [
            MM.el('span', { style: 'font-weight:600', text: r.navn }),
            r.konkurs ? MM.el('span', { class: 'lapp lapp-rod', style: 'margin-left:.5rem', text: 'Konkurs' }) : null
          ]),
          MM.el('span', { class: 'sum' + (r.plass === 1 ? ' gull' : ''), text: MM.fmt(r.formue) })
        ]));
      });

      /* Spesialpriser */
      priser.appendChild(MM.el('div', { class: 'panel-tittel', style: 'grid-column:1/-1', text: 'Spesialpriser' }));
      var n = 0;
      PRISER.forEach(function (p) {
        var best = null;
        res.forEach(function (r) {
          var v = (r.stat && r.stat[p.felt]) || 0;
          if (v <= 0) return;
          if (!best || v > best.v) best = { r: r, v: v };
        });
        if (!best) return;
        priser.appendChild(MM.el('div', { class: 'pris', style: 'animation-delay:' + (600 + n * 110) + 'ms' }, [
          MM.el('div', { class: 'em', text: p.em }),
          MM.el('div', { class: 'tittel', text: p.tittel }),
          MM.el('div', { class: 'vinner', text: best.r.navn }),
          MM.el('div', { class: 'verdi', text: p.enhet === 'kr' ? MM.fmt(best.v) : best.v + ' ' + p.enhet }),
          MM.el('div', { class: 'liten svak', text: p.tekst })
        ]));
        n++;
      });

      bunn.appendChild(MM.el('button', {
        class: 'knapp knapp-gull', html: '🎲 Nytt spill',
        onclick: function () { MM.Sesjon.skriv({ kode: null }); location.href = 'index.html'; }
      }));
      bunn.appendChild(MM.el('button', {
        class: 'knapp knapp-tom', text: 'Lukk',
        onclick: function () { lag.remove(); kjorer = false; }
      }));

      /* Lagre til den evige resultatlista */
      if (valg.lagre) {
        MM.Nett.lagreResultat(res).then(function () {
          bunn.appendChild(MM.el('span', { class: 'lapp lapp-gronn', text: 'Lagret i resultatlista' }));
        });
      }
    }

    setTimeout(neste, 1600);
  };

  function grunnTekst(s) {
    if (!s.vinner) return '';
    if (s.vinner.grunn === 'mal') return 'Målformuen er nådd — ' + MM.fmt(s.regler.mal);
    if (s.vinner.grunn === 'tid') return 'Tiden er ute. Rikest vinner.';
    return 'Alle andre er konkurs.';
  }

  S.kjorer = function () { return kjorer; };

})(window.MM = window.MM || {});
