const socket = io({ reconnection: true, reconnectionDelay: 1000 });

const TILE_SIZE = 32;
let mapWidth = 2000, mapHeight = 2000;

let canvas, ctx;
let gameState = { players: {}, bots: [], resources: [], mobs: [], placedBlocks: [] };
let myPlayer = null;
let gameInitialized = false;
let recipes = {};
let camera = { x: 0, y: 0 };
const keys = {};
let inventoryOpen = false;
let craftingOpen = false;
let particles = [];

function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'e' && gameInitialized) socket.emit('eat');
    if (e.key === 'Tab') { e.preventDefault(); toggleInventory(); }
    if (e.key === 'Escape') { inventoryOpen = false; craftingOpen = false; }
    if (e.key === ' ' && gameInitialized) { e.preventDefault(); socket.emit('attack'); }
    if (e.key >= '1' && e.key <= '9') { selectHotbar(parseInt(e.key) - 1); }
  });
  
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));

socket.on('init', (data) => {
  myPlayer = data.player;
  mapWidth = data.mapWidth;
  mapHeight = data.mapHeight;
  recipes = data.recipes;
  gameInitialized = true;
  updateHotbar();
  updateArmorSlots();
});

socket.on('update', (data) => {
  gameState.players = data.players;
  gameState.bots = data.bots;
  gameState.resources = data.resources;
  gameState.mobs = data.mobs;
  gameState.placedBlocks = data.placedBlocks || [];
  
  if (myPlayer && gameState.players[socket.id]) {
    myPlayer = gameState.players[socket.id];
    updateHotbar();
    updateArmorSlots();
  }
});

socket.on('craftResult', (data) => {
  if (data.success) {
    particles.push({ x: myPlayer?.x || 0, y: myPlayer?.y || 0, text: 'Крафт: ' + data.item, color: '#00ff00', life: 60 });
  }
});

function login() {
  const name = document.getElementById('nickname').value.trim() || 'Player';
  socket.emit('login', { name });
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
}

function toggleInventory() {
  inventoryOpen = !inventoryOpen;
  craftingOpen = false;
  renderInventory();
}

function toggleCrafting() {
  craftingOpen = !craftingOpen;
  if (craftingOpen) renderCrafting();
}

function selectHotbar(slot) {
  socket.emit('hotbarSelect', { slot });
}

function selectEquipment(slot) {
  socket.emit('hotbarSelect', { slot });
}

function renderInventory() {
  const panel = document.getElementById('inventory-panel');
  if (!panel || !myPlayer) return;
  
  let items = [];
  for (const [name, count] of Object.entries(myPlayer.inventory || {})) {
    if (count > 0) items.push({ name, count, label: getItemLabel(name), color: getItemColor(name) });
  }
  
  if (items.length === 0) {
    panel.innerHTML = '<h3>Инвентарь</h3><p style="color:#888;text-align:center;padding:20px;">Пусто</p><button onclick="toggleInventory()">Закрыть</button>';
  } else {
    let html = '<h3>Инвентарь</h3><div class="inv-grid">';
    for (const item of items) {
      html += `<div class="inv-slot" onclick="placeFromInventory('${item.name}')">
        <div class="inv-color" style="background:${item.color}"></div>
        <span>${item.label}: ${item.count}</span>
      </div>`;
    }
    html += '</div><button onclick="toggleInventory()">Закрыть</button>';
    panel.innerHTML = html;
  }
  
  panel.style.display = inventoryOpen ? 'block' : 'none';
}

function renderCrafting() {
  const panel = document.getElementById('crafting-panel');
  if (!panel || !myPlayer) return;
  
  const categories = {
    'Инструменты': ['pickaxe', 'axe', 'hammer'],
    'Оружие': ['sword'],
    'Броня': ['helmet', 'chestplate', 'boots'],
    'Блоки': ['wall', 'gate', 'furnace', 'trap']
  };
  
  let html = '<h3>Верстак</h3>';
  
  for (const [cat, types] of Object.entries(categories)) {
    html += `<div class="craft-category"><h4>${cat}</h4><div class="craft-grid">`;
    
    for (const [key, recipe] of Object.entries(recipes)) {
      if (!types.some(t => key.includes(t))) continue;
      
      let canCraft = true, mats = '';
      for (const [mat, cnt] of Object.entries(recipe.materials)) {
        const has = myPlayer.inventory[mat] || 0;
        mats += `${getItemLabel(mat)}: ${has}/${cnt} `;
        if (has < cnt) canCraft = false;
      }
      
      html += `<div class="craft-item ${canCraft ? 'can-craft' : ''}" onclick="${canCraft ? `craft('${key}')` : ''}">
        <div class="craft-name">${recipe.name}</div>
        <div class="craft-mats">${mats}</div>
      </div>`;
    }
    html += '</div></div>';
  }
  
  html += '<button onclick="toggleCrafting()">Назад</button>';
  panel.innerHTML = html;
  panel.style.display = craftingOpen ? 'block' : 'none';
}

