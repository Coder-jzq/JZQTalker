# JZQ-Talker

本目录是可部署到 GitHub Pages 的静态网站。入口为 `web/index.html`；页面脚本、数据和音频均使用相对于 `web/` 的路径。

## 数据

- 500 条常用句及 84 段对话保存在 `data.bundle.js`。
- 论文内容来自 `../资源/conversational_speech_synthesis_British_English_10_papers.md`，共有 10 篇、82 章、611 条逐句中英对照。运行 `python 脚本/build_site_data.py` 可重新解析并更新数据包和音频清单。
- `web/audio/manifest.json` 是待合成清单；`web/audio/available.js` 只登记已经生成的 MP3。网页优先播放 MP3，尚未生成的句子使用浏览器朗读。Browser Voice 仅控制浏览器备用朗读，Rate 也控制 MP3 播放速度。

论文英文是依据论文内容改写的口头汇报句，不能当作论文原文引用；局限章节含讨论性分析。

## Gemini TTS

`脚本/generate_tts.py` 按句子 ID 断点续跑，使用 Vertex AI 上的 `gemini-2.5-flash-lite-preview-tts`、Achernar 音色和 `en-GB` 语言设置生成 MP3，写入 `web/audio/oral/` 和 `web/audio/papers/`。生成记录写入 `web/audio/generation_report.json`。需要 Python 3.7+、ffmpeg 和 Vertex 服务账号：设置 `GOOGLE_APPLICATION_CREDENTIALS`，可选 `GOOGLE_CLOUD_PROJECT`、`GOOGLE_CLOUD_LOCATION`。若不设置项目 ID，脚本会从服务账号 JSON 中读取。

```bash
python 脚本/build_site_data.py
python 脚本/generate_tts.py                         # 只检查待合成数量
python 脚本/generate_tts.py --kind oral --execute     # 500 条常用句
python 脚本/generate_tts.py --kind paper --execute    # 611 条论文句
```

可以用 `--limit 1` 先合成一条检查发音和凭证。没有 `--execute` 时不会发送收费请求；重复运行会跳过已生成的 MP3。

本机已准备 `bash 脚本/run_tts_vertex.sh`：它会使用 FamiDialog 的服务账号文件、每分钟最多 5 次请求，持续合成全部待处理句子。需要在能连接 Google OAuth 和 Vertex AI 的终端运行；本任务的受限沙箱无法连接外网。可以先运行 `bash 脚本/run_tts_vertex.sh --limit 1` 验证，然后去掉 `--limit 1` 继续；断点续跑不会重做成功文件。服务账号 JSON 不在网站目录中，也不会随网站发布。

## 本地预览

在项目根目录运行 `python -m http.server 8788`，访问 `http://127.0.0.1:8788/web/`。也可直接打开 `web/index.html`，数据来自内嵌脚本。
