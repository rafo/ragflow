# RAGFlow macOS ARM64 Build Guide

---

## Neues Release: Checkliste (3 Schritte)

> Fork `rafo/ragflow` ist eingerichtet. GitHub Actions baut das ARM64-Image in der Cloud (~35 Min), lokal nur `docker pull`.

### Schritt 1 — Build starten

```bash
gh workflow run "Build ARM64 Docker Image" \
  --repo rafo/ragflow \
  --ref macos-arm64 \
  --field version=vX.Y.Z
```

Build-Fortschritt: https://github.com/rafo/ragflow/actions

### Schritt 2 — Nach ~35 Minuten: Image holen und starten

```bash
# VERSION in docker/.env aktualisieren (zwei Zeilen):
# RAGFLOW_IMAGE=infiniflow/ragflow:vX.Y.Z
# RAGFLOW_ARM64_IMAGE=ghcr.io/rafo/ragflow:vX.Y.Z-arm64

cd /Users/rafael/docker/ragflow/docker
docker-compose -f docker-compose-macos.yml pull ragflow
docker-compose -f docker-compose-macos.yml up -d
```

### Schritt 3 — Falls der Build mit Node.js-Deprecation-Warnung fehlschlägt (ab Juni 2026)

In `.github/workflows/build-arm64.yml` die Action-Versionen aktualisieren:
- `actions/checkout@v4` → `@v5`
- `docker/setup-buildx-action@v3` → neueste Version prüfen
- `docker/login-action@v3` → neueste Version prüfen
- `docker/build-push-action@v6` → neueste Version prüfen

```bash
git add .github/workflows/build-arm64.yml && git commit -m "chore: bump GHA action versions for Node.js 24"
git push fork macos-arm64
```

### Schritt 4 — Falls der Build mit "patch WARNING" fehlschlägt

Der Upstream-Dockerfile hat sich geändert. Muster in `scripts/apply-arm64-patches.py` aktualisieren (Variablen `UV_OLD` und `LIBSSL_OLD`), dann neu pushen und Workflow wiederholen:

```bash
# Nach dem Edit:
git add scripts/apply-arm64-patches.py && git commit -m "fix: update ARM64 patch patterns for vX.Y.Z"
git push fork macos-arm64
# Dann Schritt 1 wiederholen
```

---

## Overview

RAGFlow's official Docker images are built for x86_64 architecture only. This guide documents two approaches for running RAGFlow on Apple Silicon:

