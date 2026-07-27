# Coze 后端搭建教程

本文档对应 `meeting-host-demo.html` 的 Coze 直连演示版。前端直接调用 Coze，因此只适合本地演示或内网验证；正式上线建议加一层后端代理隐藏 Token。

## 一、最终需要几个工作流

一共需要 4 个 Coze 工作流：

| 工作流 | 建议名称 | 前端用途 |
| --- | --- | --- |
| 1 | `wf_receive_transcript` | 每 5 秒接收一段 ASR 文本，清洗口语冗余 |
| 2 | `wf_generate_minutes` | 根据完整转写生成结构化 Markdown 纪要 |
| 3 | `wf_save_minutes` | 将会议纪要保存到会议纪要知识库 |
| 4 | `wf_search_minutes` | 检索历史纪要并回答问题 |

麦克风 ASR 不做成工作流。前端使用 Coze WebSocket Transcriptions 获取麦克风转写结果，然后每 5 秒把新增文本发给 `wf_receive_transcript`。

## 二、准备 Coze 智能体

1. 进入 Coze 控制台，创建智能体。
2. 智能体名称填写：`会议主持人`。
3. 角色 Prompt 填写：

```text
你是会议主持人。你只以会议主持人身份工作，负责接收会议实时文字、整理发言内容、生成结构化会议纪要，并从历史会议纪要知识库中回答查询。

你不能扮演参会人、管理员、审核员或多个角色。所有操作都以会议主持人的口径完成。

当用户提供会议转写内容时，你需要保留原意，去除明显口语冗余，整理为清晰的会议记录。

当用户要求生成会议纪要时，你必须输出结构化 Markdown，包含：会议主题、会议摘要、关键讨论、已确认结论、待办事项、风险与遗留问题。

当用户查询历史纪要时，你必须基于知识库召回内容回答；如果知识库没有证据，需要明确说明“历史纪要中未检索到相关内容”。
```

4. 发布智能体到 API 渠道。
5. 复制 Bot ID。Bot ID 通常在智能体页面 URL 的 `bot` 参数或路径中。

## 三、创建知识库

1. 创建文档知识库。
2. 名称填写：`会议纪要知识库`。
3. 切片策略建议：

```text
切片方式：自动切片或按标题切片
单片长度：800-1200 字
重叠长度：100-150 字
召回数量：3-5
```

4. 先手动加入一篇测试纪要：

```markdown
# 产品评审会纪要

会议 ID：mtg_seed_001
会议标题：产品评审会
创建时间：2026-07-20 10:00

## 会议主题
网页端会议主持人 Demo 的交付范围确认。

## 会议摘要
会议确认先交付网页端会议工作台，暂缓多角色协作和客户端能力。

## 待办事项
- 准备会议样例数据
- 补充会议纪要模板
- 确认知识库结构
```

5. 在知识库检索测试里搜索：`产品评审会有哪些待办事项？`，确认能召回内容。

## 四、工作流 1：清洗转写

名称：`wf_receive_transcript`

开始节点输入：

| 参数 | 类型 | 必填 |
| --- | --- | --- |
| `meeting_id` | string | 是 |
| `meeting_title` | string | 是 |
| `transcript_chunk` | string | 是 |
| `timestamp` | string | 是 |

节点结构：

```text
开始节点 -> 大模型节点：清洗转写片段 -> 结束节点
```

大模型节点 Prompt：

```text
你是会议主持人，请清洗下面这段会议实时转写。

会议 ID：{{meeting_id}}
会议标题：{{meeting_title}}
时间点：{{timestamp}}

原始转写：
{{transcript_chunk}}

要求：
1. 保留原意。
2. 去除明显口头禅、重复词和无意义停顿。
3. 不要扩写，不要补充未出现的信息。
4. 输出 JSON，格式如下：
{
  "clean_chunk": "清洗后的文本"
}
```

结束节点输出：

```json
{
  "clean_chunk": "{{清洗转写片段.clean_chunk}}"
}
```

如果 Coze 节点不能解析 JSON 字段，就让结束节点输出：

```json
{
  "clean_chunk": "{{清洗转写片段.output}}"
}
```

验收输入：

```json
{
  "meeting_id": "mtg_test_001",
  "meeting_title": "产品最小功能验证会议",
  "transcript_chunk": "嗯我们今天主要就是确认一下网页端 Demo，先不做多角色，先把纪要和查询跑起来。",
  "timestamp": "00:00:05"
}
```

期望输出包含：

```json
{
  "clean_chunk": "我们今天主要确认网页端 Demo，先不做多角色，先把纪要和查询跑起来。"
}
```

## 五、工作流 2：生成会议纪要

名称：`wf_generate_minutes`

开始节点输入：

| 参数 | 类型 | 必填 |
| --- | --- | --- |
| `meeting_id` | string | 是 |
| `meeting_title` | string | 是 |
| `clean_transcript` | string | 是 |

节点结构：

```text
开始节点 -> 大模型节点：生成结构化纪要 -> 结束节点
```

大模型节点 Prompt：

