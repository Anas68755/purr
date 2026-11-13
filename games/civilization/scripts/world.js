
// ============================================================
//  منطق المحاكاة الخالص — يعمل في Node.js وفي المتصفح
// ============================================================

export const state = { nextId: 1 };

export const TERRAIN_TYPES = {
  grass:    { color:'#3d5a3d', walkable:true,  food:1.0, ar:'عشب',   decor:['🌿','🌱','🌾','🌼'] },
  forest:   { color:'#244224', walkable:true,  food:0.6, ar:'غابة',  decor:['🌲','🌳','🍄'] },
  water:    { color:'#1e4d6e', walkable:false, food:0.0, ar:'ماء',   decor:['🌊','💧'] },
  mountain: { color:'#5a5a5a', walkable:false, food:0.2, ar:'جبل',   decor:['⛰️','🏔️'] },
  desert:   { color:'#8b7355', walkable:true,  food:0.2, ar:'صحراء', decor:['🌵','🏜️'] },
  hill:     { color:'#4a6b3a', walkable:true,  food:0.7, ar:'تلة',   decor:['⛰️','🌄'] }
};

export const GENE_KEYS = ['strength','intelligence','fertility','longevity','aggression','empathy'];

export const TECHNOLOGIES = [
  { id:'agriculture', name:'الزراعة', icon:'🌾', minGen:50,  cost:80,  effect:'food',      value:25   },
  { id:'bronze',      name:'البرونز', icon:'🔨', minGen:55,  cost:100, effect:'military',  value:0.15 },
  { id:'irrigation',  name:'الري',    icon:'💧', minGen:65,  cost:150, effect:'food',      value:40   },
  { id:'writing',     name:'الكتابة', icon:'📜', minGen:70,  cost:180, effect:'stability', value:15   },
  { id:'iron',        name:'الحديد',  icon:'⚒️', minGen:80,  cost:220, effect:'military',  value:0.30 },
  { id:'medicine',    name:'الطب',    icon:'💊', minGen:90,  cost:280, effect:'health',    value:15   },
  { id:'engineering', name:'الهندسة', icon:'🏗️', minGen:110, cost:400, effect:'popcap',    value:20   },
  { id:'philosophy',  name:'الفلسفة', icon:'🧠', minGen:130, cost:500, effect:'wisdom',    value:20   }
];

export const PALETTE = ['#f56565','#4299e1','#48bb78','#ed8936','#9f7aea','#38b2ac','#ecc94b','#fc8181','#68d391','#63b3ed'];

export const CONFIG = {
  foodPerPerson: 0.6, popCapBase: 45, popCapHard: 70, globalPopMax: 280,
  migrantThreshold: 15, migrantBatch: 8,
  warChance: 0.10, eventChance: 0.04, researchChance: 0.20,
  allianceChance: 0.08, allianceDurationMin: 30, allianceDurationMax: 80,
  allianceTradeBonus: 15, chronicleMax: 100,
  initialPopPerKingdom: 12, initialTilesPerKingdom: 25
};

const rnd = () => Math.random();
const ri  = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const rf  = (a,b) => Math.random()*(b-a)+a;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

const MALE_NAMES   = ['كايل','زيد','طارق','رامي','سامي','عمر','فارس','يوسف','إياد','حمزة','بلال','أنس','مالك','سيف','ياسر','خالد'];
const FEMALE_NAMES = ['ميرا','لينا','سلمى','نور','سارة','هند','ريم','دانة','آية','ليلى','غادة','أمل','رنا','دانا','مها','جنى'];
const KINGDOM_NAMES = ['مملكة الشمال','إمبراطورية العاصمة','قبائل القرية','دولة الجنوب','تحالف الرمال','إمارة النهر','سلالة الشمس','حلف الجبال','عرش الصحراء','دوقية البحر'];

export function randomFullName(sex) {
  const first = pick(sex === 'M' ? MALE_NAMES : FEMALE_NAMES);
  const suffix = pick(['','','','بن','الحكيم','القوي','العادل','الكبير']);
  return suffix ? `${first} ${suffix}` : first;
}
export function randomGenes() {
  const g = {}; for (const k of GENE_KEYS) g[k] = rf(20,80); return g;
}
export function inheritGenes(p1, p2) {
  const g = {};
  for (const k of GENE_KEYS) g[k] = clamp((p1.genes[k]+p2.genes[k])/2 + rf(-12,12), 1, 100);
  return g;
}

