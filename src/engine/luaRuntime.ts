import { LuaFactory } from 'wasmoon';
import wasmUrl from 'wasmoon/dist/glue.wasm?url';
import type { Direction, TerrainId } from '../types/project';
import type { SfxName } from './sfx';

let factoryInstance: LuaFactory | null = null;

function getFactory(): LuaFactory {
  if (!factoryInstance) {
    factoryInstance = new LuaFactory(wasmUrl);
  }
  return factoryInstance;
}

export interface LuaHostCallbacks {
  selfEventId: string;
  selfEventName: string;
  say: (speaker: string, text: string) => Promise<void>;
  ask: (prompt: string, choices: string[]) => Promise<number>;
  toast: (text: string) => void;
  wait: (ms: number) => Promise<void>;
  move: (target: string, dir: Direction, steps: number) => Promise<boolean>;
  face: (target: string, dir: Direction) => void;
  teleport: (mapId: string, x: number, y: number) => void;
  giveItem: (itemId: string, count: number) => void;
  takeItem: (itemId: string, count: number) => boolean;
  hasItem: (itemId: string, count: number) => boolean;
  getFlag: (name: string) => boolean;
  setFlag: (name: string, value: boolean) => void;
  getVar: (name: string) => number;
  setVar: (name: string, value: number) => void;
  setSolid: (target: string, solid: boolean) => void;
  setVisible: (target: string, visible: boolean) => void;
  setTerrain: (x: number, y: number, terrain: TerrainId) => void;
  playSfx: (name: SfxName) => void;
  log: (msg: string, level?: 'info' | 'warn' | 'error') => void;
}

export interface LuaValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates Lua 5.4 syntax using real wasmoon compiler (`load`) without executing the code.
 */
