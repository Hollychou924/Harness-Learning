import shutil
from pathlib import Path
import pytest

@pytest.fixture
def tmp_wiki(tmp_path: Path) -> Path:
    """Empty wiki directory for tests."""
    wiki = tmp_path / "wiki"
    wiki.mkdir()
    return wiki

@pytest.fixture
def project_root() -> Path:
    return Path(__file__).resolve().parent.parent