// -------- NPC --------
export class NPC {
  constructor(name, sex, genes, kingdomId, generation) {
    this.id = state.nextId++;
    this.name = name; this.sex = sex; this.genes = genes;
    this.kingdomId = kingdomId;
    this.age = 0; this.health = 100; this.alive = true;
    this.generation = generation; this.legacy = 0;
    this.x = 0; this.y = 0; this.tx = 0; this.ty = 0;
    this.parentIds = []; this.childIds = [];
    this.bob = Math.random() * Math.PI * 2;
  }
  maxAge() { return 40 + this.genes.longevity / 2; }
  power() { return (this.genes.strength + this.genes.intelligence + this.genes.empathy + this.genes.aggression)/4 + this.legacy; }
  canReproduce() { return this.alive && this.age >= 16 && this.age <= 45 && this.health > 55; }
  tick(kingdom) {
    this.age++;
    const maxAge = this.maxAge();
    if (this.age > maxAge*0.65) {
      if (rnd() < (this.age - maxAge*0.65)/(maxAge*0.35)*0.35) return this.die('old_age');
    }
    let hp = 6;
    if (kingdom) for (const tid of kingdom.techs) {
      const t = TECHNOLOGIES.find(x=>x.id===tid);
      if (t && t.effect==='health') hp += t.value;
    }
    if (kingdom.food < kingdom.alive().length * 0.8) {
      this.health -= 8; if (this.health <= 0) return this.die('starvation');
    } else this.health = Math.min(100, this.health + hp);
    if (this.age > 18 && this.age < 55)
      this.legacy += (this.genes.strength + this.genes.intelligence + this.genes.empathy)/2500;
    return null;
  }
  die(cause) { this.alive = false; return cause; }
}

// -------- Kingdom --------
export class Kingdom {
  constructor(name, region, color, world) {
    this.id = state.nextId++;
    this.name = name; this.region = region; this.color = color;
    this.world = world;
    this.npcs = []; this.ruler = null;
    this.food = 120; this.stability = 50;
    this.foundedYear = world.year; this.collapsed = false; this.dynastyCount = 0;
    this.techs = [];
    this.tiles = new Set(); this.tileList = []; this.candidates = new Set();
  }
  alive() { return this.npcs.filter(n=>n.alive); }
  adults() { return this.alive().filter(n=>n.age>=16); }
  population() { return this.alive().length; }
  military() {
    const base = this.adults().reduce((s,n)=>s+n.genes.strength*(n.health/100),0);
    let bonus = 0;
    for (const tid of this.techs) { const t = TECHNOLOGIES.find(x=>x.id===tid); if (t && t.effect==='military') bonus += t.value; }
    return base * (1+bonus);
  }
  avgGenes() {
    const a = this.alive(); if (!a.length) return null;
    const g = {}; for (const k of GENE_KEYS) g[k] = a.reduce((s,n)=>s+n.genes[k],0)/a.length;
    return g;
  }
  intelligence() {
    const ag = this.avgGenes(); if (!ag) return 50;
    let b = 0; for (const tid of this.techs) { const t = TECHNOLOGIES.find(x=>x.id===tid); if (t && t.effect==='wisdom') b += t.value; }
    return ag.intelligence + b;
  }
  foodCap() {
    let c = CONFIG.popCapBase + Math.floor(this.intelligence()*0.1);
    for (const tid of this.techs) { const t = TECHNOLOGIES.find(x=>x.id===tid); if (t && t.effect==='popcap') c += t.value; }
    return c;
  }
  foodRegen() {
    let sum = 0;
    for (const {x,y} of this.tileList) sum += TERRAIN_TYPES[this.world.terrain[y][x]].food;
    const int = this.avgGenes() ? this.avgGenes().intelligence : 50;
    let tb = 0; for (const tid of this.techs) { const t = TECHNOLOGIES.find(x=>x.id===tid); if (t && t.effect==='food') tb += t.value; }
    return Math.max(8, sum*0.7 + (int-50)*0.3 + tb);
  }
  pickRuler() {
    const a = this.adults(); if (!a.length) return null;
    return a.reduce((b,n)=>n.power()>b.power()?n:b, a[0]);
  }
  addTile(x, y) {
    const key = `${x},${y}`;
    if (this.tiles.has(key)) return;
    this.tiles.add(key);
    this.tileList.push({x,y});
    this.world.owner[y][x] = this.id;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x+dx, ny = y+dy;
      if (nx<0 || nx>=this.world.W || ny<0 || ny>=this.world.H) continue;
      if (TERRAIN_TYPES[this.world.terrain[ny][nx]].walkable && !this.world.owner[ny][nx])
        this.candidates.add(`${nx},${ny}`);
    }
  }
  tick() {
    this.npcs = this.npcs.filter(n=>n.alive);
    this.food = Math.min(350, this.food + this.foodRegen());
    this.food = Math.max(0, this.food - this.population()*CONFIG.foodPerPerson);
    const nr = this.pickRuler();
    if (nr && nr !== this.ruler) {
      if (this.ruler) { this.world.chronicle(`👑 ${nr.name} يخلف ${this.ruler.name} في حكم ${this.name}`, 'succession'); this.dynastyCount++; }
      else this.world.chronicle(`👑 ${nr.name} أول حاكم لـ${this.name}`, 'founding');
      this.ruler = nr;
    } else if (!nr) this.ruler = null;
    const ag = this.avgGenes();
    if (ag) {
      let sb = 0; for (const tid of this.techs) { const t = TECHNOLOGIES.find(x=>x.id===tid); if (t && t.effect==='stability') sb += t.value; }
      this.stability = clamp((ag.empathy - ag.aggression) + 50 + sb, 0, 100);
    }
    if (this.population() === 0) this.collapsed = true;
  }
}

