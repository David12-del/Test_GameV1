const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

console.log('Server starting...');

// ============================================
// КОНСТАНТЫ
// ============================================
const TILE_SIZE = 32;
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const TICK_RATE = 30;

// Биомы
function getBiome(x, y) {
  const dist = Math.sqrt(x * x + y * y);
  if (dist < 300) return { type: 0, name: 'forest', color: '#2d5a27' };
  if (dist < 600) return { type: 1, name: 'plains', color: '#4a7c3f' };
  if (dist < 900) return { type: 2, name: 'desert', color: '#d4a574' };
  return { type: 3, name: 'stone', color: '#6b6b6b' };
}

// Ресурсы (дерево, камень, руды)
const RESOURCES = {
  tree: { name: 'Дерево', health: 30, yield: 'wood', color: '#1a3d1a', biome: [0, 1], tool: 'axe' },
  stone: { name: 'Камень', health: 50, yield: 'stone', color: '#8a8a8a', biome: [1, 2, 3], tool: 'pickaxe' },
  coal_ore: { name: 'Уголь', health: 60, yield: 'coal', color: '#1a1a1a', biome: [3], tool: 'pickaxe' },
  ore_iron: { name: 'Железная руда', health: 80, yield: 'iron', color: '#8b6914', biome: [3], tool: 'pickaxe' },
  ore_lead: { name: 'Свинцовая руда', health: 100, yield: 'lead', color: '#4a5568', biome: [3], tool: 'pickaxe' },
  ore_gold: { name: 'Золотая руда', health: 120, yield: 'gold', color: '#ffd700', biome: [3], tool: 'pickaxe' },
  ore_diamond: { name: 'Алмаз', health: 200, yield: 'diamond', color: '#00ffff', biome: [3], tool: 'pickaxe' },
  bush: { name: 'Куст', health: 15, yield: 'food', color: '#228b22', biome: [0, 1], tool: null },
};

// Мобы
const MOBS = {
  rabbit: { name: 'Кролик', health: 10, damage: 0, speed: 3, color: '#d2b48c', yield: 'food', passive: true },
  deer: { name: 'Олень', health: 30, damage: 0, speed: 2, color: '#8b4513', yield: 'food', passive: true },
  wolf: { name: 'Волк', health: 50, damage: 10, speed: 2.5, color: '#808080', yield: 'food', passive: false },
  zombie: { name: 'Зомби', health: 40, damage: 8, speed: 1.5, color: '#2e8b57', yield: 'food', passive: false },
  skeleton: { name: 'Скелет', health: 30, damage: 12, speed: 2, color: '#f5f5dc', yield: 'food', passive: false },
  boss: { name: 'Босс', health: 500, damage: 25, speed: 1, color: '#8b0000', yield: 'diamond', passive: false },
};

