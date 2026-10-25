/* ============================================================
   Multimillionær — hovedside og venterom
   ============================================================ */
(function (MM) {
  'use strict';

  var rot, steg = 'velg', valgtFigur = null, avmeld = null;

  function start() {
    rot = MM.$('#app');
    MM.adopterIdFraUrl();
    var kode = MM.kodeFraUrl();
    var s = MM.Sesjon.les();
    if (kode) {
      MM.Sesjon.skriv({ kode: kode });
      visBliMed(kode);
    } else if (s.kode) {
      /* Prøv å gjenoppta et spill vi alt er med i */
      MM.Nett.koble(s.kode).then(function (t) {
        if (t && MM.Engine.sp(t, s.pid)) {
          if (t.fase === 'spiller' || t.fase === 'ferdig') { location.href = 'player.html?kode=' + s.kode; return; }
          visLobby();
        } else { MM.Sesjon.skriv({ kode: null }); visVelg(); }
      }).catch(function () { MM.Sesjon.skriv({ kode: null }); visVelg(); });
    } else {
      visVelg();
    }
  }

  function tegn(barn) {
    rot.innerHTML = '';
    var boks = MM.el('div', { class: 'midtboks steg' }, barn);
    rot.appendChild(boks);
  }

  function topp(undertittel) {
    return MM.el('div', { class: 'midt', style: 'margin-bottom:1.6rem' }, [
      MM.el('h1', { class: 'logo logo-stor', text: 'Multimillionær' }),
      MM.el('div', { class: 'logo-under', text: undertittel || 'Tomter · Børs · Gjeldsbrev' })
    ]);
  }

  /* ------------------------------------------------------------
     Velg: nytt spill eller bli med
     ------------------------------------------------------------ */
  function visVelg() {
    steg = 'velg';
    var f = MM.Sesjon.forrige();
    tegn([
      topp(),
      MM.el('div', { class: 'kort stabel' }, [
        f ? MM.el('button', {
          class: 'knapp knapp-bla knapp-blokk',
          html: '↺ &nbsp;Fortsett som <b>' + MM.esc(f.navn || 'sist') + '</b> i ' + MM.esc(f.kode),
          onclick: function () {
            MM.Sesjon.gjenoppta(f);
            MM.Nett.koble(f.kode).then(function (t) {
              if (!t) throw new Error('Spillet ' + f.kode + ' finnes ikke lenger');
              if (t.fase !== 'lobby') { location.href = 'player.html?kode=' + f.kode; return; }
              visLobby();
            }).catch(function (e) {
              MM.toast(MM.esc(e.message), 'feil');
              MM.glem('sisteSesjon');
              MM.Sesjon.tom();
              visVelg();
            });
          }
        }) : null,
        f ? MM.el('hr', { class: 'skille' }) : null,
        MM.el('button', {
          class: 'knapp knapp-gull knapp-stor knapp-blokk',
          html: '🎲 &nbsp;Nytt spill',
          onclick: visNytt
        }),
        MM.el('button', {
          class: 'knapp knapp-stor knapp-blokk',
          html: '🚪 &nbsp;Bli med i et spill',
          onclick: function () { visBliMed(null); }
        }),
        MM.el('hr', { class: 'skille' }),
        MM.el('div', { class: 'rad', style: 'justify-content:center;gap:.5rem' }, [
          MM.el('button', { class: 'knapp knapp-tom knapp-liten', text: 'Regler', onclick: visRegler }),
          MM.el('button', { class: 'knapp knapp-tom knapp-liten', text: 'Resultatliste', onclick: visHoyscore }),
          MM.lydknapp(),
          MM.musikknapp()
        ])
      ]),
      MM.Nett.erSky() ? null : MM.el('div', {
        class: 'liten midt dim', style: 'margin-top:1rem',
        html: 'Lokal modus: spillet lagres i nettleseren. ' +
              'Åpne flere faner for å teste flerspiller. ' +
              'Sett <code>API_URL</code> i <code>js/config.js</code> for å spille over nett.'
      })
    ]);
  }

  /* ------------------------------------------------------------
     Nytt spill — regler
     ------------------------------------------------------------ */
  function visNytt() {
    MM.Lyd.klikk();
    var st = MM.CONFIG.STANDARD;
    var mal = MM.el('input', { class: 'felt tall', type: 'number', value: st.mal, step: 100000, min: 200000 });
    var kap = MM.el('input', { class: 'felt tall', type: 'number', value: st.startKapital, step: 10000, min: 50000 });
    var tid = MM.el('select', { class: 'felt' });
    [[0, 'Ingen tidsgrense'], [60, '1 time'], [90, '1,5 time'], [120, '2 timer'], [150, '2,5 timer']]
      .forEach(function (o) {
        tid.appendChild(MM.el('option', { value: o[0], text: o[1], selected: o[0] === st.tidsgrenseMin ? 'selected' : null }));
      });

    var lagKnapp = MM.el('button', { class: 'knapp knapp-gull knapp-stor knapp-blokk', text: 'Opprett spillet' });
    lagKnapp.addEventListener('click', function () {
      lagKnapp.disabled = true;
      lagKnapp.textContent = 'Oppretter …';
      MM.Nett.opprett({
        mal: Number(mal.value), startKapital: Number(kap.value), tidsgrenseMin: Number(tid.value)
      }).then(function (kode) {
        MM.Sesjon.skriv({ kode: kode });
        MM.Lyd.kasse();
        return MM.Nett.koble(kode);
      }).then(function () {
        visBliMed(MM.Nett.kode, true);
      }).catch(function (e) {
        MM.toast(MM.esc(e.message), 'feil', 6000);
        lagKnapp.disabled = false;
        lagKnapp.textContent = 'Opprett spillet';
      });
    });

    tegn([
      topp('Nytt bord'),
      MM.el('div', { class: 'kort' }, [
        MM.el('h2', { text: 'Regler for dette spillet' }),
        MM.el('div', { class: 'feltgruppe' }, [
          MM.el('label', { class: 'merke', text: 'Målformue — den som når dette vinner' }), mal
        ]),
        MM.el('div', { class: 'feltgruppe' }, [
          MM.el('label', { class: 'merke', text: 'Startkapital per spiller' }), kap
        ]),
        MM.el('div', { class: 'feltgruppe' }, [
          MM.el('label', { class: 'merke', text: 'Tidsgrense' }), tid
        ]),
        MM.el('div', { class: 'panel liten dim', style: 'margin-bottom:1rem' }, [
          MM.el('div', { html: '<b>Du blir spillvert.</b> Verten starter spillet og kan rydde opp om noe låser seg. ' +
                               'Banken er automatisk — ingen trenger å holde styr på penger.' })
        ]),
        lagKnapp,
        MM.el('div', { style: 'height:.6rem' }),
        MM.el('button', { class: 'knapp knapp-tom knapp-blokk', text: 'Tilbake', onclick: visVelg })
      ])
    ]);
  }

  /* ------------------------------------------------------------
     Bli med — kode, navn, figur
     ------------------------------------------------------------ */
  function visBliMed(kode, erVert) {
    var s = MM.Sesjon.les();
    var kodeFelt = MM.el('input', {
      class: 'felt felt-kode', maxlength: 4, placeholder: '••••',
      value: kode || '', autocapitalize: 'characters', spellcheck: 'false',
      inputmode: 'text', autocomplete: 'off'
    });
    kodeFelt.addEventListener('input', function () {
      kodeFelt.value = kodeFelt.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    });

    var navnFelt = MM.el('input', {
      class: 'felt', maxlength: 18, placeholder: 'Navnet ditt',
      value: s.navn || '', autocomplete: 'nickname'
    });

    var figurNett = MM.el('div', { class: 'figurnett' });
    var tatte = [];

    function tegnFigurer() {
      figurNett.innerHTML = '';
      MM.FIGURER.forEach(function (f) {
        var taken = tatte.indexOf(f.id) >= 0;
        var e = MM.el('div', {
          class: 'figur' + (valgtFigur === f.id ? ' valgt' : '') + (taken ? ' tatt' : ''),
          style: '--figurfarge:' + f.farge,
          title: f.navn
        }, [
          MM.el('span', { class: 'em', text: f.emoji }),
          MM.el('span', { class: 'nv', text: f.navn })
        ]);
        if (!taken) {
          e.addEventListener('click', function () {
            valgtFigur = f.id;
            MM.Lyd.klikk();
            tegnFigurer();
          });
        }
        figurNett.appendChild(e);
      });
    }

    /* Hent hvilke figurer som er tatt, hvis vi kjenner koden */
    function oppdaterTatte(k) {
      if (!k || k.length !== 4) return;
      MM.Nett.finnes(k).then(function (ja) {
        if (!ja) return;
        return MM.Nett.koble(k).then(function (t) {
          if (!t) return;
          tatte = t.spillere.filter(function (p) { return p.id !== MM.Sesjon.minId(); })
                            .map(function (p) { return p.figur; });
          if (!valgtFigur || tatte.indexOf(valgtFigur) >= 0) {
            var fri = MM.FIGURER.filter(function (f) { return tatte.indexOf(f.id) < 0; });
            valgtFigur = fri.length ? fri[0].id : null;
          }
          tegnFigurer();
        });
      }).catch(function () { /* vises når brukeren trykker */ });
    }

    if (!valgtFigur) valgtFigur = s.figur || MM.FIGURER[0].id;
    tegnFigurer();
    kodeFelt.addEventListener('blur', function () { oppdaterTatte(kodeFelt.value); });
    if (kode) oppdaterTatte(kode);

    /* Aktive bord — slipp å taste kode i det hele tatt */
    var bordliste = MM.el('div');
    if (!erVert) {
      bordliste.appendChild(MM.el('div', { class: 'ventemelding' }, [
        MM.el('span', { text: 'Ser etter aktive spill' }), MM.el('span', { class: 'prikker' })
      ]));
      MM.Nett.hentSpill().then(function (spill) {
        bordliste.innerHTML = '';
        if (!spill.length) {
          bordliste.appendChild(MM.el('div', { class: 'liten svak midt', style: 'padding:.5rem',
            text: 'Ingen aktive spill akkurat nå. Tast en kode, eller lag et nytt spill.' }));
          return;
        }
        var tittel = MM.el('div', { class: 'panel-tittel' }, [
          MM.el('span', { text: 'Aktive spill' })
        ]);
        /* Lista rydder seg selv, men den som vil ha det ryddig nå
           skal slippe å vente på at terskelen går ut. */
        var ryddKnapp = MM.el('button', {
          class: 'lapp', style: 'cursor:pointer;border-style:dashed',
          title: 'Fjern forlatte og ferdigspilte bord',
          text: 'Rydd'
        });
        ryddKnapp.addEventListener('click', function () {
          MM.Lyd.klikk();
          ryddKnapp.textContent = 'Rydder …';
          MM.Nett.ryddOpp().then(function (r) {
            MM.toast(r && r.slettet
              ? 'Ryddet bort <b>' + r.slettet + '</b> bord'
              : 'Ingenting å rydde', 'ok', 2200);
            visBliMed(kode, erVert);
          }).catch(function () {
            ryddKnapp.textContent = 'Rydd';
            MM.toast('Fikk ikke ryddet', 'feil');
          });
        });
        tittel.appendChild(ryddKnapp);
        bordliste.appendChild(tittel);
        spill.forEach(function (g) {
          /* En eldre serverversjon sender verken spillerliste eller
             ledige plasser. Da viser vi bordet som åpent og lar
             BLI_MED avgjøre — bedre enn å påstå at alt er stengt. */
          var vetAntall = typeof g.ledigePlasser === 'number';
          var apent = g.fase === 'lobby' && (!vetAntall || g.ledigePlasser > 0);
          var rad = MM.el('div', {
            class: 'bordrad' + (apent ? '' : ' stengt'),
            title: apent ? 'Trykk for å velge dette bordet'
                         : (g.fase === 'lobby' ? 'Bordet er fullt' : 'Spillet er alt i gang')
          }, [
            MM.el('span', { class: 'bordkode tall', text: g.kode }),
            MM.el('div', { class: 'vokse', style: 'min-width:0' }, [
              MM.el('div', { class: 'bordnavn' },
                (g.spillere || []).length
                  ? g.spillere.map(function (p) {
                      return MM.el('span', {
                        class: 'bordfigur', title: p.navn,
                        text: MM.figur(p.figur).emoji
                      });
                    }).concat([MM.el('span', { class: 'liten dim', text: ' ' + g.spillere.map(function (p) { return p.navn; }).join(', ') })])
                  : [MM.el('span', { class: 'liten dim', text: 'tomt bord' })]
              ),
              MM.el('div', { class: 'liten svak', text:
                (g.fase === 'lobby' ? 'Venter på start' : 'I gang') +
                (g.vert ? ' · vert: ' + g.vert : '') +
                (g.fase === 'lobby' && vetAntall ? ' · ' + g.ledigePlasser + ' ledige' : '') +
                (g.oppdatert ? ' · ' + alder(g.oppdatert) : '')
              })
            ]),
            MM.el('span', { class: 'lapp ' + (apent ? 'lapp-gronn' : ''), text: apent ? 'Bli med' : 'Stengt' })
          ]);
          if (apent) {
            rad.addEventListener('click', function () {
              MM.Lyd.klikk();
              kodeFelt.value = g.kode;
              MM.$$('.bordrad', bordliste).forEach(function (e) { e.classList.remove('valgtbord'); });
              rad.classList.add('valgtbord');
              oppdaterTatte(g.kode);
              navnFelt.focus();
            });
          }
          bordliste.appendChild(rad);
        });
      });
    }

    var knapp = MM.el('button', {
      class: 'knapp knapp-gull knapp-stor knapp-blokk',
      html: erVert ? '✓ &nbsp;Bli med som vert' : '→ &nbsp;Bli med'
    });

    knapp.addEventListener('click', function () {
      var k = kodeFelt.value.trim().toUpperCase();
      var navn = navnFelt.value.trim();
      if (k.length !== 4) { MM.toast('Spillkoden er fire tegn', 'feil'); MM.skjelv(kodeFelt, 7); return; }
      if (!navn) { MM.toast('Skriv inn navnet ditt', 'feil'); MM.skjelv(navnFelt, 7); return; }
      if (!valgtFigur) { MM.toast('Velg en figur', 'feil'); return; }

      knapp.disabled = true;
      knapp.textContent = 'Kobler til …';
      MM.Sesjon.skriv({ kode: k, navn: navn, figur: valgtFigur });

      MM.Nett.koble(k).then(function (t) {
        if (!t) throw new Error('Fant ikke spillet ' + k);
        if (MM.Engine.sp(t, MM.Sesjon.minId())) {
          if (t.fase !== 'lobby') { location.href = 'player.html?kode=' + k; return null; }
          return MM.Nett.send({ type: 'VELG_FIGUR', pid: MM.Sesjon.minId(), figur: valgtFigur }, { stille: true })
            .catch(function () { return null; });
        }
        if (t.fase !== 'lobby') throw new Error('Spillet er alt i gang');
        return MM.Nett.send({ type: 'BLI_MED', pid: MM.Sesjon.minId(), navn: navn, figur: valgtFigur });
      }).then(function (r) {
        if (r === null && location.href.indexOf('player.html') >= 0) return;
        MM.Lyd.kasse();
        visLobby();
      }).catch(function (e) {
        MM.toast(MM.esc(e.message), 'feil', 5000);
        knapp.disabled = false;
        knapp.innerHTML = '→ &nbsp;Bli med';
      });
    });

    tegn([
      topp(erVert ? 'Spillkode ' + kode : 'Bli med'),
      MM.el('div', { class: 'kort' }, [
        erVert
          ? MM.el('div', { class: 'midt', style: 'margin-bottom:1.2rem' }, [
              MM.el('label', { class: 'merke', text: 'Del denne koden med de andre' }),
              MM.el('div', { class: 'kodevis', text: kode, title: 'Klikk for å kopiere', onclick: function () { kopier(kode); } })
            ])
          : MM.el('div', {}, [
              bordliste,
              MM.el('hr', { class: 'skille' }),
              MM.el('div', { class: 'feltgruppe' }, [
                MM.el('label', { class: 'merke', text: 'Eller tast spillkoden' }), kodeFelt
              ])
            ]),
        MM.el('div', { class: 'feltgruppe' }, [
          MM.el('label', { class: 'merke', text: 'Navn' }), navnFelt
        ]),
        MM.el('div', { class: 'feltgruppe' }, [
          MM.el('label', { class: 'merke', text: 'Velg figur' }), figurNett
        ]),
        knapp,
        MM.el('div', { style: 'height:.6rem' }),
        MM.el('button', { class: 'knapp knapp-tom knapp-blokk', text: 'Tilbake', onclick: visVelg })
      ])
    ]);
    if (erVert) setTimeout(function () { navnFelt.focus(); }, 150);
  }

  /* «for 5 min siden» — så det syns hvilke bord som er glemt */
  function alder(tid) {
    var sek = Math.max(0, Math.round((Date.now() - tid) / 1000));
    if (sek < 60) return 'nettopp';
    var min = Math.round(sek / 60);
    if (min < 60) return 'for ' + min + ' min siden';
    var t = Math.round(min / 60);
    return 'for ' + t + ' time' + (t > 1 ? 'r' : '') + ' siden';
  }

  function kopier(t) {
    try {
      navigator.clipboard.writeText(t);
      MM.toast('Kopiert: <b>' + MM.esc(t) + '</b>', 'ok', 2000);
    } catch (e) { MM.toast('Kode: <b>' + MM.esc(t) + '</b>', 'info'); }
  }

  /* ------------------------------------------------------------
     Venterom
     ------------------------------------------------------------ */
  function visLobby() {
    steg = 'lobby';
    if (avmeld) avmeld();
    var minId = MM.Sesjon.minId();

    var kodeEl = MM.el('div', { class: 'kodevis', text: MM.Nett.kode, onclick: function () { kopier(MM.Nett.kode); } });
    var liste = MM.el('div', { class: 'spillerliste' });
    var vertPanel = MM.el('div');
    var startKnapp = MM.el('button', { class: 'knapp knapp-gull knapp-stor knapp-blokk', text: 'Start spillet' });
    var figurBytt = MM.el('div', { class: 'figurnett' });

    startKnapp.addEventListener('click', function () {
      startKnapp.disabled = true;
      MM.Nett.send({ type: 'START', pid: minId })
        .then(function () { MM.Lyd.fanfare(); })
        .catch(function () { startKnapp.disabled = false; });
    });

    function tegnFigurBytte(t) {
      figurBytt.innerHTML = '';
      var tatte = t.spillere.filter(function (p) { return p.id !== minId; }).map(function (p) { return p.figur; });
      var meg = MM.Engine.sp(t, minId);
      MM.FIGURER.forEach(function (f) {
        var taken = tatte.indexOf(f.id) >= 0;
        var e = MM.el('div', {
          class: 'figur' + (meg && meg.figur === f.id ? ' valgt' : '') + (taken ? ' tatt' : ''),
          style: '--figurfarge:' + f.farge, title: f.navn
        }, [
          MM.el('span', { class: 'em', text: f.emoji }),
          MM.el('span', { class: 'nv', text: f.navn })
        ]);
        if (!taken && meg && meg.figur !== f.id) {
          e.addEventListener('click', function () {
            MM.Lyd.klikk();
            MM.Sesjon.skriv({ figur: f.id });
            MM.Nett.send({ type: 'VELG_FIGUR', pid: minId, figur: f.id });
          });
        }
        figurBytt.appendChild(e);
      });
    }

    function oppdater(t) {
      if (!t) return;
      if (t.fase === 'spiller' || t.fase === 'ferdig') {
        location.href = 'player.html?kode=' + MM.Nett.kode;
        return;
      }
      liste.innerHTML = '';
      t.spillere.forEach(function (p) {
        var f = MM.figur(p.figur);
        liste.appendChild(MM.el('div', {
          class: 'spillerrad' + (p.id === minId ? ' dennemeg' : ''),
          style: '--pfarge:' + f.farge
        }, [
          MM.el('span', { class: 'em', text: f.emoji }),
          MM.el('span', { class: 'nv', text: p.navn }),
          p.erBot ? MM.el('span', { class: 'lapp', text: '🤖 ' + (p.botNiva || 'normal') }) : null,
          p.id === t.vertId ? MM.el('span', { class: 'lapp lapp-gull', text: 'Vert' }) : null,
          p.id === minId ? MM.el('span', { class: 'lapp lapp-bla', text: 'Deg' }) : null
        ]));
      });
      for (var i = t.spillere.length; i < MM.MAKS_SPILLERE; i++) {
        liste.appendChild(MM.el('div', {
          class: 'spillerrad', style: 'opacity:.3;border-style:dashed'
        }, [
          MM.el('span', { class: 'em', text: '…' }),
          MM.el('span', { class: 'nv dim', text: 'Venter på spiller' })
        ]));
      }

      tegnFigurBytte(t);

      var erVert = t.vertId === minId;
      vertPanel.innerHTML = '';
      if (erVert) {
        startKnapp.disabled = t.spillere.length < 2;
        vertPanel.appendChild(MM.el('div', { class: 'panel', style: 'margin-bottom:.8rem' }, [
          MM.el('div', { class: 'panel-tittel', text: 'Vertens bord' }),
          MM.el('div', { class: 'liten dim', html:
            'Mål: <b class="tall">' + MM.fmt(t.regler.mal) + '</b><br>' +
            'Startkapital: <b class="tall">' + MM.fmt(t.regler.startKapital) + '</b><br>' +
            'Tidsgrense: <b>' + (t.regler.tidsgrenseMin ? t.regler.tidsgrenseMin + ' min' : 'ingen') + '</b>'
          })
        ]));
        /* ---- Boter ---- */
        var boter = t.spillere.filter(function (p) { return p.erBot; });
        var naVaerende = boter.length ? boter[0].botNiva : MM.hent('botNiva', 'normal');

        var nivaValg = MM.el('select', { class: 'felt', style: 'margin-bottom:.5rem' });
        MM.Bot.NIVAER.forEach(function (n) {
          nivaValg.appendChild(MM.el('option', {
            value: n.id, text: n.navn + ' — ' + n.beskrivelse,
            selected: n.id === naVaerende ? 'selected' : null
          }));
        });
        nivaValg.addEventListener('change', function () {
          MM.lagre('botNiva', nivaValg.value);
          if (boter.length) {
            MM.Nett.send({ type: 'SETT_BOT_NIVA', pid: minId, botNiva: nivaValg.value });
          }
        });

        var botPanel = MM.el('div', { class: 'panel', style: 'margin-bottom:.8rem' }, [
          MM.el('div', { class: 'panel-tittel', text: '🤖 Boter' }),
          MM.el('div', { class: 'liten dim', style: 'margin-bottom:.5rem', text:
            boter.length
              ? boter.length + ' bot' + (boter.length > 1 ? 'er' : '') + ' ved bordet. Spill alene, eller fyll opp et halvfullt bord.'
              : 'Vil du spille alene, eller mangler dere folk? Legg til boter.'
          }),
          nivaValg,
          MM.el('div', { class: 'knapprad' }, [
            MM.el('button', {
              class: 'knapp knapp-liten', html: '+ Legg til bot',
              disabled: t.spillere.length >= MM.MAKS_SPILLERE ? 'disabled' : null,
              onclick: function () {
                MM.Nett.send({ type: 'LEGG_TIL_BOT', pid: minId, botNiva: nivaValg.value })
                  .then(function () { MM.Lyd.klikk(); });
              }
            }),
            MM.el('button', {
              class: 'knapp knapp-liten knapp-tom', text: '− Fjern bot',
              disabled: boter.length ? null : 'disabled',
              onclick: function () { MM.Nett.send({ type: 'FJERN_BOT', pid: minId }); }
            })
          ])
        ]);
        vertPanel.appendChild(botPanel);

        vertPanel.appendChild(startKnapp);
        if (t.spillere.length < 2) {
          vertPanel.appendChild(MM.el('div', { class: 'liten dim midt', style: 'margin-top:.5rem',
            text: 'Minst to spillere for å starte — en bot teller' }));
        }
      } else {
        var vert = MM.Engine.sp(t, t.vertId);
        vertPanel.appendChild(MM.el('div', { class: 'ventemelding' }, [
          MM.el('span', { text: 'Venter på at ' + (vert ? vert.navn : 'verten') + ' starter spillet' }),
          MM.el('span', { class: 'prikker' })
        ]));
        vertPanel.appendChild(MM.el('button', {
          class: 'knapp knapp-tom knapp-liten knapp-blokk',
          text: 'Overta vertsrollen (hvis verten er borte)',
          onclick: function () { MM.Nett.send({ type: 'KREV_VERT', pid: minId }); }
        }));
      }
    }

    tegn([
      topp('Venterom'),
      MM.el('div', { class: 'kort' }, [
        MM.el('div', { class: 'midt', style: 'margin-bottom:1.1rem' }, [
          MM.el('label', { class: 'merke', text: 'Spillkode — klikk for å kopiere' }),
          kodeEl
        ]),
        MM.el('div', { class: 'panel-tittel', text: 'Spillere' }),
        liste,
        MM.el('hr', { class: 'skille' }),
        MM.el('div', { class: 'panel-tittel', text: 'Bytt figur' }),
        figurBytt,
        MM.el('hr', { class: 'skille' }),
        vertPanel,
        MM.el('div', { style: 'height:.7rem' }),
        MM.el('div', { class: 'knapprad' }, [
          MM.el('a', { class: 'knapp knapp-tom knapp-liten', href: 'board.html?kode=' + MM.Nett.kode + '&som=' + minId, target: '_blank',
                       html: '📺 Storskjerm' }),
          MM.el('button', { class: 'knapp knapp-tom knapp-liten', text: 'Regler', onclick: visRegler }),
          MM.el('button', {
            class: 'knapp knapp-tom knapp-liten', text: 'Forlat',
            onclick: function () { MM.Sesjon.skriv({ kode: null }); MM.Nett.stopp(); visVelg(); }
          }),
          /* Verten rydder opp etter seg selv. Uten dette blir hvert
             bord man ombestemmer seg om liggende i lista i to timer. */
          (MM.Nett.tilstand && MM.Nett.tilstand.vertId === minId)
            ? MM.el('button', {
                class: 'knapp knapp-tom knapp-liten',
                style: 'color:var(--rod);border-color:rgba(255,90,110,.4)',
                text: 'Slett bordet',
                onclick: function () {
                  if (!confirm('Slette dette bordet? Det forsvinner for alle som er med.')) return;
                  var k = MM.Nett.kode;
                  MM.Nett.slettSpill(k, minId).then(function () {
                    MM.Nett.stopp();
                    MM.Sesjon.skriv({ kode: null });
                    MM.glem('sisteSesjon');
                    MM.toast('Bordet <b>' + MM.esc(k) + '</b> er slettet', 'ok');
                    visVelg();
                  }).catch(function (e) {
                    MM.toast(MM.esc(e.message || 'Fikk ikke slettet'), 'feil');
                  });
                }
              })
            : null
        ])
      ]),
      MM.el('div', { class: 'liten midt dim', style: 'margin-top:1rem',
        html: 'Åpne <b>Storskjerm</b> på en TV eller PC så alle ser brettet. ' +
              'Hver spiller styrer fra sin egen telefon.' })
    ]);

    avmeld = MM.Nett.pa(oppdater);
    MM.Nett.start();
    setInterval(function () {
      if (steg === 'lobby' && MM.Nett.tilstand && MM.Nett.tilstand.fase === 'lobby') {
        MM.Nett.send({ type: 'PULS', pid: minId }, { stille: true }).catch(function () {});
      }
    }, 25000);
  }

  /* ------------------------------------------------------------
     Regler
     ------------------------------------------------------------ */
  function visRegler() {
    MM.Lyd.klikk();
    MM.modal([
      MM.el('h2', { text: 'Multimillionær på to minutter' }),
      MM.el('div', { class: 'stabel liten' }, [
        regelPunkt('🚶', 'To kast per tur', 'Du kaster først for <b>Ola Nordmann</b> — bankens brikke — og så for din egen figur. Lander Ola på en tomt noen eier, betaler banken leia til eieren. Det er derfor det ikke finnes lønn ved START.'),
        regelPunkt('📈', 'Børsen følger brettet', 'Hver tomteserie er et aksjeselskap med 10 aksjer. For hver hele 20&nbsp;000 kr som kreves inn i leie på serien stiger kursen ett steg. Må du selv betale 20&nbsp;000+ i leie, faller kursen på alle hele serier du eier.'),
        regelPunkt('🤝', 'Aksjemajoritet', 'Eier du <b>8 eller flere</b> aksjer i et selskap, får du 50&nbsp;% av all leie som kreves inn på serien — også når andre eier tomtene. Eier du <b>alle 10</b>, slipper du å betale leie der selv.'),
        regelPunkt('🏦', 'Gjeldsbrev', 'Inntil 3 lån på 50&nbsp;000 kr, når som helst — også utenfor din tur. Renta er 2&nbsp;500 kr per gjeldsbrev <b>hver tur</b>.'),
        regelPunkt('🏖️', 'Feriehotellet', 'Ikke fengsel. Du velger selv om du vil stå over. Første opphold gratis, så 10&nbsp;000, 20&nbsp;000 og oppover. Du kommer ut med én terning.'),
        regelPunkt('🏠', 'Bygging', 'Eier du hele serien: dobbel grunnleie, og du kan bygge. Bygg jevnt. 4 hus blir hotell. På Slottsplassen kan hotellet bli slott.'),
        regelPunkt('🎲', 'Casino og Trafikkfyr', 'Casino: satse på sekser med én terning, 10 ganger igjen. Trafikkfyr: leiefritak til neste tur.'),
        regelPunkt('🏆', 'Seier', 'Den som først når målformuen vinner. Ellers: siste som ikke er konkurs, eller rikest når tiden er ute.')
      ]),
      MM.el('div', { style: 'height:1rem' }),
      MM.el('button', { class: 'knapp knapp-blokk', text: 'Lukk', onclick: function (e) { e.target.closest('.modallag').lukk(); } })
    ]);
  }

  function regelPunkt(em, tittel, tekst) {
    return MM.el('div', { class: 'panel' }, [
      MM.el('div', { class: 'rad', style: 'align-items:flex-start' }, [
        MM.el('span', { style: 'font-size:1.5rem;line-height:1', text: em }),
        MM.el('div', { class: 'vokse' }, [
          MM.el('div', { style: 'font-weight:700;font-family:var(--font-vis)', text: tittel }),
          MM.el('div', { class: 'dim', html: tekst })
        ])
      ])
    ]);
  }

  /* ------------------------------------------------------------
     Resultatliste
     ------------------------------------------------------------ */
  function visHoyscore() {
    MM.Lyd.klikk();
    var innhold = MM.el('div', { class: 'ventemelding' }, [MM.el('span', { text: 'Henter' }), MM.el('span', { class: 'prikker' })]);
    var lag = MM.modal([
      MM.el('h2', { text: '🏆 Evig resultatliste' }),
      innhold,
      MM.el('div', { style: 'height:1rem' }),
      MM.el('button', { class: 'knapp knapp-blokk', text: 'Lukk', onclick: function (e) { e.target.closest('.modallag').lukk(); } })
    ]);
    MM.Nett.hentResultater().then(function (r) {
      var seiere = r.filter(function (x) { return x.plass === 1; })
                    .sort(function (a, b) { return b.formue - a.formue; }).slice(0, 15);
      innhold.innerHTML = '';
      if (!seiere.length) {
        innhold.appendChild(MM.el('div', { class: 'midt dim', text: 'Ingen ferdigspilte partier ennå. Bli den første.' }));
        return;
      }
      seiere.forEach(function (x, i) {
        innhold.appendChild(MM.el('div', { class: 'ser-rad', style: 'animation-delay:' + (i * 40) + 'ms' }, [
          MM.el('span', { class: 'pl', text: String(i + 1) }),
          MM.el('span', { class: 'em', text: MM.figur(x.figur).emoji }),
          MM.el('span', { text: x.navn }),
          MM.el('span', { class: 'sum gull', text: MM.fmt(x.formue) })
        ]));
      });
    });
    return lag;
  }

  document.addEventListener('DOMContentLoaded', function () { MM.boot(start); });

})(window.MM = window.MM || {});
