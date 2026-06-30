#!/usr/bin/env python3
"""半角中文标点自检 / 修复脚本

用法:
  python3 check-punctuation.py <file_or_dir> [more...]      # 只检查,列出残留半角标点位置
  python3 check-punctuation.py --fix <file_or_dir> [...]    # 直接就地修复

判定规则(保守,避免误伤代码/英文):
  只有当半角标点 , : ? ; ( ) ! 的【左边或右边紧邻一个中文字符】时,才算"中文正文里的半角标点",需要换成全角。
  这样能避开:URL、文件名、24.86%、A/B、SWE-bench、纯英文句子、代码标识符等。

跳过区域:
  - 围栏代码块 ``` ... ```
  - 行内代码 `...`
"""
import sys, re, os

# 半角 -> 全角(中文上下文)
PAIRS = {',': '，', ':': '：', '?': '？', ';': '；', '!': '！', '(': '（', ')': '）'}
CJK = r'\u4e00-\u9fff\u3000-\u303f\uff00-\uffef'  # 中日韩 + 中文标点区
cjk_re = re.compile(f'[{CJK}]')

def is_cjk(ch):
    return bool(ch) and bool(cjk_re.match(ch))


PAREN_OPEN={'(':'（','（':'（'}
PAREN_CLOSE={')':'）','）':'）'}
def normalize_parens(line, code_mask):
    """成对括号:若一对括号(就近匹配)内容含中文,则两端统一全角;否则两端统一半角。
    只处理不在行内代码里的括号。返回新行。"""
    chars=list(line)
    stack=[]
    for i,ch in enumerate(chars):
        if code_mask[i]:
            continue
        if ch in ('(','（'):
            stack.append(i)
        elif ch in (')','）'):
            if not stack:
                continue
            j=stack.pop()
            inner=line[j+1:i]
            left_ch=line[j-1] if j>0 else ''
            right_ch=line[i+1] if i+1<len(line) else ''
            # 括号内含中文,或括号紧邻中文(说明它嵌在中文句子里) -> 两端全角
            has_cjk=any(is_cjk(c) for c in inner) or is_cjk(left_ch) or is_cjk(right_ch)
            if has_cjk:
                chars[j]='（'; chars[i]='）'
            else:
                chars[j]='('; chars[i]=')'
    return ''.join(chars)

def split_inline_code(line):
    """把一行按 `行内代码` 切成 (text, is_code) 片段。"""
    parts, buf, i, in_code = [], '', 0, False
    while i < len(line):
        if line[i] == '`':
            parts.append((buf, in_code)); buf=''; in_code = not in_code; i+=1; continue
        buf += line[i]; i+=1
    parts.append((buf, in_code))
    return parts

def scan_line(line):
    """返回该行需要修正的 (col, half, full) 列表(基于原始行的列号,1-based)。"""
    hits=[]
    # 标记行内代码区间为不可改
    code_mask=[False]*len(line)
    in_code=False
    for idx,ch in enumerate(line):
        if ch=='`':
            in_code=not in_code
            code_mask[idx]=True  # 反引号本身不改
            continue
        code_mask[idx]=in_code
    for idx,ch in enumerate(line):
        if ch in PAIRS and not code_mask[idx]:
            left = line[idx-1] if idx>0 else ''
            right = line[idx+1] if idx+1<len(line) else ''
            if is_cjk(left) or is_cjk(right):
                hits.append((idx+1, ch, PAIRS[ch]))
    return hits

def process_file(path, fix=False):
    with open(path, encoding='utf-8') as f:
        lines=f.readlines()
    total=0; out=[]; in_fence=False
    new_lines=[]
    for ln,line in enumerate(lines, start=1):
        stripped=line.lstrip()
        if stripped.startswith('```'):
            in_fence=not in_fence
            new_lines.append(line); continue
        if in_fence:
            new_lines.append(line); continue
        hits=scan_line(line)
        if hits:
            total+=len(hits)
            for col,half,full in hits:
                out.append(f"  {path}:{ln}:{col}  '{half}' → '{full}'")
            if fix:
                chars=list(line)
                for col,half,full in hits:
                    chars[col-1]=full
                line=''.join(chars)
        # 标点替换后再做括号成对规整(仅 fix)
        if fix:
            code_mask=[False]*len(line); in_c=False
            for idx,ch in enumerate(line):
                if ch=='`': in_c=not in_c; code_mask[idx]=True; continue
                code_mask[idx]=in_c
            line=normalize_parens(line, code_mask)
        new_lines.append(line)
    if fix and (total or new_lines!=lines):
        with open(path,'w',encoding='utf-8') as f:
            f.writelines(new_lines)
    return total, out

def iter_targets(paths):
    for p in paths:
        if os.path.isdir(p):
            for root,_,files in os.walk(p):
                for fn in files:
                    if fn.endswith('.md'):
                        yield os.path.join(root,fn)
        elif p.endswith('.md'):
            yield p

def main():
    args=sys.argv[1:]
    fix=False
    if args and args[0]=='--fix':
        fix=True; args=args[1:]
    if not args:
        print("用法: check-punctuation.py [--fix] <file_or_dir> ..."); sys.exit(2)
    grand=0
    for path in iter_targets(args):
        if fix:
            # 反复修复到收敛(全角化后可能暴露新的中文邻接标点)
            total_fixed=0
            for _ in range(10):
                n,out=process_file(path, fix=True)
                total_fixed+=n
                if n==0: break
            if total_fixed:
                grand+=total_fixed
                print(f"[{total_fixed:>3}] {path} (已修复)")
        else:
            n,out=process_file(path, fix=False)
            if n:
                grand+=n
                print(f"[{n:>3}] {path}")
                for line in out: print(line)
    verb="已修复" if fix else "发现"
    print(f"\n== {verb} {grand} 处中文正文里的半角标点 ==")
    sys.exit(1 if (grand and not fix) else 0)

if __name__=='__main__':
    main()