// -------- World --------
export class World {
  constructor(W = 75, H = 52) {
    this.W = W; this.H = H;
    this.year = 0;
    this.npcs = []; this.kingdoms = [];
    this.alliances = [];
    this.effects = [];
    this.chronicleLog = [];
    this.maxGeneration = 0;
    this.totalWars = 0; this.totalDeaths = 0; this.totalTechs = 0;
    this.usedColors = new Set();
    this.adjacency = {};
    this.terrain = this.generateTerrain();
    this.owner = Array.from({length: H}, () => new Array(W).fill(null));
  }
  generateTerrain() {
    const t = Array.from({length:this.H}, () => new Array(this.W).fill('grass'));
    const blob = (cx,cy,r,type) => {
      const R = r+2;
      for (let y = Math.max(0,cy-R); y <= Math.min(this.H-1,cy+R); y++)
        for (let x = Math.max(0,cx-R); x <= Math.min(this.W-1,cx+R); x++)
          if (Math.hypot(x-cx,y-cy) < r*(0.7+Math.random()*0.4)) t[y][x] = type;
    };
    for (let i=0;i<6; i++) blob(ri(6,this.W-6),ri(6,this.H-6),ri(3,5),'water');
    for (let i=0;i<14;i++) blob(ri(4,this.W-4),ri(4,this.H-4),ri(2,4),'forest');
    for (let i=0;i<5; i++) blob(ri(6,this.W-6),ri(6,this.H-6),ri(2,4),'mountain');
    for (let i=0;i<3; i++) blob(ri(8,this.W-8),ri(8,this.H-8),ri(3,5),'desert');
    for (let i=0;i<10;i++) blob(ri(4,this.W-4),ri(4,this.H-4),ri(2,3),'hill');
    return t;
  }
  nextColor() {
    for (const c of PALETTE) if (!this.usedColors.has(c)) { this.usedColors.add(c); return c; }
    return pick(PALETTE);
  }
  chronicle(text, type='generic') {
    this.chronicleLog.unshift({ year: this.year, text, type });
    if (this.chronicleLog.length > CONFIG.chronicleMax) this.chronicleLog.length = CONFIG.chronicleMax;
  }
  getKingdom(id) { return this.kingdoms.find(k=>k.id===id); }
  totalAlive() { return this.npcs.filter(n=>n.alive).length; }
  findNearestWalkable(cx, cy) {
    for (let r = 0; r < Math.max(this.W,this.H); r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx)!==r && Math.abs(dy)!==r) continue;
          const x = cx+dx, y = cy+dy;
          if (x<0||x>=this.W||y<0||y>=this.H) continue;
          if (TERRAIN_TYPES[this.terrain[y][x]].walkable) return {x,y};
        }
    return null;
  }
  spawnNPC(kingdom, genes=null, age=null) {
    const sex = rnd()<0.5?'M':'F';
    const n = new NPC(randomFullName(sex), sex, genes||randomGenes(), kingdom.id, 0);
    n.age = age !== null ? age : ri(16,32);
    this.placeNPC(n, kingdom);
    kingdom.npcs.push(n); this.npcs.push(n);
    return n;
  }
  placeNPC(n, kingdom) {
    if (!kingdom.tileList.length) { n.x = this.W*6; n.y = this.H*6; return; }
    const t = kingdom.tileList[Math.floor(rnd()*kingdom.tileList.length)];
    n.x = t.x*12 + 6 + rf(-3,3); n.y = t.y*12 + 6 + rf(-3,3);
    n.tx = n.x; n.ty = n.y;
  }
  expandTiles(k, n) {
    if (!k.tileList.length) {
      for (let a = 0; a < 100; a++) {
        const x = ri(2,this.W-3), y = ri(2,this.H-3);
        if (!TERRAIN_TYPES[this.terrain[y][x]].walkable || this.owner[y][x]) continue;
        k.addTile(x,y); break;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!k.candidates.size) break;
      const arr = [...k.candidates];
      const choice = arr[Math.floor(rnd()*arr.length)];
      k.candidates.delete(choice);
      const [x,y] = choice.split(',').map(Number);
      if (this.owner[y][x]) continue;
      k.addTile(x,y);
    }
  }
  foundKingdom(region, initialPop = CONFIG.initialPopPerKingdom) {
    const used = new Set(this.kingdoms.map(k=>k.name));
    const avail = KINGDOM_NAMES.filter(n=>!used.has(n));
    const name = avail.length ? pick(avail) : 'مملكة ' + ri(2,99);
    const k = new Kingdom(name, region, this.nextColor(), this);
    this.kingdoms.push(k);
    for (let i = 0; i < initialPop; i++) this.spawnNPC(k);
    this.expandTiles(k, CONFIG.initialTilesPerKingdom);
    this.chronicle(`🏛️ تأسست ${name} في ${region}`, 'founding');
    return k;
  }
  computeAdjacency() {
    this.adjacency = {};
    for (const k of this.kingdoms) this.adjacency[k.id] = new Set();
    for (const k of this.kingdoms) {
      for (const {x,y} of k.tileList) {
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x+dx, ny = y+dy;
          if (nx<0||nx>=this.W||ny<0||ny>=this.H) continue;
          const o = this.owner[ny][nx];
          if (o && o !== k.id) this.adjacency[k.id].add(o);
        }
      }
    }
  }
  getActiveAlliance(a, b) {
    return this.alliances.find(x => x.expiresYear > this.year && ((x.k1===a&&x.k2===b)||(x.k1===b&&x.k2===a)));
  }
  getAllies(id) {
    return this.alliances.filter(a => a.expiresYear > this.year && (a.k1===id||a.k2===id)).map(a => a.k1===id?a.k2:a.k1);
  }
  formAlliances() {
    for (const k1 of this.kingdoms) {
      if (!k1.ruler) continue;
      const nb = this.adjacency[k1.id] || new Set();
      const c = this.kingdoms.filter(k2 => k2.id!==k1.id && k2.ruler && nb.has(k2.id) && !this.getActiveAlliance(k1.id,k2.id));
      if (!c.length || rnd() >= CONFIG.allianceChance) continue;
      const k2 = pick(c);
      const d = ri(CONFIG.allianceDurationMin, CONFIG.allianceDurationMax);
      this.alliances.push({ k1:k1.id, k2:k2.id, formedYear:this.year, expiresYear:this.year+d });
      this.chronicle(`🤝 تحالف بين ${k1.name} و${k2.name} (${d} سنة)`, 'alliance');
    }
  }
  expireAlliances() {
    for (const a of this.alliances) if (a.expiresYear === this.year) {
      const k1 = this.getKingdom(a.k1), k2 = this.getKingdom(a.k2);
      if (k1 && k2) this.chronicle(`💔 انتهى تحالف ${k1.name} و${k2.name}`, 'alliance-end');
    }
    this.alliances = this.alliances.filter(a => a.expiresYear > this.year);
  }
  researchTechs() {
    for (const k of this.kingdoms) {
      if (!k.ruler) continue;
      const av = TECHNOLOGIES.filter(t => t.minGen <= this.maxGeneration && !k.techs.includes(t.id) && k.food >= t.cost);
      if (!av.length || rnd() >= CONFIG.researchChance) continue;
      const t = pick(av);
      k.food -= t.cost; k.techs.push(t.id); this.totalTechs++;
      this.chronicle(`${t.icon} ${k.name} تكتشف ${t.name}`, 'tech');
    }
  }
  reproduce(k) {
    const alive = k.alive();
    if (alive.length >= k.foodCap() || alive.length >= CONFIG.popCapHard) return;
    if (this.totalAlive() >= CONFIG.globalPopMax || k.food < alive.length*1.2) return;
    const f = alive.filter(n=>n.canReproduce());
    const m = f.filter(n=>n.sex==='M'), fm = f.filter(n=>n.sex==='F');
    if (!m.length || !fm.length) return;
    for (const mother of fm) {
      if (alive.length >= k.foodCap() || this.totalAlive() >= CONFIG.globalPopMax) break;
      const father = pick(m);
      if (rnd() < (mother.genes.fertility + father.genes.fertility)/500) {
        const cg = inheritGenes(mother, father);
        const gen = Math.max(mother.generation, father.generation) + 1;
        if (gen > this.maxGeneration) this.maxGeneration = gen;
        const sex = rnd()<0.5?'M':'F';
        const c = new NPC(randomFullName(sex), sex, cg, k.id, gen);
        c.age = 0;
        c.parentIds = [father.id, mother.id];
        father.childIds.push(c.id);
        mother.childIds.push(c.id);
        this.placeNPC(c, k);
        k.npcs.push(c); this.npcs.push(c);
      }
    }
  }
  startWar() {
    const pairs = [];
    for (let i = 0; i < this.kingdoms.length; i++)
      for (let j = i+1; j < this.kingdoms.length; j++) {
        const a = this.kingdoms[i], b = this.kingdoms[j];
        if (a.military()<10 || b.military()<10) continue;
        if (this.getActiveAlliance(a.id, b.id)) continue;
        pairs.push([a,b]);
      }
    if (!pairs.length) return;
    const [k1, k2] = pick(pairs);
    const m1 = k1.military()*rf(0.8,1.2), m2 = k2.military()*rf(0.8,1.2);
    const winner = m1>m2?k1:k2;
    const wL = Math.floor(k1.adults().length*rf(0.02,0.08));
    const lL = Math.floor(k2.adults().length*rf(0.08,0.20));
    this.killRandom(k1, wL); this.killRandom(k2, lL);
    this.totalWars++;
    this.chronicle(`⚔️ حرب بين ${k1.name} و${k2.name} — انتصرت ${winner.name} (${wL+lL} قتيل)`, 'war');
  }
  killRandom(k, n) {
    const a = k.adults().filter(x=>x.alive);
    for (let i = 0; i < n && a.length; i++) {
      const v = a.splice(Math.floor(rnd()*a.length),1)[0];
      if (v) { v.die('war'); this.totalDeaths++; }
    }
  }
  randomEvent() {
    const k = pick(this.kingdoms); if (!k) return;
    const r = rnd();
    if (r < 0.3) {
      const d = Math.floor(k.alive().length*rf(0.1,0.35));
      this.killRandom(k, d);
      this.chronicle(`☠️ وباء في ${k.name} — ${d} وفاة`, 'war');
    } else if (r < 0.55) {
      k.food += 80; this.chronicle(`🌟 عصر ذهبي في ${k.name}`, 'founding');
    } else if (r < 0.75) {
      k.stability = Math.max(0, k.stability-25);
      this.chronicle(`🔥 اضطرابات في ${k.name}`, 'collapse');
    } else {
      const b = k.alive().filter(n=>n.age<=3)[0];
      if (b) {
        for (const g of GENE_KEYS) b.genes[g] = clamp(b.genes[g]+15,1,100);
        this.chronicle(`✨ وُلد ${b.name} بمواهب استثنائية`, 'legend');
      }
    }
  }
  spawnMigrants() {
    for (let i = 0; i < CONFIG.migrantBatch; i++) {
      const k = pick(this.kingdoms); if (!k) return;
      const sex = rnd()<0.5?'M':'F';
      const n = new NPC(randomFullName(sex)+' المهاجر', sex, randomGenes(), k.id, 0);
      n.age = ri(16,35);
      this.placeNPC(n, k);
      k.npcs.push(n); this.npcs.push(n);
    }
    this.chronicle(`🚶 وصل مهاجرون جدد`, 'founding');
  }
  findNewKingdomCenter() {
    let best = null, bs = -1;
    for (let i = 0; i < 200; i++) {
      const x = ri(3,this.W-4), y = ri(3,this.H-4);
      if (!TERRAIN_TYPES[this.terrain[y][x]].walkable || this.owner[y][x]) continue;
      let minD = Infinity;
      for (const k of this.kingdoms) {
        const c = k.tileList[0];
        if (c) minD = Math.min(minD, Math.hypot(x-c.x,y-c.y));
      }
      if (minD > bs) { bs = minD; best = {x,y}; }
    }
    return best;
  }
  tick() {
    this.year++;
    for (const n of this.npcs) {
      if (!n.alive) continue;
      const k = this.getKingdom(n.kingdomId);
      if (!k) { n.alive = false; continue; }
      if (n.tick(k)) this.totalDeaths++;
    }
    for (const k of this.kingdoms) this.reproduce(k);
    for (const k of this.kingdoms) k.tick();
    for (const k of this.kingdoms) {
      const p = k.population(); if (!p) continue;
      const mt = Math.max(20, p*4);
      if (k.tileList.length < mt) this.expandTiles(k, Math.min(Math.floor(p/5)+1, mt-k.tileList.length));
    }
    this.computeAdjacency();
    for (const k of this.kingdoms) {
      const al = this.getAllies(k.id);
      if (al.length) k.food = Math.min(350, k.food + CONFIG.allianceTradeBonus*al.length);
    }
    this.researchTechs();
    this.formAlliances();
    this.expireAlliances();
    for (const k of this.kingdoms) if (k.collapsed) {
      this.chronicle(`💀 سقطت ${k.name} بعد ${this.year-k.foundedYear} سنة`, 'collapse');
      this.usedColors.delete(k.color);
      for (const {x,y} of k.tileList) if (this.owner[y]) this.owner[y][x] = null;
      this.alliances = this.alliances.filter(a => a.k1!==k.id && a.k2!==k.id);
    }
    this.kingdoms = this.kingdoms.filter(k => !k.collapsed);
    if (this.kingdoms.length < 4) {
      const c = this.findNewKingdomCenter();
      if (c) {
        const used = new Set(this.kingdoms.map(k=>k.name));
        const av = KINGDOM_NAMES.filter(n=>!used.has(n));
        const name = av.length ? pick(av) : 'مملكة ' + ri(2,99);
        const k = new Kingdom(name, 'east', this.nextColor(), this);
        this.kingdoms.push(k);
        this.expandTiles(k, 5);
        for (let i = 0; i < 8; i++) this.spawnNPC(k);
        this.chronicle(`🏛️ تأسست ${name} من جديد`, 'founding');
      }
    }
    if (rnd() < CONFIG.warChance && this.kingdoms.length >= 2) this.startWar();
    if (rnd() < CONFIG.eventChance) this.randomEvent();
    if (this.totalAlive() < CONFIG.migrantThreshold) this.spawnMigrants();
    if (this.year % 15 === 0) this.npcs = this.npcs.filter(n=>n.alive);
  }
}

