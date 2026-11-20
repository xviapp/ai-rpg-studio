import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Sparkles,
  Wrench,
  CheckCircle2,
  XCircle,
  Undo2,
  X,
  ChevronDown,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { runAiStudioAgent } from '../ai/agent';
import { useStudioStore } from '../store/useStudioStore';
import type { AiChatMessage } from '../types/project';

const QUICK_PROMPTS = [
  '在东侧空地建一个篝火营地，放一个卖红药水的流浪商人 NPC',
  '把村长的对话改幽默一点，再加一个送 50 金币的隐藏选项',
  '在地图右下角挖一个小湖并架一座木桥',
  '生成一张新地图「星月小岛」，放小屋、篝火和隐居法师剧情',
];

function ToolTraceAccordion({ traces }: { traces: NonNullable<AiChatMessage['toolTraces']> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="trace-box">
      <button className="trace-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Wrench size={12} />
        <span>执行了 {traces.length} 次引擎工具调用</span>
      </button>
      {open && (
        <div className="trace-list">
          {traces.map((t) => (
            <div key={t.id} className="trace-item">
              <div className="trace-item-head">
                {t.ok ? (
                  <CheckCircle2 size={12} className="ok-icon" />
                ) : (
                  <XCircle size={12} className="err-icon" />
                )}
                <code>{t.name}</code>
              </div>
              <div className="trace-summary">{t.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AiAssistantPanel() {
  const project = useStudioStore((s) => s.project);
  const activeMapId = useStudioStore((s) => s.activeMapId);
  const selection = useStudioStore((s) => s.selection);
  const aiConfig = useStudioStore((s) => s.aiConfig);
  const messages = useStudioStore((s) => s.messages);
  const isGenerating = useStudioStore((s) => s.isGenerating);
  const aiStatusText = useStudioStore((s) => s.aiStatusText);
  const mode = useStudioStore((s) => s.mode);

  const setSelection = useStudioStore((s) => s.setSelection);
  const addMessage = useStudioStore((s) => s.addMessage);
  const setGenerating = useStudioStore((s) => s.setGenerating);
  const commitProject = useStudioStore((s) => s.commitProject);
  const setActiveMapId = useStudioStore((s) => s.setActiveMapId);
  const revertToSnapshot = useStudioStore((s) => s.revertToSnapshot);
  const setShowSettingsModal = useStudioStore((s) => s.setShowSettingsModal);
  const setMode = useStudioStore((s) => s.setMode);

  const [input, setInput] = useState('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const activeMap = project.maps[activeMapId];
  let contextLabel = `@${activeMap?.name ?? activeMapId}`;
  if (selection.type === 'region') {
    contextLabel = selection.label
      ? `@区域:${selection.label} (${selection.x},${selection.y} ${selection.w}×${selection.h})`
      : `@框选区域 (${selection.x},${selection.y} · ${selection.w}×${selection.h})`;
  } else if (selection.type === 'event') {
    const ev = project.maps[selection.mapId]?.events.find((e) => e.id === selection.eventId);
    if (ev) contextLabel = `@事件:${ev.name} (${ev.x},${ev.y})`;
  }

  const handleSend = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || isGenerating) return;

    if (mode === 'play') {
      setMode('edit');
    }

    setInput('');
    const snapshotBefore = structuredClone(useStudioStore.getState().project);

    addMessage({
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      contextLabel,
    });

    setGenerating(true, '正在初始化 AI 引擎...');

    try {
      const result = await runAiStudioAgent(
        text,
        snapshotBefore,
        activeMapId,
        selection,
        aiConfig,
        (status) => setGenerating(true, status)
      );

      if (result.changes.length > 0) {
        commitProject(result.updatedProject, `AI: ${text.slice(0, 22)}`);
      }
      if (result.switchToMapId) {
        setActiveMapId(result.switchToMapId);
      }
      if (result.selectEventId) {
        const targetMap = result.switchToMapId ?? activeMapId;
        setSelection({ type: 'event', mapId: targetMap, eventId: result.selectEventId });
      }

      addMessage({
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        timestamp: Date.now(),
        toolTraces: result.toolTraces,
        changes: result.changes,
        snapshotBefore: result.changes.length > 0 ? snapshotBefore : undefined,
      });
    } catch (err) {
      addMessage({
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `执行失败：${err instanceof Error ? err.message : String(err)}\n\n提示：请检查右上角「配置 API」中的 Base URL、Model 与 API Key，或先切回「本地演示模式」测试。`,
        timestamp: Date.now(),
      });
    } finally {
      setGenerating(false, '');
    }
  };

  return (
    <div className="ai-panel">
      {/* Provider Banner */}
      <div className="ai-banner">
        <div className="ai-banner-info">
          <Sparkles size={13} />
          <span>
            {aiConfig.mode === 'api' && aiConfig.apiKey
              ? `已连接 ${aiConfig.model}`
              : '当前：本地演示模式（免 Key 可直接试玩）'}
          </span>
        </div>
        <button className="text-link-btn" onClick={() => setShowSettingsModal(true)}>
          <Settings2 size={12} /> 切换 API
        </button>
      </div>

      {/* Chat Messages */}
      <div className="ai-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble chat-${msg.role}`}>
            {msg.contextLabel && (
              <div className="bubble-context">{msg.contextLabel}</div>
            )}
            <div className="bubble-text">
              {msg.content.split('\n').map((line, i) => (
                <p key={i}>{line || '\u00A0'}</p>
              ))}
            </div>

            {msg.toolTraces && msg.toolTraces.length > 0 && (
              <ToolTraceAccordion traces={msg.toolTraces} />
            )}

            {msg.changes && msg.changes.length > 0 && (
              <div className="changes-card">
                <div className="changes-title">本轮改动摘要 ({msg.changes.length})</div>
                <ul>
                  {msg.changes.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
                {msg.snapshotBefore && (
                  <button
                    className="revert-btn"
                    disabled={msg.reverted}
                    onClick={() => revertToSnapshot(msg.snapshotBefore!, msg.id)}
                  >
                    <Undo2 size={12} />
                    {msg.reverted ? '已回滚此轮修改' : '撤销本轮修改'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {isGenerating && (
          <div className="chat-bubble chat-assistant is-loading">
            <div className="spinner-dot" />
            <span>{aiStatusText || 'AI 思考并执行工具中...'}</span>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="quick-prompts">
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            className="quick-chip"
            disabled={isGenerating}
            onClick={() => handleSend(qp)}
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Composer with Active Context Pill */}
      <div className="ai-composer">
        <div className="composer-context-row">
          <span className="context-pill">{contextLabel}</span>
          {selection.type !== 'none' && (
            <button
              className="clear-ctx-btn"
              onClick={() => setSelection({ type: 'none' })}
              title="清除局部选区上下文"
            >
              <X size={11} />
            </button>
          )}
        </div>
        <div className="composer-input-row">
          <textarea
            id="ai-prompt-input"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="一句话生成或改动地图、NPC、Lua 剧情... (Enter 发送)"
            disabled={isGenerating}
          />
          <button
            id="ai-send-btn"
            className="send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || isGenerating}
            title="发送给 AI"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
