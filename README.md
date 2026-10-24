# Multimillionær

Et norsk flerspiller-brettspill som kjører rett i nettleseren. Tomter, børs og
gjeldsbrev. Hver spiller styrer fra sin egen telefon, brettet vises på en TV, og
alt lagres i ditt eget Google Regneark.

Spillet følger **reglene** fra Multimillionær (Damm, 1988/2017), men brett,
tomtenavn, selskaper, sjansekort og tall er skrevet fra bunnen av. Det er ikke
en kopi av esken, og det følger ikke med noe materiale fra originalspillet.

> Navnet er delt med Damms brettspill, som fortsatt selges. Dette er et
> hjemmelaget hobbyprosjekt uten tilknytning til utgiveren. Skal det deles
> bredere enn vennegjengen, er et eget navn ryddigst.

---

## Kom i gang på 30 sekunder

Du trenger ingenting installert. Dobbeltklikk `index.html`, så spiller det.

Vil du teste flerspiller på én maskin: åpne `index.html` i to faner. Hver fane er
sin egen spiller, fordi identiteten ligger i `sessionStorage`.

Noen nettlesere er strenge med `file://`. Følger det en feil, start den lille
testserveren som ligger i prosjektet — den trenger verken Node eller Python:

```bash
powershell -ExecutionPolicy Bypass -File verktoy\server.ps1
```

Åpne så <http://localhost:8777>.

**Passordet til hovedsiden er `Starveien`.**

---

## Slik spiller dere sammen

1. Én person velger **Nytt spill** og blir **spillvert**
2. De andre åpner samme nettadresse, velger **Bli med**, taster spillkoden på fire
   tegn, skriver navn og velger figur
3. Verten åpner **Storskjerm** på en TV eller PC, så alle ser brettet
4. Verten trykker **Start spillet**

Ingen trenger å være bank. Motoren regner ut alt: leie, renter, utbytte,
kursbevegelser og formue. Spillverten er bare den som starter spillet og kan rydde
opp hvis noen mister nettet — hoppe over en tur, avbryte en auksjon eller avslutte
partiet.

---

## Reglene, kort fortalt

Dette er ikke Monopol. Fire ting skiller spillet ut:

### To kast per tur
Du kaster først for **Ola Nordmann** — bankens brikke — og så for din egen figur.
Lander Ola på en tomt noen eier, betaler **banken** leia til eieren. Derfor finnes
det ingen lønn ved START: Ola *er* inntekten i spillet. Lander Ola på en ledig
tomt, går den rett på auksjon.

### Børsen henger sammen med brettet
Hver av de ti tomteseriene er et aksjeselskap med ti aksjer.

- For hver hele **20 000 kr** som kreves inn i leie på en serie, stiger kursen ett
  steg
- Må du selv betale 20 000 kr eller mer i leie, faller kursen på **alle hele
  serier du eier**

Du handler aksjer med banken i din egen tur, til den kursen som gjelder akkurat da.

### Aksjemajoritet
Eier du **8 eller flere** av de ti aksjene i et selskap, får du 50 % av all leie
som kreves inn på serien — også når det er en annen som eier tomtene. Eier du
**alle ti**, slipper du i tillegg å betale leie der selv.

### Gjeldsbrev
Du kan ta opp inntil tre lån på 50 000 kr, når som helst — også utenfor din egen
tur. Det koster 2 500 kr i rente per gjeldsbrev **hver eneste tur**, så lån
sparsomt.

### Resten av brettet
- **Feriehotellet** erstatter fengsel. Du velger selv om du vil stå over. Første
  opphold er gratis, så 10 000, 20 000 og oppover. Du kommer ut med én terning
- **Casino** — satse på sekser med én terning, ti ganger igjen
- **Trafikkfyr** — leiefritak til neste tur
- **Børsen** — kjøp inntil to aksjer fra en motspiller til dobbel kurs
- **Formuesskatt** — 10 % av kontantene
- **Prøv lykken** — 30 sjansekort

### Slutt
Partiet er over når noen når målformuen (2 000 000 kr som standard), når alle
andre er konkurs, eller når tiden er ute. Formue = kontanter + tomter + bygg +
aksjer til dagens kurs − gjeld.

Så kommer premieutdelingen: podium, konfetti og spesialpriser som Leiehaien,
Tomtebaronen og Dobbeltmesteren.

---

## Lagring i Google Regneark

Uten oppsett kjører spillet i **lokal modus** — alt ligger i nettleseren, og bare
faner på samme maskin kan spille sammen. Det holder til å prøve spillet.

For ekte flerspiller over nett trenger du et Google Regneark som database.
Oppskriften står i **[apps-script/OPPSETT.md](apps-script/OPPSETT.md)** og tar
rundt fem minutter.

