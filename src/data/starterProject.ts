import type { GameMap, RpgProject, TerrainId } from '../types/project';

function createTerrainGrid(w: number, h: number, fill: TerrainId): TerrainId[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

function paintRect(grid: TerrainId[][], x: number, y: number, w: number, h: number, t: TerrainId) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
        grid[row][col] = t;
      }
    }
  }
}

export function createStarterProject(): RpgProject {
  // Map 1: Mossbrook Village (24 x 18)
  const vTerrain = createTerrainGrid(24, 18, 'grass');
  // Northern forest edge
  paintRect(vTerrain, 0, 0, 24, 3, 'forest_floor');
  // River flowing horizontally at rows 4..5
  paintRect(vTerrain, 0, 4, 24, 2, 'water');
  // Dirt road running north-south across bridge (x=11..12)
  paintRect(vTerrain, 11, 0, 2, 4, 'dirt');
  paintRect(vTerrain, 11, 6, 2, 12, 'dirt');
  // Village central cobblestone square (x=8..15, y=8..13)
  paintRect(vTerrain, 8, 8, 8, 6, 'stone');
  // Dirt branches to houses
  paintRect(vTerrain, 4, 10, 4, 2, 'dirt');
  paintRect(vTerrain, 16, 10, 4, 2, 'dirt');
  // Sandy riverbank patch on bottom-right
  paintRect(vTerrain, 18, 14, 5, 3, 'sand');

  const villageMap: GameMap = {
    id: 'village',
    name: '青苔村',
    width: 24,
    height: 18,
    terrain: vTerrain,
    regions: [
      { id: 'reg_square', name: '村子广场', x: 8, y: 8, w: 8, h: 6, description: '铺着石板的村中心广场，中央有石水井' },
      { id: 'reg_bridge', name: '北河木桥', x: 10, y: 4, w: 4, h: 3, description: '跨过小河通往北边森林的木桥' },
      { id: 'reg_east_camp', name: '东侧空地', x: 17, y: 12, w: 6, h: 5, description: '村子东南角的空旷草地与沙地，适合搭营地或扩建' },
      { id: 'reg_west', name: '西侧民居区', x: 2, y: 7, w: 5, h: 7, description: '村长红顶小屋所在区域' },
    ],
    prefabs: [
      // Wooden bridge over river (x=11..12, y=4..5)
      { id: 'p_br1', prefabId: 'bridge_v', x: 11, y: 4 },
      { id: 'p_br2', prefabId: 'bridge_v', x: 12, y: 4 },
      { id: 'p_br3', prefabId: 'bridge_v', x: 11, y: 5 },
      { id: 'p_br4', prefabId: 'bridge_v', x: 12, y: 5 },
      // Houses
      { id: 'p_h1', prefabId: 'house_red', x: 3, y: 7 },
      { id: 'p_h2', prefabId: 'house_blue', x: 17, y: 7 },
      // Village center props
      { id: 'p_well', prefabId: 'well', x: 11, y: 10 },
      { id: 'p_lamp1', prefabId: 'lamp', x: 8, y: 8 },
      { id: 'p_lamp2', prefabId: 'lamp', x: 15, y: 8 },
      { id: 'p_camp', prefabId: 'campfire', x: 19, y: 14 },
      // Trees along borders
      { id: 'p_t1', prefabId: 'oak_tree', x: 1, y: 1 },
      { id: 'p_t2', prefabId: 'pine_tree', x: 5, y: 0 },
      { id: 'p_t3', prefabId: 'oak_tree', x: 8, y: 1 },
      { id: 'p_t4', prefabId: 'pine_tree', x: 15, y: 1 },
      { id: 'p_t5', prefabId: 'oak_tree', x: 19, y: 0 },
      { id: 'p_t6', prefabId: 'pine_tree', x: 21, y: 1 },
      { id: 'p_t7', prefabId: 'oak_tree', x: 1, y: 14 },
      { id: 'p_t8', prefabId: 'oak_tree', x: 4, y: 15 },
      // Nature details
      { id: 'p_fl1', prefabId: 'flowers', x: 7, y: 13 },
      { id: 'p_fl2', prefabId: 'flowers', x: 16, y: 13 },
      { id: 'p_fl3', prefabId: 'flowers', x: 6, y: 7 },
      { id: 'p_bsh1', prefabId: 'bush', x: 2, y: 11 },
      { id: 'p_rock1', prefabId: 'rock', x: 21, y: 15 },
    ],
    events: [
      {
        id: 'ev_elder',
        name: '村长',
        x: 9,
        y: 10,
        sprite: 'elder',
        dir: 'right',
        solid: true,
        visible: true,
        trigger: 'interact',
        script: `-- 村长任务事件 (Lua 5.4)
function on_interact()
  if not flags.has_pass then
    say("村长", "年轻人，欢迎来到青苔村！北边森林最近出现了骚动的史莱姆。")
    local choice = ask("你愿意帮村子去北边森林调查一下吗？", {
      "没问题，交给我！",
      "我先在村里逛逛"
    })
    if choice == 1 then
      flags.has_pass = true
      give_item("village_pass", 1)
      give_item("iron_sword", 1)
      play_sfx("coin")
      toast("获得【村长通行证】与【铁剑】")
      say("村长", "太感谢了！拿着我的通行证去找北桥的守卫，他会放你过去的。")
    else
      say("村长", "也好，准备好随时来找我。")
    end
  elseif flags.slime_calmed then
    say("村长", "森林恢复平静了！你是青苔村真正的英雄！")
    if not flags.elder_rewarded then
      flags.elder_rewarded = true
      vars.gold = (vars.gold or 0) + 100
      play_sfx("heal")
      toast("获得赏金 100 金币！")
    end
  else
    say("村长", "北桥就在广场正北方，把通行证出示给守卫吧。")
  end
end`,
      },
      {
        id: 'ev_guard',
        name: '守桥卫兵',
        x: 11,
        y: 6,
        sprite: 'guard',
        dir: 'down',
        solid: true,
        visible: true,
        trigger: 'interact',
        script: `-- 守桥卫兵：需要村长通行证才会让路
function on_interact()
  if flags.bridge_open then
    say("守桥卫兵", "北边森林深处要小心，祝你好运！")
    return
  end

  if has_item("village_pass", 1) or flags.has_pass then
    say("守桥卫兵", "哦！这是村长的亲笔通行证。请通过吧！")
    flags.bridge_open = true
    play_sfx("confirm")
    move("self", "left", 1)
    face("self", "right")
    toast("北河木桥已开放通行！")
  else
    say("守桥卫兵", "站住！北边森林最近有史莱姆出没，没有【村长通行证】禁止过桥。")
    say("守桥卫兵", "去广场水井左边找村长聊聊吧。")
  end
end`,
      },
      {
        id: 'ev_cat',
        name: '广场橘猫',
        x: 14,
        y: 11,
        sprite: 'cat',
        dir: 'left',
        solid: true,
        visible: true,
        trigger: 'interact',
        script: `function on_interact()
  play_sfx("blip")
  vars.pet_cat = (vars.pet_cat or 0) + 1
  if vars.pet_cat == 1 then
    say("橘猫", "喵呜~（它舒服地蹭了蹭你的靴子）")
  else
    say("橘猫", "呼噜呼噜……（你已经撸了它 " .. tostring(vars.pet_cat) .. " 次）")
  end
end`,
      },
      {
        id: 'ev_sign',
        name: '村口路牌',
        x: 13,
        y: 8,
        sprite: 'sign_npc',
        dir: 'down',
        solid: true,
        visible: true,
        trigger: 'interact',
        script: `function on_interact()
  say("路牌", "↑ 迷雾北林  |  ← 村长小屋  |  → 蓝顶酒馆")
end`,
      },
      {
        id: 'ev_portal_north',
        name: '前往迷雾北林',
        x: 11,
        y: 0,
        sprite: 'sign_npc',
        dir: 'down',
        solid: false,
        visible: false,
        trigger: 'touch',
        script: `play_sfx("teleport")
toast("进入区域：迷雾北林")
teleport("north_forest", 9, 14)`,
      },
      {
        id: 'ev_portal_north_2',
        name: '前往迷雾北林(右)',
        x: 12,
        y: 0,
        sprite: 'sign_npc',
        dir: 'down',
        solid: false,
        visible: false,
        trigger: 'touch',
        script: `play_sfx("teleport")
toast("进入区域：迷雾北林")
teleport("north_forest", 10, 14)`,
      },
    ],
  };

  // Map 2: North Forest (20 x 16)
  const fTerrain = createTerrainGrid(20, 16, 'forest_floor');
  paintRect(fTerrain, 9, 6, 2, 10, 'dirt');
  paintRect(fTerrain, 7, 4, 6, 5, 'grass');
  paintRect(fTerrain, 14, 3, 4, 4, 'water');

  const forestMap: GameMap = {
    id: 'north_forest',
    name: '迷雾北林',
    width: 20,
    height: 16,
    terrain: fTerrain,
    regions: [
      { id: 'reg_glade', name: '森林空地', x: 7, y: 4, w: 6, h: 5, description: '北林中央阳光洒落的草地空地' },
      { id: 'reg_pond', name: '林间小池', x: 14, y: 3, w: 4, h: 4, description: '森林东北角的静谧水池' },
    ],
    prefabs: [
      { id: 'ft1', prefabId: 'pine_tree', x: 1, y: 1 },
      { id: 'ft2', prefabId: 'oak_tree', x: 4, y: 1 },
      { id: 'ft3', prefabId: 'pine_tree', x: 2, y: 5 },
      { id: 'ft4', prefabId: 'pine_tree', x: 1, y: 10 },
      { id: 'ft5', prefabId: 'oak_tree', x: 4, y: 11 },
      { id: 'ft6', prefabId: 'pine_tree', x: 15, y: 9 },
      { id: 'ft7', prefabId: 'oak_tree', x: 17, y: 11 },
      { id: 'ft8', prefabId: 'oak_tree', x: 11, y: 1 },
      { id: 'fr1', prefabId: 'rock', x: 6, y: 6 },
      { id: 'ff1', prefabId: 'flowers', x: 8, y: 5 },
      { id: 'ff2', prefabId: 'flowers', x: 12, y: 7 },
    ],
    events: [
      {
        id: 'ev_slime',
        name: '森林史莱姆',
        x: 10,
        y: 6,
        sprite: 'slime',
        dir: 'down',
        solid: true,
        visible: true,
        trigger: 'interact',
        script: `function on_interact()
  if flags.slime_calmed then
    say("史莱姆", "咕噜噜~（它开心地晃了晃透明的身子）")
    return
  end

  say("史莱姆", "咕噜！咕噜！（这只史莱姆看起来只是迷路了，有点焦躁）")
  local choice = ask("你要怎么做？", {
    "举起铁剑威吓它",
    "轻声安抚并分享干粮"
  })
  if choice == 1 then
    play_sfx("bump")
    say("史莱姆", "咕叽！！（它吓得弹跳着滚开了几步）")
    move("self", "left", 2)
    flags.slime_calmed = true
    toast("史莱姆被赶跑了，可以回去向村长复命！")
  else
    play_sfx("heal")
    say("史莱姆", "咕噜~♡（它立刻温顺了下来，送了你一颗发光的露珠！）")
    give_item("forest_dew", 1)
    flags.slime_calmed = true
    toast("获得了【森林露珠】，回去告诉村长吧！")
  end
end`,
      },
      {
        id: 'ev_forest_chest',
        name: '林间宝箱',
        x: 12,
        y: 4,
        sprite: 'chest_npc',
        dir: 'down',
        solid: true,
        visible: true,
        trigger: 'interact',
        script: `function on_interact()
  if flags.forest_chest_opened then
    say("宝箱", "里面已经空空如也了。")
  else
    flags.forest_chest_opened = true
    give_item("healing_herb", 2)
    play_sfx("coin")
    toast("打开宝箱，获得了 2 株【治愈草药】！")
    say("宝箱", "你发现了冒险者留下的两株治愈草药。")
  end
end`,
      },
      {
        id: 'ev_return_village',
        name: '返回青苔村',
        x: 9,
        y: 15,
        sprite: 'sign_npc',
        dir: 'up',
        solid: false,
        visible: false,
        trigger: 'touch',
        script: `play_sfx("teleport")
toast("返回：青苔村")
teleport("village", 11, 1)`,
      },
      {
        id: 'ev_return_village_2',
        name: '返回青苔村(右)',
        x: 10,
        y: 15,
        sprite: 'sign_npc',
        dir: 'up',
        solid: false,
        visible: false,
        trigger: 'touch',
        script: `play_sfx("teleport")
toast("返回：青苔村")
teleport("village", 12, 1)`,
      },
    ],
  };

  return {
    name: '青苔村物语 (LuaCraft Demo)',
    version: '0.1.0',
    startMapId: 'village',
    startX: 11,
    startY: 12,
    maps: {
      village: villageMap,
      north_forest: forestMap,
    },
    items: {
      village_pass: { id: 'village_pass', name: '村长通行证', description: '盖有青苔村印章的通行手令' },
      iron_sword: { id: 'iron_sword', name: '铁剑', description: '村长赠送的防身铁剑' },
      healing_herb: { id: 'healing_herb', name: '治愈草药', description: '散发淡淡清香的森林草药' },
      forest_dew: { id: 'forest_dew', name: '森林露珠', description: '温顺史莱姆赠予的晶莹露珠' },
    },
    initialFlags: {
      has_pass: false,
      bridge_open: false,
      slime_calmed: false,
      elder_rewarded: false,
      forest_chest_opened: false,
    },
    initialVars: {
      gold: 20,
      pet_cat: 0,
    },
  };
}
