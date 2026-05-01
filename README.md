# cf-worker-tg-dl-bot
部署在 cloudflare worker 中的 telegram bot 收到 http url 后 下载 以文件形式回复 telegram 消息

新建 worker, 修改代码  
<img width="1144" height="201" alt="image" src="https://github.com/user-attachments/assets/6de99605-e661-41bd-b07e-04de79f75d16" />

访问 worker 的 域名 后面跟上 `/webhook` 来注册webhook, 如  
`https://green-c943.crazypeace.workers.dev/webhook`
