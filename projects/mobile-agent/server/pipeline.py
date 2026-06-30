import os
import json
import dashscope
from dataclasses import dataclass, asdict
from typing import List, Optional, Literal
from enum import Enum

# 假设 API_KEY 已在环境变量中设置
API_KEY = os.getenv('DASHSCOPE_API_KEY')

# --- 数据结构定义 (Data Structures) ---

class GenerationPrinciple(str, Enum):
    CONTENT_SUBJECT = "内容主体"
    CORE_CONCEPT = "核心概念"
    KEY_FACTOR = "关键影响因素"
    DISCUSSION_OBJECT = "讨论对象"
    REPRESENTATIVE_ENTITY = "代表性实体"

@dataclass
class Tag:
    name: str
    reason: str  # 证据枚举
    generation_principle: GenerationPrinciple

@dataclass
class Stage1Output:
    tags: List[Tag]
    has_valid_tags: bool

@dataclass
class CandidateQuestion:
    question: str
    reason: str

@dataclass
class Stage2Output:
    topic: Optional[str]
    candidate_questions: List[CandidateQuestion]
    is_topic_formed: bool

@dataclass
class Stage3Output:
    final_theme_title: str
    selected_question: str

# --- 提示词定义 (Prompts) ---

PROMPT_STAGE_1 = """
你是一个严谨的原始信息解析器。
输入：用户的音频内容（转写文本）和截图内容（OCR 文本 + 场景描述）。
输出：Tag 及其生成理由。

【阶段职责】
- 本阶段只允许生成 Tag
- 不允许生成 Topic、研究问题或研究主题
- 允许输出“无有效 Tag”

【重要原则】
1. Tag 只描述“内容在讲什么”，不描述用户行为、App 使用或界面操作
2. 如果原始信号主要是系统操作、工具使用、设置页面、通知栏或无明确内容语义，
   必须明确输出“无有效 Tag”，不要勉强生成
3. Tag 必须是可复用的概念或实体，不应包含时间限定、结论性或情境依赖表达
4. Tag 不能是研究问题或判断的简写形式

【什么是有效 Tag】
- Tag 应为内容层面的概念或实体
- 允许的 Tag 类型包括：
  - domain（领域，如 AI 芯片、宏观经济）
  - concept（概念，如需求变化、成本结构）
  - entity（实体，如公司、产品、机构）
- 禁止生成以下类型的 Tag：
  - 行为类（浏览、点击、使用）
  - UI / 系统类（设置页、通知栏、工具）
  - 内容消费形式（短视频、社交浏览）

【Tag 生成理由（reason）要求】
- 每个 Tag 必须给出生成理由
- 理由必须是可直接回溯到原始信号的客观证据点
- 禁止使用判断性或推测性语言（如“可能”“看起来”“用户感兴趣”）
- 理由应为证据枚举，而非解释或结论

【Tag 生成补充字段】
- 每个 Tag 需要额外给出 generation_principle，用于说明该 Tag 是基于哪一类原则生成
- generation_principle 只能取以下枚举值之一：
  - 内容主体
  - 核心概念
  - 关键影响因素
  - 讨论对象
  - 代表性实体

请以 JSON 格式输出：
{
  "tags": [
    {
      "name": "Tag名称",
      "reason": "证据1, 证据2...",
      "generation_principle": "内容主体"
    }
  ]
}
如果无有效Tag，输出 {"tags": []}
"""

