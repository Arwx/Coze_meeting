window.MEETING_HOST_CONFIG = {
  coze: {
    baseUrl: "https://api.coze.cn",
    pat: "pat_xxx",
    botId: "",
    workflows: {
      generateMinutes: "workflow_id_for_wf_generate_minutes",
      saveMinutes: "workflow_id_for_wf_save_minutes",
      searchMinutes: "workflow_id_for_wf_search_minutes",
      receiveTranscript: ""
    }
  },
  aliyunBailian: {
    apiKey: "sk-xxx",
    endpoint: "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    model: "fun-asr-flash-2026-06-15",
    format: "wav",
    sampleRate: 16000,
    chunkMs: 5000
  },
  app: {
    meetingTitle: "产品最小功能验证会议"
  }
};