// Рецепты крафта
const RECIPES = {
  // Инструменты (кирки)
  wooden_pickaxe: { result: 'wooden_pickaxe', name: 'Деревянная кирка', type: 'tool', yield: 1, materials: { wood: 10 } },
  stone_pickaxe: { result: 'stone_pickaxe', name: 'Каменная кирка', type: 'tool', yield: 1, materials: { wood: 5, stone: 10 } },
  iron_pickaxe: { result: 'iron_pickaxe', name: 'Железная кирка', type: 'tool', yield: 1, materials: { wood: 5, iron: 10, coal: 2 } },
  gold_pickaxe: { result: 'gold_pickaxe', name: 'Золотая кирка', type: 'tool', yield: 1, materials: { wood: 5, gold: 10, coal: 3 } },
  diamond_pickaxe: { result: 'diamond_pickaxe', name: 'Алмазная кирка', type: 'tool', yield: 1, materials: { wood: 5, diamond: 5, coal: 2 } },
  
  // Топоры
  wooden_axe: { result: 'wooden_axe', name: 'Деревянный топор', type: 'tool', yield: 1, materials: { wood: 10 } },
  stone_axe: { result: 'stone_axe', name: 'Каменный топор', type: 'tool', yield: 1, materials: { wood: 5, stone: 10 } },
  iron_axe: { result: 'iron_axe', name: 'Железный топор', type: 'tool', yield: 1, materials: { wood: 5, iron: 10, coal: 2 } },
  diamond_axe: { result: 'diamond_axe', name: 'Алмазный топор', type: 'tool', yield: 1, materials: { wood: 5, diamond: 5, coal: 2 } },
  
  // Молот
  wooden_hammer: { result: 'wooden_hammer', name: 'Деревянный молот', type: 'tool', yield: 1, materials: { wood: 15 } },
  stone_hammer: { result: 'stone_hammer', name: 'Каменный молот', type: 'tool', yield: 1, materials: { wood: 8, stone: 15 } },
  iron_hammer: { result: 'iron_hammer', name: 'Железный молот', type: 'tool', yield: 1, materials: { wood: 8, iron: 15, coal: 3 } },
  diamond_hammer: { result: 'diamond_hammer', name: 'Алмазный молот', type: 'tool', yield: 1, materials: { wood: 8, diamond: 8, coal: 3 } },
  
  // Мечи
  wooden_sword: { result: 'wooden_sword', name: 'Деревянный меч', type: 'weapon', yield: 1, materials: { wood: 10 } },
  stone_sword: { result: 'stone_sword', name: 'Каменный меч', type: 'weapon', yield: 1, materials: { wood: 5, stone: 10 } },
  iron_sword: { result: 'iron_sword', name: 'Железный меч', type: 'weapon', yield: 1, materials: { wood: 5, iron: 10, coal: 2 } },
  gold_sword: { result: 'gold_sword', name: 'Золотой меч', type: 'weapon', yield: 1, materials: { wood: 5, gold: 10, coal: 3 } },
  diamond_sword: { result: 'diamond_sword', name: 'Алмазный меч', type: 'weapon', yield: 1, materials: { wood: 5, diamond: 5, coal: 2 } },
  
  // Броня
  wooden_helmet: { result: 'wooden_helmet', name: 'Деревянный шлем', type: 'armor', yield: 1, materials: { wood: 15 } },
  stone_helmet: { result: 'stone_helmet', name: 'Каменный шлем', type: 'armor', yield: 1, materials: { wood: 8, stone: 15 } },
  iron_helmet: { result: 'iron_helmet', name: 'Железный шлем', type: 'armor', yield: 1, materials: { wood: 8, iron: 15, coal: 3 } },
  diamond_helmet: { result: 'diamond_helmet', name: 'Алмазный шлем', type: 'armor', yield: 1, materials: { wood: 8, diamond: 8, coal: 3 } },
  
  wooden_chestplate: { result: 'wooden_chestplate', name: 'Деревянный нагрудник', type: 'armor', yield: 1, materials: { wood: 20 } },
  stone_chestplate: { result: 'stone_chestplate', name: 'Каменный нагрудник', type: 'armor', yield: 1, materials: { wood: 10, stone: 20 } },
  iron_chestplate: { result: 'iron_chestplate', name: 'Железный нагрудник', type: 'armor', yield: 1, materials: { wood: 10, iron: 20, coal: 5 } },
  diamond_chestplate: { result: 'diamond_chestplate', name: 'Алмазный нагрудник', type: 'armor', yield: 1, materials: { wood: 10, diamond: 10, coal: 5 } },
  
  wooden_boots: { result: 'wooden_boots', name: 'Деревянные ботинки', type: 'armor', yield: 1, materials: { wood: 10 } },
  stone_boots: { result: 'stone_boots', name: 'Каменные ботинки', type: 'armor', yield: 1, materials: { wood: 5, stone: 10 } },
  iron_boots: { result: 'iron_boots', name: 'Железные ботинки', type: 'armor', yield: 1, materials: { wood: 5, iron: 10, coal: 2 } },
  diamond_boots: { result: 'diamond_boots', name: 'Алмазные ботинки', type: 'armor', yield: 1, materials: { wood: 5, diamond: 5, coal: 2 } },
  
  // Печка
  furnace: { result: 'furnace', name: 'Печка', type: 'block', yield: 1, materials: { stone: 20 } },
  
  // Строительные блоки
  wooden_wall: { result: 'wooden_wall', name: 'Деревянная стена', type: 'block', yield: 4, materials: { wood: 8 } },
  stone_wall: { result: 'stone_wall', name: 'Каменная стена', type: 'block', yield: 4, materials: { stone: 12 } },
  iron_wall: { result: 'iron_wall', name: 'Железная стена', type: 'block', yield: 4, materials: { iron: 12 } },
  
  wooden_gate: { result: 'wooden_gate', name: 'Деревянные ворота', type: 'block', yield: 1, materials: { wood: 16 } },
  iron_gate: { result: 'iron_gate', name: 'Железные ворота', type: 'block', yield: 1, materials: { iron: 16 } },
  
  // Ловушки
  spike_trap: { result: 'spike_trap', name: 'Шиповая ловушка', type: 'block', yield: 2, materials: { stone: 10, iron: 5 } },
  bear_trap: { result: 'bear_trap', name: 'Медвежий капкан', type: 'block', yield: 1, materials: { iron: 10 } },
};

