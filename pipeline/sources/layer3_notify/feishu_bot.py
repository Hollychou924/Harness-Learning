import logging
import os
import httpx

logger = logging.getLogger(__name__)


async def push_changelog_card(
    client: httpx.AsyncClient,
    *,
    product_name: str,
    score: float,
    entry_count: int,
    report_url: str,
) -> bool:
    """Push a changelog summary card to Feishu via custom bot webhook.

    Returns True on success (StatusCode == 0), False otherwise.
    """
    webhook = os.environ.get("FEISHU_BOT_WEBHOOK")
    if not webhook:
        logger.info("FEISHU_BOT_WEBHOOK not set; skipping push")
        return False

    payload = {
        "msg_type": "interactive",
        "card": {
            "header": {"title": {"tag": "plain_text", "content": f"📡 {product_name} 变更"}},
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md",
                 "content": f"**重要性:** {score:.2f} · **变更数:** {entry_count}"}},
                {"tag": "action", "actions": [
                    {"tag": "button",
                     "text": {"tag": "plain_text", "content": "查看报告"},
                     "url": report_url, "type": "default"},
                ]},
            ],
        },
    }
    try:
        r = await client.post(webhook, json=payload, timeout=15.0)
        r.raise_for_status()
        data = r.json()
        return data.get("StatusCode") == 0
    except httpx.HTTPError as e:
        logger.warning("Feishu bot push failed: %s", e)
        return False
