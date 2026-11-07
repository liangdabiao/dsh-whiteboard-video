// 手绘讲解视频 · Host 半边（技能提供方 + whiteboard_project/whiteboard_storyboard 原生工具 + 面板数据面）。
// 渲染管线由模型在工作区副本里用 bash 驱动（python scripts/ft*.py），Host 不参与重活。
import Schema from '@deepseek-ai/schemastery'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSkillProvider, listStoryboards } from '../lib/skills.js'
import { registerApi } from '../lib/api.js'
import { getProject, initProject, updateStage, clearProject, validateStoryboard, DEFAULT_STAGES, STATUSES } from '../lib/data.js'

export const name = 'whiteboard-video' // = cordis.patch.yml 的 id

export const inject = ['tools', 'skills', 'webServer', 'connection']

export const Config = Schema.object({})

function check(args, spec) {
  const problems = []
  for (const key of spec.required || []) {
    if (args?.[key] === undefined) problems.push(`缺少必填参数 ${key}`)
  }
  for (const [key, rule] of Object.entries(spec.properties || {})) {
    const value = args?.[key]
    if (value === undefined) continue
    if (rule.enum && !rule.enum.includes(value)) problems.push(`${key} 只能是 ${rule.enum.join(' / ')} 之一`)
  }
  for (const key of Object.keys(args || {})) {
    if (!spec.properties || !(key in spec.properties)) problems.push(`未知参数 ${key}`)
  }
  if (problems.length) throw new Error(`参数有误：${problems.join('；')}。`)
}

const str = (description, extra = {}) => ({ type: 'string', description, ...extra })
const num = (description, extra = {}) => ({ type: 'number', description, ...extra })
const text = (value) => [{ type: 'text', text: value }]

const OUTPUT = {
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['ok', 'summary'],
    properties: {
      ok: { type: 'boolean' },
      summary: { type: 'string', description: '给模型看的回执' },
      data: { type: 'string', description: '可选：进度清单/校验结果/样例正文' },
    },
  },
  render: (_args, value) => text(value.data ? `${value.summary}\n\n${value.data}` : value.summary),
}

const result = (ok, summary, data = '') => ({ ok, summary, data })

// ---------------------------------------------------------------------------
// 工具 1：whiteboard_project —— 制作进度持久化
// ---------------------------------------------------------------------------
export const whiteboardProjectTool = {
  name: 'whiteboard_project',
  description:
    '管理手绘讲解视频的制作进度（持久化）：init 建制作清单（默认 6 阶段：脚本→分镜→环境→配音→校验→渲染）、' +
    'status 更新阶段进度、list 看进度。制作视频时先 init，每完成一个阶段用 status 记录，用户可在侧栏面板看进度。',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: str('init 建清单；status 更新阶段；list 看进度；clear 清空', { enum: ['init', 'status', 'list', 'clear'] }),
      title: str('init：视频标题/主题'),
      stages: str('init：可选，自定义阶段（竖线分隔）。缺省用 6 阶段默认管线'),
      index: num('status：阶段序号（从 1 开始）'),
      status: str('status：todo / doing / done', { enum: STATUSES }),
      note: str('status：可选，备注（如产物路径）'),
      confirm: str('init 覆盖 / clear 清空，都要传 "yes"', { enum: ['yes'] }),
    },
  },
  output: OUTPUT,
  async execute(args) {
    check(args, this.parameters)
    if (args.action === 'init') {
      if (!args.title) throw new Error('init 需要 title（视频标题/主题）。')
      const stages = args.stages ? args.stages.split('|').map((s) => s.trim()).filter(Boolean) : DEFAULT_STAGES
      const project = initProject(args.title, stages, args.confirm === 'yes')
      if (project.conflict) {
        return result(false, `已有制作清单「${project.title}」共 ${project.items} 阶段。要覆盖请用 confirm:"yes"。`)
      }
      return result(true, `「${project.title}」制作清单已建立（${stages.length} 阶段）。技能目录里的 Python 管线（ftnew/ftvoice/ftcheck/ftrender.py）需先复制到工作区再执行。`,
        stages.map((t, i) => `${i + 1}. ${t} [todo]`).join('\n'))
    }
    if (args.action === 'status') {
      if (!args.index) throw new Error('status 需要 index（阶段序号）。')
      const item = updateStage(args.index, { status: args.status, note: args.note })
      if (!item) return result(false, '还没有制作清单，先 init。')
      return result(true, `阶段 ${item.index}「${item.stage}」→ ${item.status}${item.note ? `（${item.note}）` : ''}。`)
    }
    if (args.action === 'clear') {
      if (args.confirm !== 'yes') return result(false, '清空制作清单请用 confirm:"yes"。')
      clearProject()
      return result(true, '制作清单已清空。')
    }
    const project = getProject()
    if (!project.items.length) return result(true, '还没有制作清单。init 一个即可开始（默认 6 阶段管线）。')
    const done = project.items.filter((it) => it.status === 'done').length
    return result(true, `「${project.title}」制作进度：${done}/${project.items.length} 完成。`,
      project.items.map((it) => `${it.index}. ${it.stage} [${it.status}]${it.note ? ` ${it.note}` : ''}`).join('\n'))
  },
}