PROMPT_STAGE_2 = """
你负责 Topic 裁决与候选研究问题生成。
输入：多个 Tag，以及每个 Tag 的生成理由和 generation_principle。
输出：真正的 Topic（最多 1 个，或为空），以及基于该 Topic 的候选研究问题。

【阶段职责】
1. 判断这些 Tag 是否足以形成一个稳定的兴趣 Topic
2. 如果可以，只确认一个 Topic
3. 在该 Topic 下生成若干候选研究问题
4. 如果证据不足，必须明确输出“未形成 Topic”

【关于 Topic 的要求】
- Topic 表示一个可长期成立的兴趣空间
- Topic 不是 Tag 的组合或罗列，而是对其所指向的共同兴趣空间的抽象
- Topic 不应是具体问题、结论或分析角度
- Topic 不依赖某个 App、页面或一次性行为
- Topic 主体应来自 domain 类型 Tag
- 本阶段不允许生成多个 Topic

【关于研究问题的要求】
- 研究问题必须基于已确认的 Topic
- 每个问题只能聚焦一个明确判断点
- 问题应能回答“是否 / 是否已经 / 如何影响”
- 问题应是可能被证伪的判断，而不是必然成立的描述
- 禁止生成综述型或泛化问题（如“现状如何”“趋势是什么”）
- 禁止通过“与 / 及 / 和 / 以及”拼接多个问题

【研究问题生成理由要求】
- 理由应说明“为什么这个问题值得现在研究”
- 理由应体现研究价值、新变化或决策意义
- 不要复述 Tag 的来源或出现事实

请以 JSON 格式输出：
{
  "topic": "Topic名称" (或者 null),
  "candidate_questions": [
    {
      "question": "问题文本",
      "reason": "理由文本"
    }
  ]
}
"""

PROMPT_STAGE_3 = """
你负责最终研究主题裁决。
输入：已确认的 Topic，候选研究问题及其生成理由。
输出：唯一一个最终研究主题。

【阶段职责】
1. 从候选研究问题中，选出唯一一个最值得“今天”研究的问题
2. 将该研究问题改写为一个自然、可读、像真实研究文章的主题标题

【重要限制】
- 本阶段不允许生成新的研究问题
- 只能在给定的候选研究问题中进行选择
- 研究主题标题必须直接源自被选中的研究问题

【选择标准】
优先选择：
1. 最近有新变化或新信号的问题
2. 对用户判断或决策有实际帮助的问题
3. 能在 5–10 分钟内讲清的问题

【标题要求】
- 标题必须是自然语言，而不是关键词拼接
- 禁止出现多个“与 / 及 / 和 / 以及”
- 读完标题即可理解研究核心
- 不要对 Topic 进行概括或扩写
- 如果从标题中去掉 Topic 名称，标题仍应完整成立

请以 JSON 格式输出：
{
  "selected_question": "选中的原问题",
  "final_theme_title": "最终主题标题"
}
"""

# --- 管道逻辑 (Pipeline Logic) ---

