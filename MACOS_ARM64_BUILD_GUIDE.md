# RAGFlow macOS ARM64 Build Guide

This guide documents the process for building and running RAGFlow natively on macOS with Apple Silicon (ARM64/M1/M2/M3).

## Overview

RAGFlow's official Docker images are built for x86_64 architecture only. This guide provides a configuration for building RAGFlow from source on macOS using native ARM64 architecture, avoiding emulation overhead and providing better performance.

## Prerequisites

- macOS with Apple Silicon (M1/M2/M3)
- Colima (Docker runtime for macOS)
- Docker Compose
- At least 16GB RAM and 50GB disk space

## Quick Start

### 1. Start Colima

```bash
colima start --cpu 6 --memory 12 --disk 100 --arch aarch64 --vm-type=vz

# Note: --vfs-cache flag was removed in newer Colima versions (flag no longer exists)
# Note: --vm-type and --mount-type cannot be changed after initial VM creation
```

### 2. Verify Docker Buildx

```bash
# Check if buildx is available
docker buildx version

# If not, create symlink
mkdir -p ~/.docker/cli-plugins
ln -sf /opt/homebrew/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx
```

### 3. Build and Start RAGFlow

```bash
cd /path/to/ragflow/docker
docker-compose -f docker-compose-macos.yml up -d --build
```

### 4. Access RAGFlow

Open http://localhost in your browser (Nginx on port 80 serves the web UI).

> Note: Port 9380 is the internal Flask API – not the web UI.

## Architecture

RAGFlow v0.24.0 includes these services:

- **ragflow-server**: Main application (Flask API + Nginx)
- **mysql**: Metadata storage
- **redis**: Queue and cache
- **minio**: Object storage for documents
- **es01** (or **infinity**): Vector database for embeddings

### Features (v0.24.0)

- **Memory System**: APIs and SDK for developer integration
- **Vite Frontend**: Build system migrated from UmiJS to Vite; env vars use `VITE_*` prefix
- **Admin Server**: Administrative API on port 9381
- **MCP Server**: Model Context Protocol support on port 9382
- **Thinking Mode**: Replaces previous "Reasoning" option
- **Multi-Sandbox**: Local gVisor + Alibaba Cloud sandbox support
- **New Data Sources**: Zendesk, Bitbucket, Seafile, MySQL, PostgreSQL
- **OceanBase Support**: As MySQL alternative
- **PaddleOCR-VL**: Parser support added
- **Aspose Removed**: PPT parsing now uses Tika (no .NET dependency needed)

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
| 9380 | RAGFlow API | Internal Flask API (not the web UI) |
| 9381 | Admin Server | Administrative API |
| 80/443 | Nginx | HTTP/HTTPS |
| 5678/5679 | Debug | Python debugging ports |
| 9382 | MCP | Model Context Protocol |

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

```bash
# 1. Save our custom patches
git stash push -m "macOS ARM64 modifications"

# 2. Fetch new tags and checkout
git fetch --tags
git checkout v0.24.0   # replace with target version

# 3. Re-apply our patches (expect possible conflicts in Dockerfile and docker/.env)
git stash pop

# 4. If Dockerfile conflicts: manually re-apply the ARM64 uv patch (see above)
# If .env conflicts: ensure MACOS=1 and TIMEZONE=Europe/Berlin are set

# 5. Update RAGFLOW_IMAGE version in docker/.env
# Change: RAGFLOW_IMAGE=infiniflow/ragflow:v0.23.1
# To:     RAGFLOW_IMAGE=infiniflow/ragflow:v0.24.0

# 6. Rebuild
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

## Version Upgrade Notes (v0.23.1 → v0.24.0)

**Breaking Changes:**

1. **Frontend: UmiJS → Vite** — Build system fully replaced. `npm run build` still works via package.json scripts, but env vars now use `VITE_*` prefix (previously `UMI_APP_*`).
2. **"Reasoning" removed** — The "Reasoning" configuration option is replaced by "Thinking" mode.
3. **Aspose removed** — PPT parsing now uses Apache Tika. `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1` is no longer needed (kept in .env for safety, harmless).

**New in v0.24.0:**
- Memory system with APIs and SDK
- Batch metadata management for datasets
- "PageIndex" (renamed from "Table of Contents")
- Multi-admin account support
- Model connection testing when adding models
- New data sources: Zendesk, Bitbucket, Seafile, MySQL, PostgreSQL
- OceanBase support as MySQL alternative
- PaddleOCR-VL parser
- Kimi 2.5, Stepfun 3, doubao-embedding-vision models

**Dockerfile patch conflict resolution:**
When doing `git stash pop` after checkout, Dockerfile conflicts are expected. The upstream
Dockerfile changes significantly between versions. Always verify the ARM64 uv patch is
correctly applied before building.

No database migrations required. Existing data is compatible.

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

**Last Updated**: February 2026
**RAGFlow Version**: v0.24.0
**Tested On**: macOS (Apple Silicon), Colima 0.x (QEMU backend), Docker 27.4.0
**Build Time**: ~20-30 minutes (initial), ~2-5 minutes (cached)
