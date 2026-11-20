import { getCatalogPromptSummary } from '../assets/catalog';
import { LUA_API_REFERENCE } from '../engine/luaRuntime';
import { AI_TOOL_DEFINITIONS, executeStudioTool } from './tools';
import type {
  AiProviderConfig,
  AiToolTrace,
  RpgProject,
  SelectionContext,
} from '../types/project';

export interface AgentRunResult {
  reply: string;
  updatedProject: RpgProject;
  toolTraces: AiToolTrace[];
  changes: string[];
  switchToMapId?: string;
  selectEventId?: string;
}

function buildSystemPrompt(project: RpgProject, activeMapId: string, selection: SelectionContext): string {
  const activeMap = project.maps[activeMapId];
  const luaDocs = LUA_API_REFERENCE.map((item) => `- \`${item.sig}\`: ${item.desc}`).join('\n');

  let focusHint = `当前正在编辑地图: ${activeMap ? `${activeMap.name} (id="${activeMap.id}", 尺寸 ${activeMap.width}x${activeMap.height})` : activeMapId}`;
  if (selection.type === 'region') {
    focusHint += `\n用户当前在画布上框选了重点区域: x=${selection.x}, y=${selection.y}, w=${selection.w}, h=${selection.h}（请优先在该区域内进行修改）`;
  } else if (selection.type === 'event') {
    const ev = project.maps[selection.mapId]?.events.find((e) => e.id === selection.eventId);
    if (ev) {
      focusHint += `\n用户当前选中了事件/NPC: id="${ev.id}", name="${ev.name}", 坐标=(${ev.x}, ${ev.y}), sprite="${ev.sprite}"`;
    }
  }

  return `你是 LuaCraft RPG Studio 的内置 AI 辅助引擎专家（类似 RPG Maker 的 Cursor 副驾驶）。
你的任务是根据用户的一句话需求，通过调用工具精准生成或修改 RPG 地图、预制件建筑、NPC 与 Lua 5.4 事件脚本。

## 工作原则
1. **先查后改**：在不了解地图布局或事件脚本时，先调用 \`inspect_map\` 或 \`read_event_script\` 查看现状，避免覆盖已有重要建筑或 NPC。
2. **使用高层语义工具**：不要试图输出瓦片数组；使用 \`paint_terrain\`、\`draw_path\`、\`place_prefab\`、\`scatter_props\`、\`upsert_event\`、\`patch_event_script\` 等工具。
3. **确保可玩性与连通性**：放置 NPC 或建筑时，不要把 NPC 放进水里或房子碰撞体里，确保玩家能走到 NPC 面前按空格交互。
4. **Lua 5.4 脚本规范**：
   - 使用简洁的同步风格写法（底层引擎通过 wasmoon 协程自动挂起等待）。
   - 推荐将逻辑写在 \`function on_interact() ... end\` 中（对于 trigger="touch" 的传送门可直接顶层写代码）。
   - 如果工具返回 Lua 语法错误，立刻修复并重新提交。
5. **回答简洁清晰**：执行完工具后，用简短的中文总结做了哪些改动，并提示用户可以立刻切到「试玩模式」体验。

## 可用素材目录
${getCatalogPromptSummary()}

## 可用 Lua 5.4 引擎 API
${luaDocs}

## 当前编辑器上下文
${focusHint}
当前工程已有地图: ${Object.values(project.maps).map((m) => `${m.id}(${m.name})`).join(', ')}`;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

/**
 * Runs a real OpenAI-compatible Tool-Calling loop (works with DeepSeek, OpenAI, Qwen, Ollama, etc.)
 */
async function runRealApiAgent(
  prompt: string,
  workingProject: RpgProject,
  activeMapId: string,
  selection: SelectionContext,
  config: AiProviderConfig,
  onProgress?: (status: string) => void
): Promise<AgentRunResult> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const toolTraces: AiToolTrace[] = [];
  const changes: string[] = [];
  let switchToMapId: string | undefined;
  let selectEventId: string | undefined;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: buildSystemPrompt(workingProject, activeMapId, selection) },
    { role: 'user', content: prompt },
  ];

  const MAX_ROUNDS = 8;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    onProgress?.(round === 0 ? '正在分析意图并规划改动...' : `正在执行第 ${round + 1} 轮工具推理...`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools: AI_TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`API 请求失败 (${resp.status}): ${errBody.slice(0, 260)}`);
    }

    const data = await resp.json();
    const choice = data.choices?.[0];
    const msg = choice?.message as OpenAIMessage | undefined;
    if (!msg) {
      throw new Error('API 返回结构异常：缺少 choices[0].message');
    }

    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        reply: msg.content || '已完成修改。',
        updatedProject: workingProject,
        toolTraces,
        changes,
        switchToMapId,
        selectEventId,
      };
    }

    for (const tc of msg.tool_calls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }

      onProgress?.(`正在调用工具: ${tc.function.name}...`);
      const res = await executeStudioTool(workingProject, tc.function.name, parsedArgs);

      if (res.ok && res.changeDescription) {
        changes.push(res.changeDescription);
      }
      if (res.ok && tc.function.name === 'create_map' && typeof parsedArgs.mapId === 'string') {
        switchToMapId = parsedArgs.mapId;
      }
      if (res.ok && tc.function.name === 'upsert_event' && typeof parsedArgs.eventId === 'string') {
        selectEventId = parsedArgs.eventId;
      }

      toolTraces.push({
        id: tc.id,
        name: tc.function.name,
        args: parsedArgs,
        ok: res.ok,
        summary: res.changeDescription || (res.ok ? '查询成功' : String(res.output)),
      });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(res.ok ? res.output : { error: res.output }),
      });
    }
  }

  return {
    reply: '已完成多步工具调用，请在地图与脚本面板中查看改动。',
    updatedProject: workingProject,
    toolTraces,
    changes,
    switchToMapId,
    selectEventId,
  };
}

