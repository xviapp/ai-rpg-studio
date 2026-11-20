import { create } from 'zustand';
import { createStarterProject } from '../data/starterProject';
import type {
  AiChatMessage,
  AiProviderConfig,
  Direction,
  EditorTool,
  MapEvent,
  PrefabId,
  RpgProject,
  SelectionContext,
  SpriteId,
  TerrainId,
} from '../types/project';

const AI_CONFIG_KEY = 'luacraft_ai_config_v1';

function loadSavedAiConfig(): AiProviderConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: parsed.mode === 'api' ? 'api' : 'demo',
        preset: parsed.preset || 'deepseek',
        baseUrl: parsed.baseUrl || 'https://api.deepseek.com/v1',
        apiKey: parsed.apiKey || '',
        model: parsed.model || 'deepseek-chat',
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    mode: 'demo',
    preset: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
  };
}

export interface HistoryEntry {
  label: string;
  project: RpgProject;
}

export interface DialogueState {
  speaker: string;
  text: string;
  choices?: string[];
  resolve: (value: number) => void;
}

export interface LuaLogEntry {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface ToastItem {
  id: string;
  text: string;
}

export interface PlayerRuntimeState {
  mapId: string;
  x: number;
  y: number;
  dir: Direction;
  walkFrame: number;
}

interface StudioState {
  // Core project + Undo/Redo stack
  project: RpgProject;
  past: HistoryEntry[];
  future: HistoryEntry[];
  lastActionLabel: string;

  // Editor UI state
  mode: 'edit' | 'play';
  activeMapId: string;
  activeTool: EditorTool;
  selectedTerrain: TerrainId;
  selectedPrefab: PrefabId;
  selectedSprite: SpriteId;
  selection: SelectionContext;
  rightTab: 'ai' | 'inspector';
  showGrid: boolean;
  zoom: number;
  showSettingsModal: boolean;

  // Play Mode runtime state
  player: PlayerRuntimeState;
  runtimeMaps: Record<string, { terrain: TerrainId[][]; events: MapEvent[] }>;
  flags: Record<string, boolean>;
  vars: Record<string, number>;
  inventory: Record<string, number>;
  dialogue: DialogueState | null;
  toasts: ToastItem[];
  luaLogs: LuaLogEntry[];
  isRunningScript: boolean;

  // AI Assistant state
  aiConfig: AiProviderConfig;
  messages: AiChatMessage[];
  isGenerating: boolean;
  aiStatusText: string;

  // Project / History Actions
  commitProject: (nextProject: RpgProject, label: string) => void;
  mutateProjectSilent: (updater: (draft: RpgProject) => void) => void;
  pushUndoSnapshot: (label: string) => void;
  undo: () => void;
  redo: () => void;
  revertToSnapshot: (snapshot: RpgProject, messageId: string) => void;
  resetDemoProject: () => void;
  importProjectJson: (project: RpgProject) => void;

  // Editor UI Actions
  setMode: (mode: 'edit' | 'play') => void;
  setActiveMapId: (mapId: string) => void;
  setActiveTool: (tool: EditorTool) => void;
  setSelectedTerrain: (t: TerrainId) => void;
  setSelectedPrefab: (p: PrefabId) => void;
  setSelectedSprite: (s: SpriteId) => void;
  setSelection: (sel: SelectionContext) => void;
  setRightTab: (tab: 'ai' | 'inspector') => void;
  toggleGrid: () => void;
  setZoom: (zoom: number) => void;
  setShowSettingsModal: (open: boolean) => void;

  // Play Runtime Actions
  startPlaySession: () => void;
  setPlayer: (patch: Partial<PlayerRuntimeState>) => void;
  updateRuntimeEvent: (mapId: string, eventId: string, patch: Partial<MapEvent>) => void;
  setRuntimeTerrain: (mapId: string, x: number, y: number, terrain: TerrainId) => void;
  setFlag: (k: string, v: boolean) => void;
  setVar: (k: string, v: number) => void;
  addItem: (itemId: string, count: number) => void;
  removeItem: (itemId: string, count: number) => boolean;
  setDialogue: (d: DialogueState | null) => void;
  pushToast: (text: string) => void;
  pushLuaLog: (message: string, level?: 'info' | 'warn' | 'error') => void;
  clearLuaLogs: () => void;
  setIsRunningScript: (running: boolean) => void;

