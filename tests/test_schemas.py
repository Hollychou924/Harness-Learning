from packages.schemas.product import Product

def test_product_minimal():
    p = Product(
        id="claude-code",
        name="Claude Code",
        category="coding",
        priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["claude code", "claude-code"],
    )
    assert p.id == "claude-code"
    assert p.is_baseline is False  # default

def test_product_baseline_flag():
    p = Product(
        id="claude-code", name="Claude Code", category="coding", priority="P0",
        homepage="https://www.anthropic.com/claude-code",
        keywords=["claude code"], is_baseline=True,
    )
    assert p.is_baseline is True

def test_product_invalid_category_rejected():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        Product(
            id="x", name="x", category="other", priority="P0",
            homepage="https://x.test", keywords=["x"],
        )
