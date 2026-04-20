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

// Биомы (от центра -1000 до 1000)
function getBiome(x, y) {
  const dist = Math.sqrt(x * x + y * y);
  const angle = Math.atan2(y, x);
  
  if (dist < 300) return { type: 0, name: 'forest', color: '#2d5a27' };
  if (dist < 600) return { type: 1, name: 'plains', color: '#4a7c3f' };
  if (dist < 900) return { type: 2, name: 'desert', color: '#d4a574' };
  return { type: 3, name: 'stone', color: '#6b6b6b' };
}

// Ресурсы
const RESOURCES = {
  tree: { name: 'Дерево', health: 30, yield: 'wood', color: '#1a3d1a', biome: [0, 1], tool: 'axe' },
  stone: { name: 'Камень', health: 50, yield: 'stone', color: '#8a8a8a', biome: [1, 2, 3], tool: 'pickaxe' },
  ore_iron: { name: 'Железная руда', health: 80, yield: 'iron', color: '#8b6914', biome: [3], tool: 'pickaxe' },
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
  wooden_pickaxe: { result: 'wooden_pickaxe', name: 'Деревянная кирка', yield: 1, materials: { wood: 10 } },
  stone_pickaxe: { result: 'stone_pickaxe', name: 'Каменная кирка', yield: 1, materials: { wood: 5, stone: 10 } },
  iron_pickaxe: { result: 'iron_pickaxe', name: 'Железная кирка', yield: 1, materials: { wood: 5, iron: 10 } },
  diamond_pickaxe: { result: 'diamond_pickaxe', name: 'Алмазная кирка', yield: 1, materials: { wood: 5, diamond: 5 } },
  wooden_sword: { result: 'wooden_sword', name: 'Деревянный меч', yield: 1, materials: { wood: 10 } },
  stone_sword: { result: 'stone_sword', name: 'Каменный меч', yield: 1, materials: { wood: 5, stone: 10 } },
  iron_sword: { result: 'iron_sword', name: 'Железный меч', yield: 1, materials: { wood: 5, iron: 10 } },
  diamond_sword: { result: 'diamond_sword', name: 'Алмазный меч', yield: 1, materials: { wood: 5, diamond: 5 } },
  wooden_armor: { result: 'wooden_armor', name: 'Деревянная броня', yield: 1, materials: { wood: 20 } },
  stone_armor: { result: 'stone_armor', name: 'Каменная броня', yield: 1, materials: { wood: 10, stone: 20 } },
  iron_armor: { result: 'iron_armor', name: 'Железная броня', yield: 1, materials: { wood: 10, iron: 20 } },
  diamond_armor: { result: 'diamond_armor', name: 'Алмазная броня', yield: 1, materials: { wood: 10, diamond: 20 } },
};

// Инструменты
const TOOLS = {
  wooden_pickaxe: { damage: 5, miningSpeed: 1.5, durability: 50 },
  stone_pickaxe: { damage: 8, miningSpeed: 2, durability: 100 },
  iron_pickaxe: { damage: 12, miningSpeed: 3, durability: 200 },
  diamond_pickaxe: { damage: 20, miningSpeed: 5, durability: 500 },
  wooden_sword: { damage: 15, miningSpeed: 1, durability: 50 },
  stone_sword: { damage: 25, miningSpeed: 1, durability: 100 },
  iron_sword: { damage: 40, miningSpeed: 1, durability: 200 },
  diamond_sword: { damage: 60, miningSpeed: 1, durability: 500 },
  wooden_armor: { defense: 10, durability: 50 },
  stone_armor: { defense: 20, durability: 100 },
  iron_armor: { defense: 35, durability: 200 },
  diamond_armor: { defense: 50, durability: 500 },
};

// ============================================
// СОСТОЯНИЕ ИГРЫ
// ============================================
let gameState = {
  players: {},
  resources: [],
  mobs: [],
  bots: [],
};

