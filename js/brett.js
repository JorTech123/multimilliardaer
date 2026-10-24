/* ============================================================
   Multimilliardær — brettvisning
   Tegner 40 felt i et 11x11-rutenett, med et eget lag for brikkene
   som glir mellom feltene.
   ============================================================ */
(function (MM) {
  'use strict';

  var B = MM.Brett = {};

  /* Rutenettposisjon for hvert felt, samt hvilken vei stripa peker */
  function rutenett(i) {
    var n = MM.BOARD.length;          // 40
    var side = (n - 4) / 4;           // 9 felt per side
    if (i === 0)                      return { rad: side + 2, kol: side + 2, hjorne: true,  o: 'o-bunn' };
    if (i < side + 1)                 return { rad: side + 2, kol: side + 2 - i, o: 'o-bunn' };
    if (i === side + 1)               return { rad: side + 2, kol: 1, hjorne: true, o: 'o-bunn' };
    if (i < 2 * side + 2)             return { rad: side + 2 - (i - side - 1), kol: 1, o: 'o-hoyre' };
    if (i === 2 * side + 2)           return { rad: 1, kol: 1, hjorne: true, o: 'o-topp' };
    if (i < 3 * side + 3)             return { rad: 1, kol: 1 + (i - 2 * side - 2), o: 'o-topp' };
    if (i === 3 * side + 3)           return { rad: 1, kol: side + 2, hjorne: true, o: 'o-topp' };
    return { rad: 1 + (i - 3 * side - 3), kol: side + 2, o: 'o-venstre' };
  }
  B.rutenett = rutenett;

  var IKON = {
    start: '⭐', ferie: '🏖️', bors: '📈', casino: '🎲',
    sjanse: '❓', skatt: '💸', trafikkfyr: '🚦'
  };

  /* ------------------------------------------------------------
     lag() — bygger brettet én gang
     ------------------------------------------------------------ */
  B.lag = function (vert, valg) {
    valg = valg || {};
    var brett = MM.el('div', { class: 'brett' });
    var felter = [];

    MM.BOARD.forEach(function (f, i) {
      var g = rutenett(i);
      var klasser = ['rute', 'f-' + f.type, g.o];
      if (g.hjorne) klasser.push('hjorne');

      var e = MM.el('div', {
        class: klasser.join(' '),
        style: 'grid-row:' + g.rad + ';grid-column:' + g.kol + (f.farge ? ';--ffarge:' + f.farge : ''),
        'data-pos': i,
        title: f.navn + (f.pris ? ' — ' + MM.fmt(f.pris) : '') + (f.info ? '\n' + f.info : '')
      });

      if (f.type === 'tomt') {
        e.appendChild(MM.el('div', { class: 'stripe' }));
        var t = MM.el('div', { class: 'ftekst' }, [
          MM.el('div', { class: 'fnavn', text: f.navn }),
          MM.el('div', { class: 'fpris tall', text: MM.kort(f.pris) })
        ]);
        e.appendChild(t);
        e.appendChild(MM.el('div', { class: 'bygg' }));
      } else {
        e.appendChild(MM.el('div', { class: 'em', text: IKON[f.type] || '' }));
        e.appendChild(MM.el('div', { class: 'fnavn', text: f.navn }));
      }

      if (valg.klikk) {
        e.style.cursor = 'pointer';
        e.addEventListener('click', function () { valg.klikk(i, f); });
      }
      brett.appendChild(e);
      felter.push(e);
    });

    /* Midten */
    var midt = MM.el('div', { class: 'brettmidt' }, [
      MM.el('div', { class: 'midt' }, [
        MM.el('div', { class: 'logo', text: 'Multimilliardær' }),
        MM.el('div', { class: 'logo-under', text: 'Tomter · Børs · Gjeldsbrev' })
      ]),
      MM.el('div', { class: 'turvarsel' }),
      MM.el('div', { class: 'terningplass' })
    ]);
    brett.appendChild(midt);

    var brikkelag = MM.el('div', { class: 'brikkelag' });
    brett.appendChild(brikkelag);

    vert.innerHTML = '';
    vert.appendChild(brett);

    var api = {
      brett: brett,
      felter: felter,
      brikkelag: brikkelag,
      turvarsel: midt.querySelector('.turvarsel'),
      terningplass: midt.querySelector('.terningplass'),
      brikker: {},
      senter: [],
      visBrikker: valg.brikker !== false
    };

    maalOpp(api);
    var tid = null;
    addEventListener('resize', function () {
      clearTimeout(tid);
      tid = setTimeout(function () { maalOpp(api); plasserAlle(api); }, 140);
    });

    return api;
  };

  /* Finn midtpunktet til hvert felt, i prosent av brikkelaget.
     Vi måler mot brikkelaget og ikke brettet, slik at brikkene
     treffer midt på feltet uansett polstring og kantbredde. */
  function maalOpp(api) {
    var br = api.brikkelag.getBoundingClientRect();
    if (!br.width || !br.height) return;
    api.senter = api.felter.map(function (e) {
      var r = e.getBoundingClientRect();
      return {
        x: (r.left - br.left + r.width / 2) / br.width * 100,
        y: (r.top - br.top + r.height / 2) / br.height * 100
      };
    });
  }

  /* ------------------------------------------------------------
     Brikker
     ------------------------------------------------------------ */
  function brikkeFor(api, id, farge, emoji, klasser) {
    if (api.brikker[id]) return api.brikker[id];
    var e = MM.el('div', {
      class: 'brikke ' + (klasser || ''),
      style: '--bfarge:' + farge,
      text: emoji,
      'data-id': id
    });
    api.brikkelag.appendChild(e);
    api.brikker[id] = e;
    return e;
  }

  function plasser(api, el, pos, nr, antall) {
    var c = api.senter[pos];
    if (!c) return;
    /* Flere brikker på samme felt sprer seg i en liten ring */
    var spredning = antall > 1 ? 1.6 : 0;
    var vinkel = (nr / Math.max(1, antall)) * Math.PI * 2 - Math.PI / 2;
    el.style.left = (c.x + Math.cos(vinkel) * spredning) + '%';
    el.style.top = (c.y + Math.sin(vinkel) * spredning) + '%';
  }

  function plasserAlle(api) {
    if (!api._sisteTilstand) return;
    B.oppdaterBrikker(api, api._sisteTilstand);
  }

  B.oppdaterBrikker = function (api, s) {
    if (!api.visBrikker) return;
    api._sisteTilstand = s;
    if (!api.senter.length) maalOpp(api);

    /* Hvor mange brikker står på hvert felt? */
    var antall = {};
    s.spillere.forEach(function (p) {
      if (p.konkurs) return;
      antall[p.pos] = (antall[p.pos] || 0) + 1;
    });
    antall[s.ola.pos] = (antall[s.ola.pos] || 0) + 1;

    var brukt = {};
    var aktivP = MM.Engine.aktivId(s);

    s.spillere.forEach(function (p) {
      var f = MM.figur(p.figur);
      var e = brikkeFor(api, p.id, f.farge, f.emoji);
      e.className = 'brikke' + (p.konkurs ? ' konkursbrikke' : '') + (p.id === aktivP ? ' aktivbrikke' : '');
      var nr = brukt[p.pos] = (brukt[p.pos] || 0);
      brukt[p.pos]++;
      plasser(api, e, p.pos, nr, antall[p.pos] || 1);
      e.title = p.navn + ' — ' + MM.fmt(p.cash);
    });

    var o = brikkeFor(api, 'ola', MM.OLA.farge, MM.OLA.emoji, 'ola');
    o.className = 'brikke ola';
    o.title = MM.OLA.navn;
    var nrO = brukt[s.ola.pos] || 0;
    plasser(api, o, s.ola.pos, nrO, antall[s.ola.pos] || 1);
  };

  /* Liten hoppeanimasjon når en brikke flytter */
  B.hopp = function (api, id) {
    var e = api.brikker[id];
    if (!e) return;
    e.classList.remove('hopper');
    void e.offsetWidth;
    e.classList.add('hopper');
  };

  /* ------------------------------------------------------------
     Felttilstand: eier, bygg, pant
     ------------------------------------------------------------ */
  B.oppdaterFelter = function (api, s) {
    MM.BOARD.forEach(function (f, i) {
      if (f.type !== 'tomt') return;
      var e = api.felter[i];
      var d = s.tomter[String(i)];
      if (!d) return;
      var eier = d.eier ? MM.Engine.sp(s, d.eier) : null;
      if (eier) {
        var farge = MM.figur(eier.figur).farge;
        e.classList.add('eid');
        e.style.setProperty('--eierfarge', farge);
        e.title = f.navn + '\nEier: ' + eier.navn + '\nLeie nå: ' + MM.fmt(MM.Engine.grunnLeie(s, i));
      } else {
        e.classList.remove('eid');
        e.style.removeProperty('--eierfarge');
        e.title = f.navn + ' — ' + MM.fmt(f.pris) + (f.auksjonKun ? '\nSelges bare på auksjon' : '');
      }
      e.classList.toggle('pantsatt', !!d.pant);

      var byggEl = e.querySelector('.bygg');
      if (!byggEl) return;
      var vil = d.slott ? 'slott' : d.hotell ? 'hotell' : 'hus' + (d.hus || 0);
      if (byggEl.dataset.vil === vil) return;
      byggEl.dataset.vil = vil;
      byggEl.innerHTML = '';
      if (d.slott) byggEl.appendChild(MM.el('span', { class: 'slott', title: 'Slott' }));
      else if (d.hotell) byggEl.appendChild(MM.el('span', { class: 'hotell', title: 'Hotell' }));
      else for (var h = 0; h < (d.hus || 0); h++) byggEl.appendChild(MM.el('span', { class: 'hus', title: 'Hus' }));
    });
  };

  /* Marker feltet noe skjer på */
  B.blink = function (api, pos) {
    var e = api.felter[pos];
    if (!e) return;
    api.felter.forEach(function (x) { x.classList.remove('aktiv'); });
    e.classList.add('aktiv');
    e.classList.remove('treff');
    void e.offsetWidth;
    e.classList.add('treff');
    setTimeout(function () { e.classList.remove('aktiv'); }, 2600);
  };

  /* ------------------------------------------------------------
     Turvarsel i midten
     ------------------------------------------------------------ */
  var STEGTEKST = {
    'ola-kast': 'kaster for Ola Nordmann',
    'bil-kast': 'kaster for egen figur',
    'handel': 'handler aksjer og bygger',
    'ferie-valg': 'er på Feriehotellet',
    'lobby': 'venter'
  };

  B.oppdaterTur = function (api, s) {
    var el = api.turvarsel;
    if (!el) return;
    if (s.fase === 'lobby') {
      el.innerHTML = '';
      el.appendChild(MM.el('div', { class: 'hva', text: 'Venter på at spillet starter' }));
      return;
    }
    if (s.fase === 'ferdig') {
      var v = s.vinner && MM.Engine.sp(s, s.vinner.vinnerId);
      el.innerHTML = '';
      el.appendChild(MM.el('div', { class: 'em', text: '🏆' }));
      el.appendChild(MM.el('div', { class: 'hvem', text: v ? v.navn + ' vant!' : 'Spillet er slutt' }));
      return;
    }
    var p = MM.Engine.aktiv(s);
    if (!p) return;
    var f = MM.figur(p.figur);
    var hva = STEGTEKST[s.tur.steg] || '';
    if (s.auksjon) hva = 'AUKSJON: ' + MM.BOARD[s.auksjon.pos].navn;
    else if (s.tur.ventende) {
      var v2 = s.tur.ventende.type;
      hva = v2 === 'kjop' ? 'kan kjøpe ' + MM.BOARD[s.tur.ventende.pos].navn
          : v2 === 'kort' ? 'trakk et sjansekort'
          : v2 === 'casino' ? 'er på Casino'
          : v2 === 'bors' ? 'handler på børsen'
          : v2 === 'skaff-penger' ? 'må skaffe penger!'
          : v2 === 'ferie-ankomst' ? 'er på Feriehotellet'
          : hva;
    }
    el.innerHTML = '';
    el.appendChild(MM.el('div', { class: 'em', text: f.emoji }));
    el.appendChild(MM.el('div', { class: 'hvem', text: p.navn }));
    el.appendChild(MM.el('div', { class: 'hva', text: hva }));
  };

  B.oppdater = function (api, s) {
    B.oppdaterFelter(api, s);
    B.oppdaterBrikker(api, s);
    B.oppdaterTur(api, s);
  };

})(window.MM = window.MM || {});
