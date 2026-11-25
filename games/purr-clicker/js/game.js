
(function(){
  // ---------- USER ID & RNG ----------
  let userId = localStorage.getItem('purrUserId');
  if(!userId){ userId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now().toString(36); localStorage.setItem('purrUserId',userId); }
  function mulberry32(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }
  function hashStr(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return h>>>0; }
  const rng = mulberry32(hashStr(userId));
  const FIRST=['Mochi','Biscuit','Walnut','Caramel','Toffee','Brownie','Hazel','Cocoa','Fudge','Truffle','Cinnamon','Maple','Mocha','Chestnut','Pecan'];
  const LAST=['Pawsworth','Barkley','Crumbleton','von Floof','McWhiskers','Tabbington','Nubbins','Clawsworth','Pouncington','Furball'];
  const TRAITS=['loves knocking things off shelves','judges you silently','always sits on the warmest spot','has a secret stash of bottle caps','zooms at 3am','plots world domination','knows you\'re faking sleep','steals food from the counter','climbs everything','scratches the furniture'];
  document.getElementById('catNameTag').textContent = FIRST[Math.floor(rng()*FIRST.length)]+' '+LAST[Math.floor(rng()*LAST.length)];
  document.getElementById('catTrait').textContent = '"'+TRAITS[Math.floor(rng()*TRAITS.length)]+'"';
  const personalMult = 1 + rng()*0.15;
  
  // ---------- EVOLUTIONS (100 stages, astronomical thresholds) ----------
  const EVOLUTIONS = [];
  for(let i=0; i<100; i++){
    let threshold = i===0 ? 0 : Math.pow(10, (i-1)*0.35 + 1);
    let name = i===0 ? 'Kitten' : 
               i===1 ? 'Junior' :
               i===2 ? 'Lounger' :
               i===3 ? 'Wanderer' :
               i===4 ? 'Hunter' :
               i===5 ? 'Midnight' :
               i===6 ? 'Ember' :
               i===7 ? 'Phantom' :
               i===8 ? 'Celestial' :
               i===9 ? 'Ancient One' :
               i===10 ? 'Star Eater' :
               i===15 ? 'Galactic Paw' :
               i===20 ? 'Nova Claw' :
               i===25 ? 'Void Purr' :
               i===30 ? 'Infinity Fur' :
               i===35 ? 'Transcendent Meow' :
               i===40 ? 'Omni Cat' :
               i===45 ? 'One Who Purrs' :
               i===50 ? 'The Eternal Floof' :
               i===55 ? 'God of Clicks' :
               i===60 ? 'Cosmic Overlord' :
               i===65 ? 'Universe Weaver' :
               i===70 ? 'Paradox Claw' :
               i===75 ? 'Absolute Being' :
               i===80 ? 'The Final Purr' :
               i===85 ? 'Beyond Infinity' :
               i===90 ? 'The Unnamed' :
               i===95 ? 'The One Above All' : `Ascended ${i}`;
    EVOLUTIONS.push({name:name, threshold:Math.floor(threshold)});
  }
  // ensure last thresholds are huge
  for(let i=90; i<100; i++) EVOLUTIONS[i].threshold = Math.pow(10, (i-30)*0.8 + 10);
  EVOLUTIONS[99].threshold = 1e500;
  
  // ---------- HELPERS (25 total, sorted by cost) ----------
  const BUILDINGS_RAW = [
    {id:'nap',name:'Napping Spot',icon:'😴',desc:'Sunny window ledge.',baseCost:15,baseCps:0.1},
    {id:'yarn',name:'Yarn Ball',icon:'🧶',desc:'Endless entertainment.',baseCost:100,baseCps:0.5},
    {id:'bowl',name:'Food Bowl',icon:'🍲',desc:'Keeps energy high.',baseCost:500,baseCps:2},
    {id:'tree',name:'Cat Tree',icon:'🌳',desc:'Prime surveillance.',baseCost:2000,baseCps:7},
    {id:'box',name:'Cardboard Box',icon:'📦',desc:'Best present ever.',baseCost:8000,baseCps:20},
    {id:'laser',name:'Laser Pointer',icon:'🔴',desc:'Infinite energy.',baseCost:30000,baseCps:60},
    {id:'fish',name:'Fish Pond',icon:'🐟',desc:'Personal seafood.',baseCost:100000,baseCps:200},
    {id:'catnip',name:'Catnip Garden',icon:'🌿',desc:'Legal substances.',baseCost:400000,baseCps:666},
    {id:'realm',name:'Parallel Realm',icon:'🌀',desc:'Cats know about this.',baseCost:2e6,baseCps:2000},
    {id:'coffee',name:'Cat Coffee',icon:'☕',desc:'Brews motivation.',baseCost:1e7,baseCps:5000},
    {id:'mouse',name:'Mouse Factory',icon:'🐭',desc:'Toy production line.',baseCost:5e7,baseCps:15000},
    {id:'statue',name:'Golden Statue',icon:'🗿',desc:'Worshiped by cats.',baseCost:2.5e8,baseCps:50000},
    {id:'portal',name:'Cat Portal',icon:'🌌',desc:'Infinite dimension.',baseCost:1e9,baseCps:200000},
    {id:'nebula',name:'Nebula Feeder',icon:'🌠',desc:'Cosmic energy.',baseCost:5e9,baseCps:1e6},
    {id:'singularity',name:'Purr Singularity',icon:'⚫',desc:'Attracts everything.',baseCost:3e10,baseCps:5e6},
    {id:'tesseract',name:'Tesseract Box',icon:'📐',desc:'Fourth dimensional fun.',baseCost:2e11,baseCps:2.5e7},
    {id:'cosmicEgg',name:'Cosmic Egg',icon:'🥚',desc:'Contains a universe.',baseCost:1.5e12,baseCps:1e8},
    {id:'dreamWeaver',name:'Dream Weaver',icon:'🕸️',desc:'Harvests dreams.',baseCost:1e13,baseCps:5e8},
    {id:'timeless',name:'Timeless Clock',icon:'⏳',desc:'Cats ignore time.',baseCost:8e13,baseCps:2.5e9},
    {id:'infinityStone',name:'Infinity Stone',icon:'💎',desc:'Unlimited purrs.',baseCost:5e14,baseCps:1e10},
    {id:'voidEngine',name:'Void Engine',icon:'🕳️',desc:'Consumes reality.',baseCost:2e15,baseCps:5e10},
    {id:'cosmicForge',name:'Cosmic Forge',icon:'⚒️',desc:'Forges stars.',baseCost:1e16,baseCps:2e11},
    {id:'dreamCatcher',name:'Dream Catcher',icon:'🌀',desc:'Catches infinite dreams.',baseCost:5e16,baseCps:1e12},
    {id:'paradoxCore',name:'Paradox Core',icon:'⚛️',desc:'Breaks logic.',baseCost:2e17,baseCps:5e12},
    {id:'absoluteZero',name:'Absolute Zero',icon:'❄️',desc:'Freezes time.',baseCost:1e18,baseCps:2e13}
  ];
  const BUILDINGS = BUILDINGS_RAW.sort((a,b)=>a.baseCost - b.baseCost);
  
  // ---------- ONE-TIME UPGRADES (50, sorted by cost) ----------
  const UPGRADES_RAW = [
    {id:'sharpclaws',name:'Sharp Claws',icon:'🗡️',desc:'+2× click power',cost:100,mult:2,type:'click'},
    {id:'fluffcoat',name:'Fluff Coat',icon:'🪮',desc:'+3× click power',cost:500,mult:3,type:'click'},
    {id:'catnap',name:'Power Nap',icon:'💤',desc:'+2× all production',cost:2000,mult:2,type:'cps'},
    {id:'fangs',name:'Fangs',icon:'🦷',desc:'+5× click power',cost:10000,mult:5,type:'click'},
    {id:'purrmotor',name:'Purr Motor',icon:'⚙️',desc:'+3× all production',cost:50000,mult:3,type:'cps'},
    {id:'midnight',name:'Night Vision',icon:'👁️',desc:'+10× click power',cost:200000,mult:10,type:'click'},
    {id:'starpaws',name:'Star Paws',icon:'⭐',desc:'+5× all production',cost:1e6,mult:5,type:'cps'},
    {id:'cosmicfur',name:'Cosmic Fur',icon:'🌌',desc:'+50× click power',cost:5e6,mult:50,type:'click'},
    {id:'lasereyes',name:'Laser Eyes',icon:'👁️‍🗨️',desc:'+2× click power',cost:8000,mult:2,type:'click'},
    {id:'ninja',name:'Ninja Reflexes',icon:'🥷',desc:'+3× click power',cost:25000,mult:3,type:'click'},
    {id:'lucky',name:'Lucky Charm',icon:'🍀',desc:'+2× all production',cost:40000,mult:2,type:'cps'},
    {id:'ancient',name:'Ancient Wisdom',icon:'📜',desc:'+4× all production',cost:150000,mult:4,type:'cps'},
    {id:'catnipOD',name:'Catnip Overdose',icon:'🌿💨',desc:'+8× click power',cost:300000,mult:8,type:'click'},
    {id:'quantum',name:'Quantum Pounce',icon:'⚛️',desc:'+15× click power',cost:1.2e6,mult:15,type:'click'},
    {id:'purrsonance',name:'Purr Resonance',icon:'🎵',desc:'+7× all production',cost:2.5e6,mult:7,type:'cps'},
    {id:'infinite',name:'Infinite Treats',icon:'🍬',desc:'+20× click power',cost:8e6,mult:20,type:'click'},
    {id:'multiverse',name:'Multiverse Collar',icon:'🌌',desc:'+12× all production',cost:2e7,mult:12,type:'cps'},
    {id:'godly',name:'Godly Whiskers',icon:'👼',desc:'+50× click power',cost:6e7,mult:50,type:'click'},
    {id:'cosmicpurr',name:'Cosmic Purr',icon:'🌠',desc:'+25× all production',cost:1.5e8,mult:25,type:'cps'},
    {id:'omnipotent',name:'Omnipotent Meow',icon:'🐱💫',desc:'+100× click power',cost:5e8,mult:100,type:'click'},
    {id:'voidclaw',name:'Void Claw',icon:'🕳️',desc:'+200× click power',cost:2e9,mult:200,type:'click'},
    {id:'temporal',name:'Temporal Shift',icon:'⏰',desc:'+50× all production',cost:1e10,mult:50,type:'cps'},
    {id:'singularityClick',name:'Singularity Click',icon:'💥',desc:'+500× click power',cost:5e10,mult:500,type:'click'},
    {id:'galacticPurr',name:'Galactic Purr',icon:'🌌',desc:'+100× all production',cost:2e11,mult:100,type:'cps'},
    {id:'celestialPaw',name:'Celestial Paw',icon:'⭐',desc:'+1,500× click power',cost:1e12,mult:1500,type:'click'},
    {id:'ethereal',name:'Ethereal Fur',icon:'✨',desc:'+250× all production',cost:5e12,mult:250,type:'cps'},
    {id:'infiniteClick',name:'Infinite Click',icon:'♾️',desc:'+5,000× click power',cost:2e13,mult:5000,type:'click'},
    {id:'dreamEater',name:'Dream Eater',icon:'😴',desc:'+1,000× all production',cost:1e14,mult:1000,type:'cps'},
    {id:'realityBender',name:'Reality Bender',icon:'🌀',desc:'+20,000× click power',cost:5e14,mult:20000,type:'click'},
    {id:'transcendent',name:'Transcendent',icon:'🙏',desc:'+5,000× all production',cost:2.5e15,mult:5000,type:'cps'},
    {id:'omniClick',name:'Omni Click',icon:'💢',desc:'+100,000× click power',cost:1e16,mult:100000,type:'click'},
    {id:'universeCat',name:'Universe Cat',icon:'🌍',desc:'+20,000× all production',cost:5e16,mult:20000,type:'cps'},
    {id:'multiversal',name:'Multiversal',icon:'🌎🌍🌏',desc:'+500,000× click power',cost:2.5e17,mult:500000,type:'click'},
    {id:'godClick',name:'God Click',icon:'👑',desc:'+2,000,000× click power',cost:1e18,mult:2e6,type:'click'},
    {id:'primordial',name:'Primordial Purr',icon:'🔥',desc:'+200,000× all production',cost:5e18,mult:200000,type:'cps'},
    {id:'eternalClaw',name:'Eternal Claw',icon:'⚡',desc:'+10,000,000× click power',cost:2.5e19,mult:1e7,type:'click'},
    {id:'infinityCps',name:'Infinity Engine',icon:'♾️',desc:'+1,000,000× all production',cost:1e20,mult:1e6,type:'cps'},
    {id:'clickGod',name:'Click God',icon:'👁️',desc:'+1e9× click power',cost:5e20,mult:1e9,type:'click'},
    {id:'beyond',name:'Beyond Infinity',icon:'🌌💫',desc:'+1e12× click power',cost:1e22,mult:1e12,type:'click'},
    {id:'ultimatePurr',name:'Ultimate Purr',icon:'🐱🔱',desc:'+1e15× all production',cost:5e22,mult:1e15,type:'cps'},
    {id:'creatorPaw',name:'Creator Paw',icon:'✋',desc:'+1e18× click power',cost:1e24,mult:1e18,type:'click'},
    {id:'alphaOmega',name:'Alpha & Omega',icon:'🕉️',desc:'+1e21× all production',cost:5e24,mult:1e21,type:'cps'},
    {id:'purrfect',name:'Purrfect Click',icon:'😸',desc:'+1e24× click power',cost:1e26,mult:1e24,type:'click'},
    {id:'godUltimate',name:'Ultimate God',icon:'🐉',desc:'+1e30× all production',cost:1e30,mult:1e30,type:'cps'},
    {id:'infinitePower',name:'Infinite Power',icon:'⚡∞',desc:'+1e50× click power',cost:1e40,mult:1e50,type:'click'},
    {id:'beyondGod',name:'Beyond God',icon:'👾',desc:'+1e100× all production',cost:1e60,mult:1e100,type:'cps'},
    {id:'catGod',name:'Cat God',icon:'🐱👑',desc:'+1e200× click power',cost:1e80,mult:1e200,type:'click'},
    {id:'theOne',name:'The One Who Purrs',icon:'🌟',desc:'+1e300× all production',cost:1e100,mult:1e300,type:'cps'}
  ];
  const ONCE_UPGRADES = UPGRADES_RAW.sort((a,b)=>a.cost - b.cost);
  
  // ---------- COMPANIONS (15, sorted by cost) ----------
  const COMPANIONS_RAW = [
    {id:'tabby',name:'Tabby Tutor',icon:'🐈',desc:'+2× clicks & production',cost:250,clickMult:2,cpsMult:2,duration:30},
    {id:'siamese',name:'Siamese Sage',icon:'🐱',desc:'+4× clicks',cost:1200,clickMult:4,cpsMult:1,duration:30},
    {id:'maine',name:'Maine Coon',icon:'🦁',desc:'+5× production',cost:5000,clickMult:1,cpsMult:5,duration:30},
    {id:'void',name:'Void Cat',icon:'🐈‍⬛',desc:'+8× clicks & +2× prod',cost:25000,clickMult:8,cpsMult:2,duration:30},
    {id:'rainbow',name:'Rainbow Cat',icon:'🌈',desc:'+6× all + coin attraction',cost:100000,clickMult:6,cpsMult:6,duration:30},
    {id:'phoenix',name:'Phoenix Cat',icon:'🔥',desc:'+15× clicks & +10× prod',cost:500000,clickMult:15,cpsMult:10,duration:30},
    {id:'ghost',name:'Ghost Cat',icon:'👻',desc:'+30× clicks',cost:2e6,clickMult:30,cpsMult:1,duration:30},
    {id:'dragon',name:'Dragon Cat',icon:'🐉',desc:'+50× production',cost:1e7,clickMult:1,cpsMult:50,duration:30},
    {id:'angel',name:'Angel Cat',icon:'😇',desc:'+100× all',cost:5e7,clickMult:100,cpsMult:100,duration:30},
    {id:'cosmic',name:'Cosmic Cat',icon:'🌌',desc:'+500× clicks & +500× prod',cost:2.5e8,clickMult:500,cpsMult:500,duration:30},
    {id:'voidLord',name:'Void Lord',icon:'🕳️',desc:'+2,000× clicks',cost:1e9,clickMult:2000,cpsMult:1,duration:30},
    {id:'starMaker',name:'Star Maker',icon:'⭐',desc:'+5,000× production',cost:5e9,clickMult:1,cpsMult:5000,duration:30},
    {id:'dreamWeaver',name:'Dream Weaver Cat',icon:'✨',desc:'+20,000× all',cost:2e10,clickMult:20000,cpsMult:20000,duration:30},
    {id:'realityBenderCat',name:'Reality Bender',icon:'🌀',desc:'+100,000× clicks & prod',cost:1e11,clickMult:100000,cpsMult:100000,duration:30},
    {id:'godCompanion',name:'God Companion',icon:'🐱👑',desc:'+1,000,000× all',cost:5e11,clickMult:1e6,cpsMult:1e6,duration:30}
  ];
  const COMPANIONS = COMPANIONS_RAW.sort((a,b)=>a.cost - b.cost);
  
  // ---------- RANDOM EVENTS ----------
  const EVENTS = [
    {msg:'🐟 Stray cat brings you a fish!',effect:()=>{ G.purrs += 500*G.cpsMult; updateUI(); },icon:'🐟'},
    {msg:'📦 Cardboard box appears! Bonus!',effect:()=>{ G.purrs += Math.floor(1000*G.cpsMult); updateUI(); },icon:'📦'},
    {msg:'⚡ Meteor shower! 30 sec double production!',effect:()=>{ startTempBuff('cps',2,30); },icon:'⚡'},
    {msg:'💰 Treasure chest! +5000 purrs!',effect:()=>{ G.purrs += 5000; updateUI(); },icon:'💰'},
    {msg:'🐾 Lucky paw! 3× clicks for 20 sec!',effect:()=>{ startTempBuff('click',3,20); },icon:'🐾'},
  ];
  
  // ---------- GAME STATE ----------
  let G = {
    purrs:0, totalPurrs:0, clickPower:1, cps:0, buildings:{}, owned:{}, evoIndex:0, clickMult:1, cpsMult:1,
    activeCompanion: null, companionEndTime:0,
    tempClickBuff:1, tempCpsBuff:1, tempBuffEnd:0,
  };
  try{ const s = localStorage.getItem('purrSaveInf'); if(s) Object.assign(G, JSON.parse(s)); }catch(e){}
  let resetting=false, lastSave=0;
  function save(force){
    const now=Date.now();
    if(resetting||(!force&&now-lastSave<5000)) return;
    lastSave=now; G.lastSeen=now;
    try{ localStorage.setItem('purrSaveInf', JSON.stringify(G)); }catch(e){}
  }
  addEventListener('pagehide',()=>save(true));
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(true); });
  
  function buildingCost(b){ return Math.floor(b.baseCost * Math.pow(1.15, G.buildings[b.id]||0)); }
  function buildingCps(b){ return (G.buildings[b.id]||0)*b.baseCps*G.cpsMult*personalMult; }
  function totalCps(){ return BUILDINGS.reduce((s,b)=>s+buildingCps(b),0); }
  function getClickPower(){ return Math.floor(G.clickMult * personalMult * G.tempClickBuff); }
  function getCpsMult(){ return G.cpsMult * G.tempCpsBuff; }
  function startTempBuff(type, mult, durationSec){
    if(type==='click'){ G.tempClickBuff = mult; G.tempBuffEnd = Date.now() + durationSec*1000; }
    else if(type==='cps'){ G.tempCpsBuff = mult; G.tempBuffEnd = Date.now() + durationSec*1000; }
    setTimeout(()=>{ if(Date.now()>=G.tempBuffEnd){ G.tempClickBuff=1; G.tempCpsBuff=1; updateUI(); toast('✨ Buff expired!'); } }, durationSec*1000);
    updateUI();
  }
  function checkTempBuff(){ if(G.tempBuffEnd && Date.now()>G.tempBuffEnd){ G.tempClickBuff=1; G.tempCpsBuff=1; G.tempBuffEnd=0; updateUI(); } }
  
  function activateCompanion(c){
    if(G.activeCompanion && Date.now()<G.companionEndTime){ toast('Another companion is already active!'); return; }
    if(G.purrs < c.cost){ toast(`Need ${fmtNum(c.cost)} purrs!`); return; }
    G.purrs -= c.cost;
    G.activeCompanion = c.id;
    G.companionEndTime = Date.now() + c.duration*1000;
    G.clickMult *= c.clickMult;
    G.cpsMult *= c.cpsMult;
    updateUI();
    toast(`✨ ${c.name} appears! +${c.clickMult}x clicks, +${c.cpsMult}x production for ${c.duration}s`);
    playSfx();
    setTimeout(()=>{
      if(G.activeCompanion===c.id){
        G.clickMult /= c.clickMult;
        G.cpsMult /= c.cpsMult;
        G.activeCompanion = null;
        updateUI();
        toast(`😿 ${c.name} left... buffs are gone.`);
      }
    }, c.duration*1000);
    buildCompanionPanel();
  }
  
  let nextEventTime = Date.now() + 45000 + Math.random()*45000;
  setInterval(()=>{
    if(!document.hasFocus()) return;
    if(Date.now()>=nextEventTime){
      const ev = EVENTS[Math.floor(Math.random()*EVENTS.length)];
      ev.effect();
      toast(ev.msg);
      playSfx();
      nextEventTime = Date.now() + 45000 + Math.random()*45000;
    }
  }, 5000);
  
  function buildUpgradePanel(){
    const list=document.getElementById('onceList'); list.innerHTML='';
    ONCE_UPGRADES.forEach(u=>{
      const owned=G.owned[u.id];
      let btn=document.createElement('button');
      btn.className='once-btn'+(owned?'':(G.purrs>=u.cost?' affordable':''));
      btn.disabled=!!owned;
      btn.innerHTML=`<div class="once-icon">${u.icon}</div><div class="once-info"><div class="once-name">${u.name}</div><div class="once-desc">${u.desc}</div><div class="once-cost">${owned?'✓ owned':fmtNum(u.cost)+' purrs'}</div></div>`;
      if(!owned) btn.onclick=()=>buyOnce(u);
      list.appendChild(btn);
    });
  }
  function buildBuildingPanel(){
    const list=document.getElementById('buildingList'); list.innerHTML='';
    BUILDINGS.forEach(b=>{
      let cost=buildingCost(b), owned=G.buildings[b.id]||0, cps=buildingCps(b);
      let btn=document.createElement('button');
      btn.className='upg-btn'+(G.purrs>=cost?' affordable':'');
      btn.innerHTML=`<div class="upg-icon">${b.icon}</div><div class="upg-info"><div class="upg-name">${b.name}</div><div class="upg-desc">${b.desc}</div><div class="upg-cost">${fmtNum(cost)} purrs</div><div style="font-size:.6rem;color:var(--paw);">Owned: ${owned} (+${fmtNum(cps,2)}/s)</div></div>`;
      btn.onclick=()=>buyBuilding(b);
      list.appendChild(btn);
    });
  }
  function buildCompanionPanel(){
    const list=document.getElementById('companionList'); list.innerHTML='';
    COMPANIONS.forEach(c=>{
      let btn=document.createElement('button');
      btn.className='once-btn'+(G.purrs>=c.cost?' affordable':'');
      btn.innerHTML=`<div class="once-icon">${c.icon}</div><div class="once-info"><div class="once-name">${c.name}</div><div class="once-desc">${c.desc}</div><div class="once-cost">${fmtNum(c.cost)} purrs</div></div>`;
      btn.onclick=()=>activateCompanion(c);
      list.appendChild(btn);
    });
  }
  let panelSig='';
  function refreshPanels(){
    const compBusy=!!(G.activeCompanion&&Date.now()<G.companionEndTime);
    const sig=ONCE_UPGRADES.map(u=>G.owned[u.id]?2:G.purrs>=u.cost?1:0).join('')+'|'+
      BUILDINGS.map(b=>(G.buildings[b.id]||0)+(G.purrs>=buildingCost(b)?'y':'n')).join(',')+'|'+
      COMPANIONS.map(c=>G.purrs>=c.cost?1:0).join('')+compBusy;
    if(sig!==panelSig){ panelSig=sig; buildUpgradePanel(); buildBuildingPanel(); buildCompanionPanel(); }
    let canUpg = ONCE_UPGRADES.some(u=>!G.owned[u.id]&&G.purrs>=u.cost);
    let canHelp = BUILDINGS.some(b=>G.purrs>=buildingCost(b));
    let canComp = COMPANIONS.some(c=>G.purrs>=c.cost && (!G.activeCompanion || Date.now()>=G.companionEndTime));
    document.getElementById('badge-upgrades').classList.toggle('show',canUpg);
    document.getElementById('badge-helpers').classList.toggle('show',canHelp);
    document.getElementById('badge-companions').classList.toggle('show',canComp);
  }
  function buyBuilding(b){
    let cost = buildingCost(b);
    if(G.purrs<cost){ toast(`Need ${fmtNum(cost)} purrs!`); return; }
    G.purrs -= cost;
    G.buildings[b.id] = (G.buildings[b.id]||0)+1;
    buildBuildingPanel(); refreshPanels();
    toast(`${b.icon} ${b.name} added!`); playSfx();
  }
  function buyOnce(u){
    if(G.owned[u.id]) return;
    if(G.purrs<u.cost){ toast(`Need ${fmtNum(u.cost)} purrs!`); return; }
    G.purrs -= u.cost; G.owned[u.id]=true;
    if(u.type==='click') G.clickMult *= u.mult;
    else G.cpsMult *= u.mult;
    buildUpgradePanel(); refreshPanels();
    toast(`✨ ${u.name} unlocked!`); playSfx();
  }
  function updateUI(){
    checkTempBuff();
    document.getElementById('counterMain').textContent = fmtNum(Math.floor(G.purrs));
    document.getElementById('hdrTotal').textContent = fmtNum(Math.floor(G.totalPurrs));
    const cps = totalCps() * getCpsMult();
    document.getElementById('counterCps').textContent = `+${fmtNum(cps,1)}/s`;
    document.getElementById('hdrCps').textContent = fmtNum(cps,1);
    const evo = EVOLUTIONS[G.evoIndex];
    document.getElementById('evoBadge').textContent = evo.name;
    document.getElementById('evoStage').textContent = evo.name;
    const next = EVOLUTIONS[G.evoIndex+1];
    if(next){
      let pct = Math.min(100, ((G.totalPurrs-evo.threshold)/(next.threshold-evo.threshold))*100);
      document.getElementById('evoFill').style.width = pct+'%';
      document.getElementById('evoCur').textContent = fmtNum(G.totalPurrs-evo.threshold);
      document.getElementById('evoNext').textContent = fmtNum(next.threshold-evo.threshold);
    } else { document.getElementById('evoFill').style.width='100%'; document.getElementById('evoCur').textContent='MAX'; document.getElementById('evoNext').textContent=''; }
    if(G.activeCompanion && Date.now()<G.companionEndTime){
      let comp = COMPANIONS.find(c=>c.id===G.activeCompanion);
      if(comp) document.getElementById('activeCompanionMsg').innerHTML = `⭐ Active: ${comp.name} (${Math.ceil((G.companionEndTime-Date.now())/1000)}s left)`;
      else document.getElementById('activeCompanionMsg').innerHTML = '';
    } else document.getElementById('activeCompanionMsg').innerHTML = '';
    refreshPanels();
  }
  function checkEvolution(){
    let newIdx=0;
    for(let i=EVOLUTIONS.length-1;i>=0;i--) if(G.totalPurrs>=EVOLUTIONS[i].threshold){ newIdx=i; break; }
    if(newIdx!==G.evoIndex){ G.evoIndex=newIdx; toast(`🎉 Evolved to ${EVOLUTIONS[newIdx].name}!`); playSfx(); updateUI(); }
  }
  
  const catEmoji = document.getElementById('catEmoji');
  catEmoji.addEventListener('pointerdown',e=>{
    e.preventDefault();
    let earn = Math.max(1, Math.floor(getClickPower()));
    G.purrs += earn; G.totalPurrs += earn;
    playSfx();
    catEmoji.style.transform = 'scale(0.92)';
    setTimeout(()=>{ catEmoji.style.transform = 'scale(1)'; }, 100);
    let rect=catEmoji.getBoundingClientRect();
    let x = (e.clientX||e.touches?.[0]?.clientX||rect.left+rect.width/2) - rect.left;
    let y = (e.clientY||e.touches?.[0]?.clientY||rect.top+rect.height/2) - rect.top;
    let ripple = document.createElement('div');
    ripple.className='ripple'; ripple.style.left=x+'px'; ripple.style.top=y+'px'; ripple.style.width='30px'; ripple.style.height='30px';
    catEmoji.parentElement.appendChild(ripple); setTimeout(()=>ripple.remove(),400);
    let particle=document.createElement('div'); particle.style.position='absolute'; particle.style.left=(rect.left+x-30)+'px'; particle.style.top=(rect.top+y-30)+'px'; particle.style.fontSize='1.3rem'; particle.textContent='+'+fmtNum(earn); particle.style.pointerEvents='none'; particle.style.fontWeight='bold'; particle.style.color='var(--cream)'; particle.style.textShadow='0 0 6px #ffaa44'; particle.style.animation='float 0.9s ease-out forwards'; document.body.appendChild(particle); setTimeout(()=>particle.remove(),1000);
    checkEvolution(); updateUI();
  });
  
  let audioCtx=null, musicOn=false, musicNodes=[], arpInt,bassInt,ambInt;
  const SCALES=[[261.63,293.66,329.63,349.23,392.00,440.00,493.88,523.25],[293.66,329.63,369.99,392.00,440.00,493.88,554.37,587.33],[261.63,293.66,311.13,349.23,392.00,415.30,466.16,523.25],[220.00,246.94,261.63,293.66,329.63,349.23,392.00,440.00]];
  function getScale(){ let idx=Math.min(G.evoIndex,SCALES.length-1); return SCALES[idx]; }
  function note(freq,start,dur,vol,type='square'){ if(!audioCtx)return; let osc=audioCtx.createOscillator(), gain=audioCtx.createGain(); osc.connect(gain); gain.connect(audioCtx.destination); osc.type=type; osc.frequency.value=freq; gain.gain.setValueAtTime(vol,start); gain.gain.exponentialRampToValueAtTime(0.01,start+dur); osc.start(start); osc.stop(start+dur); const nd={osc,gain}; musicNodes.push(nd); osc.onended=()=>{ musicNodes=musicNodes.filter(x=>x!==nd); try{osc.disconnect();gain.disconnect();}catch(e){} }; }
  function arp(){ if(!audioCtx||!musicOn)return; let sc=getScale(); let now=audioCtx.currentTime; [0,2,4,7,4,2,0,4].forEach((si,i)=>note(sc[si%sc.length],now+i*0.13,0.18,0.045,'square')); }
  function bass(){ if(!audioCtx||!musicOn)return; let sc=getScale(); let now=audioCtx.currentTime; [0,0,4,3].forEach((i,idx)=>note(sc[i]*0.5,now+idx*0.42,0.38,0.05,'sawtooth')); }
  function amb(){ if(!audioCtx||!musicOn)return; let sc=getScale(); let now=audioCtx.currentTime; [0,2,4].forEach(si=>{ note(sc[si]*0.5,now,1.8,0.012,'sine'); }); }
  function startMusic(){ if(musicOn) return; if(!audioCtx){ audioCtx=new(window.AudioContext||window.webkitAudioContext)(); } if(audioCtx.state==='suspended') audioCtx.resume(); musicOn=true; arpInt=setInterval(arp,1040); bassInt=setInterval(bass,1680); ambInt=setInterval(amb,3360); }
  function stopMusic(){ musicOn=false; clearInterval(arpInt);clearInterval(bassInt);clearInterval(ambInt); musicNodes.forEach(n=>{ try{ n.osc.stop(); n.osc.disconnect(); n.gain.disconnect(); }catch(e){} }); musicNodes=[]; syncMusicBtn(); }
  function playSfx(){ if(audioCtx && musicOn) note(880, audioCtx.currentTime, 0.1, 0.08, 'square'); }
  const btnMusic=document.getElementById('btnMusic');
  const syncMusicBtn=()=>{ btnMusic.textContent=musicOn?'🔊':'🔇'; };
  btnMusic.onclick=()=>{ if(musicOn) stopMusic(); else startMusic(); try{localStorage.setItem('purrMusicPref',musicOn?'on':'off');}catch(e){} syncMusicBtn(); };
  document.getElementById('btnReset').onclick=()=>{ if(confirm('Reset game? All progress lost!')){ resetting=true; localStorage.removeItem('purrSaveInf'); location.reload(); } };
  
  let lastTick=Date.now();
  setInterval(()=>{ let now=Date.now(), dt=(now-lastTick)/1000; lastTick=now; let earn = totalCps() * getCpsMult() * dt; if(earn>0){ G.purrs+=earn; G.totalPurrs+=earn; checkEvolution(); updateUI(); } save(); }, 100);
  function toast(msg){ let el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2500); }
  function fmtNum(n,dec=0){ if(n>=1e15){ const S=['Qa','Qi','Sx','Sp','Oc','No','Dc']; let i=-1; while(n>=1e3&&i<S.length-1){ n/=1e3; i++; } return (n/1e3).toFixed(1)+S[Math.max(0,i)]; } if(n>=1e12) return (n/1e12).toFixed(1)+'T'; if(n>=1e9) return (n/1e9).toFixed(1)+'B'; if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e3) return (n/1e3).toFixed(1)+'K'; if(dec>0) return n.toFixed(dec); return Math.floor(n).toString(); }
  
  document.querySelectorAll('.tab-bar-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const target=btn.dataset.tab;
      document.querySelectorAll('.tab-bar-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(target).classList.add('active');
      if(target==='tab-upgrades') document.getElementById('badge-upgrades').classList.remove('show');
      if(target==='tab-helpers') document.getElementById('badge-helpers').classList.remove('show');
      if(target==='tab-companions') document.getElementById('badge-companions').classList.remove('show');
    });
  });
  
  function init(){
    buildUpgradePanel(); buildBuildingPanel(); buildCompanionPanel();
    updateUI();
    refreshPanels();
    let pref=null; try{pref=localStorage.getItem('purrMusicPref');}catch(e){}
    syncMusicBtn();
    if(pref!=='off'){ // browsers block audio until the first tap
      const first=()=>{ if(!musicOn&&localStorage.getItem('purrMusicPref')!=='off'){ startMusic(); syncMusicBtn(); } };
      addEventListener('pointerdown',first,{once:true});
    }
    // offline progress: up to 2 hours of passive income
    if(G.lastSeen){
      const secs=Math.min((Date.now()-G.lastSeen)/1000,7200), gain=totalCps()*getCpsMult()*secs;
      if(gain>=1){ G.purrs+=gain; G.totalPurrs+=gain; checkEvolution(); updateUI(); toast(`😺 While you were away: +${fmtNum(gain)} purrs`); }
    }
  }
  init();
})();
