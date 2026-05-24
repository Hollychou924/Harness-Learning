from pathlib import Path

from packages.llm_wiki.atomic import atomic_write_text


def test_atomic_write_creates_file(tmp_path: Path):
    target = tmp_path / "out.txt"
    atomic_write_text(target, "hello")
    assert target.read_text() == "hello"


def test_atomic_write_replaces_existing(tmp_path: Path):
    target = tmp_path / "out.txt"
    target.write_text("v1")
    atomic_write_text(target, "v2")
    assert target.read_text() == "v2"


def test_atomic_write_creates_parent_dirs(tmp_path: Path):
    target = tmp_path / "deep" / "nested" / "out.txt"
    atomic_write_text(target, "x")
    assert target.read_text() == "x"


def test_atomic_write_no_temp_files_left(tmp_path: Path):
    target = tmp_path / "out.txt"
    atomic_write_text(target, "x")
    # only the target should exist; no .tmp orphans
    files = list(tmp_path.iterdir())
    assert files == [target]
