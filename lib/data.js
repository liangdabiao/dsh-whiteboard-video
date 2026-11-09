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
  '分镜 JSON 制作（pages[].say + beats 画面描述）',
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
// 返回 { ok, errors: [], warnings: [], stats: { pages, narrated, beats } }
// ---------------------------------------------------------------------------
// 空数组 / 空串都算“没有”，避免空壳页面被误判为已填写。
function present(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return Boolean(value)
}

export function validateStoryboard(data) {
  const errors = []
  const warnings = []
  if (!data || typeof data !== 'object') return { ok: false, errors: ['不是 JSON 对象'], warnings, stats: {} }
  if (!data.title) warnings.push('缺少 title 字段')
  const pages = data.pages || data.scenes
  if (!Array.isArray(pages) || !pages.length) {
    errors.push('缺少 pages[]（或 scenes[]）分镜数组')
    return { ok: false, errors, warnings, stats: { pages: 0, narrated: 0, beats: 0 } }
  }
  let narrated = 0
  let beats = 0
  pages.forEach((page, i) => {
    // 口播：技能规范是 pages[].say；兼容 narration / voiceover / text 三种旧写法
    const narration = page?.say ?? page?.narration ?? page?.voiceover ?? page?.text
    if (!present(narration)) errors.push(`第 ${i + 1} 页缺少口播（pages[].say）`)
    else narrated++
    // 画面：技能规范是 pages[].beats[]；兼容 elements / content / image / drawing
    const shots = Array.isArray(page?.beats) ? page.beats : null
    const hasVisual = (shots && shots.length) || present(page?.elements) || present(page?.content) ||
      present(page?.image) || present(page?.drawing)
    if (!hasVisual) warnings.push(`第 ${i + 1} 页没有画面描述（beats / elements / content / image 任一）`)
    if (shots) {
      beats += shots.length
      shots.forEach((beat, j) => {
        if (!beat || typeof beat !== 'object') {
          warnings.push(`第 ${i + 1} 页第 ${j + 1} 个 beat 不是对象`)
          return
        }
        if (!present(beat.object)) warnings.push(`第 ${i + 1} 页第 ${j + 1} 个 beat 缺 object（具体物体）`)
        if (!present(beat.action)) warnings.push(`第 ${i + 1} 页第 ${j + 1} 个 beat 缺 action（真实动作）`)
      })
    }
  })
  return { ok: errors.length === 0, errors, warnings, stats: { pages: pages.length, narrated, beats } }
}
