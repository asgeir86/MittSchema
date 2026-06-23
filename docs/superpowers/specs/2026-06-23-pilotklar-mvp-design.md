# MittSchema — Pilotklar MVP (design/spec)

**Datum:** 2026-06-23
**Status:** Godkänd design, redo för implementationsplan
**Mål:** Ta MittSchema från en-enhets-demo (rollväxel + localStorage) till en **pilotklar MVP** — en
fungerande tvåsidig produkt där klient och handläggare loggar in var för sig, på varsin enhet, mot en
gemensam server. Detta är "Nivå 1". Myndighetsklar drift (säkerhetsklassning, upphandling, WCAG) är
"Nivå 2" och ligger utanför denna spec.

## Bakgrund

Nuvarande tillstånd: ren vanilla-JS PWA. Roll (klient/handläggare) växlas med en knapp ("Visar som"),
all data ligger i `localStorage` på en enhet, flera klienter hanteras via en v3-lagringsmodell. Demon
visar idén men är inte en produkt: det går inte att logga in var för sig, data delas inte mellan enheter,
och rollväxeln är ingen riktig separation.

Kärnbeslut (fastställda under brainstorming 2026-06-23):
- **Målnivå:** Pilotklar MVP.
- **Plattform:** PWA för båda parter (klient på iPhone *eller* Android via PWA; handläggare i webbläsare
  på dator). En kodbas, ingen native app-store-distribution i pilotskedet.
- **Inloggning:** handläggaren provisionerar konton (ingen publik registrering).
- **Backend:** ASP.NET Core Web API + PostgreSQL, hostat i EU-region.

## Princip

Behåll hela den befintliga frontenden. Byt ut `MS.Storage` (localStorage) mot ett API-lager, lägg till en
inloggningsskärm, och låt serverns autentiserade roll avgöra vilken sida (klient/handläggare) som renderas.
Separationen mellan parterna sker vid **login**, inte med en knapp — efter inloggning ser man bara sin egen
sida.

## Arkitektur

- **Frontend (PWA, befintlig kodbas):** samma app för båda roller. Efter login renderas antingen klient-
  eller handläggar-UI utifrån rollen från servern. Demo-rollväxeln ("Visar som") tas bort.
- **Backend (ASP.NET Core Web API):** autentisering, dataåtkomst, affärslogik, notis-schemaläggare.
- **Databas (PostgreSQL):** användare, scheman, förslag, audit, push-prenumerationer.
- **Schemalogiken (`js/schedule.js`)** stannar i frontend för **visning** (ute/inne-beräkning, nästa
  ändring, tidslinjer). Servern är källa för **datan**; klienten beräknar status från hämtad data med
  samma deterministiska logik som redan är regressionstestad. För visning och request-validering
  dupliceras logiken inte på servern — servern validerar bara att inskickad data är välformad (se
  Affärsregler). **Undantag:** notis-schemaläggaren (Fas 4) behöver beräkna varje klients nästa ute/inne-
  övergång server-side; den delen av logiken portas till backend och är en uttalad kostnad i Fas 4.

## Inloggning & roller

- **ASP.NET Core Identity**, två roller: `Handlaggare`, `Klient`.
- **Provisionering:**
  - En handläggare seedas vid uppsättning av pilot.
  - Handläggaren skapar klientkonton i sin caseload → systemet genererar en **engångskod/temporärt
    lösenord** → handläggaren delar koden med klienten → klienten loggar in första gången och sätter ett
    eget lösenord.
- **Sessionshantering:** httpOnly-cookie (säkrare mot XSS än token i JS-åtkomlig storage). Same-site.
- **Auktorisering / dataisolering (kritiskt, enhetstestas):**
  - En klient kan läsa/agera **endast på sitt eget** schema och sina egna förslag.
  - En handläggare kan läsa/agera **endast på klienter i sin egen caseload**.
  - Varje endpoint kontrollerar ägarskap server-side; klient-id från request får aldrig lita på utan
    auktoriseringskoll.

## Datamodell (PostgreSQL)

- `users` — `id`, `login` (användarnamn eller e-post), `password_hash`, `role`, `display_name`,
  `created_at`, `must_change_password` (för förstagångsinlogg).
- `client_profiles` — `user_id` (FK→users), `handlaggare_id` (FK→users), `name`.
- `schedules` — `client_user_id` (FK), `data` (**JSONB**: `weekly`, `weeks`, `overrides`, `permissions`,
  `weekNames`, `rotationAnchorMonday`), `updated_at`. JSONB återanvänder exakt nuvarande schema-objekt och
  minimerar frontend-ändringar.
- `requests` — `id`, `client_user_id` (FK), `type` (`change`|`permission`), `status`
  (`pending`|`approved`|`denied`), `payload` (JSONB: datum/fönster eller från/till), `note`, `created_at`,
  `decided_at`, `decided_by` (FK→users). Egen tabell eftersom den filtreras (pending, per månad).
- `audit_log` — `id`, `client_user_id` (FK), `actor_user_id` (FK), `role`, `action`, `detail`, `ts`.
- `push_subscriptions` — `id`, `user_id` (FK), `endpoint`, `p256dh`, `auth`.

**Varför JSONB för schema men tabeller för requests/audit:** schemastrukturen läses/skrivs alltid i sin
helhet av en klient och har redan en rik form i frontend — JSONB ger noll friktion. Förslag och audit är
tvärgående arbetsflödesdata som filtreras och sorteras → relationsrader passar bättre.

## API (skiss)

Alla endpoints kräver autentisering och auktoriseras mot roll + ägarskap.