// ============================================================
//                       التسلسل
// ============================================================
export const SAVE_VERSION = 3;

export function serializeWorld(world) {
  return {
    version: SAVE_VERSION,
    year: world.year,
    terrain: world.terrain,
    owner: world.owner,
    nextId: state.nextId,
    maxGeneration: world.maxGeneration,
    totalWars: world.totalWars,
    totalDeaths: world.totalDeaths,
    totalTechs: world.totalTechs,
    usedColors: [...world.usedColors],
    chronicleLog: world.chronicleLog.slice(0, 80),
    alliances: world.alliances.slice(),
    npcs: world.npcs.filter(n=>n.alive).map(n => ({
      id: n.id, name: n.name, sex: n.sex, genes: n.genes,
      kingdomId: n.kingdomId, age: n.age, health: n.health,
      generation: n.generation, legacy: n.legacy,
      x: n.x, y: n.y, tx: n.tx, ty: n.ty,
      parentIds: n.parentIds, childIds: n.childIds
    })),
    kingdoms: world.kingdoms.map(k => ({
      id: k.id, name: k.name, region: k.region, color: k.color,
      food: k.food, stability: k.stability,
      foundedYear: k.foundedYear, collapsed: k.collapsed,
      dynastyCount: k.dynastyCount, techs: k.techs.slice(),
      rulerId: k.ruler ? k.ruler.id : null,
      npcIds: k.npcs.filter(n=>n.alive).map(n=>n.id),
      tiles: k.tileList.slice()
    }))
  };
}

