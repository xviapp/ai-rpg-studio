import { useCallback, useEffect, useRef, useState } from 'react';
import { Backpack, Flag, Coins, Terminal, X, RotateCcw, Sparkles } from 'lucide-react';
import { PREFAB_CATALOG, SPRITE_CATALOG } from '../assets/catalog';
import {
  TILE_SIZE,
  computeNeighborMask,
  drawPrefab,
  drawSprite,
  drawTerrainTile,
} from '../assets/pixelAtlas';
import { findEventAt, isTileWalkable } from '../engine/collision';
import { runEventLuaScript } from '../engine/luaRuntime';
import { playSfx } from '../engine/sfx';
import { useStudioStore } from '../store/useStudioStore';
import type { Direction, MapEvent } from '../types/project';

const DIR_DELTA: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function oppositeDir(dir: Direction): Direction {
  if (dir === 'up') return 'down';
  if (dir === 'down') return 'up';
  if (dir === 'left') return 'right';
  return 'left';
}

export function MapViewport() {
  const project = useStudioStore((s) => s.project);
  const mode = useStudioStore((s) => s.mode);
  const activeMapId = useStudioStore((s) => s.activeMapId);
  const activeTool = useStudioStore((s) => s.activeTool);
  const selectedTerrain = useStudioStore((s) => s.selectedTerrain);
  const selectedPrefab = useStudioStore((s) => s.selectedPrefab);
  const selectedSprite = useStudioStore((s) => s.selectedSprite);
  const selection = useStudioStore((s) => s.selection);
  const showGrid = useStudioStore((s) => s.showGrid);
  const zoom = useStudioStore((s) => s.zoom);

  const player = useStudioStore((s) => s.player);
  const runtimeMaps = useStudioStore((s) => s.runtimeMaps);
  const flags = useStudioStore((s) => s.flags);
  const vars = useStudioStore((s) => s.vars);
  const inventory = useStudioStore((s) => s.inventory);
  const dialogue = useStudioStore((s) => s.dialogue);
  const toasts = useStudioStore((s) => s.toasts);
  const luaLogs = useStudioStore((s) => s.luaLogs);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartTileRef = useRef<{ x: number; y: number } | null>(null);
  const animFrameRef = useRef(0);
  const scriptAbortRef = useRef<AbortController | null>(null);

  const currentMapId = mode === 'play' ? player.mapId : activeMapId;
  const map = project.maps[currentMapId] ?? Object.values(project.maps)[0];

  // Abort running Lua script if exiting Play Mode
  useEffect(() => {
    if (mode === 'edit' && scriptAbortRef.current) {
      scriptAbortRef.current.abort();
      scriptAbortRef.current = null;
    }
  }, [mode]);

  const executeEventScript = useCallback(async (ev: MapEvent) => {
    const store = useStudioStore.getState();
    if (store.isRunningScript || store.mode !== 'play') return;

    store.setIsRunningScript(true);
    const controller = new AbortController();
    scriptAbortRef.current = controller;

    // Face the NPC toward player on interact
    if (ev.trigger === 'interact' && ev.visible) {
      const p = store.player;
      if (p.x < ev.x) store.updateRuntimeEvent(p.mapId, ev.id, { dir: 'left' });
      else if (p.x > ev.x) store.updateRuntimeEvent(p.mapId, ev.id, { dir: 'right' });
      else if (p.y < ev.y) store.updateRuntimeEvent(p.mapId, ev.id, { dir: 'up' });
      else if (p.y > ev.y) store.updateRuntimeEvent(p.mapId, ev.id, { dir: 'down' });
    }

    store.pushLuaLog(`执行事件 [${ev.name}] (${ev.id})`, 'info');

    try {
      await runEventLuaScript(
        ev.script,
        {
          selfEventId: ev.id,
          selfEventName: ev.name,
          say: (speaker, text) =>
            new Promise<void>((resolve) => {
              playSfx('blip');
              useStudioStore.getState().setDialogue({
                speaker,
                text,
                resolve: () => {
                  useStudioStore.getState().setDialogue(null);
                  resolve();
                },
              });
            }),
          ask: (prompt, choices) =>
            new Promise<number>((resolve) => {
              playSfx('blip');
              useStudioStore.getState().setDialogue({
                speaker: ev.name,
                text: prompt,
                choices,
                resolve: (idx) => {
                  playSfx('confirm');
                  useStudioStore.getState().setDialogue(null);
                  resolve(idx);
                },
              });
            }),
          toast: (text) => useStudioStore.getState().pushToast(text),
          wait: (ms) => new Promise((r) => setTimeout(r, ms)),
          move: async (target, dir, steps) => {
            const [dx, dy] = DIR_DELTA[dir] ?? [0, 0];
            let movedAny = false;
            for (let i = 0; i < steps; i++) {
              if (controller.signal.aborted) break;
              const st = useStudioStore.getState();
              const curMap = st.project.maps[st.player.mapId];
              const rt = st.runtimeMaps[st.player.mapId];
              if (!curMap || !rt) break;
              const composedMap = { ...curMap, terrain: rt.terrain };

              if (target === 'player') {
                const nx = st.player.x + dx;
                const ny = st.player.y + dy;
                st.setPlayer({ dir, walkFrame: st.player.walkFrame + 1 });
                if (isTileWalkable(composedMap, nx, ny, rt.events)) {
                  st.setPlayer({ x: nx, y: ny });
                  playSfx('step');
                  movedAny = true;
                }
              } else {
                const tid = target === 'self' ? ev.id : target;
                const targetEv = rt.events.find((e) => e.id === tid);
                if (!targetEv) break;
                const nx = targetEv.x + dx;
                const ny = targetEv.y + dy;
                st.updateRuntimeEvent(st.player.mapId, tid, { dir });
                const hitsPlayer = st.player.x === nx && st.player.y === ny;
                if (!hitsPlayer && isTileWalkable(composedMap, nx, ny, rt.events, tid)) {
                  st.updateRuntimeEvent(st.player.mapId, tid, { x: nx, y: ny });
                  movedAny = true;
                }
              }
              await new Promise((r) => setTimeout(r, 140));
            }
            return movedAny;
          },
          face: (target, dir) => {
            const st = useStudioStore.getState();
            if (target === 'player') {
              st.setPlayer({ dir });
            } else {
              const tid = target === 'self' ? ev.id : target;
              st.updateRuntimeEvent(st.player.mapId, tid, { dir });
            }
          },
          teleport: (mapId, x, y) => {
            const st = useStudioStore.getState();
            if (!st.project.maps[mapId]) {
              st.pushLuaLog(`teleport 失败：地图 '${mapId}' 不存在`, 'warn');
              return;
            }
            st.setPlayer({ mapId, x, y });
            st.setActiveMapId(mapId);
          },
          giveItem: (itemId, count) => {
            useStudioStore.getState().addItem(itemId, count);
          },
          takeItem: (itemId, count) => useStudioStore.getState().removeItem(itemId, count),
          hasItem: (itemId, count) => (useStudioStore.getState().inventory[itemId] || 0) >= count,
          getFlag: (name) => Boolean(useStudioStore.getState().flags[name]),
          setFlag: (name, value) => useStudioStore.getState().setFlag(name, value),
          getVar: (name) => Number(useStudioStore.getState().vars[name] ?? 0),
          setVar: (name, value) => useStudioStore.getState().setVar(name, value),
          setSolid: (target, solid) => {
            const st = useStudioStore.getState();
            const tid = target === 'self' ? ev.id : target;
            st.updateRuntimeEvent(st.player.mapId, tid, { solid });
          },
          setVisible: (target, visible) => {
            const st = useStudioStore.getState();
            const tid = target === 'self' ? ev.id : target;
            st.updateRuntimeEvent(st.player.mapId, tid, { visible });
          },
          setTerrain: (x, y, terrain) => {
            const st = useStudioStore.getState();
            st.setRuntimeTerrain(st.player.mapId, x, y, terrain);
          },
          playSfx: (name) => playSfx(name),
          log: (msg, level) => useStudioStore.getState().pushLuaLog(msg, level),
        },
        controller.signal
      );
    } finally {
      useStudioStore.getState().setIsRunningScript(false);
    }
  }, []);

  // Keyboard controls for Play Mode + Undo/Redo in Edit Mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const st = useStudioStore.getState();

      // Edit mode shortcuts
      if (st.mode === 'edit') {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) st.redo();
          else st.undo();
        }
        return;
      }

      // Play mode: if dialogue is open
      if (st.dialogue) {
        if (!st.dialogue.choices && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault();
          st.dialogue.resolve(0);
        } else if (st.dialogue.choices) {
          const num = parseInt(e.key, 10);
          if (num >= 1 && num <= st.dialogue.choices.length) {
            e.preventDefault();
            st.dialogue.resolve(num);
          }
        }
        return;
      }

      if (st.isRunningScript) return;

      const keyMap: Record<string, Direction> = {
        ArrowUp: 'up',
        w: 'up',
        W: 'up',
        ArrowDown: 'down',
        s: 'down',
        S: 'down',
        ArrowLeft: 'left',
        a: 'left',
        A: 'left',
        ArrowRight: 'right',
        d: 'right',
        D: 'right',
      };

      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        const curMap = st.project.maps[st.player.mapId];
        const rt = st.runtimeMaps[st.player.mapId];
        if (!curMap || !rt) return;

        const [dx, dy] = DIR_DELTA[dir];
        const nx = st.player.x + dx;
        const ny = st.player.y + dy;
        const composed = { ...curMap, terrain: rt.terrain };

        if (isTileWalkable(composed, nx, ny, rt.events)) {
          st.setPlayer({ x: nx, y: ny, dir, walkFrame: st.player.walkFrame + 1 });
          playSfx('step');
          // Check touch trigger event
          const touchEv = rt.events.find((ev) => ev.trigger === 'touch' && ev.x === nx && ev.y === ny);
          if (touchEv) {
            executeEventScript(touchEv);
          }
        } else {
          st.setPlayer({ dir });
          // If bumped into a solid touch-trigger event, also fire it
          const bumpEv = rt.events.find((ev) => ev.trigger === 'touch' && ev.x === nx && ev.y === ny);
          if (bumpEv) {
            executeEventScript(bumpEv);
          } else {
            playSfx('bump');
          }
        }
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const rt = st.runtimeMaps[st.player.mapId];
        if (!rt) return;
        const [dx, dy] = DIR_DELTA[st.player.dir];
        const fx = st.player.x + dx;
        const fy = st.player.y + dy;
        const ev =
          findEventAt(rt.events, fx, fy) ??
          findEventAt(rt.events, st.player.x, st.player.y);
        if (ev) {
          executeEventScript(ev);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [executeEventScript]);

  // Animation & Render loop
  useEffect(() => {
    let rafId = 0;
    let lastTick = 0;

    const render = (now: number) => {
      if (now - lastTick > 420) {
        animFrameRef.current = (animFrameRef.current + 1) % 4;
        lastTick = now;
      }

      const canvas = canvasRef.current;
      if (!canvas || !map) {
        rafId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = zoom * 2; // zoom=2 -> 32px per 16px tile
      const tilePx = TILE_SIZE * scale;
      const targetW = map.width * tilePx;
      const targetH = map.height * tilePx;

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.scale(scale, scale);

      const rt = mode === 'play' ? runtimeMaps[currentMapId] : null;
      const terrainGrid = rt ? rt.terrain : map.terrain;
      const eventsList = rt ? rt.events : map.events;
      const anim = animFrameRef.current;

      // Layer 1: Terrain with 4-bit Auto-tiling
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = terrainGrid[y]?.[x] ?? 'grass';
          const mask = computeNeighborMask(terrainGrid, x, y, t);
          drawTerrainTile(ctx, t, x, y, x * TILE_SIZE, y * TILE_SIZE, mask, anim);
        }
      }

      // Layer 2: Prefabs (Base Pass)
      const sortedPrefabs = [...map.prefabs].sort((a, b) => a.y - b.y);
      for (const inst of sortedPrefabs) {
        drawPrefab(ctx, inst.prefabId, inst.x * TILE_SIZE, inst.y * TILE_SIZE, anim, 'base');
      }

      // Layer 3: Events & Player (Y-sorted)
      type DrawableEntity = { y: number; draw: () => void };
      const entities: DrawableEntity[] = [];

      for (const ev of eventsList) {
        if (mode === 'play' && !ev.visible) continue;
        entities.push({
          y: ev.y,
          draw: () => {
            if (ev.visible) {
              drawSprite(ctx, ev.sprite, ev.x * TILE_SIZE, ev.y * TILE_SIZE, ev.dir, anim % 2 === 0 ? 0 : 0);
            } else if (mode === 'edit') {
              // Invisible trigger marker (e.g. touch portal)
              ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
              ctx.fillRect(ev.x * TILE_SIZE + 1, ev.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 1;
              ctx.strokeRect(ev.x * TILE_SIZE + 1.5, ev.y * TILE_SIZE + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
            }
          },
        });
      }

      if (mode === 'play') {
        entities.push({
          y: player.y + 0.01,
          draw: () => {
            drawSprite(ctx, 'hero', player.x * TILE_SIZE, player.y * TILE_SIZE, player.dir, player.walkFrame);
          },
        });
      }

      entities.sort((a, b) => a.y - b.y);
      for (const item of entities) item.draw();

      // Layer 4: Prefabs (Overhead canopy / roof pass — renders ABOVE player & NPCs!)
      for (const inst of sortedPrefabs) {
        drawPrefab(ctx, inst.prefabId, inst.x * TILE_SIZE, inst.y * TILE_SIZE, anim, 'overhead');
      }

      // Layer 5: Edit Mode Overlays (Grid, Regions, Event Badges, Selection, Hover Ghost)
      if (mode === 'edit') {
        // Subtle pixel grid
        if (showGrid) {
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          for (let x = 0; x <= map.width; x++) {
            ctx.moveTo(x * TILE_SIZE, 0);
            ctx.lineTo(x * TILE_SIZE, map.height * TILE_SIZE);
          }
          for (let y = 0; y <= map.height; y++) {
            ctx.moveTo(0, y * TILE_SIZE);
            ctx.lineTo(map.width * TILE_SIZE, y * TILE_SIZE);
          }
          ctx.stroke();
        }

        // Start point badge
        if (project.startMapId === map.id) {
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            project.startX * TILE_SIZE + 1,
            project.startY * TILE_SIZE + 1,
            TILE_SIZE - 2,
            TILE_SIZE - 2
          );
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.fillRect(project.startX * TILE_SIZE + 1, project.startY * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        }

        // Semantic Regions subtle outline
        for (const reg of map.regions) {
          ctx.save();
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
          ctx.lineWidth = 0.7;
          ctx.strokeRect(
            reg.x * TILE_SIZE + 0.5,
            reg.y * TILE_SIZE + 0.5,
            reg.w * TILE_SIZE - 1,
            reg.h * TILE_SIZE - 1
          );
          ctx.restore();
        }

        // Active Selection Highlight
        if (selection.type === 'region' && selection.mapId === map.id) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.20)';
          ctx.fillRect(
            selection.x * TILE_SIZE,
            selection.y * TILE_SIZE,
            selection.w * TILE_SIZE,
            selection.h * TILE_SIZE
          );
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(
            selection.x * TILE_SIZE + 0.5,
            selection.y * TILE_SIZE + 0.5,
            selection.w * TILE_SIZE - 1,
            selection.h * TILE_SIZE - 1
          );
        } else if (selection.type === 'event' && selection.mapId === map.id) {
          const ev = map.events.find((e) => e.id === selection.eventId);
          if (ev) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(ev.x * TILE_SIZE - 0.5, ev.y * TILE_SIZE - 0.5, TILE_SIZE + 1, TILE_SIZE + 1);
          }
        }

        // Hover Ghost Preview
        if (hoverTile) {
          ctx.save();
          if (activeTool === 'prefab') {
            ctx.globalAlpha = 0.7;
            drawPrefab(
              ctx,
              selectedPrefab,
              hoverTile.x * TILE_SIZE,
              hoverTile.y * TILE_SIZE,
              anim,
              'all'
            );
            const meta = PREFAB_CATALOG[selectedPrefab];
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(
              hoverTile.x * TILE_SIZE,
              hoverTile.y * TILE_SIZE,
              meta.w * TILE_SIZE,
              meta.h * TILE_SIZE
            );
          } else if (activeTool === 'event') {
            ctx.globalAlpha = 0.75;
            drawSprite(ctx, selectedSprite, hoverTile.x * TILE_SIZE, hoverTile.y * TILE_SIZE, 'down', 0);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(hoverTile.x * TILE_SIZE, hoverTile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          } else if (activeTool === 'terrain') {
            ctx.globalAlpha = 0.65;
            drawTerrainTile(
              ctx,
              selectedTerrain,
              hoverTile.x,
              hoverTile.y,
              hoverTile.x * TILE_SIZE,
              hoverTile.y * TILE_SIZE,
              15,
              anim
            );
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(
              hoverTile.x * TILE_SIZE + 0.5,
              hoverTile.y * TILE_SIZE + 0.5,
              TILE_SIZE - 1,
              TILE_SIZE - 1
            );
          } else {
            ctx.strokeStyle = activeTool === 'eraser' ? '#f87171' : 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(hoverTile.x * TILE_SIZE + 0.5, hoverTile.y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
          }
          ctx.restore();
        }
      }

      ctx.restore();

      // Screen-space crisp labels in Edit Mode
      if (mode === 'edit') {
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        for (const ev of map.events) {
          const cx = (ev.x + 0.5) * tilePx;
          const cy = ev.y * tilePx - 4;
          const textW = ctx.measureText(ev.name).width;
          ctx.fillStyle =
            selection.type === 'event' && selection.eventId === ev.id
              ? 'rgba(217, 119, 6, 0.92)'
              : 'rgba(15, 23, 42, 0.78)';
          ctx.beginPath();
          ctx.roundRect(cx - textW / 2 - 5, cy - 11, textW + 10, 15, 4);
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(ev.name, cx, cy);
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [
    map,
    mode,
    currentMapId,
    runtimeMaps,
    player,
    zoom,
    showGrid,
    selection,
    hoverTile,
    activeTool,
    selectedTerrain,
    selectedPrefab,
    selectedSprite,
    project.startMapId,
    project.startX,
    project.startY,
  ]);

  const getTileCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const tilePx = TILE_SIZE * zoom * 2;
    const tx = Math.floor(((e.clientX - rect.left) * scaleX) / tilePx);
    const ty = Math.floor(((e.clientY - rect.top) * scaleY) / tilePx);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
    return { x: tx, y: ty };
  };

  const applyEditAction = (tx: number, ty: number, isStart: boolean) => {
    const st = useStudioStore.getState();
    const m = st.project.maps[st.activeMapId];
    if (!m) return;

    if (st.activeTool === 'select') {
      const ev = m.events.find((e) => e.x === tx && e.y === ty);
      if (ev) {
        st.setSelection({ type: 'event', mapId: m.id, eventId: ev.id });
        st.setRightTab('inspector');
      } else {
        // Check if clicked inside a named region
        const reg = m.regions.find(
          (r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h
        );
        if (reg) {
          st.setSelection({
            type: 'region',
            mapId: m.id,
            x: reg.x,
            y: reg.y,
            w: reg.w,
            h: reg.h,
            label: reg.name,
          });
        } else {
          st.setSelection({ type: 'none' });
        }
      }
      return;
    }

    if (st.activeTool === 'terrain') {
      if (isStart) st.pushUndoSnapshot(`绘制地形 ${st.selectedTerrain}`);
      st.mutateProjectSilent((draft) => {
        const dm = draft.maps[st.activeMapId];
        if (dm && dm.terrain[ty]) dm.terrain[ty][tx] = st.selectedTerrain;
      });
      return;
    }

    if (st.activeTool === 'prefab' && isStart) {
      const meta = PREFAB_CATALOG[st.selectedPrefab];
      if (tx + meta.w > m.width || ty + meta.h > m.height) return;
      st.pushUndoSnapshot(`放置 ${meta.label}`);
      st.mutateProjectSilent((draft) => {
        const dm = draft.maps[st.activeMapId];
        dm.prefabs.push({
          id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          prefabId: st.selectedPrefab,
          x: tx,
          y: ty,
        });
      });
      return;
    }

    if (st.activeTool === 'event' && isStart) {
      const existing = m.events.find((e) => e.x === tx && e.y === ty);
      if (existing) {
        st.setSelection({ type: 'event', mapId: m.id, eventId: existing.id });
        st.setRightTab('inspector');
        return;
      }
      const spMeta = SPRITE_CATALOG[st.selectedSprite];
      const newId = `ev_${Date.now().toString(36).slice(-4)}`;
      st.pushUndoSnapshot(`放置事件 ${spMeta.label}`);
      st.mutateProjectSilent((draft) => {
        draft.maps[st.activeMapId].events.push({
          id: newId,
          name: spMeta.label,
          x: tx,
          y: ty,
          sprite: st.selectedSprite,
          dir: 'down',
          solid: true,
          visible: true,
          trigger: 'interact',
          script: `function on_interact()\n  say("${spMeta.label}", "你好，冒险者！你可以直接改我的 Lua 脚本，或者让 AI 帮我写一段剧情。")\nend`,
        });
      });
      st.setSelection({ type: 'event', mapId: m.id, eventId: newId });
      st.setRightTab('inspector');
      return;
    }

    if (st.activeTool === 'eraser') {
      if (isStart) st.pushUndoSnapshot('擦除对象');
      st.mutateProjectSilent((draft) => {
        const dm = draft.maps[st.activeMapId];
        dm.events = dm.events.filter((e) => !(e.x === tx && e.y === ty));
        dm.prefabs = dm.prefabs.filter((p) => {
          const meta = PREFAB_CATALOG[p.prefabId];
          const hit = tx >= p.x && tx < p.x + meta.w && ty >= p.y && ty < p.y + meta.h;
          return !hit;
        });
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getTileCoords(e);
    if (!pos) return;

    if (mode === 'play') {
      // Allow clicking an adjacent NPC to interact in Play Mode!
      const st = useStudioStore.getState();
      if (st.dialogue || st.isRunningScript) return;
      const rt = st.runtimeMaps[st.player.mapId];
      const ev = rt ? findEventAt(rt.events, pos.x, pos.y) : undefined;
      if (ev && Math.abs(ev.x - st.player.x) + Math.abs(ev.y - st.player.y) <= 1) {
        const dx = ev.x - st.player.x;
        const dy = ev.y - st.player.y;
        const dir: Direction = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
        st.setPlayer({ dir: oppositeDir(oppositeDir(dir)) });
        executeEventScript(ev);
      }
      return;
    }

    isDraggingRef.current = true;
    dragStartTileRef.current = pos;

    if (activeTool === 'marquee') {
      useStudioStore.getState().setSelection({
        type: 'region',
        mapId: activeMapId,
        x: pos.x,
        y: pos.y,
        w: 1,
        h: 1,
      });
      return;
    }

    applyEditAction(pos.x, pos.y, true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getTileCoords(e);
    setHoverTile(pos);
    if (!isDraggingRef.current || !pos || mode !== 'edit') return;

    if (activeTool === 'marquee' && dragStartTileRef.current) {
      const x0 = Math.min(dragStartTileRef.current.x, pos.x);
      const y0 = Math.min(dragStartTileRef.current.y, pos.y);
      const x1 = Math.max(dragStartTileRef.current.x, pos.x);
      const y1 = Math.max(dragStartTileRef.current.y, pos.y);
      useStudioStore.getState().setSelection({
        type: 'region',
        mapId: activeMapId,
        x: x0,
        y: y0,
        w: x1 - x0 + 1,
        h: y1 - y0 + 1,
      });
      return;
    }

    if (activeTool === 'terrain' || activeTool === 'eraser') {
      applyEditAction(pos.x, pos.y, false);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragStartTileRef.current = null;
  };

  const inventoryEntries = Object.entries(inventory);
  const activeFlags = Object.entries(flags).filter(([, v]) => v);

  return (
    <div className="viewport-shell">
      {/* Top Status Strip inside Viewport */}
      <div className="viewport-subbar">
        <div className="viewport-subbar-left">
          <span className={`mode-pill ${mode === 'play' ? 'mode-pill-play' : 'mode-pill-edit'}`}>
            {mode === 'play' ? '● 试玩运行中 (Lua 5.4 WASM)' : '编辑画布'}
          </span>
          <span className="viewport-meta">
            {map?.name} ({map?.width}×{map?.height})
          </span>
          {hoverTile && mode === 'edit' && (
            <span className="viewport-coords">
              坐标: ({hoverTile.x}, {hoverTile.y})
            </span>
          )}
          {mode === 'play' && (
            <span className="viewport-coords">
              主角: ({player.x}, {player.y}) · WASD 移动 · 空格交互
            </span>
          )}
        </div>

        {mode === 'play' && (
          <div className="viewport-subbar-right">
            <span className="hud-chip">
              <Coins size={13} /> {vars.gold ?? 0}G
            </span>
            <button
              className={`hud-chip-btn ${showInventory ? 'active' : ''}`}
              onClick={() => setShowInventory((v) => !v)}
              title="查看背包与全局开关"
            >
              <Backpack size={13} /> 背包 ({inventoryEntries.reduce((a, [, c]) => a + c, 0)})
            </button>
            <button
              className={`hud-chip-btn ${showConsole ? 'active' : ''}`}
              onClick={() => setShowConsole((v) => !v)}
              title="Lua 运行时日志"
            >
              <Terminal size={13} /> Lua 日志
            </button>
            <button
              className="hud-chip-btn"
              onClick={() => useStudioStore.getState().startPlaySession()}
              title="重置试玩进度"
            >
              <RotateCcw size={13} /> 重开
            </button>
          </div>
        )}

        {mode === 'edit' && selection.type === 'region' && (
          <div className="viewport-subbar-right">
            <span className="selection-badge">
              <Sparkles size={12} /> 已选区域 ({selection.x},{selection.y} · {selection.w}×{selection.h}) 可直接对话 AI 修改
            </span>
          </div>
        )}
      </div>

      {/* Scrollable Canvas Stage */}
      <div className="viewport-stage">
        <div className="canvas-frame">
          <canvas
            ref={canvasRef}
            className={`rpg-canvas ${mode === 'play' ? 'play-cursor' : `tool-${activeTool}`}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setHoverTile(null);
              handleMouseUp();
            }}
          />

          {/* Floating Toasts in Play Mode */}
          {mode === 'play' && toasts.length > 0 && (
            <div className="play-toast-stack">
              {toasts.map((t) => (
                <div key={t.id} className="play-toast">
                  {t.text}
                </div>
              ))}
            </div>
          )}

          {/* Inventory & Flags Popover */}
          {mode === 'play' && showInventory && (
            <div className="play-drawer-card">
              <div className="play-drawer-header">
                <span>背包与状态</span>
                <button className="icon-btn-sm" onClick={() => setShowInventory(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="play-drawer-section">
                <div className="play-drawer-label">背包物品</div>
                {inventoryEntries.length === 0 ? (
                  <div className="muted-sm">暂无物品（试试找村长对话）</div>
                ) : (
                  <ul className="item-list">
                    {inventoryEntries.map(([itemId, count]) => {
                      const def = project.items[itemId];
                      return (
                        <li key={itemId}>
                          <strong>{def?.name ?? itemId}</strong>
                          <span>×{count}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="play-drawer-section">
                <div className="play-drawer-label">
                  <Flag size={11} /> 已激活开关 (flags)
                </div>
                {activeFlags.length === 0 ? (
                  <div className="muted-sm">暂无已开启开关</div>
                ) : (
                  <div className="flag-chips">
                    {activeFlags.map(([k]) => (
                      <span key={k} className="flag-chip">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Retro RPG Dialogue & Choice Overlay */}
          {mode === 'play' && dialogue && (
            <div
              className="rpg-dialogue-overlay"
              onClick={() => {
                if (!dialogue.choices) dialogue.resolve(0);
              }}
            >
              <div className="rpg-dialogue-box" onClick={(e) => e.stopPropagation()}>
                <div className="rpg-dialogue-speaker">{dialogue.speaker}</div>
                <div className="rpg-dialogue-text">{dialogue.text}</div>
                {dialogue.choices ? (
                  <div className="rpg-dialogue-choices">
                    {dialogue.choices.map((choice, idx) => (
                      <button
                        key={idx}
                        className="rpg-choice-btn"
                        onClick={() => dialogue.resolve(idx + 1)}
                      >
                        <span className="choice-num">{idx + 1}</span>
                        <span>{choice}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rpg-dialogue-footer">
                    <button className="rpg-next-btn" onClick={() => dialogue.resolve(0)}>
                      继续 (Space / Enter) ▾
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Lua Console Drawer */}
      {mode === 'play' && showConsole && (
        <div className="lua-console-drawer">
          <div className="lua-console-header">
            <span>
              <Terminal size={13} /> Lua 5.4 运行时控制台
            </span>
            <button className="icon-btn-sm" onClick={() => setShowConsole(false)}>
              <X size={13} />
            </button>
          </div>
          <div className="lua-console-body">
            {luaLogs.map((log) => (
              <div key={log.id} className={`lua-log-line level-${log.level}`}>
                <span className="lua-log-time">{log.time}</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
