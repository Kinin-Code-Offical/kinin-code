# Cloud Run + Cloudflare deploy

## 1) GCP hazırlık
- Artifact Registry repo oluştur (Docker):
  - Region: `GAR_LOCATION` (ör. `europe-west1`)
  - Repo adı: `GAR_REPOSITORY` (ör. `web-images`)
- Cloud Run servisi oluştur (ilk deploy ile de oluşur).
- Workload Identity Federation + service account:
  - `GCP_WORKLOAD_ID_PROVIDER`
  - `GCP_SERVICE_ACCOUNT`
- Service account yetkileri:
  - Artifact Registry Writer
  - Cloud Run Admin
  - Service Account User

## 2) GitHub secrets
Repo Settings → Secrets and variables → Actions:
- `GCP_PROJECT_ID`
- `GCP_REGION` (Cloud Run region, ör. `europe-west1`)
- `CLOUD_RUN_SERVICE`
- `GAR_LOCATION`
- `GAR_REPOSITORY`
- `GCP_WORKLOAD_ID_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

## 3) Cloudflare
- Domain’i Cloudflare’a ekle.
- Cloud Run URL’i için CNAME oluştur:
  - `@` veya `www` → `your-service-<hash>-<region>.a.run.app`
- SSL/TLS mode: Full (strict)

## 4) İlk deploy
- `main` branch’e push et.
- GitHub Actions workflow `Deploy to Cloud Run` otomatik çalışır.

## 5) Sağlık kontrolü
- `https://<domain>/api/healthz`
