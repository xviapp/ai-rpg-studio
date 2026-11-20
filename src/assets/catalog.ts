import type { PrefabId, SpriteId, TerrainId } from '../types/project';

export interface TerrainMeta {
  id: TerrainId;
  label: string;
  labelEn: string;
  passable: boolean;
  autoTile: boolean;
  color: string;
  tags: string[];
}

export interface PrefabMeta {
  id: PrefabId;
  label: string;
  labelEn: string;
  category: 'building' | 'nature' | 'prop';
  w: number;
  h: number;
  /** Row-major collision grid [dy][dx]: true = blocks movement */
  collision: boolean[][];
  /** If true, makes underlying water passable (e.g. bridge) */
  makesPassable?: boolean;
  /** Number of top rows rendered above characters (canopy / roof) */
  overheadRows: number;
  tags: string[];
}

export interface SpriteMeta {
  id: SpriteId;
  label: string;
  labelEn: string;
  category: 'npc' | 'monster' | 'object';
  tags: string[];
}

export const TERRAIN_CATALOG: Record<TerrainId, TerrainMeta> = {
  grass: {
    id: 'grass',
    label: '草地',
    labelEn: 'Grass',
    passable: true,
    autoTile: false,
    color: '#5fa452',
    tags: ['草', '草地', '平原', 'grass', 'meadow', 'plain'],
  },
  water: {
    id: 'water',
    label: '水域',
    labelEn: 'Water',
    passable: false,
    autoTile: true,
    color: '#3c8ec4',
    tags: ['水', '河', '湖', '水池', '河流', 'water', 'river', 'lake', 'pond'],
  },
  dirt: {
    id: 'dirt',
    label: '泥土路',
    labelEn: 'Dirt Road',
    passable: true,
    autoTile: true,
    color: '#b78b5b',
    tags: ['路', '泥路', '小路', '土路', '道路', 'dirt', 'road', 'path', 'trail'],
  },
  stone: {
    id: 'stone',
    label: '石板广场',
    labelEn: 'Cobblestone',
    passable: true,
    autoTile: true,
    color: '#9197a3',
    tags: ['石板', '石路', '广场', '街道', 'stone', 'cobble', 'plaza', 'square'],
  },
  sand: {
    id: 'sand',
    label: '沙地',
    labelEn: 'Sand',
    passable: true,
    autoTile: true,
    color: '#d8be7e',
    tags: ['沙', '沙滩', '沙漠', 'sand', 'beach', 'desert'],
  },
  forest_floor: {
    id: 'forest_floor',
    label: '深林苔地',
    labelEn: 'Forest Moss',
    passable: true,
    autoTile: true,
    color: '#3f7644',
    tags: ['森林', '苔藓', '密林', '林地', 'forest', 'moss', 'woods'],
  },
  wood_floor: {
    id: 'wood_floor',
    label: '木地板',
    labelEn: 'Wood Floor',
    passable: true,
    autoTile: false,
    color: '#9b6b43',
    tags: ['木板', '地板', '室内', '平台', 'wood', 'floor', 'deck', 'pier'],
  },
};

