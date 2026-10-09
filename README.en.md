# dsh-input-assist

本分支的使用、安装与兼容说明统一维护在 [README.md](README.md)。

Completion settings are shared across the page. After the first successful read, switching conversations or reopening the menu uses cached settings immediately. Settings changes refresh in the background without locking the model picker. Host resets discard old settings; failed reads show an error and retry on the next opening.

The clock icon next to completion settings opens the latest 100 completion requests across conversations. Each row shows status, provider/model, duration, returned token usage and result preview. Open a row to inspect the exact prompt and sent context, result/error and first-token latency. Requests are recorded from this version onward; existing logs are not imported. Success, empty, cancellation, timeout and failure are retained in the local DSH JSON KV unit `storages/input_completion_history.json`, capped at 100 starts. Restarted pending rows become interrupted. Missing usage is shown as not returned, including streams stopped early at a line break or character limit. Tab acceptance is not tracked. Official storage and storage-json plugins are required and included in the base bundle.

Settings are grouped into reference content, continuation instructions, and speed/length. Incomplete numeric edits disable saving. History can be searched by conversation title, model or suggestion, and filtered by completion status. Source names come from the live Session Controller; clicking closes the dialog and uses official workspace navigation, preserving direct-parent addresses for child conversations. Missing sources cannot be opened; metadata failures can be retried. IDs and output limits are collapsed under Request details.

Disabling a reference ignores hidden incomplete numeric edits. Explicitly captured clipboard text survives conversation navigation in the same page and is released on refresh, plugin unload or manual clear.
