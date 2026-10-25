# RE3-Anpassungen: Leitfaden für Upgrades und neue Änderungen

Dieses Dokument beantwortet: **Was haben wir an RAGFlow angepasst, was davon
überlebt ein Upgrade von selbst, was muss nachgezogen werden — und woran
merken wir, dass etwas kaputtging?**

## Die drei Schichten (und ihre Upgrade-Festigkeit)

| Schicht | Was | Upgrade-Verhalten |
|---|---|---|
| 1. Optionen | `docker/branding/branding.toml` (gemountet über `web/dist/branding.toml`) | **Überlebt jedes Upgrade unverändert.** Wird zur Laufzeit geladen; kein Rebuild, kein Merge. |
| 2. Quellcode | Frontend: Branding-Modul, Rollen-Hook, gepatchte Komponenten. Backend: Go-Berechtigungs-Patch (Tabellen unten) | **Muss per Cherry-pick auf den neuen Versions-Branch.** Konfliktrisiko dort, wo Upstream dieselben Dateien umbaut. |
| 3. Deployment | `docker/docker-compose.re3.yml` (Override auf Upstream-`docker-compose.yml`), `docker/.env` (`COMPOSE_FILE`, `REGISTER_ENABLED=0`, Image-Tag, ES-Heap, MySQL-Port, TZ) | Override-Datei ist rein unsere → kein Konflikt; `.env` von Hand nachziehen. |

**Grundregel für alles Neue:** Immer erst prüfen, ob es sich als Option in
`branding.toml` (Schicht 1) abbilden lässt — das ist die einzige Schicht ohne
Upgrade-Kosten. Quellcode nur anfassen, wenn es nicht anders geht, und dann
ausschließlich über die zentralen Module (`src/branding/`,
`src/hooks/use-nav-visibility.ts`), nie verstreut.

## Image: wird aus unserem Branch gebaut

Seit v1.0 baut Upstream arm64 selbst; ARM64-Patches entfallen. Der Workflow
`.github/workflows/build-arm64.yml` baut das **unveränderte Upstream-
Dockerfile aus unserem Branch** → das Image enthält RE3-Frontend **und**
Go-Backend-Patch. Kein `web/dist`-Mount mehr nötig.

```bash
gh workflow run build-arm64.yml --ref macos-arm64-vX.Y.Z -f tag=vX.Y.Z-re3
# ~35 min; dann in docker/.env: RAGFLOW_IMAGE=ghcr.io/rafo/ragflow:vX.Y.Z-re3
cd docker && docker-compose pull ragflow-cpu && docker-compose up -d --remove-orphans
```

Zur lokalen Frontend-Iteration ohne Image-Build: `cd web && npm run build`
und den auskommentierten `web/dist`-Mount in `docker-compose.re3.yml`
aktivieren. Backend-Änderungen gehen nur über einen neuen Image-Build.

## Touchpoints in `web/` (Schicht 2)

Alle Quellcode-Anpassungen stecken im Commit-Set „RE3 white-label branding"
(ab `cb2e07bc2`, seither erweitert). Die Anker:

| Datei | Zweck |
|---|---|
| `src/branding/index.ts` | Zentrales Modul: lädt `branding.toml`, `getBranding()`-Singleton, Defaults inkl. `userNavItems`/`userSettingItems` |
| `src/branding/i18n-brand-post-processor.ts` | Ersetzt „RAGFlow"→appName zur Laufzeit in allen 16 Sprachen |
| `src/main.tsx` | `loadBranding()` **vor** dem React-Render |
| `src/locales/config.ts` | Registriert den Post-Processor bei i18next |
| `index.html` | Favicon/Titel-Bootstrap |
| `src/hooks/use-nav-visibility.ts` | Rollen-Whitelist-Hook (`hasFullAccess` aus `fullAccessEmails`, `isNavItemVisible`, `isSettingItemVisible`). **Nicht** `is_superuser`: Superuser sind seit v1.0 reine Admin-Konten und bekommen in der App 403 |
| `src/layouts/components/global-navbar.tsx` | Navbar gefiltert für Tester; Logo aus Branding |
| `src/layouts/components/header.tsx` | Discord/GitHub-Icons nur wenn `brand.links.*` gesetzt (beide Blöcke: sichtbar + Mess-Block!) |
| `src/pages/home/index.tsx` + `applications.tsx` | Home-Sektionen/App-Tabs gefiltert; Tester bekommen die Prototyp-Startseite |
| `src/pages/home/prototype-home.tsx` | Testkunden-Home, rendert das mountbare `/branding/home.md` (Inhalte ohne Rebuild änderbar) |
| `src/pages/user-setting/sidebar/index.tsx` | Profil-Sidebar gefiltert (`userSettingItems`) |
| `src/pages/user-setting/setting-team/index.tsx` | „Invite member" nur für `fullAccessEmails`-Konten |
| `src/routes.tsx` | Default-Route von `/user-setting` = Profile (Upstream: Data sources) |
| `src/pages/login-next/index.tsx` | Login: Logo/Name aus Branding |
| weitere Logo-Stellen | Admin-Login, Chat-Avatare, `embed-container.tsx` (siehe `git show` des Branding-Commits) |
| `package.json` | Dependency `smol-toml`, Script `check:re3` |