/**
 * Built-in local Demo Planner so users can experience one-sentence AI map/event editing immediately
 * before configuring an OpenAI/DeepSeek API key. Executes the exact same real studio tools & Lua compiler!
 */
async function runDemoPlanner(
  prompt: string,
  workingProject: RpgProject,
  activeMapId: string,
  selection: SelectionContext,
  onProgress?: (status: string) => void
): Promise<AgentRunResult> {
  const toolTraces: AiToolTrace[] = [];
  const changes: string[] = [];
  let switchToMapId: string | undefined;
  let selectEventId: string | undefined;

  const callTool = async (name: string, args: Record<string, unknown>) => {
    onProgress?.(`[本地演示] 执行 ${name}...`);
    const res = await executeStudioTool(workingProject, name, args);
    toolTraces.push({
      id: `demo_${toolTraces.length}_${Date.now()}`,
      name,
      args,
      ok: res.ok,
      summary: res.changeDescription || (res.ok ? '查询成功' : String(res.output)),
    });
    if (res.ok && res.changeDescription) changes.push(res.changeDescription);
    return res;
  };

  await new Promise((r) => setTimeout(r, 260));
  await callTool('inspect_map', { mapId: activeMapId });

  const p = prompt.toLowerCase();
  const map = workingProject.maps[activeMapId];
  const targetRect =
    selection.type === 'region' && selection.mapId === activeMapId
      ? { x: selection.x, y: selection.y, w: selection.w, h: selection.h }
      : { x: Math.max(2, map.width - 7), y: Math.max(6, map.height - 6), w: 5, h: 4 };

  // Intent 1: Create a brand new map (dungeon / island / valley / map)
  if (/新地图|创建地图|生成.*地图|山谷|小岛|秘境|地牢|new map/.test(p)) {
    const newId = `secret_glade_${Object.keys(workingProject.maps).length + 1}`;
    const mapTitle = p.includes('岛') ? '星月小岛' : p.includes('地牢') ? '古代遗迹' : '翡翠秘谷';
    await callTool('create_map', {
      mapId: newId,
      name: mapTitle,
      width: 20,
      height: 15,
      baseTerrain: p.includes('岛') ? 'water' : 'forest_floor',
    });
    if (p.includes('岛')) {
      await callTool('paint_terrain', { mapId: newId, terrain: 'sand', shape: 'ellipse', x: 3, y: 2, w: 14, h: 11 });
      await callTool('paint_terrain', { mapId: newId, terrain: 'grass', shape: 'ellipse', x: 5, y: 4, w: 10, h: 7 });
    } else {
      await callTool('paint_terrain', { mapId: newId, terrain: 'grass', shape: 'ellipse', x: 4, y: 3, w: 12, h: 9 });
      await callTool('draw_path', {
        mapId: newId,
        terrain: 'dirt',
        width: 2,
        points: [
          { x: 9, y: 14 },
          { x: 9, y: 7 },
        ],
      });
    }
    await callTool('place_prefab', { mapId: newId, prefabId: 'house_blue', x: 8, y: 4 });
    await callTool('place_prefab', { mapId: newId, prefabId: 'campfire', x: 12, y: 8 });
    await callTool('scatter_props', {
      mapId: newId,
      x: 2,
      y: 2,
      w: 16,
      h: 11,
      prefabIds: ['oak_tree', 'flowers', 'rock'],
      count: 7,
    });
    await callTool('upsert_item', {
      itemId: 'star_crystal',
      name: '星光水晶',
      description: '散发柔和蓝光的古老结晶',
    });
    await callTool('upsert_event', {
      mapId: newId,
      eventId: 'ev_hermit_mage',
      name: '隐居法师',
      x: 11,
      y: 8,
      sprite: 'mage',
      dir: 'left',
      solid: true,
      visible: true,
      trigger: 'interact',
      script: `function on_interact()
  if flags.got_crystal then
    say("隐居法师", "愿星光水晶指引你的旅途。")
    return
  end
  say("隐居法师", "竟然有旅人找到了${mapTitle}……")
  local c = ask("愿意接受古老的星光试炼吗？", {"接受祝福", "先看看风景"})
  if c == 1 then
    flags.got_crystal = true
    give_item("star_crystal", 1)
    play_sfx("heal")
    toast("获得【星光水晶】！")
    say("隐居法师", "收下它吧，这是来自 Lua 世界的馈赠。")
  else
    say("隐居法师", "慢慢欣赏这片宁静之地吧。")
  end
end`,
    });
    await callTool('upsert_event', {
      mapId: newId,
      eventId: 'ev_back_home',
      name: '返回青苔村',
      x: 9,
      y: 14,
      sprite: 'sign_npc',
      dir: 'up',
      solid: false,
      visible: true,
      trigger: 'interact',
      script: `say("传送石碑", "准备返回青苔村吗？")
local c = ask("是否传送回青苔村？", {"立刻返回", "再留一会儿"})
if c == 1 then
  play_sfx("teleport")
  teleport("village", 11, 12)
end`,
    });
    switchToMapId = newId;
    selectEventId = 'ev_hermit_mage';
    return {
      reply: `已为你生成全新地图「${mapTitle}」，自动铺设地形、房屋、篝火与自然植被，并创建了带 Lua 分支剧情的「隐居法师」和「传送石碑」。你可以立刻点击右上角「试玩」体验！\n\n> 当前处于**本地演示模式**，配置 DeepSeek / OpenAI API Key 后可响应任意复杂创意指令。`,
      updatedProject: workingProject,
      toolTraces,
      changes,
      switchToMapId,
      selectEventId,
    };
  }

  // Intent 2: Modify selected event's dialogue / humor / reward
  if (
    (selection.type === 'event' && /改|对话|幽默|有趣|奖励|金币|脚本|剧情|加/.test(p)) ||
    /村长|守卫|橘猫|史莱姆/.test(p)
  ) {
    let targetEvent =
      selection.type === 'event'
        ? map.events.find((e) => e.id === selection.eventId)
        : undefined;
    if (!targetEvent) {
      if (p.includes('守卫')) targetEvent = map.events.find((e) => e.id.includes('guard'));
      else if (p.includes('猫')) targetEvent = map.events.find((e) => e.id.includes('cat'));
      else if (p.includes('史莱姆')) targetEvent = map.events.find((e) => e.id.includes('slime'));
      else targetEvent = map.events.find((e) => e.id.includes('elder')) ?? map.events[0];
    }

    if (targetEvent) {
      await callTool('read_event_script', { mapId: activeMapId, eventId: targetEvent.id });
      const newScript = `-- AI 增强版剧情脚本 (${targetEvent.name})
function on_interact()
  play_sfx("blip")
  say("${targetEvent.name}", "咳咳……其实我一直在等一个懂 Lua 的冒险者来改写我的台词！")
  local c = ask("要不要听个村里的秘密顺便拿点零花钱？", {
    "好啊，快说说！",
    "我还是继续去冒险吧"
  })
  if c == 1 then
    if not flags.secret_bonus then
      flags.secret_bonus = true
      vars.gold = (vars.gold or 0) + 50
      play_sfx("coin")
      toast("获得隐藏零花钱 +50 金币！")
      say("${targetEvent.name}", "嘘——其实北边森林的史莱姆超喜欢别人轻声安慰它，不用动武哦！")
    else
      say("${targetEvent.name}", "秘密已经告诉你啦，金币也给你了，可别太贪心哈哈！")
    end
  else
    say("${targetEvent.name}", "哈哈，祝你旅途愉快！随时可以切回编辑模式再改我。")
  end
end`;
      await callTool('patch_event_script', {
        mapId: activeMapId,
        eventId: targetEvent.id,
        newScript,
      });
      selectEventId = targetEvent.id;
      return {
        reply: `已更新「${targetEvent.name}」的 Lua 5.4 脚本：新增了幽默彩蛋对话与 50 金币隐藏奖励，并通过了 \`wasmoon\` 语法校验。你可以在右侧「属性 & Lua」查看代码，或直接点击「试玩」与其对话！`,
        updatedProject: workingProject,
        toolTraces,
        changes,
        selectEventId,
      };
    }
  }

  // Intent 3: Lake / pond / water + bridge
  if (/湖|水池|池塘|河|桥|lake|pond|water/.test(p)) {
    const lx = Math.max(2, Math.min(targetRect.x, map.width - 7));
    const ly = Math.max(7, Math.min(targetRect.y, map.height - 6));
    await callTool('paint_terrain', {
      mapId: activeMapId,
      terrain: 'water',
      shape: 'ellipse',
      x: lx,
      y: ly,
      w: 5,
      h: 4,
    });
    await callTool('place_prefab', { mapId: activeMapId, prefabId: 'bridge_h', x: lx + 1, y: ly + 1 });
    await callTool('place_prefab', { mapId: activeMapId, prefabId: 'bridge_h', x: lx + 2, y: ly + 1 });
    await callTool('place_prefab', { mapId: activeMapId, prefabId: 'bridge_h', x: lx + 3, y: ly + 1 });
    await callTool('define_region', {
      mapId: activeMapId,
      regionId: 'reg_new_pond',
      name: '新月小池',
      x: lx,
      y: ly,
      w: 5,
      h: 4,
      description: 'AI 新挖的椭圆形小池塘与木桥',
    });
    return {
      reply: `已在 (${lx}, ${ly}) 挖出一片带自动水岸拼接（Auto-tile）的椭圆小池塘，并架设了一座横向木桥！`,
      updatedProject: workingProject,
      toolTraces,
      changes,
    };
  }

  // Intent 4: Flowers / trees / lamps decoration
  if (/花|树|灯|装饰|美化|forest|flower|lamp/.test(p)) {
    const prefabsToScatter = p.includes('灯')
      ? ['lamp', 'flowers']
      : p.includes('树')
      ? ['oak_tree', 'pine_tree', 'bush']
      : ['flowers', 'bush', 'lamp'];
    await callTool('scatter_props', {
      mapId: activeMapId,
      x: targetRect.x,
      y: targetRect.y,
      w: Math.max(4, targetRect.w),
      h: Math.max(4, targetRect.h),
      prefabIds: prefabsToScatter,
      count: 6,
    });
    return {
      reply: `已在目标区域 (${targetRect.x}, ${targetRect.y}, ${Math.max(4, targetRect.w)}×${Math.max(4, targetRect.h)}) 自然散布了场景装饰，并自动避开了水域和已有 NPC。`,
      updatedProject: workingProject,
      toolTraces,
      changes,
    };
  }

  // Default / Intent 5: Merchant camp + interactive Lua shop NPC!
  const cx = Math.max(2, Math.min(targetRect.x, map.width - 6));
  const cy = Math.max(7, Math.min(targetRect.y, map.height - 5));
  await callTool('paint_terrain', {
    mapId: activeMapId,
    terrain: 'sand',
    shape: 'rect',
    x: cx,
    y: cy,
    w: 5,
    h: 4,
  });
  await callTool('place_prefab', { mapId: activeMapId, prefabId: 'campfire', x: cx + 2, y: cy + 1 });
  await callTool('place_prefab', { mapId: activeMapId, prefabId: 'lamp', x: cx, y: cy });
  await callTool('upsert_item', {
    itemId: 'red_potion',
    name: '红药水',
    description: '流浪商人秘制的回复药水，售价 15 金币',
  });
  const merchantId = `ev_merchant_${Math.floor(Math.random() * 90 + 10)}`;
  await callTool('upsert_event', {
    mapId: activeMapId,
    eventId: merchantId,
    name: '流浪商人',
    x: cx + 1,
    y: cy + 2,
    sprite: 'merchant',
    dir: 'down',
    solid: true,
    visible: true,
    trigger: 'interact',
    script: `-- 流浪商人商店事件 (Lua 5.4)
function on_interact()
  local gold = vars.gold or 0
  say("流浪商人", "欢迎光临篝火小铺！你现在身上有 " .. tostring(gold) .. " 金币。")
  local choice = ask("要买点补给吗？", {
    "购买【红药水】(-15 金币)",
    "随便看看"
  })
  if choice == 1 then
    if gold >= 15 then
      vars.gold = gold - 15
      give_item("red_potion", 1)
      play_sfx("coin")
      toast("购买成功！获得【红药水】")
      say("流浪商人", "多谢惠顾！祝你在森林里一路平安。")
    else
      play_sfx("bump")
      say("流浪商人", "哎呀，金币好像不够 15 枚呢，去帮村长忙赚点赏金再来吧！")
    end
  else
    say("流浪商人", "随时欢迎再来烤火聊天！")
  end
end`,
  });
  await callTool('define_region', {
    mapId: activeMapId,
    regionId: 'reg_merchant_camp',
    name: '商人营地',
    x: cx,
    y: cy,
    w: 5,
    h: 4,
    description: '带篝火、路灯和药水商人的旅行营地',
  });
  selectEventId = merchantId;

  return {
    reply: `已在 (${cx}, ${cy}) 搭建了一个旅行营地（沙地 + 篝火 + 路灯），注册了【红药水】物品，并创建了带完整金币交易逻辑的 Lua 5.4「流浪商人」事件！\n\n点击右上角「试玩」即可走过去按空格和商人买药水；不满意可一键点击下方「撤销本轮修改」。`,
    updatedProject: workingProject,
    toolTraces,
    changes,
    selectEventId,
  };
}

export async function runAiStudioAgent(
  prompt: string,
  project: RpgProject,
  activeMapId: string,
  selection: SelectionContext,
  config: AiProviderConfig,
  onProgress?: (status: string) => void
): Promise<AgentRunResult> {
  // Always work on a deep clone so failures never corrupt the editor state
  const workingProject: RpgProject = structuredClone(project);

  if (config.mode === 'demo' || !config.apiKey.trim()) {
    return runDemoPlanner(prompt, workingProject, activeMapId, selection, onProgress);
  }

  return runRealApiAgent(prompt, workingProject, activeMapId, selection, config, onProgress);
}
