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


@app.command(help="Compare two products on selected dimensions (stub for Phase 1)")
def compare(
    p1: str = typer.Argument(...),
    p2: str = typer.Argument(...),
    dims: str = typer.Option("", "--dims"),
    root: Path = ROOT_OPT,
) -> None:
    typer.echo(f"[stub] compare {p1} vs {p2} on dims=[{dims}]")


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

    layout = WikiLayout(root)
    llm = ClaudeCliLLMClient(claude_bin=claude_bin)
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


if __name__ == "__main__":
    app()
