import { PREFAB_CATALOG, SPRITE_CATALOG, TERRAIN_CATALOG, searchAssetCatalog } from '../assets/catalog';
import { validateLuaScript } from '../engine/luaRuntime';
import type {
  Direction,
  EventTrigger,
  GameMap,
  MapEvent,
  PrefabId,
  RpgProject,
  SpriteId,
  TerrainId,
} from '../types/project';

export interface ToolExecutionResult {
  ok: boolean;
  output: unknown;
  changeDescription?: string;
}

export const AI_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_project_overview',
      description: '查看工程整体概览：所有地图列表、尺寸、物品列表、初始开关和变量。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_map',
      description: '查看指定地图的详细信息：尺寸、命名区域(regions)、预制件(prefabs)列表、以及所有事件(events)坐标和摘要。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string', description: '地图 ID，例如 village' },
        },
        required: ['mapId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_assets',
      description: '按关键词搜索可用的地形(terrain)、预制件(prefab)和角色精灵(sprite) ID。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '中英文搜索词，留空返回全部' },
          category: { type: 'string', enum: ['terrain', 'prefab', 'sprite'] },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_event_script',
      description: '读取指定事件的完整 Lua 脚本代码。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          eventId: { type: 'string' },
        },
        required: ['mapId', 'eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_map',
      description: '创建一张新的 RPG 地图（或覆盖同名空地图），自动填充基础地形。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string', description: '英文蛇形 ID，如 dungeon_01' },
          name: { type: 'string', description: '中文名称，如 幽暗地牢' },
          width: { type: 'integer', description: '宽(10~40)' },
          height: { type: 'integer', description: '高(10~32)' },
          baseTerrain: {
            type: 'string',
            enum: ['grass', 'water', 'dirt', 'stone', 'sand', 'forest_floor', 'wood_floor'],
          },
        },
        required: ['mapId', 'name', 'width', 'height', 'baseTerrain'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'paint_terrain',
      description: '在地图上绘制语义地形区域（矩形或椭圆），引擎会自动处理 Auto-tile 边缘拼接。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          terrain: {
            type: 'string',
            enum: ['grass', 'water', 'dirt', 'stone', 'sand', 'forest_floor', 'wood_floor'],
          },
          shape: { type: 'string', enum: ['rect', 'ellipse'] },
          x: { type: 'integer' },
          y: { type: 'integer' },
          w: { type: 'integer' },
          h: { type: 'integer' },
        },
        required: ['mapId', 'terrain', 'shape', 'x', 'y', 'w', 'h'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draw_path',
      description: '沿折线关键点铺设一条连续的道路、河流或石板路（自动拐弯和宽度填充）。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          terrain: {
            type: 'string',
            enum: ['grass', 'water', 'dirt', 'stone', 'sand', 'forest_floor', 'wood_floor'],
          },
          width: { type: 'integer', description: '路宽 1~3' },
          points: {
            type: 'array',
            items: {
              type: 'object',
              properties: { x: { type: 'integer' }, y: { type: 'integer' } },
              required: ['x', 'y'],
            },
          },
        },
        required: ['mapId', 'terrain', 'points'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_prefab',
      description: '在指定坐标放置一个预制件（房屋、树、桥、篝火、水井、路灯等）。自动带碰撞与遮挡层。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          prefabId: {
            type: 'string',
            enum: Object.keys(PREFAB_CATALOG),
          },
          x: { type: 'integer' },
          y: { type: 'integer' },
        },
        required: ['mapId', 'prefabId', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_prefabs_in_area',
      description: '清除指定矩形区域内的预制件（可按 prefabId 过滤，不传则清空该区域所有预制件）。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          x: { type: 'integer' },
          y: { type: 'integer' },
          w: { type: 'integer' },
          h: { type: 'integer' },
          prefabId: { type: 'string', description: '可选，仅删除某类预制件' },
        },
        required: ['mapId', 'x', 'y', 'w', 'h'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scatter_props',
      description: '在指定矩形区域内自然散布若干装饰/植物（如野花、树木、岩石、灌木），自动避开水域和已有事件。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          x: { type: 'integer' },
          y: { type: 'integer' },
          w: { type: 'integer' },
          h: { type: 'integer' },
          prefabIds: {
            type: 'array',
            items: { type: 'string', enum: Object.keys(PREFAB_CATALOG) },
          },
          count: { type: 'integer', description: '放置数量 1~25' },
        },
        required: ['mapId', 'x', 'y', 'w', 'h', 'prefabIds', 'count'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_event',
      description: '新增或更新一个地图事件/NPC（包含坐标、精灵、触发方式及 Lua 5.4 脚本）。提交前会自动做 Lua 语法校验。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          eventId: { type: 'string', description: '唯一事件 ID，如 ev_merchant' },
          name: { type: 'string', description: '显示名称，如 流浪商人' },
          x: { type: 'integer' },
          y: { type: 'integer' },
          sprite: { type: 'string', enum: Object.keys(SPRITE_CATALOG) },
          dir: { type: 'string', enum: ['down', 'up', 'left', 'right'] },
          solid: { type: 'boolean' },
          visible: { type: 'boolean' },
          trigger: { type: 'string', enum: ['interact', 'touch', 'autorun'] },
          script: { type: 'string', description: '合法的 Lua 5.4 事件脚本，可使用 say/ask/flags/vars/give_item/move/teleport/play_sfx/toast 等 API' },
        },
        required: ['mapId', 'eventId', 'name', 'x', 'y', 'sprite', 'script'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'patch_event_script',
      description: '精准修改已有事件的 Lua 脚本（替换整段或局部代码块），自动做 Lua 5.4 语法校验。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          eventId: { type: 'string' },
          searchBlock: { type: 'string', description: '可选：要替换的旧代码片段。如果留空则用 newScript 覆盖全文' },
          newScript: { type: 'string', description: '替换后的代码片段或完整新脚本' },
        },
        required: ['mapId', 'eventId', 'newScript'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_event',
      description: '从地图中删除指定事件。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          eventId: { type: 'string' },
        },
        required: ['mapId', 'eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_item',
      description: '在工程物品数据库中新增或修改一个物品定义。',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['itemId', 'name', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'define_region',
      description: '在地图上标记一个语义命名区域（例如"东南营地"），便于后续定位与引用。',
      parameters: {
        type: 'object',
        properties: {
          mapId: { type: 'string' },
          regionId: { type: 'string' },
          name: { type: 'string' },
          x: { type: 'integer' },
          y: { type: 'integer' },
          w: { type: 'integer' },
          h: { type: 'integer' },
          description: { type: 'string' },
        },
        required: ['mapId', 'regionId', 'name', 'x', 'y', 'w', 'h'],
      },
    },
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function getMapOrError(project: RpgProject, mapId: string): { map?: GameMap; error?: string } {
  const map = project.maps[mapId];
  if (!map) {
    return {
      error: `地图 '${mapId}' 不存在。当前可用地图: ${Object.keys(project.maps).join(', ')}`,
    };
  }
  return { map };
}

/**
 * Executes a single AI tool against a mutable working copy of `project`.
 * Includes schema validation + real Lua 5.4 syntax checks so the LLM can self-heal on errors.
 */
export async function executeStudioTool(
  project: RpgProject,
  name: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (name) {
    case 'get_project_overview': {
      return {
        ok: true,
        output: {
          name: project.name,
          start: { mapId: project.startMapId, x: project.startX, y: project.startY },
          maps: Object.values(project.maps).map((m) => ({
            id: m.id,
            name: m.name,
            size: `${m.width}x${m.height}`,
            eventCount: m.events.length,
            regionCount: m.regions.length,
          })),
          items: Object.values(project.items),
          initialFlags: project.initialFlags,
          initialVars: project.initialVars,
        },
      };
    }

    case 'inspect_map': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      // Summarize terrain distribution without sending a giant raw matrix
      const terrainCounts: Record<string, number> = {};
      for (const row of map.terrain) {
        for (const t of row) {
          terrainCounts[t] = (terrainCounts[t] || 0) + 1;
        }
      }
      return {
        ok: true,
        output: {
          id: map.id,
          name: map.name,
          width: map.width,
          height: map.height,
          terrainSummary: terrainCounts,
          regions: map.regions,
          prefabs: map.prefabs.map((p) => ({ id: p.id, prefabId: p.prefabId, x: p.x, y: p.y })),
          events: map.events.map((e) => ({
            id: e.id,
            name: e.name,
            x: e.x,
            y: e.y,
            sprite: e.sprite,
            trigger: e.trigger,
            solid: e.solid,
            visible: e.visible,
          })),
        },
      };
    }

    case 'search_assets': {
      const q = String(args.query ?? '');
      const cat = args.category as 'terrain' | 'prefab' | 'sprite' | undefined;
      return { ok: true, output: searchAssetCatalog(q, cat) };
    }

    case 'read_event_script': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const ev = map.events.find((e) => e.id === String(args.eventId ?? ''));
      if (!ev) {
        return {
          ok: false,
          output: `未找到事件 '${args.eventId}'。当前地图事件: ${map.events.map((e) => `${e.id}(${e.name})`).join(', ')}`,
        };
      }
      return { ok: true, output: { id: ev.id, name: ev.name, x: ev.x, y: ev.y, script: ev.script } };
    }

    case 'create_map': {
      const mapId = String(args.mapId ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!mapId) return { ok: false, output: 'mapId 不能为空' };
      const mapName = String(args.name ?? mapId);
      const width = clamp(Number(args.width) || 20, 10, 40);
      const height = clamp(Number(args.height) || 15, 10, 32);
      const baseTerrain = String(args.baseTerrain ?? 'grass') as TerrainId;
      if (!TERRAIN_CATALOG[baseTerrain]) {
        return { ok: false, output: `未知地形 '${baseTerrain}'` };
      }
      project.maps[mapId] = {
        id: mapId,
        name: mapName,
        width,
        height,
        terrain: Array.from({ length: height }, () => Array.from({ length: width }, () => baseTerrain)),
        prefabs: [],
        regions: [],
        events: [],
      };
      return {
        ok: true,
        output: { created: mapId, width, height, baseTerrain },
        changeDescription: `创建新地图「${mapName}」(${mapId}, ${width}×${height})`,
      };
    }

    case 'paint_terrain': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const terrain = String(args.terrain ?? '') as TerrainId;
      if (!TERRAIN_CATALOG[terrain]) {
        return { ok: false, output: `未知地形 '${terrain}'，可选: ${Object.keys(TERRAIN_CATALOG).join(', ')}` };
      }
      const shape = args.shape === 'ellipse' ? 'ellipse' : 'rect';
      const x = clamp(Number(args.x) || 0, 0, map.width - 1);
      const y = clamp(Number(args.y) || 0, 0, map.height - 1);
      const w = clamp(Number(args.w) || 1, 1, map.width - x);
      const h = clamp(Number(args.h) || 1, 1, map.height - y);

      let painted = 0;
      const cx = x + (w - 1) / 2;
      const cy = y + (h - 1) / 2;
      const rx = Math.max(0.5, w / 2);
      const ry = Math.max(0.5, h / 2);

      for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) {
          if (shape === 'ellipse') {
            const norm = ((col - cx) / rx) ** 2 + ((row - cy) / ry) ** 2;
            if (norm > 1.05) continue;
          }
          map.terrain[row][col] = terrain;
          painted++;
        }
      }

      return {
        ok: true,
        output: { mapId: map.id, terrain, paintedTiles: painted },
        changeDescription: `在「${map.name}」绘制${TERRAIN_CATALOG[terrain].label}区域 (${x},${y} ${w}×${h})`,
      };
    }

    case 'draw_path': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const terrain = String(args.terrain ?? '') as TerrainId;
      if (!TERRAIN_CATALOG[terrain]) return { ok: false, output: `未知地形 '${terrain}'` };
      const points = Array.isArray(args.points)
        ? (args.points as Array<{ x: number; y: number }>)
        : [];
      if (points.length < 2) return { ok: false, output: 'points 至少需要 2 个坐标点' };
      const width = clamp(Number(args.width) || 1, 1, 3);

      const paintBrush = (px: number, py: number) => {
        for (let dy = 0; dy < width; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const gx = px + dx;
            const gy = py + dy;
            if (gx >= 0 && gx < map.width && gy >= 0 && gy < map.height) {
              map.terrain[gy][gx] = terrain;
            }
          }
        }
      };

      for (let i = 0; i < points.length - 1; i++) {
        let x0 = clamp(points[i].x, 0, map.width - 1);
        let y0 = clamp(points[i].y, 0, map.height - 1);
        const x1 = clamp(points[i + 1].x, 0, map.width - 1);
        const y1 = clamp(points[i + 1].y, 0, map.height - 1);
        while (x0 !== x1) {
          paintBrush(x0, y0);
          x0 += x0 < x1 ? 1 : -1;
        }
        while (y0 !== y1) {
          paintBrush(x0, y0);
          y0 += y0 < y1 ? 1 : -1;
        }
        paintBrush(x1, y1);
      }

      return {
        ok: true,
        output: { mapId: map.id, terrain, segments: points.length - 1 },
        changeDescription: `在「${map.name}」铺设${TERRAIN_CATALOG[terrain].label}路线（${points.length}个节点）`,
      };
    }

    case 'place_prefab': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const prefabId = String(args.prefabId ?? '') as PrefabId;
      const meta = PREFAB_CATALOG[prefabId];
      if (!meta) {
        return { ok: false, output: `未知预制件 '${prefabId}'，可选: ${Object.keys(PREFAB_CATALOG).join(', ')}` };
      }
      const x = clamp(Number(args.x) || 0, 0, Math.max(0, map.width - meta.w));
      const y = clamp(Number(args.y) || 0, 0, Math.max(0, map.height - meta.h));
      // Avoid exact duplicate at same tile
      const existing = map.prefabs.find((p) => p.prefabId === prefabId && p.x === x && p.y === y);
      if (!existing) {
        map.prefabs.push({
          id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          prefabId,
          x,
          y,
        });
      }
      return {
        ok: true,
        output: { mapId: map.id, prefabId, x, y, size: `${meta.w}x${meta.h}` },
        changeDescription: `放置预制件「${meta.label}」于 (${x}, ${y})`,
      };
    }

    case 'remove_prefabs_in_area': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const x = Number(args.x) || 0;
      const y = Number(args.y) || 0;
      const w = Math.max(1, Number(args.w) || 1);
      const h = Math.max(1, Number(args.h) || 1);
      const filterId = args.prefabId ? String(args.prefabId) : undefined;
      const before = map.prefabs.length;
      map.prefabs = map.prefabs.filter((p) => {
        const inside = p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
        if (!inside) return true;
        if (filterId && p.prefabId !== filterId) return true;
        return false;
      });
      const removed = before - map.prefabs.length;
      return {
        ok: true,
        output: { removed },
        changeDescription: `清除区域 (${x},${y} ${w}×${h}) 内 ${removed} 个预制件`,
      };
    }

    case 'scatter_props': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const x = clamp(Number(args.x) || 0, 0, map.width - 1);
      const y = clamp(Number(args.y) || 0, 0, map.height - 1);
      const w = clamp(Number(args.w) || 4, 1, map.width - x);
      const h = clamp(Number(args.h) || 4, 1, map.height - y);
      const prefabIds = (Array.isArray(args.prefabIds) ? args.prefabIds : []).filter(
        (id): id is PrefabId => typeof id === 'string' && id in PREFAB_CATALOG
      );
      if (prefabIds.length === 0) {
        return { ok: false, output: 'prefabIds 中没有合法的预制件 ID' };
      }
      const count = clamp(Number(args.count) || 5, 1, 25);
      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < count * 8) {
        attempts++;
        const pid = prefabIds[Math.floor(Math.random() * prefabIds.length)];
        const meta = PREFAB_CATALOG[pid];
        if (w < meta.w || h < meta.h) continue;
        const px = x + Math.floor(Math.random() * (w - meta.w + 1));
        const py = y + Math.floor(Math.random() * (h - meta.h + 1));
        // Skip water and occupied event tiles
        let valid = true;
        for (let dy = 0; dy < meta.h; dy++) {
          for (let dx = 0; dx < meta.w; dx++) {
            const t = map.terrain[py + dy]?.[px + dx];
            if (!t || t === 'water') valid = false;
            if (map.events.some((e) => e.x === px + dx && e.y === py + dy)) valid = false;
          }
        }
        if (map.prefabs.some((p) => Math.abs(p.x - px) < meta.w && Math.abs(p.y - py) < meta.h)) {
          valid = false;
        }
        if (!valid) continue;
        map.prefabs.push({
          id: `p_${Date.now().toString(36)}_${placed}_${Math.random().toString(36).slice(2, 5)}`,
          prefabId: pid,
          x: px,
          y: py,
        });
        placed++;
      }
      return {
        ok: true,
        output: { placed },
        changeDescription: `在 (${x},${y} ${w}×${h}) 散布了 ${placed} 个场景装饰`,
      };
    }

    case 'upsert_event': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const eventId = String(args.eventId ?? '').trim();
      if (!eventId) return { ok: false, output: 'eventId 不能为空' };
      const sprite = String(args.sprite ?? 'villager') as SpriteId;
      if (!SPRITE_CATALOG[sprite]) {
        return { ok: false, output: `未知精灵 '${sprite}'，可选: ${Object.keys(SPRITE_CATALOG).join(', ')}` };
      }
      const script = String(args.script ?? '');
      // Real Lua 5.4 syntax validation via wasmoon!
      const check = await validateLuaScript(script);
      if (!check.valid) {
        return {
          ok: false,
          output: `Lua 5.4 语法校验失败，请修正脚本后重试: ${check.error}`,
        };
      }

      const x = clamp(Number(args.x) || 0, 0, map.width - 1);
      const y = clamp(Number(args.y) || 0, 0, map.height - 1);
      const idx = map.events.findIndex((e) => e.id === eventId);
      const ev: MapEvent = {
        id: eventId,
        name: String(args.name ?? eventId),
        x,
        y,
        sprite,
        dir: (args.dir as Direction) || 'down',
        solid: args.solid !== undefined ? Boolean(args.solid) : true,
        visible: args.visible !== undefined ? Boolean(args.visible) : true,
        trigger: (args.trigger as EventTrigger) || 'interact',
        script,
      };
      if (idx >= 0) {
        map.events[idx] = ev;
      } else {
        map.events.push(ev);
      }
      return {
        ok: true,
        output: { action: idx >= 0 ? 'updated' : 'created', eventId, x, y, luaValidated: true },
        changeDescription: `${idx >= 0 ? '更新' : '新增'}事件/NPC「${ev.name}」于 (${x}, ${y})（Lua 语法已通过校验）`,
      };
    }

    case 'patch_event_script': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const ev = map.events.find((e) => e.id === String(args.eventId ?? ''));
      if (!ev) return { ok: false, output: `未找到事件 '${args.eventId}'` };
      const searchBlock = args.searchBlock ? String(args.searchBlock) : '';
      const newScriptInput = String(args.newScript ?? '');
      let nextScript = newScriptInput;
      if (searchBlock) {
        if (!ev.script.includes(searchBlock)) {
          return {
            ok: false,
            output: 'searchBlock 在原脚本中未精确匹配，请先调用 read_event_script 或省略 searchBlock 替换全文。',
          };
        }
        nextScript = ev.script.replace(searchBlock, newScriptInput);
      }
      const check = await validateLuaScript(nextScript);
      if (!check.valid) {
        return {
          ok: false,
          output: `修改后的 Lua 5.4 脚本语法错误，请修正后重试: ${check.error}`,
        };
      }
      ev.script = nextScript;
      return {
        ok: true,
        output: { eventId: ev.id, luaValidated: true },
        changeDescription: `更新「${ev.name}」的 Lua 脚本（语法校验通过）`,
      };
    }

    case 'delete_event': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const idx = map.events.findIndex((e) => e.id === String(args.eventId ?? ''));
      if (idx < 0) return { ok: false, output: `未找到事件 '${args.eventId}'` };
      const removed = map.events[idx];
      map.events.splice(idx, 1);
      return {
        ok: true,
        output: { deleted: removed.id },
        changeDescription: `删除事件「${removed.name}」`,
      };
    }

    case 'upsert_item': {
      const itemId = String(args.itemId ?? '').trim();
      if (!itemId) return { ok: false, output: 'itemId 不能为空' };
      project.items[itemId] = {
        id: itemId,
        name: String(args.name ?? itemId),
        description: String(args.description ?? ''),
      };
      return {
        ok: true,
        output: project.items[itemId],
        changeDescription: `注册物品「${project.items[itemId].name}」(${itemId})`,
      };
    }

    case 'define_region': {
      const { map, error } = getMapOrError(project, String(args.mapId ?? ''));
      if (!map) return { ok: false, output: error };
      const regionId = String(args.regionId ?? '').trim();
      if (!regionId) return { ok: false, output: 'regionId 不能为空' };
      const region = {
        id: regionId,
        name: String(args.name ?? regionId),
        x: clamp(Number(args.x) || 0, 0, map.width - 1),
        y: clamp(Number(args.y) || 0, 0, map.height - 1),
        w: clamp(Number(args.w) || 2, 1, map.width),
        h: clamp(Number(args.h) || 2, 1, map.height),
        description: args.description ? String(args.description) : undefined,
      };
      const idx = map.regions.findIndex((r) => r.id === regionId);
      if (idx >= 0) map.regions[idx] = region;
      else map.regions.push(region);
      return {
        ok: true,
        output: region,
        changeDescription: `标记地图区域「${region.name}」(${region.x},${region.y} ${region.w}×${region.h})`,
      };
    }

    default:
      return { ok: false, output: `未知工具 '${name}'` };
  }
}
