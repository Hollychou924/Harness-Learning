from pathlib import Path
import typer
import yaml
from packages.llm_wiki.paths import init_wiki, WikiLayout
from packages.schemas.product import Product

app = typer.Typer(no_args_is_help=True, help="AI Agent Competitive Analysis — wiki CLI")

ROOT_OPT = typer.Option(Path("wiki"), "--root", help="Wiki root directory")


@app.command(help="Initialize wiki directory structure")
def init(root: Path = ROOT_OPT) -> None:
    init_wiki(root)
    typer.echo(f"✓ Initialized wiki at {root}")


@app.command(help="Ingest a single source URL or file")
def ingest(
    source: str = typer.Argument(..., help="URL or file path"),
    product_id: str = typer.Option(..., "--product", help="Product ID"),
    root: Path = ROOT_OPT,
) -> None:
    typer.echo(f"[stub] ingest {source} → {product_id} (Phase 1: see sync command)")


@app.command(help="Compile raw → compiled (full sync, batch)")
def compile(
    products_file: Path = typer.Option(Path("products/coding-agents.yaml")),
    only: str = typer.Option("", "--only", help="Comma-separated product IDs"),
    root: Path = ROOT_OPT,
) -> None:
    raw = yaml.safe_load(products_file.read_text(encoding="utf-8"))
    products = [Product(**p) for p in raw["products"]]
    if only:
        keep = set(only.split(","))
        products = [p for p in products if p.id in keep]

    typer.echo(f"[Phase 1 stub] would compile {len(products)} product(s): {[p.id for p in products]}")
    typer.echo("Real impl: call packages.llm_wiki.sync.sync_product_path_a per product")


@app.command(help="Full-text/vector search the wiki (stub for Phase 1)")
def search(query: str, root: Path = ROOT_OPT) -> None:
    typer.echo(f"[stub] search: {query}")


@app.command(help="LLM-synthesized answer with citations (stub for Phase 1)")
def query(question: str, root: Path = ROOT_OPT) -> None:
    typer.echo(f"[stub] query: {question}")


@app.command(help="Compare baseline product against others on selected dimensions")
def compare(
    baseline: str = typer.Argument(..., help="Baseline product ID"),
    others: list[str] = typer.Argument(
        ..., help="One or more compare product IDs (space- or comma-separated)"
    ),
    dims: str = typer.Option(
        "", "--dims", help="Comma-separated dimension IDs (default: all)"
    ),
    formats: str = typer.Option(
        "markdown",
        "--formats",
        help="Comma-separated output formats: markdown,html,pptx,feishu",
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Print plan without rendering or writing"
    ),
    products_file: Path = typer.Option(
        Path("products/coding-agents.yaml"), "--products-file"
    ),
    dims_file: Path = typer.Option(
        Path("wiki/schema/coding-agent-dims.yaml"), "--dims-file"
    ),
    feishu_parent: str = typer.Option(
        "", "--feishu-parent", help="Feishu wiki parent node token"
    ),
    root: Path = ROOT_OPT,
) -> None:
    import asyncio

    from packages.competitive_analysis.comparison_request import (
        ComparisonRequest,
        OutputFormat,
    )
    from packages.competitive_analysis.path_c_sync import sync_path_c
    from packages.schemas.dimension import Dimension

    # Load products + dimensions.
    products_raw = yaml.safe_load(products_file.read_text(encoding="utf-8"))
    products_index = {p["id"]: Product(**p) for p in products_raw["products"]}

    dims_raw = yaml.safe_load(dims_file.read_text(encoding="utf-8"))
    dimensions = [Dimension(**d) for d in dims_raw["dimensions"]]

    # Validate baseline.
    if baseline not in products_index:
        typer.echo(f"[error] baseline {baseline!r} not found in {products_file}")
        raise typer.Exit(1)

    # Allow callers to pass either `cursor codex` or `cursor,codex` (or a mix).
    other_ids = [
        token.strip()
        for chunk in others
        for token in chunk.split(",")
        if token.strip()
    ]
    for pid in other_ids:
        if pid not in products_index:
            typer.echo(f"[error] product {pid!r} not found in {products_file}")
            raise typer.Exit(1)

    # Parse dim filter + formats.
    dim_filter = [d.strip() for d in dims.split(",") if d.strip()] or None
    try:
        output_formats = [
            OutputFormat(f.strip()) for f in formats.split(",") if f.strip()
        ]
    except ValueError as exc:
        typer.echo(f"[error] invalid format: {exc}")
        raise typer.Exit(1) from exc

    request = ComparisonRequest(
        baseline_product_id=baseline,
        compare_product_ids=other_ids,
        dimension_filter=dim_filter,
        output_formats=output_formats,
    )

    if dry_run:
        typer.echo(
            f"[dry-run] compare baseline={baseline} others={other_ids} "
            f"dims={request.dimension_filter or 'all'} "
            f"formats={[f.value for f in request.output_formats]}"
        )
        return

    layout = WikiLayout(root)
    result = asyncio.run(
        sync_path_c(
            request=request,
            layout=layout,
            products_index=products_index,
            dimensions=dimensions,
            feishu_parent_node=feishu_parent or None,
        )
    )

    typer.echo("\n=== Outputs ===")
    for fmt, path in result.items():
        typer.echo(f"  {fmt}: {path}")


