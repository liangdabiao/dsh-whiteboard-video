// ============================================================================
// 手绘讲解视频 · 浏览器半边（最小面板）。
// 两块：📖 使用指南（工作流 + 环境要求）、🎬 分镜示例（13 个真实项目分镜浏览）。
// ============================================================================
const h = require('react').createElement
const { useState, useEffect } = require('react')

const PANEL_ID = 'whiteboard-video'
const BASE = 'whiteboard-video'

function PanelIcon(props) {
  return h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', ...props },
    h('rect', { x: 2.5, y: 2.5, width: 19, height: 19, rx: 5, fill: '#2d5d8f' }),
    h('rect', { x: 5.5, y: 6, width: 13, height: 9, rx: 1.5, fill: '#fff' }),
    h('path', { d: 'M8 9.5l2.5 2 4-3', stroke: '#e8734a', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    h('path', { d: 'M8 17l-1 3 3-1.5', stroke: '#ffd24a', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
}


// ---------- 制作进度 ----------
const STATUS_STYLE = {
  todo: ['#8a8a92', '○ 待做'],
  doing: ['#b58a00', '◐ 进行中'],
  done: ['#1a7f37', '✓ 完成'],
}

function ProgressTab() {
  const [project, setProject] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetchJson('/api/project').then((d) => setProject(d.project)).catch((e) => setError(e.message))
  }, [])
  if (error) return h('div', { style: styles.error }, error)
  if (project === null) return h('div', { style: styles.muted }, '加载中…')
  if (!project.items.length) {
    return h('div', { style: styles.muted },
      '还没有制作清单。在对话里说「做一个讲勾股定理的白板动画视频」，模型会 init 6 阶段管线并逐阶段推进。')
  }
  const done = project.items.filter((it) => it.status === 'done').length
  const pct = Math.round((done / project.items.length) * 100)
  return h('div', null,
    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '🎬 ' + (project.title || '未命名') + ' 制作进度'),
      h('div', { style: styles.mutedSmall }, done + '/' + project.items.length + ' 完成（' + pct + '%）'),
      h('div', { style: styles.barWrap }, h('div', { style: { ...styles.bar, width: pct + '%' } }))),
    h('div', { style: styles.card },
      project.items.map((it) => {
        const [color, label] = STATUS_STYLE[it.status] || STATUS_STYLE.todo
        return h('div', { key: it.index, style: styles.item },
          h('span', { style: { color, fontSize: 12, fontWeight: 700, minWidth: 66 } }, label),
          h('span', { style: styles.itemTitle }, it.index + '. ' + it.stage),
          it.note ? h('div', { style: styles.mutedSmall }, it.note) : null)
      })))
}

// ---------- 使用指南 ----------
function GuideTab() {
  return h('div', null,
    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '怎么做一个讲解视频'),
      h('div', { style: styles.stepList },
        '在对话里说一句话即可，例如：',
        h('div', { style: styles.quote }, '「做一个讲相对论的 90 秒手绘讲解视频」'),
        h('div', { style: styles.quote }, '「把这篇文章做成图解视频」'),
        h('div', { style: styles.quote }, '「给 xxx 这个 GitHub 项目做个介绍片」'),
        '模型会：写分镜 → 和你确认 → 写口播与逐页画面 → 配音 → 渲染成片（MP4）。')),
    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '首次使用：环境安装（一次性，约 2–4 分钟）'),
      h('div', { style: styles.stepList },
        '渲染引擎与依赖不在插件包里（引擎 16MB + npm 依赖 130MB）。模型在工作区执行技能时，第一步会自动把技能目录复制到工作区并跑环境安装：',
        h('div', { style: styles.quote }, 'python scripts/setup.py'),
        '需要本机有：git（拉引擎）、Node 22+、Python 3、Chrome 或 Edge（dsh 桌面版自带）。')),
    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '五套风格'),
      h('div', { style: { ...styles.muted, lineHeight: 1.8 } },
        '白板 · 黑板 · 书卷 · 暖色插画 · 科技深色——分镜时说或让模型按内容选。')),
    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '零生图成本'),
      h('div', { style: styles.muted }, '画面由代码逐笔绘制（rough.js 手绘线条 + 29 个现成组件），不调用任何生图 API；改一句话只重渲受影响片段（秒级）。')))
}

