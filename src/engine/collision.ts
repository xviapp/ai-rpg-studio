import { PREFAB_CATALOG, TERRAIN_CATALOG } from '../assets/catalog';
import type { GameMap, MapEvent } from '../types/project';

/**
 * Checks whether tile (x, y) on map is walkable, taking terrain, bridges, prefabs, and solid events into account.
 */
export function isTileWalkable(
  map: GameMap,
  x: number,
  y: number,
  events: MapEvent[],
  ignoreEventId?: string
): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return false;
  }

  const terrainId = map.terrain[y]?.[x];
  if (!terrainId) return false;
  let passable = TERRAIN_CATALOG[terrainId]?.passable ?? true;

  // Check prefabs covering (x, y)
  for (const inst of map.prefabs) {
    const meta = PREFAB_CATALOG[inst.prefabId];
    if (!meta) continue;
    const lx = x - inst.x;
    const ly = y - inst.y;
    if (lx >= 0 && lx < meta.w && ly >= 0 && ly < meta.h) {
      if (meta.makesPassable) {
        passable = true;
      }
      if (meta.collision[ly]?.[lx]) {
        return false;
      }
    }
  }

  if (!passable) return false;

  // Check solid visible events
  for (const ev of events) {
    if (ev.id === ignoreEventId) continue;
    if (ev.visible && ev.solid && ev.x === x && ev.y === y) {
      return false;
    }
  }

  return true;
}

export function findEventAt(events: MapEvent[], x: number, y: number): MapEvent | undefined {
  return events.find((e) => e.visible && e.x === x && e.y === y);
}