function craft(recipe) {
  socket.emit('craft', { recipe });
  setTimeout(() => renderCrafting(), 100);
}

function placeFromInventory(item) {
  const recipe = Object.entries(recipes).find(([k, r]) => r.type === 'block' && k === item);
  if (recipe) {
    socket.emit('place', { recipe: item, offsetX: 0, offsetY: 1 });
  }
}

function getItemLabel(name) {
  const labels = {
    wood: 'Дерево', stone: 'Камень', coal: 'Уголь', iron: 'Железо',
    lead: 'Свинец', gold: 'Золото', diamond: 'Алмаз', food: 'Еда',
    wooden_pickaxe: 'Дерев. кирка', stone_pickaxe: 'Камен. кирка',
    iron_pickaxe: 'Желез. кирка', gold_pickaxe: 'Золот. кирка', diamond_pickaxe: 'Алмаз. кирка',
    wooden_axe: 'Дерев. топор', stone_axe: 'Камен. топор', iron_axe: 'Желез. топор', diamond_axe: 'Алмаз. топор',
    wooden_hammer: 'Дерев. молот', stone_hammer: 'Камен. молот', iron_hammer: 'Желез. молот', diamond_hammer: 'Алмаз. молот',
    wooden_sword: 'Дерев. меч', stone_sword: 'Камен. меч', iron_sword: 'Желез. меч', gold_sword: 'Золот. меч', diamond_sword: 'Алмаз. меч',
    wooden_helmet: 'Дерев. шлем', stone_helmet: 'Камен. шлем', iron_helmet: 'Желез. шлем', diamond_helmet: 'Алмаз. шлем',
    wooden_chestplate: 'Дерев. броня', stone_chestplate: 'Камен. броня', iron_chestplate: 'Желез. броня', diamond_chestplate: 'Алмаз. броня',
    wooden_boots: 'Дерев. ботинки', stone_boots: 'Камен. ботинки', iron_boots: 'Желез. ботинки', diamond_boots: 'Алмаз. ботинки',
    furnace: 'Печка', wooden_wall: 'Дер. стена', stone_wall: 'Кам. стена', iron_wall: 'Жел. стена',
    wooden_gate: 'Дер. ворота', iron_gate: 'Жел. ворота', spike_trap: 'Шипы', bear_trap: 'Капкан'
  };
  return labels[name] || name;
}

function getItemColor(name) {
  const colors = {
    wood: '#8B4513', stone: '#808080', coal: '#1a1a1a', iron: '#B8860B',
    lead: '#4a5568', gold: '#FFD700', diamond: '#00FFFF', food: '#FF6600',
    wooden_pickaxe: '#A0522D', stone_pickaxe: '#696969', iron_pickaxe: '#B8860B', gold_pickaxe: '#FFD700', diamond_pickaxe: '#00FFFF',
    wooden_axe: '#A0522D', stone_axe: '#696969', iron_axe: '#B8860B', diamond_axe: '#00FFFF',
    wooden_hammer: '#A0522D', stone_hammer: '#696969', iron_hammer: '#B8860B', diamond_hammer: '#00FFFF',
    wooden_sword: '#A0522D', stone_sword: '#696969', iron_sword: '#B8860B', gold_sword: '#FFD700', diamond_sword: '#00FFFF',
    wooden_helmet: '#A0522D', stone_helmet: '#696969', iron_helmet: '#B8860B', diamond_helmet: '#00FFFF',
    wooden_chestplate: '#A0522D', stone_chestplate: '#696969', iron_chestplate: '#B8860B', diamond_chestplate: '#00FFFF',
    wooden_boots: '#A0522D', stone_boots: '#696969', iron_boots: '#B8860B', diamond_boots: '#00FFFF',
    furnace: '#505050', wooden_wall: '#DEB887', stone_wall: '#808080', iron_wall: '#A9A9A9',
    wooden_gate: '#8B4513', iron_gate: '#708090', spike_trap: '#4A4A4A', bear_trap: '#2F4F4F'
  };
  return colors[name] || '#FF00FF';
}

