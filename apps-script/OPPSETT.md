# Koble spillet til Google Regneark

Uten dette oppsettet kjører Multimilliardær i **lokal modus**: alt lagres i
nettleseren, og bare faner på samme maskin kan spille sammen. Det holder fint for
å prøve spillet.

Vil dere spille fra hver deres telefon, trenger dere et sted å lagre
spilltilstanden. Her bruker vi et Google Regneark, med Apps Script som server.
Det er gratis, og dataene blir liggende på din egen Google-konto.

Regn med fem minutter.

---

## 1. Lag regnearket

Gå til <https://sheets.new> og lag et nytt, tomt regneark.
Kall det for eksempel **Multimilliardær**.

## 2. Åpne Apps Script

I regnearket: **Utvidelser → Apps Script**.

Et nytt faneblad åpner seg med en fil som heter `Code.gs` og litt kode i.
Marker alt som står der og slett det.

## 3. Lim inn serveren

Åpne [Code.gs](Code.gs) fra dette prosjektet, kopier hele innholdet, og lim det
inn i Apps Script.

Trykk lagre (diskett-ikonet, eller Ctrl+S).

## 4. Kjør klargjøringen én gang

Velg funksjonen `klargjor` i nedtrekkslista øverst, og trykk **Kjør**.

Første gang ber Google om tillatelse:

1. **Gå gjennom tillatelser**
2. Velg Google-kontoen din
3. Google advarer om at appen ikke er verifisert. Dette er ditt eget skript, på
   din egen konto. Trykk **Avansert**, så **Gå til Multimilliardær (usikker)**
4. **Tillat**

Skriptet lager de tre fanene `Spill`, `Hendelser` og `Resultater` i regnearket, og
setter passordet til `Starveien`.

## 5. Publiser som nettapp

**Distribuer → Ny distribusjon**.

- Trykk tannhjulet ved siden av «Velg type», og velg **Nettapp**
- **Beskrivelse:** hva du vil, for eksempel `Multimilliardær v1`
- **Kjør som:** `Meg`
- **Hvem har tilgang:** `Alle`

> `Alle` høres mer åpent ut enn det er. Uten riktig passord blir alle skrivinger
> avvist av serveren. Innstillingen er nødvendig for at vennene dine skal få lov
> til å koble seg til i det hele tatt.

Trykk **Distribuer**, og kopier **nettapp-URL-en**. Den ser slik ut:

```
https://script.google.com/macros/s/AKfycbx..................../exec
```

## 6. Lim adressen inn i spillet

Åpne [../js/config.js](../js/config.js) og sett den inn:

```js
API_URL: 'https://script.google.com/macros/s/AKfycbx..................../exec',
```

Ferdig. Last spillet på nytt — merket oppe til høyre skal nå si **Sky** i stedet
for **Lokal**.

---

## Bytte passord

Standardpassordet er `Starveien`. Vil du ha et annet, må det settes to steder:

**I Apps Script:** Prosjektinnstillinger (tannhjulet i venstremargen) →
Skriptegenskaper → rediger `PASSORD`.

**I spillet:** åpne `verktoy/passord.html`, skriv inn det nye passordet, kopier
linja, og lim den inn over `PASSORD_HASH` i `js/config.js`.

---

## Når du endrer serveren senere

Apps Script oppdaterer ikke den publiserte nettappen automatisk når du lagrer.
Du må gå **Distribuer → Administrer distribusjoner**, trykke blyanten, velge
**Ny versjon** under «Versjon», og trykke **Distribuer**.

URL-en holder seg den samme.

---

## Hvis noe skurrer

**«Uventet svar fra serveren»**
Nettappen er sannsynligvis ikke publisert med tilgang `Alle`, eller du har limt inn
redigerings-URL-en i stedet for nettapp-URL-en. Den riktige slutter på `/exec`.

**«Feil passord»**
Skriptegenskapen `PASSORD` i Apps Script og passordet du taster i spillet må være
identiske. `PASSORD_HASH` i `config.js` styrer bare sperra i grensesnittet.

**«Noen andre kom deg i forkjøpet»**
To spillere skrev samtidig. Spillet prøver på nytt av seg selv, og du ser dette
bare hvis det feiler fem ganger på rad. Sjekk nettet.

**Trege svar**
Apps Script bruker ett til to sekunder på hver forespørsel. Det er normalt og
merkes lite, siden spillet er turbasert.

**Regnearket vokser**
Spill som ikke er rørt på to uker ryddes bort automatisk når noen lager et nytt
spill. `Hendelser` og `Resultater` vokser videre — tøm dem selv når du vil.

---

## Hva lagres hvor

| Fane | Én rad er | Nyttig til |
|---|---|---|
| `Spill` | Ett parti, med hele tilstanden som JSON i siste kolonne | Gjenoppta et parti |
| `Hendelser` | Én ting som skjedde: terningkast, leie, kjøp, konkurs | Lese gjennom partiet etterpå |
| `Resultater` | Én spillers sluttplassering | Den evige resultatlista i spillet |

`Hendelser` er grei å lage pivottabeller av, om dere vil finne ut hvem som faktisk
er heldigst med terningen.