// ---------- 分镜示例 ----------
function StoryboardsTab() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetchJson('/api/storyboards').then((d) => setList(d.storyboards)).catch((e) => setError(e.message))
  }, [])
  return h('div', null,
    error ? h('div', { style: styles.error }, error) : null,
    list === null ? h('div', { style: styles.muted }, '加载中…') : null,
    list && list.length === 0 ? h('div', { style: styles.muted }, '暂无分镜示例。') : null,
    list?.map((s) => h('div', { key: s.file, style: styles.card },
      h('div', { style: styles.skillName }, s.title),
      h('div', { style: styles.muted }, s.file, s.pages ? ` · ${s.pages} 页` : ''))))
}

async function fetchJson(path) {
  const res = await fetch(BASE + path)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`)
  return data
}

// ---------- 主面板 ----------
function Panel() {
  const [tab, setTab] = useState('progress')
  return h('div', { style: styles.wrap },
    h('div', { style: styles.row },
      h('button', { style: tab === 'progress' ? styles.tabActive : styles.tab, onClick: () => setTab('progress') }, '📊 制作进度'),
      h('button', { style: tab === 'guide' ? styles.tabActive : styles.tab, onClick: () => setTab('guide') }, '📖 使用指南'),
      h('button', { style: tab === 'storyboards' ? styles.tabActive : styles.tab, onClick: () => setTab('storyboards') }, '🎬 分镜示例')),
    tab === 'progress' ? h(ProgressTab) : tab === 'guide' ? h(GuideTab) : h(StoryboardsTab))
}

const styles = {
  mutedSmall: { color: '#a0a0a8', fontSize: 12, lineHeight: 1.7 },
  barWrap: { background: '#eee', borderRadius: 999, height: 8, marginTop: 8, overflow: 'hidden' },
  bar: { background: '#2d5d8f', height: '100%', borderRadius: 999, transition: 'width .3s' },
  item: { padding: '6px 0', borderBottom: '1px solid #f0f0f2' },
  itemTitle: { fontSize: 12.5 },
  wrap: { padding: 16, overflow: 'auto', height: '100%', boxSizing: 'border-box', fontFamily: '-apple-system, "Segoe UI", "Microsoft YaHei", sans-serif', fontSize: 13, color: '#1a1a1a' },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 },
  button: { padding: '6px 14px', border: 'none', borderRadius: 8, background: '#2d5d8f', color: '#fff', cursor: 'pointer', fontSize: 13 },
  tab: { padding: '8px 16px', border: '1px solid #d9d9de', borderRadius: 8, background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontSize: 13 },
  tabActive: { padding: '8px 16px', border: '1px solid #2d5d8f', borderRadius: 8, background: '#e8f0f8', color: '#1a3a5c', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  card: { background: '#fff', border: '1px solid #e3e3e6', borderRadius: 10, padding: 12, marginBottom: 10 },
  sectionTitle: { fontWeight: 700, marginBottom: 6 },
  stepList: { lineHeight: 1.9 },
  quote: { background: '#f0f4f8', borderRadius: 6, padding: '4px 10px', margin: '4px 0', color: '#1a3a5c' },
  muted: { color: '#8a8a92' },
  error: { color: '#c0392b' },
  skillName: { fontWeight: 700, color: '#1a3a5c' },
}

function apply(ctx) {
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 11, label: () => '手绘视频' }, PanelIcon))
  ctx.slots.inject('main', () =>
    ctx.slots.register({ name: 'main', key: PANEL_ID }, Panel))
}

exports.isPlugin = true
exports.inject = ['slots']
exports.apply = apply