// Характеристики предметов
const ITEMS = {
  // Кирки
  wooden_pickaxe: { damage: 5, miningSpeed: 1.5, durability: 50 },
  stone_pickaxe: { damage: 8, miningSpeed: 2, durability: 100 },
  iron_pickaxe: { damage: 12, miningSpeed: 3, durability: 200 },
  gold_pickaxe: { damage: 15, miningSpeed: 4, durability: 150 },
  diamond_pickaxe: { damage: 20, miningSpeed: 5, durability: 500 },
  
  // Топоры
  wooden_axe: { damage: 6, miningSpeed: 1.8, durability: 50 },
  stone_axe: { damage: 10, miningSpeed: 2.5, durability: 100 },
  iron_axe: { damage: 15, miningSpeed: 4, durability: 200 },
  diamond_axe: { damage: 25, miningSpeed: 6, durability: 500 },
  
  // Молоты
  wooden_hammer: { damage: 20, miningSpeed: 0.5, durability: 50 },
  stone_hammer: { damage: 30, miningSpeed: 0.8, durability: 100 },
  iron_hammer: { damage: 45, miningSpeed: 1.2, durability: 200 },
  diamond_hammer: { damage: 70, miningSpeed: 2, durability: 500 },
  
  // Мечи
  wooden_sword: { damage: 15, durability: 50 },
  stone_sword: { damage: 25, durability: 100 },
  iron_sword: { damage: 40, durability: 200 },
  gold_sword: { damage: 35, durability: 150 },
  diamond_sword: { damage: 60, durability: 500 },
  
  // Броня (защита + прочность)
  wooden_helmet: { defense: 5, durability: 50 },
  stone_helmet: { defense: 10, durability: 100 },
  iron_helmet: { defense: 18, durability: 200 },
  diamond_helmet: { defense: 25, durability: 500 },
  
  wooden_chestplate: { defense: 10, durability: 50 },
  stone_chestplate: { defense: 20, durability: 100 },
  iron_chestplate: { defense: 35, durability: 200 },
  diamond_chestplate: { defense: 50, durability: 500 },
  
  wooden_boots: { defense: 5, durability: 50 },
  stone_boots: { defense: 10, durability: 100 },
  iron_boots: { defense: 18, durability: 200 },
  diamond_boots: { defense: 25, durability: 500 },
};

// ============================================
// СОСТОЯНИЕ ИГРЫ
// ============================================
let gameState = {
  players: {},
  resources: [],
  mobs: [],
  bots: [],
  placedBlocks: [],
};

function initGame() {
  gameState.resources = [];
  gameState.mobs = [];
  gameState.bots = [];
  gameState.placedBlocks = [];
  
  for (let i = 0; i < 500; i++) spawnResource();
  for (let i = 0; i < 100; i++) spawnMob();
  
  console.log('Game initialized');
}

function spawnResource() {
  let x, y, biome, type;
  
  for (let i = 0; i < 20; i++) {
    x = Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH;
    y = Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT;
    biome = getBiome(x, y);
    
    const possible = Object.entries(RESOURCES).filter(([k, r]) => r.biome.includes(biome.type));
    if (possible.length > 0) {
      [type] = possible[Math.floor(Math.random() * possible.length)];
      break;
    }
  }
  
  if (!type) return;
  
  const res = RESOURCES[type];
  gameState.resources.push({
    x, y, type, health: res.health, maxHealth: res.health,
    yield: res.yield, color: res.color, name: res.name, tool: res.tool
  });
}