export const PREFAB_CATALOG: Record<PrefabId, PrefabMeta> = {
  house_red: {
    id: 'house_red',
    label: '红顶民居',
    labelEn: 'Red-Roof Cottage',
    category: 'building',
    w: 3,
    h: 3,
    collision: [
      [false, false, false],
      [true, true, true],
      [true, true, true],
    ],
    overheadRows: 1,
    tags: ['房子', '民居', '小屋', '村长家', '建筑', 'house', 'cottage', 'home', 'building'],
  },
  house_blue: {
    id: 'house_blue',
    label: '蓝顶酒馆/商店',
    labelEn: 'Blue-Roof Tavern',
    category: 'building',
    w: 3,
    h: 3,
    collision: [
      [false, false, false],
      [true, true, true],
      [true, true, true],
    ],
    overheadRows: 1,
    tags: ['酒馆', '商店', '旅店', '蓝顶房', '建筑', 'tavern', 'shop', 'inn', 'house', 'building'],
  },
  oak_tree: {
    id: 'oak_tree',
    label: '橡树',
    labelEn: 'Oak Tree',
    category: 'nature',
    w: 2,
    h: 2,
    collision: [
      [false, false],
      [true, true],
    ],
    overheadRows: 1,
    tags: ['树', '橡树', '森林', '大树', 'tree', 'oak', 'forest'],
  },
  pine_tree: {
    id: 'pine_tree',
    label: '松树',
    labelEn: 'Pine Tree',
    category: 'nature',
    w: 2,
    h: 2,
    collision: [
      [false, false],
      [true, true],
    ],
    overheadRows: 1,
    tags: ['松树', '针叶树', '树', '森林', 'pine', 'tree', 'forest'],
  },
  bridge_h: {
    id: 'bridge_h',
    label: '横向木桥',
    labelEn: 'Horizontal Bridge',
    category: 'building',
    w: 1,
    h: 1,
    collision: [[false]],
    makesPassable: true,
    overheadRows: 0,
    tags: ['桥', '木桥', '横桥', 'bridge', 'crossing'],
  },
  bridge_v: {
    id: 'bridge_v',
    label: '纵向木桥',
    labelEn: 'Vertical Bridge',
    category: 'building',
    w: 1,
    h: 1,
    collision: [[false]],
    makesPassable: true,
    overheadRows: 0,
    tags: ['桥', '木桥', '竖桥', 'bridge', 'crossing'],
  },
  well: {
    id: 'well',
    label: '石水井',
    labelEn: 'Stone Well',
    category: 'prop',
    w: 1,
    h: 1,
    collision: [[true]],
    overheadRows: 0,
    tags: ['井', '水井', '广场', 'well', 'water'],
  },
  campfire: {
    id: 'campfire',
    label: '营地篝火',
    labelEn: 'Campfire',
    category: 'prop',
    w: 1,
    h: 1,
    collision: [[true]],
    overheadRows: 0,
    tags: ['篝火', '火堆', '营地', '露营', 'campfire', 'fire', 'camp'],
  },
  signpost: {
    id: 'signpost',
    label: '木路牌',
    labelEn: 'Signpost',
    category: 'prop',
    w: 1,
    h: 1,
    collision: [[true]],
    overheadRows: 0,
    tags: ['路牌', '告示牌', '木牌', 'sign', 'signpost'],
  },
  chest: {
    id: 'chest',
    label: '装饰宝箱',
    labelEn: 'Decor Chest',
    category: 'prop',
    w: 1,
    h: 1,
    collision: [[true]],
    overheadRows: 0,
    tags: ['宝箱', '箱子', 'chest', 'treasure'],
  },
  lamp: {
    id: 'lamp',
    label: '路灯',
    labelEn: 'Street Lamp',
    category: 'prop',
    w: 1,
    h: 1,
    collision: [[true]],
    overheadRows: 0,
    tags: ['灯', '路灯', '火把', '照明', 'lamp', 'lantern', 'light'],
  },
  rock: {
    id: 'rock',
    label: '岩石',
    labelEn: 'Boulder',
    category: 'nature',
    w: 1,
    h: 1,
    collision: [[true]],
    overheadRows: 0,
    tags: ['石头', '岩石', '巨石', 'rock', 'stone', 'boulder'],
  },
  flowers: {
    id: 'flowers',
    label: '野花丛',
    labelEn: 'Wildflowers',
    category: 'nature',
    w: 1,
    h: 1,
    collision: [[false]],
    overheadRows: 0,
    tags: ['花', '花丛', '野花', '装饰', 'flower', 'flowers', 'bloom'],
  },
  bush: {
    id: 'bush',
    label: '灌木丛',
    labelEn: 'Bush',
    category: 'nature',
    w: 1,
    h: 1,
    collision: [[true]],
    overheadRows: 0,
    tags: ['灌木', '草丛', '树丛', 'bush', 'shrub'],
  },
  fence_h: {
    id: 'fence_h',
    label: '木栅栏',
    labelEn: 'Wooden Fence',
    category: 'prop',
    w: 1,
    h: 1,
    collision: [[true]],
    overheadRows: 0,
    tags: ['栅栏', '围栏', '篱笆', 'fence', 'rail'],
  },
};

