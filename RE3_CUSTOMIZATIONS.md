# RE3-Anpassungen: Leitfaden für Upgrades und neue Änderungen

Dieses Dokument beantwortet: **Was haben wir an RAGFlow angepasst, was davon
überlebt ein Upgrade von selbst, was muss nachgezogen werden — und woran
merken wir, dass etwas kaputtging?**

## Die drei Schichten (und ihre Upgrade-Festigkeit)

| Schicht | Was | Upgrade-Verhalten |
|---|---|---|
| 1. Optionen | `docker/branding/branding.toml` (gemountet über `web/dist/branding.toml`) | **Überlebt jedes Upgrade unverändert.** Wird zur Laufzeit geladen; kein Rebuild, kein Merge. |
| 2. Frontend-Quellcode | Branding-Modul, Rollen-Hook, gepatchte Komponenten (Tabelle unten) | **Muss per Cherry-pick auf den neuen Versions-Branch.** Konfliktrisiko dort, wo Upstream dieselben Dateien umbaut. |
| 3. Deployment | `docker/docker-compose-macos.yml` (Mounts), `docker/.env` (`REGISTER_ENABLED=0`, Image-Tag, ES-Heap) | Cherry-pick wie Schicht 2; Konflikte selten. |

**Grundregel für alles Neue:** Immer erst prüfen, ob es sich als Option in
`branding.toml` (Schicht 1) abbilden lässt — das ist die einzige Schicht ohne
Upgrade-Kosten. Quellcode nur anfassen, wenn es nicht anders geht, und dann
ausschließlich über die zentralen Module (`src/branding/`,
`src/hooks/use-nav-visibility.ts`), nie verstreut.

## ⚠️ Wichtig: Das GitHub-Image enthält unsere UI-Änderungen NICHT

Der Actions-Workflow (`.github/workflows/build-arm64.yml`) baut das Docker-
Image aus **Upstream-RAGFlow** (nur mit ARM64-Dockerfile-Patches). Unsere
Frontend-Anpassungen wirken lokal nur, weil `docker-compose-macos.yml` das
selbstgebaute `../web/dist` über das Image mountet:

```
- ../web/dist:/ragflow/web/dist            # Host-Build ersetzt Image-Frontend
- ./branding/branding.toml:/ragflow/web/dist/branding.toml:ro
- ./branding/assets:/ragflow/web/dist/branding:ro
```

Nach jedem `git pull`/Cherry-pick auf dem Mac also: `cd web && npm run build`.
**Für den VPS (Phase 1)** heißt das: entweder den Workflow auf unseren Branch
umstellen (baut dann unser Frontend ins Image) oder `web/dist` mit deployen.

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
| `src/hooks/use-nav-visibility.ts` | Rollen-Whitelist-Hook (`isNavItemVisible`, `isSettingItemVisible`) |
| `src/layouts/components/global-navbar.tsx` | Navbar gefiltert für Nicht-Superuser; Logo aus Branding |
| `src/layouts/components/header.tsx` | Discord/GitHub-Icons nur wenn `brand.links.*` gesetzt (beide Blöcke: sichtbar + Mess-Block!) |
| `src/pages/home/index.tsx` + `applications.tsx` | Home-Sektionen/App-Tabs gefiltert; Nicht-Superuser bekommen die Prototyp-Startseite |
| `src/pages/home/prototype-home.tsx` | Testkunden-Home, rendert das mountbare `/branding/home.md` (Inhalte ohne Rebuild änderbar) |
| `src/pages/user-setting/sidebar/index.tsx` | Profil-Sidebar gefiltert (`userSettingItems`) |
| `src/pages/user-setting/setting-team/index.tsx` | „Invite member" nur für Superuser |
| `src/routes.tsx` | Default-Route von `/user-setting` = Profile (Upstream: Data sources) |
| `src/pages/login-next/index.tsx` | Login: Logo/Name aus Branding |
| weitere Logo-Stellen | Admin-Login, Chat-Avatare, `embed-container.tsx` (siehe `git show` des Branding-Commits) |
| `package.json` | Dependency `smol-toml`, Script `check:re3` |

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

Build-/Infra-Teil: siehe `MACOS_ARM64_BUILD_GUIDE.md`. Für die Anpassungen:

1. Neuen Branch vom Upstream-Tag: `git checkout -b macos-arm64-vX.Y.Z vX.Y.Z`
2. Beide Commit-Sets cherry-picken (ARM64-Build-Set + RE3-Set; die Commits
   auf dem Vorgänger-Branch mit `git log` identifizieren)
3. Konflikte lösen — erfahrungsgemäß am ehesten in `header.tsx`,
   `global-navbar.tsx` und den Home-/Login-Seiten, wenn Upstream sie
   redesignt hat
4. `cd web && npm install && npm run check:re3` → jeden roten Anker anhand
   der Tabelle oben neu verankern
5. Jest-Tests (Befehl oben) + Leak-Grep
6. `npm run build`, Stack neu starten, Smoke-Test: Login-Seite (Logo,
   Tagline, kein Sign-up), als Testkunde einloggen (nur Home/Chat/Search,
   Profil nur Team+Profile, kein Invite-Button)
7. Push → CI-Check `re3-checks` muss grün sein

## Checkliste für NEUE UI-Anpassungen

- [ ] Geht es als `branding.toml`-Option? Dann dort (Schicht 1), fertig.
- [ ] Sonst: über `getBranding()` bzw. `useNavItemVisibility()` anbinden,
      keine neuen Parallel-Mechanismen
- [ ] Anker in `web/scripts/check-re3-customizations.mjs` ergänzen
- [ ] Touchpoint-Tabelle hier ergänzen
- [ ] Test ergänzen, wenn es Verhalten hat (Rollen-Filter o. ä.)
- [ ] `BRANDING.md` (Schema-Tabelle) aktuell halten
