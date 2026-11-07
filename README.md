# dsh-whiteboard-video · 手绘讲解视频

DeepSeek Harness（dsh）插件：**图文讲解视频技能**——把讲解稿变成「手绘会动的画面」讲解视频。图形由代码逐笔绘出、文字逐字写出、讲到哪画到哪（音画对齐）。五套风格，本地 Chrome 渲染，**零生图 API 成本**，任何改动秒级重渲。

技能本体来自 [whiteboard-teacher-video](https://github.com/liangdabiao/whiteboard-teacher-video)（MIT，liangdabiao）。B 站效果示例：[GPS 是怎么工作的](https://www.bilibili.com/video/BV1mpn96UE7B/) · [勾股定理证明](https://www.bilibili.com/video/BV1yYJ46PE5R/) · [财务报表解释](https://www.bilibili.com/video/BV1U2xY6gEto/)

## 装上以后有什么

| 能力 | 说明 |
|---|---|
| **手绘讲解视频技能** | `/whiteboard-teacher-video` 斜杠命令 + 模型自主触发：写分镜 → 确认 → 写口播 → 逐页画面 → 配音 → 渲染 MP4。五套风格（白板/黑板/书卷/暖色插画/科技深色）、29 个现成组件、13 个真实项目分镜示例 |
| 侧栏「手绘视频」面板 | 📖 使用指南（工作流+环境要求）+ 🎬 分镜示例浏览 |

## 怎么用

对话里一句话：**「做一个讲相对论的 90 秒手绘讲解视频」**。

模型会按技能工作流：写分镜 → 停下来和你确认 → 写口播与逐页画面 → 配音（edge-tts 免费）→ 渲染成片（MP4，产出在工作区 `out/` 目录）。

**首次制作**模型会先做环境安装（一次性，约 2–4 分钟）：从 GitHub 拉渲染引擎（约 16MB sparse checkout）+ npm 安装依赖（约 130MB）。需要本机有 git、Node 22+、Python 3、Chrome 或 Edge。

## 怎么实现的

渲染引擎 [frametell](https://github.com/sitor-ai/frametell)（AGPL-3.0，Sitor Team）不进插件包——**整片是时间的纯函数** `renderAt(t)`，引擎在用户工作区副本里以独立进程被调用，用本机 Chrome 截图 + ffmpeg 编码，零生图 API 成本。

## 自检

```bash
npm install && npm test && npm run selftest && npm run build
```

- `npm test`：10 个单测（快照完整/frontmatter/脚本齐备/addendum 三条/分镜示例/AGPL 引擎不入快照）
- `npm run selftest`：快照+provider+面板 API+引擎声明+人类闸门，零网络


## 安装

```bash
dsh plugin --profile web add dsh-whiteboard-video
```

## 许可

- 插件壳代码（src/lib/client/scripts）：**MIT**（liangdabiao）
- 技能快照内容（skills/whiteboard-teacher-video/）：**MIT**（liangdabiao）
- 渲染引擎 frametell：**AGPL-3.0-only**（Sitor Team）——不随插件分发，用户首次 setup 时从上游拉取；引擎以独立进程运行，产出的视频不构成衍生作品。详见快照内 `vendor/ATTRIBUTION.md`。

特别致谢社区支持：https://linux.do
