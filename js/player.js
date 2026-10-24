/* ============================================================
   Multimilliardær — spillerens eget display
   Alt en spiller trenger på sin egen telefon, og full innsikt
   i hva de andre holder på med.
   ============================================================ */
(function (MM) {
  'use strict';

  var minId, T = null, forrigeV = -1, forrigeCash = null;
  var brettApi = null, kortVist = null, auksjonVist = null, seremoniKjort = false;
  var E = {};   // elementreferanser

  /* ------------------------------------------------------------
     Oppstart
     ------------------------------------------------------------ */
  function start() {
    MM.adopterIdFraUrl();
    minId = MM.Sesjon.minId();
    var kode = MM.kodeFraUrl() || MM.Sesjon.les().kode;
    if (!kode) { location.href = 'index.html'; return; }

    byggStillas();
    MM.Nett.koble(kode).then(function (s) {
      if (!s) throw new Error('Fant ikke spillet');
      if (!MM.Engine.sp(s, minId)) {
        MM.toast('Du er ikke med i dette spillet', 'feil', 5000);
        setTimeout(function () { location.href = 'index.html?kode=' + kode; }, 1400);
        return;
      }
      MM.Nett.pa(oppdater);
      MM.Nett.start();
      startPuls();
      /* Botene trenger noen til å trykke for seg. Det blir spillverten,
         slik at bare én klient tar trekkene deres. */
      MM.Bot.start(function () { return T; }, minId);
    }).catch(function (e) {
      MM.toast(MM.esc(e.message), 'feil', 6000);
      setTimeout(function () { location.href = 'index.html'; }, 1800);
    });
  }

  /* Si fra at vi lever, slik at vertsrollen kan overtas om noen forsvinner */
  function startPuls() {
    setInterval(function () {
      if (!T || T.fase !== 'spiller' || document.hidden) return;
      if (MM.Engine.aktivId(T) !== minId) return;   // bare i egen tur, for å spare skriving
      MM.Nett.send({ type: 'PULS', pid: minId }, { stille: true }).catch(function () {});
    }, 45000);
  }

  /* ------------------------------------------------------------
     Stillas
     ------------------------------------------------------------ */
  function byggStillas() {
    var rot = MM.$('#app');
    rot.innerHTML = '';

    E.em = MM.el('span', { class: 'em' });
    E.navn = MM.el('div', { class: 'sp-navn' });
    E.cash = MM.el('div', { class: 'sp-cash tall' });
    E.lapper = MM.el('div', { class: 'rad', style: 'gap:.3rem;flex-wrap:wrap' });

    var topp = MM.el('div', { class: 'sp-topp' }, [
      E.em,
      MM.el('div', { class: 'vokse' }, [E.navn, E.lapper]),
      MM.el('div', { style: 'text-align:right' }, [
        E.cash,
        MM.el('div', { class: 'liten svak', text: 'kontanter' })
      ]),
      MM.el('button', {
        class: 'knapp knapp-tom knapp-liten',
        title: 'Meny',
        style: 'padding:.3rem .55rem;font-size:1.1rem;line-height:1',
        text: '⋯',
        onclick: visMeny
      })
    ]);

    E.formue = MM.el('div', { class: 'panel' });
    E.brett = MM.el('div', { class: 'brettramme', style: 'margin:0 -.3rem' });
    E.tomter = MM.el('div', { class: 'panel' });
    E.bors = MM.el('div', { class: 'panel' });
    E.motspillere = MM.el('div', { class: 'panel' });
    E.strom = MM.el('div', { class: 'panel' });
    E.bank = MM.el('div', { class: 'panel' });

    E.innhold = MM.el('div', { class: 'sp-innhold' }, [
      E.formue, E.brett, E.bors, E.tomter, E.bank, E.motspillere, E.strom
    ]);

    E.handling = MM.el('div', { class: 'innhold' });
    var handlingslinje = MM.el('div', { class: 'sp-handling' }, [E.handling]);

    rot.appendChild(topp);
    rot.appendChild(E.innhold);
    rot.appendChild(handlingslinje);

    brettApi = MM.Brett.lag(E.brett, { klikk: visFeltinfo });
  }

  /* ------------------------------------------------------------
     Meny — og veien ut av spillet
     ------------------------------------------------------------ */
  function visMeny() {
    MM.Lyd.klikk();
    var lydKnapp = MM.el('button', {
      class: 'knapp knapp-blokk',
      text: MM.Lyd.av ? '🔇 Slå på lydeffekter' : '🔊 Slå av lydeffekter'
    });
    lydKnapp.addEventListener('click', function () {
      var pa = MM.Lyd.veksle();
      lydKnapp.textContent = pa ? '🔊 Slå av lydeffekter' : '🔇 Slå på lydeffekter';
    });

    var musKnapp = MM.el('button', {
      class: 'knapp knapp-blokk',
      text: MM.Musikk.av ? '🎵 Slå på musikk' : '🎵 Slå av musikk'
    });
    musKnapp.addEventListener('click', function () {
      var pa = MM.Musikk.veksle();
      musKnapp.textContent = pa ? '🎵 Slå av musikk' : '🎵 Slå på musikk';
      volumRad.style.display = pa ? '' : 'none';
    });

    var volum = MM.el('input', {
      type: 'range', min: 0, max: 100, value: Math.round(MM.Musikk.volum * 100),
      style: 'width:100%'
    });
    volum.addEventListener('input', function () { MM.Musikk.settVolum(volum.value / 100); });
    var volumRad = MM.el('div', {
      class: 'panel', style: MM.Musikk.av ? 'display:none' : ''
    }, [
      MM.el('label', { class: 'merke', text: 'Musikkvolum' }), volum
    ]);

    var lag = MM.modal([
      MM.el('h3', { text: 'Meny' }),
      MM.el('div', { class: 'liten dim', style: 'margin-bottom:.9rem' }, [
        MM.el('div', { html: 'Spillkode: <b class="tall">' + MM.esc(MM.Nett.kode || '') + '</b>' }),
        MM.el('div', { text: MM.Nett.erSky() ? 'Lagres i Google Regneark' : 'Lokal modus — bare denne maskinen' })
      ]),
      MM.el('div', { class: 'stabel' }, [
        lydKnapp,
        musKnapp,
        volumRad,
        MM.el('a', {
          class: 'knapp knapp-blokk', href: 'board.html?kode=' + (MM.Nett.kode || '') + '&som=' + minId,
          target: '_blank', html: '📺 Åpne storskjerm'
        }),
        MM.el('button', {
          class: 'knapp knapp-blokk', text: '📋 Kopier spillkoden',
          onclick: function () {
            try {
              navigator.clipboard.writeText(MM.Nett.kode);
              MM.toast('Kopiert: <b>' + MM.esc(MM.Nett.kode) + '</b>', 'ok', 2000);
            } catch (e) { MM.toast('Kode: <b>' + MM.esc(MM.Nett.kode) + '</b>', 'info'); }
          }
        }),
        MM.el('hr', { class: 'skille', style: 'margin:.4rem 0' }),
        MM.el('button', {
          class: 'knapp knapp-tom knapp-blokk', text: '↩ Forlat spillet',
          onclick: function () {
            lag.lukk();
            bekreftForlat();
          }
        })
      ]),
      MM.el('div', { style: 'height:.7rem' }),
      MM.el('button', {
        class: 'knapp knapp-tom knapp-blokk', text: 'Lukk',
        onclick: function () { lag.lukk(); }
      })
    ]);
  }

  function bekreftForlat() {
    var lag = MM.modal([
      MM.el('h3', { text: 'Forlate spillet?' }),
      MM.el('div', { class: 'dim', style: 'margin-bottom:1rem', html:
        'Du går tilbake til forsiden og kan starte eller bli med i et nytt spill.<br><br>' +
        'Spillet <b>' + MM.esc(MM.Nett.kode || '') + '</b> lever videre, og figuren din blir stående. ' +
        'Du kan komme tilbake ved å taste samme spillkode.'
      }),
      MM.el('div', { class: 'knapprad' }, [
        MM.el('button', {
          class: 'knapp knapp-rod', text: 'Ja, forlat',
          onclick: function () {
            MM.Nett.stopp();
            MM.Sesjon.skriv({ kode: null });
            MM.glem('sisteSesjon');
            location.href = 'index.html';
          }
        }),
        MM.el('button', { class: 'knapp knapp-tom', text: 'Bli', onclick: function () { lag.lukk(); } })
      ])
    ]);
  }

  /* ------------------------------------------------------------
     Hovedoppdatering
     ------------------------------------------------------------ */
  function oppdater(s, hendelser) {
    if (!s) return;
    T = s;
    var nyVersjon = s.v !== forrigeV;
    forrigeV = s.v;

    if (s.fase === 'lobby') { location.href = 'index.html?kode=' + s.id; return; }

    tegnTopp(s);
    tegnFormue(s);
    MM.Brett.oppdater(brettApi, s);
    tegnBors(s);
    tegnTomter(s);
    tegnBank(s);
    tegnMotspillere(s);
    tegnStrom(s, hendelser);
    tegnHandling(s);

    if (hendelser && hendelser.length) animer(s, hendelser);

    if (s.auksjon) visAuksjon(s); else lukkAuksjon();
    if (s.tur.ventende && s.tur.ventende.type === 'kort' && MM.Engine.aktivId(s) === minId) visKort(s);

    if (s.fase === 'ferdig' && !seremoniKjort) {
      seremoniKjort = true;
      setTimeout(function () {
        MM.Seremoni.vis(s, { lagre: s.vertId === minId });
      }, 900);
    }
  }

  /* ------------------------------------------------------------
     Topplinje
     ------------------------------------------------------------ */
  function tegnTopp(s) {
    var p = MM.Engine.sp(s, minId);
    if (!p) return;
    var f = MM.figur(p.figur);
    E.em.textContent = f.emoji;
    E.navn.textContent = p.navn;
    E.cash.textContent = MM.fmt(p.cash);

    if (forrigeCash !== null && p.cash !== forrigeCash) {
      E.cash.classList.remove('blink-opp', 'blink-ned');
      void E.cash.offsetWidth;
      E.cash.classList.add(p.cash > forrigeCash ? 'blink-opp' : 'blink-ned');
      MM.flyvendeTall(E.cash, (p.cash > forrigeCash ? '+' : '') + MM.kort(p.cash - forrigeCash), p.cash > forrigeCash);
    }
    forrigeCash = p.cash;

    E.lapper.innerHTML = '';
    var minTur = MM.Engine.aktivId(s) === minId;
    if (minTur) E.lapper.appendChild(MM.el('span', { class: 'lapp lapp-gull', text: 'Din tur' }));
    if (s.vertId === minId) E.lapper.appendChild(MM.el('span', { class: 'lapp', text: 'Vert' }));
    if (p.gjeld) E.lapper.appendChild(MM.el('span', { class: 'lapp lapp-rod', text: p.gjeld + ' gjeldsbrev' }));
    if (p.paaFerie) E.lapper.appendChild(MM.el('span', { class: 'lapp lapp-bla', text: 'På ferie' }));
    if (p.immun > 0) E.lapper.appendChild(MM.el('span', { class: 'lapp lapp-gronn', text: 'Leiefritak' }));
    if (p.konkurs) E.lapper.appendChild(MM.el('span', { class: 'lapp lapp-rod', text: 'Konkurs' }));
  }

  /* ------------------------------------------------------------
     Formuesmåler
     ------------------------------------------------------------ */
  function tegnFormue(s) {
    var p = MM.Engine.sp(s, minId);
    var f = MM.Engine.formue(s, p);
    var pst = Math.min(100, Math.max(0, f / s.regler.mal * 100));
    E.formue.innerHTML = '';
    E.formue.appendChild(MM.el('div', { class: 'rad rad-mellom' }, [
      MM.el('div', {}, [
        MM.el('div', { class: 'liten svak', text: 'Total formue' }),
        MM.el('div', { class: 'tall', style: 'font-size:1.35rem;font-weight:700;color:var(--gull)', text: MM.fmt(f) })
      ]),
      MM.el('div', { style: 'text-align:right' }, [
        MM.el('div', { class: 'liten svak', text: 'Mål' }),
        MM.el('div', { class: 'tall', text: MM.kort(s.regler.mal) }),
        MM.hjelpeknapp('mal', 'Hva teller?')
      ])
    ]));
    E.formue.appendChild(MM.el('div', { class: 'framdrift', style: 'margin-top:.6rem' }, [
      MM.el('i', { style: 'width:' + pst.toFixed(1) + '%' })
    ]));
    if (s.regler.tidsgrenseMin > 0 && s.startet > 1) {
      var igjen = s.regler.tidsgrenseMin * 60000 - (Date.now() - s.startet);
      E.formue.appendChild(MM.el('div', { class: 'liten svak midt', style: 'margin-top:.4rem',
        text: 'Tid igjen: ' + MM.klokke(igjen) }));
    }
  }

  /* ------------------------------------------------------------
     Børstavle med handel
     ------------------------------------------------------------ */
  function tegnBors(s) {
    var p = MM.Engine.sp(s, minId);
    var kan = MM.Engine.kanGjore(s, minId);
    E.bors.innerHTML = '';
    E.bors.appendChild(MM.el('div', { class: 'panel-tittel' }, [
      MM.el('span', { text: 'Børsen' }), MM.hjelpeknapp('bors')
    ]));

    MM.SERIES.forEach(function (se) {
      var kurs = MM.Engine.kursPris(s, se.id);
      var mine = p.aksjer[se.id] || 0;
      var iBank = s.bank.aksjer[se.id] || 0;
      var stor = MM.Engine.storAksjonar(s, se.id);

      var kjop = MM.el('button', {
        class: 'knapp knapp-liten', text: '+',
        title: 'Kjøp 1 aksje for ' + MM.fmt(kurs),
        disabled: (!kan.handel || kurs <= 0 || iBank < 1 || p.cash < kurs) ? 'disabled' : null,
        onclick: function () { MM.Nett.send({ type: 'KJOP_AKSJER', pid: minId, serie: se.id, antall: 1 }).then(MM.Lyd.kasse.bind(MM.Lyd)); }
      });
      var selg = MM.el('button', {
        class: 'knapp knapp-liten', text: '−',
        title: 'Selg 1 aksje for ' + MM.fmt(kurs),
        disabled: ((!kan.handel && !kan.maaSkaffe) || kurs <= 0 || mine < 1) ? 'disabled' : null,
        onclick: function () { MM.Nett.send({ type: 'SELG_AKSJER', pid: minId, serie: se.id, antall: 1 }).then(MM.Lyd.kasse.bind(MM.Lyd)); }
      });

      E.bors.appendChild(MM.el('div', { class: 'port-rad', style: 'color:' + se.farge }, [
        MM.el('span', { class: 'port-prikk', style: 'background:' + se.farge }),
        MM.el('div', { style: 'min-width:0;color:var(--tekst)' }, [
          MM.el('div', { class: 'port-navn', text: se.navn }),
          MM.el('div', { class: 'liten svak' }, [
            MM.el('span', { class: 'tall', text: kurs > 0 ? MM.fmt(kurs) : 'suspendert' }),
            MM.el('span', { text: ' · bank ' + iBank }),
            stor ? MM.el('span', { class: 'gull', text: ' · ' + (stor.id === minId ? 'du' : stor.navn) + ' har utbytte' }) : null
          ])
        ]),
        MM.el('span', { class: 'port-ant', style: 'color:var(--tekst)', text: String(mine) }),
        MM.el('span', { class: 'handelsrad' }, [selg, kjop])
      ]));
    });

    if (!kan.handel) {
      E.bors.appendChild(MM.el('div', { class: 'liten svak midt', style: 'margin-top:.5rem',
        text: 'Du kan handle aksjer når det er din tur' }));
    }
  }

  /* ------------------------------------------------------------
     Mine tomter
     ------------------------------------------------------------ */
  function tegnTomter(s) {
    var kan = MM.Engine.kanGjore(s, minId);
    E.tomter.innerHTML = '';
    E.tomter.appendChild(MM.el('div', { class: 'panel-tittel' }, [
      MM.el('span', { text: 'Mine tomter' }), MM.hjelpeknapp('bygg')
    ]));

    var mine = [];
    MM.tomter.forEach(function (f) {
      var d = s.tomter[String(f.pos)];
      if (d && d.eier === minId) mine.push({ f: f, d: d });
    });

    if (!mine.length) {
      E.tomter.appendChild(MM.el('div', { class: 'liten svak midt', text: 'Ingen tomter ennå. Kjøp når du lander på en ledig.' }));
      return;
    }

    /* Grupper etter serie */
    MM.SERIES.forEach(function (se) {
      var iSerie = mine.filter(function (x) { return x.f.serie === se.id; });
      if (!iSerie.length) return;
      var hel = MM.Engine.eierHelSerie(s, minId, se.id);
      E.tomter.appendChild(MM.el('div', { class: 'rad', style: 'margin:.5rem 0 .25rem;gap:.4rem' }, [
        MM.el('span', { class: 'port-prikk', style: 'background:' + se.farge + ';color:' + se.farge }),
        MM.el('span', { class: 'liten', style: 'font-weight:600', text: se.navn }),
        hel ? MM.el('span', { class: 'lapp lapp-gronn', text: 'Hel serie' })
            : MM.el('span', { class: 'lapp', text: iSerie.length + '/' + MM.tomterISerie(se.id).length })
      ]));

      iSerie.forEach(function (x) {
        var feil = MM.Engine.kanBygge(s, minId, x.f.pos);
        var pris = x.f.husPris;
        var niva = x.d.slott ? 'Slott' : x.d.hotell ? 'Hotell' : x.d.hus ? x.d.hus + ' hus' : 'Ubebygd';
        var ikon = x.d.slott ? '🏰' : x.d.hotell ? '🏨' : new Array(x.d.hus + 1).join('🏠');

        var byggKnapp = MM.el('button', {
          class: 'knapp knapp-liten knapp-gronn',
          html: '🏠 ' + MM.kort(pris),
          title: feil || ('Bygg for ' + MM.fmt(pris)),
          disabled: (!kan.handel || feil || p_cash(s) < pris) ? 'disabled' : null,
          onclick: function () { MM.Nett.send({ type: 'BYGG', pid: minId, pos: x.f.pos }).then(function () { MM.Lyd.opp(); }); }
        });

        var meny = MM.el('button', {
          class: 'knapp knapp-liten knapp-tom', text: '⋯',
          onclick: function () { visTomtemeny(s, x); }
        });

        E.tomter.appendChild(MM.el('div', {
          class: 'tomtekort' + (x.d.pant ? ' pantsatt' : ''),
          style: '--tfarge:' + se.farge
        }, [
          MM.el('div', {}, [
            MM.el('div', { class: 'tnavn', text: x.f.navn }),
            MM.el('div', { class: 'tunder' }, [
              MM.el('span', { class: 'bygg-ikon', text: ikon ? ikon + ' ' : '' }),
              MM.el('span', { text: niva + ' · leie ' + MM.fmt(MM.Engine.grunnLeie(s, x.f.pos)) }),
              x.d.pant ? MM.el('span', { style: 'color:var(--rod)', text: ' · PANTSATT' }) : null
            ])
          ]),
          MM.el('div', { class: 'handelsrad' }, [byggKnapp, meny])
        ]));
      });
    });
  }

  function p_cash(s) {
    var p = MM.Engine.sp(s, minId);
    return p ? p.cash : 0;
  }

  function visTomtemeny(s, x) {
    MM.Lyd.klikk();
    var d = x.d, f = x.f;
    var har = d.hus > 0 || d.hotell || d.slott;
    MM.modal([
      MM.el('h3', { text: f.navn }),
      MM.el('div', { class: 'liten dim', style: 'margin-bottom:.9rem', html:
        'Takst: <b class="tall">' + MM.fmt(f.pris) + '</b><br>' +
        'Leie nå: <b class="tall">' + MM.fmt(MM.Engine.grunnLeie(s, f.pos)) + '</b><br>' +
        'Hus koster: <b class="tall">' + MM.fmt(f.husPris) + '</b><br>' +
        'Panteverdi: <b class="tall">' + MM.fmt(f.pant) + '</b>'
      }),
      MM.el('div', { class: 'stabel' }, [
        har ? MM.el('button', {
          class: 'knapp knapp-blokk', html: 'Selg et bygg — få ' + MM.fmt(Math.round(f.husPris / 2)),
          onclick: function (e) { lukk(e); MM.Nett.send({ type: 'SELG_BYGG', pid: minId, pos: f.pos }); }
        }) : null,
        !d.pant && !har ? MM.el('button', {
          class: 'knapp knapp-blokk', html: 'Pantsett — få ' + MM.fmt(f.pant),
          onclick: function (e) { lukk(e); MM.Nett.send({ type: 'PANTSETT', pid: minId, pos: f.pos }); }
        }) : null,
        d.pant ? MM.el('button', {
          class: 'knapp knapp-blokk knapp-gronn',
          html: 'Innfri pant — betal ' + MM.fmt(Math.round(f.pant * 1.1)),
          onclick: function (e) { lukk(e); MM.Nett.send({ type: 'INNFRI_PANT', pid: minId, pos: f.pos }); }
        }) : null,
        MM.el('button', { class: 'knapp knapp-tom knapp-blokk', text: 'Lukk', onclick: lukk })
      ])
    ]);
    function lukk(e) { e.target.closest('.modallag').lukk(); }
  }

  /* ------------------------------------------------------------
     Banken: gjeldsbrev
     ------------------------------------------------------------ */
  function tegnBank(s) {
    var p = MM.Engine.sp(s, minId);
    E.bank.innerHTML = '';
    E.bank.appendChild(MM.el('div', { class: 'panel-tittel' }, [
      MM.el('span', { text: 'Banken' }), MM.hjelpeknapp('gjeld')
    ]));
    E.bank.appendChild(MM.el('div', { class: 'rad rad-mellom', style: 'margin-bottom:.6rem' }, [
      MM.el('div', { class: 'liten' }, [
        MM.el('div', { html: 'Gjeldsbrev: <b>' + p.gjeld + ' / ' + MM.GJELDSBREV_MAKS + '</b>' }),
        MM.el('div', { class: 'svak', text: 'Rente nå: ' + MM.fmt(p.gjeld * MM.GJELDSBREV_RENTE) + ' per tur' })
      ])
    ]));
    E.bank.appendChild(MM.el('div', { class: 'knapprad' }, [
      MM.el('button', {
        class: 'knapp knapp-liten', html: 'Lån ' + MM.fmt(MM.GJELDSBREV),
        disabled: p.gjeld >= MM.GJELDSBREV_MAKS || p.konkurs ? 'disabled' : null,
        onclick: function () { MM.Nett.send({ type: 'LAAN', pid: minId }).then(function () { MM.Lyd.kasse(); }); }
      }),
      MM.el('button', {
        class: 'knapp knapp-liten knapp-tom', html: 'Innfri ett lån',
        disabled: !p.gjeld || p.cash < MM.GJELDSBREV ? 'disabled' : null,
        onclick: function () { MM.Nett.send({ type: 'INNFRI_LAAN', pid: minId }); }
      })
    ]));
  }

  /* ------------------------------------------------------------
     Motspillere
     ------------------------------------------------------------ */
  function tegnMotspillere(s) {
    E.motspillere.innerHTML = '';
    E.motspillere.appendChild(MM.el('div', { class: 'panel-tittel', text: 'De andre' }));
    var aktivP = MM.Engine.aktivId(s);
    s.spillere.forEach(function (q) {
      if (q.id === minId) return;
      var f = MM.figur(q.figur);
      var antTomter = 0, antAksjer = 0;
      for (var pos in s.tomter) if (s.tomter[pos].eier === q.id) antTomter++;
      MM.SERIES.forEach(function (se) { antAksjer += q.aksjer[se.id] || 0; });
      E.motspillere.appendChild(MM.el('div', {
        class: 'sk' + (q.id === aktivP ? ' aktiv' : '') + (q.konkurs ? ' konkurs' : ''),
        style: '--pfarge:' + f.farge + ';margin-bottom:.4rem'
      }, [
        MM.el('span', { class: 'em', text: f.emoji }),
        MM.el('div', { style: 'min-width:0' }, [
          MM.el('div', { class: 'nv', text: (q.erBot ? '🤖 ' : '') + q.navn }),
          MM.el('div', { class: 'detalj' }, [
            MM.el('span', { text: '🏠 ' + antTomter }),
            MM.el('span', { text: '📈 ' + antAksjer }),
            q.gjeld ? MM.el('span', { style: 'color:var(--rod)', text: '🧾 ' + q.gjeld }) : null,
            MM.el('span', { text: MM.BOARD[q.pos].navn })
          ])
        ]),
        MM.el('div', { class: 'formue' }, [
          MM.el('span', { text: MM.kort(MM.Engine.formue(s, q)) }),
          MM.el('span', { class: 'maal', text: 'kontant ' + MM.kort(q.cash) })
        ])
      ]));
    });
  }

  /* ------------------------------------------------------------
     Hendelsesstrøm — alle ser alt
     ------------------------------------------------------------ */
  function tegnStrom(s, nye) {
    var nyeSeq = (nye || []).map(function (h) { return h.seq; });
    E.strom.innerHTML = '';
    E.strom.appendChild(MM.el('div', { class: 'panel-tittel', text: 'Hva skjer' }));
    var liste = MM.el('div', { class: 'strom' });
    (s.logg || []).slice().reverse().slice(0, 40).forEach(function (h) {
      liste.appendChild(MM.el('div', {
        class: 'strom-rad e-' + h.type + (nyeSeq.indexOf(h.seq) >= 0 ? ' ny' : ''),
        text: h.tekst
      }));
    });
    E.strom.appendChild(liste);
  }

  /* ------------------------------------------------------------
     Handlingslinja nederst
     ------------------------------------------------------------ */
  function tegnHandling(s) {
    var p = MM.Engine.sp(s, minId);
    var kan = MM.Engine.kanGjore(s, minId);
    E.handling.innerHTML = '';

    if (s.fase === 'ferdig') {
      E.handling.appendChild(MM.el('button', {
        class: 'knapp knapp-gull knapp-stor knapp-blokk', text: '🏆 Se premieutdelingen',
        onclick: function () { seremoniKjort = true; MM.Seremoni.vis(s, { lagre: false }); }
      }));
      return;
    }

    if (p.konkurs) {
      E.handling.appendChild(MM.el('div', { class: 'ventemelding', text: 'Du er ute av spillet. Følg med på resten!' }));
      return;
    }

    if (s.auksjon) {
      E.handling.appendChild(MM.el('div', { class: 'ventemelding', text: 'Auksjon pågår — se vinduet over' }));
      return;
    }

    /* Må skaffe penger */
    if (kan.maaSkaffe) {
      E.handling.appendChild(MM.el('div', {
        class: 'panel', style: 'border-color:var(--rod);background:rgba(255,90,110,.1)'
      }, [
        MM.el('div', { style: 'font-weight:700;color:var(--rod)', text: 'Du mangler ' + MM.fmt(-p.cash) }),
        MM.el('div', { class: 'liten dim', text: 'Selg aksjer, selg bygg, pantsett tomter eller ta opp gjeldsbrev. Rull opp for å gjøre det.' })
      ]));
      if (!MM.Engine.harUtveier(s, p)) {
        E.handling.appendChild(MM.el('button', {
          class: 'knapp knapp-rod knapp-blokk', text: 'Erklær konkurs',
          onclick: function () { if (confirm('Er du sikker? Da er du ute av spillet.')) MM.Nett.send({ type: 'GI_OPP', pid: minId }); }
        }));
      }
      return;
    }

    if (!kan.minTur) {
      var a = MM.Engine.aktiv(s);
      E.handling.appendChild(MM.el('div', { class: 'ventemelding' }, [
        MM.el('span', { text: (a ? MM.figur(a.figur).emoji + ' ' + a.navn : 'Noen') + ' spiller' }),
        MM.el('span', { class: 'prikker' })
      ]));
      return;
    }

    var v = s.tur.ventende;

    /* Ventende valg */
    if (v) {
      if (v.type === 'kjop') {
        var f = MM.BOARD[v.pos];
        E.handling.appendChild(MM.el('div', { class: 'midt liten dim', text: f.navn + ' — takst ' + MM.fmt(f.pris) }));
        E.handling.appendChild(MM.el('div', { class: 'knapprad' }, [
          MM.el('button', {
            class: 'knapp knapp-gull knapp-stor', html: 'Kjøp for ' + MM.fmt(f.pris),
            disabled: p.cash < f.pris ? 'disabled' : null,
            onclick: function () { MM.Nett.send({ type: 'KJOP', pid: minId }).then(function () { MM.Lyd.kasse(); }); }
          }),
          MM.el('button', {
            class: 'knapp knapp-stor', text: 'På auksjon',
            onclick: function () { MM.Nett.send({ type: 'TIL_AUKSJON', pid: minId }).then(function () { MM.Lyd.hammer(); }); }
          })
        ]));
        return;
      }
      if (v.type === 'auksjon-start') {
        E.handling.appendChild(MM.el('button', {
          class: 'knapp knapp-gull knapp-stor knapp-blokk', html: '🔨 Start auksjonen på ' + MM.BOARD[v.pos].navn,
          onclick: function () { MM.Nett.send({ type: 'TIL_AUKSJON', pid: minId }).then(function () { MM.Lyd.hammer(); }); }
        }));
        return;
      }
      if (v.type === 'kort') {
        E.handling.appendChild(MM.el('button', {
          class: 'knapp knapp-gull knapp-stor knapp-blokk', text: 'Se sjansekortet',
          onclick: function () { visKort(s, true); }
        }));
        return;
      }
      if (v.type === 'casino') { tegnCasino(s, p); return; }
      if (v.type === 'bors') { tegnBorsfelt(s, p, v); return; }
      if (v.type === 'ferie-ankomst') {
        E.handling.appendChild(MM.el('div', { class: 'midt liten dim', text: 'Feriehotellet — vil du sjekke inn? Første opphold er gratis.' }));
        E.handling.appendChild(MM.el('div', { class: 'knapprad' }, [
          MM.el('button', {
            class: 'knapp knapp-bla knapp-stor', text: '🏖️ Sjekk inn',
            onclick: function () { MM.Nett.send({ type: 'FERIE_ANKOMST', pid: minId, bli: true }); }
          }),
          MM.el('button', {
            class: 'knapp knapp-stor', text: 'Nei, videre',
            onclick: function () { MM.Nett.send({ type: 'FERIE_ANKOMST', pid: minId, bli: false }); }
          })
        ]));
        return;
      }
    }

    /* Feriehotellet: bli eller reise */
    if (s.tur.steg === 'ferie-valg') {
      var steg = Math.min(p.ferieOpphold, MM.FERIE_TRAPP.length - 1);
      var pris = MM.FERIE_TRAPP[steg];
      E.handling.appendChild(MM.el('div', { class: 'midt liten dim' }, [
        MM.el('span', { text: 'Du er på Feriehotellet. ' }), MM.hjelpeknapp('ferie')
      ]));
      E.handling.appendChild(MM.el('div', { class: 'knapprad' }, [
        MM.el('button', {
          class: 'knapp knapp-bla knapp-stor', html: 'Bli ' + (pris ? '(' + MM.fmt(pris) + ')' : '(gratis)'),
          disabled: pris > p.cash ? 'disabled' : null,
          onclick: function () { MM.Nett.send({ type: 'FERIE_BLI', pid: minId }); }
        }),
        MM.el('button', {
          class: 'knapp knapp-gull knapp-stor', html: '🎲 Reis (én terning)',
          onclick: function () {
            MM.Nett.send({ type: 'FERIE_REIS', pid: minId, terning: [MM.terning()] });
          }
        })
      ]));
      return;
    }

    /* Terningkast */
    if (kan.kastOla) {
      E.handling.appendChild(MM.el('button', {
        class: 'knapp knapp-gull knapp-stor knapp-blokk knapp-puls',
        html: '🚶 Kast for Ola Nordmann' + (s.tur.doble ? ' (dobbelt!)' : ''),
        onclick: function () {
          this.disabled = true;
          MM.Nett.send({ type: 'KAST_OLA', pid: minId, terning: MM.terningPar() })
            .catch(function () { tegnHandling(T); });
        }
      }));
      E.handling.appendChild(MM.el('div', { class: 'rad', style: 'justify-content:center' }, [MM.hjelpeknapp('ola', 'Hvorfor Ola først?')]));
      return;
    }

    if (kan.kastBil) {
      var mf = MM.figur(p.figur);
      E.handling.appendChild(MM.el('button', {
        class: 'knapp knapp-gull knapp-stor knapp-blokk knapp-puls',
        html: mf.emoji + ' Kast for deg selv' + (s.tur.doble ? ' (dobbelt!)' : ''),
        onclick: function () {
          this.disabled = true;
          MM.Nett.send({ type: 'KAST_BIL', pid: minId, terning: MM.terningPar() })
            .catch(function () { tegnHandling(T); });
        }
      }));
      return;
    }

    if (kan.handel) {
      E.handling.appendChild(MM.el('div', { class: 'midt liten dim', text: 'Handle aksjer, bygg eller lån — og avslutt når du er klar' }));
      E.handling.appendChild(MM.el('button', {
        class: 'knapp knapp-gronn knapp-stor knapp-blokk', text: '✓ Avslutt turen',
        onclick: function () {
          this.disabled = true;
          MM.Nett.send({ type: 'AVSLUTT_TUR', pid: minId }).catch(function () { tegnHandling(T); });
        }
      }));
      return;
    }

    E.handling.appendChild(MM.el('div', { class: 'ventemelding' }, [
      MM.el('span', { text: 'Et øyeblikk' }), MM.el('span', { class: 'prikker' })
    ]));
  }

  /* ---------- Casino ---------- */
  function tegnCasino(s, p) {
    var innsats = MM.el('input', {
      class: 'felt tall', type: 'number', value: Math.min(10000, p.cash), min: 0, step: 1000,
      style: 'text-align:center'
    });
    E.handling.appendChild(MM.el('div', { class: 'midt liten dim', text: '🎲 Casino: kast én terning. Sekser gir 10 ganger innsatsen.' }));
    E.handling.appendChild(innsats);
    E.handling.appendChild(MM.el('div', { class: 'knapprad' }, [
      MM.el('button', {
        class: 'knapp knapp-rod knapp-stor', text: 'Satse!',
        onclick: function () {
          var sum = Math.min(Number(innsats.value) || 0, p.cash);
          MM.Nett.send({ type: 'CASINO', pid: minId, innsats: sum, terning: [MM.terning()] });
        }
      }),
      MM.el('button', {
        class: 'knapp knapp-stor', text: 'Nei takk',
        onclick: function () { MM.Nett.send({ type: 'CASINO', pid: minId, innsats: 0, terning: [MM.terning()] }); }
      })
    ]));
  }

  /* ---------- Børsfeltet: kjøp fra motspiller ---------- */
  function tegnBorsfelt(s, p, v) {
    E.handling.appendChild(MM.el('div', { class: 'midt liten dim',
      text: 'Børsen: du kan kjøpe ' + v.antall + ' aksje(r) fra en motspiller til dobbel kurs' }));

    var valgMot = MM.el('select', { class: 'felt' });
    var valgSerie = MM.el('select', { class: 'felt' });

    function fyllSerier() {
      valgSerie.innerHTML = '';
      var mot = MM.Engine.sp(s, valgMot.value);
      if (!mot) return;
      MM.SERIES.forEach(function (se) {
        var n = mot.aksjer[se.id] || 0;
        var kurs = MM.Engine.kursPris(s, se.id);
        if (n < 1 || kurs <= 0) return;
        valgSerie.appendChild(MM.el('option', {
          value: se.id,
          text: se.navn + ' — ' + n + ' stk · ' + MM.fmt(kurs * 2) + ' per aksje'
        }));
      });
      if (!valgSerie.children.length) {
        valgSerie.appendChild(MM.el('option', { value: '', text: 'Ingen aksjer å kjøpe her' }));
      }
    }

    s.spillere.forEach(function (q) {
      if (q.id === minId || q.konkurs) return;
      var sum = 0;
      MM.SERIES.forEach(function (se) { sum += q.aksjer[se.id] || 0; });
      if (!sum) return;
      valgMot.appendChild(MM.el('option', { value: q.id, text: q.navn + ' (' + sum + ' aksjer)' }));
    });
    valgMot.addEventListener('change', fyllSerier);
    fyllSerier();

    E.handling.appendChild(valgMot);
    E.handling.appendChild(valgSerie);
    E.handling.appendChild(MM.el('div', { class: 'knapprad' }, [
      MM.el('button', {
        class: 'knapp knapp-gull', text: 'Kjøp 1 aksje',
        onclick: function () {
          if (!valgSerie.value) return;
          MM.Nett.send({ type: 'BORS_KJOP', pid: minId, fra: valgMot.value, serie: valgSerie.value, antall: 1 })
            .then(function () { MM.Lyd.kasse(); });
        }
      }),
      MM.el('button', {
        class: 'knapp', text: 'Hopp over',
        onclick: function () { MM.Nett.send({ type: 'BORS_HOPP_OVER', pid: minId }); }
      })
    ]));
  }

  /* ------------------------------------------------------------
     Sjansekort
     ------------------------------------------------------------ */
  function visKort(s, tvungen) {
    var v = s.tur.ventende;
    if (!v || v.type !== 'kort') return;
    if (kortVist === v.kort && !tvungen) return;
    kortVist = v.kort;
    var kort = MM.KORT[v.kort];

    var kortEl = MM.el('div', { class: 'sjansekort' }, [
      MM.el('div', { class: 'innside' }, [
        MM.el('div', { class: 'forside' }, [
          MM.el('div', { class: 'q', text: '?' }),
          MM.el('div', { class: 'logo-under', text: 'Prøv lykken' })
        ]),
        MM.el('div', { class: 'bakside' }, [
          MM.el('div', { class: 'tittel', text: 'Prøv lykken' }),
          MM.el('div', { class: 'tekst', html: kort.t })
        ])
      ])
    ]);

    var lag = MM.modal([
      kortEl,
      MM.el('button', {
        class: 'knapp knapp-gull knapp-stor knapp-blokk', text: 'Greit',
        onclick: function () {
          lag.lukk();
          kortVist = null;
          MM.Nett.send({ type: 'KORT_OK', pid: minId });
        }
      })
    ], { fast: true });

    MM.Lyd.varsel();
    setTimeout(function () { kortEl.classList.add('snudd'); MM.Lyd.klikk(); }, 420);
  }

  /* ------------------------------------------------------------
     Auksjon
     ------------------------------------------------------------ */
  function visAuksjon(s) {
    var au = s.auksjon;
    var f = MM.BOARD[au.pos];
    var p = MM.Engine.sp(s, minId);
    var harPassert = au.passert.indexOf(minId) >= 0;

    if (!auksjonVist) {
      var budEl = MM.el('div', { class: 'auksjon-bud' });
      var hvemEl = MM.el('div', { class: 'liten dim' });
      var klokkeEl = MM.el('div', { class: 'auksjon-klokke' });
      var stolpe = MM.el('div', { class: 'auksjon-stolpe' }, [MM.el('i')]);
      var knapper = MM.el('div', { class: 'stabel' });

      var lag = MM.modal([
        MM.el('div', { class: 'auksjon-topp' }, [
          MM.el('div', { style: 'font-size:2.4rem', text: '🔨' }),
          MM.el('h2', { text: 'Auksjon' }),
          MM.el('div', { style: 'font-weight:700;font-size:1.15rem', text: f.navn }),
          MM.el('div', { class: 'liten svak', text: 'Takst ' + MM.fmt(f.pris) })
        ]),
        MM.el('div', { class: 'midt' }, [budEl, hvemEl]),
        stolpe,
        MM.el('div', { class: 'midt', style: 'margin-bottom:.8rem' }, [klokkeEl]),
        knapper
      ], { fast: true });

      auksjonVist = { lag: lag, budEl: budEl, hvemEl: hvemEl, klokkeEl: klokkeEl, stolpe: stolpe, knapper: knapper, pos: au.pos };
      MM.Lyd.hammer();

      auksjonVist.tikk = setInterval(function () {
        if (!auksjonVist || !T || !T.auksjon) return;
        var igjen = T.auksjon.utgaar - Date.now();
        auksjonVist.klokkeEl.textContent = Math.max(0, Math.ceil(igjen / 1000)) + ' s';
        auksjonVist.klokkeEl.classList.toggle('hast', igjen < 5000);
        auksjonVist.stolpe.querySelector('i').style.width =
          Math.max(0, Math.min(100, igjen / (MM.AUKSJON_SEKUNDER * 1000) * 100)) + '%';
        /* Den som har turen avslutter auksjonen når tiden er ute */
        if (igjen <= 0 && MM.Engine.aktivId(T) === minId) {
          MM.Nett.send({ type: 'AUKSJON_SLUTT', pid: minId }, { stille: true }).catch(function () {});
        }
      }, 250);
    }

    var a = auksjonVist;
    a.budEl.textContent = au.hoyeste ? MM.fmt(au.hoyeste) : 'Ingen bud';
    var h = au.hoyesteId ? MM.Engine.sp(s, au.hoyesteId) : null;
    a.hvemEl.textContent = h ? 'Høyeste bud: ' + h.navn : 'Minste bud ' + MM.fmt(au.steg);

    a.knapper.innerHTML = '';
    if (p.konkurs) {
      a.knapper.appendChild(MM.el('div', { class: 'ventemelding', text: 'Du er ute av spillet' }));
    } else if (harPassert) {
      a.knapper.appendChild(MM.el('div', { class: 'ventemelding', text: 'Du har passert' }));
    } else {
      var neste = (au.hoyeste || 0) + au.steg;
      if (!au.hoyeste) neste = au.steg;
      [1, 2, 5].forEach(function (mult) {
        var bud = au.hoyeste ? au.hoyeste + au.steg * mult : au.steg * mult;
        if (bud > p.cash) return;
        a.knapper.appendChild(MM.el('button', {
          class: 'knapp ' + (mult === 1 ? 'knapp-gull' : ''), html: 'By ' + MM.fmt(bud),
          onclick: function () {
            MM.Nett.send({ type: 'BUD', pid: minId, sum: bud }).then(function () { MM.Lyd.opp(); });
          }
        }));
      });
      if (neste > p.cash) {
        a.knapper.appendChild(MM.el('div', { class: 'liten midt', style: 'color:var(--rod)',
          text: 'Du har ikke nok til å by videre' }));
      }
      a.knapper.appendChild(MM.el('button', {
        class: 'knapp knapp-tom', text: 'Pass',
        onclick: function () { MM.Nett.send({ type: 'PASS', pid: minId }); }
      }));
    }
  }

  function lukkAuksjon() {
    if (!auksjonVist) return;
    clearInterval(auksjonVist.tikk);
    auksjonVist.lag.lukk();
    auksjonVist = null;
  }

  /* ------------------------------------------------------------
     Animasjoner fra hendelser — alle ser det samme
     ------------------------------------------------------------ */
  function animer(s, hendelser) {
    hendelser.forEach(function (h) {
      switch (h.type) {
        case 'ola-flytt':
        case 'flytt':
          if (h.data && h.data.terning && h.data.terning.length === 2) {
            MM.kastTerninger(brettApi.terningplass, h.data.terning, { storrelse: 44 });
          }
          if (h.data && typeof h.data.til === 'number') MM.Brett.blink(brettApi, h.data.til);
          break;
        case 'ferie-reis':
          if (h.data && h.data.terning) MM.kastTerninger(brettApi.terningplass, h.data.terning, { storrelse: 44 });
          break;
        case 'leie':
        case 'ola-leie':
          MM.Lyd.kasse();
          break;
        case 'kurs-opp': MM.Lyd.opp(); break;
        case 'kurs-ned': MM.Lyd.ned(); break;
        case 'bygg': MM.Lyd.opp(); break;
        case 'casino-vinn':
          MM.Lyd.jubel();
          MM.konfetti({ antall: 90, varighet: 2600 });
          break;
        case 'casino-tap': MM.Lyd.minus(); break;
        case 'konkurs':
          MM.Lyd.minus();
          MM.skjelv(document.body, 10);
          break;
        case 'auksjon-start': MM.Lyd.hammer(); break;
        case 'bud': MM.Lyd.klikk(); break;
        case 'slutt': MM.Lyd.fanfare(); break;
      }

      /* Varsle om det som angår meg direkte */
      if (h.data && h.data.pid === minId) {
        if (h.type === 'leie') MM.toast('Du betalte <b>' + MM.fmt(h.data.sum) + '</b> i leie', 'feil');
        if (h.type === 'utbytte') MM.toast('Utbytte: <b>' + MM.fmt(h.data.sum) + '</b>', 'gull');
        if (h.type === 'rente') MM.toast('Rente: <b>' + MM.fmt(h.data.sum) + '</b>', 'feil');
      }
      if (h.type === 'leie' && h.data && h.data.eier === minId) {
        MM.toast('Du fikk <b>' + MM.fmt(h.data.sum) + '</b> i leie', 'ok');
      }
      if (h.type === 'ola-leie' && h.data && h.data.pid === minId) {
        MM.toast('Ola Nordmann betalte deg <b>' + MM.fmt(h.data.sum) + '</b>', 'ok');
      }
      if (h.type === 'tur' && h.data && h.data.pid === minId) {
        MM.toast('<b>Din tur!</b>', 'gull');
        MM.Lyd.varsel();
      }
    });
  }

  /* ------------------------------------------------------------
     Feltinfo når man trykker på brettet
     ------------------------------------------------------------ */
  function visFeltinfo(pos, f) {
    var s = T;
    if (!s) return;
    MM.Lyd.klikk();
    var d = s.tomter[String(pos)];
    var barn = [MM.el('h3', { text: f.navn })];

    if (f.type === 'tomt') {
      var se = MM.serie(f.serie);
      var eier = d && d.eier ? MM.Engine.sp(s, d.eier) : null;
      barn.push(MM.el('div', { class: 'rad', style: 'margin-bottom:.7rem' }, [
        MM.el('span', { class: 'port-prikk', style: 'background:' + se.farge + ';color:' + se.farge }),
        MM.el('span', { class: 'liten', text: se.navn + ' · kurs ' + MM.fmt(MM.Engine.kursPris(s, f.serie)) })
      ]));
      barn.push(MM.el('div', { class: 'liten dim', html:
        'Takst: <b class="tall">' + MM.fmt(f.pris) + '</b><br>' +
        'Eier: <b>' + (eier ? MM.esc(eier.navn) : 'ingen — ledig') + '</b><br>' +
        'Leie nå: <b class="tall">' + MM.fmt(MM.Engine.grunnLeie(s, pos)) + '</b><br>' +
        'Hus: <b class="tall">' + MM.fmt(f.husPris) + '</b> · Pant: <b class="tall">' + MM.fmt(f.pant) + '</b>'
      }));
      var tab = MM.el('div', { class: 'liten', style: 'margin-top:.7rem' });
      ['Grunnleie', '1 hus', '2 hus', '3 hus', '4 hus', 'Hotell', 'Slott'].forEach(function (navn, i) {
        if (i === 6 && !f.slott) return;
        tab.appendChild(MM.el('div', { class: 'rad rad-mellom', style: 'border-bottom:1px solid var(--kant);padding:.18rem 0' }, [
          MM.el('span', { class: 'svak', text: navn }),
          MM.el('span', { class: 'tall', text: MM.fmt(f.leie[i]) })
        ]));
      });
      barn.push(tab);
    } else {
      barn.push(MM.el('div', { class: 'dim', text: f.info || '' }));
    }

    barn.push(MM.el('div', { style: 'height:1rem' }));
    barn.push(MM.el('button', {
      class: 'knapp knapp-blokk', text: 'Lukk',
      onclick: function (e) { e.target.closest('.modallag').lukk(); }
    }));
    MM.modal(barn);
  }

  document.addEventListener('DOMContentLoaded', function () { MM.boot(start); });

})(window.MM = window.MM || {});