@app.command(help="Health-check wiki (orphans, contradictions, missing critical dims)")
def lint(root: Path = ROOT_OPT) -> None:
    layout = WikiLayout(root)
    issues: list[str] = []
    if not layout.purpose.exists():
        issues.append("missing purpose.md")
    if not layout.index.exists():
        issues.append("missing index.md")
    if not layout.log.exists():
        issues.append("missing log.md")
    if issues:
        for i in issues:
            typer.echo(f"⚠️  {i}")
        raise typer.Exit(1)
    typer.echo("OK — wiki structure valid")


@app.command(help="Launch offline HTML knowledge graph (stub for Phase 1)")
def visualize(root: Path = ROOT_OPT) -> None:
    typer.echo("[stub] launch HTML graph viewer — Phase 2 deliverable")


@app.command(help="Process Async Review queue")
def review(
    action: str = typer.Argument("list", help="list | approve <slug> | reject <slug>"),
    slug: str = typer.Option("", "--slug"),
    root: Path = ROOT_OPT,
) -> None:
    layout = WikiLayout(root)
    pending = list((layout.review / "pending").glob("*.json"))
    if action == "list":
        typer.echo(f"{len(pending)} pending review item(s):")
        for p in pending:
            typer.echo(f"  - {p.stem}")
        return
    typer.echo(f"[stub] review {action} {slug}")