class Pipeline:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or API_KEY
        if not self.api_key:
            print("警告: 未检测到 DASHSCOPE_API_KEY")

    def _call_llm(self, prompt: str, user_content: str) -> dict:
        """通用 LLM 调用函数"""
        messages = [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': user_content}
        ]
        try:
            # 使用 qwen-plus 或 qwen-max 以获得更好的指令遵循能力
            response = dashscope.Generation.call(
                api_key=self.api_key,
                model="qwen-plus", 
                messages=messages,
                result_format='message'
            )
            if response.status_code == 200:
                content = response.output.choices[0].message.content
                # 尝试清洗 JSON
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                return json.loads(content.strip())
            else:
                print(f"API 错误: {response.code} - {response.message}")
                return {}
        except Exception as e:
            print(f"LLM 调用异常: {e}")
            return {}

    def execute_stage_1(self, audio_text: str, screenshot_desc: str) -> Stage1Output:
        """阶段一：原始信息解析"""
        print(f"\n{'='*20}\n 阶段一：原始信息解析 \n{'='*20}")
        input_text = f"【用户音频内容】：\n{audio_text}\n\n【用户截图内容】：\n{screenshot_desc}"
        
        result = self._call_llm(PROMPT_STAGE_1, input_text)
        
        tags_data = result.get("tags", [])
        if not tags_data:
            print(">> 结果：无有效 Tag")
            return Stage1Output(tags=[], has_valid_tags=False)
            
        tags = []
        try:
            for t in tags_data:
                tags.append(Tag(
                    name=t['name'],
                    reason=t['reason'],
                    generation_principle=GenerationPrinciple(t['generation_principle'])
                ))
            print(f">> 结果：生成 {len(tags)} 个 Tag")
            for t in tags:
                print(f"   - [{t.generation_principle}] {t.name}: {t.reason}")
            return Stage1Output(tags=tags, has_valid_tags=True)
        except ValueError as e:
            print(f">> 错误：Tag 解析失败 ({e})")
            return Stage1Output(tags=[], has_valid_tags=False)

    def execute_stage_2(self, stage1_output: Stage1Output) -> Stage2Output:
        """阶段二：Topic 裁决 + 候选研究问题生成"""
        print(f"\n{'='*20}\n 阶段二：Topic 裁决 \n{'='*20}")
        if not stage1_output.has_valid_tags:
            print(">> 跳过：因无有效 Tag")
            return Stage2Output(topic=None, candidate_questions=[], is_topic_formed=False)
            
        # 序列化 Tags
        tags_input = json.dumps([asdict(t) for t in stage1_output.tags], ensure_ascii=False, indent=2)
        result = self._call_llm(PROMPT_STAGE_2, f"Tags 输入数据：\n{tags_input}")
        
        topic = result.get("topic")
        if not topic or topic == "NO_TOPIC":
             print(">> 结果：未形成 Topic")
             return Stage2Output(topic=None, candidate_questions=[], is_topic_formed=False)
             
        questions_data = result.get("candidate_questions", [])
        questions = [CandidateQuestion(q['question'], q['reason']) for q in questions_data]
        
        print(f">> 结果：确认 Topic -> 【{topic}】")
        print(f">> 生成 {len(questions)} 个候选问题：")
        for q in questions:
            print(f"   - {q.question} ({q.reason})")
            
        return Stage2Output(topic=topic, candidate_questions=questions, is_topic_formed=True)

    def execute_stage_3(self, stage2_output: Stage2Output) -> Stage3Output:
        """阶段三：最终研究主题裁决"""
        print(f"\n{'='*20}\n 阶段三：最终研究主题裁决 \n{'='*20}")
        if not stage2_output.is_topic_formed:
            print(">> 跳过：因未形成 Topic")
            return Stage3Output(final_theme_title="", selected_question="")
            
        input_data = {
            "topic": stage2_output.topic,
            "candidate_questions": [asdict(q) for q in stage2_output.candidate_questions]
        }
        result = self._call_llm(PROMPT_STAGE_3, json.dumps(input_data, ensure_ascii=False, indent=2))
        
        title = result.get("final_theme_title", "")
        selected = result.get("selected_question", "")
        
        print(f">> 结果：选中问题 -> {selected}")
        print(f">> 最终主题 -> 【{title}】")
        return Stage3Output(final_theme_title=title, selected_question=selected)

    def run(self, audio_text: str, screenshot_desc: str):
        s1 = self.execute_stage_1(audio_text, screenshot_desc)
        if not s1.has_valid_tags:
            return None
            
        s2 = self.execute_stage_2(s1)
        if not s2.is_topic_formed:
            return None
            
        s3 = self.execute_stage_3(s2)
        return s3

# --- 测试运行 (Test Run) ---
if __name__ == "__main__":
    if not API_KEY:
        print("请设置环境变量 DASHSCOPE_API_KEY")
    else:
        pipeline = Pipeline()
        
        # 模拟输入
        mock_audio = "最近一直在关注英伟达的财报，感觉AI芯片的需求还在暴涨，但是成本好像也控制不住了。"
        mock_screen = "屏幕显示一篇关于台积电涨价的新闻报道，重点标记了CoWoS封装产能不足的部分。"
        
        print("开始测试流水线...")
        pipeline.run(mock_audio, mock_screen)
