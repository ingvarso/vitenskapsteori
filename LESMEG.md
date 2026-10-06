# Theory and Reality som linjenett

Interaktivt kart over teoriene og personene i Peter Godfrey-Smiths *Theory and Reality*, 2. utgave.
198 stasjoner, 20 linjer, 7 tidssoner.

## Kjøre lokalt

```
cd teorikart
python3 -m http.server 8000
```

Åpne http://localhost:8000

Rene statiske filer, ingen bygging. Eneste eksterne avhengighet er Google Fonts; uten nett faller
typografien tilbake på systemfonter og alt annet virker som før.

## Filer

| Fil | Innhold |
| --- | --- |
| `index.html` | Sidestruktur |
| `style.css` | Farger, typografi, layout |
| `data.js` | Soner, linjer, stasjoner og koblinger |
| `app.js` | Geometri, tegning og interaksjon |

## Slik leses kartet

- **Linjer** er tradisjoner. Heltrukne og stiplede linjer er likeverdige; stiplingen skiller bare
  linjer som ellers ville fått samme farge.
- **Stasjoner** er teorier, verk eller personer. Store ringer med årstall er hovedstasjoner.
- **Tynne buer** mellom linjer er påvirkning. Heltrukne buer betyr at noe bygger på noe annet,
  prikkede buer at noe står i strid med noe annet.
- **Loddrett strek** i enden av en linje betyr at tradisjonen opphører i bokens framstilling.
- **Sonene** er tidsbånd. Klikk sonenavnet øverst for en oppsummering av perioden.

Vannrett posisjon følger årstall, men stasjoner dyttes mot høyre når etiketten til naboen ellers
ville dekket dem. Rekkefølgen stemmer alltid, avstanden er omtrentlig. De seks største
forskyvningene er i klyngen rundt Kuhn 1962 og i perioden 1860 til 1880.

## Redigere innholdet

Alt innhold ligger i `data.js`. En stasjon ser slik ut:

```js
{ id:"structure", line:"hist", year:1962, name:"Kuhns Structure", ch:5, kind:"major",
  desc:"..." }
```

`line` viser til en `id` i `LINES`. `kind` kan være `major`, `start`, `end` eller utelates.
`ch` er kapittelnummer i boken. Koblinger legges i `LINKS` med `kind` satt til
`bygger`, `strid` eller `avlegger`.

Nye linjer trenger en ledig `lane` (0 og oppover) og en farge. Kartets høyde følger antall linjer
automatisk.
