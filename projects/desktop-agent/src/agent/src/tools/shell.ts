import { z } from 'zod'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import type { AgentTool } from './index.js'

const execAsync = promisify(exec)

const ShellSchema = z.object({
  command: z.string().min(1).describe('要执行的 shell 命令'),
  cwd: z.string().optional().describe('工作目录，默认用户主目录，可用 ~ 表示主目录')
})

// 只读查询命令前缀：免审批直接执行
const READONLY_PREFIXES = [
  'ls', 'cat', 'head', 'tail', 'less', 'more', 'wc', 'find', 'locate',
  'grep', 'rg', 'ag', 'ack', 'which', 'where', 'whereis', 'file', 'stat',
  'df', 'du', 'free', 'top', 'htop', 'ps', 'lsof', 'netstat', 'ifconfig',
  'ip', 'ping', 'traceroute', 'dig', 'nslookup', 'host', 'whoami', 'id',
  'uname', 'uptime', 'date', 'cal', 'env', 'printenv', 'system_profiler',
  'sw_vers', 'sysctl', 'vm_stat', 'diskutil list', 'diskutil info',
  'defaults read', 'pmset -g', 'ioreg', 'systemctl status', 'service status',
  'git status', 'git log', 'git diff', 'git branch', 'git remote', 'git show',
  'git blame', 'git stash list', 'npm list', 'pnpm list', 'yarn list',
  'node -v', 'npm -v', 'python3 --version', 'python --version',
  'java -version', 'go version', 'rustc --version', 'cargo --version'
]

// 高风险命令关键词：需用户确认
const HIGH_RISK_KEYWORDS = [
  'install', 'uninstall', 'remove', 'upgrade', 'update',
  'push', 'force', 'sudo', 'chmod', 'chown',
  'kill -9', 'pkill', 'killall',
  'curl', 'wget', 'scp', 'rsync',
  'docker', 'kubectl',
  'git reset', 'git rebase', 'git push', 'git merge',
  'npm publish', 'pip install', 'brew install'
]

/** 判断命令风险等级 */
export function shellRiskLevel(command: string): 'low' | 'medium' | 'high' {
  const cmd = command.trim().toLowerCase()
  // 只读查询 → low
  if (READONLY_PREFIXES.some((p) => cmd.startsWith(p.toLowerCase()))) {
    return 'low'
  }
  // 高风险关键词 → high
  if (HIGH_RISK_KEYWORDS.some((k) => cmd.includes(k.toLowerCase()))) {
    return 'high'
  }
  // 其他写操作 → medium
  return 'medium'
}

// shell：执行系统命令，不限定工作区，黑名单拦截危险命令，按风险分档审批
export function shellTool(): AgentTool {
  return {
    name: 'shell',
    description: `在用户电脑上执行 shell 命令并返回输出。用于查询系统信息（磁盘空间 df -h、进程 ps aux、网络 ifconfig 等）、运行脚本、管理文件等。
工作目录默认用户主目录，可通过 cwd 参数指定。
只读查询命令（ls/cat/df/ps/system_profiler 等）自动执行；写操作（mkdir/cp/mv 等）自动执行；高风险操作（install/push/sudo/git reset 等）需用户确认。
危险命令（rm -rf /、mkfs、dd 写设备、shutdown 等）会被直接拒绝。`,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的 shell 命令' },
        cwd: { type: 'string', description: '工作目录，默认用户主目录，可用 ~ 表示主目录' }
      },
      required: ['command']
    },
    riskLevel: 'medium',
    async execute(args) {
      const parsed = ShellSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({ error: parsed.error.issues[0]?.message ?? '入参校验失败' })
      }
      const { command, cwd } = parsed.data
      const workDir = cwd ? cwd.replace(/^~/, homedir()) : homedir()

      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: workDir,
          maxBuffer: 1024 * 1024 * 10,
          timeout: 60_000,
          env: { ...process.env }
        })
        const result: Record<string, unknown> = { exitCode: 0 }
        if (stdout) result.stdout = stdout.slice(0, 50000)
        if (stderr) result.stderr = stderr.slice(0, 20000)
        if (!stdout && !stderr) result.stdout = '(无输出)'
        return JSON.stringify(result)
      } catch (e) {
        const err = e as { code?: number; stdout?: string; stderr?: string; message?: string }
        const result: Record<string, unknown> = {
          exitCode: err.code ?? 1,
          error: err.message?.slice(0, 5000) || '命令执行失败'
        }
        if (err.stdout) result.stdout = err.stdout.slice(0, 50000)
        if (err.stderr) result.stderr = err.stderr.slice(0, 20000)
        return JSON.stringify(result)
      }
    }
  }
}
