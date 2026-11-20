import { useState } from 'react';
import {
  MousePointer2,
  BoxSelect,
  Paintbrush,
  Home,
  UserPlus,
  Eraser,
  Map as MapIcon,
  Plus,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { PREFAB_LIST, SPRITE_LIST, TERRAIN_LIST } from '../assets/catalog';
import { useStudioStore } from '../store/useStudioStore';
import { PixelPreview } from './PixelPreview';
import type { EditorTool } from '../types/project';

const TOOLS: Array<{ id: EditorTool; label: string; icon: typeof MousePointer2; hint: string }> = [
  { id: 'select', label: '选择', icon: MousePointer2, hint: '点击事件或区域选中' },
  { id: 'marquee', label: '框选@AI', icon: BoxSelect, hint: '框选地图区域作为 AI 修改上下文' },
  { id: 'terrain', label: '地形笔', icon: Paintbrush, hint: '绘制自动拼接地形' },
  { id: 'prefab', label: '预制件', icon: Home, hint: '放置建筑/树/桥/道具' },
  { id: 'event', label: '放NPC', icon: UserPlus, hint: '点击画布创建 Lua 事件' },
  { id: 'eraser', label: '橡皮擦', icon: Eraser, hint: '擦除预制件或事件' },
];

export function LeftSidebar() {
  const project = useStudioStore((s) => s.project);
  const mode = useStudioStore((s) => s.mode);
  const activeMapId = useStudioStore((s) => s.activeMapId);
  const activeTool = useStudioStore((s) => s.activeTool);
  const selectedTerrain = useStudioStore((s) => s.selectedTerrain);
  const selectedPrefab = useStudioStore((s) => s.selectedPrefab);
  const selectedSprite = useStudioStore((s) => s.selectedSprite);
  const selection = useStudioStore((s) => s.selection);

  const setActiveMapId = useStudioStore((s) => s.setActiveMapId);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const setSelectedTerrain = useStudioStore((s) => s.setSelectedTerrain);
  const setSelectedPrefab = useStudioStore((s) => s.setSelectedPrefab);
  const setSelectedSprite = useStudioStore((s) => s.setSelectedSprite);
  const setSelection = useStudioStore((s) => s.setSelection);
  const setRightTab = useStudioStore((s) => s.setRightTab);
  const commitProject = useStudioStore((s) => s.commitProject);

  const [paletteTab, setPaletteTab] = useState<'terrain' | 'prefab' | 'sprite'>('terrain');

  const activeMap = project.maps[activeMapId] ?? Object.values(project.maps)[0];

  const handleCreateMap = () => {
    const idx = Object.keys(project.maps).length + 1;
    const id = `map_${idx}`;
    const next = structuredClone(project);
    next.maps[id] = {
      id,
      name: `新地图 ${idx}`,
      width: 20,
      height: 15,
      terrain: Array.from({ length: 15 }, () => Array.from({ length: 20 }, () => 'grass')),
      prefabs: [],
      regions: [],
      events: [],
    };
    commitProject(next, `创建地图 ${next.maps[id].name}`);
    setActiveMapId(id);
  };

  return (
    <aside className={`left-sidebar ${mode === 'play' ? 'is-dimmed' : ''}`}>
      {/* Maps Section */}
      <section className="sidebar-section">
        <div className="section-header">
          <span className="section-title">
            <MapIcon size={13} /> 工程地图 ({Object.keys(project.maps).length})
          </span>
          <button className="icon-btn-sm" onClick={handleCreateMap} title="新建空白地图" disabled={mode === 'play'}>
            <Plus size={14} />
          </button>
        </div>
        <div className="map-list">
          {Object.values(project.maps).map((m) => (
            <button
              key={m.id}
              className={`map-item-btn ${m.id === activeMapId ? 'active' : ''}`}
              onClick={() => setActiveMapId(m.id)}
              disabled={mode === 'play'}
            >
              <span className="map-item-name">{m.name}</span>
              <span className="map-item-meta">
                {m.width}×{m.height} · {m.events.length}事件
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Tool Belt */}
      <section className="sidebar-section">
        <div className="section-header">
          <span className="section-title">画布工具</span>
        </div>
        <div className="tool-grid">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`tool-btn ${activeTool === t.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool(t.id);
                  if (t.id === 'terrain') setPaletteTab('terrain');
                  else if (t.id === 'prefab') setPaletteTab('prefab');
                  else if (t.id === 'event') setPaletteTab('sprite');
                }}
                title={t.hint}
                disabled={mode === 'play'}
              >
                <Icon size={15} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Asset Palette (Terrain / Prefab / Sprite) */}
      <section className="sidebar-section sidebar-palette-section">
        <div className="mini-tabs">
          <button
            className={`mini-tab ${paletteTab === 'terrain' ? 'active' : ''}`}
            onClick={() => setPaletteTab('terrain')}
          >
            地形
          </button>
          <button
            className={`mini-tab ${paletteTab === 'prefab' ? 'active' : ''}`}
            onClick={() => setPaletteTab('prefab')}
          >
            预制件
          </button>
          <button
            className={`mini-tab ${paletteTab === 'sprite' ? 'active' : ''}`}
            onClick={() => setPaletteTab('sprite')}
          >
            角色/NPC
          </button>
        </div>

        <div className="palette-scroll">
          {paletteTab === 'terrain' && (
            <div className="palette-grid">
              {TERRAIN_LIST.map((t) => (
                <button
                  key={t.id}
                  className={`palette-card ${activeTool === 'terrain' && selectedTerrain === t.id ? 'active' : ''}`}
                  onClick={() => setSelectedTerrain(t.id)}
                  disabled={mode === 'play'}
                >
                  <PixelPreview kind="terrain" id={t.id} size={28} />
                  <span className="palette-card-label">{t.label}</span>
                </button>
              ))}
            </div>
          )}

          {paletteTab === 'prefab' && (
            <div className="palette-grid">
              {PREFAB_LIST.map((p) => (
                <button
                  key={p.id}
                  className={`palette-card ${activeTool === 'prefab' && selectedPrefab === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedPrefab(p.id)}
                  disabled={mode === 'play'}
                  title={`${p.label} (${p.w}×${p.h})`}
                >
                  <PixelPreview kind="prefab" id={p.id} size={30} />
                  <span className="palette-card-label">{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {paletteTab === 'sprite' && (
            <div className="palette-grid">
              {SPRITE_LIST.map((sp) => (
                <button
                  key={sp.id}
                  className={`palette-card ${activeTool === 'event' && selectedSprite === sp.id ? 'active' : ''}`}
                  onClick={() => setSelectedSprite(sp.id)}
                  disabled={mode === 'play'}
                >
                  <PixelPreview kind="sprite" id={sp.id} size={28} />
                  <span className="palette-card-label">{sp.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Scene Outline: Events & Named Regions */}
      <section className="sidebar-section sidebar-outline-section">
        <div className="section-header">
          <span className="section-title">
            <Sparkles size={13} /> 当前地图事件 ({activeMap?.events.length ?? 0})
          </span>
        </div>
        <div className="outline-list">
          {activeMap?.events.map((ev) => {
            const isSelected = selection.type === 'event' && selection.eventId === ev.id;
            return (
              <button
                key={ev.id}
                className={`outline-row ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelection({ type: 'event', mapId: activeMap.id, eventId: ev.id });
                  setRightTab('inspector');
                }}
              >
                <PixelPreview kind="sprite" id={ev.sprite} size={18} />
                <span className="outline-name">{ev.name}</span>
                <span className="outline-coord">
                  ({ev.x},{ev.y})
                </span>
              </button>
            );
          })}

          {activeMap && activeMap.regions.length > 0 && (
            <>
              <div className="outline-subhead">
                <MapPin size={11} /> 语义区域 (点击 @引用 给 AI)
              </div>
              {activeMap.regions.map((reg) => {
                const isSelected =
                  selection.type === 'region' &&
                  selection.x === reg.x &&
                  selection.y === reg.y &&
                  selection.w === reg.w;
                return (
                  <button
                    key={reg.id}
                    className={`outline-row ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setSelection({
                        type: 'region',
                        mapId: activeMap.id,
                        x: reg.x,
                        y: reg.y,
                        w: reg.w,
                        h: reg.h,
                        label: reg.name,
                      });
                      setRightTab('ai');
                    }}
                  >
                    <span className="region-dot" />
                    <span className="outline-name">{reg.name}</span>
                    <span className="outline-coord">
                      {reg.w}×{reg.h}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </section>
    </aside>
  );
}
