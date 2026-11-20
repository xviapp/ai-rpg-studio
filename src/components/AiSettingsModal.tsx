import { X, KeyRound, Sparkles, CheckCircle2 } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';

const PRESETS = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  custom: {
    label: '自定义 / Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5-coder:14b',
  },
} as const;

export function AiSettingsModal() {
  const show = useStudioStore((s) => s.showSettingsModal);
  const aiConfig = useStudioStore((s) => s.aiConfig);
  const setAiConfig = useStudioStore((s) => s.setAiConfig);
  const setShowSettingsModal = useStudioStore((s) => s.setShowSettingsModal);

  if (!show) return null;

  return (
    <div className="modal-backdrop" onClick={() => setShowSettingsModal(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <KeyRound size={16} /> AI 模型接口配置 (OpenAI Compatible)
          </div>
          <button className="icon-btn-sm" onClick={() => setShowSettingsModal(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="mode-switch-cards">
            <button
              className={`mode-card ${aiConfig.mode === 'demo' ? 'active' : ''}`}
              onClick={() => setAiConfig({ mode: 'demo' })}
            >
              <div className="mode-card-top">
                <Sparkles size={15} />
                <strong>本地演示模式（免 Key）</strong>
                {aiConfig.mode === 'demo' && <CheckCircle2 size={14} className="ok-icon" />}
              </div>
              <p>内置语义规划器，直接驱动真实地图工具与 Lua 5.4 校验器，开箱即可体验一句话建图/加事件。</p>
            </button>

            <button
              className={`mode-card ${aiConfig.mode === 'api' ? 'active' : ''}`}
              onClick={() => setAiConfig({ mode: 'api' })}
            >
              <div className="mode-card-top">
                <KeyRound size={15} />
                <strong>真实大模型 API</strong>
                {aiConfig.mode === 'api' && <CheckCircle2 size={14} className="ok-icon" />}
              </div>
              <p>直连 DeepSeek / OpenAI / 硅基流动 / 本地 Ollama，完整 Function Calling 自由创作任意剧情与地图。</p>
            </button>
          </div>

          {aiConfig.mode === 'api' && (
            <div className="settings-form">
              <div className="preset-row">
                {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
                  <button
                    key={key}
                    className={`preset-btn ${aiConfig.preset === key ? 'active' : ''}`}
                    onClick={() =>
                      setAiConfig({
                        preset: key,
                        baseUrl: PRESETS[key].baseUrl,
                        model: PRESETS[key].model,
                      })
                    }
                  >
                    {PRESETS[key].label}
                  </button>
                ))}
              </div>

              <label className="form-field">
                <span>Base URL</span>
                <input
                  type="text"
                  value={aiConfig.baseUrl}
                  onChange={(e) => setAiConfig({ baseUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                />
              </label>

              <label className="form-field">
                <span>Model 名称</span>
                <input
                  type="text"
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig({ model: e.target.value })}
                  placeholder="deepseek-chat / gpt-4o-mini"
                />
              </label>

              <label className="form-field">
                <span>API Key（仅保存在当前浏览器 localStorage）</span>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </label>

              <p className="form-hint">
                说明：请求直接从浏览器发往你填写的 OpenAI 兼容端点。若目标接口有浏览器 CORS 限制，可通过本地代理或支持 CORS 的服务（如 DeepSeek / OpenRouter / 本地 Ollama）访问。
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="primary-btn" onClick={() => setShowSettingsModal(false)}>
            保存并关闭
          </button>
        </div>
      </div>
    </div>
  );
}