function spawnMob() {
  const x = Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH;
  const y = Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT;
  
  const [type, mob] = Object.entries(MOBS)[Math.floor(Math.random() * Object.keys(MOBS).length)];
  
  gameState.mobs.push({
    x, y, type, health: mob.health, maxHealth: mob.health,
    damage: mob.damage, speed: mob.speed, color: mob.color,
    yield: mob.yield, passive: mob.passive, name: mob.name,
    attackCooldown: 0, moveTimer: 0
  });
}

function createBot() {
  return {
    id: 'bot_' + Math.random().toString(36).substr(2, 9),
    x: Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH,
    y: Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT,
    health: 100, maxHealth: 100,
    hunger: 100, maxHunger: 100,
    name: 'Bot_' + Math.floor(Math.random() * 100),
    inventory: {},
    hotbar: [null, null, null, null, null, null, null, null, null],
    equipment: { helmet: null, chestplate: null, boots: null, mainHand: null },
    attackCooldown: 0, moveTimer: 0, alive: true, respawnTimer: 0
  };
}

// ============================================
// ОБНОВЛЕНИЕ
// ============================================
function getDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function getTotalDefense(player) {
  let def = 0;
  if (player.equipment.helmet && ITEMS[player.equipment.helmet]) def += ITEMS[player.equipment.helmet].defense;
  if (player.equipment.chestplate && ITEMS[player.equipment.chestplate]) def += ITEMS[player.equipment.chestplate].defense;
  if (player.equipment.boots && ITEMS[player.equipment.boots]) def += ITEMS[player.equipment.boots].defense;
  return def;
}

function getWeaponDamage(player) {
  if (player.equipment.mainHand && ITEMS[player.equipment.mainHand]) {
    return ITEMS[player.equipment.mainHand].damage || 5;
  }
  return 5;
}

function getMiningSpeed(player, resource) {
  if (!resource.tool) return 1;
  
  const tool = player.equipment.mainHand;
  if (!tool) return 0.5;
  
  if (resource.tool === 'pickaxe' && tool.includes('pickaxe') && ITEMS[tool]) {
    return ITEMS[tool].miningSpeed || 1;
  }
  if (resource.tool === 'axe' && tool.includes('axe') && ITEMS[tool]) {
    return ITEMS[tool].miningSpeed || 1;
  }
  return 0.5;
}

function updatePlayer(player, players) {
  if (!player.alive) {
    player.respawnTimer--;
    if (player.respawnTimer <= 0) {
      player.x = Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH;
      player.y = Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT;
      player.health = 100;
      player.hunger = 100;
      player.alive = true;
    }
    return;
  }
  
  if (player.hunger > 0) player.hunger -= 0.01;
  else player.health -= 0.02;
  
  if (player.health <= 0) {
    player.alive = false;
    player.respawnTimer = 300;
    return;
  }
  
  if (player.attackCooldown > 0) player.attackCooldown--;
  
  if (player.hunger < 30 && (player.inventory.food || 0) > 0) {
    player.inventory.food--;
    player.hunger = Math.min(100, player.hunger + 30);
    player.health = Math.min(100, player.health + 10);
  }
}

function updateBot(bot, players) {
  if (!bot.alive) {
    bot.respawnTimer--;
    if (bot.respawnTimer <= 0) {
      bot.x = Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH;
      bot.y = Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT;
      bot.health = 100;
      bot.hunger = 100;
      bot.alive = true;
    }
    return;
  }
  
  if (bot.hunger > 0) bot.hunger -= 0.01;
  else bot.health -= 0.02;
  
  if (bot.health <= 0) {
    bot.alive = false;
    bot.respawnTimer = 300;
    return;
  }
  
  if (bot.attackCooldown > 0) bot.attackCooldown--;
  
  if (bot.hunger < 30 && (bot.inventory.food || 0) > 0) {
    bot.inventory.food--;
    bot.hunger = Math.min(100, bot.hunger + 30);
  }
  
  let target = null, minDist = 20;
  for (const p of players) {
    const d = getDistance(bot, p);
    if (d < minDist) { minDist = d; target = p; }
  }
  
  if (target) {
    if (minDist > 1.5) {
      bot.moveTimer++;
      if (bot.moveTimer > 15) {
        bot.moveTimer = 0;
        bot.x += target.x > bot.x ? 1 : -1;
        bot.y += target.y > bot.y ? 1 : -1;
        bot.x = Math.max(-MAP_WIDTH, Math.min(MAP_WIDTH, bot.x));
        bot.y = Math.max(-MAP_HEIGHT, Math.min(MAP_HEIGHT, bot.y));
      }
    } else if (bot.attackCooldown <= 0) {
      bot.attackCooldown = 30;
      target.health -= 10;
    }
  }
}

