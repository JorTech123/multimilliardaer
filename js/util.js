/* ============================================================
   Multimillionær — småverktøy
   Formatering, DOM, lagring, lyd, terninger, toast og konfetti.
   ============================================================ */
(function (MM) {
  'use strict';

  /* ---------- Tall og tekst ---------- */
  MM.fmt = function (n) {
    var neg = n < 0;
    var s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '−' : '') + s + ' kr';
  };

  MM.kort = function (n) {
    var a = Math.abs(n);
    if (a >= 1000000) return (n / 1000000).toFixed(a >= 10000000 ? 0 : 1).replace('.', ',') + ' mill';
    if (a >= 1000) return Math.round(n / 1000) + 'k';
    return String(Math.round(n));
  };

  MM.klokke = function (ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(t / 60), sek = t % 60;
    return m + ':' + (sek < 10 ? '0' : '') + sek;
  };

  MM.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- DOM ---------- */
  MM.$ = function (sel, rot) { return (rot || document).querySelector(sel); };
  MM.$$ = function (sel, rot) { return Array.prototype.slice.call((rot || document).querySelectorAll(sel)); };

  MM.el = function (tag, attr, barn) {
    var e = document.createElement(tag);
    if (attr) {
      Object.keys(attr).forEach(function (k) {
        if (k === 'class') e.className = attr[k];
        else if (k === 'html') e.innerHTML = attr[k];
        else if (k === 'text') e.textContent = attr[k];
        else if (k === 'style') e.setAttribute('style', attr[k]);
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attr[k]);
        else if (attr[k] !== null && attr[k] !== undefined) e.setAttribute(k, attr[k]);
      });
    }
    (barn || []).forEach(function (b) {
      if (b === null || b === undefined) return;
      e.appendChild(typeof b === 'string' ? document.createTextNode(b) : b);
    });
    return e;
  };

  /* ---------- Lagring (tåler blokkert localStorage) ---------- */
  MM.lagre = function (k, v) {
    try { localStorage.setItem('mm.' + k, JSON.stringify(v)); } catch (e) { /* privat modus */ }
  };
  MM.hent = function (k, standard) {
    try {
      var r = localStorage.getItem('mm.' + k);
      return r === null ? standard : JSON.parse(r);
    } catch (e) { return standard; }
  };
  MM.glem = function (k) {
    try { localStorage.removeItem('mm.' + k); } catch (e) { /* ignorer */ }
  };

  /* Fanelagring: sessionStorage er egen per fane. Det er dette som gjør
     at to faner på samme PC kan være to forskjellige spillere. */
  MM.sLagre = function (k, v) {
    try { sessionStorage.setItem('mm.' + k, JSON.stringify(v)); } catch (e) { /* privat modus */ }
  };
  MM.sHent = function (k, standard) {
    try {
      var r = sessionStorage.getItem('mm.' + k);
      return r === null ? standard : JSON.parse(r);
    } catch (e) { return standard; }
  };
  MM.sGlem = function (k) {
    try { sessionStorage.removeItem('mm.' + k); } catch (e) { /* ignorer */ }
  };

  MM.uid = function (pre) {
    return (pre || 'id') + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  };

  MM.spillkode = function () {
    var bok = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 4; i++) s += bok[Math.floor(Math.random() * bok.length)];
    return s;
  };

  /* Enkel kontrollsum til passordsperra i grensesnittet.
     Math.imul gir ekte 32-bits multiplikasjon — vanlig * mister
     de laveste bitene når produktet går over 2^53. */
  MM.hash = function (tekst) {
    var h1 = 0x811c9dc5, h2 = 0xc2b2ae35;
    for (var i = 0; i < tekst.length; i++) {
      var c = tekst.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
      h2 = (h2 << 13 | h2 >>> 19) >>> 0;
    }
    h1 = Math.imul(h1 ^ h1 >>> 15, 0x2545f491) >>> 0;
    h2 = Math.imul(h2 ^ h2 >>> 13, 0x27d4eb2f) >>> 0;
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  };

  MM.terning = function () { return 1 + Math.floor(Math.random() * 6); };
  MM.terningPar = function () { return [MM.terning(), MM.terning()]; };

  /* ============================================================
     Lyd — alt syntetisert, ingen lydfiler å laste ned
     ============================================================ */
  var Lyd = MM.Lyd = {
    ctx: null,
    av: MM.hent('lydAv', false),

    start: function () {
      if (this.ctx) return this.ctx;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) { this.ctx = null; }
      return this.ctx;
    },

    vekk: function () {
      var c = this.start();
      if (c && c.state === 'suspended') c.resume();
    },

    toneRekke: function (toner, type, vol) {
      if (this.av) return;
      var c = this.start();
      if (!c) return;
      var naa = c.currentTime;
      toner.forEach(function (t) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = type || 'triangle';
        o.frequency.setValueAtTime(t.f, naa + t.t);
        if (t.f2) o.frequency.exponentialRampToValueAtTime(t.f2, naa + t.t + t.d);
        g.gain.setValueAtTime(0, naa + t.t);
        g.gain.linearRampToValueAtTime((vol || 0.18) * (t.v || 1), naa + t.t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, naa + t.t + t.d);
        o.connect(g); g.connect(c.destination);
        o.start(naa + t.t); o.stop(naa + t.t + t.d + 0.02);
      });
    },

    stoy: function (varighet, filter, vol) {
      if (this.av) return;
      var c = this.start();
      if (!c) return;
      var n = Math.floor(c.sampleRate * varighet);
      var buf = c.createBuffer(1, n, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = c.createBufferSource(); src.buffer = buf;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = filter || 1400; bp.Q.value = 1.2;
      var g = c.createGain(); g.gain.value = vol === undefined ? 0.25 : vol;
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start();
    },

    kast:      function () { this.stoy(0.42, 900, 0.3); },
    land:      function () { this.stoy(0.1, 320, 0.4); this.toneRekke([{ f: 180, f2: 90, t: 0, d: 0.12 }], 'square', 0.12); },
    kasse:     function () { this.toneRekke([{ f: 1318, t: 0, d: 0.09 }, { f: 1760, t: 0.07, d: 0.14 }, { f: 2093, t: 0.14, d: 0.2 }], 'triangle', 0.14); },
    minus:     function () { this.toneRekke([{ f: 330, f2: 110, t: 0, d: 0.35 }], 'sawtooth', 0.12); },
    opp:       function () { this.toneRekke([{ f: 880, t: 0, d: 0.08 }, { f: 1175, t: 0.06, d: 0.12 }], 'sine', 0.13); },
    ned:       function () { this.toneRekke([{ f: 660, t: 0, d: 0.08 }, { f: 440, t: 0.06, d: 0.14 }], 'sine', 0.13); },
    klikk:     function () { this.toneRekke([{ f: 1200, t: 0, d: 0.04 }], 'square', 0.07); },
    feil:      function () { this.toneRekke([{ f: 200, t: 0, d: 0.1 }, { f: 160, t: 0.1, d: 0.2 }], 'sawtooth', 0.14); },
    varsel:    function () { this.toneRekke([{ f: 1046, t: 0, d: 0.1 }, { f: 1568, t: 0.1, d: 0.16 }], 'triangle', 0.15); },
    hammer:    function () { this.stoy(0.08, 500, 0.5); },
    jubel:     function () {
      this.toneRekke([
        { f: 523, t: 0, d: 0.16 }, { f: 659, t: 0.12, d: 0.16 }, { f: 784, t: 0.24, d: 0.16 },
        { f: 1046, t: 0.36, d: 0.3 }, { f: 1318, t: 0.52, d: 0.4, v: 0.8 }
      ], 'triangle', 0.17);
    },
    fanfare:   function () {
      this.toneRekke([
        { f: 392, t: 0, d: 0.18 }, { f: 523, t: 0.16, d: 0.18 }, { f: 659, t: 0.32, d: 0.18 },
        { f: 784, t: 0.48, d: 0.5 }, { f: 988, t: 0.62, d: 0.5, v: 0.7 }, { f: 1175, t: 0.76, d: 0.7, v: 0.6 }
      ], 'square', 0.13);
    },
    trommer:   function () {
      var self = this;
      var n = 0;
      var iv = setInterval(function () {
        self.stoy(0.05, 220, 0.22);
        if (++n > 24) clearInterval(iv);
      }, 70);
      return function () { clearInterval(iv); };
    },

    veksle: function () {
      this.av = !this.av;
      MM.lagre('lydAv', this.av);
      if (!this.av) this.klikk();
      return !this.av;
    }
  };

  /* ============================================================
     Terningkast i 3D
     ============================================================ */
  var PIP = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };
  /* Rotasjon som viser ønsket tall mot kamera */
  var VIS = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };

  function lagTerning(storrelse) {
    var sider = [1, 2, 3, 4, 5, 6];
    var FLATE = {
      1: 'translateZ(E)', 2: 'rotateY(90deg) translateZ(E)', 3: 'rotateX(90deg) translateZ(E)',
      4: 'rotateX(-90deg) translateZ(E)', 5: 'rotateY(-90deg) translateZ(E)', 6: 'rotateY(180deg) translateZ(E)'
    };
    var halv = (storrelse / 2) + 'px';
    var kube = MM.el('div', { class: 'tern-kube' });
    sider.forEach(function (n) {
      var f = MM.el('div', { class: 'tern-flate', 'data-n': n, style: 'transform:' + FLATE[n].replace('E', halv) });
      for (var i = 0; i < 9; i++) {
        f.appendChild(MM.el('span', { class: 'tern-pip' + (PIP[n].indexOf(i) >= 0 ? ' på' : '') }));
      }
      kube.appendChild(f);
    });
    var ytre = MM.el('div', { class: 'tern', style: '--tern:' + storrelse + 'px' }, [kube]);
    ytre._kube = kube;
    return ytre;
  }
  MM.lagTerning = lagTerning;

  /* Kast n terninger i en beholder. Lander på gitte verdier. */
  MM.kastTerninger = function (beholder, verdier, valg) {
    valg = valg || {};
    var storrelse = valg.storrelse || 72;
    beholder.innerHTML = '';
    beholder.classList.add('tern-rom');
    var terninger = verdier.map(function (v, i) {
      var t = lagTerning(storrelse);
      t.style.setProperty('--dz', (i * 40 - (verdier.length - 1) * 20) + 'px');
      beholder.appendChild(t);
      return { el: t, v: v };
    });
    MM.Lyd.kast();

    return new Promise(function (ferdig) {
      terninger.forEach(function (t, i) {
        var kube = t.el._kube;
        var spinX = 360 * (3 + Math.floor(Math.random() * 3));
        var spinY = 360 * (2 + Math.floor(Math.random() * 3));
        kube.style.transition = 'none';
        kube.style.transform = 'rotateX(0deg) rotateY(0deg)';
        /* tving reflow slik at overgangen faktisk starter */
        void kube.offsetWidth;
        var ms = 1150 + i * 110;
        kube.style.transition = 'transform ' + ms + 'ms cubic-bezier(.17,.67,.21,1.01)';
        var mal = VIS[t.v];
        kube.style.transform = 'rotateX(' + (spinX + mal[0]) + 'deg) rotateY(' + (spinY + mal[1]) + 'deg)';
        t.el.classList.add('triller');
        setTimeout(function () {
          t.el.classList.remove('triller');
          t.el.classList.add('landet');
          MM.Lyd.land();
          if (i === terninger.length - 1) setTimeout(function () { ferdig(verdier); }, 220);
        }, ms);
      });
    });
  };

  /* ============================================================
     Toast
     ============================================================ */
  MM.toast = function (tekst, type, varighet) {
    var lag = MM.$('#toastlag');
    if (!lag) {
      lag = MM.el('div', { id: 'toastlag', class: 'toastlag' });
      document.body.appendChild(lag);
    }
    var t = MM.el('div', { class: 'toast t-' + (type || 'info'), html: tekst });
    lag.appendChild(t);
    if (type === 'feil') MM.Lyd.feil();
    setTimeout(function () {
      t.classList.add('ut');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 420);
    }, varighet || 3600);
    return t;
  };

  /* ============================================================
     Pengetall som flyr opp
     ============================================================ */
  MM.flyvendeTall = function (anker, tekst, positiv) {
    if (!anker) return;
    var r = anker.getBoundingClientRect();
    var e = MM.el('div', {
      class: 'flytall ' + (positiv ? 'pluss' : 'minus'),
      text: tekst,
      style: 'left:' + (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px'
    });
    document.body.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1500);
  };

  /* ============================================================
     Konfetti
     ============================================================ */
  MM.konfetti = function (valg) {
    valg = valg || {};
    var antall = valg.antall || 160;
    var varighet = valg.varighet || 4200;
    var farger = valg.farger || ['#ffd54f', '#ff5252', '#4fc3f7', '#66bb6a', '#ba68c8', '#ff9800', '#26c6da'];
    var lerret = MM.el('canvas', { class: 'konfetti-lerret' });
    document.body.appendChild(lerret);
    var k = lerret.getContext('2d');
    function mål() { lerret.width = innerWidth; lerret.height = innerHeight; }
    mål();
    addEventListener('resize', mål);

    var biter = [];
    for (var i = 0; i < antall; i++) {
      biter.push({
        x: Math.random() * innerWidth,
        y: -20 - Math.random() * innerHeight * 0.6,
        b: 6 + Math.random() * 8,
        h: 8 + Math.random() * 12,
        f: farger[Math.floor(Math.random() * farger.length)],
        vy: 1.8 + Math.random() * 3.4,
        vx: -1.4 + Math.random() * 2.8,
        r: Math.random() * Math.PI * 2,
        vr: -0.18 + Math.random() * 0.36
      });
    }
    var start = performance.now();
    function tegn(naa) {
      var gaatt = naa - start;
      k.clearRect(0, 0, lerret.width, lerret.height);
      biter.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vy += 0.012;
        if (b.y > lerret.height + 30) { b.y = -20; b.x = Math.random() * innerWidth; }
        k.save();
        k.translate(b.x, b.y);
        k.rotate(b.r);
        k.globalAlpha = gaatt > varighet - 900 ? Math.max(0, (varighet - gaatt) / 900) : 1;
        k.fillStyle = b.f;
        k.fillRect(-b.b / 2, -b.h / 2, b.b, b.h);
        k.restore();
      });
      if (gaatt < varighet) requestAnimationFrame(tegn);
      else { removeEventListener('resize', mål); if (lerret.parentNode) lerret.parentNode.removeChild(lerret); }
    }
    requestAnimationFrame(tegn);
  };

  /* Liten eksplosjon av konfetti fra et punkt */
  MM.spruting = function (x, y, farge) {
    for (var i = 0; i < 14; i++) {
      var e = MM.el('span', {
        class: 'gnist',
        style: 'left:' + x + 'px;top:' + y + 'px;background:' + (farge || '#ffd54f') +
               ';--vx:' + (-60 + Math.random() * 120) + 'px;--vy:' + (-40 - Math.random() * 90) + 'px'
      });
      document.body.appendChild(e);
      setTimeout(function (el) { return function () { if (el.parentNode) el.parentNode.removeChild(el); }; }(e), 900);
    }
  };

  MM.skjelv = function (el, styrke) {
    el = el || document.body;
    el.style.setProperty('--skjelv', (styrke || 8) + 'px');
    el.classList.add('skjelver');
    setTimeout(function () { el.classList.remove('skjelver'); }, 520);
  };

  /* Vent-hjelper */
  MM.sov = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

})(window.MM = window.MM || {});