function updateHotbar() {
  const container = document.getElementById('hotbar-slots');
  if (!container || !myPlayer) return;
  
  let html = '';
  for (let i = 0; i < 9; i++) {
    const item = myPlayer.hotbar?.[i];
    if (item) {
      html += `<div class="hotbar-slot" onclick="selectHotbar(${i})">
        <div class="slot-color" style="background:${getItemColor(item)}"></div>
        <span>${i + 1}</span>
      </div>`;
    } else {
      html += `<div class="hotbar-slot" onclick="selectHotbar(${i})"><span>${i + 1}</span></div>`;
    }
  }
  container.innerHTML = html;
}

function updateArmorSlots() {
  if (!myPlayer) return;
  
  const equip = myPlayer.equipment || {};
  
  const slots = {
    helmet: equip.helmet,
    chestplate: equip.chestplate,
    boots: equip.boots,
    mainHand: equip.mainHand
  };
  
  for (const [slot, item] of Object.entries(slots)) {
    const el = document.getElementById(`slot-${slot}`);
    if (el) {
      if (item) {
        el.style.background = getItemColor(item);
        el.innerHTML = `<span class="slot-label">${getItemLabel(item)}</span>`;
      } else {
        el.style.background = 'rgba(255,255,255,0.1)';
        const labels = { helmet: 'Шлем', chestplate: 'Броня', boots: 'Ботинки', mainHand: 'Оружие' };
        el.innerHTML = `<span class="slot-label">${labels[slot]}</span>`;
      }
    }
  }
}

function handleInput() {
  if (!myPlayer || !myPlayer.alive) return;
  if (keys['w']) socket.emit('move', { direction: 'up' });
  if (keys['s']) socket.emit('move', { direction: 'down' });
  if (keys['a']) socket.emit('move', { direction: 'left' });
  if (keys['d']) socket.emit('move', { direction: 'right' });
}

function render() {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (!gameInitialized) {
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Подключение...', canvas.width / 2, canvas.height / 2);
    requestAnimationFrame(render);
    return;
  }
  
  handleInput();
  
  if (myPlayer) {
    camera.x = myPlayer.x * TILE_SIZE - canvas.width / 2 + TILE_SIZE / 2;
    camera.y = myPlayer.y * TILE_SIZE - canvas.height / 2 + TILE_SIZE / 2;
  }
  
  renderMap();
  renderPlacedBlocks();
  renderResources();
  renderMobs();
  renderBots();
  renderPlayers();
  renderParticles();
  updateUI();
  
  requestAnimationFrame(render);
}

function renderMap() {
  const startX = Math.floor(camera.x / TILE_SIZE) - 2;
  const startY = Math.floor(camera.y / TILE_SIZE) - 2;
  const endX = Math.ceil((camera.x + canvas.width) / TILE_SIZE) + 2;
  const endY = Math.ceil((camera.y + canvas.height) / TILE_SIZE) + 2;
  
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const sx = x * TILE_SIZE - camera.x;
      const sy = y * TILE_SIZE - camera.y;
      const biome = getBiomeClient(x, y);
      ctx.fillStyle = biome.color;
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
    }
  }
}

function getBiomeClient(x, y) {
  const dist = Math.sqrt(x * x + y * y);
  if (dist < 300) return { color: '#2d5a27' };
  if (dist < 600) return { color: '#4a7c3f' };
  if (dist < 900) return { color: '#d4a574' };
  return { color: '#6b6b6b' };
}

function renderPlacedBlocks() {
  for (const block of gameState.placedBlocks) {
    const sx = block.x * TILE_SIZE - camera.x;
    const sy = block.y * TILE_SIZE - camera.y;
    if (sx < -TILE_SIZE || sx > canvas.width || sy < -TILE_SIZE || sy > canvas.height) continue;
    ctx.fillStyle = block.color || '#FF00FF';
    ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }
}

