from datetime import datetime
from enum import Enum
from typing import Literal
from pydantic import BaseModel, HttpUrl

class Confidence(str, Enum):
    EXTRACTED = "EXTRACTED"      # 一手源直接抽取
    INFERRED = "INFERRED"        # 已知事实推理而来
    AMBIGUOUS = "AMBIGUOUS"      # 多源冲突, 进 review 队列
    UNVERIFIED = "UNVERIFIED"    # 未验证, 不进最终报告

class ProductEvaluation(BaseModel):
    product_id: str
    dimension_id: str
    value: str | float | int | list[str]
    evidence_urls: list[HttpUrl]
    evaluator: str  # "llm:claude-opus-4-7" | "human:zhouhao"
    confidence: Confidence
    last_verified: datetime
    review_status: Literal["pending", "approved", "rejected"] | None = None
    review_decision_at: datetime | None = None
    reviewer: str | None = None
