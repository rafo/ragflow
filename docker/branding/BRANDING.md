# White-Label Branding

Das komplette UI-Branding (Produktname, Logo, Links, Farben) wird über eine
einzige Datei gesteuert: `branding.toml`. Sie wird beim App-Start vom Browser
geladen (`GET /branding.toml`). Eine Umbenennung des Produkts ist damit ein
Config-Edit — kein Rebuild.

## Ebenen

1. **Im Image gebacken (Default):** `web/public/branding.toml` +
   `web/public/branding/logo.png` landen beim Frontend-Build in `web/dist/`.
2. **Pro Deployment (Override, empfohlen für Kunden-Instanzen):** dieses
   Verzeichnis per Volume über die gebauten Dateien mounten:

   ```yaml
   volumes:
     - ./branding/branding.toml:/ragflow/web/dist/branding.toml:ro
     - ./branding/assets:/ragflow/web/dist/branding:ro
   ```

   Danach genügt ein Hard-Refresh im Browser (die Datei wird mit
   `cache: no-cache` geladen); ein Container-Neustart ist nicht nötig.

## Schema (`branding.toml`)

| Schlüssel | Bedeutung |
|---|---|
| `appName` | Produktname; ersetzt auch "RAGFlow" in allen UI-Übersetzungen |
| `pageTitle` | Browser-Tab-Titel |
| `faviconUrl` | Pfad zum Favicon (relativ zum Web-Root) |
| `logoUrl` | Pfad zum Logo (Header, Login, Admin, Chat-Avatare, Embed) |
| `i18nReplacements` | Liste von `[von, zu]`-Paaren, case-sensitive, laufzeit-angewandt auf jede Übersetzung |
| `userNavItems` | Menüpunkte für Nicht-Superuser (`home`, `datasets`, `chat`, `search`, `agent`, `memory`, `files`); Superuser sehen immer alles. Reine UI-Ausblendung in Navbar + Home, keine Rechteverwaltung |
| `userSettingItems` | Profil-/Settings-Menüpunkte für Nicht-Superuser (`data-sources`, `chat-channels`, `model-providers`, `mcp`, `team`, `profile`, `api`). Der Team-„Invite member"-Button ist für Nicht-Superuser immer ausgeblendet |
| `[links]` `help`/`discord`/`github` | URLs für die Header-/Menü-Icons; fehlender Eintrag blendet das Element aus |
| `[colors]` | CSS-Custom-Property-Overrides auf `:root`, z.B. `"--primary" = "210 80% 40%"` |

Eigene Bild-Assets nach `assets/` legen (wird als `/branding/` gemountet) und
in der TOML mit `/branding/<datei>` referenzieren.

## Bekannte Grenzen (Stand v0.26.4)

- Doku-Links in einzelnen Tooltips zeigen weiterhin auf ragflow.io
  (bewusst, bis eigene Doku existiert).
- Backend-Flächen (API-Fehlermeldungen, E-Mail-Templates, `ragflow-`-Präfix
  von API-Keys) sind von diesem Mechanismus nicht erfasst.