function initGame() {
  gameState.resources = [];
  gameState.mobs = [];
  gameState.bots = [];
  
  // Генерация ресурсов
  for (let i = 0; i < 500; i++) {
    spawnResource();
  }
  
  // Генерация мобов
  for (let i = 0; i < 100; i++) {
    spawnMob();
  }
  
  console.log('Game initialized');
}

function spawnResource() {
  let x, y, biome, type, maxAttempts = 20;
  
  for (let i = 0; i < maxAttempts; i++) {
    x = Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH;
    y = Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT;
    biome = getBiome(x, y);
    
    const possibleTypes = Object.entries(RESOURCES).filter(([key, r]) => 
      r.biome.includes(biome.type)
    );
    
    if (possibleTypes.length > 0) {
      const [key, res] = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
      type = key;
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
  
  const mobTypes = Object.entries(MOBS);
  const [key, mob] = mobTypes[Math.floor(Math.random() * mobTypes.length)];
  
  gameState.mobs.push({
    x, y, type: key, health: mob.health, maxHealth: mob.health,
    damage: mob.damage, speed: mob.speed, color: mob.color,
    yield: mob.yield, passive: mob.passive, name: mob.name,
    attackCooldown: 0, moveTimer: 0
  });
}

function createBot() {
  const x = Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH;
  const y = Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT;
  
  return {
    id: 'bot_' + Math.random().toString(36).substr(2, 9),
    x, y,
    health: 100, maxHealth: 100,
    hunger: 100, maxHunger: 100,
    name: 'Bot_' + Math.floor(Math.random() * 100),
    inventory: { wood: 0, stone: 0, iron: 0, gold: 0, diamond: 0, food: 0 },
    equipment: { weapon: null, armor: null, tool: null },
    attackCooldown: 0, moveTimer: 0
  };
}

// ============================================
// ОБНОВЛЕНИЕ
// ============================================
function getDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function updatePlayer(player, players) {
  if (!player.alive) return;
  
  // Голод
  if (player.hunger > 0) {
    player.hunger -= 0.01;
  } else {
    player.health -= 0.02;
  }
  
  // Смерть
  if (player.health <= 0) {
    player.alive = false;
    player.respawnTimer = 300;
    return;
  }
  
  // Респаун
  if (!player.alive) {
    player.respawnTimer--;
    if (player.respawnTimer <= 0) {
      player.x = Math.floor(Math.random() * MAP_WIDTH * 2) - MAP_WIDTH;
      player.y = Math.floor(Math.random() * MAP_HEIGHT * 2) - MAP_HEIGHT;
      player.health = 100;
      player.hunger = 100;
      player.alive = true;
    }
  }
  
  // Кулдаун атаки
  if (player.attackCooldown > 0) player.attackCooldown--;
  
  // Поедание еды
  if (player.hunger < 30 && player.inventory.food > 0) {
    player.inventory.food--;
    player.hunger = Math.min(100, player.hunger + 30);
    player.health = Math.min(100, player.health + 10);
  }
}

function updateBot(bot, players) {
  if (!bot.alive) return;
  
  if (bot.hunger > 0) {
    bot.hunger -= 0.01;
  } else {
    bot.health -= 0.02;
  }
  
  if (bot.health <= 0) {
    bot.alive = false;
    bot.respawnTimer = 300;
    return;
  }
  
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
  
  if (bot.attackCooldown > 0) bot.attackCooldown--;
  
  if (bot.hunger < 30 && bot.inventory.food > 0) {
    bot.inventory.food--;
    bot.hunger = Math.min(100, bot.hunger + 30);
  }
  
  // Поиск цели
  let target = null;
  let minDist = 20;
  
  for (const p of players) {
    if (p.id !== bot.id) {
      const d = getDistance(bot, p);
      if (d < minDist) {
        minDist = d;
        target = p;
      }
    }
  }
  
  if (target) {
    if (minDist > 1.5) {
      bot.moveTimer++;
      if (bot.moveTimer > 15) {
        bot.moveTimer = 0;
        const dx = target.x - bot.x;
        const dy = target.y - bot.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
          bot.x += dx > 0 ? 1 : -1;
        } else {
          bot.y += dy > 0 ? 1 : -1;
        }
        
        bot.x = Math.max(-MAP_WIDTH, Math.min(MAP_WIDTH, bot.x));
        bot.y = Math.max(-MAP_HEIGHT, Math.min(MAP_HEIGHT, bot.y));
      }
    } else if (bot.attackCooldown <= 0) {
      bot.attackCooldown = 30;
      let damage = 10;
      if (bot.equipment.weapon && TOOLS[bot.equipment.weapon]) {
        damage = TOOLS[bot.equipment.weapon].damage;
      }
      target.health -= damage;
    }
  } else {
    bot.moveTimer++;
    if (bot.moveTimer > 30) {
      bot.moveTimer = 0;
      bot.x += Math.floor(Math.random() * 3) - 1;
      bot.y += Math.floor(Math.random() * 3) - 1;
      bot.x = Math.max(-MAP_WIDTH, Math.min(MAP_WIDTH, bot.x));
      bot.y = Math.max(-MAP_HEIGHT, Math.min(MAP_HEIGHT, bot.y));
    }
  }
}

function updateMobs(players) {
  for (const mob of gameState.mobs) {
    if (mob.attackCooldown > 0) mob.attackCooldown--;
    
    let target = null;
    let minDist = 8;
    
    for (const p of players) {
      const d = getDistance(mob, p);
      if (d < minDist) {
        minDist = d;
        target = p;
      }
    }
    
    if (target) {
      if (!mob.passive || minDist < 3) {
        if (minDist > 1.5) {
          mob.moveTimer++;
          if (mob.moveTimer > 20 / mob.speed) {
            mob.moveTimer = 0;
            const dx = target.x - mob.x;
            const dy = target.y - mob.y;
            
            if (Math.abs(dx) > Math.abs(dy)) {
              mob.x += dx > 0 ? 1 : -1;
            } else {
              mob.y += dy > 0 ? 1 : -1;
            }
            
            mob.x = Math.max(-MAP_WIDTH, Math.min(MAP_WIDTH, mob.x));
            mob.y = Math.max(-MAP_HEIGHT, Math.min(MAP_HEIGHT, mob.y));
          }
        } else if (mob.attackCooldown <= 0) {
          mob.attackCooldown = 60 / mob.speed;
          
          let damage = mob.damage;
          if (target.equipment.armor && TOOLS[target.equipment.armor]) {
            damage = Math.max(1, damage - TOOLS[target.equipment.armor].defense);
          }
          target.health -= damage;
        }
      }
    } else if (!mob.passive) {
      mob.moveTimer++;
      if (mob.moveTimer > 60) {
        mob.moveTimer = 0;
        mob.x += Math.floor(Math.random() * 5) - 2;
        mob.y += Math.floor(Math.random() * 5) - 2;
      }
    }
  }
  
  gameState.mobs = gameState.mobs.filter(m => m.health > 0);
}

function gameLoop() {
  const players = Object.values(gameState.players || {}).filter(p => p && p.alive);
  
  // Обновление игроков
  for (const id in (gameState.players || {})) {
    updatePlayer(gameState.players[id], players);
  }
  
  // Боты
  const playerCount = players.length;
  const botCount = Math.max(10, playerCount * 2);
  
  while (gameState.bots.length < botCount) {
    const bot = createBot();
    gameState.bots.push(bot);
  }
  
  for (const bot of gameState.bots) {
    updateBot(bot, players);
  }
  
  // Мобы
  updateMobs(players);
  
  // Респавн ресурсов
  if (gameState.resources.length < 400 && Math.random() < 0.02) {
    spawnResource();
  }
  
  // Респавн мобов
  if (gameState.mobs.length < 80 && Math.random() < 0.01) {
    spawnMob();
  }
  
  io.emit('update', {
    players: gameState.players,
    bots: gameState.bots.filter(b => b.alive),
    resources: gameState.resources,
    mobs: gameState.mobs,
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
      inventory: { wood: 0, stone: 0, iron: 0, gold: 0, diamond: 0, food: 0 },
      equipment: { weapon: null, armor: null, tool: null },
      attackCooldown: 0,
    };
    
    socket.emit('init', {
      player: gameState.players[socket.id],
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      tileSize: TILE_SIZE,
      recipes: RECIPES,
    });
    
    console.log('Player logged in:', name);
  });
  
  socket.on('move', (data) => {
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;
    
    const speed = 1;
    if (data.direction === 'up') player.y -= speed;
    if (data.direction === 'down') player.y += speed;
    if (data.direction === 'left') player.x -= speed;
    if (data.direction === 'right') player.x += speed;
    
    player.x = Math.max(-MAP_WIDTH, Math.min(MAP_WIDTH, player.x));
    player.y = Math.max(-MAP_HEIGHT, Math.min(MAP_HEIGHT, player.y));
  });
  
  socket.on('attack', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.alive || player.attackCooldown > 0) return;
    
    player.attackCooldown = 15;
    
    // Проверка мобов
    for (const mob of gameState.mobs) {
      if (getDistance(player, mob) < 2) {
        let damage = 5;
        if (player.equipment.weapon && TOOLS[player.equipment.weapon]) {
          damage = TOOLS[player.equipment.weapon].damage;
        }
        
        mob.health -= damage;
        
        if (mob.health <= 0) {
          const yieldAmount = mob.yield === 'diamond' ? 1 : 3;
          player.inventory[mob.yield] = (player.inventory[mob.yield] || 0) + yieldAmount;
        }
        return;
      }
    }
    
    // Проверка ресурсов
    for (const res of gameState.resources) {
      if (getDistance(player, res) < 2) {
        let speed = 1;
        
        if (res.tool && player.equipment.tool) {
          if (res.tool === 'pickaxe' && player.equipment.tool.includes('pickaxe')) {
            speed = TOOLS[player.equipment.tool]?.miningSpeed || 1;
          }
          if (res.tool === 'axe' && player.equipment.tool.includes('axe')) {
            speed = TOOLS[player.equipment.tool]?.miningSpeed || 1;
          }
        }
        
        res.health -= speed;
        
        if (res.health <= 0) {
          player.inventory[res.yield] = (player.inventory[res.yield] || 0) + 1;
          res.x = -9999;
        }
        return;
      }
    }
    
    // Атака ботов
    for (const bot of gameState.bots) {
      if (getDistance(player, bot) < 2 && bot.alive) {
        let damage = 5;
        if (player.equipment.weapon && TOOLS[player.equipment.weapon]) {
          damage = TOOLS[player.equipment.weapon].damage;
        }
        
        bot.health -= damage;
        
        if (!bot.alive) {
          player.inventory.food = (player.inventory.food || 0) + 2;
        }
      }
    }
  });
  
  socket.on('eat', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;
    
    if (player.inventory.food > 0 && player.hunger < 80) {
      player.inventory.food--;
      player.hunger = Math.min(100, player.hunger + 30);
      player.health = Math.min(100, player.health + 15);
    }
  });
  
  socket.on('craft', (data) => {
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;
    
    const recipe = RECIPES[data.recipe];
    if (!recipe) return;
    
    // Проверка материалов
    for (const [mat, count] of Object.entries(recipe.materials)) {
      if ((player.inventory[mat] || 0) < count) return;
    }
    
    // Списание материалов
    for (const [mat, count] of Object.entries(recipe.materials)) {
      player.inventory[mat] -= count;
    }
    
    // Выдача предмета
    const item = recipe.result;
    if (item.includes('sword')) {
      player.equipment.weapon = item;
    } else if (item.includes('armor')) {
      player.equipment.armor = item;
    } else if (item.includes('pickaxe')) {
      player.equipment.tool = item;
    }
    
    socket.emit('craftResult', { success: true, item: recipe.name });
  });
  
socket.on('disconnect', () => {
  if (gameState.players && gameState.players[socket.id]) {
    delete gameState.players[socket.id];
  }
});
});

// ============================================
// ЗАПУСК
// ============================================
initGame();
setInterval(gameLoop, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server: http://localhost:${PORT}`);
});