```text
你是会议主持人，请根据完整会议转写生成结构化会议纪要。

会议 ID：{{meeting_id}}
会议标题：{{meeting_title}}

完整转写：
{{clean_transcript}}

要求：
1. 必须输出 Markdown。
2. 保留会议中真实出现的信息，不编造负责人、日期或结论。
3. 如果负责人或截止时间未提到，写“未明确”。
4. 必须包含以下结构：

# 会议纪要

## 会议主题

## 会议摘要

## 关键讨论

## 已确认结论

## 待办事项

| 事项 | 负责人 | 截止时间 | 状态 |
| --- | --- | --- | --- |

## 风险与遗留问题
```

结束节点输出：

```json
{
  "minutes_md": "{{生成结构化纪要.output}}"
}
```

验收：输入一段 3-5 句转写，确认输出 Markdown 且包含待办表格。

## 六、工作流 3：保存会议纪要

名称：`wf_save_minutes`

开始节点输入：

| 参数 | 类型 | 必填 |
| --- | --- | --- |
| `meeting_id` | string | 是 |
| `meeting_title` | string | 是 |
| `minutes_md` | string | 是 |
| `created_at` | string | 是 |

推荐节点结构：

```text
开始节点 -> 代码/模板节点：组装文档标题和正文 -> 知识库写入节点或 HTTP 请求节点 -> 结束节点
```

文档标题建议：

```text
{{created_at}}_{{meeting_title}}_会议纪要
```

文档正文建议：

```markdown
会议 ID：{{meeting_id}}
会议标题：{{meeting_title}}
创建时间：{{created_at}}

{{minutes_md}}
```

保存方式有两种：

1. 如果你的 Coze 工作流里有“知识库写入 / 新增文档”节点，直接选择 `会议纪要知识库` 并写入文档标题和正文。
2. 如果没有写入节点，用 HTTP 请求节点调用 Coze 知识库文件创建 API，把 `minutes_md` 作为本地文本文件内容写入。此方式需要在 Coze 里安全保存 PAT，不要把 PAT 写死在前端。

结束节点输出：

```json
{
  "saved": true,
  "knowledge_document_id": "{{知识库写入节点.document_id}}"
}
```

如果暂时拿不到文档 ID，也可以输出：

```json
{
  "saved": true,
  "knowledge_document_id": "saved_by_workflow"
}
```

验收：运行后回到知识库，搜索会议标题，确认能召回刚保存的纪要。

## 七、工作流 4：历史纪要查询

名称：`wf_search_minutes`

开始节点输入：

| 参数 | 类型 | 必填 |
| --- | --- | --- |
| `query` | string | 是 |
| `meeting_scope` | string | 否 |

节点结构：

```text
开始节点 -> 知识库检索节点 -> 大模型节点：基于召回回答 -> 结束节点
```

知识库检索节点：

```text
知识库：会议纪要知识库
查询内容：{{query}}
召回数量：3-5
```

大模型节点 Prompt：

```text
你是会议主持人，请基于历史会议纪要知识库召回内容回答问题。

用户问题：
{{query}}

限定范围：
{{meeting_scope}}

知识库召回内容：
{{知识库检索节点.output}}

要求：
1. 只能基于召回内容回答。
2. 命中内容时，说明来源会议或会议标题。
3. 如果召回内容为空或没有证据，回答：“历史纪要中未检索到相关内容”。
4. 输出简洁中文。
```

结束节点输出：

```json
{
  "answer": "{{基于召回回答.output}}"
}
```

验收问题：

```text
产品评审会有哪些待办事项？
```

期望：回答包含“准备会议样例数据、补充会议纪要模板、确认知识库结构”，并说明来源会议。

## 八、前端配置

打开 `meeting-host-demo.html` 后，在顶部 Coze 直连配置里填写：

```text
API 地址：https://api.coze.cn
Personal Access Token：你的 PAT
Bot ID：会议主持人 Bot ID
转写清洗工作流 ID：wf_receive_transcript 的 workflow_id
生成纪要工作流 ID：wf_generate_minutes 的 workflow_id
保存知识库工作流 ID：wf_save_minutes 的 workflow_id
历史查询工作流 ID：wf_search_minutes 的 workflow_id
会议标题：当前会议标题
```

点击“保存配置”。

## 九、演示流程

1. 点击“开始会议”。
2. 允许浏览器麦克风权限。
3. 可选：允许屏幕共享权限。
4. 对着麦克风说几句话。
5. 页面每 5 秒把新增转写送到 `wf_receive_transcript`。
6. 点击“生成纪要”，调用 `wf_generate_minutes`。
7. 点击“保存到知识库”，调用 `wf_save_minutes`。
8. 在历史查询区提问，调用 `wf_search_minutes`。

## 十、常见问题

### 1. 页面提示 ASR 启动失败

确认浏览器允许麦克风权限。建议用本地服务打开页面：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080/meeting-host-demo.html
```

### 2. 工作流调用失败

检查：

- PAT 是否有效。
- Bot 是否已发布到 API 渠道。
- 工作流是否已发布。
- workflow_id 是否复制正确。
- 当前 PAT 是否有目标空间权限。

### 3. 浏览器跨域失败

前端直连 Coze 可能受 CORS 或 Token 安全策略影响。如果出现跨域错误，说明当前环境不适合纯前端直连，需要恢复为“前端 -> 轻量代理 -> Coze”的结构。

### 4. 保存知识库失败

优先确认 Coze 工作流是否支持知识库写入节点。如果没有，保存工作流需要用 HTTP 请求节点调用 Coze 知识库文件创建 API，或者先手动上传纪要做演示。
