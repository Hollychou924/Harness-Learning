#!/usr/bin/env python3
"""本地草稿 -> 飞书发布版 markdown 转换。

做三件事(对外发布清理):
  1. 删掉内部块:草稿头(> 草稿版本…那一段引用)、文末 <!-- ... --> 注释块。
  2. 去掉正文里的内部编号:标题/小标题开头的 "数字、" 、行内的 (Q1)(Q2)…、把 "见 E3"→"见第3章" 之类。
     —— 保守起见,只动"标题行/小标题行开头的序号"和 "(Q\\d+)" ,正文中提到的 E1-E9 统一替换为"第N章"。
  3. 用 --title 覆盖一级标题(套用飞书对外标题)。

用法:
  to-publish.py <local.md> --title "《…》(2/9) · 循环与编排篇——任务怎么跑起来又不跑飞" > out.md
"""
import sys,re

def convert(text, title=None):
    lines=text.split('\n')
    out=[]
    infence=False
    i=0
    # 删除文末 HTML 注释块
    text2=re.sub(r'<!--.*?-->','',text,flags=re.S)
    lines=text2.split('\n')
    skip_frontquote=False
    for idx,line in enumerate(lines):
        s=line.strip()
        if s.startswith('```'):
            infence=not infence; out.append(line); continue
        if infence:
            out.append(line); continue
        # 1) 一级标题替换
        if s.startswith('# ') and title and not any(o.startswith('# ') for o in out):
            out.append('# '+title); continue
        # 2) 删草稿头引用块:以 "> 草稿版本" 开头,直到下一个非 > 行
        if re.match(r'^>\s*草稿版本', s):
            skip_frontquote=True
            continue
        if skip_frontquote:
            if s.startswith('>') or s=='':
                continue
            else:
                skip_frontquote=False
        # 3) 去正文内部编号
        # (Q1)(Q1-Q5)（Q6）等
        line=re.sub(r'[（(]\s*Q[\d\- ]+\s*[)）]','',line)
        # 见 E3 / (E4) / E5 专门讲 -> 第N章
        line=re.sub(r'[（(]?\bE([1-9])\b[)）]?', lambda m:'第%s章'%m.group(1), line)
        # 去掉 '第N章' 后紧跟的多余空格(原 'E1 七层' -> '第1章七层')
        line=re.sub(r'(第[1-9]章) +', r'\1', line)
        out.append(line)
    res='\n'.join(out)
    # 清理因删注释留下的多余空行(>=3 连续空行压成2)
    res=re.sub(r'\n{3,}','\n\n',res).strip()+'\n'
    return res

def main():
    args=sys.argv[1:]
    title=None
    if '--title' in args:
        ti=args.index('--title'); title=args[ti+1]; args=args[:ti]+args[ti+2:]
    src=args[0]
    text=open(src,encoding='utf-8').read()
    sys.stdout.write(convert(text,title))

if __name__=='__main__':
    main()
