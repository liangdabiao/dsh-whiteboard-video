// ============================================================================
// 手绘讲解视频 · 浏览器半边。
// 三块：📖 工具选择（默认，带一键填进对话的按钮）+ 📊 制作进度 + 🎬 分镜示例。
//
// 按钮怎么工作：点击 → startPrompt(prompt) → 宿主 uiWorkspace.startSession(...)
// → 打开新对话并把指令填进输入框（不自动发送，用户补完内容再发）。
// 与 GEO 工具箱 / 投资尽调 等插件同一套做法。
// ============================================================================
const h = require('react').createElement
const { useState, useEffect } = require('react')

const PANEL_ID = 'whiteboard-video'
const BASE = 'whiteboard-video'

// apply() 里注入，按钮点击时调用
let startPrompt = null
function act(prompt) {
  if (startPrompt) startPrompt(prompt)
}

function PanelIcon(props) {
  return h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', ...props },
    h('rect', { x: 2.5, y: 2.5, width: 19, height: 19, rx: 5, fill: '#2d5d8f' }),
    h('rect', { x: 5.5, y: 6, width: 13, height: 9, rx: 1.5, fill: '#fff' }),
    h('path', { d: 'M8 9.5l2.5 2 4-3', stroke: '#e8734a', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    h('path', { d: 'M8 17l-1 3 3-1.5', stroke: '#ffd24a', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
}

async function fetchJson(path) {
  const res = await fetch(BASE + path)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`)
  return data
}

// ---------------------------------------------------------------------------
// 三个工具怎么选：技能 + 两个原生工具，各配一条一键指令
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: '🎬 whiteboard-teacher-video',
    tag: '完整制作',
    desc: '写分镜 → 确认 → 口播 → 逐页画面 → 配音 → 渲染 MP4（白板/黑板/书卷/暖色插画/科技深色）。想做一条完整的讲解视频 → 用这个',
    prompt: '做一个讲「曹冲称象的原理」的 90 秒手绘讲解视频',
    action: '🎬 做一条讲解视频',
  },
  {
    name: '📊 whiteboard_project',
    tag: '接着上次做',
    desc: '6 阶段制作清单持久化：脚本→分镜→环境→配音→校验→渲染。想接着上次的进度做、或看做到哪了 → 用这个',
    prompt: '看一下我的手绘视频制作进度',
    action: '📊 看制作进度',
  },
  {
    name: '✅ whiteboard_storyboard',
    tag: '渲染前体检',
    desc: '15 个真实分镜样例 + 逐页校验口播 say / 画面 beats 是否齐全。分镜写好了、渲染前想先检查 → 用这个',
    prompt: '校验这个分镜 JSON：',
    action: '✅ 校验分镜',
  },
]

// ---------------------------------------------------------------------------
// 三种视频怎么选：同一套技能的三类常用题材，各配一条一键指令
// ---------------------------------------------------------------------------
const VIDEO_TYPES = [
  {
    name: '🔬 科普讲解',
    tag: '概念 / 原理',
    desc: '把一个概念或原理讲明白，五段式：Hook → 直觉 → 机制 → 例子与数字 → 收束。曹冲称象、浮力、勾股定理这类 → 用这个',
    prompt: '做一个讲「曹冲称象的原理」的 90 秒手绘讲解视频',
    action: '🔬 做科普讲解',
  },
  {
    name: '🐙 GitHub 项目介绍',
    tag: '开源 / 项目',
    desc: '按官方 8 页骨架做介绍片，最后一页必须落仓库地址。想让人记住你的开源项目、或给 skill 做介绍片 → 用这个',
    prompt: '给这个 GitHub 项目做一个 90 秒手绘介绍片：',
    action: '🐙 做项目介绍片',
  },
  {
    name: '📊 数据 / 流程图解',
    tag: '图表 / 步骤',
    desc: '把一组数字或一段流程画成会动的图解：流程图、对比图、数字演示、教程拆解 → 用这个',
    prompt: '把这份数据 / 流程做成 60 秒手绘图解视频：',
    action: '📊 做数据图解',
  },
]

// ---------- 工具选择 ----------
function GuideTab() {
  return h('div', null,
    // 主 CTA：最常用的动作，放最显眼处
    h('div', { style: styles.ctaCard },
      h('div', { style: styles.ctaText },
        h('div', { style: styles.ctaTitle }, '想做一条「会自己画出来」的讲解视频？'),
        h('div', { style: styles.ctaMuted }, '点右边的按钮 → 打开新对话，输入框已填好「曹冲称象」的示例；换成你的主题回车即可。')),
      h('button', {
        style: styles.ctaButton,
        onClick: () => act('做一个讲「曹冲称象的原理」的 90 秒手绘讲解视频'),
        title: '填进对话：做一个讲「曹冲称象的原理」的 90 秒手绘讲解视频',
      }, '🎬 做一个讲解视频')),

    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '三个工具怎么选'),
      h('div', { style: styles.toolList },
        TOOLS.map((t) => h('div', { key: t.name, style: styles.toolRow },
          h('div', { style: styles.toolHead },
            h('span', { style: styles.toolName }, t.name),
            h('span', { style: styles.toolTag }, t.tag),
            h('button', { style: styles.actionBtn, onClick: () => act(t.prompt), title: `填进对话：${t.prompt}` }, t.action)),
          h('div', { style: styles.muted }, t.desc))))),

    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '三种视频怎么选'),
      h('div', { style: styles.toolList },
        VIDEO_TYPES.map((t) => h('div', { key: t.name, style: styles.toolRow },
          h('div', { style: styles.toolHead },
            h('span', { style: styles.toolName }, t.name),
            h('span', { style: styles.toolTag }, t.tag),
            h('button', { style: styles.actionBtn, onClick: () => act(t.prompt), title: `填进对话：${t.prompt}` }, t.action)),
          h('div', { style: styles.muted }, t.desc))))),

    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '也可以直接在对话里说'),
      h('div', { style: styles.stepList },
        h('div', { style: styles.quote }, '做一个讲「曹冲称象的原理」的 90 秒手绘讲解视频'),
        h('div', { style: styles.quote }, '把这篇文章做成图解视频：（粘贴正文）'),
        h('div', { style: styles.quote }, '给 xxx 这个 GitHub 项目做个介绍片'),
        h('div', { style: styles.quote }, '看一下我的手绘视频制作进度'),
        '模型会按技能工作流：写分镜 → 和你确认 → 口播与逐页画面 → 配音 → 渲染成片（MP4，产出在工作区 `out/`）。')),

    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '首次使用：环境安装（一次性，约 2–4 分钟）'),
      h('div', { style: styles.stepList },
        '渲染引擎与依赖不在插件包里（引擎 16MB + npm 依赖 130MB）。第一次做视频时，模型会先把技能目录复制到工作区并跑：',
        h('div', { style: styles.quote }, 'python scripts/setup.py'),
        '需要本机有：git、Node 22+、Python 3、Chrome 或 Edge（dsh 桌面版自带）。')),
  )
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
    return h('div', null,
      h('div', { style: styles.card },
        h('div', { style: styles.sectionTitle }, '还没有制作清单'),
        h('div', { style: styles.muted }, '点下面的按钮，把指令填进对话；或直接在对话里说要做什么视频，模型会 init 6 阶段管线并逐阶段推进。'),
        h('button', {
          style: { ...styles.actionBtn, marginTop: 10 },
          onClick: () => act('做一个讲「曹冲称象的原理」的 90 秒手绘讲解视频'),
        }, '🎬 做一个讲解视频')))
  }
  const done = project.items.filter((it) => it.status === 'done').length
  const pct = Math.round((done / project.items.length) * 100)
  return h('div', null,
    h('div', { style: styles.card },
      h('div', { style: styles.sectionTitle }, '🎬 ' + (project.title || '未命名') + ' 制作进度'),
      h('div', { style: styles.mutedSmall }, done + '/' + project.items.length + ' 完成（' + pct + '%）'),
      h('div', { style: styles.barWrap }, h('div', { style: { ...styles.bar, width: pct + '%' } })),
      h('button', {
        style: { ...styles.actionBtn, marginTop: 10 },
        onClick: () => act(`继续做「${project.title}」这条手绘讲解视频，先看一下制作进度`),
      }, '📊 继续做这条视频')),
    h('div', { style: styles.card },
      project.items.map((it) => {
        const [color, label] = STATUS_STYLE[it.status] || STATUS_STYLE.todo
        return h('div', { key: it.index, style: styles.item },
          h('span', { style: { color, fontSize: 12, fontWeight: 700, minWidth: 66 } }, label),
          h('span', { style: styles.itemTitle }, it.index + '. ' + it.stage),
          it.note ? h('div', { style: styles.mutedSmall }, it.note) : null)
      })))
}

// ---------- 分镜示例 ----------
function StoryboardsTab() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetchJson('/api/storyboards').then((d) => setList(d.storyboards)).catch((e) => setError(e.message))
  }, [])
  return h('div', null,
    h('div', { style: styles.row },
      h('button', { style: styles.actionBtn, onClick: () => act('校验这个分镜 JSON：') }, '✅ 校验我的分镜'),
      h('span', { style: styles.mutedSmall }, '渲染前逐页检查口播 say / 画面 beats 是否齐全')),
    error ? h('div', { style: styles.error }, error) : null,
    list === null ? h('div', { style: styles.muted }, '加载中…') : null,
    list && list.length === 0 ? h('div', { style: styles.muted }, '暂无分镜示例。') : null,
    list?.map((s) => h('div', { key: s.file, style: styles.card },
      h('div', { style: styles.skillName }, s.title),
      h('div', { style: styles.muted }, s.file, s.pages ? ` · ${s.pages} 页` : ''))))
}

// ---------- 主面板 ----------
const TABS = [
  ['guide', '📖 工具选择'],
  ['progress', '📊 制作进度'],
  ['storyboards', '🎬 分镜示例'],
]

function Panel() {
  const [tab, setTab] = useState('guide')
  return h('div', { style: styles.wrap },
    h('div', { style: styles.row },
      TABS.map(([key, label]) => h('button', {
        key,
        style: tab === key ? styles.tabActive : styles.tab,
        onClick: () => setTab(key),
      }, label))),
    tab === 'guide' ? h(GuideTab) : tab === 'progress' ? h(ProgressTab) : h(StoryboardsTab))
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
  ctaCard: { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: '#eaf2fa', border: '1px solid #cfe0f2', borderRadius: 10, padding: '12px 14px', marginBottom: 12 },
  ctaText: { flex: 1, minWidth: 200 },
  ctaTitle: { fontWeight: 700, color: '#1a3a5c', marginBottom: 4 },
  ctaMuted: { color: '#5a7591', lineHeight: 1.7, fontSize: 12.5 },
  ctaButton: { padding: '10px 20px', border: 'none', borderRadius: 10, background: '#2d5d8f', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 6px rgba(45,93,143,.25)' },
  actionBtn: { padding: '5px 12px', border: '1px solid #cfe0f2', borderRadius: 8, background: '#f4f9ff', color: '#1a3a5c', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 },
  sectionTitle: { fontWeight: 700, marginBottom: 6, color: '#1a3a5c' },
  stepList: { lineHeight: 1.9 },
  quote: { background: '#f0f4f8', borderRadius: 6, padding: '4px 10px', margin: '4px 0', color: '#1a3a5c', fontFamily: 'Consolas, monospace', fontSize: 12.5 },
  toolList: { display: 'grid', gap: 10 },
  toolRow: { background: '#fafafa', borderRadius: 8, padding: '10px 12px' },
  toolHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  toolName: { fontWeight: 700, color: '#1a3a5c', fontFamily: 'Consolas, monospace' },
  toolTag: { padding: '1px 8px', borderRadius: 999, background: '#eaf2fa', color: '#1a3a5c', fontSize: 11 },
  muted: { color: '#8a8a92' },
  error: { color: '#c0392b' },
  skillName: { fontWeight: 700, color: '#1a3a5c' },
}

function apply(ctx) {
  // 与其它插件同一套入口：只填草稿，不自动发送
  startPrompt = (prompt) => {
    try {
      ctx.uiWorkspace.startSession(undefined, { prompt, whenDraftExists: 'replace' })
    } catch (err) {
      console.error('[whiteboard-video] 开新对话失败', err)
      alert('开新对话失败：' + ((err && err.message) || err))
    }
  }

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 11, label: () => '手绘视频' }, PanelIcon))
  ctx.slots.inject('main', () =>
    ctx.slots.register({ name: 'main', key: PANEL_ID }, Panel))
}

exports.isPlugin = true
exports.inject = ['slots', 'uiWorkspace']
exports.apply = apply
