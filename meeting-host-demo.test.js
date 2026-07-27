const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "meeting-host-demo.html"), "utf8");
const config = fs.readFileSync(path.join(root, "config.js"), "utf8");

test("uses the new demo meeting subject everywhere", () => {
  assert.match(html, /会议助手演示/);
  assert.match(config, /meetingTitle:\s*"会议助手演示"/);
  assert.doesNotMatch(html, /产品最小功能验证会议/);
  assert.doesNotMatch(config, /产品最小功能验证会议/);
});

test("keeps meeting subject as a start/restart input outside runtime config", () => {
  assert.match(html, /id="meetingTopicInput"/);
  assert.match(html, /for="meetingTopicInput">会议主题/);
  assert.match(html, /meeting_title:\s*config\.meetingTitle/);
});

test("removes the runtime configuration section from the UI", () => {
  assert.doesNotMatch(html, /运行配置/);
  assert.doesNotMatch(html, /class="coze-config"/);
  assert.doesNotMatch(html, /id="saveConfigBtn"/);
});

test("starts ASR through Coze transcription without repeated browser mic prompts", () => {
  assert.match(html, /WsTranscriptionClient/);
  assert.match(html, /TRANSCRIPTIONS_MESSAGE_UPDATE/);
  assert.match(html, /TRANSCRIPTIONS_MESSAGE_COMPLETED/);
  assert.match(html, /startCozeAsr/);
  assert.match(html, /upsertLiveTranscriptChunk/);
  assert.doesNotMatch(html, /getUserMedia/);
  assert.doesNotMatch(html, /let micStream/);
  assert.doesNotMatch(html, /Coze ASR 已接入，实时转写会自动追加到转写区。/);
});

test("surfaces Coze ASR lifecycle and no-transcript diagnostics", () => {
  assert.match(html, /const COZE_SDK_VERSION = "1\.3\.9"/);
  assert.match(html, /function setAsrStatus/);
  assert.match(html, /function scheduleAsrNoTranscriptHint/);
  assert.match(html, /WebsocketsEventType\.ALL/);
  assert.match(html, /TRANSCRIPTIONS_CREATED/);
  assert.match(html, /INPUT_AUDIO_BUFFER_SPEECH_STARTED/);
  assert.match(html, /INPUT_AUDIO_BUFFER_SPEECH_STOPPED/);
  assert.doesNotMatch(html, /锛\?\{escapeHtml/);
  assert.doesNotMatch(html, /锛\?\{error\.message/);
});

test("starts microphone ASR before screen sharing can block the meeting", () => {
  const startMeetingBody = html.match(/async function startMeeting\(\) \{([\s\S]*?)\n    \}/)?.[1] || "";
  const asrStartIndex = startMeetingBody.indexOf("await startRealtimeAsr();");
  const screenStartIndex = startMeetingBody.indexOf("await startScreenShare();");

  assert.notEqual(asrStartIndex, -1);
  assert.notEqual(screenStartIndex, -1);
  assert.ok(asrStartIndex < screenStartIndex);
});

test("loads meeting history through the configured list workflow", () => {
  assert.match(config, /listMinutes:\s*"7667206967505616938"/);
  assert.match(html, /id="loadHistoryBtn"/);
  assert.match(html, /<button id="loadHistoryBtn" type="button">历史纪要<\/button>/);
  assert.match(html, /listMinutesWorkflowId/);
  assert.match(html, /callWorkflow\(config\.listMinutesWorkflowId/);
  assert.match(html, /openHistoryMinutes/);
  assert.match(html, /openHistoryListModal/);
  assert.match(html, /backToHistoryListBtn/);
  assert.match(html, /showHistoryList/);
  assert.match(html, /<button id="backToHistoryListBtn" type="button" hidden>返回列表<\/button>/);
  assert.match(html, /backToHistoryListBtn\.hidden = false/);
  assert.match(html, /backToHistoryListBtn\.hidden = true/);
  assert.match(html, /id="historyModalBody"[\s\S]*id="historyList"/);
  const queryPanel = html.match(/<section class="panel query-panel"[\s\S]*?<\/section>/)?.[0] || "";
  assert.doesNotMatch(queryPanel, /id="historyList"/);
});

test("history item titles come from the workflow title field", () => {
  assert.match(html, /const title = pickFirstString\(parsed, \["title"\]/);
  assert.doesNotMatch(html, /title: `历史会议纪要 \$\{index \+ 1\}`/);
  assert.doesNotMatch(html, /pickFirstString\(parsed, \["title", "meeting_title"/);
});

test("keeps the query answer box empty until a query is answered", () => {
  assert.match(html, /<div id="queryAnswer" class="answer"><\/div>/);
  assert.doesNotMatch(html, /知识库中已有一条示例纪要。保存当前会议后，可查询本次会议内容。/);
});

test("saves generated minutes as a txt file input for the save workflow", () => {
  assert.match(html, /const FILE_UPLOAD_ENDPOINT = "\/v1\/files\/upload"/);
  assert.match(html, /function buildMeetingMinutesText/);
  assert.match(html, /async function uploadCozeTextFile/);
  assert.match(html, /new FormData\(\)/);
  assert.match(html, /formData\.append\("file",\s*fileBlob,\s*fileName\)/);
  assert.match(html, /function buildSaveMinutesWorkflowParameters/);
  assert.match(html, /meeting_id:\s*meetingId/);
  assert.match(html, /meeting_title:\s*config\.meetingTitle/);
  assert.match(html, /created_time:\s*createdTime/);
  assert.match(html, /knowledge:\s*JSON\.stringify\(\{\s*file_id:\s*knowledgeFileId\s*\}\)/);
  assert.match(html, /meeting_text:\s*meetingText/);
  assert.doesNotMatch(html, /created_at:\s*new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(html, /knowledge:\s*currentMinutesMarkdown/);
});

test("top actions and lower panels use the repaired layout classes", () => {
  assert.match(html, /class="meeting-actions"/);
  assert.match(html, /class="action-buttons"/);
  assert.match(html, /grid-template-rows:\s*clamp\(380px,\s*28vw,\s*460px\)\s*minmax\(420px,\s*1fr\)/);
  assert.match(html, /\.answer\s*{[\s\S]*?min-height:\s*180px/);
});