Kort fortalt: lim `apps-script/Code.gs` inn i et Apps Script-prosjekt, publiser det
som nettapp, og lim adressen inn i `API_URL` i [js/config.js](js/config.js).

Regnearket får tre faner:

| Fane | Innhold |
|---|---|
| `Spill` | Én rad per parti, med hele spilltilstanden som JSON |
| `Hendelser` | Alt som skjer, rad for rad — fin å lese i ettertid |
| `Resultater` | Sluttstillinger, som mater den evige resultatlista |

---

## Legg det ut på GitHub Pages

Spillet er rene statiske filer og trenger ingen byggeprosess.

```bash
git remote add origin https://github.com/BRUKERNAVN/multimilliardaer.git
git push -u origin main
```

Gå så til **Settings → Pages** i repoet og velg `main` / `/ (root)`.
Spillet ligger etter et minutt på `https://BRUKERNAVN.github.io/multimilliardaer/`.

Husk at `js/config.js` da blir offentlig lesbar. Den inneholder adressen til
nettappen din og en kontrollsum av passordet — ikke passordet selv. Vil du holde
spillet privat, bruk et privat repo.

---

## Bytte passord

1. Åpne `verktoy/passord.html`, skriv inn det nye passordet, kopier linja
2. Lim den inn over `PASSORD_HASH` i `js/config.js`
3. Sett samme passord som skriptegenskapen `PASSORD` i Apps Script-prosjektet

Passordsperra i grensesnittet er akkurat det navnet sier: en sperre, ikke en
sikring. Den virkelige begrensningen er at Apps Script krever riktig passord for å
skrive til regnearket.

---

## Filene

```
index.html          Hovedside: passord, nytt spill, bli med, venterom
player.html         Spillerens eget display — det man har på telefonen
board.html          Storskjerm for TV eller projektor

js/config.js        Det eneste du trenger å redigere
js/data.js          Brett, serier, sjansekort, figurer
js/engine.js        Regelmotoren. Rene funksjoner, ingen DOM
js/net.js           Synkronisering mot Google Regneark, eller lokalt
js/brett.js         Tegner brettet og flytter brikkene
js/app.js           Sesjon, passordlås, hjelpetekster
js/lobby.js         Hovedsiden
js/player.js        Spillerpanelet
js/screen.js        Storskjermen
js/ceremony.js      Premieutdelingen
js/util.js          Formatering, lyd, terninger, konfetti

css/app.css         Grunnstil og komponenter
css/board.css       Brett, børstavle og premieutdeling

apps-script/Code.gs Serveren
verktoy/server.ps1  Liten testserver for lokal kjøring
verktoy/test.html   Spiller hundrevis av partier automatisk
verktoy/passord.html Lager kontrollsum for nytt passord
```

### Hvordan flere maskiner holder seg i takt

Spillet er turbasert, så det trenger ingen tung server. Klienten regner ut den nye
tilstanden selv med `engine.js` og sender den med et forventet versjonsnummer.
Apps Script tar et lås, sjekker at versjonen stemmer, og skriver bare hvis den gjør
det. Ellers får klienten fersk tilstand tilbake og regner på nytt. De andre
klientene spør om endringer hvert 1,6. sekund.

Fordi alle kjører nøyaktig samme motor, blir resultatet likt hos alle.

---

## Prøv endringer selv

Hele regelverket ligger i `js/data.js` som vanlige tall. Vil du ha et kortere eller
lengre parti, er dette knappene å skru på:

| Hva | Hvor | Standard |
|---|---|---|
| Målformue | Vertens oppsett, eller `CONFIG.STANDARD.mal` | 2 000 000 |
| Startkapital | Vertens oppsett | 150 000 (som regelboka) |
| Terskel for kursbevegelse | `MM.BORS_TERSKEL` | 20 000 |
| Startkurser | `startNiva` per serie i `MM.SERIES` | 2–5 |
| Rente per gjeldsbrev | `MM.GJELDSBREV_RENTE` | 2 500 |
| Grense for utbytte | `MM.UTBYTTE_GRENSE` | 8 aksjer |

Et tips: i et spill med to deltakere får hver av dere fem av ti aksjer i hvert
selskap, og starter derfor langt rikere enn i et spill med seks. Sett målformuen
lavere når dere er mange, og høyere når dere er to.

Etter en endring, åpne `verktoy/test.html` og trykk **Kjør 200 partier**. Den
spiller partiene automatisk og sjekker at reglene fortsatt holder — at aksjene
alltid summerer til ti per serie, at ingen får negativ beholdning, at pantsatte
tomter ikke har bygg, og at partiene faktisk blir ferdige.

---

## Lisens

MIT — se [LICENSE](LICENSE).
