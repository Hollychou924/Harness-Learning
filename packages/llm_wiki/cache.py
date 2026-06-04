import hashlib
import json
import logging
from pathlib import Path

from packages.llm_wiki.atomic import atomic_write_text

logger = logging.getLogger(__name__)


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

class SourceCache:
    """SHA256-based incremental cache. Borrowed from vbarsoum1/llm-wiki-compiler pattern.

    put() 只更新内存;调用方负责在批量写入后调用 flush() 持久化一次,
    避免每页一次原子整文件写造成的 O(n²) IO。
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self._data: dict[str, str] = {}
        if path.exists():
            try:
                self._data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                # 上次 flush 中断会留下半写文件;损坏时按空缓存重建,下次全量重抓
                logger.warning("缓存文件损坏,按空缓存重建 %s: %s", path, exc)
                self._data = {}

    def unchanged(self, url: str, content: bytes) -> bool:
        return self._data.get(url) == content_hash(content)

    def put(self, url: str, content: bytes) -> None:
        self._data[url] = content_hash(content)

    def flush(self) -> None:
        atomic_write_text(self.path, json.dumps(self._data, indent=2))