function updateMobs(players) {
  for (const mob of gameState.mobs) {
    if (mob.attackCooldown > 0) mob.attackCooldown--;
    
    let target = null, minDist = 8;
    for (const p of players) {
      const d = getDistance(mob, p);
      if (d < minDist) { minDist = d; target = p; }
    }
    
    if (target) {
      if (!mob.passive || minDist < 3) {
        if (minDist > 1.5) {
          mob.moveTimer++;
          if (mob.moveTimer > 20 / mob.speed) {
            mob.moveTimer = 0;
            mob.x += target.x > mob.x ? 1 : -1;
            mob.y += target.y > mob.y ? 1 : -1;
          }
        } else if (mob.attackCooldown <= 0) {
          mob.attackCooldown = 60 / mob.speed;
          target.health -= Math.max(1, mob.damage - getTotalDefense(target));
        }
      }
    }
  }
  gameState.mobs = gameState.mobs.filter(m => m.health > 0);
}

function gameLoop() {
  const players = Object.values(gameState.players || {}).filter(p => p && p.alive);
  
  for (const id in (gameState.players || {})) {
    updatePlayer(gameState.players[id], players);
  }
  
  const playerCount = players.length;
  const botCount = Math.max(10, playerCount * 2);
  
  while (gameState.bots.length < botCount) gameState.bots.push(createBot());
  
  for (const bot of gameState.bots) updateBot(bot, players);
  
  updateMobs(players);
  
  if (gameState.resources.length < 400 && Math.random() < 0.02) spawnResource();
  if (gameState.mobs.length < 80 && Math.random() < 0.01) spawnMob();
  
  io.emit('update', {
    players: gameState.players,
    bots: gameState.bots.filter(b => b.alive),
    resources: gameState.resources,
    mobs: gameState.mobs,
    placedBlocks: gameState.placedBlocks,
  });
}

