# JZQ-Talker

JZQ-Talker 是一个用于口语背诵、对话回答和论文汇报英文表达训练的本地学习平台。

入口页面：`learning-site/index.html`

数据来源：

- `data/uk_visiting_phd_daily_english_500.json`：日常口语句子与情景对话。
- `data/paper_learning_expressions.json`：9 篇论文的组会汇报流程、英文表达和问答练习。
- `learning-site/data.bundle.js`：页面内嵌数据兜底。直接双击打开 HTML 时，如果浏览器不能读取外部 JSON，会自动使用这个数据包。

本网站使用浏览器内置 `speechSynthesis` 朗读英文。可用声音由当前浏览器和系统决定，优先选择英语语音。

本地预览建议从项目根目录启动静态服务，然后访问：

```text
http://127.0.0.1:8788/learning-site/index.html
```

也可以直接打开 `learning-site/index.html`，数据会从 `data.bundle.js` 读取。
