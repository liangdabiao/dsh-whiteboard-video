// 手绘讲解视频 · 制作进度持久化（$DSH_HOME/whiteboard-video/）。
// project.json：{ title, workflow, items: [{ index, stage, status, note, updatedAt }] }
// status: todo | doing | done
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DATA_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'whiteboard-video')
const PROJECT_FILE = join(DATA_DIR, 'project.json')
export const STATUSES = ['todo', 'doing', 'done']

// 默认制作流程（对应技能的 ft*.py 管线）。
export const DEFAULT_STAGES = [
  '课程脚本撰写（讲稿分页）',
  '分镜 JSON 制作（pages[].narration + 画面元素）',
  '环境安装（pip install -r requirements，ffmpeg 就绪）',
  '配音生成（ftvoice.py / edge-tts）',
  '画面与时间轴校验（ftcheck.py）',
  '渲染输出（ftrender.py → mp4）',
]

export function ensureDirs() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

function load() {
  try {
    const raw = JSON.parse(readFileSync(PROJECT_FILE, 'utf8'))
    return raw && typeof raw === 'object' ? raw : null
  } catch {
    return null
  }
}

function save(project) {
  ensureDirs()
  const tmp = `${PROJECT_FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(project, null, 2), 'utf8')
  renameSync(tmp, PROJECT_FILE)
}

export function getProject() {
  return load() || { title: '', items: [] }
}

export function initProject(title, stages, confirm = false) {
  const prev = load()
  if (prev && prev.items.length && !confirm) {
    return { conflict: true, title: prev.title, items: prev.items.length }
  }
  const list = Array.isArray(stages) && stages.length ? stages : DEFAULT_STAGES
  const project = {
    title,
    items: list.map((stage, i) => ({ index: i + 1, stage, status: 'todo', note: '', updatedAt: new Date().toISOString() })),
    updatedAt: new Date().toISOString(),
  }
  save(project)
  return project
}

export function updateStage(index, patch) {
  const project = load()
  if (!project) return null
  let item = project.items.find((it) => it.index === index)
  if (!item) {
    item = { index, stage: patch.stage || `阶段${index}`, status: 'todo', note: '', updatedAt: '' }
    project.items.push(item)
    project.items.sort((a, b) => a.index - b.index)
  }
  if (patch.stage !== undefined) item.stage = patch.stage
  if (patch.status !== undefined && STATUSES.includes(patch.status)) item.status = patch.status
  if (patch.note !== undefined) item.note = String(patch.note).slice(0, 300)
  item.updatedAt = new Date().toISOString()
  project.updatedAt = item.updatedAt
  save(project)
  return item
}

export function clearProject() {
  save({ title: '', items: [] })
}

// ---------------------------------------------------------------------------
// 分镜 JSON 结构校验（对工作区里的 storyboard 文件做确定性检查）。
// 返回 { ok, errors: [], warnings: [], stats: { pages, narrated } }
// ---------------------------------------------------------------------------
export function validateStoryboard(data) {
  const errors = []
  const warnings = []
  if (!data || typeof data !== 'object') return { ok: false, errors: ['不是 JSON 对象'], warnings, stats: {} }
  if (!data.title) warnings.push('缺少 title 字段')
  const pages = data.pages || data.scenes
  if (!Array.isArray(pages) || !pages.length) {
    errors.push('缺少 pages[]（或 scenes[]）分镜数组')
    return { ok: false, errors, warnings, stats: { pages: 0, narrated: 0 } }
  }
  let narrated = 0
  pages.forEach((page, i) => {
    const narration = page.narration || page.voiceover || page.text
    if (!narration || !String(narration).trim()) errors.push(`第 ${i + 1} 页缺少 narration（配音文本）`)
    else narrated++
    if (!page.elements && !page.content && !page.image && !page.drawing) {
      warnings.push(`第 ${i + 1} 页没有画面元素描述（elements/content/image 任一）`)
    }
  })
  return { ok: errors.length === 0, errors, warnings, stats: { pages: pages.length, narrated } }
}
