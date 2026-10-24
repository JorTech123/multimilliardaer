/* ============================================================
   Multimilliardær — bakgrunnsmusikk

   Alt lages i WebAudio mens du spiller. Ingen lydfiler, ingenting
   å laste ned, ingen rettighetsspørsmål.

   En rolig lounge-sløyfe i Dm7 - G7 - Cmaj7 - Am7: gående bass,
   myke akkordputer og en lett glitrende overstemme. Den skal ligge
   under samtalen ved bordet, ikke konkurrere med den.
   ============================================================ */
(function (MM) {
  'use strict';

  var M = MM.Musikk = {
    av: MM.hent('musikkAv', false),
    volum: MM.hent('musikkVolum', 0.5),
    spiller: false,
    _node: null,
    _timer: null,
    _takt: 0,
    _nesteTid: 0
  };

  var BPM = 84;
  var SLAG = 60 / BPM;          // sekunder per slag
  var TAKT = SLAG * 4;          // 4/4
  var FRAMSYN = 0.25;           // hvor langt fram vi planlegger (sekunder)
  var TIKK = 25;                // hvor ofte vi planlegger (millisekunder)

  /* MIDI-nummer til frekvens */
  function f(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* Akkordrekka. Én takt per akkord.
     bass = gående bassgang, pute = akkordtoner, topp = tonevalg for glitteret */
  var REKKE = [
    { navn: 'Dm7',   bass: [38, 45, 41, 43], pute: [62, 65, 69, 72], topp: [74, 77, 81] },
    { navn: 'G7',    bass: [43, 50, 47, 41], pute: [55, 59, 62, 65], topp: [71, 74, 77] },
    { navn: 'Cmaj7', bass: [36, 43, 40, 45], pute: [60, 64, 67, 71], topp: [72, 76, 79] },
    { navn: 'Am7',   bass: [45, 40, 43, 36], pute: [57, 60, 64, 67], topp: [69, 72, 76] }
  ];

  /* ------------------------------------------------------------
     Lydkjede: alt går gjennom ett filter og én volumkontroll,
     slik at musikken kan dempes uten å røre lydeffektene.
     ------------------------------------------------------------ */
  function kjede() {
    var c = MM.Lyd.start();
    if (!c) return null;
    if (M._node) return M._node;

    var ut = c.createGain();
    ut.gain.value = 0;

    var filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2100;
    filter.Q.value = 0.6;

    filter.connect(ut);
    ut.connect(c.destination);

    M._node = { inn: filter, ut: ut, ctx: c };
    return M._node;
  }

  /* En enkelt tone */
  function tone(tid, frekvens, lengde, type, styrke, anslag) {
    var k = M._node;
    if (!k) return;
    var c = k.ctx;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(frekvens, tid);
    var topp = anslag === undefined ? 0.012 : anslag;
    g.gain.setValueAtTime(0.0001, tid);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, styrke), tid + topp);
    g.gain.exponentialRampToValueAtTime(0.0001, tid + lengde);
    o.connect(g);
    g.connect(k.inn);
    o.start(tid);
    o.stop(tid + lengde + 0.03);
  }

  /* Planlegg én takt */
  function planleggTakt(nr, tid) {
    var akkord = REKKE[nr % REKKE.length];

    /* Bass — én tone per slag, mykt anslag */
    akkord.bass.forEach(function (n, i) {
      tone(tid + i * SLAG, f(n), SLAG * 0.92, 'triangle', 0.16, 0.02);
      /* svak oktav under gir tyngde uten å bli grumsete */
      tone(tid + i * SLAG, f(n - 12), SLAG * 0.8, 'sine', 0.07, 0.03);
    });

    /* Pute — akkorden svever gjennom hele takta */
    akkord.pute.forEach(function (n, i) {
      tone(tid + i * 0.035, f(n), TAKT * 0.96, 'sine', 0.038, 0.5);
    });

    /* Glitter — et par toner på offbeat, ulikt fra takt til takt */
    var antall = 1 + Math.floor(Math.random() * 3);
    for (var j = 0; j < antall; j++) {
      var slag = Math.floor(Math.random() * 4) + 0.5;
      var n2 = akkord.topp[Math.floor(Math.random() * akkord.topp.length)];
      tone(tid + slag * SLAG, f(n2), SLAG * 0.7, 'triangle', 0.028, 0.01);
    }

    /* Lett puls på 2 og 4, som en børs som tikker */
    [1, 3].forEach(function (b) {
      tone(tid + b * SLAG, f(akkord.pute[0] + 12), 0.1, 'sine', 0.016, 0.005);
    });
  }

  function planlegger() {
    var k = M._node;
    if (!k) return;
    var naa = k.ctx.currentTime;
    while (M._nesteTid < naa + FRAMSYN) {
      planleggTakt(M._takt, M._nesteTid);
      M._takt++;
      M._nesteTid += TAKT;
    }
  }

  /* ------------------------------------------------------------
     Styring
     ------------------------------------------------------------ */
  M.start = function () {
    if (M.av || M.spiller) return false;
    var k = kjede();
    if (!k) return false;
    if (k.ctx.state === 'suspended') k.ctx.resume();

    M.spiller = true;
    M._takt = 0;
    M._nesteTid = k.ctx.currentTime + 0.12;
    /* ton inn, så det ikke smeller i gang */
    k.ut.gain.cancelScheduledValues(k.ctx.currentTime);
    k.ut.gain.setValueAtTime(0.0001, k.ctx.currentTime);
    k.ut.gain.linearRampToValueAtTime(M.volum, k.ctx.currentTime + 2.5);

    planlegger();
    M._timer = setInterval(planlegger, TIKK);
    return true;
  };

  M.stopp = function (mykt) {
    if (!M.spiller) return;
    M.spiller = false;
    if (M._timer) clearInterval(M._timer);
    M._timer = null;
    var k = M._node;
    if (!k) return;
    var naa = k.ctx.currentTime;
    k.ut.gain.cancelScheduledValues(naa);
    k.ut.gain.setValueAtTime(k.ut.gain.value, naa);
    k.ut.gain.linearRampToValueAtTime(0.0001, naa + (mykt === false ? 0.05 : 0.8));
  };

  M.settVolum = function (v) {
    M.volum = Math.max(0, Math.min(1, v));
    MM.lagre('musikkVolum', M.volum);
    var k = M._node;
    if (k && M.spiller) {
      k.ut.gain.cancelScheduledValues(k.ctx.currentTime);
      k.ut.gain.linearRampToValueAtTime(M.volum, k.ctx.currentTime + 0.25);
    }
    return M.volum;
  };

  /* true = musikken spiller nå */
  M.veksle = function () {
    M.av = !M.av;
    MM.lagre('musikkAv', M.av);
    if (M.av) M.stopp();
    else M.start();
    return !M.av;
  };

  /* Demp kort, for eksempel under premieutdelingen */
  M.dukk = function (sekunder) {
    var k = M._node;
    if (!k || !M.spiller) return;
    var naa = k.ctx.currentTime;
    k.ut.gain.cancelScheduledValues(naa);
    k.ut.gain.setValueAtTime(k.ut.gain.value, naa);
    k.ut.gain.linearRampToValueAtTime(M.volum * 0.18, naa + 0.3);
    k.ut.gain.linearRampToValueAtTime(M.volum, naa + (sekunder || 4));
  };

  /* Nettlesere nekter lyd før brukeren har rørt siden.
     Derfor venter vi på første klikk eller tastetrykk. */
  M.vekkOgStart = function () {
    if (M.av) return;
    if (M.spiller) return;
    M.start();
  };

  M.koblePaaForsteKlikk = function () {
    function i_gang() {
      MM.Lyd.vekk();
      M.vekkOgStart();
      document.removeEventListener('pointerdown', i_gang);
      document.removeEventListener('keydown', i_gang);
    }
    document.addEventListener('pointerdown', i_gang);
    document.addEventListener('keydown', i_gang);
  };

  /* Spar strøm og lyd når fana ligger i bakgrunnen */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (M.spiller) { M._varPaa = true; M.stopp(); }
    } else if (M._varPaa && !M.av) {
      M._varPaa = false;
      M.start();
    }
  });

})(window.MM = window.MM || {});
