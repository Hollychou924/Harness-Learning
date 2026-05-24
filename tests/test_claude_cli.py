import json
import subprocess
from unittest.mock import patch
from packages.llm_wiki.ingest import IngestSource, AnalysisDraft
from packages.llm_wiki.claude_cli import ClaudeCliLLMClient

def _make_source() -> IngestSource:
    return IngestSource(
        url="https://docs.anthropic.com/skills",
        content="Claude Code Skills are reusable instructions...",
        product_id="claude-code",
    )

def test_analyze_calls_claude_cli_with_prompt():
    fake_response = json.dumps({"facts": [], "entities": [], "topics": []})
    with patch("packages.llm_wiki.claude_cli.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout=fake_response, stderr="",
        )
        client = ClaudeCliLLMClient()
        result = client.analyze(_make_source())

    assert result == fake_response
    args = m.call_args[0][0]
    assert args[0] == "claude"
    assert args[1] == "-p"
    assert "claude-code" in args[2]  # product_id in prompt
    assert "https://docs.anthropic.com/skills" in args[2]

def test_analyze_truncates_long_content():
    long_content = "x" * 10000
    source = IngestSource(url="https://x.test", content=long_content, product_id="p")
    fake_response = json.dumps({"facts": [], "entities": [], "topics": []})
    with patch("packages.llm_wiki.claude_cli.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout=fake_response, stderr="",
        )
        client = ClaudeCliLLMClient(content_limit=500)
        client.analyze(source)

    prompt = m.call_args[0][0][2]
    # 500 chars from content + template, but content shouldn't show full 10k
    assert "x" * 500 in prompt
    assert "x" * 600 not in prompt  # truncated

def test_generate_with_facts():
    facts = [{"claim": "Skills support hooks", "evidence_url": "https://docs.anthropic.com/x", "confidence": "EXTRACTED", "dimension_id": "E5"}]
    draft = AnalysisDraft(facts=facts, entities=[], topics=[])

    with patch("packages.llm_wiki.claude_cli.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="# E5 自定义工具\n\nClaude Code: Skill+Hook\n", stderr="",
        )
        client = ClaudeCliLLMClient()
        result = client.generate(draft, _make_source())

    assert "Skill+Hook" in result
    prompt = m.call_args[0][0][2]
    assert "E5" in prompt
    assert "Skills support hooks" in prompt

def test_generate_empty_facts_returns_empty():
    """No facts to render -> skip the LLM call entirely."""
    draft = AnalysisDraft(facts=[], entities=[], topics=[])
    with patch("packages.llm_wiki.claude_cli.subprocess.run") as m:
        client = ClaudeCliLLMClient()
        result = client.generate(draft, _make_source())

    assert result == ""
    assert not m.called  # no subprocess call

def test_call_raises_runtime_error_on_failure():
    import pytest
    with patch("packages.llm_wiki.claude_cli.subprocess.run") as m:
        m.return_value = subprocess.CompletedProcess(
            args=[], returncode=1, stdout="", stderr="auth error",
        )
        client = ClaudeCliLLMClient()
        with pytest.raises(RuntimeError, match="claude CLI failed"):
            client.analyze(_make_source())

def test_call_raises_on_timeout():
    import pytest
    with patch("packages.llm_wiki.claude_cli.subprocess.run") as m:
        m.side_effect = subprocess.TimeoutExpired(cmd=["claude"], timeout=180)
        client = ClaudeCliLLMClient(timeout=180)
        with pytest.raises(RuntimeError, match="timeout"):
            client.analyze(_make_source())

def test_call_raises_on_missing_binary():
    import pytest
    with patch("packages.llm_wiki.claude_cli.subprocess.run") as m:
        m.side_effect = FileNotFoundError()
        client = ClaudeCliLLMClient(claude_bin="/nonexistent/claude")
        with pytest.raises(RuntimeError, match="not found"):
            client.analyze(_make_source())