// ============================================
// ОБРАБОТКА СОКЕТОВ
// ============================================
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  socket.on('login', (data) => {
    const name = data.name?.substring(0, 16) || 'Player';
    
    gameState.players[socket.id] = {
      id: socket.id,
      name: name,
      x: Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH,
      y: Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT,
      health: 100, maxHealth: 100,
      hunger: 100, maxHunger: 100,
      alive: true, respawnTimer: 0,
      inventory: {},
      hotbar: [null, null, null, null, null, null, null, null, null],
      equipment: { helmet: null, chestplate: null, boots: null, mainHand: null },
      attackCooldown: 0,
    };
    
    socket.emit('init', {
      player: gameState.players[socket.id],
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      tileSize: TILE_SIZE,
      recipes: RECIPES,
    });
  });
  
  socket.on('move', (data) => {
    const p = gameState.players[socket.id];
    if (!p || !p.alive) return;
    const speed = 1;
    if (data.direction === 'up') p.y -= speed;
    if (data.direction === 'down') p.y += speed;
    if (data.direction === 'left') p.x -= speed;
    if (data.direction === 'right') p.x += speed;
    p.x = Math.max(-MAP_WIDTH, Math.min(MAP_WIDTH, p.x));
    p.y = Math.max(-MAP_HEIGHT, Math.min(MAP_HEIGHT, p.y));
  });
  
  socket.on('attack', () => {
    const p = gameState.players[socket.id];
    if (!p || !p.alive || p.attackCooldown > 0) return;
    
    p.attackCooldown = 15;
    
    for (const mob of gameState.mobs) {
      if (getDistance(p, mob) < 2) {
        mob.health -= getWeaponDamage(p);
        if (mob.health <= 0) {
          p.inventory[mob.yield] = (p.inventory[mob.yield] || 0) + (mob.yield === 'diamond' ? 1 : 3);
        }
        return;
      }
    }
    
    for (const res of gameState.resources) {
      if (getDistance(p, res) < 2) {
        res.health -= getMiningSpeed(p, res);
        if (res.health <= 0) {
          p.inventory[res.yield] = (p.inventory[res.yield] || 0) + 1;
          res.x = -9999;
        }
        return;
      }
    }
    
    for (const bot of gameState.bots) {
      if (getDistance(p, bot) < 2 && bot.alive) {
        bot.health -= getWeaponDamage(p);
        if (!bot.alive) p.inventory.food = (p.inventory.food || 0) + 2;
      }
    }
  });
  
  socket.on('place', (data) => {
    const p = gameState.players[socket.id];
    if (!p || !p.alive) return;
    
    const recipe = RECIPES[data.recipe];
    if (!recipe || recipe.type !== 'block') return;
    
    for (const [mat, cnt] of Object.entries(recipe.materials)) {
      if ((p.inventory[mat] || 0) < cnt) return;
    }
    
    for (const [mat, cnt] of Object.entries(recipe.materials)) {
      p.inventory[mat] -= cnt;
    }
    
    gameState.placedBlocks.push({
      x: p.x + data.offsetX,
      y: p.y + data.offsetY,
      type: recipe.result,
      color: getBlockColor(recipe.result)
    });
  });
  
  socket.on('eat', () => {
    const p = gameState.players[socket.id];
    if (!p || !p.alive) return;
    if ((p.inventory.food || 0) > 0 && p.hunger < 80) {
      p.inventory.food--;
      p.hunger = Math.min(100, p.hunger + 30);
      p.health = Math.min(100, p.health + 15);
    }
  });
  
  socket.on('craft', (data) => {
    const p = gameState.players[socket.id];
    if (!p || !p.alive) return;
    
    const recipe = RECIPES[data.recipe];
    if (!recipe) return;
    
    for (const [mat, cnt] of Object.entries(recipe.materials)) {
      if ((p.inventory[mat] || 0) < cnt) return;
    }
    
    for (const [mat, cnt] of Object.entries(recipe.materials)) {
      p.inventory[mat] -= cnt;
    }
    
    if (recipe.type === 'tool' || recipe.type === 'weapon') {
      p.equipment.mainHand = recipe.result;
    } else if (recipe.type === 'armor') {
      if (recipe.result.includes('helmet')) p.equipment.helmet = recipe.result;
      else if (recipe.result.includes('chestplate')) p.equipment.chestplate = recipe.result;
      else if (recipe.result.includes('boots')) p.equipment.boots = recipe.result;
    } else if (recipe.type === 'block') {
      p.inventory[recipe.result] = (p.inventory[recipe.result] || 0) + recipe.yield;
    }
    
    socket.emit('craftResult', { success: true, item: recipe.name });
  });
  
  socket.on('hotbarSelect', (data) => {
    const p = gameState.players[socket.id];
    if (!p || !p.hotbar) return;
    
    const item = p.hotbar[data.slot];
    if (item) {
      if (item.includes('sword') || item.includes('pickaxe') || item.includes('axe') || item.includes('hammer')) {
        p.equipment.mainHand = item;
      } else if (item.includes('helmet')) {
        p.equipment.helmet = item;
      } else if (item.includes('chestplate')) {
        p.equipment.chestplate = item;
      } else if (item.includes('boots')) {
        p.equipment.boots = item;
      }
    }
  });
  
  socket.on('disconnect', () => {
    if (gameState.players) delete gameState.players[socket.id];
  });
});

function getBlockColor(type) {
  const colors = {
    wooden_wall: '#8B4513', stone_wall: '#696969', iron_wall: '#A9A9A9',
    wooden_gate: '#A0522D', iron_gate: '#708090',
    spike_trap: '#4A4A4A', bear_trap: '#2F4F4F',
    furnace: '#808080'
  };
  return colors[type] || '#FF00FF';
}

// ============================================
// ЗАПУСК
// ============================================
initGame();
setInterval(gameLoop, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server: http://localhost:${PORT}`);
});