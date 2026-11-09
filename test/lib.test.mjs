// 插件单测：技能快照合规、addendum、制作清单、分镜校验、浏览器半边产物。零 dsh 依赖、零网络。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(ROOT, 'skills', 'whiteboard-teacher-video')
const SKILL_SCAN_ROOT = join(ROOT, 'skills') // provider 扫描根（其子目录含 SKILL.md）
const { createSkillProvider, readDir, listStoryboards, addendum } = await import('../lib/skills.js')

const SKILL_DIRS = [SKILL_SCAN_ROOT]

test('快照完整：SKILL.md + references + scripts + assets + vendor 齐备', () => {
  for (const p of ['SKILL.md', 'README.md', 'LICENSE', 'package.json', 'vendor/ATTRIBUTION.md']) {
    assert.ok(existsSync(join(SKILL_DIR, p)), `缺 ${p}`)
  }
  for (const dir of ['references', 'scripts', 'assets']) {
    assert.ok(existsSync(join(SKILL_DIR, dir)) && readdirSync(join(SKILL_DIR, dir)).length > 0, `缺 ${dir}/`)
  }
  // 分镜示例 ≥ 10
  const storyboards = readdirSync(join(SKILL_DIR, 'assets')).filter((f) => /^storyboard-.*\.json$/.test(f))
  assert.ok(storyboards.length >= 10, `分镜示例 ${storyboards.length} < 10`)
})

test('SKILL.md frontmatter：name + 长描述（触发词覆盖）', async () => {
  const provider = createSkillProvider(SKILL_DIRS)
  const candidates = await provider.list()
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].name, 'whiteboard-teacher-video')
  assert.ok(candidates[0].description.length > 100, 'description 应含触发词长串')
  assert.match(candidates[0].description, /手绘/)
})

test('快照附体文件不缺关键引用（references 7 篇）', () => {
  const refs = readdirSync(join(SKILL_DIR, 'references')).filter((f) => f.endsWith('.md'))
  assert.ok(refs.length >= 7, `references ${refs.length} < 7`)
  for (const ref of ['storyboard-method.md', 'page-api.md', 'script-format.md', 'tts-backends.md', 'troubleshooting.md']) {
    assert.ok(refs.includes(ref), `缺 references/${ref}`)
  }
})

test('脚本齐备（7 个 Python 工具链）', () => {
  for (const s of ['ftnew.py', 'ftvoice.py', 'ftrender.py', 'ftcheck.py', 'ftlib.py', 'edge_tts_speak.py', 'setup.py']) {
    assert.ok(existsSync(join(SKILL_DIR, 'scripts', s)), `缺 scripts/${s}`)
  }
})

test('provider：单个技能、addendum 含「先复制到工作区」', async () => {
  const provider = createSkillProvider(SKILL_DIRS)
  const candidates = await provider.list()
  assert.equal(candidates.length, 1)
  const c = candidates[0]
  assert.equal(c.name, 'whiteboard-teacher-video')
  assert.equal(c.rank, 600)
  assert.equal(c.source, 'bundled')

  const skill = await provider.get(c)
  assert.ok(skill.content.length > 3000, '正文应完整')
  // addendum 关键三条
  assert.match(skill.content, /cp -r/, '应有复制到工作区的命令')
  assert.match(skill.content, /读不到插件安装目录/, '应说明沙箱限制')
  assert.match(skill.content, /setup\.py/, '应指到 setup')
  // SKILL.md 正文完整（引擎契约 + 工作流 + 硬纪律）
  assert.match(skill.content, /时间的纯函数/)
  assert.match(skill.content, /第 ② 步不可跳过|停下来.*确认/)
})

test('addendum 覆盖环境依赖说明（git/Node/Python/Chrome/edge-tts 免费）', async () => {
  const provider = createSkillProvider(SKILL_DIRS)
  const candidates = await provider.list()
  const skill = await provider.get(candidates[0])
  const text = addendum(skill)
  assert.match(text, /git/)
  assert.match(text, /Node 22/)
  assert.match(text, /Python 3/)
  assert.match(text, /Chrome 或 Edge/)
  assert.match(text, /edge-tts（免费/)
})

test('分镜示例：至少 10 个、含标题与页数', () => {
  const list = listStoryboards([SKILL_DIR])
  assert.ok(list.length >= 10, `分镜示例 ${list.length} < 10`)
  for (const s of list) assert.ok(s.file.endsWith('.json'))
})

// helper（从 lib/skills.js re-export 的 readDir 签名是 (dirs)，这里包一层单目录版本）
function parse(dir, file) {
  const found = readDir([dir]).find((s) => s.file.endsWith(file))
  return found || { name: '', description: '' }
}

