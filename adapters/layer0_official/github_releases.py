import json
import subprocess
from dataclasses import dataclass
from datetime import datetime

@dataclass(frozen=True)
class Release:
    tag: str
    name: str
    body: str
    published_at: datetime
    url: str

def fetch_releases(repo: str, limit: int = 30) -> list[Release]:
    """Fetch releases via `gh api`. Requires gh CLI authenticated."""
    cmd = [
        "gh", "api",
        f"repos/{repo}/releases?per_page={limit}",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"gh api failed: {result.stderr.strip()}")

    data = json.loads(result.stdout)
    return [
        Release(
            tag=r["tag_name"],
            name=r.get("name") or r["tag_name"],
            body=r.get("body") or "",
            published_at=datetime.fromisoformat(r["published_at"].replace("Z", "+00:00")),
            url=r["html_url"],
        )
        for r in data
    ]
