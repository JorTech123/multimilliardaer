# Flytte spillet til Cloudflare

Her settes både nettsidene og serveren opp hos Cloudflare, gratis, uten at du
trenger å installere noe. Alt gjøres i nettleseren.

Hvorfor: Google Apps Script bruker rundt **1,4 sekunder før koden i det hele
tatt starter**, og et vanlig kall tar 2,3 sekunder. En Cloudflare-funksjon
svarer typisk på 20–50 ms. Spillet går fra å føles tregt for alle andre enn den
som trykker, til å føles direkte for alle.

Regn med et kvarter.

> **Du mister ingenting underveis.** Spillet sjekker ved oppstart om Cloudflare
> svarer, og bruker Google-serveren som reserve hvis ikke. Statuslampa oppe til
> høyre sier «Sky» når Cloudflare brukes og «Reserve» når den gamle brukes. Du
> kan altså gjøre stegene i ro og mak uten at noen mister et pågående spill.

---

## 1. Koble repoet til Cloudflare Pages

Gå til **https://dash.cloudflare.com** → i menyen til venstre: **Compute (Workers & Pages)**

1. **Create** → fanen **Pages** → **Connect to Git**
2. Koble GitHub-kontoen din, og velg repoet **`multimilliardaer`**
3. Byggeinnstillinger — dette er viktig, for spillet har ingen byggeprosess:

| Felt | Verdi |
|---|---|
| Framework preset | **None** |
| Build command | *(la stå tom)* |
| Build output directory | `/` |

4. **Save and Deploy**

Etter et minutt ligger spillet på en adresse som `multimilliardaer.pages.dev`.
Mappa `functions/` i repoet plukkes opp automatisk og blir til serveren på
`/api`. Den virker ikke ennå — den mangler database.

## 2. Lag databasen

I menyen til venstre: **Storage & Databases** → **D1 SQL Database**

1. **Create Database**
2. Navn: `multimillionaer`
3. **Create**

Du trenger ikke lage tabeller. Serveren lager dem selv første gang den kjører.

## 3. Koble databasen til spillet

Tilbake i **Compute (Workers & Pages)** → klikk Pages-prosjektet ditt →
**Settings** → **Bindings** → **Add binding**

| Felt | Verdi |
|---|---|
| Type | **D1 database** |
| Variable name | `DB` ← må skrives nøyaktig slik |
| D1 database | `multimillionaer` |

**Save**

## 4. Legg inn passordet

Samme sted: **Settings** → **Variables and Secrets** → **Add**

| Felt | Verdi |
|---|---|
| Type | **Secret** |
| Variable name | `PASSORD` |
| Value | `Starveien` |

**Save**

> Dette er passordet serveren krever for å skrive. Vil du bytte det, må du også
> bytte kontrollsummen i `js/config.js` — se `verktoy/passord.html`.

## 5. Distribuer på nytt

Bindinger og hemmeligheter gjelder først fra neste distribusjon.

**Deployments** → nyeste rad → **⋯** → **Retry deployment**

## 6. Sjekk at det virker

Åpne denne i nettleseren, med din egen adresse:

```
https://<prosjektet-ditt>.pages.dev/api?handling=ping
```

Du skal få:

```json
{"ok":true,"tid":"...","motor":"cloudflare"}
```

Står det `"motor":"cloudflare"` er serveren oppe. Åpner du så spillet, skal
statuslampa oppe til høyre si **Sky** og ikke **Reserve**.

---

## Når alt virker

**Rydd bort reserven.** I `js/config.js`, sett `API_RESERVE` til tom streng.
Da slutter spillet å prøve Google-serveren ved oppstart.

**Slå av GitHub Pages**, så det ikke finnes to utgaver i omløp:
repoet → Settings → Pages → Source: **None**.

**Eget domene:** Pages-prosjektet → **Custom domains** → **Set up a domain**.
Ligger domenet allerede hos Cloudflare, ordner den DNS-en selv. Ellers får du
beskjed om hvilken CNAME-post som skal settes hos domeneleverandøren.

---

## Hvis noe skurrer

**`{"feil":"Databasen er ikke koblet til..."}`**
Bindingen mangler eller heter noe annet enn `DB`. Sjekk Settings → Bindings, og
husk å distribuere på nytt etterpå.

**`{"feil":"Feil passord"}`**
Hemmeligheten `PASSORD` hos Cloudflare og passordet du taster i spillet må være
like. Kontrollsummen i `config.js` styrer bare sperra i grensesnittet.

**Lampa sier «Reserve»**
Cloudflare svarte ikke på `/api?handling=ping`. Åpne den adressen direkte og se
hva som står. Som regel er det steg 3 eller 5 som mangler.

**Siden finnes, men er tom**
Build output directory må være `/`, ikke `dist` eller `public`. Spillet ligger
i rota av repoet.

---

## Hva det koster

Ingenting, med god margin. Gratisplanen gir 100 000 forespørsler i døgnet, og
D1 gir 5 millioner leste og 100 000 skrevne rader i døgnet.

Seks spillere som poller i tre timer blir rundt 40 000 forespørsler. Du kan
altså spille to lange kvelder på én dag før det nærmer seg taket.