test('storyboard JSON 可解析且结构合理（抽 3 个）', () => {
  const assetsDir = join(SKILL_DIR, 'assets')
  const files = readdirSync(assetsDir).filter((f) => /^storyboard-.*\.json$/.test(f)).slice(0, 3)
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(assetsDir, f), 'utf8'))
    const hasContent = Array.isArray(data.pages) || Array.isArray(data.scenes) || typeof data.title === 'string' || typeof data.topic === 'string'
    assert.ok(hasContent, `${f} 结构异常`)
  }
})

test('AGPL 引擎不进快照（vendor 只有 ATTRIBUTION）', () => {
  const vendorFiles = readdirSync(join(SKILL_DIR, 'vendor'))
  assert.deepEqual(vendorFiles, ['ATTRIBUTION.md'])
  assert.ok(!existsSync(join(SKILL_DIR, 'engine')), 'engine/ 不应进快照（setup 时拉取）')
})

test('MIT LICENSE 在快照根（技能本体许可）', () => {
  const text = readFileSync(join(SKILL_DIR, 'LICENSE'), 'utf8')
  assert.match(text, /MIT/)
  assert.match(text, /liangdabiao/)
})

// ── 升级新增：project + storyboard 工具 ────────────────────
process.env.DSH_HOME = new URL('../.tmp/test-home/', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:')

const data = await import('../lib/data.js')
const host = await import('../src/host.js')

test('data: 制作清单 init/冲突/更新/清空 + 分镜校验', () => {
  data.clearProject()
  const p = data.initProject('测试视频', undefined, false)
  assert.equal(p.items.length, 6)
  const conflict = data.initProject('另一个', undefined, false)
  assert.equal(conflict.conflict, true)
  const item = data.updateStage(2, { status: 'done', note: '分镜完成' })
  assert.equal(item.status, 'done')
  data.clearProject()
  assert.equal(data.getProject().items.length, 0)
  // 分镜校验
  const bad = data.validateStoryboard({ pages: [{ elements: [] }, {}] })
  assert.equal(bad.ok, false)
  assert.ok(bad.errors.length >= 2, '两页都缺 narration')
  const good = data.validateStoryboard({ title: 't', pages: [{ narration: '你好', elements: [] }, { narration: '世界', content: 'x' }] })
  assert.equal(good.ok, true)
  assert.equal(good.stats.narrated, 2)
  // 技能规范：pages[].say + pages[].beats[]
  const canonical = data.validateStoryboard({
    title: 't',
    pages: [{ say: '第一句口播', beats: [{ at: 'c0', object: '火车', action: '驶过站台' }] }],
  })
  assert.equal(canonical.ok, true)
  assert.equal(canonical.stats.narrated, 1)
  assert.equal(canonical.stats.beats, 1)
  // 空数组不算画面（避免空壳页面蒙混过关）
  const emptyBeats = data.validateStoryboard({ title: 't', pages: [{ say: '口播', beats: [] }] })
  assert.equal(emptyBeats.ok, true)
  assert.ok(emptyBeats.warnings.some((w) => w.includes('没有画面描述')))
  // 内置样例（技能真实产物）必须全部判为通过
  for (const f of readdirSync(join(SKILL_DIR, 'assets')).filter((x) => /^storyboard-.*\.json$/.test(x))) {
    const sample = JSON.parse(readFileSync(join(SKILL_DIR, 'assets', f), 'utf8'))
    const verdict = data.validateStoryboard(sample)
    assert.equal(verdict.ok, true, `${f} 应通过：${verdict.errors.join('；')}`)
  }
})

test('host: 2 个工具 schema + project/storyboard 全链路', async () => {
  for (const tool of [host.whiteboardProjectTool, host.whiteboardStoryboardTool]) {
    assert.equal(tool.parameters.additionalProperties, false)
    assert.ok(tool.description.length > 30)
  }
  await assert.rejects(() => host.whiteboardProjectTool.execute({ action: 'list', bogus: 1 }), /未知参数/)
  let skillProvider
  host.apply(
    { effect: (fn) => { try { fn() } catch {} }, tools: { register: () => {} }, skills: { registerProvider: (factory) => { skillProvider = factory() } }, webServer: { register: () => {} } },
    {})
  const skills = await skillProvider.list()
  assert.ok(skills.some((s) => s.name === 'whiteboard-teacher-video'), '应注册手绘讲解视频技能')
  const init = await host.whiteboardProjectTool.execute({ action: 'init', title: '勾股定理' })
  assert.equal(init.ok, true)
  const st = await host.whiteboardProjectTool.execute({ action: 'status', index: 1, status: 'done', note: '脚本好了' })
  assert.ok(st.summary.includes('done'))
  const list = await host.whiteboardProjectTool.execute({ action: 'list' })
  assert.ok(list.summary.includes('1/6'))
  const boards = await host.whiteboardStoryboardTool.execute({ action: 'list' })
  assert.equal(boards.ok, true)
  assert.ok(boards.data.includes('storyboard-'))
  const bad = await host.whiteboardStoryboardTool.execute({ action: 'validate', json: '{"pages":[{}]}' })
  assert.equal(bad.ok, false)
  const good = await host.whiteboardStoryboardTool.execute({ action: 'validate', json: '{"title":"t","pages":[{"narration":"a","elements":[]}]}' })
  assert.equal(good.ok, true)
  const noConfirm = await host.whiteboardProjectTool.execute({ action: 'clear' })
  assert.equal(noConfirm.ok, false)
})

// ── 浏览器半边产物：ModuleLoader 包装、重复执行守卫、面板注册 ──
test('dist/client.js：裸 load 注册 + 面板注册（免浏览器）', () => {
  const code = readFileSync(join(ROOT, 'dist', 'client.js'), 'utf8')
  assert.ok(code.startsWith('window.__ModuleLoader__.load('), '产物必须是裸 load（包 wrapper 会导致宿主不激活）')
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
  }
  const loaded = []
  const sandbox = { window: { __ModuleLoader__: { load: (entry) => loaded.push(entry) } }, Set, console }
  runInNewContext(code, sandbox)
  assert.equal(loaded.length, 1, '首次执行应注册一次')

  const mod = loaded[0].factory((name) => {
    if (name === 'react') return react
    throw new Error(`产物 require 了白名单外的模块：${name}`)
  })
  assert.equal(mod.isPlugin, true)
  assert.deepEqual(Array.from(mod.inject), ['slots', 'uiWorkspace'])

  const registered = []
  const starts = []
  const ctx = {
    uiWorkspace: { startSession: (_id, opts) => starts.push(opts) },
    slots: {
      inject: (_name, fn) => fn(),
      register: (spec, comp) => registered.push({ spec, comp }),
    },
  }
  mod.apply(ctx, {})
  assert.equal(registered.length, 2, '应有侧栏图标 + 主面板两次注册')
  const [icon, panel] = registered
  assert.equal(icon.spec.name, 'sidebar.panellist')
  assert.equal(icon.spec.id, 'whiteboard-video')
  assert.equal(icon.spec.label(), '手绘视频')
  assert.equal(panel.spec.name, 'main')
  assert.equal(panel.spec.key, 'whiteboard-video')
  for (const r of registered) assert.equal(typeof r.comp, 'function')

  // 面板首屏是「工具选择」：把组件树渲染一遍，点按钮应把指令填进新对话（不自动发送）
  const tree = renderTree(panel.comp({}))
  const texts = collectText(tree)
  assert.ok(texts.includes('三个工具怎么选'), '应有「三个工具怎么选」')
  assert.ok(texts.includes('三种视频怎么选'), '应有「三种视频怎么选」')
  const buttons = collectButtons(tree)
  const cta = buttons.find((b) => String(b.props.title || '').startsWith('填进对话'))
  assert.ok(cta, '工具选择页应有填进对话的按钮')
  cta.props.onClick()
  assert.equal(starts.length, 1)
  assert.equal(starts[0].whenDraftExists, 'replace')
  assert.match(starts[0].prompt, /曹冲称象/)
  const validate = buttons.find((b) => String(b.props.title || '').includes('校验这个分镜 JSON'))
  assert.ok(validate, '应有一键校验分镜的按钮')
  validate.props.onClick()
  assert.equal(starts[1].prompt, '校验这个分镜 JSON：')
  const github = buttons.find((b) => String(b.props.title || '').includes('给这个 GitHub 项目做一个'))
  assert.ok(github, '应有 GitHub 项目介绍片按钮')
  github.props.onClick()
  assert.match(starts[2].prompt, /GitHub 项目/)
})

function collectText(node, out = []) {
  if (typeof node === 'string' || typeof node === 'number') out.push(String(node))
  else if (Array.isArray(node)) node.forEach((child) => collectText(child, out))
  else if (node && typeof node === 'object') (node.children || []).forEach((child) => collectText(child, out))
  return out
}

// 把 React 元素树展开到可点击的按钮节点（只用于测试，不依赖真实渲染器）
function renderTree(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return node
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(renderTree)
  if (typeof node.type === 'function') return renderTree(node.type(node.props || {}))
  return { type: node.type, props: node.props || {}, children: (node.children || []).map(renderTree) }
}

function collectButtons(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    node.forEach((child) => collectButtons(child, out))
    return out
  }
  if (node.type === 'button') out.push(node)
  ;(node.children || []).forEach((child) => collectButtons(child, out))
  return out
}
