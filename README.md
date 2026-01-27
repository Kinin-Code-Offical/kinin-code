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

## Deploy (Cloud Run + Cloudflare)

See `docs/deploy.md` for setup steps and GitHub Actions secrets.
