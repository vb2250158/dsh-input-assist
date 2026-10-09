# 版本记录

## 0.12.1

关闭会话或剪贴板参考后，已隐藏的未填完整参数不再阻止保存。已读取剪贴板在当前页面切换会话时保留，卸载、刷新或手动清除时释放；仍仅在点击读取后获取。

Hidden incomplete numeric edits no longer block saving after a reference is disabled. Explicitly captured clipboard text survives conversation navigation within the page and is cleared on unload, refresh or manual clear.


## 0.12.0

补齐设置按参考内容、续写方式、速度与长度分组，数字未填完整时禁止保存。记录增加搜索、状态筛选与耗时概览；来源显示当前会话名称并走官方导航跳转，子会话保留父地址。来源读取失败可重试，标识符收在请求详情。

Group settings and validate numeric drafts; search/filter history, display duration summaries and open current source conversation names through official navigation. Preserve child addresses and retry metadata failures; keep IDs under request details.


## 0.11.0

新增补齐记录入口，保存跨会话最近 100 条请求。查看实际提示词、上下文、结果、状态、模型、耗时、首字耗时和返回的 token 用量；缺失用量明确显示。使用官方 JSON KV 存储，并发写入按发起时间保留，重启可识别中断请求。需启用基础 bundle 的 storage 与 storage-json。

Add persistent completion history for the latest 100 starts across conversations, showing exact prompts/context, results/status, provider/model, duration, first-token latency and returned usage. Missing usage stays explicit. Official JSON KV storage serializes concurrent writes and marks interrupted requests after restart; base-bundle storage and storage-json are required.

## 0.10.4

补齐设置改为页面共享缓存，切换对话和重新打开菜单不再重复加载或锁住模型按钮。首次读取合并并发请求，设置变更后台更新，宿主重连时清除旧设置；保存结果不被迟到读取覆盖，读取错误可重试。

Completion settings share a page-scoped cache. Switching conversations and reopening the menu no longer reload settings or lock the model picker. Initial reads are deduplicated, settings changes refresh in the background, and Host resets discard old values. Late reads cannot overwrite saved settings; failed reads remain retryable.

## 0.10.3

模型弹窗打开期间后台菜单透明并禁用指针，关闭后保留原生焦点恢复。

Keep the background completion menu transparent and pointer-inactive while the model dialog is open, preserving native return focus when it closes.

## 0.10.2

模型弹窗打开期间隐藏后台补齐浮层，避免父菜单盖住搜索结果；关闭弹窗后恢复配置草稿。

Hide the parent completion menu while the model dialog is open so it cannot cover search results; closing the dialog restores the settings draft.

## 0.10.1

补齐请求期间图标显示主题加载动效，取消立即复位；模型按钮直接打开可搜索弹窗，沿用提供商、可见目录、常用排序和当前标记。

Completion requests show the native animated loader until completion, failure or cancellation. Model selection opens a searchable dialog using the existing catalog, provider groups and frequent models.

## 0.10.0

完整复用原模型选择器，沿用提供商、模型可见性、常用排序及当前选择。设置开关改为主题滑轨，数值输入去掉系统箭头。空补齐响应正常忽略，真正的接口错误继续显示。

会话参考新增独立筛选：工具调用与返回、文件变动、排除用户消息和仅取最终回复。工具及文件默认关闭，最终回复默认开启；通过宿主投影恢复最终回复和文件记录，不读取任意同步历史或工作区文件。

## 0.9.2

手机宽度下的数字设置改为单列，修复输入框超出弹窗；长内容滚动时，取消和保存按钮保留在底部。

## 0.9.1

高级设置弹窗按视口限制宽度和高度，内容独立滚动，保存按钮使用原生固定底栏，修复内容横向裁切。悬浮框的补齐开关显示明确文字标签。

## 0.9.0

补齐入口改为图标，点击打开原生菜单悬浮框；提供商和模型选择采用与会话模型选择器一致的菜单材质和条目，模型列表支持搜索。

右上角齿轮打开补齐设置，可配置当前草稿前文范围和自定义提示词。新增可分别勾选的会话消息参考与剪贴板参考，各有长度上限；均默认关闭。剪贴板仅在点击读取后临时保留，不后台读取、不持久化其内容。所有实际发送的参考继续记录在可忽略辅助事件中。

## 0.8.2

客户端通过浏览器同源 fetch 调用补齐设置和流式接口，修复真实设置弹窗中的 ctx.connection.fetch 不存在错误。沿用现有登录 Cookie，保留请求取消信号。

## 0.8.1

语言字典使用 DSH 内置的 zh/en 标识，修复补齐按钮与设置文字的语言选择。增加原生客户端注册与流式读取测试。

## 0.8.0

输入框停顿后显示灰字建议，Tab 接受、Esc 忽略。补齐模型与会话模型分别保存，复用 DSH 已配置的供应商和凭据。

接受建议通过编辑器插入文本，保留引用节点和撤销历史。输入法、命令候选、引用候选、继续输入及失焦会暂停或取消建议。Enter 发送草稿中已经接受的文字。

采用聊天续写接口；附带适用于 DSH 0.2.1-alpha.1 的原生编辑器扩展补丁。辅助模型请求以可忽略事件记录在本机会话日志中，不进入主会话模型历史。

本分支基于 honlnk/dsh-input-assist，保留原项目 MIT 许可与来源。原 FIM、校对实现留在源码中，当前入口使用原生补齐实现。