## Backend-Patch: Team-Sharing für Chats und Searches (Schicht 2b)

Upstream macht Chat-Assistenten und Search-Apps **owner-only**. Für den
Prototyp müssen Testkunden den geteilten „RE3 Test"-Chat und „RE3 Search"
nutzen. Seit v1.0 ist das Backend Go mit zentraler Berechtigungsschicht;
der Patch sitzt deshalb fast komplett an einer Stelle (`// RE3:`-Marker):

| Datei | Änderung |
|---|---|
| `internal/permission/database_source.go` | `chatResource`/`searchAppResource`: Sichtbarkeit `Tenant` statt `Private`; Team-Mitglieder dürfen lesen/nutzen (Chat: auch eigene Sessions anlegen), Ändern/Löschen bleibt beim Owner. `ListResourceRefs`: Listen enthalten Chats/Searches aller Tenants des Users. `chatSessionResource`: fremde Sessions für Mitglieder unsichtbar (Upstream: lesbar) — der Owner sieht alle. |
| `internal/service/search.go` | `PrepareCompletion` läuft unter dem **App-Owner-Tenant** (Modell-Auflösung: Chat/Embedding/Rerank sind tenant-gebunden konfiguriert). |
| `internal/permission/database_source_test.go`, `internal/service/{chat_list,search}_test.go` | Upstream-Tests auf RE3-Verhalten umgestellt — sie sind jetzt der Wächter. |

Prüfen: `CGO_ENABLED=0 go test ./internal/permission/ && CGO_ENABLED=0 go test ./internal/service/ -run 'Search|ChatServiceList'`
(lokal ohne Go z. B. im `golang`-Container; CI-Job `re3-backend`).

**Zugehörige Daten-Voraussetzungen** (einmalig gesetzt 18.07., DB):
Test-Accounts als `normal`-Mitglieder in Rafaels Tenant (`user_tenant`),
Datasets auf `permission='team'`.

## Warnsystem: merkt, wenn ein Upgrade etwas zerlegt

1. **Anker-Check** — prüft, dass jeder Touchpoint noch verdrahtet ist:
   ```bash
   cd web && npm run check:re3
   ```
   Schlägt mit klarer Meldung fehl („Datei X: Anker Y fehlt — Zweck Z"),
   wenn ein Upstream-Refactor eine Integration entfernt/verschoben hat.
2. **Jest-Tests** — prüfen das Verhalten (Defaults, Ersetzungslogik,
   Rollen-Filter):
   ```bash
   cd web && npx jest src/branding src/hooks/__tests__/use-nav-visibility.test.tsx --no-coverage
   ```
3. **CI** — `.github/workflows/re3-checks.yml` führt beides bei jedem Push
   auf `macos-arm64-*`-Branches aus. Ein roter Check nach dem Upgrade-Push
   = Anpassung verloren gegangen.
4. **Leak-Grep** — findet NEUE Branding-Leaks, die Upstream eingebaut hat
   (der Anker-Check kennt nur unsere bestehenden Stellen):
   ```bash
   grep -rn "logo.svg\|RAGFlow" web/src --include="*.tsx" | grep -v getBranding | grep -v RAGFlowAvatar
   ```

## Ablauf beim RAGFlow-Upgrade (Kurzform)

0. Backup: Stack stoppen, `mysql_data` + `esdata01` sichern (siehe
   `docker/migration.sh` bzw. `backups/`)
1. Neuen Branch vom Upstream-Tag: `git checkout -b macos-arm64-vX.Y.Z vX.Y.Z`
2. RE3-Commits cherry-picken (auf dem Vorgänger-Branch mit
   `git log vVORHER..macos-arm64-vVORHER` identifizieren); `docker/.env`
   nicht mergen, sondern Upstream-Datei nehmen und die RE3-Werte (siehe
   Schicht 3) von Hand eintragen
3. Konflikte lösen — erfahrungsgemäß am ehesten in `header.tsx`,
   `global-navbar.tsx` und den Home-/Login-Seiten, wenn Upstream sie
   redesignt hat
4. `cd web && npm install && npm run check:re3` → jeden roten Anker anhand
   der Tabellen oben neu verankern
5. Jest-Tests (Befehl oben), Go-Tests (Backend-Abschnitt) + Leak-Grep
6. Push, Image bauen (Abschnitt „Image“), Stack neu starten, Smoke-Test: Login-Seite (Logo,
   Tagline, kein Sign-up), als Testkunde einloggen (nur Home/Chat/Search,
   Profil nur Team+Profile, kein Invite-Button, „RE3 Test“-Chat und
   „RE3 Search“ sichtbar und nutzbar, nur eigene Sessions)
7. Push → CI-Check `re3-checks` muss grün sein

## Checkliste für NEUE UI-Anpassungen

- [ ] Geht es als `branding.toml`-Option? Dann dort (Schicht 1), fertig.
- [ ] Sonst: über `getBranding()` bzw. `useNavItemVisibility()` anbinden,
      keine neuen Parallel-Mechanismen
- [ ] Anker in `web/scripts/check-re3-customizations.mjs` ergänzen
- [ ] Touchpoint-Tabelle hier ergänzen
- [ ] Test ergänzen, wenn es Verhalten hat (Rollen-Filter o. ä.)
- [ ] `BRANDING.md` (Schema-Tabelle) aktuell halten
