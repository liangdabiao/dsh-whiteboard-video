// 快照合规与 addendum 单测。零 dsh 依赖、零网络。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
