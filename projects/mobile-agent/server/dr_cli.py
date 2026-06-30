import os
import dashscope

API_KEY = os.getenv('DASHSCOPE_API_KEY')

def call_deep_research_model(messages, step_name):
    print(f"\n=== {step_name} ===")
    try:
        responses = dashscope.Generation.call(
            api_key=API_KEY,
            model="qwen-deep-research",
            messages=messages,
            stream=True,
        )
        return process_responses(responses, step_name)
    except Exception as e:
        print(f"调用API时发生错误: {e}")
        return ""

def process_responses(responses, step_name):
    current_phase = None
    phase_content = ""
    research_goal = ""
    web_sites = []
    references = []
    keepalive_shown = False

    for response in responses:
        if hasattr(response, 'status_code') and response.status_code != 200:
            print(f"HTTP返回码：{response.status_code}")
            if hasattr(response, 'code'):
                print(f"错误码：{response.code}")
            if hasattr(response, 'message'):
                print(f"错误信息：{response.message}")
            print("请参考文档： https://help.aliyun.com/zh/model-studio/developer-reference/error-code ")
            continue

        if hasattr(response, 'output') and response.output:
            message = response.output.get('message', {})
            phase = message.get('phase')
            content = message.get('content', '')
            status = message.get('status')
            extra = message.get('extra', {})

            if phase != current_phase:
                if current_phase and phase_content:
                    if step_name == "第一步：模型反问确认" and current_phase == "answer":
                        print(f"\n 模型反问阶段完成")
                    else:
                        print(f"\n {current_phase} 阶段完成")
                current_phase = phase
                phase_content = ""
                keepalive_shown = False

                if step_name == "第一步：模型反问确认" and phase == "answer":
                    print(f"\n 进入模型反问阶段")
                else:
                    print(f"\n 进入 {phase} 阶段")

            if phase == "answer":
                if extra.get('deep_research', {}).get('references'):
                    new_references = extra['deep_research']['references']
                    if new_references and new_references != references:
                        references = new_references
                        print(f"\n   引用来源 ({len(references)} 个):")
                        for i, ref in enumerate(references, 1):
                            print(f"     {i}. {ref.get('title', '无标题')}")
                            if ref.get('url'):
                                print(f"        URL: {ref['url']}")
                            if ref.get('description'):
                                print(f"        描述: {ref['description'][:100]}...")
                            print()

            if phase == "WebResearch":
                if extra.get('deep_research', {}).get('research'):
                    research_info = extra['deep_research']['research']
                    if status == "streamingQueries":
                        if 'researchGoal' in research_info:
                            goal = research_info['researchGoal']
                            if goal:
                                research_goal += goal
                                print(f"\n   研究目标: {goal}", end='', flush=True)
                    elif status == "streamingWebResult":
                        if 'webSites' in research_info:
                            sites = research_info['webSites']
                            if sites and sites != web_sites:
                                web_sites = sites
                                print(f"\n   找到 {len(sites)} 个相关网站:")
                                for i, site in enumerate(sites, 1):
                                    print(f"     {i}. {site.get('title', '无标题')}")
                                    print(f"        描述: {site.get('description', '无描述')[:100]}...")
                                    print(f"        URL: {site.get('url', '无链接')}")
                                    if site.get('favicon'):
                                        print(f"        图标: {site['favicon']}")
                                    print()
                    elif status == "WebResultFinished":
                        print(f"\n   网络搜索完成，共找到 {len(web_sites)} 个参考信息源")
                        if research_goal:
                            print(f"   研究目标: {research_goal}")

            if content:
                phase_content += content
                print(content, end='', flush=True)

            if status and status != "typing":
                print(f"\n   状态: {status}")
                if status == "streamingQueries":
                    print("   → 正在生成研究目标和搜索查询（WebResearch阶段）")
                elif status == "streamingWebResult":
                    print("   → 正在执行搜索、网页阅读和代码执行（WebResearch阶段）")
                elif status == "WebResultFinished":
                    print("   → 网络搜索阶段完成（WebResearch阶段）")

            if status == "finished":
                if hasattr(response, 'usage') and response.usage:
                    usage = response.usage
                    print(f"\n    Token消耗统计:")
                    print(f"      输入tokens: {usage.get('input_tokens', 0)}")
                    print(f"      输出tokens: {usage.get('output_tokens', 0)}")
                    print(f"      请求ID: {getattr(response, 'request_id', '未知')}")

            if phase == "KeepAlive":
                if not keepalive_shown:
                    print("当前步骤已经完成，准备开始下一步骤工作")
                    keepalive_shown = True
                continue

    if current_phase and phase_content:
        if step_name == "第一步：模型反问确认" and current_phase == "answer":
            print(f"\n 模型反问阶段完成")
        else:
            print(f"\n {current_phase} 阶段完成")

    return phase_content

def main():
    if not API_KEY:
        print("错误：未设置 DASHSCOPE_API_KEY 环境变量")
        print("请设置环境变量或直接在代码中修改 API_KEY 变量")
        return

    print("用户发起对话：研究一下人工智能在教育中的应用")

    messages = [{'role': 'user', 'content': '研究一下人工智能在教育中的应用'}]
    step1_content = call_deep_research_model(messages, "第一步：模型反问确认")

    messages = [
        {'role': 'user', 'content': '研究一下人工智能在教育中的应用'},
        {'role': 'assistant', 'content': step1_content},
        {'role': 'user', 'content': '直接开始研究'}
    ]

    call_deep_research_model(messages, "第二步：深入研究")
    print("\n 研究完成！")

if __name__ == "__main__":
    main()
