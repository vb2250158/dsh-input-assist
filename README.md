# dsh-input-assist

DSH 输入框的灰字补齐插件。基于 [honlnk/dsh-input-assist](https://github.com/honlnk/dsh-input-assist) 的 MIT 项目开发，本分支使用原生编辑器接口和独立聊天模型。

## 使用

点击输入框右侧的补齐图标，在悬浮菜单中选择已经配置的提供商和模型并保存。完整复用 `dsh-codex-model-selector` 的选择器，点击模型按钮直接打开可搜索弹窗，提供商和模型在同一列表中显示，沿用模型可见性、常用排序、当前选择标记和搜索；该选择与当前会话模型分别保存，凭据由 DSH 管理。

补齐设置在页面中共享，首次加载后切换对话或重新打开菜单直接使用已有设置。设置变更时后台更新，已加载的模型按钮保持可用；宿主重连时重新读取设置，读取失败会显示错误并在下次打开时重试。

悬浮菜单右上角的齿轮打开补齐设置：当前草稿的前文字符数、自定义补齐提示词、停顿时间、超时、输出 tokens 和建议字符数。默认只使用当前草稿，最多 2000 字符。手机宽度下设置改为单列，长内容可滚动，取消和保存按钮固定在底部。

可分别勾选最近会话消息和已读取的剪贴板，并设置各自的条数或字符上限。开启会话参考后，可独立设置包含工具调用与返回、包含文件变动、排除用户消息、仅参考最终总结回复。工具和文件信息默认关闭，最终回复过滤默认开启；仍排除图片、系统提示词和其他会话。参考条目最多 4 条、4000 字符，可调。文件变动取已完成工具记录中的路径、操作和变更片段行数，不后台读取工作区文件。剪贴板默认关闭，只有点击「读取剪贴板」才获取文字；仅在当前页面临时保留，刷新或清除后需重新读取。勾选的参考会发送给所选补齐模型并记录在本机会话日志中；无需参考时取消勾选。

模型返回空内容时正常略过建议；鉴权、超时和部分流失败仍保留错误。请求期间底部补齐图标显示宿主加载动效；完成、失败或取消后恢复图标。输入停顿后显示灰字；Tab 接受，Esc 忽略。Enter 发送草稿中已经接受的文字。继续输入、移动光标、失焦、输入法组合或打开命令和引用候选时暂停建议。支持中英文末尾单行续写，可设置停顿时间、输出 tokens 和请求超时。

补齐调用会产生模型费用。发出请求前，供应商、模型、提示词和草稿以可忽略辅助事件记录到本机会话日志，不进入主会话模型历史。卸载插件后仍可读取原日志。

## 安装

适配 DSH 0.2.1-alpha.1，需启用 `dsh-codex-model-selector` 0.1.12 或更新版本。宿主需具有 `conversation.input.completion` 插槽和可忽略辅助事件写入接口；本仓库随版本提供补丁。

先备份宿主改动，然后在宿主目录执行：

```sh
node /path/to/dsh-input-assist/scripts/apply-native-patch.mjs /path/to/deepseek-harness
node node_modules/typescript/bin/tsc -b packages/core/session/tsconfig.json packages/client/ui-conversation/tsconfig.client.json
pnpm --filter @deepseek-ai/dsh-session exec tsdown
DSH_BUILD_FACE=client pnpm --filter @deepseek-ai/dsh-client-ui-conversation bundle
```

Windows PowerShell 先执行 `$env:DSH_BUILD_FACE='client'` 再执行最后的 pnpm 命令。

在 DSH 环境同步的第三方插件管理中添加 GitHub 仓库 `vb2250158/dsh-input-assist`，固定版本对应的完整提交 SHA 并 Import。Git 安装需要允许本插件运行构建脚本。Import 完成后，在插件管理中启用 `dsh-input-assist` bundle，再重启 DSH 并刷新页面，在输入框配置补齐模型。

确认 profile 的 `package.json.dsh.profile.bundles` 包含 `dsh-input-assist`。已有依赖的 Import 可能只更新文件，保留原来的关闭状态；安装成功不能代替启用核验。

仅安装插件而没有宿主接口时，补齐不会生效。宿主升级后先运行补丁检查；发生冲突时停止应用，不覆盖已有文件。

## 开发

```sh
npm ci
npm test
```

当前入口为 `src/native-host.ts` 和 `src/native-client.ts`；客户端使用 DSH 原生控件、主题和语言字典。请求通过同源认证路由进入 `llm.stream`，支持流式输出和断开取消，不启动 Agent 或工具。

宿主补丁以 `5badb15009ae1756c3afe0ae0cef1faafc290ccc` 为基准，仅包含本功能代码、测试和说明。按光标插入建议，保留引用节点及独立撤销步骤。原 FIM 与校对实现保留在源码中，当前包入口使用原生补齐实现。

许可：MIT，保留上游来源。版本记录见 [CHANGELOG.md](CHANGELOG.md)。