export const SPRITE_CATALOG: Record<SpriteId, SpriteMeta> = {
  hero: {
    id: 'hero',
    label: '主角勇者',
    labelEn: 'Hero',
    category: 'npc',
    tags: ['主角', '勇者', '冒险者', 'hero', 'player'],
  },
  elder: {
    id: 'elder',
    label: '村长/长者',
    labelEn: 'Village Elder',
    category: 'npc',
    tags: ['村长', '长老', '老人', '老头', 'elder', 'old man', 'chief'],
  },
  guard: {
    id: 'guard',
    label: '卫兵/守卫',
    labelEn: 'Town Guard',
    category: 'npc',
    tags: ['卫兵', '守卫', '士兵', '骑士', 'guard', 'soldier', 'knight'],
  },
  merchant: {
    id: 'merchant',
    label: '商人/店主',
    labelEn: 'Merchant',
    category: 'npc',
    tags: ['商人', '店主', '药师', '商贩', 'merchant', 'trader', 'shopkeeper'],
  },
  villager: {
    id: 'villager',
    label: '村民',
    labelEn: 'Villager',
    category: 'npc',
    tags: ['村民', '路人', '居民', '女孩', 'villager', 'townsfolk', 'npc'],
  },
  mage: {
    id: 'mage',
    label: '法师/学者',
    labelEn: 'Mage',
    category: 'npc',
    tags: ['法师', '巫师', '学者', '魔法师', 'mage', 'wizard', 'scholar'],
  },
  slime: {
    id: 'slime',
    label: '史莱姆',
    labelEn: 'Slime',
    category: 'monster',
    tags: ['史莱姆', '怪物', '魔物', 'slime', 'monster', 'enemy'],
  },
  cat: {
    id: 'cat',
    label: '橘猫',
    labelEn: 'Orange Cat',
    category: 'npc',
    tags: ['猫', '猫咪', '小猫', '宠物', '动物', 'cat', 'pet', 'animal'],
  },
  chest_npc: {
    id: 'chest_npc',
    label: '可交互宝箱',
    labelEn: 'Interactive Chest',
    category: 'object',
    tags: ['宝箱', '箱子', '宝藏', 'chest', 'treasure'],
  },
  sign_npc: {
    id: 'sign_npc',
    label: '可交互路牌',
    labelEn: 'Interactive Sign',
    category: 'object',
    tags: ['路牌', '告示牌', '牌子', 'sign', 'signpost'],
  },
};

export const TERRAIN_LIST = Object.values(TERRAIN_CATALOG);
export const PREFAB_LIST = Object.values(PREFAB_CATALOG);
export const SPRITE_LIST = Object.values(SPRITE_CATALOG);

export function searchAssetCatalog(query: string, category?: 'terrain' | 'prefab' | 'sprite') {
  const q = query.trim().toLowerCase();
  const match = (id: string, label: string, labelEn: string, tags: string[]) => {
    if (!q) return true;
    return (
      id.toLowerCase().includes(q) ||
      label.toLowerCase().includes(q) ||
      labelEn.toLowerCase().includes(q) ||
      tags.some((t) => t.toLowerCase().includes(q) || q.includes(t.toLowerCase()))
    );
  };

  return {
    terrains:
      !category || category === 'terrain'
        ? TERRAIN_LIST.filter((t) => match(t.id, t.label, t.labelEn, t.tags)).map((t) => ({
            id: t.id,
            label: t.label,
            passable: t.passable,
          }))
        : [],
    prefabs:
      !category || category === 'prefab'
        ? PREFAB_LIST.filter((p) => match(p.id, p.label, p.labelEn, p.tags)).map((p) => ({
            id: p.id,
            label: p.label,
            size: `${p.w}x${p.h}`,
            category: p.category,
          }))
        : [],
    sprites:
      !category || category === 'sprite'
        ? SPRITE_LIST.filter((s) => match(s.id, s.label, s.labelEn, s.tags)).map((s) => ({
            id: s.id,
            label: s.label,
            category: s.category,
          }))
        : [],
  };
}

export function getCatalogPromptSummary(): string {
  const terrains = TERRAIN_LIST.map((t) => `${t.id}(${t.label}${t.passable ? '' : ',不可通行'})`).join(', ');
  const prefabs = PREFAB_LIST.map((p) => `${p.id}(${p.label},${p.w}x${p.h})`).join(', ');
  const sprites = SPRITE_LIST.map((s) => `${s.id}(${s.label})`).join(', ');
  return [
    `可用地形 Terrains: ${terrains}`,
    `可用预制件 Prefabs: ${prefabs}`,
    `可用精灵 Sprites: ${sprites}`,
  ].join('\n');
}
