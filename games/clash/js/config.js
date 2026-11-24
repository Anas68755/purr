// Game data: buildings, troops, spells, leagues, obstacles, achievements
// Building fields: s=size in tiles, hp, c=base cost, t=build seconds (x level), max=max level
//   dmg/rng/rate=defense stats, sp=splash, air=anti-air only, ramp=damage ramps up, trap=hidden trap
const DEF={
th:{n:'Town Hall',s:4,e:'🏰',hp:900,c:1000,t:20,max:8},
gm:{n:'Gold Mine',s:3,e:'⛏️',hp:300,c:150,t:6,max:7,rate:60,pr:'g',res:1},
ec:{n:'Elixir Pump',s:3,e:'💧',hp:300,c:150,t:6,max:7,rate:60,pr:'e',res:1},
gs:{n:'Gold Vault',s:3,e:'💰',hp:550,c:300,t:8,max:7,cap:2500,res:1},
es:{n:'Elixir Vault',s:3,e:'🛢️',hp:550,c:300,t:8,max:7,cap:2500,res:1},
cn:{n:'Cannon',s:2,e:'💣',hp:380,c:250,t:8,max:7,dmg:14,rng:5.5,rate:.8,def:1},
at:{n:'Archer Tower',s:2,e:'🗼',hp:340,c:400,t:10,max:7,dmg:10,rng:7.5,rate:.6,def:1},
mo:{n:'Mortar',s:2,e:'💥',hp:300,c:800,t:14,max:6,dmg:30,rng:9,rate:3,min:2,sp:1,def:1},
ad:{n:'Air Defense',s:2,e:'🚀',hp:420,c:900,t:14,max:5,dmg:45,rng:8,rate:1.2,def:1,air:1},
wt:{n:'Wizard Tower',s:2,e:'🔮',hp:420,c:1100,t:14,max:5,dmg:26,rng:6.5,rate:1.3,sp:1,def:1},
it:{n:'Inferno Tower',s:2,e:'🔥',hp:620,c:1800,t:18,max:5,dmg:9,rng:7,rate:.2,ramp:1,def:1},
bm:{n:'Bomb',s:1,e:'💣',hp:60,c:200,t:4,max:5,dmg:120,trap:1},
wl:{n:'Wall',s:1,e:'',hp:220,c:40,t:0,max:7},
cp:{n:'Army Camp',s:3,e:'⛺',hp:300,c:400,t:10,max:5},
br:{n:'Barracks',s:3,e:'⚔️',hp:450,c:500,t:10,max:5},
lb:{n:'Laboratory',s:3,e:'🔬',hp:500,c:1500,t:15,max:5},
cc:{n:'Clan Castle',s:3,e:'🏯',hp:800,c:1000,t:12,max:4},
bh:{n:"Builder's Hut",s:2,e:'🏚️',hp:250,c:600,t:5,max:1}};
const COL={th:'#8a6a2a',gm:'#7a6a2a',ec:'#6a3a7a',gs:'#8a7a3a',es:'#5a3a6a',cn:'#4a4a4a',at:'#5a3a22',mo:'#3a4a4a',ad:'#7a3a3a',wt:'#5a3a8a',it:'#7a2a1a',bm:'#222',wl:'#9a9a9a',cp:'#3a5a7a',br:'#8a3a2a',lb:'#4a7a7a',cc:'#6a7a8a',bh:'#6a4a2a'};
// Shop categories (order shown in the Build menu)
const CATS=[['💰 Economy',['gm','ec','gs','es']],['🛡️ Defense',['cn','at','mo','ad','wt','it','bm','wl']],['⚔️ Military',['cp','br','lb','cc','bh']]];

// Troops: hp, dmg (per hit, 1 hit/s), sp=speed, rng=range, h=housing, c=elixir, tt=train seconds,
//   pf=preferred target (d=defenses r=resources w=walls), fly, sp2=splash, rs=damage taken multiplier,
//   heal=hp healed per pulse (no attack), hero=free hero joining every raid (ab=ability, unl=Town Hall needed)
const TR={
ba:{n:'Barbarian',e:'🗡️',hp:45,dmg:9,sp:1.7,rng:.9,h:1,c:25,tt:5},
ar:{n:'Archer',e:'🏹',hp:22,dmg:8,sp:1.9,rng:5,h:1,c:50,tt:6},
gi:{n:'Giant',e:'🦍',hp:340,dmg:13,sp:1.1,rng:.9,h:5,c:250,tt:20,pf:'d'},
go:{n:'Goblin',e:'👺',hp:28,dmg:11,sp:2.8,rng:.9,h:1,c:40,tt:7,pf:'r'},
wb:{n:'Wall Breaker',e:'💀',hp:20,dmg:35,sp:2,rng:.9,h:2,c:150,tt:12,pf:'w'},
wz:{n:'Wizard',e:'🧙',hp:70,dmg:40,sp:1.6,rng:4.5,h:4,c:400,tt:24,sp2:1},
dr:{n:'Dragon',e:'🐉',hp:900,dmg:60,sp:2.2,rng:3.5,h:20,c:2500,tt:60,fly:1,sp2:1},
pk:{n:'P.E.K.K.A',e:'🤖',hp:1100,dmg:130,sp:1.15,rng:.9,h:14,c:1800,tt:50,rs:.75},
hl:{n:'Healer',e:'😇',hp:160,dmg:0,heal:38,sp:2,rng:3,h:6,c:700,tt:36,fly:1},
mi:{n:'Minion',e:'😈',hp:55,dmg:19,sp:3.1,rng:1.5,h:2,c:110,tt:9,fly:1},
ki:{n:'Barbarian King',e:'👑',hp:1400,dmg:55,sp:1.5,rng:1,h:0,c:0,hero:1,ab:'rage',unl:1},
aq:{n:'Archer Queen',e:'👸',hp:700,dmg:55,sp:1.7,rng:5,h:0,c:0,hero:1,ab:'cloak',unl:2}};
const SP={li:{n:'Lightning',e:'⚡',c:300,tt:40},he:{n:'Heal',e:'💚',c:250,tt:40},ra:{n:'Rage',e:'😡',c:350,tt:40}};

