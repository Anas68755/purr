// Home village UI: build, upgrade, panels. (Pointer input lives in view.js)
function bar(h){$('bar').innerHTML=h}
function P(h,k){$('pn').innerHTML=h;$('pn').style.display='block';PK=k||null}
function closeP(){$('pn').style.display='none';PK=null}
function tile(e){const r=C.getBoundingClientRect();return[(e.clientX-r.left)*N/r.width,(e.clientY-r.top)*N/r.height]}
const at=(p,q)=>S.b.find(b=>p>=b.x&&p<b.x+DEF[b.t].s&&q>=b.y&&q<b.y+DEF[b.t].s);
const snap=(d,p,q)=>[Math.max(0,Math.min(N-d.s,p-(d.s>>1))),Math.max(0,Math.min(N-d.s,q-(d.s>>1)))];
// A tap (not a drag/pinch) on the map at tile coordinates fx,fy
function onTap(fx,fy){const p=Math.floor(fx),q=Math.floor(fy);ptr=[fx,fy];
if(BT)return deploy(fx,fy);
if(mode=='place'){const[x,y]=snap(DEF[place],p,q);return doPlace(x,y)}
if(mode=='move'){const[x,y]=snap(DEF[sel.t],p,q);if(!free(x,y,DEF[sel.t].s,sel))return toast('Spot is taken');sel.x=x;sel.y=y;mode=null;save();return toast('Moved')}
if(cartFull()&&p>=1&&p<3&&q>=26&&q<28)return cart();
const b=at(p,q);if(b){sel=b;if(DEF[b.t].rate&&b.st>=1)collect(b);info(b.id)}
else{const o=obAt(p,q);if(o){sel=null;obInfo(o)}else{sel=null;closeP()}}}
function shop(){closeP();let h='<h3>🏗️ Build</h3>';
CATS.forEach(([nm,ks])=>{h+=`<p style="color:var(--gold);margin:8px 0 0">${nm}</p>`;ks.forEach(t=>{const d=DEF[t],n=S.b.filter(b=>b.t==t).length,L=lim(t),c=cost(t,1);
h+=`<div class=r><span>${ic('b_'+t)} ${d.n} <small>${L?n+'/'+L:'🔒 TH'+unlockTH(t)}</small></span><button ${n>=L||S.g<c?'disabled':''} onclick="pick('${t}')">💰 ${c}</button></div>`})});
P(h+'<button onclick="closeP()">Close</button>')}
function pick(t){place=t;mode='place';closeP();toast('Tap the map to place '+DEF[t].n)}
function doPlace(x,y){const t=place,d=DEF[t],c=cost(t,1),inst=!d.t||d.trap;
if(S.b.filter(b=>b.t==t).length>=lim(t))return toast('Limit reached'),mode=null;
if(S.g<c)return toast('Not enough gold'),mode=null;
if(!inst&&busy()>=builders())return toast('All builders busy');
if(!free(x,y,d.s))return toast('Spot is taken');
S.g-=c;S.b.push({id:Date.now()+Math.random(),t,x,y,l:inst?1:0,hp:hpOf(t,1),up:inst?0:now()+d.t*1000,st:0});
prog('bld',1);snd('place');puff(x+d.s/2,y+d.s,5,d.s*.6);
if(t!='wl'&&t!='bm')mode=null;save();hud()}
function info(id){const b=gb(id),d=DEF[b.t],up=b.up>now();let h=`<h3>${ic('b_'+b.t)} ${d.n} · Lv ${b.l}</h3><p>`;
if(d.rate&&!d.trap&&b.t!='bm'&&d.pr)h+=`Makes ${d.rate*b.l}/min · stored ${Math.floor(b.st)} `;
if(d.trap)h+=`Hidden bomb: ${Math.round(d.dmg*(1+.35*(b.l-1)))} damage to ground troops in a 2-tile blast. Also hurts raiders on your village. `;
else if(d.dmg)h+=`Damage ${Math.round(d.dmg*(1+.3*(b.l-1)))}${d.ramp?' (ramps up to ×4.6 on one target)':''} · range ${d.rng}${d.air?' · air only':b.t=='cn'||b.t=='mo'?' · ground only':''} `;
if(d.cap)h+=`Storage +${d.cap*b.l} `;if(b.t=='cp')h+=`Army space +${10*b.l} `;
if(b.t=='br')h+=`Trains 1 item at a time, ${Math.round(25*(b.l-1))}% faster than base `;h+='</p>';
if(up){const r=Math.ceil((b.up-now())/1000);h+=`<p>⏳ ${r}s left</p><button onclick="fin(${b.id})">⚡ Finish now (💰${Math.ceil(r*2)})</button> `}
else if(b.l<maxL(b.t)){const n=b.l+1;h+=`<button onclick="upg(${b.id})">⬆ Upgrade 💰${cost(b.t,n)} · ${d.t*n}s</button> `}
else if(b.l>=maxL(b.t))h+='<p>Max level for your Town Hall.</p>';
if(d.rate&&b.st>=1)h+=`<button onclick="collect(gb(${b.id}));closeP()">Collect</button> `;
if(b.t!='th')h+=`<button onclick="mv(${b.id})">✥ Move</button> <button onclick="sell(${b.id})">🗑 Sell (+${Math.round(cost(b.t,Math.max(b.l,1))/2)})</button>`;
if(b.t=='lb'&&b.l)h+=' <button onclick="lab()">🔬 Research</button>';if(b.t=='cc'&&b.l)h+=' <button onclick="ccp()">🏰 Troops</button>';if(b.t=='br'&&b.l)h+=' <button onclick="army()">⚔️ Train</button>';P(h+' <button onclick="closeP()">✕</button>')}
function upg(id){const b=gb(id),n=b.l+1,c=cost(b.t,n);if(S.g<c)return toast('Not enough gold');if(busy()>=builders())return toast('All builders busy — build a Builder\'s Hut');
S.g-=c;b.up=now()+DEF[b.t].t*n*1000;toast('Upgrading '+DEF[b.t].n);prog('bld',1);snd('place');info(id);hud();save()}
function fin(id){const b=gb(id);if(!b||!(b.up>now()))return closeP();   // already finished (stale panel): nothing to buy
const c=Math.max(1,Math.ceil((b.up-now())/500));if(S.g<c)return toast('Not enough gold');S.g-=c;b.up=now();tick();closeP()}
function mv(id){sel=gb(id);mode='move';closeP();toast('Tap the new spot')}
function sell(id){const b=gb(id);S.g+=Math.round(cost(b.t,Math.max(b.l,1))/2);S.b=S.b.filter(x=>x!==b);closeP();save()}
function collect(b){const d=DEF[b.t],s0=b.st,a=add(d.pr,Math.floor(b.st));b.st-=a;if(a){toast('+'+a+(d.pr=='g'?' 💰':' 💧'));prog('col',a);snd('coin');spark(b.x+d.s/2,b.y+d.s/2,d.pr=='g'?'#ffd34d':'#e07bff',9)}else toast('Storage full — upgrade vaults');hud()}
function collectAll(){S.b.forEach(b=>{if(DEF[b.t].rate&&b.st>=1)collect(b)});save()}
function help(){closeP();P('<h3>❓ How to play</h3><p>Tap ❗ mines to collect. Build and upgrade with 💰 (builders limit parallel upgrades). Train troops at your ⚔️ Barracks with 💧 — training takes time, and you can pay 💰 to speed it up. Then Attack: pick a village, choose a troop, tap the map to deploy (×5 deploys five at once).</p><p>Troops walk through gaps in walls and only break a wall when it is the shortest way in. Giants hit defenses, Goblins resources, Wall Breakers walls. Dragons, Minions and Healers fly. Heroes join every attack: 👑 Rage and 👸 Royal Cloak (Town Hall 2) abilities have their own buttons. Spells: ⚡ damages, 💚 heals, 😡 boosts.</p><p>Clear 🌲 trees and 🪨 rocks for XP. Raiders attack when your shield is down — 📼 shows how they got in. Pinch or use ＋/－ to zoom the map.</p><button onclick="closeP()">Got it</button>')}
function chest(){const t=now();if((S.ch||0)>t)return toast('Chest opens in '+Math.ceil((S.ch-t)/1000)+'s');S.ch=t+120000;const g=300+Math.floor(Math.random()*400)*th(),e=300+Math.floor(Math.random()*400)*th();add('g',g);add('e',e);toast('🎁 +'+g+' 💰 +'+e+' 💧');snd('coin');hud();save()}
function homeBar(){bar('<button onclick="shop()">🏗️ Build</button><button onclick="army()">⚔️ Army</button><button onclick="startBattle()">🗡️ Attack</button><button onclick="collectAll()">🧺 Collect</button><button class=sm onclick="cart()" title="Loot Cart">🛒</button><button class=sm onclick="chest()" title="Chest">🎁</button><button class=sm onclick="ach()" title="Achievements">🏅</button><button class=sm onclick="campaign()" title="Campaign">🗺️</button><button class=sm onclick="quests()" title="Daily quests">📜</button><button class=sm onclick="leagues()" title="Leagues">🏆</button><button class=sm onclick="replays()" title="Defense replays">📼</button><button class=sm onclick="help()" title="Help">❓</button>')}
function exportSave(){const t=btoa(unescape(encodeURIComponent(JSON.stringify(S))));(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Save copied to clipboard'),()=>prompt('Copy your save:',t))}
function importSave(){const t=prompt('Paste save code:');if(!t)return;try{const o=JSON.parse(decodeURIComponent(escape(atob(t))));if(!o.b)throw 0;S=o;migrate();save();toast('Save loaded');closeP()}catch(e){toast('Invalid save')}}
function lab(){closeP();const lv=S.b.find(b=>b.t=='lb'&&b.l),cap=lv?lv.l:0;let h='<h3>🔬 Laboratory Lv '+cap+'</h3><p>Each level: +25% HP and damage. Max troop level = lab level.</p>';
for(const k in TR){if(TR[k].hero)continue;const L=S.tl[k]||0,c=300*(L+1)*(L+2);h+=`<div class=r><span>${ic('t_'+k)} ${TR[k].n} <small>Lv ${L+1}</small></span><button ${L>=cap||S.e<c?'disabled':''} onclick="research('${k}')">${L>=cap?'Max':'💧 '+c}</button></div>`}
P(h+'<button onclick="closeP()">Close</button>','lab')}
function research(k){const L=S.tl[k]||0,c=300*(L+1)*(L+2);if(S.e<c)return toast('Not enough elixir');S.e-=c;S.tl[k]=L+1;toast('Research complete!');xp(25);snd('ding');lab();hud();save()}
