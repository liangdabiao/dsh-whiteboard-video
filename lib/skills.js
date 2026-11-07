// 手绘讲解视频 · 技能快照提供方。
// 快照 = 完整的上游 Claude Code skill（SKILL.md + references + scripts + assets）。
// dsh 化的关键在 addendum：模型沙箱读不到插件安装目录，**第一步必须把技能目录
// 完整复制到工作区**，之后的所有 python/node 命令都在工作区副本里跑。
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RANK = 600
const INVOCATION = { modelInvocable: true, userInvocable: true }

function parse(file) {
  const text = readFileSync(file, 'utf8')
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return null
  const block = m[1]
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  let description = block.match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^(["'])(.*)\1$/, '$2') || null
  if (!description) {
    const lines = block.split(/\r?\n/)
    const start = lines.findIndex((l) => /^description:\s*>/.test(l))
    if (start !== -1) {
      const collected = []
      for (let i = start + 1; i < lines.length; i++) {
        if (/^\S/.test(lines[i])) break
        collected.push(lines[i].replace(/^\s+/, ''))
      }
      description = collected.join(' ').trim()
    }
  }
  return name && description ? { name, description, body: text.slice(m[0].length) } : null
}

function readDir(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const sDir = join(dir, entry.name)
    const skillFile = join(sDir, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    const parsed = parse(skillFile)
    if (!parsed) continue
    out.push({ dir: sDir, file: skillFile, ...parsed, dirName: entry.name })
  }
  return out
}

// 分镜示例清单（assets/storyboard-*.json），供面板与 addendum 引用
export function listStoryboards(skillDirs) {
  const out = []
  for (const dir of [].concat(skillDirs)) {
    const assetsDir = join(dir, 'assets')
    if (!existsSync(assetsDir)) continue
    for (const f of readdirSync(assetsDir)) {
      if (/^storyboard-.*\.json$/.test(f)) {
        try {
          const data = JSON.parse(readFileSync(join(assetsDir, f), 'utf8'))
          out.push({
            file: f,
            title: data.title || f.replace(/^storyboard-/, '').replace(/\.json$/, ''),
            pages: Array.isArray(data.pages) ? data.pages.length : (Array.isArray(data.scenes) ? data.scenes.length : null),
          })
        } catch { /* 坏文件跳过 */ }
      }
    }
  }
  return out
}

function addendum(skill) {
  return [
    '',
    '---',
    '',
    '## 在 DSH 插件里使用（重要：先复制再执行）',
    '',
    `- 本技能目录：\`${skill.dir}\`。**你的 bash 沙箱读不到插件安装目录**——动手前第一步，把整个技能目录复制到当前工作区：`,
    '  ```bash',
    `  cp -r "${skill.dir}" ./whiteboard-video`,
    '  ```',
    '- 之后的所有命令都在工作区副本 `./whiteboard-video/` 里执行：`cd whiteboard-video` 再跑 `python scripts/ftnew.py` 等。',
    '- 首次制作视频前先跑一次环境安装（在副本里）：`python scripts/setup.py`——从 GitHub 拉取渲染引擎（约 16MB，sparse checkout）+ npm 安装依赖（约 130MB）。需要本机有 git、Node 22+、Python 3、Chrome 或 Edge（dsh 桌面版自带 Edge）。',
    '- 配音默认 edge-tts（免费、无需 API key）；脚本已自动走新域名。',
    '- 分镜示例在副本 `assets/storyboard-*.json`（13 个真实项目的分镜，可参考结构）。',
    '- 项目与产物（project/、out/）都在工作区，不要往插件安装目录写文件。',
    '',
  ].join('\n')
}

function rewrite(skill) {
  // SKILL.md 正文用相对路径 scripts/xxx.py，复制到工作区后天然正确——无残留需改写。
  // README 的 GitHub 安装说明不在 SKILL.md 正文，不动。
  return skill.body
}

export function createSkillProvider(dirs) {
  const list = [].concat(dirs)
  const candidate = (s) => ({
    name: s.name,
    description: s.description,
    path: s.file,
    invocation: INVOCATION,
    source: 'bundled',
    provider: 'whiteboard-video',
    rank: RANK,
    locator: s.dir,
    resourceBase: { kind: 'directory', path: s.dir },
  })

  return {
    name: 'whiteboard-video',
    async list() {
      return list.flatMap(readDir).map(candidate)
    },
    async get(c) {
      const s = list.flatMap(readDir).find((x) => x.dir === c.locator && x.name === c.name)
      if (!s) return undefined
      const content = rewrite(s) + addendum(s)
      const { rank, locator, ...summary } = candidate(s)
      return { ...summary, content }
    },
  }
}

export { readDir, addendum }