@app.command("path-b", help="Run Path B (daily changelog incremental sync)")
def path_b(
    products_file: Path = typer.Option(Path("products/coding-agents.yaml")),
    only: str = typer.Option("", "--only", help="Comma-separated product IDs"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Plan only, no API calls"),
    threshold: float = typer.Option(0.5, "--threshold"),
    claude_bin: str = typer.Option(
        "/opt/homebrew/bin/claude", "--claude-bin",
        help="Path to claude CLI binary (default: /opt/homebrew/bin/claude)",
    ),
    root: Path = ROOT_OPT,
) -> None:
    raw = yaml.safe_load(products_file.read_text(encoding="utf-8"))
    products = [Product(**p) for p in raw["products"]]
    if only:
        keep = set(only.split(","))
        products = [p for p in products if p.id in keep]

    if dry_run:
        typer.echo(f"[dry-run] would sync Path B for {len(products)} product(s):")
        for p in products:
            typer.echo(f"  - {p.id} (keywords: {', '.join(p.keywords[:3])})")
        return

    # Real run — wired up via ClaudeCliLLMClient (P1) + StubKeywordScorer (Phase 3 真 LLM scoring)
    from packages.llm_wiki.claude_cli import ClaudeCliLLMClient
    from packages.llm_wiki.paths import WikiLayout
    from packages.ai_agent_research.path_b_sync import sync_path_b
    from packages.ai_agent_research.scorer import StubKeywordScorer
    from packages.schemas.dimension import Dimension

    # Load schema dimensions so the LLM client can constrain its output to
    # known IDs (avoids inventing categories like "E1 Ecosystem & Integrations").
    dims_path = Path("wiki/schema/coding-agent-dims.yaml")
    dims_raw = yaml.safe_load(dims_path.read_text(encoding="utf-8"))
    dimensions = [Dimension(**d) for d in dims_raw["dimensions"]]

    layout = WikiLayout(root)
    llm = ClaudeCliLLMClient(claude_bin=claude_bin, dimensions=dimensions)
    # Phase 2.x: stubbed at 0.5; Phase 3 will replace with LLM-driven relevance scoring
    scorer = StubKeywordScorer(value=0.5)

    typer.echo(f"Running Path B for {len(products)} product(s), threshold={threshold}...")
    result = sync_path_b(
        products=products,
        layout=layout,
        llm=llm,
        keyword_scorer=scorer,
        score_threshold=threshold,
    )

    typer.echo("\n=== Results ===")
    for pid, info in result.items():
        marker = "✓ report written" if info["report_written"] else "skipped (low score)"
        typer.echo(
            f"  {pid}: {info['entries_aggregated']} signals, "
            f"score={info['score']:.2f} → {marker}"
        )


@app.command("notify", help="Push pending changelog reports to Feishu")
def notify(root: Path = ROOT_OPT) -> None:
    typer.echo(f"[stub] notify — would scan {root}/changelog/ and push unsent reports")


THEME_SLUG_TO_ENUM = {
    "harness-design": "HARNESS_DESIGN",
    "harness_design": "HARNESS_DESIGN",
    "context-engineering": "CONTEXT_ENGINEERING",
    "context_engineering": "CONTEXT_ENGINEERING",
    "tool-ecosystem": "TOOL_ECOSYSTEM",
    "tool_ecosystem": "TOOL_ECOSYSTEM",
    "cache-strategy": "CACHE_STRATEGY",
    "cache_strategy": "CACHE_STRATEGY",
    "open-source": "OPEN_SOURCE",
    "open_source": "OPEN_SOURCE",
    "co-evolution": "CO_EVOLUTION",
    "co_evolution": "CO_EVOLUTION",
}


@app.command(help="Generate PM portfolio reports per theme (Phase 4)")
def portfolio(
    theme: str = typer.Option("", "--theme", help="Theme slug (e.g. harness-design)"),
    all_themes: bool = typer.Option(False, "--all", help="Run all 6 themes"),
    products: str = typer.Option(
        "", "--products", help="Comma-separated product IDs (default: all P0)"
    ),
    formats: str = typer.Option(
        "markdown,pptx",
        "--formats",
        help="Comma-separated output formats: markdown,pptx,html",
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Print plan without rendering or writing"
    ),
    products_file: Path = typer.Option(
        Path("products/coding-agents.yaml"), "--products-file"
    ),
    output_dir: Path = typer.Option(
        Path("wiki/reports/portfolio"), "--output-dir"
    ),
    root: Path = ROOT_OPT,
) -> None:
    import asyncio

    from packages.competitive_analysis.comparison_request import OutputFormat
    from packages.competitive_analysis.portfolio.engine import PortfolioReportEngine
    from packages.competitive_analysis.portfolio.theme import (
        PortfolioReportRequest,
        ReportTheme,
    )
    from packages.llm_wiki.claude_cli import ClaudeCliLLMClient
    from packages.llm_wiki.paths import WikiLayout
    from render.portfolio_md_renderer import render_portfolio_md
    from render.portfolio_pptx_renderer import render_portfolio_marp

    # Validate flags.
    if not theme and not all_themes:
        typer.echo("Error: provide --theme <slug> or --all")
        raise typer.Exit(code=1)
    if theme and all_themes:
        typer.echo("Error: --theme and --all are mutually exclusive")
        raise typer.Exit(code=1)

    # Resolve themes to run.
    if all_themes:
        themes_to_run = list(ReportTheme)
    else:
        slug = theme.lower()
        if slug not in THEME_SLUG_TO_ENUM:
            typer.echo(
                f"Error: unknown theme {theme!r}. "
                f"Valid: {sorted(set(THEME_SLUG_TO_ENUM))}"
            )
            raise typer.Exit(code=1)
        themes_to_run = [ReportTheme[THEME_SLUG_TO_ENUM[slug]]]

    # Resolve product IDs (default: P0 priority).
    products_raw = yaml.safe_load(products_file.read_text(encoding="utf-8"))
    all_product_ids = [p["id"] for p in products_raw["products"]]
    if products:
        product_ids = [p.strip() for p in products.split(",") if p.strip()]
    else:
        product_ids = [
            p["id"]
            for p in products_raw["products"]
            if str(p.get("priority", "")).upper() == "P0"
        ] or all_product_ids

    # Resolve output formats.
    fmt_map = {
        "markdown": OutputFormat.MARKDOWN,
        "md": OutputFormat.MARKDOWN,
        "pptx": OutputFormat.PPTX,
        "html": OutputFormat.HTML,
    }
    try:
        requested_fmts = [
            fmt_map[f.strip().lower()] for f in formats.split(",") if f.strip()
        ]
    except KeyError as exc:
        typer.echo(f"Error: invalid format: {exc}")
        raise typer.Exit(code=1) from exc

    layout = WikiLayout(root=root)
    llm = ClaudeCliLLMClient()
    engine = PortfolioReportEngine(layout=layout, llm=llm)

    for rt in themes_to_run:
        request = PortfolioReportRequest(
            theme=rt,
            product_ids=product_ids,
            dimension_filter=None,
            output_formats=requested_fmts,
        )
        slug_out = rt.name.lower().replace("_", "-")
        out_dir = output_dir / slug_out

        if dry_run:
            typer.echo(
                f"[dry-run] theme={rt.name} products={product_ids} "
                f"dims={request.effective_dimensions()} "
                f"formats={[f.value for f in requested_fmts]} → {out_dir}"
            )
            continue

        out_dir.mkdir(parents=True, exist_ok=True)
        body_md = asyncio.run(engine.generate(request))

        title = request.title or f"{rt.jd_keyword} — Coding Agent 横评"
        audience = "DeepSeek Agent Harness PM"

        if OutputFormat.MARKDOWN in requested_fmts:
            md = render_portfolio_md(
                body_md=body_md,
                title=title,
                jd_keyword=rt.jd_keyword,
                audience=audience,
            )
            (out_dir / "report.md").write_text(md, encoding="utf-8")
            typer.echo(f"✓ {out_dir / 'report.md'}")
        if OutputFormat.PPTX in requested_fmts:
            marp = render_portfolio_marp(
                body_md=body_md,
                title=title,
                subtitle=f"From wiki facts to PM insights — {len(product_ids)} products",
                jd_keyword=rt.jd_keyword,
                audience=audience,
            )
            (out_dir / "deck.marp.md").write_text(marp, encoding="utf-8")
            typer.echo(f"✓ {out_dir / 'deck.marp.md'}")
        if OutputFormat.HTML in requested_fmts:
            typer.echo(
                f"  (HTML output for {rt.name} not yet wired — "
                f"use marp-cli on deck.marp.md)"
            )


if __name__ == "__main__":
    app()
