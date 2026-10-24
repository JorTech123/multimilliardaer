/* ============================================================
   Multimillionær — oppsett
   Dette er den eneste filen du trenger å redigere for å koble
   spillet til ditt eget Google Regneark.
   ============================================================ */
(function (MM) {
  'use strict';

  MM.CONFIG = {

    /* ----------------------------------------------------------
       1) Nettapp-URL fra Google Apps Script.
          Tom streng  = lokal modus (localStorage, flere faner på
                        samme PC kan spille sammen — fint for testing).
          Satt URL    = ekte flerspiller over Google Regneark.

          Slik får du den: se apps-script/OPPSETT.md
          Den ser omtrent slik ut:
          https://script.google.com/macros/s/AKfycbx..../exec
       ---------------------------------------------------------- */
    API_URL: 'https://script.google.com/macros/s/AKfycbyO4GoG9zhxL4mNAN7e59mmufJQIk2H1UXmfV_tR7KVQnwgKZi27bFwS0OUzv284gZGow/exec',

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