// ---------------------------------------------------------------------------
// 工具 2：whiteboard_storyboard —— 分镜样例查询 + 工作区分镜校验
// ---------------------------------------------------------------------------
export const whiteboardStoryboardTool = {
  name: 'whiteboard_storyboard',
  description:
    '查询内置分镜样例（list/get）或校验你写好的分镜 JSON（validate：逐页检查 narration 配音文本与画面元素是否齐全，' +
    '渲染前跑一遍能提前发现漏页/漏配音问题）。',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: str('list 列样例；get 取样例正文；validate 校验分镜 JSON', { enum: ['list', 'get', 'validate'] }),
      file: str('get：样例文件名（list 里能看到）'),
      json: str('validate：分镜 JSON 字符串（或 {"title":...,"pages":[...]} 对象字面量的字符串形式）'),
    },
  },
  output: OUTPUT,
  async execute(args) {
    check(args, this.parameters)
    const skillDirs = skillDirsRef.dirs
    if (args.action === 'list') {
      const boards = listStoryboards(skillDirs)
      if (!boards.length) return result(false, '技能里没有内置分镜样例。')
      return result(true, `内置 ${boards.length} 个分镜样例：`,
        boards.map((b) => `- ${b.title}（${b.file}${b.pages ? `，${b.pages} 页` : ''}）`).join('\n'))
    }
    if (args.action === 'get') {
      if (!args.file) throw new Error('get 需要 file（先 list 找到样例文件名）。')
      const { readFileSync, existsSync } = await import('node:fs')
      for (const dir of [].concat(skillDirs)) {
        const file = join(dir, 'assets', args.file)
        if (existsSync(file)) {
          return result(true, `样例 ${args.file}（照此结构写你自己的分镜 JSON）：`, readFileSync(file, 'utf8').slice(0, 12000))
        }
      }
      return result(false, `没有找到样例 ${args.file}。`)
    }
    // validate
    if (!args.json) throw new Error('validate 需要 json（分镜 JSON 字符串）。')
    let data
    try { data = JSON.parse(args.json) } catch { throw new Error('json 不是合法 JSON。') }
    const verdict = validateStoryboard(data)
    const lines = [
      `结果：${verdict.ok ? '✓ 通过' : '✗ 未通过'}（${verdict.stats.pages} 页，${verdict.stats.narrated} 页有配音）`,
      ...verdict.errors.map((e) => `错误：${e}`),
      ...verdict.warnings.map((w) => `提醒：${w}`),
    ]
    return result(verdict.ok, lines[0], lines.slice(1).join('\n') || '（无其他问题）')
  },
}

const skillDirsRef = { dirs: [] }

export function apply(ctx, config) {
  const skillDirs = [join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'whiteboard-teacher-video')]
  skillDirsRef.dirs = skillDirs

  ctx.effect(() => ctx.tools.register(whiteboardProjectTool), `${name}: tool project`)
  ctx.effect(() => ctx.tools.register(whiteboardStoryboardTool), `${name}: tool storyboard`)
  ctx.effect(() => ctx.skills.registerProvider(() => createSkillProvider(skillDirs)), `${name}: skills`)
  ctx.effect(() => registerApi(ctx, { skillDirs }), `${name}: routes`)
}
