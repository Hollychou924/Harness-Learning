from typing import Literal
from pydantic import BaseModel, Field

class Dimension(BaseModel):
    id: str  # e.g. "E5"
    name: str
    group: str  # e.g. "Agent Harness 执行"
    importance: Literal["critical", "high", "medium", "low"]
    weight_in_group_pct: float = Field(ge=0.0, le=100.0)
    evaluation_type: Literal["enum", "numeric", "score_0_3", "text", "multi_select"]
    enum_values: list[str] | None = None
    rubric: str
    data_sources: list[str]  # e.g. ["L0:official_docs", "L2:search"]
