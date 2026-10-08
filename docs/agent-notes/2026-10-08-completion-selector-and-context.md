# 原选择器与补齐参考过滤

补齐通过 `modelPickers.Picker` 复用模型选择插件提供的同一个 ModelSelect、ModelDirectory 和 RecentModels。选择只更新补齐设置草稿，不调用 session.selectModel，不复制目录、隐藏规则或常用计数。宿主旧 models.list 端点已移除。

设置使用主题 Switch；数字字段使用主题 Input 的 numeric 输入模式。嵌入的完整选择器使用 MenuSurface，保留原组件和键盘行为；内容在父浮层内扩展，适配窄视口。

inputCompletionContext 是 Host-only 会话投影：已完成轮次的最后完整助手消息成为最终回复；工具结果的 diff 元数据提供文件路径、操作和变更片段行数。失败工具与中断回复不产生该事实。工具调用与返回从消息面提取，系统、开发者和图片排除；所有过滤先于条目数及字符预算。

空内容的 EMPTY_RESPONSE 在未产生文字时表示无建议；认证等错误或已有文字后的失败继续拒绝。请求仍以可忽略辅助事件记录实际提示词和全部参考。

Rabi 状态查询未返回可用地址。本轮基于当前用户问题、模型选择器源码、已安装 profile 和复现结果实施。
