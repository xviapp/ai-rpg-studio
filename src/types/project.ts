export type TerrainId =
  | 'grass'
  | 'water'
  | 'dirt'
  | 'stone'
  | 'sand'
  | 'forest_floor'
  | 'wood_floor';

export type PrefabId =
  | 'house_red'
  | 'house_blue'
  | 'oak_tree'
  | 'pine_tree'
  | 'bridge_h'
  | 'bridge_v'
  | 'well'
  | 'campfire'
  | 'signpost'
  | 'chest'
  | 'lamp'
  | 'rock'
  | 'flowers'
  | 'bush'
  | 'fence_h';

export type SpriteId =
  | 'hero'
  | 'elder'
  | 'guard'
  | 'merchant'
  | 'villager'
  | 'mage'
  | 'slime'
  | 'cat'
  | 'chest_npc'
  | 'sign_npc';

export type Direction = 'down' | 'up' | 'left' | 'right';

export type EventTrigger = 'interact' | 'touch' | 'autorun';

export interface MapEvent {
  id: string;
  name: string;
  x: number;
  y: number;
  sprite: SpriteId;
  dir: Direction;
  solid: boolean;
  visible: boolean;
  trigger: EventTrigger;
  script: string;
}

export interface MapPrefabInstance {
  id: string;
  prefabId: PrefabId;
  x: number;
  y: number;
}

export interface MapRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  description?: string;
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Row-major 2D array: terrain[y][x] */
  terrain: TerrainId[][];
  prefabs: MapPrefabInstance[];
  regions: MapRegion[];
  events: MapEvent[];
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
}

export interface RpgProject {
  name: string;
  version: string;
  startMapId: string;
  startX: number;
  startY: number;
  maps: Record<string, GameMap>;
  items: Record<string, ItemDef>;
  initialFlags: Record<string, boolean>;
  initialVars: Record<string, number>;
}

export type SelectionContext =
  | { type: 'none' }
  | { type: 'event'; mapId: string; eventId: string }
  | { type: 'region'; mapId: string; x: number; y: number; w: number; h: number; label?: string };

export type EditorTool =
  | 'select'
  | 'marquee'
  | 'terrain'
  | 'prefab'
  | 'event'
  | 'eraser';

export interface AiProviderConfig {
  mode: 'demo' | 'api';
  preset: 'deepseek' | 'openai' | 'custom';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiToolTrace {
  id: string;
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  contextLabel?: string;
  toolTraces?: AiToolTrace[];
  changes?: string[];
  snapshotBefore?: RpgProject;
  reverted?: boolean;
}
