# Kinin Code

Portfolio + full-stack landing site built with Next.js and an optional 3D model.

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

## 3D Model

Export the Blender model to GLB and place it here:

```
public/models/computer.glb
```

If the model is missing, the hero uses a placeholder mesh.

## Deploy (Cloud Run + Cloudflare)

See `docs/deploy.md` for setup steps and GitHub Actions secrets.
