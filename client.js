const socket = io({ reconnection: true, reconnectionDelay: 1000 });

// ============================================
// КОНСТАНТЫ
// ============================================
const TILE_SIZE = 32;
let mapWidth = 2000, mapHeight = 2000;

// ============================================
// СОСТОЯНИЕ
// ============================================
let canvas, ctx;
let gameState = { players: {}, bots: [], resources: [], mobs: [] };
let myPlayer = null;
let gameInitialized = false;
let recipes = {};
let camera = { x: 0, y: 0 };
const keys = {};
let inventoryOpen = false;
let craftingOpen = false;
let particles = [];
let damageTexts = [];

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
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
  });
  
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  
  document.getElementById('eat-btn')?.addEventListener('click', () => socket.emit('eat'));
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ============================================
// ПОДКЛЮЧЕНИЕ
// ============================================
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));

socket.on('init', (data) => {
  myPlayer = data.player;
  mapWidth = data.mapWidth;
  mapHeight = data.mapHeight;
  recipes = data.recipes;
  gameInitialized = true;
  console.log('Game started!');
});

socket.on('update', (data) => {
  gameState.players = data.players;
  gameState.bots = data.bots;
  gameState.resources = data.resources;
  gameState.mobs = data.mobs;
  
  if (myPlayer && gameState.players[socket.id]) {
    myPlayer = gameState.players[socket.id];
  }
});

