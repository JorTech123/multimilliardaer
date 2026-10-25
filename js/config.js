/* ============================================================
   Multimillionær — oppsett
   Dette er den eneste filen du trenger å redigere for å koble
   spillet til ditt eget Google Regneark.
   ============================================================ */
(function (MM) {
  'use strict';

  MM.CONFIG = {

    /* ----------------------------------------------------------
       1) Hvor serveren ligger.

          '/api'      = Cloudflare Pages Function i dette prosjektet.
                        Samme adresse som spillet, så ingen CORS og
                        ingenting å fylle inn. Dette er standarden.
                        Oppsett: se cloudflare/OPPSETT.md

          Tom streng  = lokal modus (localStorage). Flere faner på
                        samme PC kan spille sammen. Spillet faller
                        automatisk hit når det åpnes som fil, siden
                        en relativ adresse ikke gir mening da.

          Full URL    = en server et annet sted, for eksempel den
                        gamle Google Apps Script-nettappen:
                        https://script.google.com/macros/s/..../exec
       ---------------------------------------------------------- */
    API_URL: '/api',

    /* ----------------------------------------------------------
       1b) Reserveserver.

          Finnes ikke API_URL der siden ligger — for eksempel mens
          spillet fortsatt kjører på GitHub Pages, eller før
          Cloudflare er ferdig satt opp — brukes denne i stedet.
          Spillet sjekker én gang ved oppstart og sier fra i
          statuslampa hvilken server det endte på.

          Sett til tom streng når flyttingen er ferdig.
       ---------------------------------------------------------- */
    API_RESERVE: 'https://script.google.com/macros/s/AKfycbyO4GoG9zhxL4mNAN7e59mmufJQIk2H1UXmfV_tR7KVQnwgKZi27bFwS0OUzv284gZGow/exec',

    /* ----------------------------------------------------------
       2) Passordet til hovedsiden.
          Her ligger bare en kontrollsum, ikke passordet selv.
          Standardverdien tilsvarer "Starveien".

          Vil du bytte passord:
            a) åpne verktoy/passord.html, skriv inn nytt passord,
               kopier kontrollsummen hit
            b) sett samme passord som skriptegenskap PASSORD
               i Apps Script-prosjektet
       ---------------------------------------------------------- */
    PASSORD_HASH: '23f1c022b1fac672',

    /* ----------------------------------------------------------
       3) Standardregler for nye spill
       ---------------------------------------------------------- */
    STANDARD: {
      mal: 2000000,          // formue som utløser seier

      /* Som i regelboka: 150 000 kr.

         Verdt å vite hvis dere synes det blir mange konkurser: dette
         brettet har sine egne tomtepriser og leier, og de er hardere
         enn esken sine. Et hotell på den dyreste serien krever
         760 000 kr. Simulering over hundrevis av partier:
             150 000  ->  51 % av spillerne går konkurs
             400 000  ->  21 %, og de fleste partier ender med at
                          noen faktisk når målformuen
         Verten kan endre summen per spill uten å røre denne fila. */
      startKapital: 150000,

      tidsgrenseMin: 0       // 0 = ingen tidsgrense, ellers minutter
    },

    /* Hvor ofte klientene spør serveren om nytt (millisekunder) */
    POLL_MS: 1600,

    /* Vis hjelpetekster for den som ikke kan spillet */
    HJELPETEKSTER: true
  };

})(window.MM = window.MM || {});
