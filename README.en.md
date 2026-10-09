# dsh-input-assist

本分支的使用、安装与兼容说明统一维护在 [README.md](README.md)。

Completion settings are shared across the page. After the first successful read, switching conversations or reopening the menu uses cached settings immediately. Settings changes refresh in the background without locking the model picker. Host resets discard old settings; failed reads show an error and retry on the next opening.
