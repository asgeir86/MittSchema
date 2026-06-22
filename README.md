# MittSchema

En liten app som visar ditt schema med fotboja: **grönt = du får vara ute, rött = du måste vara inne.**
Öppna telefonen och se direkt vad som gäller just nu, och vad som händer härnäst.

Byggd som en **PWA** (webb-app som kan sparas på hemskärmen och fungera offline). Allt sparas
**lokalt på din enhet** – ingen server, inget konto, ingen data lämnar telefonen.

## Status (v1, steg 1)

Klart:
- **Idag-vy**: stor grön/röd status med klockslag och nedräkning till nästa ändring.
- **Dagens tidslinje** (00–24) med gröna ute-block och en markör för "nu".
- **Ute-tider idag** som lista med etiketter.
- **Permission-summering** för månaden (av 4 tillfällen / 72 tim).
- Offline + sparbar på hemskärmen.

Nytt i detta steg:
- **Schema-vy**: redigera veckoschema (tider + etiketter), avvikelser per dag, och permission.
- **Vecka-vy**: överblick 3 veckor framåt med grön/röd mini-tidslinje per dag.
- Navigering mellan Idag / Schema / Vecka.

Kommer senare:
- Påminnelser/notiser ("inne om 15 min").
- Den tvåsidiga versionen (handläggare + klient) som Kriminalvården skulle kunna köpa.

> Appen startar med ett **exempelschema** – öppna **Schema** och ändra till dina egna tider
> (eller "Återställ exempelschema" för att börja om).

## Köra lokalt

En PWA behöver serveras över http (inte öppnas som fil) för att service worker/installation ska funka.

**Snabbast (Python finns på datorn):**
```powershell
cd C:\Users\User\MittSchema
python -m http.server 8000
```
Öppna sedan http://localhost:8000 i webbläsaren.

**Alternativt (Node):**
```powershell
cd C:\Users\User\MittSchema
npx serve -l 8000
```

> Vill du bara snabbtitta på utseendet kan du dubbelklicka `index.html` – men då laddas inte
> service worker/offline (det kräver en server).

## Testa på iPhone

1. Kör servern på datorn (se ovan) och ta reda på datorns IP (`ipconfig` → IPv4-adress).
2. På iPhone (samma wifi): öppna `http://<datorns-ip>:8000` i Safari.
3. Dela-knappen → **Lägg till på hemskärmen**.

> Obs: full offline-PWA på iPhone kräver **https**. För det lägger vi senare upp appen på en
> gratis statisk värd (t.ex. GitHub Pages / Netlify). Över wifi-http fungerar appen som vanlig sida
> och kan läggas på hemskärmen, men offline-cachen aktiveras först på https.

## Filer

| Fil | Roll |
|-----|------|
| `index.html` | App-skal och struktur |
| `styles.css` | Utseende (mörkt tema, mobil-först) |
| `js/schedule.js` | Ren schemalogik (ute/inne, nästa ändring, veckonr) – deterministisk, testbar |
| `js/storage.js` | Laddar/sparar schema i localStorage + exempelschema |
| `js/app.js` | Bootstrap + vy-router + delade UI-hjälpare |
| `js/views/today.js` | Idag-vyn |
| `js/views/schedule.js` | Schema-vyn (redigering) |
| `js/views/week.js` | Vecka-vyn |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA (hemskärm + offline) |

## Datamodell

```jsonc
{
  "version": 1,
  "weekly":   { "1": [ { "start": "07:00", "end": "16:00", "label": "Arbete" } ] }, // 1=mån .. 7=sön
  "overrides":{ "2026-06-20": [ { "start": "09:00", "end": "10:00", "label": "Läkarbesök" } ] },
  "permissions": [ { "start": "2026-06-27T18:00", "end": "2026-06-30T18:00", "label": "Permission" } ]
}
```

### Tester
Den deterministiska schemalogiken (`js/schedule.js`) har ett fristående regressionstest:
```powershell
node tests/schedule.test.js
```
Bland fallen: permission som löper över midnatt ska fortsätta visa "ute" och peka på permissionens
verkliga slut (inte felaktigt flagga "inne" vid 00:00).