- **Auth:** `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/change-password`.
- **Klient:** `GET /api/me/schedule`, `GET /api/me/requests`, `POST /api/me/requests` (skicka
  ändringsförslag / permissionsansökan), `POST /api/me/push-subscription`.
- **Handläggare:** `GET /api/clients` (caseload + status-sammanfattning), `POST /api/clients` (skapa
  klient → returnerar engångskod), `GET /api/clients/{id}/schedule`, `PUT /api/clients/{id}/schedule`,
  `GET /api/clients/{id}/requests`, `POST /api/clients/{id}/requests/{rid}/approve`,
  `POST /api/clients/{id}/requests/{rid}/deny`, `GET /api/clients/{id}/audit`.

## Affärsregler (server-validerade)

- **72h-gräns:** en permission får vara högst 72 timmar (matchar nuvarande klient-validering). Valideras
  även server-side.
- **Godkänt förslag slår igenom i schemat:** vid approve tillämpar servern förslaget på `schedules.data`
  (motsvarar dagens `applyRequest`) och loggar i `audit_log`.
- **Inmatningsvalidering:** sluttid efter starttid, välformade fönster, giltiga datum.

## Sync & notiser

- **Ingen realtid/websockets** (YAGNI). Klienten hämtar schemat vid appstart, vid `visibilitychange`, och
  med ett periodiskt intervall (förslag: var 5:e minut), och beräknar status lokalt.
- **Web Push** för det som ger värdet:
  1. Klient: "inne om 15 min" (och övriga övergångar enligt valbar förvarning).
  2. Handläggare: "nytt förslag inkommet".
  3. Klient: "förslag godkänt/avslaget".
- **Server-side schemaläggare** (ASP.NET Core `BackgroundService`): kör periodiskt, beräknar varje klients
  nästa ute/inne-övergång (samma logik som frontend, porterad eller delad), och skickar push i rätt tid.
  Detta är en egen, något tyngre fas men kärnan i produktlöftet "se direkt vad som gäller".

## Frontend-omkoppling

- **Login-skärm** före appen laddas.
- **`MS.Storage` blir ett API-lager:** `load()/save()` byts mot `fetch`-anrop mot API:t. Övriga vyer
  (`today`, `week`, `schedule`, `requests`, `clients`) ändras minimalt — de arbetar fortfarande mot ett
  schema-objekt med samma form.
- **Roll från servern, inte en knapp:** rollväxeln/"Visar som"-baren tas bort. Efter login renderas bara
  den inloggade rollens nav + vyer. Detta uppfyller kravet "logga in på varsitt, inte slida en bar".

## Dina UX-punkter (inbyggda i MVP:n)

- **Vecka-tider (exakta):** skriv ut start/slut i klartext per ute-pass i vecko-raderna (t.ex.
  "08:50–16:00"). Staplar kan aldrig förmedla 08:50 vs 09:10 — texten är det som ger funktionen.
- **Swipe mellan rutor:** touch-gest (vänster/höger) som byter vy inom den inloggade rollens flikar.
- **Roll-medvetet ordval:** handläggarens dagvy säger "Klienten får vara ute / måste vara inne", klientens
  säger "Du …". Faller ut av roll-medveten rendering (samma `today`-vy, olika subjekt).

## Säkerhet (pilot-nivå)

HTTPS överallt, hashade lösenord (Identity), dataisolering per användare (enhetstestad), EU-region-hosting,
audit-logg bevaras. **Ej** i denna nivå: säkerhetsklassning, penetrationstest, WCAG-revision, formella
driftavtal — det är Nivå 2.

## YAGNI — medvetet bortskjutet

- Backup export/import (servern ersätter behovet).
- BankID / extern identitet.
- Admin- och organisationshierarki (flera handläggare under chef etc.).
- Offline-**redigering**/konfliktlösning. Offline-**visning** behålls via PWA-cache (sista hämtade schemat).

## Testning

- **Frontend:** behåll och utöka det deterministiska regressionstestet för `schedule.js`
  (`tests/schedule.test.js`).
- **Backend:** enhetstester för auktorisering/dataisolering (högsta prioritet — får aldrig läcka mellan
  klienter/handläggare), förslagsflödet (submit→approve→schema uppdateras + audit), 72h-validering, och
  nästa-övergång-beräkningen som notiserna bygger på.
- **Integration:** API-endpoint-tester (auth + happy path + auktoriseringsavslag).

## Faser & tidsuppskattning

| Fas | Innehåll | Est. |
|---|---|---|
| 1 | Backend-grund: projekt, DB-schema, auth (handläggar-provisionerad), roll/användarmodell, dataisolering | ~1,5–2,5 v |
| 2 | Kärn-API: schema-CRUD, förslagsflöde (submit/approve/deny + applyRequest server-side), audit, caseload | ~1,5–2,5 v |
| 3 | Frontend-omkoppling: login-skärm, `MS.Storage`→API, roll-gated UI, ta bort rollväxeln | ~1,5–2 v |
| 4 | Notiser: web push + server-schemaläggare ("inne om 15 min" + förslagsaviseringar) | ~0,5–1,5 v |
| 5 | UX-polish (vecka-tider, swipe, ordval), hosting/deploy, säkerhetspass, tester | ~1–2 v |

→ **~6–10 veckor fokuserat soloarbete** (med AI-acceleration). Kalendertid beror på antal timmar/vecka.

## Avgränsning mot Nivå 2 (ej i denna spec)

Säkerhetsklassning, pen-test, WCAG-tillgänglighet, formella drift-/supportavtal, och **upphandling (LOU)** —
myndigheter köper sällan från en pitch utan upphandlar. Detta är ett separat, mestadels icke-tekniskt spår
som bygger vidare på en färdig MVP.