export async function validateLuaScript(code: string): Promise<LuaValidationResult> {
  const factory = getFactory();
  const lua = await factory.createEngine({ openStandardLibs: true });
  try {
    lua.global.set('__code_to_check', code);
    const err: string | null = await lua.doString(`
      local fn, err = load(__code_to_check, "event.lua", "t")
      if not fn then
        return tostring(err)
      end
      return nil
    `);
    if (err) {
      return { valid: false, error: err };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    lua.global.close();
  }
}

/**
 * Executes an RPG event Lua script inside a sandboxed Lua 5.4 VM with coroutine-bridged async APIs.
 */
export async function runEventLuaScript(
  script: string,
  host: LuaHostCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const factory = getFactory();
  const lua = await factory.createEngine({
    openStandardLibs: true,
    // Guard against runaway CPU loops inside a single synchronous step
    functionTimeout: 3000,
  });

  const checkAbort = () => {
    if (signal?.aborted) {
      throw new Error('__SCRIPT_ABORTED__');
    }
  };

  try {
    lua.global.set('__host_say', async (speaker: unknown, text?: unknown) => {
      checkAbort();
      // Support both say("text") and say("Speaker", "text")
      if (text === undefined || text === null) {
        await host.say(host.selfEventName, String(speaker ?? ''));
      } else {
        await host.say(String(speaker ?? ''), String(text));
      }
      checkAbort();
    });

    lua.global.set('__host_ask', async (prompt: unknown, choices: unknown) => {
      checkAbort();
      const arr = Array.isArray(choices)
        ? choices.map((c) => String(c))
        : ['确定'];
      const idx = await host.ask(String(prompt ?? ''), arr);
      checkAbort();
      return idx;
    });

    lua.global.set('__host_wait', async (ms: unknown) => {
      checkAbort();
      const clamped = Math.max(0, Math.min(Number(ms) || 0, 10000));
      await host.wait(clamped);
      checkAbort();
    });

    lua.global.set('__host_move', async (target: unknown, dir: unknown, steps?: unknown) => {
      checkAbort();
      const d = String(dir ?? 'down') as Direction;
      const n = Math.max(1, Math.min(Math.round(Number(steps) || 1), 20));
      const res = await host.move(String(target ?? 'self'), d, n);
      checkAbort();
      return res;
    });

    lua.global.set('__host_face', (target: unknown, dir: unknown) => {
      host.face(String(target ?? 'self'), String(dir ?? 'down') as Direction);
    });

    lua.global.set('__host_toast', (text: unknown) => {
      host.toast(String(text ?? ''));
    });

    lua.global.set('__host_teleport', (mapId: unknown, x: unknown, y: unknown) => {
      host.teleport(String(mapId ?? ''), Math.round(Number(x) || 0), Math.round(Number(y) || 0));
    });

    lua.global.set('__host_give_item', (itemId: unknown, count?: unknown) => {
      host.giveItem(String(itemId ?? ''), Math.max(1, Math.round(Number(count) || 1)));
    });

    lua.global.set('__host_take_item', (itemId: unknown, count?: unknown) => {
      return host.takeItem(String(itemId ?? ''), Math.max(1, Math.round(Number(count) || 1)));
    });

    lua.global.set('__host_has_item', (itemId: unknown, count?: unknown) => {
      return host.hasItem(String(itemId ?? ''), Math.max(1, Math.round(Number(count) || 1)));
    });

    lua.global.set('__host_get_flag', (name: unknown) => host.getFlag(String(name ?? '')));
    lua.global.set('__host_set_flag', (name: unknown, val: unknown) => {
      host.setFlag(String(name ?? ''), Boolean(val));
    });

    lua.global.set('__host_get_var', (name: unknown) => host.getVar(String(name ?? '')));
    lua.global.set('__host_set_var', (name: unknown, val: unknown) => {
      host.setVar(String(name ?? ''), Number(val) || 0);
    });

    lua.global.set('__host_set_solid', (target: unknown, solid: unknown) => {
      host.setSolid(String(target ?? 'self'), Boolean(solid));
    });

    lua.global.set('__host_set_visible', (target: unknown, visible: unknown) => {
      host.setVisible(String(target ?? 'self'), Boolean(visible));
    });

    lua.global.set('__host_set_terrain', (x: unknown, y: unknown, terrain: unknown) => {
      host.setTerrain(Math.round(Number(x) || 0), Math.round(Number(y) || 0), String(terrain ?? 'grass') as TerrainId);
    });

    lua.global.set('__host_play_sfx', (name: unknown) => {
      host.playSfx(String(name ?? 'blip') as SfxName);
    });

    lua.global.set('__host_log', (...args: unknown[]) => {
      host.log(args.map((a) => String(a)).join(' '), 'info');
    });

    lua.global.set('__self_id', host.selfEventId);

    const prelude = `
      -- Sandbox: strip unsafe OS/IO/module libraries
      os = nil
      io = nil
      package = nil
      dofile = nil
      loadfile = nil
      debug = nil

      -- Coroutine-bridged async RPG APIs (look synchronous to authors & AI)
      function say(speaker, text)
        return __host_say(speaker, text):await()
      end
      function ask(prompt, choices)
        return __host_ask(prompt, choices):await()
      end
      function wait(ms)
        return __host_wait(ms):await()
      end
      function move(target, dir, steps)
        return __host_move(target, dir, steps or 1):await()
      end
      function face(target, dir)
        __host_face(target, dir)
      end
      function toast(text)
        __host_toast(text)
      end
      function teleport(mapId, x, y)
        __host_teleport(mapId, x, y)
      end
      function give_item(itemId, count)
        __host_give_item(itemId, count or 1)
      end
      function take_item(itemId, count)
        return __host_take_item(itemId, count or 1)
      end
      function has_item(itemId, count)
        return __host_has_item(itemId, count or 1)
      end
      function get_flag(name) return __host_get_flag(name) end
      function set_flag(name, val) __host_set_flag(name, val) end
      function get_var(name) return __host_get_var(name) end
      function set_var(name, val) __host_set_var(name, val) end
      function set_solid(target, solid) __host_set_solid(target, solid) end
      function set_visible(target, visible) __host_set_visible(target, visible) end
      function set_terrain(x, y, terrain) __host_set_terrain(x, y, terrain) end
      function play_sfx(name) __host_play_sfx(name) end
      function print(...) __host_log(...) end

      -- Convenient metatable proxies: flags.has_pass = true / vars.gold = vars.gold + 10
      flags = setmetatable({}, {
        __index = function(_, k) return __host_get_flag(k) end,
        __newindex = function(_, k, v) __host_set_flag(k, v) end
      })
      vars = setmetatable({}, {
        __index = function(_, k) return __host_get_var(k) end,
        __newindex = function(_, k, v) __host_set_var(k, v) end
      })
      self_id = __self_id
    `;

    // Support both top-level imperative scripts AND scripts that define `function on_interact()`
    const fullProgram = `
      ${prelude}
      ${script}
      if type(on_interact) == "function" then
        on_interact()
      end
    `;

    await lua.doString(fullProgram);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('__SCRIPT_ABORTED__')) {
      return;
    }
    host.log(`[Lua Error @ ${host.selfEventName}] ${msg}`, 'error');
  } finally {
    lua.global.close();
  }
}

export const LUA_API_REFERENCE = [
  { sig: 'say(speaker, text)', desc: '显示 RPG 对话框并等待确认' },
  { sig: 'local idx = ask(prompt, {"选项1", "选项2"})', desc: '弹出选项菜单，返回 1-based 索引' },
  { sig: 'flags.my_flag = true', desc: '读写全局布尔开关（实时持久化）' },
  { sig: 'vars.gold = (vars.gold or 0) + 50', desc: '读写全局数值变量' },
  { sig: 'give_item("iron_sword", 1) / has_item("pass")', desc: '增删/检查背包物品' },
  { sig: 'move("self"|"player"|id, "up"|"down"|"left"|"right", steps)', desc: '控制角色逐步移动' },
  { sig: 'teleport("map_id", x, y)', desc: '传送主角到指定地图和坐标' },
  { sig: 'set_solid("self", false) / set_visible("self", false)', desc: '修改事件碰撞或可见性' },
  { sig: 'set_terrain(x, y, "dirt") / toast("提示") / play_sfx("coin")', desc: '动态改地形、弹提示、播音效' },
];