export function deserializeWorld(data) {
  const w = new World();
  w.terrain = data.terrain;
  w.owner = data.owner;
  w.year = data.year;
  w.maxGeneration = data.maxGeneration || 0;
  w.totalWars = data.totalWars || 0;
  w.totalDeaths = data.totalDeaths || 0;
  w.totalTechs = data.totalTechs || 0;
  w.usedColors = new Set(data.usedColors || []);
  w.chronicleLog = data.chronicleLog || [];
  w.alliances = data.alliances || [];
  state.nextId = data.nextId || 1;

  const npcMap = {};
  for (const nd of data.npcs) {
    const n = new NPC(nd.name, nd.sex, nd.genes, nd.kingdomId, nd.generation);
    n.id = nd.id;
    n.age = nd.age; n.health = nd.health; n.legacy = nd.legacy;
    n.x = nd.x; n.y = nd.y; n.tx = nd.tx; n.ty = nd.ty;
    n.parentIds = nd.parentIds || [];
    n.childIds  = nd.childIds  || [];
    n.bob = Math.random() * Math.PI * 2;
    npcMap[nd.id] = n;
    w.npcs.push(n);
  }

  for (const kd of data.kingdoms) {
    const k = new Kingdom(kd.name, kd.region, kd.color, w);
    k.id = kd.id;
    k.food = kd.food; k.stability = kd.stability;
    k.foundedYear = kd.foundedYear; k.collapsed = kd.collapsed;
    k.dynastyCount = kd.dynastyCount; k.techs = kd.techs.slice();
    for (const {x,y} of kd.tiles) k.addTile(x,y);
    for (const id of kd.npcIds) { const n = npcMap[id]; if (n) k.npcs.push(n); }
    if (kd.rulerId && npcMap[kd.rulerId]) k.ruler = npcMap[kd.rulerId];
    w.kingdoms.push(k);
  }

  for (const n of w.npcs) {
    for (const pid of n.parentIds) {
      const p = npcMap[pid];
      if (p && !p.childIds.includes(n.id)) p.childIds.push(n.id);
    }
  }
  return w;
}

// ============================================================
//                    إنشاء عالم جديد
// ============================================================
export function createInitialWorld() {
  const w = new World();
  const positions = [
    { px:0.20, py:0.22 }, { px:0.80, py:0.22 },
    { px:0.20, py:0.78 }, { px:0.80, py:0.78 }
  ];
  for (const pos of positions) {
    const cx = Math.floor(w.W*pos.px), cy = Math.floor(w.H*pos.py);
    const c = w.findNearestWalkable(cx, cy);
    if (!c) continue;
    const used = new Set(w.kingdoms.map(k=>k.name));
    const av = KINGDOM_NAMES.filter(n=>!used.has(n));
    const name = av.length ? pick(av) : 'مملكة ' + ri(2,99);
    const k = new Kingdom(name, 'east', w.nextColor(), w);
    k.addTile(c.x, c.y);
    w.kingdoms.push(k);
    w.expandTiles(k, CONFIG.initialTilesPerKingdom);
    for (let i = 0; i < CONFIG.initialPopPerKingdom; i++) w.spawnNPC(k);
    w.chronicle(`🏛️ تأسست ${name}`, 'founding');
  }
  return w;
}
