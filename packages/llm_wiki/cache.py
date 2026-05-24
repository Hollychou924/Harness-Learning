import hashlib
import json
from pathlib import Path

from packages.llm_wiki.atomic import atomic_write_text


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

class SourceCache:
    """SHA256-based incremental cache. Borrowed from vbarsoum1/llm-wiki-compiler pattern."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._data: dict[str, str] = {}
        if path.exists():
            self._data = json.loads(path.read_text(encoding="utf-8"))

    def unchanged(self, url: str, content: bytes) -> bool:
        return self._data.get(url) == content_hash(content)

    def put(self, url: str, content: bytes) -> None:
        self._data[url] = content_hash(content)
        self.flush()

    def flush(self) -> None:
        atomic_write_text(self.path, json.dumps(self._data, indent=2))
