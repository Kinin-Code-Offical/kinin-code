# Kinin Code

edh.dev-inspired portfolio with a 3D retro computer + CRT terminal hero and scroll transition into 2D sections.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Dev tools (camera + model console)

PowerShell starter:

```powershell
.\scripts\dev.ps1
```

This opens `http://localhost:3000/?dev=1` and enables the live dev panel.

## Content (single source of truth)

Edit these files:

```
src/content/profile.ts
src/content/projects.ts
src/content/theme.ts
src/content/pages/about.md
src/content/pages/contact.md
src/content/pages/title.md
```

Validate content:

```bash
npm run validate-content
```

## Languages (TR / EN)

Translations live here:

```
src/i18n/translations.ts
```

Markdown pages are per-language:

```
src/content/pages/about.tr.md
src/content/pages/about.en.md
src/content/pages/contact.tr.md
src/content/pages/contact.en.md
src/content/pages/title.tr.md
src/content/pages/title.en.md
```

Projects and profile content are localized inside:

```
src/content/profile.ts
src/content/projects.ts
```

To add a new language:
1) Extend `Language` in `src/lib/i18n.ts`.
2) Add translations in `src/i18n/translations.ts`.
3) Add `*.md` pages for the new language.

Language toggle writes to localStorage + cookie and also updates `?lang=tr|en`.

## 3D Model (GLB)

Place the model here:

```
public/models/computer.glb
```

If the model is missing, the hero uses a placeholder mesh.

### Screen mesh requirement

For the CRT terminal texture to map correctly, the screen mesh **must** be a separate object and named:

- `Screen`, `Display`, or `Monitor` (case-insensitive)

If no screen mesh is found, a fallback plane is attached and the dev panel shows:

```
screen mesh not found, using fallback plane
```

### Debug (`?dev=1`)

The dev panel lists:
- All mesh names in the GLB
- The selected screen mesh name
- Whether fallback plane is used

## Terminal commands

```
help, ls, cd, pwd, show <file.md>, show -all, echo <text>, hello, mkdir <name>, touch <name>
```

## Deploy (GCP)

Required APIs:
- run.googleapis.com
- cloudbuild.googleapis.com
- artifactregistry.googleapis.com
- cloudresourcemanager.googleapis.com
- iam.googleapis.com
- serviceusage.googleapis.com
- firebase.googleapis.com
- firebasehosting.googleapis.com

Configured names:
- Artifact Registry repo: `kinin-code`
- Cloud Run service: `kinin-code-dev`

Cloud Build Trigger:
1) Cloud Build -> Triggers -> connect GitHub
2) Select `main` and use `cloudbuild.yaml`

Configured values:
- Region: `europe-west1`
- Project ID: `kinin-code`

Firebase Hosting:
```bash
firebase deploy --only hosting
```

Cloudflare DNS:
- Add the Firebase-provided DNS records in Cloudflare (DNS only recommended at first).

Local test:
```bash
docker build -t kinin-code .
docker run -e PORT=8080 -p 8080:8080 kinin-code
firebase emulators:start
```

Note: `max-instances` caps cost.

## SEO Checklist

- Verify domain in Google Search Console (DNS).
- Submit the sitemap (`/sitemap.xml`).
- Check indexing with `site:your-domain`.
- Validate canonical + hreflang tags.
- Test structured data with Google Rich Results / Schema validator.
- For preview/staging set `NEXT_PUBLIC_NO_INDEX=1` to prevent indexing.
