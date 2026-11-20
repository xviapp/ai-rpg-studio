import { PREFAB_CATALOG } from './catalog';
import type { Direction, PrefabId, SpriteId, TerrainId } from '../types/project';

export const TILE_SIZE = 16;

function hash2d(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return (n ^ (n >> 16)) >>> 0;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * Draws a crisp 16x16 terrain tile with 4-bit neighbor auto-tiling support.
 * neighborMask bits: 1 = top same, 2 = right same, 4 = bottom same, 8 = left same
 */
export function drawTerrainTile(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainId,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  neighborMask: number,
  animFrame: number
) {
  const h = hash2d(tx, ty);
  const topSame = (neighborMask & 1) !== 0;
  const rightSame = (neighborMask & 2) !== 0;
  const bottomSame = (neighborMask & 4) !== 0;
  const leftSame = (neighborMask & 8) !== 0;

  ctx.save();
  ctx.translate(dx, dy);

  switch (terrain) {
    case 'grass': {
      px(ctx, 0, 0, 16, 16, '#5ea150');
      // Subtle pixel variation
      if ((h & 3) === 0) {
        px(ctx, 3, 5, 1, 2, '#4d8c42');
        px(ctx, 4, 6, 1, 1, '#71b75f');
      } else if ((h & 3) === 1) {
        px(ctx, 11, 10, 1, 2, '#4d8c42');
        px(ctx, 12, 11, 1, 1, '#71b75f');
      } else if ((h & 7) === 2) {
        px(ctx, 6, 3, 1, 1, '#71b75f');
        px(ctx, 7, 4, 1, 1, '#4d8c42');
        px(ctx, 12, 13, 1, 1, '#71b75f');
      }
      if ((h % 19) === 0) {
        // Tiny grass blossom
        px(ctx, 9, 4, 1, 1, '#f4e38d');
        px(ctx, 8, 5, 1, 1, '#49823f');
      }
      break;
    }

    case 'forest_floor': {
      px(ctx, 0, 0, 16, 16, '#3d7242');
      // Auto-tile soft mossy edge against non-forest
      if (!topSame) px(ctx, 0, 0, 16, 2, '#4e8a4c');
      if (!bottomSame) px(ctx, 0, 14, 16, 2, '#315d36');
      if (!leftSame) px(ctx, 0, 0, 2, 16, '#4a8349');
      if (!rightSame) px(ctx, 14, 0, 2, 16, '#336138');
      if ((h & 3) === 0) {
        px(ctx, 4, 6, 2, 1, '#2f5a35');
        px(ctx, 10, 11, 2, 1, '#4f8a52');
      } else if ((h & 3) === 2) {
        px(ctx, 7, 4, 1, 1, '#589758');
        px(ctx, 11, 8, 1, 2, '#2f5a35');
      }
      break;
    }

    case 'water': {
      px(ctx, 0, 0, 16, 16, '#3484ba');
      // Subtle depth gradient
      px(ctx, 0, 0, 16, 16, (tx + ty) % 2 === 0 ? '#3484ba' : '#317fb4');
      // Animated shimmer ripples
      const shift = animFrame % 2 === 0 ? 0 : 2;
      if ((h & 1) === 0) {
        px(ctx, 3 + shift, 5, 4, 1, '#63b4e0');
        px(ctx, 8 - shift, 11, 3, 1, '#57a8d6');
      } else {
        px(ctx, 7 + shift, 4, 3, 1, '#63b4e0');
        px(ctx, 3 - shift, 12, 4, 1, '#57a8d6');
      }
      // Auto-tile shoreline borders where adjacent tile is land
      if (!topSame) {
        px(ctx, 0, 0, 16, 2, '#c8b27c');
        px(ctx, 0, 2, 16, 1, '#84cdf0');
      }
      if (!bottomSame) {
        px(ctx, 0, 14, 16, 2, '#9e8858');
        px(ctx, 0, 13, 16, 1, '#276591');
      }
      if (!leftSame) {
        px(ctx, 0, 0, 2, 16, '#bda670');
        px(ctx, 2, 2, 1, 12, '#79c2e8');
      }
      if (!rightSame) {
        px(ctx, 14, 0, 2, 16, '#a99361');
        px(ctx, 13, 2, 1, 12, '#2a6f9f');
      }
      break;
    }

    case 'dirt': {
      px(ctx, 0, 0, 16, 16, '#b88c5c');
      // Auto-tile grassy verge on outer edges
      if (!topSame) {
        px(ctx, 0, 0, 16, 2, '#5ea150');
        px(ctx, 0, 2, 16, 1, '#9b7247');
      }
      if (!bottomSame) {
        px(ctx, 0, 14, 16, 2, '#5ea150');
        px(ctx, 0, 13, 16, 1, '#9b7247');
      }
      if (!leftSame) {
        px(ctx, 0, 0, 2, 16, '#5ea150');
        px(ctx, 2, 0, 1, 16, '#9b7247');
      }
      if (!rightSame) {
        px(ctx, 14, 0, 2, 16, '#5ea150');
        px(ctx, 13, 0, 1, 16, '#9b7247');
      }
      // Pebbles
      if ((h & 3) === 0) {
        px(ctx, 5, 6, 2, 1, '#cfa472');
        px(ctx, 10, 10, 1, 1, '#906940');
      } else if ((h & 3) === 1) {
        px(ctx, 9, 5, 1, 1, '#906940');
        px(ctx, 5, 11, 2, 1, '#cfa472');
      }
      break;
    }

    case 'stone': {
      px(ctx, 0, 0, 16, 16, '#878d99');
      // Cobblestone grid pattern
      px(ctx, 1, 1, 6, 6, '#9ca2ae');
      px(ctx, 8, 1, 7, 6, '#949aa6');
      px(ctx, 1, 8, 9, 7, '#959ba7');
      px(ctx, 11, 8, 4, 7, '#9ea4b0');
      // Highlight bevels
      px(ctx, 1, 1, 6, 1, '#b4bac6');
      px(ctx, 8, 1, 7, 1, '#adb3bf');
      px(ctx, 1, 8, 9, 1, '#aeb4c0');
      // Auto-tile trim border
      if (!topSame) px(ctx, 0, 0, 16, 1, '#666c78');
      if (!bottomSame) px(ctx, 0, 15, 16, 1, '#585e6a');
      if (!leftSame) px(ctx, 0, 0, 1, 16, '#666c78');
      if (!rightSame) px(ctx, 15, 0, 1, 16, '#585e6a');
      break;
    }

    case 'sand': {
      px(ctx, 0, 0, 16, 16, '#d9be7f');
      if (!topSame) px(ctx, 0, 0, 16, 1, '#c5a96b');
      if (!bottomSame) px(ctx, 0, 15, 16, 1, '#bda163');
      if (!leftSame) px(ctx, 0, 0, 1, 16, '#c5a96b');
      if (!rightSame) px(ctx, 15, 0, 1, 16, '#bda163');
      if ((h & 3) === 0) {
        px(ctx, 4, 5, 2, 1, '#e8d095');
        px(ctx, 10, 11, 1, 1, '#ba9d5f');
      } else if ((h & 3) === 2) {
        px(ctx, 11, 4, 2, 1, '#e8d095');
        px(ctx, 6, 10, 1, 1, '#ba9d5f');
      }
      break;
    }

    case 'wood_floor': {
      px(ctx, 0, 0, 16, 16, '#9a6b42');
      // Horizontal planks
      px(ctx, 0, 3, 16, 1, '#754e2e');
      px(ctx, 0, 7, 16, 1, '#754e2e');
      px(ctx, 0, 11, 16, 1, '#754e2e');
      px(ctx, 0, 15, 16, 1, '#754e2e');
      px(ctx, 7, 0, 1, 4, '#754e2e');
      px(ctx, 12, 4, 1, 4, '#754e2e');
      px(ctx, 4, 8, 1, 4, '#754e2e');
      px(ctx, 10, 12, 1, 4, '#754e2e');
      px(ctx, 1, 1, 5, 1, '#b18054');
      px(ctx, 1, 9, 3, 1, '#b18054');
      break;
    }
  }

  ctx.restore();
}

/**
 * Draws either the base layer ('base') or overhead canopy/roof layer ('overhead') of a prefab.
 * If pass === 'all', draws the entire prefab (used for editor previews & thumbnails).
 */
export function drawPrefab(
  ctx: CanvasRenderingContext2D,
  prefabId: PrefabId,
  dx: number,
  dy: number,
  animFrame: number,
  pass: 'base' | 'overhead' | 'all' = 'all'
) {
  const meta = PREFAB_CATALOG[prefabId];
  const pw = meta.w * TILE_SIZE;
  const ph = meta.h * TILE_SIZE;

  ctx.save();
  ctx.translate(dx, dy);

  if (pass === 'overhead' && meta.overheadRows === 0) {
    ctx.restore();
    return;
  }

  if (pass === 'overhead') {
    ctx.beginPath();
    ctx.rect(0, 0, pw, meta.overheadRows * TILE_SIZE);
    ctx.clip();
  } else if (pass === 'base' && meta.overheadRows > 0) {
    ctx.beginPath();
    ctx.rect(0, meta.overheadRows * TILE_SIZE, pw, ph - meta.overheadRows * TILE_SIZE);
    ctx.clip();
  }

  switch (prefabId) {
    case 'house_red':
    case 'house_blue': {
      const isBlue = prefabId === 'house_blue';
      const roofDark = isBlue ? '#2f4e73' : '#8d362d';
      const roofMid = isBlue ? '#436e9e' : '#b7483b';
      const roofLight = isBlue ? '#5c8bc0' : '#d25f4e';
      // Shadow
      px(ctx, 2, 43, 44, 5, 'rgba(0,0,0,0.22)');
      // Roof (rows 0..1.4)
      px(ctx, 4, 2, 40, 4, roofDark);
      px(ctx, 2, 6, 44, 14, roofMid);
      px(ctx, 1, 20, 46, 4, roofDark);
      // Shingle rows
      for (let ry = 7; ry <= 17; ry += 4) {
        px(ctx, 3, ry, 42, 1, roofLight);
        px(ctx, 3, ry + 2, 42, 1, roofDark);
      }
      // Chimney
      px(ctx, 35, 1, 6, 9, '#706865');
      px(ctx, 34, 1, 8, 2, '#534c49');
      // Walls
      px(ctx, 4, 24, 40, 21, '#e8dcc4');
      px(ctx, 4, 24, 40, 2, '#c8b89b');
      // Timber framing
      px(ctx, 4, 24, 3, 21, '#6f4b32');
      px(ctx, 41, 24, 3, 21, '#6f4b32');
      px(ctx, 4, 42, 40, 3, '#6d6f78'); // stone foundation
      // Door
      px(ctx, 19, 30, 10, 15, '#593924');
      px(ctx, 20, 31, 8, 14, '#7a5034');
      px(ctx, 26, 37, 1, 2, '#e8c45f'); // brass knob
      // Windows
      px(ctx, 9, 29, 7, 7, '#593924');
      px(ctx, 10, 30, 5, 5, isBlue ? '#f6d67a' : '#89c7e6');
      px(ctx, 12, 30, 1, 5, '#593924');
      px(ctx, 10, 32, 5, 1, '#593924');

      px(ctx, 32, 29, 7, 7, '#593924');
      px(ctx, 33, 30, 5, 5, isBlue ? '#f6d67a' : '#89c7e6');
      px(ctx, 35, 30, 1, 5, '#593924');
      px(ctx, 33, 32, 5, 1, '#593924');

      // Tavern sign for blue house
      if (isBlue) {
        px(ctx, 29, 38, 6, 4, '#d9a441');
        px(ctx, 30, 39, 4, 2, '#694324');
      }
      break;
    }

    case 'oak_tree': {
      // Ground shadow
      px(ctx, 5, 25, 22, 6, 'rgba(0,0,0,0.22)');
      // Trunk
      px(ctx, 12, 18, 8, 12, '#6d472c');
      px(ctx, 13, 19, 2, 10, '#895b3a');
      px(ctx, 11, 27, 10, 3, '#573720');
      // Layered canopy
      px(ctx, 4, 6, 24, 15, '#2c6834');
      px(ctx, 6, 2, 20, 17, '#387e3e');
      px(ctx, 8, 4, 16, 10, '#4fa04c');
      px(ctx, 10, 5, 8, 5, '#6bbc5b');
      // Leaf accents
      px(ctx, 6, 13, 4, 3, '#27592e');
      px(ctx, 21, 14, 4, 3, '#27592e');
      break;
    }

    case 'pine_tree': {
      px(ctx, 6, 26, 20, 5, 'rgba(0,0,0,0.22)');
      px(ctx, 13, 21, 6, 9, '#5e3b24');
      // Tiered conifer needles
      px(ctx, 14, 1, 4, 4, '#2f6a47');
      px(ctx, 10, 5, 12, 5, '#24583b');
      px(ctx, 11, 5, 10, 3, '#387d52');
      px(ctx, 6, 10, 20, 6, '#1e4b32');
      px(ctx, 8, 10, 16, 4, '#32724b');
      px(ctx, 4, 16, 24, 7, '#19402a');
      px(ctx, 6, 16, 20, 4, '#2b6542');
      break;
    }

    case 'bridge_h': {
      px(ctx, 0, 1, 16, 14, '#70492b');
      px(ctx, 0, 2, 16, 12, '#9a6940');
      for (let bx = 1; bx < 16; bx += 4) {
        px(ctx, bx, 2, 1, 12, '#694326');
        px(ctx, bx + 1, 3, 2, 10, '#ae7b4f');
      }
      // Top & bottom rails
      px(ctx, 0, 1, 16, 2, '#5c3a20');
      px(ctx, 0, 13, 16, 2, '#5c3a20');
      break;
    }

    case 'bridge_v': {
      px(ctx, 1, 0, 14, 16, '#70492b');
      px(ctx, 2, 0, 12, 16, '#9a6940');
      for (let by = 1; by < 16; by += 4) {
        px(ctx, 2, by, 12, 1, '#694326');
        px(ctx, 3, by + 1, 10, 2, '#ae7b4f');
      }
      px(ctx, 1, 0, 2, 16, '#5c3a20');
      px(ctx, 13, 0, 2, 16, '#5c3a20');
      break;
    }

    case 'well': {
      px(ctx, 2, 12, 12, 3, 'rgba(0,0,0,0.2)');
      // Stone rim
      px(ctx, 2, 6, 12, 8, '#7a808d');
      px(ctx, 3, 7, 10, 6, '#989fa9');
      px(ctx, 4, 8, 8, 3, '#2d72a3');
      // Roof posts & little shingle awning
      px(ctx, 3, 2, 2, 6, '#6e492c');
      px(ctx, 11, 2, 2, 6, '#6e492c');
      px(ctx, 1, 0, 14, 3, '#9e4538');
      px(ctx, 2, 1, 12, 1, '#c45e4d');
      break;
    }

    case 'campfire': {
      px(ctx, 2, 11, 12, 4, 'rgba(0,0,0,0.22)');
      // Stone ring
      px(ctx, 3, 10, 10, 4, '#6d737f');
      // Crossed logs
      px(ctx, 4, 9, 8, 3, '#6b4325');
      px(ctx, 5, 10, 6, 1, '#8c5a34');
      // Animated pixel flames
      const f = animFrame % 2;
      px(ctx, 5, 4 + f, 6, 6 - f, '#e86826');
      px(ctx, 6, 3 + (1 - f), 4, 6, '#f6a828');
      px(ctx, 7, 6, 2, 3, '#fff099');
      break;
    }

    case 'signpost': {
      px(ctx, 4, 13, 8, 2, 'rgba(0,0,0,0.2)');
      px(ctx, 7, 9, 2, 6, '#6e472a');
      px(ctx, 2, 3, 12, 7, '#8d5d38');
      px(ctx, 3, 4, 10, 5, '#b68152');
      px(ctx, 4, 5, 8, 1, '#6e472a');
      px(ctx, 4, 7, 6, 1, '#6e472a');
      break;
    }

    case 'chest': {
      px(ctx, 2, 13, 12, 2, 'rgba(0,0,0,0.22)');
      px(ctx, 2, 4, 12, 10, '#613c1f');
      px(ctx, 3, 5, 10, 8, '#a46834');
      px(ctx, 2, 8, 12, 1, '#4b2d17');
      px(ctx, 3, 5, 10, 1, '#c98849');
      // Gold clasp
      px(ctx, 7, 7, 2, 3, '#f0c64f');
      break;
    }

    case 'lamp': {
      px(ctx, 5, 13, 6, 2, 'rgba(0,0,0,0.22)');
      px(ctx, 7, 5, 2, 9, '#3e4451');
      px(ctx, 5, 13, 6, 2, '#535b6b');
      px(ctx, 5, 1, 6, 5, '#3e4451');
      px(ctx, 6, 2, 4, 3, animFrame % 2 === 0 ? '#ffe17d' : '#ffd15c');
      break;
    }

    case 'rock': {
      px(ctx, 2, 12, 12, 3, 'rgba(0,0,0,0.2)');
      px(ctx, 3, 5, 10, 8, '#666c78');
      px(ctx, 4, 4, 8, 7, '#878e9b');
      px(ctx, 5, 5, 4, 3, '#a7aebc');
      break;
    }

    case 'flowers': {
      px(ctx, 3, 7, 2, 2, '#e86170');
      px(ctx, 4, 8, 1, 1, '#f8df72');
      px(ctx, 10, 5, 2, 2, '#f4d35e');
      px(ctx, 11, 6, 1, 1, '#ffffff');
      px(ctx, 7, 11, 2, 2, '#7bc4f2');
      px(ctx, 8, 12, 1, 1, '#f8df72');
      px(ctx, 4, 10, 1, 2, '#3d7d3a');
      px(ctx, 10, 7, 1, 2, '#3d7d3a');
      break;
    }

    case 'bush': {
      px(ctx, 2, 12, 12, 3, 'rgba(0,0,0,0.2)');
      px(ctx, 2, 5, 12, 8, '#285e31');
      px(ctx, 3, 4, 10, 7, '#3c8541');
      px(ctx, 4, 5, 6, 3, '#57a854');
      px(ctx, 10, 8, 1, 1, '#e85d68');
      px(ctx, 5, 9, 1, 1, '#e85d68');
      break;
    }

    case 'fence_h': {
      px(ctx, 0, 12, 16, 2, 'rgba(0,0,0,0.18)');
      px(ctx, 2, 4, 3, 10, '#784e2e');
      px(ctx, 11, 4, 3, 10, '#784e2e');
      px(ctx, 0, 6, 16, 2, '#9b6a42');
      px(ctx, 0, 10, 16, 2, '#9b6a42');
      px(ctx, 3, 4, 1, 10, '#9b6a42');
      px(ctx, 12, 4, 1, 10, '#9b6a42');
      break;
    }
  }

  ctx.restore();
}

/**
 * Draws a crisp 16x16 character / interactive object sprite with facing & walk animation.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteId: SpriteId,
  dx: number,
  dy: number,
  dir: Direction,
  walkFrame: number
) {
  ctx.save();
  ctx.translate(dx, dy);

  if (spriteId === 'chest_npc') {
    drawPrefab(ctx, 'chest', 0, 0, walkFrame, 'all');
    ctx.restore();
    return;
  }
  if (spriteId === 'sign_npc') {
    drawPrefab(ctx, 'signpost', 0, 0, walkFrame, 'all');
    ctx.restore();
    return;
  }

  // Ground shadow
  px(ctx, 3, 13, 10, 3, 'rgba(0,0,0,0.25)');

  const bob = walkFrame % 2 === 1 ? -1 : 0;

  if (spriteId === 'slime') {
    px(ctx, 3, 7 + bob, 10, 7 - bob, '#2f8a6e');
    px(ctx, 4, 6 + bob, 8, 7 - bob, '#45c496');
    px(ctx, 5, 7 + bob, 3, 2, '#8cf0c8');
    // Eyes
    const ex = dir === 'left' ? 4 : dir === 'right' ? 7 : 5;
    if (dir !== 'up') {
      px(ctx, ex, 9 + bob, 1, 2, '#142622');
      px(ctx, ex + 4, 9 + bob, 1, 2, '#142622');
    }
    ctx.restore();
    return;
  }

  if (spriteId === 'cat') {
    px(ctx, 4, 7 + bob, 8, 6, '#e28f44');
    px(ctx, 4, 5 + bob, 2, 2, '#d47c32'); // ears
    px(ctx, 10, 5 + bob, 2, 2, '#d47c32');
    px(ctx, 5, 6 + bob, 6, 4, '#f0a65b');
    px(ctx, 12, 8 + bob, 2, 3, '#d47c32'); // tail
    if (dir !== 'up') {
      px(ctx, 6, 8 + bob, 1, 1, '#1e1b18');
      px(ctx, 9, 8 + bob, 1, 1, '#1e1b18');
    }
    ctx.restore();
    return;
  }

  // Humanoid palettes
  const palettes: Record<
    string,
    { hair: string; skin: string; tunic: string; accent: string; pants: string; hat?: string }
  > = {
    hero: { hair: '#4a2e1f', skin: '#f5cfa6', tunic: '#2d7ab8', accent: '#e5b84b', pants: '#323a48' },
    elder: { hair: '#d8dde6', skin: '#f1c79c', tunic: '#7c5338', accent: '#d6bc82', pants: '#4a3728' },
    guard: { hair: '#505969', skin: '#f2c79d', tunic: '#7e899c', accent: '#c9433a', pants: '#3b4250', hat: '#95a0b3' },
    merchant: { hair: '#6d3b24', skin: '#f5cca2', tunic: '#2f8a5b', accent: '#f2c14e', pants: '#46382b', hat: '#8c5328' },
    villager: { hair: '#9c522c', skin: '#f6d2ab', tunic: '#c45b52', accent: '#f2dfc1', pants: '#4b5568' },
    mage: { hair: '#303b54', skin: '#f5d2b0', tunic: '#3b5998', accent: '#e8c45f', pants: '#23304d', hat: '#2c4478' },
  };

  const p = palettes[spriteId] ?? palettes.villager;

  // Feet
  const leftFootY = walkFrame % 2 === 1 ? 12 : 13;
  const rightFootY = walkFrame % 2 === 1 ? 13 : 12;
  px(ctx, 5, leftFootY, 2, 2, p.pants);
  px(ctx, 9, rightFootY, 2, 2, p.pants);

  // Body / tunic
  px(ctx, 4, 8 + bob, 8, 5, p.tunic);
  px(ctx, 5, 11 + bob, 6, 1, p.accent); // belt
  // Arms
  px(ctx, 3, 8 + bob, 1, 4, p.skin);
  px(ctx, 12, 8 + bob, 1, 4, p.skin);

  // Head
  px(ctx, 4, 2 + bob, 8, 6, p.skin);
  // Hair / helmet
  px(ctx, 4, 1 + bob, 8, 3, p.hat ?? p.hair);
  if (p.hat) {
    px(ctx, 3, 2 + bob, 10, 1, p.hat);
  }
  if (dir === 'up') {
    px(ctx, 4, 2 + bob, 8, 5, p.hair);
  } else if (dir === 'left') {
    px(ctx, 6, 2 + bob, 6, 3, p.hair);
    px(ctx, 5, 5 + bob, 1, 2, '#1e1b18');
  } else if (dir === 'right') {
    px(ctx, 4, 2 + bob, 6, 3, p.hair);
    px(ctx, 10, 5 + bob, 1, 2, '#1e1b18');
  } else {
    // Facing down
    px(ctx, 5, 5 + bob, 1, 2, '#1e1b18');
    px(ctx, 10, 5 + bob, 1, 2, '#1e1b18');
    if (spriteId === 'elder') {
      // White beard
      px(ctx, 5, 7 + bob, 6, 2, '#d8dde6');
    }
  }

  ctx.restore();
}

/**
 * Computes a 4-bit neighbor bitmask for auto-tiling.
 */
export function computeNeighborMask(
  terrain: TerrainId[][],
  x: number,
  y: number,
  target: TerrainId
): number {
  const h = terrain.length;
  const w = terrain[0]?.length ?? 0;
  const same = (nx: number, ny: number) => {
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return true;
    return terrain[ny][nx] === target;
  };
  let mask = 0;
  if (same(x, y - 1)) mask |= 1;
  if (same(x + 1, y)) mask |= 2;
  if (same(x, y + 1)) mask |= 4;
  if (same(x - 1, y)) mask |= 8;
  return mask;
}
