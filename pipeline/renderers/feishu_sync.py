"""Feishu Wiki single-direction sync (Phase 3 MVP).

Pushes a rendered Markdown report to a Feishu Wiki node by shelling out to the
user's installed `feishu` skill/CLI. Fail-soft semantics:

- If `feishu` is not in PATH → log warning, return False.
- If subprocess fails (non-zero exit, timeout) → log warning, return False.
- Always cleans up the temporary Markdown file in a finally block.

The exact CLI shape (`feishu wiki create-doc --title ... --parent ... --from-file ...`)
is a best-effort guess based on typical wiki-sync semantics; Phase 4 hardening
can replace this with the real shape once the user's feishu skill is finalized.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

_FEISHU_TIMEOUT_SECONDS = 60


def sync_to_feishu_wiki(
    *,
    markdown: str,
    title: str,
    parent_node_token: str,
) -> bool:
    """Push markdown content to a Feishu Wiki node via the `feishu` skill.

    Args:
        markdown: Rendered comparison report content.
        title: Wiki document title.
        parent_node_token: Parent wiki node token (where the new doc will be created under).

    Returns:
        True on successful sync, False on any failure (CLI missing, subprocess
        error, timeout, non-zero exit). Failures are logged at WARNING level and
        never raised — caller can treat sync as best-effort.
    """
    if not shutil.which("feishu"):
        logger.warning("feishu CLI not in PATH; skipping wiki sync")
        return False

    # Most CLIs prefer file path over stdin for multi-line markdown payloads.
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8",
    ) as tf:
        tf.write(markdown)
        tmp_path = tf.name

    try:
        try:
            result = subprocess.run(
                [
                    "feishu", "wiki", "create-doc",
                    "--title", title,
                    "--parent", parent_node_token,
                    "--from-file", tmp_path,
                ],
                capture_output=True,
                text=True,
                timeout=_FEISHU_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            logger.warning("feishu sync timed out after %ss", _FEISHU_TIMEOUT_SECONDS)
            return False

        if result.returncode != 0:
            logger.warning(
                "feishu sync failed (exit %d): %s",
                result.returncode,
                result.stderr.strip()[:200],
            )
            return False
        return True
    finally:
        Path(tmp_path).unlink(missing_ok=True)