function renderResources() {
  for (const res of gameState.resources) {
    if (res.x < -9000) continue;
    const sx = res.x * TILE_SIZE - camera.x;
    const sy = res.y * TILE_SIZE - camera.y;
    if (sx < -TILE_SIZE || sx > canvas.width || sy < -TILE_SIZE || sy > canvas.height) continue;
    
    ctx.fillStyle = res.color;
    if (res.type === 'tree') {
      ctx.beginPath();
      ctx.moveTo(sx + TILE_SIZE / 2, sy + 2);
      ctx.lineTo(sx + TILE_SIZE - 4, sy + TILE_SIZE - 2);
      ctx.lineTo(sx + 4, sy + TILE_SIZE - 2);
      ctx.fill();
    } else if (res.type.includes('ore')) {
      ctx.beginPath();
      ctx.moveTo(sx + TILE_SIZE / 2, sy + 4);
      ctx.lineTo(sx + TILE_SIZE - 4, sy + TILE_SIZE / 2);
      ctx.lineTo(sx + TILE_SIZE / 2, sy + TILE_SIZE - 4);
      ctx.lineTo(sx + 4, sy + TILE_SIZE / 2);
      ctx.fill();
    } else if (res.type === 'bush') {
      ctx.beginPath();
      ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    if (res.health < res.maxHealth) {
      const hp = res.health / res.maxHealth;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx + 4, sy + TILE_SIZE - 6, TILE_SIZE - 8, 4);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(sx + 4, sy + TILE_SIZE - 6, (TILE_SIZE - 8) * hp, 4);
    }
  }
}

function renderMobs() {
  for (const mob of gameState.mobs) {
    const sx = mob.x * TILE_SIZE - camera.x;
    const sy = mob.y * TILE_SIZE - camera.y;
    if (sx < -TILE_SIZE || sx > canvas.width || sy < -TILE_SIZE || sy > canvas.height) continue;
    
    ctx.fillStyle = mob.color;
    if (mob.type === 'rabbit') {
      ctx.beginPath();
      ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, TILE_SIZE / 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (mob.passive) {
      ctx.fillRect(sx + 6, sy + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    } else {
      ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }
    
    if (mob.health < mob.maxHealth) {
      const hp = mob.health / mob.maxHealth;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx + 4, sy - 6, TILE_SIZE - 8, 4);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(sx + 4, sy - 6, (TILE_SIZE - 8) * hp, 4);
    }
  }
}

function renderBots() {
  for (const bot of gameState.bots) {
    const sx = bot.x * TILE_SIZE - camera.x;
    const sy = bot.y * TILE_SIZE - camera.y;
    if (sx < -TILE_SIZE || sx > canvas.width || sy < -TILE_SIZE || sy > canvas.height) continue;
    
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(sx + 6, sy + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(bot.name?.substring(0, 6) || 'Bot', sx + TILE_SIZE / 2, sy - 4);
  }
}

function renderPlayers() {
  for (const player of Object.values(gameState.players)) {
    if (!player.alive) continue;
    const sx = player.x * TILE_SIZE - camera.x;
    const sy = player.y * TILE_SIZE - camera.y;
    if (sx < -TILE_SIZE || sx > canvas.width || sy < -TILE_SIZE || sy > canvas.height) continue;
    
    const isMe = player.id === socket.id;
    ctx.fillStyle = isMe ? '#00ff00' : '#00aaff';
    if (isMe) { ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 15; }
    ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name?.substring(0, 8) || 'P', sx + TILE_SIZE / 2, sy - 6);
    
    const hp = player.health / player.maxHealth;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx + 4, sy + TILE_SIZE - 2, TILE_SIZE - 8, 3);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(sx + 4, sy + TILE_SIZE - 2, (TILE_SIZE - 8) * hp, 3);
  }
}

function renderParticles() {
  particles = particles.filter(p => {
    p.y -= 0.5;
    p.life--;
    const sx = p.x * TILE_SIZE - camera.x + TILE_SIZE / 2;
    const sy = p.y * TILE_SIZE - camera.y;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 60;
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.text, sx, sy);
    ctx.globalAlpha = 1;
    return p.life > 0;
  });
}

function updateUI() {
  if (!myPlayer) return;
  
  document.getElementById('hp-bar').style.width = (myPlayer.health / myPlayer.maxHealth * 100) + '%';
  document.getElementById('hp-text').textContent = Math.floor(myPlayer.health);
  document.getElementById('hunger-bar').style.width = (myPlayer.hunger / myPlayer.maxHunger * 100) + '%';
  document.getElementById('hunger-text').textContent = Math.floor(myPlayer.hunger);
  document.getElementById('coords').textContent = `X: ${Math.floor(myPlayer.x)} Y: ${Math.floor(myPlayer.y)}`;
  
  if (inventoryOpen) renderInventory();
  if (craftingOpen) renderCrafting();
}

init();
render();