/* ============================================================
   Multimillionær — boter

   En bot er en helt vanlig spiller i tilstanden. Forskjellen er at
   ingen sitter med telefonen og trykker for den. Spillvertens klient
   tar trekkene på vegne av botene.

   Tre nivåer, med reell forskjell i hvordan brettet vurderes:

     lett    — kjøper nesten alt den har råd til, bygger sjelden,
               bryr seg lite om børsen og gir fort opp i en auksjon
     normal  — kjøper fornuftig, fullfører serier, bygger når den
               eier en hel serie, handler litt aksjer
     vrien   — teller hva som faktisk lønner seg: tomter som fullfører
               eller blokkerer en serie, aksjemajoritet for utbytte,
               og bygger tungt så snart en serie er hel

   Alle handlinger sendes med krevSeq, slik at to åpne faner hos
   spillverten ikke kan ta samme tur to ganger.
   ============================================================ */
(function (MM) {
  'use strict';

  var B = MM.Bot = {};

  /* kjopTerskel  hvor mye verdi boten krever per krone for å kjøpe
     reserve      kontanter den vil ha igjen etter et kjøp
     budMot       hvor langt over egen verdivurdering den byr
     serieVekt    hvor mye ekstra en tomt som fullfører en serie er verdt */
  /* Hvorfor disse tallene ser ut som de gjør:

     Ola Nordmann betaler leie fra bankens lomme for hver tomt som er
     eid. Da er det å skaffe seg tomter den sterkeste strategien i
     spillet — inntekten kommer uansett om noen lander på dem eller ei.
     Målt over hundrevis av partier: boten som kjøper mest, vinner.

     Derfor er det den vriene boten som har lavest reserve og lavest
     terskel. Den lette nøler, lar gode tomter gå på auksjon og byr
     forsiktig — og taper nettopp fordi den sitter på kontantene. */
  /* trusselAndel er det som skiller nivåene mest.

     Målinger over hundrevis av partier viste to ting. Først: Ola
     Nordmann betaler leie fra bankens lomme for hver eide tomt, så
     den som kjøper mest, tjener mest. Men dernest, og sterkere:
     et bygget hotell kan kreve over 200 000 kr i leie, og den som
     ikke kan betale er ute. Over 3/4 av partiene endte i konkurs.

     Så det nytter ikke å kjøpe aggressivt uten å se på hva som
     faktisk står på brettet. En god bot holder av omtrent så mye
     som den verste leia den kan bli avkrevd akkurat nå — og kan
     derfor kjøpe fritt tidlig, mens brettet er ufarlig.

     Den lette boten ser ikke faren i det hele tatt (trusselAndel 0)
     og blir tatt av den første store regningen. */
  var NIVA = {
    lett:   { sprangAndel: 0.50, sloev: 0.42, kjopTerskel: 1.10, reserveBase: 15000, trusselAndel: 0.10, byggMargin: 1.0, byggVilje: 0.15, aksjeVilje: 0.10, budMot: 0.70, serieVekt: 1.00, ferieLyst: 0.50, casinoLyst: 0.50 },
    normal: { sprangAndel: 0.28, sloev: 0.12, kjopTerskel: 1.00, reserveBase: 10000, trusselAndel: 0.85, byggMargin: 2.2, byggVilje: 0.50, aksjeVilje: 0.25, budMot: 1.00, serieVekt: 1.60, ferieLyst: 0.30, casinoLyst: 0.15 },
    vrien:  { sprangAndel: 0.12, sloev: 0.00, kjopTerskel: 0.85, reserveBase: 8000,  trusselAndel: 1.25, byggMargin: 3.2, byggVilje: 0.80, aksjeVilje: 0.30, budMot: 1.25, serieVekt: 2.40, ferieLyst: 0.12, casinoLyst: 0.02 }
  };

  B.NIVAER = [
    { id: 'lett',   navn: 'Lett',   beskrivelse: 'Kjøper i vei, bygger sjelden, gir fort opp i auksjon' },
    { id: 'normal', navn: 'Normal', beskrivelse: 'Fullfører serier, bygger når den kan, handler litt aksjer' },
    { id: 'vrien',  navn: 'Vrien',  beskrivelse: 'Jakter aksjemajoritet og bygger tungt. Den vil vinne' }
  ];

  function niva(p) { return NIVA[p && p.botNiva] || NIVA.normal; }
  function tilfeldig(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  /* ------------------------------------------------------------
     Verdivurdering: hva er denne tomta verdt for meg?
     ------------------------------------------------------------ */
  function tomteverdi(s, pid, pos) {
    var felt = MM.BOARD[pos];
    if (!felt || felt.type !== 'tomt') return 0;
    var p = MM.Engine.sp(s, pid);
    var n = niva(p);

    var sosken = MM.tomterISerie(felt.serie);
    var mine = 0, andres = 0;
    sosken.forEach(function (f) {
      var d = s.tomter[String(f.pos)];
      if (!d || !d.eier) return;
      if (d.eier === pid) mine++;
      else andres++;
    });

    /* En tomt er i utgangspunktet verdt litt mer enn prisen: den gir
       leie, teller i formuen og er én brikke nærmere en hel serie. */
    var verdi = felt.pris * 1.15;

    /* Fullfører jeg serien? Da er den verdt mye mer enn prisen */
    if (mine === sosken.length - 1) verdi *= n.serieVekt;
    else if (mine > 0) verdi *= 1 + (n.serieVekt - 1) * 0.4;

    /* Blokkerer jeg noen andre som nesten har hele serien? */
    if (andres === sosken.length - 1 && mine === 0) verdi *= 1 + (n.serieVekt - 1) * 0.5;

    /* Eier jeg aksjer i selskapet, tjener jeg dobbelt på leia her */
    var aksjer = p.aksjer[felt.serie] || 0;
    if (aksjer >= MM.UTBYTTE_GRENSE) verdi *= 1.25;

    return verdi;
  }

  /* Hvor mye kontanter vil boten sitte igjen med?
     En fast reserve er det som skiller en forsiktig bot fra en som
     bygger seg rett i konkurs. Renter på gjeld kommer i tillegg. */
  /* Den dyreste leia noen andre kan kreve av meg akkurat nå */
  function storsteTrussel(s, pid) {
    var maks = 0;
    for (var pos in s.tomter) {
      var d = s.tomter[pos];
      if (!d || !d.eier || d.eier === pid || d.pant) continue;
      var leie = MM.Engine.leieFor(s, Number(pos), pid).sum;
      if (leie > maks) maks = leie;
    }
    return maks;
  }

  /* Å kjøpe en tomt er nesten alltid riktig: Ola Nordmann betaler
     leie for den fra bankens lomme, så den tjener inn seg selv.
     Her holder en liten reserve. */
  function harRaad(s, pid, sum) {
    var p = MM.Engine.sp(s, pid);
    var n = niva(p);
    return p.cash - sum >= n.reserveBase + p.gjeld * MM.GJELDSBREV_RENTE * 3;
  }

  /* Å bygge eller samle aksjer er noe helt annet: pengene er bundet,
     og kommer det en hotellregning i mellomtiden er du ute. Derfor
     måles dette mot den verste leia som står på brettet akkurat nå.
     Det er her nivåene virkelig skiller lag. */
  function harRaadTrygt(s, pid, sum) {
    var p = MM.Engine.sp(s, pid);
    var n = niva(p);
    var reserve = n.reserveBase
                + storsteTrussel(s, pid) * n.trusselAndel
                + p.gjeld * MM.GJELDSBREV_RENTE * 3;
    return p.cash - sum >= reserve;
  }

  /* ------------------------------------------------------------
     Pengenød: hva selger vi, og i hvilken rekkefølge?
     ------------------------------------------------------------ */
  function skaffPenger(s, p) {
    /* Aksjer først — de gir ingen leieinntekt */
    var selgbare = MM.SERIES.filter(function (se) {
      return (p.aksjer[se.id] || 0) > 0 && MM.Engine.kursPris(s, se.id) > 0;
    }).sort(function (a, b) {
      /* behold majoriteten lengst mulig, den gir utbytte */
      var am = (p.aksjer[a.id] >= MM.UTBYTTE_GRENSE) ? 1 : 0;
      var bm = (p.aksjer[b.id] >= MM.UTBYTTE_GRENSE) ? 1 : 0;
      if (am !== bm) return am - bm;
      return MM.Engine.kursPris(s, b.id) - MM.Engine.kursPris(s, a.id);
    });
    if (selgbare.length) {
      return { type: 'SELG_AKSJER', pid: p.id, serie: selgbare[0].id, antall: 1 };
    }

    /* Så bygg, billigste serie først */
    var medBygg = [], uPant = [];
    MM.tomter.forEach(function (f) {
      var d = s.tomter[String(f.pos)];
      if (!d || d.eier !== p.id) return;
      if (d.hus > 0 || d.hotell || d.slott) medBygg.push(f);
      else if (!d.pant) uPant.push(f);
    });
    if (medBygg.length) {
      medBygg.sort(function (a, b) { return a.husPris - b.husPris; });
      return { type: 'SELG_BYGG', pid: p.id, pos: medBygg[0].pos };
    }

    /* Så lån, hvis det er rom */
    if (p.gjeld < MM.GJELDSBREV_MAKS) return { type: 'LAAN', pid: p.id };

    /* Så pantsett, minst verdifulle først */
    if (uPant.length) {
      uPant.sort(function (a, b) {
        return tomteverdi(s, p.id, a.pos) - tomteverdi(s, p.id, b.pos);
      });
      return { type: 'PANTSETT', pid: p.id, pos: uPant[0].pos };
    }

    return { type: 'GI_OPP', pid: p.id };
  }

  /* ------------------------------------------------------------
     velgTrekk — hva skal boten gjøre akkurat nå?
     Returnerer null hvis det ikke er noe å gjøre.
     ------------------------------------------------------------ */
  B.velgTrekk = function (s, botId) {
    var p = MM.Engine.sp(s, botId);
    if (!p || p.konkurs || s.fase !== 'spiller') return null;
    var n = niva(p);

    /* Auksjon: alle kan by, også når det ikke er egen tur */
    if (s.auksjon) {
      if (s.auksjon.passert.indexOf(botId) >= 0) return null;
      /* Aldri mer enn halve kassa på én tomt, uansett hvor fristende
         den ser ut. En serie som fullføres kan regnes til over tre
         ganger takst, og uten dette taket byr boten seg konkurs. */
      var tak = Math.min(
        tomteverdi(s, botId, s.auksjon.pos) * n.budMot,
        MM.Engine.sp(s, botId).cash * 0.5
      );
      if (s.auksjon.hoyesteId === botId) return null;      // leder alt

      /* Ikke kryp oppover med minste steg. To boter som byr 1 000 av
         gangen holder på i evigheter, og hvert bud nullstiller klokka
         — da sitter menneskene bare og ser på. Byr heller et stykke
         inn mot eget tak med en gang. */
      var minste = (s.auksjon.hoyeste || 0) + s.auksjon.steg;
      var bud = minste;
      if (tak > minste) {
        var sprang = Math.round((tak - minste) * n.sprangAndel * (0.6 + Math.random() * 0.8) / s.auksjon.steg) * s.auksjon.steg;
        bud = Math.min(tak, minste + sprang);
      }

      if (bud <= tak && harRaad(s, botId, bud) && Math.random() >= n.sloev * 0.5) {
        return { type: 'BUD', pid: botId, sum: bud };
      }
      return { type: 'PASS', pid: botId };
    }

    if (MM.Engine.aktivId(s) !== botId) {
      /* Utenfor egen tur gjør boten bare én ting: redder seg selv */
      if (p.maaSkaffe) return skaffPenger(s, p);
      return null;
    }

    if (p.maaSkaffe || p.cash < 0) return skaffPenger(s, p);

    var v = s.tur.ventende;
    if (v) {
      switch (v.type) {
        case 'kjop': {
          var pris = MM.BOARD[v.pos].pris;
          var verdi = tomteverdi(s, botId, v.pos);
          var sloev = Math.random() < n.sloev;      /* lot sjansen gå */
          if (!sloev && verdi >= pris * n.kjopTerskel && harRaad(s, botId, pris)) {
            return { type: 'KJOP', pid: botId };
          }
          return { type: 'TIL_AUKSJON', pid: botId };
        }
        case 'auksjon-start': return { type: 'TIL_AUKSJON', pid: botId };
        case 'kort':          return { type: 'KORT_OK', pid: botId };
        case 'skaff-penger':  return skaffPenger(s, MM.Engine.sp(s, v.pid) || p);

        case 'casino': {
          /* Lett bot gambler gjerne, vrien bot nesten aldri */
          var innsats = 0;
          if (Math.random() < n.casinoLyst) innsats = Math.min(10000, Math.floor(p.cash * 0.05 / 1000) * 1000);
          return { type: 'CASINO', pid: botId, innsats: innsats, terning: [MM.terning()] };
        }

        case 'bors': {
          /* Kjøp fra motspiller til dobbel kurs — bare hvis det
             bringer oss mot aksjemajoritet og utbytte */
          if (Math.random() > n.aksjeVilje) return { type: 'BORS_HOPP_OVER', pid: botId };
          var best = null;
          s.spillere.forEach(function (q) {
            if (q.id === botId || q.konkurs) return;
            MM.SERIES.forEach(function (se) {
              var antall = q.aksjer[se.id] || 0;
              if (!antall) return;
              var kurs = MM.Engine.kursPris(s, se.id);
              if (kurs <= 0) return;
              var pris2 = kurs * 2;
              if (!harRaad(s, botId, pris2)) return;
              var mine2 = p.aksjer[se.id] || 0;
              /* verdien av å nærme seg 8 aksjer */
              var poeng = mine2 >= MM.UTBYTTE_GRENSE - 1 ? 3 : mine2 >= 4 ? 2 : 1;
              if (!best || poeng > best.poeng) best = { poeng: poeng, fra: q.id, serie: se.id };
            });
          });
          if (best) {
            return { type: 'BORS_KJOP', pid: botId, fra: best.fra, serie: best.serie, antall: 1 };
          }
          return { type: 'BORS_HOPP_OVER', pid: botId };
        }

        case 'ferie-ankomst':
          return { type: 'FERIE_ANKOMST', pid: botId, bli: Math.random() < n.ferieLyst };
      }
    }

    if (s.tur.steg === 'ferie-valg') {
      var steg = Math.min(p.ferieOpphold, MM.FERIE_TRAPP.length - 1);
      var avgift = MM.FERIE_TRAPP[steg];
      /* Bli bare hvis det er billig og brettet er farlig */
      if (Math.random() < n.ferieLyst && avgift <= p.cash * 0.08) {
        return { type: 'FERIE_BLI', pid: botId };
      }
      return { type: 'FERIE_REIS', pid: botId, terning: [MM.terning()] };
    }

    if (s.tur.steg === 'ola-kast') return { type: 'KAST_OLA', pid: botId, terning: MM.terningPar() };
    if (s.tur.steg === 'bil-kast') return { type: 'KAST_BIL', pid: botId, terning: MM.terningPar() };

    if (s.tur.steg === 'handel') {
      /* Bygg der det gir mest leie per krone */
      if (Math.random() < n.byggVilje) {
        var kandidater = [];
        MM.tomter.forEach(function (f) {
          if (MM.Engine.kanBygge(s, botId, f.pos)) return;      // null = lov
          /* Bygg bare med god klaring: pengene bindes opp, mens
             leia de gir kommer sakte */
          if (!harRaadTrygt(s, botId, f.husPris * n.byggMargin)) return;
          var d = s.tomter[String(f.pos)];
          var naa = MM.Engine.grunnLeie(s, f.pos);
          var etter = f.leie[Math.min(6, (d.hotell ? 5 : d.hus + 1))];
          kandidater.push({ pos: f.pos, gevinst: (etter - naa) / f.husPris });
        });
        if (kandidater.length) {
          kandidater.sort(function (a, b) { return b.gevinst - a.gevinst; });
          return { type: 'BYGG', pid: botId, pos: kandidater[0].pos };
        }
      }

      /* Kjøp aksjer der vi er nær majoritet, eller der kursen er lav */
      if (Math.random() < n.aksjeVilje) {
        var valg = null;
        MM.SERIES.forEach(function (se) {
          var kurs = MM.Engine.kursPris(s, se.id);
          if (kurs <= 0 || !s.bank.aksjer[se.id]) return;
          if (!harRaadTrygt(s, botId, kurs)) return;
          var mine3 = p.aksjer[se.id] || 0;
          var poeng = 0;
          if (mine3 >= MM.UTBYTTE_GRENSE - 2 && mine3 < MM.LEIEFRITAK_ALLE) poeng += 4;
          if (MM.Engine.serieEier(s, se.id)) poeng += 2;        // noen eier hele serien: leie flyter
          if (s.kurs[se.id] <= 3) poeng += 1;                   // billig nå
          if (poeng > 0 && (!valg || poeng > valg.poeng)) valg = { poeng: poeng, serie: se.id };
        });
        if (valg) return { type: 'KJOP_AKSJER', pid: botId, serie: valg.serie, antall: 1 };
      }

      /* Innfri pant når det er god råd */
      if (p.botNiva !== 'lett') {
        for (var pos in s.tomter) {
          var d2 = s.tomter[pos];
          if (d2.eier !== botId || !d2.pant) continue;
          var kost = Math.round(MM.BOARD[Number(pos)].pant * (1 + MM.PANT_RENTE));
          if (harRaadTrygt(s, botId, kost * 3)) {
            return { type: 'INNFRI_PANT', pid: botId, pos: Number(pos) };
          }
        }
      }

      /* Betal ned gjeld hvis vi svømmer i penger */
      if (p.gjeld > 0 && p.cash > MM.GJELDSBREV * 2.5) {
        return { type: 'INNFRI_LAAN', pid: botId };
      }

      return { type: 'AVSLUTT_TUR', pid: botId };
    }

    return null;
  };

  /* ------------------------------------------------------------
     Driveren — kjører hos spillverten
     ------------------------------------------------------------ */
  var aktiv = false, venter = false, timer = null;

  B.finnesBoter = function (s) {
    return !!(s && s.spillere && s.spillere.some(function (p) { return p.erBot; }));
  };

  /* Hvem skal boten drives av? Spillverten, slik at bare én klient gjør det. */
  B.minAnsvar = function (s, minId) {
    return !!(s && s.vertId === minId && B.finnesBoter(s));
  };

  /* Hvilken bot trenger å gjøre noe nå? */
  function botSomMaaHandle(s) {
    if (s.fase !== 'spiller') return null;

    /* I auksjon kan flere boter ha noe å si */
    if (s.auksjon) {
      var kandidat = s.spillere.filter(function (p) {
        return p.erBot && !p.konkurs && s.auksjon.passert.indexOf(p.id) < 0 && s.auksjon.hoyesteId !== p.id;
      })[0];
      return kandidat ? kandidat.id : null;
    }

    var aktivP = MM.Engine.sp(s, MM.Engine.aktivId(s));
    if (aktivP && aktivP.erBot && !aktivP.konkurs) return aktivP.id;

    /* En bot i pengenød utenfor egen tur */
    var nod = s.spillere.filter(function (p) { return p.erBot && !p.konkurs && p.maaSkaffe; })[0];
    return nod ? nod.id : null;
  }

  /* Hvor lenge boten «tenker», så mennesker rekker å følge med */
  function tenketid(s, botId) {
    var p = MM.Engine.sp(s, botId);
    var n = niva(p);
    var grunn = s.auksjon ? 700 : 900;
    return grunn + Math.random() * 900 + (n === NIVA.vrien ? 200 : 0);
  }

  B.start = function (hentTilstand, minId) {
    if (aktiv) return;
    aktiv = true;

    function tikk() {
      if (!aktiv) return;
      var s = hentTilstand();
      if (!s || venter) return;
      if (!B.minAnsvar(s, minId)) return;

      /* En utløpt auksjon som ingen har avsluttet. Det skjer når en bot
         har turen: da sitter det ingen der og trykker. Driveren rydder. */
      if (s.auksjon && Date.now() > s.auksjon.utgaar + 1500) {
        venter = true;
        MM.Nett.send({ type: 'AUKSJON_SLUTT', pid: minId }, { stille: true })
          .catch(function () { /* en annen rakk det først */ })
          .then(function () { venter = false; });
        return;
      }

      var botId = botSomMaaHandle(s);
      if (!botId) return;

      venter = true;
      var seq = s.seq;
      setTimeout(function () {
        var fersk = hentTilstand();
        /* Noe kan ha skjedd mens boten «tenkte» */
        if (!fersk || fersk.seq !== seq || !aktiv) { venter = false; return; }

        var trekk = null;
        try { trekk = B.velgTrekk(fersk, botId); }
        catch (e) { trekk = null; }

        if (!trekk) { venter = false; return; }
        trekk.krevSeq = seq;

        MM.Nett.send(trekk, { stille: true })
          .then(function () { venter = false; })
          .catch(function () {
            /* Avvist trekk er normalt når noe endret seg samtidig.
               Neste tikk prøver på nytt mot fersk tilstand. */
            venter = false;
          });
      }, tenketid(s, botId));
    }

    timer = setInterval(tikk, 600);
  };

  B.stopp = function () {
    aktiv = false;
    venter = false;
    if (timer) clearInterval(timer);
    timer = null;
  };

})(window.MM = window.MM || {});
