from pathlib import Path
import yaml
from pipeline.core.schemas.product import Product
from pipeline.core.schemas.dimension import Dimension

def test_load_5_p0_products(project_root: Path):
    raw = yaml.safe_load((project_root / "pipeline" / "products" / "coding-agents.yaml").read_text())
    products = [Product(**p) for p in raw["products"]]

    assert len(products) >= 5
    ids = {p.id for p in products}
    assert {"claude-code", "cursor", "codex", "hermes", "manus"} <= ids

    claude = next(p for p in products if p.id == "claude-code")
    assert claude.is_baseline is True
    assert claude.priority == "P0"

def test_dimensions_yaml_loads(project_root: Path):
    raw = yaml.safe_load((project_root / "research" / "schema" / "coding-agent-dims.yaml").read_text())
    dims = [Dimension(**d) for d in raw["dimensions"]]

    # E + F groups MVP — at least 5 dimensions
    assert len(dims) >= 5
    ids = {d.id for d in dims}
    # Spec § 6.2 critical-marked dims that MVP must include
    assert "E5" in ids  # 自定义工具系统
    assert "F3" in ids  # Memory + Compaction

    # Weight integrity check (within MVP subset)
    e_dims = [d for d in dims if d.group.startswith("E.")]
    assert sum(d.weight_in_group_pct for d in e_dims) <= 100.0 + 0.01
