import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Sparkles,
  BookOpen,
  Code2,
} from 'lucide-react';
import { SPRITE_LIST } from '../assets/catalog';
import { LUA_API_REFERENCE, validateLuaScript } from '../engine/luaRuntime';
import { useStudioStore } from '../store/useStudioStore';
import { PixelPreview } from './PixelPreview';
import type { Direction, EventTrigger, SpriteId } from '../types/project';

export function InspectorPanel() {
  const project = useStudioStore((s) => s.project);
  const activeMapId = useStudioStore((s) => s.activeMapId);
  const selection = useStudioStore((s) => s.selection);
  const mode = useStudioStore((s) => s.mode);

  const mutateProjectSilent = useStudioStore((s) => s.mutateProjectSilent);
  const pushUndoSnapshot = useStudioStore((s) => s.pushUndoSnapshot);
  const setSelection = useStudioStore((s) => s.setSelection);
  const setRightTab = useStudioStore((s) => s.setRightTab);

  const [luaStatus, setLuaStatus] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const [showApiRef, setShowApiRef] = useState(false);

  const map =
    selection.type === 'event'
      ? project.maps[selection.mapId]
      : project.maps[activeMapId];
  const selectedEvent =
    selection.type === 'event' && map
      ? map.events.find((e) => e.id === selection.eventId)
      : undefined;

  // Live Lua 5.4 syntax validation via wasmoon!
  useEffect(() => {
    if (!selectedEvent) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await validateLuaScript(selectedEvent.script);
      if (!cancelled) setLuaStatus(res);
    }, 240);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedEvent?.id, selectedEvent?.script]);

  if (!selectedEvent || !map) {
    return (
      <div className="inspector-empty">
        <Code2 size={28} className="muted-icon" />
        <h3>未选中事件 / NPC</h3>
        <p>
          在地图画布上点击任意 NPC 或事件，或使用左侧「放 NPC」工具在画布上创建一个新事件，即可在此直接编辑属性与 Lua 5.4 脚本。
        </p>
        <div className="inspector-summary-box">
          <div className="summary-row">
            <span>当前地图</span>
            <strong>{map?.name} ({map?.id})</strong>
          </div>
          <div className="summary-row">
            <span>地图尺寸</span>
            <strong>{map?.width} × {map?.height}</strong>
          </div>
          <div className="summary-row">
            <span>已注册物品</span>
            <strong>{Object.keys(project.items).length} 种</strong>
          </div>
        </div>
      </div>
    );
  }

  const updateEvent = (patch: Partial<typeof selectedEvent>, undoLabel?: string) => {
    if (undoLabel) pushUndoSnapshot(undoLabel);
    mutateProjectSilent((draft) => {
      const dm = draft.maps[map.id];
      const target = dm?.events.find((e) => e.id === selectedEvent.id);
      if (target) Object.assign(target, patch);
    });
  };

  const handleDelete = () => {
    pushUndoSnapshot(`删除事件 ${selectedEvent.name}`);
    mutateProjectSilent((draft) => {
      const dm = draft.maps[map.id];
      if (dm) dm.events = dm.events.filter((e) => e.id !== selectedEvent.id);
    });
    setSelection({ type: 'none' });
  };

  const insertSnippet = (snippet: string) => {
    updateEvent({ script: `${selectedEvent.script.trimEnd()}\n${snippet}\n` }, '插入 Lua 片段');
  };

  return (
    <div className="inspector-panel">
      {/* Header */}
      <div className="inspector-head">
        <div className="inspector-head-title">
          <PixelPreview kind="sprite" id={selectedEvent.sprite} size={24} />
          <div>
            <div className="inspector-ev-name">{selectedEvent.name}</div>
            <div className="inspector-ev-id">
              id: <code>{selectedEvent.id}</code> · ({selectedEvent.x}, {selectedEvent.y})
            </div>
          </div>
        </div>
        <div className="inspector-head-actions">
          <button
            className="mini-ai-btn"
            onClick={() => setRightTab('ai')}
            title="带着此事件上下文切换到 AI 助手对话修改"
          >
            <Sparkles size={12} /> 问 AI 改
          </button>
          <button
            className="icon-btn-sm danger"
            onClick={handleDelete}
            disabled={mode === 'play'}
            title="删除该事件"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Properties Form */}
      <div className="inspector-props">
        <div className="prop-row-2">
          <label className="prop-field">
            <span>名称</span>
            <input
              type="text"
              value={selectedEvent.name}
              disabled={mode === 'play'}
              onChange={(e) => updateEvent({ name: e.target.value })}
            />
          </label>
          <label className="prop-field">
            <span>触发方式</span>
            <select
              value={selectedEvent.trigger}
              disabled={mode === 'play'}
              onChange={(e) => updateEvent({ trigger: e.target.value as EventTrigger }, '修改触发方式')}
            >
              <option value="interact">按键交互 (interact)</option>
              <option value="touch">踩踏/接触 (touch)</option>
            </select>
          </label>
        </div>

        <div className="prop-row-3">
          <label className="prop-field">
            <span>X</span>
            <input
              type="number"
              min={0}
              max={map.width - 1}
              value={selectedEvent.x}
              disabled={mode === 'play'}
              onChange={(e) =>
                updateEvent({ x: Math.max(0, Math.min(map.width - 1, Number(e.target.value) || 0)) })
              }
            />
          </label>
          <label className="prop-field">
            <span>Y</span>
            <input
              type="number"
              min={0}
              max={map.height - 1}
              value={selectedEvent.y}
              disabled={mode === 'play'}
              onChange={(e) =>
                updateEvent({ y: Math.max(0, Math.min(map.height - 1, Number(e.target.value) || 0)) })
              }
            />
          </label>
          <label className="prop-field">
            <span>朝向</span>
            <select
              value={selectedEvent.dir}
              disabled={mode === 'play'}
              onChange={(e) => updateEvent({ dir: e.target.value as Direction })}
            >
              <option value="down">下</option>
              <option value="up">上</option>
              <option value="left">左</option>
              <option value="right">右</option>
            </select>
          </label>
        </div>

        <div className="prop-row-2">
          <label className="prop-field">
            <span>精灵外观</span>
            <select
              value={selectedEvent.sprite}
              disabled={mode === 'play'}
              onChange={(e) => updateEvent({ sprite: e.target.value as SpriteId }, '更换精灵')}
            >
              {SPRITE_LIST.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.label} ({sp.id})
                </option>
              ))}
            </select>
          </label>
          <div className="prop-toggles">
            <label className="check-label">
              <input
                type="checkbox"
                checked={selectedEvent.solid}
                disabled={mode === 'play'}
                onChange={(e) => updateEvent({ solid: e.target.checked })}
              />
              阻挡通行
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={selectedEvent.visible}
                disabled={mode === 'play'}
                onChange={(e) => updateEvent({ visible: e.target.checked })}
              />
              可见
            </label>
          </div>
        </div>
      </div>

      {/* Lua 5.4 Code Editor */}
      <div className="lua-editor-section">
        <div className="lua-editor-bar">
          <div className="lua-bar-left">
            <Code2 size={13} />
            <span>Lua 5.4 事件脚本</span>
            {luaStatus.valid ? (
              <span className="lua-badge ok">
                <CheckCircle2 size={11} /> 语法通过
              </span>
            ) : (
              <span className="lua-badge err" title={luaStatus.error}>
                <AlertTriangle size={11} /> 语法错误
              </span>
            )}
          </div>
          <button
            className="text-link-btn"
            onClick={() => setShowApiRef((v) => !v)}
          >
            <BookOpen size={12} /> {showApiRef ? '隐藏 API' : 'API 速查'}
          </button>
        </div>

        {!luaStatus.valid && luaStatus.error && (
          <div className="lua-error-banner">{luaStatus.error}</div>
        )}

        {showApiRef && (
          <div className="lua-api-drawer">
            {LUA_API_REFERENCE.map((item, idx) => (
              <button
                key={idx}
                className="api-ref-item"
                onClick={() => insertSnippet(item.sig)}
                title="点击插入到脚本末尾"
              >
                <code>{item.sig}</code>
                <span>{item.desc}</span>
              </button>
            ))}
          </div>
        )}

        <textarea
          className="lua-code-textarea"
          spellCheck={false}
          value={selectedEvent.script}
          disabled={mode === 'play'}
          onChange={(e) => updateEvent({ script: e.target.value })}
        />
      </div>
    </div>
  );
}
