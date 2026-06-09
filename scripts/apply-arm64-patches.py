#!/usr/bin/env python3
"""
Apply ARM64/macOS patches to RAGFlow Dockerfile.

Patches two known issues in the ragflow_deps:latest image that break aarch64 builds:
  1. uv-aarch64 tarball missing → adds curl fallback
  2. libssl1.1 ARM64 .deb corrupt/truncated → adds dpkg-deb validation + curl fallback

Idempotent: safe to run multiple times on the same file.
"""
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Patch definitions
# ---------------------------------------------------------------------------

# Patch 1: uv binary install — add curl fallback for missing aarch64 tarball.
# Upstream does a bare tar extraction that fails when the file is absent.
UV_OLD = (
    '    tar xzf "/deps/uv-${uv_arch}-unknown-linux-gnu.tar.gz" \\\n'
    '    && cp "uv-${uv_arch}-unknown-linux-gnu/"* /usr/local/bin/ \\\n'
    '    && rm -rf "uv-${uv_arch}-unknown-linux-gnu" \\\n'
    '    && uv python install 3.13'
)
UV_NEW = (
    '    if [ -f "/deps/uv-${uv_arch}-unknown-linux-gnu.tar.gz" ]; then \\\n'
    '        tar xzf "/deps/uv-${uv_arch}-unknown-linux-gnu.tar.gz" \\\n'
    '        && cp "uv-${uv_arch}-unknown-linux-gnu/"* /usr/local/bin/ \\\n'
    '        && rm -rf "uv-${uv_arch}-unknown-linux-gnu"; \\\n'
    '    else \\\n'
    '        curl -LsSf "https://github.com/astral-sh/uv/releases/latest/download/uv-${uv_arch}-unknown-linux-gnu.tar.gz" -o uv.tar.gz \\\n'
    '        && tar xzf uv.tar.gz \\\n'
    '        && cp "uv-${uv_arch}-unknown-linux-gnu/"* /usr/local/bin/ \\\n'
    '        && rm -rf uv.tar.gz "uv-${uv_arch}-unknown-linux-gnu"; \\\n'
    '    fi \\\n'
    '    && uv python install 3.13'
)
# Detection string: present if patch is already applied
UV_APPLIED_MARKER = 'curl -LsSf "https://github.com/astral-sh/uv/releases/latest/download/uv-${uv_arch}'

# Patch 2: libssl1.1 ARM64 .deb — validate before installing; corrupt file in deps image.
LIBSSL_OLD = (
    '    elif [ "$(uname -m)" = "aarch64" ]; then \\\n'
    '        dpkg -i /deps/libssl1.1_1.1.1f-1ubuntu2_arm64.deb; \\\n'
    '    fi'
)
LIBSSL_NEW = (
    '    elif [ "$(uname -m)" = "aarch64" ]; then \\\n'
    '        if dpkg-deb --info /deps/libssl1.1_1.1.1f-1ubuntu2_arm64.deb >/dev/null 2>&1; then \\\n'
    '            dpkg -i /deps/libssl1.1_1.1.1f-1ubuntu2_arm64.deb; \\\n'
    '        else \\\n'
    '            curl -fsSL "http://ports.ubuntu.com/ubuntu-ports/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_arm64.deb" -o /tmp/libssl1.1_arm64.deb \\\n'
    '            && dpkg -i /tmp/libssl1.1_arm64.deb \\\n'
    '            && rm /tmp/libssl1.1_arm64.deb; \\\n'
    '        fi; \\\n'
    '    fi'
)
LIBSSL_APPLIED_MARKER = 'dpkg-deb --info /deps/libssl1.1'


# ---------------------------------------------------------------------------
# Apply logic
# ---------------------------------------------------------------------------

def apply_patch(content: str, old: str, new: str, applied_marker: str, name: str) -> tuple[str, str]:
    """Apply a single patch. Returns (new_content, status_message)."""
    if applied_marker in content:
        return content, f"  {name}: already applied — skipped"
    if old in content:
        return content.replace(old, new), f"  {name}: applied"
    return content, f"  {name}: WARNING — target pattern not found (Dockerfile structure may have changed)"


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "Dockerfile")
    print(f"Patching {path} for ARM64 compatibility ...")

    content = path.read_text()
    errors = []

    content, msg = apply_patch(content, UV_OLD, UV_NEW, UV_APPLIED_MARKER, "uv curl fallback")
    print(msg)
    if "WARNING" in msg:
        errors.append("uv")

    content, msg = apply_patch(content, LIBSSL_OLD, LIBSSL_NEW, LIBSSL_APPLIED_MARKER, "libssl1.1 validation")
    print(msg)
    if "WARNING" in msg:
        errors.append("libssl")

    path.write_text(content)

    if errors:
        print(f"\nERROR: {len(errors)} patch(es) could not be applied: {', '.join(errors)}", file=sys.stderr)
        print("The Dockerfile structure may have changed. Check and update the patch patterns.", file=sys.stderr)
        return 1

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