socket.on('craftResult', (data) => {
  if (data.success) {
    addParticle(myPlayer?.x || 0, myPlayer?.y || 0, 'Крафт: ' + data.item, '#00ff00');
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

function renderInventory() {
  const inv = document.getElementById('inventory-panel');
  if (!inv || !myPlayer) return;
  
  const items = [
    { name: 'wood', label: 'Дерево', color: '#1a3d1a' },
    { name: 'stone', label: 'Камень', color: '#8a8a8a' },
    { name: 'iron', label: 'Железо', color: '#8b6914' },
    { name: 'gold', label: 'Золото', color: '#ffd700' },
    { name: 'diamond', label: 'Алмаз', color: '#00ffff' },
    { name: 'food', label: 'Еда', color: '#ff6600' },
  ];
  
  let html = '<h3>Инвентарь</h3><div class="inv-grid">';
  for (const item of items) {
    const count = myPlayer.inventory[item.name] || 0;
    html += `<div class="inv-slot"><div class="inv-color" style="background:${item.color}"></div><span>${item.label}: ${count}</span></div>`;
  }
  html += '</div>';
  
  const weapon = myPlayer.equipment.weapon ? recipes[myPlayer.equipment.weapon]?.name || myPlayer.equipment.weapon : 'Нет';
  const armor = myPlayer.equipment.armor ? recipes[myPlayer.equipment.armor]?.name || myPlayer.equipment.armor : 'Нет';
  const tool = myPlayer.equipment.tool ? recipes[myPlayer.equipment.tool]?.name || myPlayer.equipment.tool : 'Нет';
  
  html += `<div class="equipment"><h4>Экипировка</h4>
    <div>Оружие: ${weapon}</div>
    <div>Броня: ${armor}</div>
    <div>Инструмент: ${tool}</div></div>`;
  
  html += '<button onclick="toggleCrafting()">Верстак</button>';
  html += '<button onclick="toggleInventory()">Закрыть</button>';
  
  inv.innerHTML = html;
  inv.style.display = inventoryOpen ? 'block' : 'none';
}

function renderCrafting() {
  const panel = document.getElementById('crafting-panel');
  if (!panel || !myPlayer) return;
  
  let html = '<h3>Верстак</h3><div class="craft-grid">';
  
  for (const [key, recipe] of Object.entries(recipes)) {
    let canCraft = true;
    let mats = '';
    for (const [mat, cnt] of Object.entries(recipe.materials)) {
      const has = myPlayer.inventory[mat] || 0;
      mats += `${mat}: ${has}/${cnt} `;
      if (has < cnt) canCraft = false;
    }
    
    const color = canCraft ? '#4a4' : '#a44';
    html += `<div class="craft-item" style="border-color:${color}" onclick="craft('${key}')">
      <div>${recipe.name}</div>
      <div class="craft-mats">${mats}</div>
    </div>`;
  }
  
  html += '</div><button onclick="toggleCrafting()">Назад</button>';
  panel.innerHTML = html;
  panel.style.display = craftingOpen ? 'block' : 'none';
}

function craft(recipe) {
  socket.emit('craft', { recipe });
  setTimeout(() => renderCrafting(), 100);
}

// ============================================
// ЭФФЕКТЫ
// ============================================
function addParticle(x, y, text, color) {
  particles.push({ x, y, text, color, life: 60, vy: -1 });
}

function addDamageText(x, y, damage) {
  damageTexts.push({ x, y, damage, life: 40 });
}

function updateParticles() {
  particles = particles.filter(p => {
    p.y += p.vy;
    p.life--;
    return p.life > 0;
  });
  
  damageTexts = damageTexts.filter(d => {
    d.y -= 1;
    d.life--;
    return d.life > 0;
  });
}

function renderParticles() {
  for (const p of particles) {
    const sx = p.x * TILE_SIZE - camera.x + TILE_SIZE / 2;
    const sy = p.y * TILE_SIZE - camera.y;
    ctx.fillStyle = p.color;
    ctx.font = '14px Arial';
    ctx.globalAlpha = p.life / 60;
    ctx.fillText(p.text, sx, sy);
    ctx.globalAlpha = 1;
  }
  
  for (const d of damageTexts) {
    const sx = d.x * TILE_SIZE - camera.x + TILE_SIZE / 2;
    const sy = d.y * TILE_SIZE - camera.y;
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 16px Arial';
    ctx.globalAlpha = d.life / 40;
    ctx.fillText('-' + d.damage, sx, sy - 20);
    ctx.globalAlpha = 1;
  }
}

// ============================================
// ВВОД
// ============================================
function handleInput() {
  if (!myPlayer || !myPlayer.alive) return;
  
  if (keys['w']) socket.emit('move', { direction: 'up' });
  if (keys['s']) socket.emit('move', { direction: 'down' });
  if (keys['a']) socket.emit('move', { direction: 'left' });
  if (keys['d']) socket.emit('move', { direction: 'right' });
}

// ============================================
// ОТРИСОВКА
// ============================================
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
  updateParticles();
  
  if (myPlayer) {
    camera.x = myPlayer.x * TILE_SIZE - canvas.width / 2 + TILE_SIZE / 2;
    camera.y = myPlayer.y * TILE_SIZE - canvas.height / 2 + TILE_SIZE / 2;
  }
  
  renderMap();
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
  if (dist < 300) return { type: 0, color: '#2d5a27' };
  if (dist < 600) return { type: 1, color: '#4a7c3f' };
  if (dist < 900) return { type: 2, color: '#d4a574' };
  return { type: 3, color: '#6b6b6b' };
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
    
    // HP бар
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
    if (isMe) {
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 15;
    }
    ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name?.substring(0, 8) || 'P', sx + TILE_SIZE / 2, sy - 6);
    
    // HP игрока
    const hp = player.health / player.maxHealth;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx + 4, sy + TILE_SIZE - 2, TILE_SIZE - 8, 3);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(sx + 4, sy + TILE_SIZE - 2, (TILE_SIZE - 8) * hp, 3);
  }
}

function updateUI() {
  if (!myPlayer) return;
  
  document.getElementById('hp-bar').style.width = (myPlayer.health / myPlayer.maxHealth * 100) + '%';
  document.getElementById('hp-text').textContent = Math.floor(myPlayer.health);
  
  document.getElementById('hunger-bar').style.width = (myPlayer.hunger / myPlayer.maxHunger * 100) + '%';
  document.getElementById('hunger-text').textContent = Math.floor(myPlayer.hunger);
  
  document.getElementById('food-count').textContent = myPlayer.inventory.food || 0;
  document.getElementById('coords').textContent = `X: ${Math.floor(myPlayer.x)} Y: ${Math.floor(myPlayer.y)}`;
  
  if (inventoryOpen) renderInventory();
  if (craftingOpen) renderCrafting();
}

// ============================================
// ЗАПУСК
// ============================================
init();
render();