// Leagues: trophies needed (at) and one-time rank-up bonus (r gold + r elixir)
const LG=[{n:'Bronze',e:'🥉',at:0,r:0},{n:'Silver',e:'🥈',at:100,r:1500},{n:'Gold',e:'🥇',at:300,r:4000},{n:'Crystal',e:'💎',at:600,r:10000}];

// Obstacles on your map: c=gold to clear (grows with Town Hall), xp reward
const OB={tr:{n:'Tree',s:1,e:'🌲',c:60,xp:12},rk:{n:'Rock',s:2,e:'🪨',c:180,xp:35}};

// Achievements: id, name, description, current value, goal, gold reward.  (First five kept from v1.)
const AC=[];
const A=(id,n,d,v,g,r)=>AC.push({id,n,d,v,g,r});
const ST=k=>(S.st&&S.st[k])||0, lgI=()=>{let i=0;LG.forEach((l,j)=>{if(S.tr>=l.at)i=j});return i};
A('w1','First Blood','Win 1 battle',()=>ST('w'),1,300);
A('w5','Conqueror','Win 5 battles',()=>ST('w'),5,1500);
A('s20','Star Collector','Earn 20 stars',()=>ST('s'),20,2000);
A('l20','Plunderer','Loot 20,000 resources',()=>ST('l'),20000,2500);
A('th3','Castle Builder','Reach Town Hall 3',()=>th(),3,1000);
A('w25','Warlord','Win 25 battles',()=>ST('w'),25,4000);
A('s3','Triple Crown','Win 5 battles with 3 stars',()=>ST('s3'),5,2500);
A('dst','Demolition Crew','Destroy 200 buildings',()=>ST('dst'),200,2500);
A('tk','Master Trainer','Train 50 troops',()=>ST('tk'),50,1500);
A('up','Master Builder','Finish 10 builds or upgrades',()=>ST('up'),10,1200);
A('pk','Heavy Metal','Train a P.E.K.K.A',()=>ST('t_pk'),1,1000);
A('hl','Field Medic','Train 5 Healers',()=>ST('t_hl'),5,1200);
A('lg1','Silver Lining','Reach Silver League',()=>lgI(),1,1000);
A('lg2','Golden Age','Reach Gold League',()=>lgI(),2,3000);
A('lg3','Crystal Clear','Reach Crystal League',()=>lgI(),3,8000);
A('rr','Iron Walls','Repel 3 raids on your village',()=>ST('rr'),3,1500);
A('ob','Land Clearer','Clear 10 obstacles',()=>ST('ob'),10,1000);
A('ha','Royal Orders','Use hero abilities 5 times',()=>ST('ha'),5,1000);
A('it','Hot Stuff','Build an Inferno Tower',()=>S.b.filter(b=>b.t=='it'&&b.l>0).length,1,1500);
A('qc','Quest Master','Claim 10 daily quests',()=>ST('qc'),10,1500);
A('cm5','Campaigner','Clear 5 campaign villages',()=>(S.cp||[]).filter(x=>x>0).length,5,3000);
A('cm10','Warlord of the Realm','Clear all 10 campaign villages',()=>(S.cp||[]).filter(x=>x>0).length,10,8000);
A('lv10','Veteran','Reach XP level 10',()=>S.lv||1,10,2000);
A('th8','Kingdom Come','Reach Town Hall 8',()=>th(),8,6000);

// PNG sprite loader (assets/*.png); drawing falls back to emoji if an image is missing
const IMG={},ok=i=>i&&i.complete&&i.naturalWidth>0;
['b_th','b_gm','b_ec','b_gs','b_es','b_cn','b_at','b_mo','b_ad','b_cp','b_bh','b_wl','b_lb','b_cc','b_br','b_wt','b_it','b_bm','o_tr','o_rk','rub','grass']
.concat(Object.keys(TR).map(k=>'t_'+k)).forEach(k=>{const i=new Image();i.src='assets/'+k+'.png';IMG[k]=i});
