import { useRef } from 'react';
import {
  Play,
  Square,
  Undo2,
  Redo2,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Download,
  Upload,
  RotateCcw,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import type { RpgProject } from '../types/project';

export function HeaderBar() {
  const project = useStudioStore((s) => s.project);
  const mode = useStudioStore((s) => s.mode);
  const past = useStudioStore((s) => s.past);
  const future = useStudioStore((s) => s.future);
  const showGrid = useStudioStore((s) => s.showGrid);
  const zoom = useStudioStore((s) => s.zoom);
  const aiConfig = useStudioStore((s) => s.aiConfig);

  const setMode = useStudioStore((s) => s.setMode);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const toggleGrid = useStudioStore((s) => s.toggleGrid);
  const setZoom = useStudioStore((s) => s.setZoom);
  const resetDemoProject = useStudioStore((s) => s.resetDemoProject);
  const importProjectJson = useStudioStore((s) => s.importProjectJson);
  const setShowSettingsModal = useStudioStore((s) => s.setShowSettingsModal);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luacraft-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as RpgProject;
        if (parsed && parsed.maps && parsed.startMapId) {
          importProjectJson(parsed);
        } else {
          alert('无效的 LuaCraft 工程 JSON 文件');
        }
      } catch {
        alert('解析 JSON 失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="studio-header">
      <div className="header-left">
        <div className="brand-mark">
          <span className="brand-glyph">L</span>
          <div className="brand-copy">
            <h1>LuaCraft RPG Studio</h1>
            <span className="brand-sub">Lua 5.4 + AI Copilot 原型</span>
          </div>
        </div>

        <div className="header-divider" />

        <div className="header-group">
          <button
            className="toolbar-btn"
            onClick={undo}
            disabled={past.length === 0 || mode === 'play'}
            title={past.length > 0 ? `撤销: ${past[past.length - 1].label} (Ctrl+Z)` : '无可撤销操作'}
          >
            <Undo2 size={15} />
          </button>
          <button
            className="toolbar-btn"
            onClick={redo}
            disabled={future.length === 0 || mode === 'play'}
            title={future.length > 0 ? `重做: ${future[0].label} (Ctrl+Shift+Z)` : '无可重做操作'}
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="header-divider" />

        <div className="header-group">
          <button
            className={`toolbar-btn ${showGrid ? 'active' : ''}`}
            onClick={toggleGrid}
            disabled={mode === 'play'}
            title="显示/隐藏网格"
          >
            <Grid3X3 size={15} />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => setZoom(zoom - 0.5)}
            disabled={zoom <= 1}
            title="缩小画布"
          >
            <ZoomOut size={15} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="toolbar-btn"
            onClick={() => setZoom(zoom + 0.5)}
            disabled={zoom >= 4}
            title="放大画布"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      <div className="header-center">
        <button
          id="btn-toggle-play"
          className={`play-toggle-btn ${mode === 'play' ? 'is-playing' : ''}`}
          onClick={() => setMode(mode === 'play' ? 'edit' : 'play')}
        >
          {mode === 'play' ? (
            <>
              <Square size={14} fill="currentColor" /> 停止试玩 · 返回编辑
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" /> 运行试玩 (Play)
            </>
          )}
        </button>
      </div>

      <div className="header-right">
        <button
          id="btn-ai-settings"
          className="ai-provider-pill"
          onClick={() => setShowSettingsModal(true)}
          title="配置 OpenAI / DeepSeek / 自定义 API"
        >
          <Sparkles size={13} />
          <span>
            {aiConfig.mode === 'api' && aiConfig.apiKey
              ? `${aiConfig.model}`
              : '演示模式 · 配置 API'}
          </span>
          <Settings2 size={13} />
        </button>

        <div className="header-divider" />

        <button className="toolbar-btn" onClick={handleExport} title="导出工程 JSON">
          <Download size={15} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          title="导入工程 JSON"
        >
          <Upload size={15} />
        </button>
        <button className="toolbar-btn" onClick={resetDemoProject} title="重置示例工程">
          <RotateCcw size={15} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>
    </header>
  );
}
