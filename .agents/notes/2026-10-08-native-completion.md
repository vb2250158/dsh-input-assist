# 原生输入补齐

当前入口为 native-host 和 native-client。客户端向 conversation.input.completion 注册异步续写供应器，编辑器负责光标资格、输入法、按键优先级、灰字和插入；插件不获取编辑器对象。

模型请求复用 llm.stream 的已配置供应商。独立配置保存在 input-assist 设置中。请求不提供工具，不创建 Agent 轮次，并在发起前记录可忽略的 input/completion-request 事件；卸载后日志仍可读取。

宿主扩展随 patches/native-completion-0.2.1.patch 发布。基准为 5badb15009ae1756c3afe0ae0cef1faafc290ccc；后续升级先检查补丁，再构建会话与会话界面包。运行行为由插件 HTTP 测试和宿主编辑器测试覆盖。

首版只支持末尾单行续写。灰字仅是展示内容，Enter 不接受建议。Tab 插入使用独立撤销步骤；命令和引用菜单保留更高按键优先级。