**Recommended: GitHub Actions (pre-built image)** — Build once in the cloud, pull and run locally. No 30-minute local build needed. See [GitHub Actions Setup](#github-actions-automated-arm64-builds).

**Fallback: Local build from source** — Build directly on your Mac using Colima. Required if you need a custom build or GitHub Actions isn't available.

## Prerequisites

- macOS with Apple Silicon (M1/M2/M3)
- Colima (Docker runtime for macOS)
- Docker Compose
- At least 16GB RAM and 50GB disk space

---

## GitHub Actions: Automated ARM64 Builds

This is the recommended approach. GitHub Actions builds the image on native ARM64 runners (free for public repositories) and pushes it to the GitHub Container Registry (ghcr.io). Locally you only need `docker pull`.

### One-Time Setup

#### 1. Fork the repository on GitHub

Go to https://github.com/infiniflow/ragflow and click **Fork**. Use your GitHub username as the owner.

#### 2. Add your fork as a remote

```bash
git remote add myfork https://github.com/YOUR_USERNAME/ragflow.git
```

#### 3. Push your local branch to the fork

```bash
# Create a named branch from the current HEAD (our macOS customizations)
git checkout -b macos-arm64
git push -u myfork macos-arm64
```

#### 4. Make the GitHub Container Registry package public

After the first workflow run:
1. Go to `https://github.com/YOUR_USERNAME?tab=packages`
2. Click on the `ragflow` package → **Package settings**
3. Set visibility to **Public** (so `docker pull` works without authentication)

### Running a Build

1. Go to `https://github.com/YOUR_USERNAME/ragflow/actions`
2. Select **Build ARM64 Docker Image**
3. Click **Run workflow** and enter the version (e.g. `v0.25.1`)
4. Wait ~30–40 minutes for the image to be built and pushed

The image will be available at:
```
ghcr.io/YOUR_USERNAME/ragflow:v0.25.1-arm64
```

### Using the Pre-Built Image Locally

```bash
# 1. Set the image in docker/.env (replace YOUR_USERNAME)
# RAGFLOW_ARM64_IMAGE=ghcr.io/YOUR_USERNAME/ragflow:v0.25.1-arm64

# 2. Pull
docker-compose -f docker-compose-macos.yml pull ragflow

# 3. Start
docker-compose -f docker-compose-macos.yml up -d
```

### Upgrading to a New Version

```bash
# 1. Fetch new upstream tag
git fetch origin tag vX.Y.Z --no-tags

# 2. Create branch at new tag
git checkout -b macos-arm64-vX.Y.Z vX.Y.Z

# 3. Cherry-pick our customization commits
git cherry-pick <our-commit-hash>   # docker-compose-macos.yml etc.

# 4. Push to fork
git push myfork macos-arm64-vX.Y.Z

# 5. Run the GitHub Actions workflow for vX.Y.Z

# 6. Update RAGFLOW_ARM64_IMAGE= in docker/.env
# 7. docker-compose pull ragflow && docker-compose up -d
```

---

## Local Build from Source (Fallback)

### Quick Start

#### 1. Start Colima

```bash
colima start --cpu 6 --memory 12 --disk 100 --arch aarch64 --vm-type=vz

# Note: --vfs-cache flag was removed in newer Colima versions (flag no longer exists)
# Note: --vm-type and --mount-type cannot be changed after initial VM creation
```

#### 2. Verify Docker Buildx

```bash
# Check if buildx is available
docker buildx version

# If not, create symlink
mkdir -p ~/.docker/cli-plugins
ln -sf /opt/homebrew/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx
```

#### 3. Build and Start RAGFlow

```bash
cd /path/to/ragflow/docker
docker-compose -f docker-compose-macos.yml up -d --build
```

#### 4. Access RAGFlow

Open http://localhost in your browser (Nginx on port 80 serves the web UI).

> Note: Port 9380 is the internal Flask API – not the web UI.

## Architecture

RAGFlow v0.25.1 includes these services:

- **ragflow-server**: Main application (Flask API + Nginx)
- **mysql**: Metadata storage
- **redis**: Queue and cache
- **minio**: Object storage for documents
- **es01** (or **infinity**): Vector database for embeddings

### Features (v0.25.1)

- **REST API standardization**: All web API endpoints migrated to RESTful conventions
- **PDF improvements**: OpenDataLoader as new PDF backend; lazy/chunked parsing for large PDFs (>50 pages)
- **New models**: DeepSeek v4, UCloud model provider
- **Data sync deletion**: Bitbucket, Gmail, Google Drive, Airtable now sync deletions
- **New ports**: 9383 (Go admin), 9384 (Go HTTP service)
- **Security**: SSRF vulnerability fixes in URL crawling; optional crypto for stored data
- **SSO support**: `DISABLE_PASSWORD_LOGIN=false` env var
- **DocLing**: Optional PDF backend via `USE_DOCLING=true`

## Configuration Details

### docker-compose-macos.yml

Key differences from standard `docker-compose.yml`:

1. **Build from source** instead of using pre-built image:
   ```yaml
   build:
     context: ../
     dockerfile: Dockerfile
   ```

2. **No platform constraint** (enables native ARM64):
   ```yaml
   # platform: linux/amd64  # Commented out
   ```

3. **MACOS environment variable**:
   ```yaml
   environment:
     - MACOS=${MACOS:-1}
   ```

### docker/.env

Modified settings (our local customizations vs. upstream defaults):

```bash
# Version reference (build: overrides image pull, but useful for reference)
RAGFLOW_IMAGE=infiniflow/ragflow:v0.24.0

# Enable macOS optimizations
MACOS=1

# Set timezone (upstream default: TZ=Asia/Shanghai, we use TIMEZONE var)
TIMEZONE=Europe/Berlin
```

### Dockerfile ARM64 Requirements

The [official RAGFlow docs](https://ragflow.io/docs/build_docker_image) list these ARM64-specific requirements:

1. **xgboost 1.6.0** in `pyproject.toml` — already set upstream since v0.24.0
2. **unixODBC** properly installed — already handled upstream since v0.24.0

**What upstream v0.24.0 handles natively:**
- **uv arch detection** (x86_64 vs aarch64) — code-level logic is correct
- **unixODBC**: ARM64 gets `unixodbc-dev + msodbcsql18`; x86_64 gets `unixodbc-dev + msodbcsql17`
- **libssl**: ARM64-specific `.deb` installed from deps image
- **Python 3.12** (upgraded from 3.11)

**What still requires our custom patches (ragflow_deps image is incomplete for ARM64):**

The `ragflow_deps:latest` image has two broken/missing ARM64 files:

**Patch 1 – uv binary** (missing from deps image):
```dockerfile
# Upstream tries to extract from deps image, but aarch64 tarball is missing.
# Our patch adds a curl fallback:
if [ -f "/deps/uv-${uv_arch}-unknown-linux-gnu.tar.gz" ]; then \
    tar xzf "/deps/uv-${uv_arch}-unknown-linux-gnu.tar.gz" ...; \
else \
    curl -LsSf "https://github.com/astral-sh/uv/releases/latest/download/uv-${uv_arch}-unknown-linux-gnu.tar.gz" ...; \
fi \
&& uv python install 3.12
```

**Patch 2 – libssl1.1 ARM64 deb** (present but corrupted/truncated at 16KB in deps image):
```dockerfile
# Upstream tries to dpkg -i from deps image, but the ARM64 .deb is corrupt.
# Our patch validates and falls back to Ubuntu ports:
if dpkg-deb --info /deps/libssl1.1_1.1.1f-1ubuntu2_arm64.deb >/dev/null 2>&1; then \
    dpkg -i /deps/libssl1.1_1.1.1f-1ubuntu2_arm64.deb; \
else \
    curl -fsSL "http://ports.ubuntu.com/ubuntu-ports/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_arm64.deb" \
    -o /tmp/libssl1.1_arm64.deb && dpkg -i /tmp/libssl1.1_arm64.deb; \
fi
```

**Both patches must be re-applied after every version upgrade** until the `ragflow_deps` image is fixed for ARM64.

### Ports Exposed

| Port | Service | Description |
|------|---------|-------------|
| 80/443 | Nginx | HTTP/HTTPS (web UI) |
| 9380 | RAGFlow API | Internal Flask API |
| 9381 | Admin Server | Administrative API |
| 9382 | MCP | Model Context Protocol |
| 9383 | Go Admin | Go admin service (v0.25.1+) |
| 9384 | Go HTTP | Go HTTP service (v0.25.1+) |
| 5678/5679 | Debug | Python debugging ports |

## Build Process

The initial build takes 20-30 minutes and includes:

1. Installing Python 3.11 and dependencies
2. Compiling native libraries for ARM64
3. Building Vite frontend (since v0.24.0; previously UmiJS)
4. Downloading embedding models:
   - **BAAI/bge-large-zh-v1.5**: Chinese text embedding
   - **maidalun1020/bce-embedding-base_v1**: Bilingual (Chinese-English) embedding
5. Setting up Nginx and application files

Final image size: ~4.15GB

## Common Commands

### Stop Services

```bash
cd /path/to/ragflow/docker
docker-compose -f docker-compose-macos.yml down
```

### Restart Services

```bash
cd /path/to/ragflow/docker
docker-compose -f docker-compose-macos.yml restart
```

### View Logs

```bash
# All services
docker-compose -f docker-compose-macos.yml logs -f

# Specific service
docker logs -f ragflow-server
```

### Rebuild After Code Changes

```bash
cd /path/to/ragflow/docker
docker-compose -f docker-compose-macos.yml up -d --build --force-recreate
```

## Update to a New Version

### Via GitHub Actions (Recommended)

```bash
# 1. Fetch new upstream tag
git fetch origin tag vX.Y.Z --no-tags

# 2. Create branch at new upstream tag
git checkout -b macos-arm64-vX.Y.Z vX.Y.Z

# 3. Cherry-pick our customisation commits onto the new tag
git cherry-pick <hash-of-our-macos-arm64-commits>

# 4. Push to your fork and trigger the build-arm64 workflow for vX.Y.Z

# 5. When done, update docker/.env:
#    RAGFLOW_IMAGE=infiniflow/ragflow:vX.Y.Z
#    RAGFLOW_ARM64_IMAGE=ghcr.io/YOUR_USERNAME/ragflow:vX.Y.Z-arm64

# 6. Pull and restart
docker-compose -f docker-compose-macos.yml pull ragflow
docker-compose -f docker-compose-macos.yml up -d
```

### Via Local Build (Fallback)

```bash
# 1. Fetch new tag and check out
git fetch origin tag vX.Y.Z --no-tags
git checkout -b macos-arm64-vX.Y.Z vX.Y.Z

# 2. Apply ARM64 patches to Dockerfile
python3 scripts/apply-arm64-patches.py Dockerfile

# 3. Copy over our custom files
git checkout HEAD~0 -- docker/docker-compose-macos.yml  # or restore manually

# 4. Update docker/.env version reference
# RAGFLOW_IMAGE=infiniflow/ragflow:vX.Y.Z

# 5. Rebuild
cd docker
docker-compose -f docker-compose-macos.yml up -d --build
```

## Troubleshooting

### Issue: Build succeeds but docker-compose fails with "rpc error: EOF"

**Symptom**: Build completes all stages but fails at the end with:
```
failed to receive status: rpc error: code = Unavailable desc = error reading from server: EOF
```

**Cause**: BuildKit loses connection to the Docker daemon while unpacking the large (~2.7GB) image.
The image was actually built and loaded successfully. This is a Colima/BuildKit timeout issue.

**Solution**: The image is already there. Just start the services without `--build`:
```bash
docker-compose -f docker-compose-macos.yml up -d
```

**Prevention**: Clean the build cache after building to avoid disk pressure causing Colima crashes:
```bash
docker builder prune -f
```

---

### Issue: "unknown shorthand flag: 'f' in -f"

**Cause**: Using `docker compose` (new CLI) instead of `docker-compose` (standalone)

**Solution**: Always use `docker-compose` with hyphen:

```bash
docker-compose -f docker-compose-macos.yml up -d
```

### Issue: Platform Mismatch Warnings

**Symptom**: Warnings about running x86_64 images on ARM64

**Solution**: Ensure `platform: linux/amd64` is commented out in `docker-compose-macos.yml`

### Issue: Build Fails with "buildx isn't installed"

**Cause**: Docker Buildx plugin not found

**Solution**: Create symlink to Homebrew-installed buildx:
```bash
mkdir -p ~/.docker/cli-plugins
ln -sf /opt/homebrew/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx
```

### Issue: Build Fails – uv binary not found for aarch64

**Cause**: Dockerfile patch for ARM64 not applied (upstream only ships x86_64 uv binary in deps image)

**Solution**: Re-apply the Dockerfile ARM64 patch documented in "Configuration Details → Dockerfile Patch"

### Issue: ragflow-server Container Stays in "Created" State

**Cause**: Dependency issues or resource constraints

**Solution 1**: Manually start the container:
```bash
docker start ragflow-server
```

**Solution 2**: Check logs for errors:
```bash
docker logs ragflow-server
```

### Issue: Out of Memory During Build

**Symptom**: Build fails with memory errors

**Solution**: Increase Colima resources:
```bash
colima stop
colima start --cpu 6 --memory 16 --disk 100 --arch aarch64
```

### Issue: MySQL Connection Errors

**Symptom**: RAGFlow can't connect to MySQL

**Solution**: Ensure MySQL is healthy before RAGFlow starts:
```bash
docker-compose -f docker-compose-macos.yml up -d mysql
# Wait for health check
docker-compose -f docker-compose-macos.yml up -d ragflow
```

### Issue: Elasticsearch/Infinity Not Starting

**Symptom**: Vector database fails to start

**Solution**: Check `vm.max_map_count`:
```bash
# In Colima VM
colima ssh
sudo sysctl -w vm.max_map_count=262144
exit
```

### Issue: Frontend env vars not picked up after v0.24.0

**Cause**: Environment variable prefix changed from `UMI_APP_*` to `VITE_*` in v0.24.0

**Solution**: Rename any custom frontend env vars from `UMI_APP_FOO` to `VITE_FOO`

## Clean Installation

To perform a completely fresh installation:

```bash
# Stop and remove all containers and volumes
cd /path/to/ragflow/docker
docker-compose -f docker-compose-macos.yml down -v

# Remove built images
docker rmi $(docker images | grep ragflow | awk '{print $3}')

# Clean build cache (optional, saves time)
# docker system prune -a

# Rebuild from scratch
docker-compose -f docker-compose-macos.yml up -d --build
```

## Files Modified (vs. upstream)

Summary of custom changes to the RAGFlow repository for macOS ARM64:

### 1. docker/docker-compose-macos.yml

- Removed `platform: linux/amd64` constraint (enables native ARM64 build)
- Added `build: context: ../ dockerfile: Dockerfile` (build from source instead of pulling image)
- Added MACOS env var, debug ports (5678/5679), Admin (9381) and MCP (9382) port mappings
- Added commented MCP and Admin server examples

### 2. docker/.env

- `TZ=Asia/Shanghai` → `TIMEZONE=Europe/Berlin`
- `# MACOS=1` → `MACOS=1` (uncommented)
- `RAGFLOW_IMAGE` version tag updated to current version

### 3. Dockerfile

- **Custom patch still required**: adds `curl` fallback for `uv-aarch64` binary (missing from `ragflow_deps` image)
- Upstream handles: ARM64 unixODBC (`msodbcsql18`), ARM64 libssl, Python 3.12, arch detection logic

### 4. System Configuration

- Created symlink: `~/.docker/cli-plugins/docker-buildx`

## Performance Notes

- **Native ARM64**: No emulation overhead, ~30-40% faster than x86_64 emulation
- **Embedding models**: Included in image, no runtime downloads needed
- **Build caching**: Subsequent builds take 2-5 minutes with Docker cache
- **Resource usage**: ~8GB RAM for full stack, ~4GB disk for images

## Version Upgrade Notes

### v0.24.0 → v0.25.1

**No breaking changes for macOS ARM64 setup.**

**New in v0.25.1:**
- REST API endpoints fully standardized to RESTful conventions
- PDF: OpenDataLoader backend, lazy loading for >50 page PDFs
- New models: DeepSeek v4, UCloud
- File deletion sync: Bitbucket, Gmail, Google Drive, Airtable
- New ports: 9383 (Go admin), 9384 (Go HTTP) — added to compose-macos.yml
- New env vars: `GO_HTTP_PORT`, `GO_ADMIN_PORT`, `DISABLE_PASSWORD_LOGIN`
- Security: SSRF fixes, optional data encryption (`RAGFLOW_CRYPTO_*`)

**Dockerfile patches status:** Both ARM64 patches (uv fallback, libssl validation) are still
needed — upstream v0.25.1 still ships the broken `ragflow_deps:latest` for aarch64.

**Database:** No migrations required. Existing v0.24.0 data is compatible.

### v0.23.1 → v0.24.0

1. **Frontend: UmiJS → Vite** — env vars use `VITE_*` prefix (previously `UMI_APP_*`).
2. **"Reasoning" replaced by "Thinking" mode.**
3. **Aspose removed** — PPT parsing uses Apache Tika.

No database migrations required.

## Success Indicators

A successful installation shows:

1. Docker image built successfully (~4.15GB)
2. All 5+ containers running and healthy:
   ```bash
   docker ps --filter "name=ragflow"
   docker ps --filter "name=mysql"
   docker ps --filter "name=redis"
   docker ps --filter "name=minio"
   docker ps --filter "name=es01"  # or infinity
   ```
3. RAGFlow accessible at http://localhost (port 80, served by Nginx)
4. Logs show correct version:
   ```bash
   docker logs ragflow-server | grep "RAGFlow version"
   # Output: RAGFlow version: v0.24.0-xxx-xxxxxxxx full
   ```
5. No platform mismatch warnings in build output
6. Native ARM64 architecture:
   ```bash
   docker inspect ragflow-server | grep Architecture
   # Output: "Architecture": "arm64"
   ```

## Additional Resources

- Official docs: https://ragflow.io/docs
- GitHub: https://github.com/infiniflow/ragflow
- Issues: https://github.com/infiniflow/ragflow/issues

---

**Last Updated**: May 2026
**RAGFlow Version**: v0.25.1
**Tested On**: macOS (Apple Silicon), Colima, Docker 27.4.0
**Local Build Time**: ~20-30 minutes (initial), ~2-5 minutes (cached)
**GitHub Actions Build Time**: ~30-40 minutes (first build), faster with GHA cache