  // AI Actions
  setAiConfig: (patch: Partial<AiProviderConfig>) => void;
  addMessage: (msg: AiChatMessage) => void;
  setGenerating: (busy: boolean, statusText?: string) => void;
}

const initialProject = createStarterProject();

function buildRuntimeMaps(project: RpgProject) {
  const out: Record<string, { terrain: TerrainId[][]; events: MapEvent[] }> = {};
  for (const [id, map] of Object.entries(project.maps)) {
    out[id] = {
      terrain: structuredClone(map.terrain),
      events: structuredClone(map.events),
    };
  }
  return out;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  project: initialProject,
  past: [],
  future: [],
  lastActionLabel: '初始工程',

  mode: 'edit',
  activeMapId: initialProject.startMapId,
  activeTool: 'select',
  selectedTerrain: 'dirt',
  selectedPrefab: 'house_red',
  selectedSprite: 'merchant',
  selection: { type: 'none' },
  rightTab: 'ai',
  showGrid: true,
  zoom: 2,
  showSettingsModal: false,

  player: {
    mapId: initialProject.startMapId,
    x: initialProject.startX,
    y: initialProject.startY,
    dir: 'down',
    walkFrame: 0,
  },
  runtimeMaps: buildRuntimeMaps(initialProject),
  flags: { ...initialProject.initialFlags },
  vars: { ...initialProject.initialVars },
  inventory: {},
  dialogue: null,
  toasts: [],
  luaLogs: [],
  isRunningScript: false,

  aiConfig: loadSavedAiConfig(),
  messages: [
    {
      id: 'welcome_msg',
      role: 'assistant',
      timestamp: Date.now(),
      content:
        '你好！我是 **LuaCraft AI 副驾驶**。你可以直接用一句话让我生成/修改地图、放置建筑、编写 Lua 5.4 事件脚本。\n\n试试点击下方快捷指令，或者先在画布上用「框选工具」框出一块区域，再告诉我你想改什么！',
    },
  ],
  isGenerating: false,
  aiStatusText: '',

  commitProject: (nextProject, label) => {
    const cur = get().project;
    set((s) => ({
      project: nextProject,
      past: [...s.past.slice(-29), { label, project: structuredClone(cur) }],
      future: [],
      lastActionLabel: label,
    }));
  },

  pushUndoSnapshot: (label) => {
    const cur = get().project;
    set((s) => ({
      past: [...s.past.slice(-29), { label, project: structuredClone(cur) }],
      future: [],
      lastActionLabel: label,
    }));
  },

  mutateProjectSilent: (updater) => {
    set((s) => {
      const next = structuredClone(s.project);
      updater(next);
      return { project: next };
    });
  },

  undo: () => {
    const { past, project } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const nextActiveMap = prev.project.maps[get().activeMapId]
      ? get().activeMapId
      : prev.project.startMapId;
    set((s) => ({
      project: prev.project,
      activeMapId: nextActiveMap,
      selection: { type: 'none' },
      past: s.past.slice(0, -1),
      future: [{ label: prev.label, project: structuredClone(project) }, ...s.future.slice(0, 29)],
      lastActionLabel: `已撤销：${prev.label}`,
    }));
  },

  redo: () => {
    const { future, project } = get();
    if (future.length === 0) return;
    const next = future[0];
    const nextActiveMap = next.project.maps[get().activeMapId]
      ? get().activeMapId
      : next.project.startMapId;
    set((s) => ({
      project: next.project,
      activeMapId: nextActiveMap,
      selection: { type: 'none' },
      future: s.future.slice(1),
      past: [...s.past.slice(-29), { label: next.label, project: structuredClone(project) }],
      lastActionLabel: `已重做：${next.label}`,
    }));
  },

  revertToSnapshot: (snapshot, messageId) => {
    const cur = get().project;
    const nextMap = snapshot.maps[get().activeMapId] ? get().activeMapId : snapshot.startMapId;
    set((s) => ({
      project: structuredClone(snapshot),
      activeMapId: nextMap,
      selection: { type: 'none' },
      past: [...s.past.slice(-29), { label: '回滚 AI 修改', project: structuredClone(cur) }],
      future: [],
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, reverted: true } : m)),
    }));
  },

  resetDemoProject: () => {
    const fresh = createStarterProject();
    set({
      project: fresh,
      past: [],
      future: [],
      mode: 'edit',
      activeMapId: fresh.startMapId,
      selection: { type: 'none' },
      lastActionLabel: '已重置演示工程',
    });
  },

  importProjectJson: (project) => {
    const cur = get().project;
    set((s) => ({
      project,
      mode: 'edit',
      activeMapId: project.startMapId in project.maps ? project.startMapId : Object.keys(project.maps)[0],
      selection: { type: 'none' },
      past: [...s.past.slice(-29), { label: '导入工程', project: structuredClone(cur) }],
      future: [],
    }));
  },

  setMode: (mode) => {
    if (mode === 'play') {
      get().startPlaySession();
    } else {
      const dlg = get().dialogue;
      if (dlg) dlg.resolve(0);
      set({ mode: 'edit', dialogue: null, isRunningScript: false });
    }
  },

  setActiveMapId: (mapId) => set({ activeMapId: mapId, selection: { type: 'none' } }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectedTerrain: (t) => set({ selectedTerrain: t, activeTool: 'terrain' }),
  setSelectedPrefab: (p) => set({ selectedPrefab: p, activeTool: 'prefab' }),
  setSelectedSprite: (s) => set({ selectedSprite: s, activeTool: 'event' }),
  setSelection: (selection) => set({ selection }),
  setRightTab: (rightTab) => set({ rightTab }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(4, zoom)) }),
  setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),

  startPlaySession: () => {
    const { project, activeMapId } = get();
    const spawnMapId = project.maps[activeMapId] ? activeMapId : project.startMapId;
    const spawnMap = project.maps[spawnMapId];
    const startX =
      spawnMapId === project.startMapId
        ? project.startX
        : Math.floor(spawnMap.width / 2);
    const startY =
      spawnMapId === project.startMapId
        ? project.startY
        : Math.floor(spawnMap.height / 2);

    set({
      mode: 'play',
      activeMapId: spawnMapId,
      player: {
        mapId: spawnMapId,
        x: startX,
        y: startY,
        dir: 'down',
        walkFrame: 0,
      },
      runtimeMaps: buildRuntimeMaps(project),
      flags: { ...project.initialFlags },
      vars: { ...project.initialVars },
      inventory: {},
      dialogue: null,
      toasts: [],
      isRunningScript: false,
      luaLogs: [
        {
          id: `log_${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          level: 'info',
          message: `Lua 5.4 (wasmoon) 沙盒就绪 — 已进入「${spawnMap.name}」，按 WASD/方向键移动，空格/Enter 交互`,
        },
      ],
    });
  },

  setPlayer: (patch) => set((s) => ({ player: { ...s.player, ...patch } })),

  updateRuntimeEvent: (mapId, eventId, patch) => {
    set((s) => {
      const rm = s.runtimeMaps[mapId];
      if (!rm) return s;
      return {
        runtimeMaps: {
          ...s.runtimeMaps,
          [mapId]: {
            ...rm,
            events: rm.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
          },
        },
      };
    });
  },

  setRuntimeTerrain: (mapId, x, y, terrain) => {
    set((s) => {
      const rm = s.runtimeMaps[mapId];
      if (!rm || !rm.terrain[y] || rm.terrain[y][x] === undefined) return s;
      const nextGrid = rm.terrain.map((row, ry) =>
        ry === y ? row.map((cell, rx) => (rx === x ? terrain : cell)) : row
      );
      return {
        runtimeMaps: {
          ...s.runtimeMaps,
          [mapId]: { ...rm, terrain: nextGrid },
        },
      };
    });
  },

  setFlag: (k, v) => set((s) => ({ flags: { ...s.flags, [k]: v } })),
  setVar: (k, v) => set((s) => ({ vars: { ...s.vars, [k]: v } })),

  addItem: (itemId, count) =>
    set((s) => ({
      inventory: {
        ...s.inventory,
        [itemId]: (s.inventory[itemId] || 0) + count,
      },
    })),

  removeItem: (itemId, count) => {
    const cur = get().inventory[itemId] || 0;
    if (cur < count) return false;
    set((s) => {
      const next = { ...s.inventory };
      const rem = (next[itemId] || 0) - count;
      if (rem <= 0) delete next[itemId];
      else next[itemId] = rem;
      return { inventory: next };
    });
    return true;
  },

  setDialogue: (dialogue) => set({ dialogue }),

  pushToast: (text) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },

  pushLuaLog: (message, level = 'info') =>
    set((s) => ({
      luaLogs: [
        ...s.luaLogs.slice(-39),
        {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          time: new Date().toLocaleTimeString(),
          level,
          message,
        },
      ],
    })),

  clearLuaLogs: () => set({ luaLogs: [] }),
  setIsRunningScript: (isRunningScript) => set({ isRunningScript }),

  setAiConfig: (patch) => {
    set((s) => {
      const next = { ...s.aiConfig, ...patch };
      try {
        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return { aiConfig: next };
    });
  },

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setGenerating: (isGenerating, aiStatusText = '') => set({ isGenerating, aiStatusText }),
}));
