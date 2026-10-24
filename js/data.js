/* ============================================================
   Multimilliardær — spilldata
   Brett, aksjeserier, sjansekort og spillefigurer.
   Eget design, inspirert av mekanikken i Multimillionær (Damm 1988/2017).
   ============================================================ */
(function (MM) {
  'use strict';

  /* ---------- Børskurs-stigen ----------
     Indeks 0 = suspendert (ingen handel). Toppen er 70 000. */
  MM.STOCK_LADDER = [
    0, 2000, 4000, 6000, 8000, 10000, 13000, 16000,
    20000, 25000, 30000, 37000, 45000, 55000, 70000
  ];

  /* ---------- 10 aksjeselskap = 10 tomteserier ----------
     pris      = pris per tomt i serien
     husPris   = pris per hus
     startNiva = startnivå på børsen
     Leie regnes ut fra pris via LEIE_FAKTOR:
     [grunnleie, 1 hus, 2 hus, 3 hus, 4 hus, hotell, slott] */
  var LEIE_FAKTOR = [0.10, 0.50, 1.50, 4.50, 6.50, 8.00, 12.00];

  MM.SERIES = [
    { id: 'nordkapp',  navn: 'Nordkapp Kraft',    ticker: 'NKR', farge: '#8d6e63', pris: 12000, husPris: 6000,  startNiva: 2 },
    { id: 'lofoten',   navn: 'Lofoten Sjømat',    ticker: 'LOF', farge: '#4fc3f7', pris: 20000, husPris: 10000, startNiva: 2 },
    { id: 'dovre',     navn: 'Dovre Data',        ticker: 'DVR', farge: '#f06292', pris: 28000, husPris: 14000, startNiva: 2 },
    { id: 'vestland',  navn: 'Vestland Vind',     ticker: 'VLV', farge: '#ff9800', pris: 36000, husPris: 18000, startNiva: 3 },
    { id: 'trondelag', navn: 'Trøndelag Teknikk', ticker: 'TRT', farge: '#ef5350', pris: 44000, husPris: 22000, startNiva: 3 },
    { id: 'sorland',   navn: 'Sørland Sol',       ticker: 'SSO', farge: '#ffd54f', pris: 52000, husPris: 26000, startNiva: 3 },
    { id: 'bergen',    navn: 'Bergen Bygg',       ticker: 'BBY', farge: '#66bb6a', pris: 60000, husPris: 30000, startNiva: 4 },
    { id: 'nordsjo',   navn: 'Nordsjø Energi',    ticker: 'NSE', farge: '#26c6da', pris: 70000, husPris: 35000, startNiva: 4 },
    { id: 'fjord',     navn: 'Fjord Shipping',    ticker: 'FJS', farge: '#5c6bc0', pris: 80000, husPris: 40000, startNiva: 4 },
    { id: 'kongens',   navn: 'Kongens Kapital',   ticker: 'KKA', farge: '#ba68c8', pris: 95000, husPris: 48000, startNiva: 5 }
  ];

  MM.AKSJER_PER_SERIE = 10;

  MM.SERIES.forEach(function (s) {
    s.leie = LEIE_FAKTOR.map(function (f) {
      return Math.round(s.pris * f / 100) * 100;
    });
    s.pant = Math.round(s.pris / 2);
  });

  MM.serie = function (id) {
    for (var i = 0; i < MM.SERIES.length; i++) {
      if (MM.SERIES[i].id === id) return MM.SERIES[i];
    }
    return null;
  };

  /* ---------- Brettet: 40 felt ----------
     type: start | tomt | sjanse | ferie | bors | casino | skatt | trafikkfyr
     Hjørner: 0 START, 10 FERIEHOTELLET, 20 BØRSEN, 30 CASINO */
  function T(navn, serie, nr, flagg) {
    flagg = flagg || {};
    return {
      type: 'tomt', navn: navn, serie: serie, nr: nr,
      auksjonKun: !!flagg.auksjonKun,
      slott: !!flagg.slott
    };
  }

  MM.BOARD = [
    { type: 'start',      navn: 'START',          info: 'Ingen lønn her. Ola Nordmann er inntekten din.' },
    T('Hammerfestveien',  'nordkapp',  0),
    T('Kaigata',          'nordkapp',  1),
    T('Isbjørnsvingen',   'nordkapp',  2),
    T('Rorbuveien',       'lofoten',   0),
    { type: 'sjanse',     navn: 'PRØV LYKKEN',    info: 'Trekk et sjansekort.' },
    T('Tørrfiskgata',     'lofoten',   1),
    T('Svolværbrygga',    'lofoten',   2),
    T('Serverveien',      'dovre',     0),
    T('Fiberalléen',      'dovre',     1),
    { type: 'ferie',      navn: 'FERIEHOTELLET',  info: 'Stå over så lenge du vil. Men det koster mer og mer.' },
    T('Kodeparken',       'dovre',     2),
    T('Turbinveien',      'vestland',  0),
    T('Fjordkanten',      'vestland',  1),
    T('Vindmøllehaugen',  'vestland',  2),
    { type: 'sjanse',     navn: 'PRØV LYKKEN',    info: 'Trekk et sjansekort.' },
    T('Nidarosgata',      'trondelag', 0),
    T('Robotveien',       'trondelag', 1),
    { type: 'trafikkfyr', navn: 'TRAFIKKFYR',     info: 'Leiefritak til neste gang det er din tur.' },
    T('Laboratoriealléen','trondelag', 2),
    { type: 'bors',       navn: 'BØRSEN',         info: 'Kjøp inntil 2 aksjer fra en motspiller til dobbel kurs.', antall: 2 },
    T('Solsiden',         'sorland',   0),
    T('Skjærgårdsveien',  'sorland',   1),
    T('Panelparken',      'sorland',   2),
    T('Bryggen',          'bergen',    0),
    { type: 'sjanse',     navn: 'PRØV LYKKEN',    info: 'Trekk et sjansekort.' },
    T('Fløyveien',        'bergen',    1),
    T('Stillasgata',      'bergen',    2),
    T('Plattformveien',   'nordsjo',   0),
    T('Rørgata',          'nordsjo',   1),
    { type: 'casino',     navn: 'CASINO',         info: 'Satse på sekser med én terning. 10 ganger igjen.' },
    T('Oljekaia',         'nordsjo',   2),
    T('Containerkaia',    'fjord',     0),
    { type: 'skatt',      navn: 'FORMUESSKATT',   info: '10 % av kontantene dine rett i statskassa.' },
    T('Dokkveien',        'fjord',     1),
    { type: 'bors',       navn: 'BØRSNYTT',       info: 'Kjøp 1 aksje fra en motspiller til dobbel kurs.', antall: 1 },
    T('Rederhavna',       'fjord',     2),
    T('Børsparken',       'kongens',   0, { auksjonKun: true }),
    T('Finansgata',       'kongens',   1),
    T('Slottsplassen',    'kongens',   2, { slott: true })
  ];

  /* ---------- Faste regelverdier ---------- */
  MM.SKATT_PST        = 0.10;
  MM.BORS_TERSKEL     = 20000;   // hver hele 20 000 i leie = ett kurssteg
  MM.GJELDSBREV       = 50000;
  MM.GJELDSBREV_RENTE = 2500;
  MM.GJELDSBREV_MAKS  = 3;
  MM.FERIE_TRAPP      = [0, 10000, 20000, 30000, 40000, 50000, 60000];
  MM.UTBYTTE_GRENSE   = 8;       // 8-10 aksjer gir 50 % av leieinntekten
  MM.LEIEFRITAK_ALLE  = 10;      // alle 10 aksjer gir leiefritak i serien
  MM.MAKS_SPILLERE    = 6;
  MM.PANT_RENTE       = 0.10;    // 10 % for å innfri pant
  MM.AUKSJON_SEKUNDER = 15;

  /* Indeksér brettet og berik tomtefeltene */
  MM.BOARD.forEach(function (f, i) {
    f.pos = i;
    if (f.type === 'tomt') {
      var s = MM.serie(f.serie);
      f.pris    = s.pris;
      f.husPris = s.husPris;
      f.pant    = s.pant;
      f.leie    = s.leie;
      f.farge   = s.farge;
    }
  });

  MM.tomter = MM.BOARD.filter(function (f) { return f.type === 'tomt'; });

  MM.tomterISerie = function (serieId) {
    return MM.tomter.filter(function (f) { return f.serie === serieId; });
  };

  /* ---------- Spillefigurer ---------- */
  MM.FIGURER = [
    { id: 'bil',     navn: 'Luksusbilen',     emoji: '🏎️', farge: '#ff5252' },
    { id: 'yacht',   navn: 'Yachten',         emoji: '🛥️', farge: '#29b6f6' },
    { id: 'jet',     navn: 'Privatjeten',     emoji: '✈️',       farge: '#ab47bc' },
    { id: 'rakett',  navn: 'Raketten',        emoji: '🚀',       farge: '#ffa726' },
    { id: 'hatt',    navn: 'Flosshatten',     emoji: '🎩',       farge: '#90a4ae' },
    { id: 'diamant', navn: 'Diamanten',       emoji: '💎',       farge: '#26c6da' },
    { id: 'krone',   navn: 'Kronen',          emoji: '👑',       farge: '#ffd54f' },
    { id: 'traktor', navn: 'Traktoren',       emoji: '🚜',       farge: '#66bb6a' },
    { id: 'koffert', navn: 'Pengekofferten',  emoji: '💼',       farge: '#a1887f' },
    { id: 'okse',    navn: 'Børsoksen',       emoji: '🐂',       farge: '#ec407a' }
  ];

  MM.figur = function (id) {
    for (var i = 0; i < MM.FIGURER.length; i++) {
      if (MM.FIGURER[i].id === id) return MM.FIGURER[i];
    }
    return MM.FIGURER[0];
  };

  MM.OLA = { navn: 'Ola Nordmann', emoji: '🚶', farge: '#eceff1' };

  /* ---------- Sjansekort ----------
     fx-typer: kontant | flyttTil | flyttRel | tilStart | aksjer | kurs |
               ferie | slettGjeld | betalAlle | kreveAlle | immunitet |
               skattPst | utbyttePerAksje | gratisHus | laan */
  MM.KORT = [
    { t: 'Skatteetaten har regnet feil &mdash; i din favør. Du får <b>25 000 kr</b>.',                 fx: { type: 'kontant', sum: 25000 } },
    { t: 'Strømprisen eksploderer. Alle betaler deg <b>8 000 kr</b> hver.',                            fx: { type: 'kreveAlle', sum: 8000 } },
    { t: 'Du glemte å levere skattemeldingen. <b>15 000 kr</b> i gebyr.',                              fx: { type: 'kontant', sum: -15000 } },
    { t: 'Emisjon! Du får <b>2 gratis aksjer</b> i et tilfeldig selskap.',                             fx: { type: 'aksjer', serie: 'tilfeldig', antall: 2 } },
    { t: 'Innsidesak. <b>1 aksje</b> må tilbake til banken.',                                          fx: { type: 'aksjer', serie: 'tilfeldig', antall: -1 } },
    { t: 'Oljefondet kjøper seg inn. Et tilfeldig selskap stiger <b>2 kurssteg</b>.',                   fx: { type: 'kurs', serie: 'tilfeldig', delta: 2 } },
    { t: 'Børskrakk! Et tilfeldig selskap faller <b>2 kurssteg</b>.',                                  fx: { type: 'kurs', serie: 'tilfeldig', delta: -2 } },
    { t: 'Hele børsen gløder. <b>Alle</b> selskap stiger ett kurssteg.',                               fx: { type: 'kurs', serie: 'alle', delta: 1 } },
    { t: 'Renteheving fra Norges Bank. <b>Alle</b> selskap faller ett kurssteg.',                       fx: { type: 'kurs', serie: 'alle', delta: -1 } },
    { t: 'Du vinner anbudet på en ny togstrekning. <b>60 000 kr</b> inn.',                              fx: { type: 'kontant', sum: 60000 } },
    { t: 'Bygningskontrollen fant feil. Du betaler <b>30 000 kr</b>.',                                 fx: { type: 'kontant', sum: -30000 } },
    { t: 'Rett til <b>Feriehotellet</b>. Du står over &mdash; første opphold er gratis.',               fx: { type: 'ferie' } },
    { t: 'Banken sletter <b>ett gjeldsbrev</b>. Gratulerer.',                                          fx: { type: 'slettGjeld', antall: 1 } },
    { t: 'Gå <b>til START</b>. Ingen lønn, men ny sjanse.',                                            fx: { type: 'tilStart' } },
    { t: 'Flytt <b>3 felt framover</b>.',                                                              fx: { type: 'flyttRel', n: 3 } },
    { t: 'Flytt <b>3 felt bakover</b>.',                                                               fx: { type: 'flyttRel', n: -3 } },
    { t: 'Gå direkte til <b>Børsen</b>.',                                                              fx: { type: 'flyttTil', pos: 20 } },
    { t: 'Gå direkte til <b>Casino</b>. Lommeboka skjelver.',                                          fx: { type: 'flyttTil', pos: 30 } },
    { t: 'Du spanderer middag på hele gjengen. <b>6 000 kr</b> til hver.',                              fx: { type: 'betalAlle', sum: 6000 } },
    { t: 'Grønt lys hele veien. <b>Leiefritak</b> til neste gang det er din tur.',                      fx: { type: 'immunitet' } },
    { t: 'Utbytte fra hele porteføljen: <b>2 000 kr per aksje</b> du eier.',                            fx: { type: 'utbyttePerAksje', sum: 2000 } },
    { t: 'Formuesskatt på <b>5 %</b> av kontantene.',                                                   fx: { type: 'skattPst', pst: 0.05 } },
    { t: 'Entreprenøren skylder deg en tjeneste: <b>ett gratis hus</b> hvis du har en hel serie.',       fx: { type: 'gratisHus' } },
    { t: 'Arv fra en fjern onkel på Hamar. <b>40 000 kr</b>.',                                          fx: { type: 'kontant', sum: 40000 } },
    { t: 'Kryptobørsen din forsvant over natta. <b>20 000 kr</b> ut.',                                  fx: { type: 'kontant', sum: -20000 } },
    { t: 'Du blir kåret til Årets Gründer. Alle gratulerer med <b>5 000 kr</b> hver.',                   fx: { type: 'kreveAlle', sum: 5000 } },
    { t: 'Banken tvangsselger: du må ta opp <b>ett gjeldsbrev</b> (50 000 kr inn, renteplikt).',         fx: { type: 'laan', antall: 1 } },
    { t: 'Tomtesalget gikk over all forventning. <b>Et selskap du eier aksjer i</b> stiger 3 steg.',     fx: { type: 'kurs', serie: 'eid', delta: 3 } },
    { t: 'Gå <b>5 felt framover</b> og kjøp det du lander på hvis du har råd.',                          fx: { type: 'flyttRel', n: 5 } },
    { t: 'Revisoren fant en feil i din favør: <b>12 000 kr</b> tilbake.',                                fx: { type: 'kontant', sum: 12000 } }
  ];

})(window.MM = window.MM || {});
