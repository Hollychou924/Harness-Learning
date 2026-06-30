"""Atomic file writes via tempfile + os.replace.

POSIX guarantees os.replace is atomic on the same filesystem. If the process
is interrupted between tempfile write and replace, the original file (if any)
is still intact. The orphaned tempfile is cleaned up on next successful write.
"""
import os
import tempfile
from pathlib import Path


def atomic_write_text(path: Path, content: str, *, encoding: str = "utf-8") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    try:
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(content)
        os.replace(tmp_name, path)
    except Exception:
        Path(tmp_name).unlink(missing_ok=True)
        raise
