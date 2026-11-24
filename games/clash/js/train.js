// Army: Barracks training queue for troops and spells (paid in elixir, speed up with gold)
// Each Barracks trains one item at a time (+25% speed per level). Queued troops reserve camp space.
const slots=()=>S.b.filter(b=>b.t=='br'&&b.l>0).map(b=>1+.25*(b.l-1)).sort((a,b)=>b-a);
const qHouse=()=>S.q.reduce((a,i)=>a+(TR[i.k]?TR[i.k].h:0),0);
const qMax=()=>8+4*slots().length;
const fmt=s=>{s=Math.max(0,Math.ceil(s));return s>=60?Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s':s+'s'};
const qCost=it=>Math.max(1,Math.ceil(Math.max(0,it.left)/2));                 // speed-up price: 1 gold per 2 seconds left
function qRun(dt){const sl=slots();if(!sl.length||!S.q.length)return;let done=0;
while(dt>1e-6&&S.q.length){const act=S.q.slice(0,sl.length);let st=dt;act.forEach((it,i)=>{st=Math.min(st,it.left/sl[i])});
act.forEach((it,i)=>it.left-=st*sl[i]);dt-=st;
S.q=S.q.filter(it=>{if(it.left>1e-6)return true;qDone(it);done++;return false})}
if(done){toast('✅ '+done+' unit'+(done>1?'s':'')+' ready');snd('ding');if(PK=='army')army()}}
function qDone(it){if(TR[it.k]){S.arm[it.k]=(S.arm[it.k]||0)+1;S.st.tk++;S.st['t_'+it.k]=(S.st['t_'+it.k]||0)+1}else S.spl[it.k]=(S.spl[it.k]||0)+1}
function army(){closeP();const sc=PK=='army'?$('pn').scrollTop:0;
let h=`<h3>⚔️ Army ${used()}/${campCap()} <small>(+${qHouse()} queued)</small></h3>`;
if(!slots().length)h+='<p>⚠️ Build a Barracks to train troops.</p>';
for(const k in TR){const t=TR[k];if(t.hero){const open=th()>=t.unl;
 h+=`<div class=r><span>${ic('t_'+k)} ${t.n} <small>${open?'joins every attack · '+(t.ab=='rage'?'Rage':'Royal Cloak')+' ability':'🔒 Town Hall '+t.unl}</small><br><small>HP ${t.hp} · DMG ${t.dmg}${t.rng>2?' · ranged':''}</small></span></div>`;continue}
 h+=`<div class=r><span>${ic('t_'+k)} ${t.n} ×${S.arm[k]||0} <small>Lv${(S.tl[k]||0)+1}</small><br><small>HP ${t.hp}${t.dmg?' · DMG '+t.dmg:' · heals allies'} · space ${t.h} · ⏱${fmt(t.tt)}${t.fly?' · flies':''}${t.pf?' · targets '+{d:'defenses',r:'resources',w:'walls'}[t.pf]:''}</small></span><button onclick="train('${k}')">💧 ${t.c}</button></div>`}
for(const k in SP){const s=SP[k];h+=`<div class=r><span>${ic('s_'+k)} ${s.n} ×${S.spl[k]||0}<br><small>⏱${fmt(s.tt)} · max 3</small></span><button onclick="brew('${k}')">💧 ${s.c}</button></div>`}
const sl=slots().length;
h+=`<h3 style="margin-top:10px">⏳ Training queue <small>${S.q.length}/${qMax()}</small></h3>`;
if(!S.q.length)h+='<p><small>Nothing training. Tap a troop to queue it.</small></p>';
S.q.forEach((it,i)=>{const o=TR[it.k]||SP[it.k],act=i<sl;h+=`<div class=r><span>${ic((TR[it.k]?'t_':'s_')+it.k)} ${o.n}<div class=pb><u id=qb${i} style="width:${act?100*(1-it.left/it.tt):0}%"></u></div><small id=qt${i}>${act?fmt(it.left):'waiting'}</small></span><span><button onclick="qSpeed(${i})">⚡💰${qCost(it)}</button> <button onclick="qCancel(${i})">✖</button></span></div>`});
if(S.q.length>1)h+=`<button onclick="qAll()">⚡ Finish all (💰${S.q.reduce((a,i)=>a+qCost(i),0)})</button> `;
P(h+'<button onclick="closeP()">Close</button>','army');$('pn').scrollTop=sc}
// live-update the bars without rebuilding the panel (keeps buttons clickable)
function qUI(){const sl=slots().length;if(!$('qb0')&&S.q.length||$('qb'+S.q.length))return army();
S.q.forEach((it,i)=>{const b=$('qb'+i),t=$('qt'+i);if(!b)return;const act=i<sl;b.style.width=act?100*(1-it.left/it.tt)+'%':'0%';t.textContent=act?fmt(it.left):'waiting'})}
function train(k){const t=TR[k];if(!slots().length)return toast('Build a Barracks first');if(S.e<t.c)return toast('Not enough elixir');
if(S.q.length>=qMax())return toast('Queue is full');if(used()+qHouse()+t.h>campCap())return toast('Army camps are full');
S.e-=t.c;S.q.push({k,left:t.tt,tt:t.tt,c:t.c});snd('click');army();hud();save()}
function brew(k){const s=SP[k];if(!slots().length)return toast('Build a Barracks first');if(S.e<s.c)return toast('Not enough elixir');
if((S.spl[k]||0)+S.q.filter(i=>i.k==k).length>=3)return toast('Max 3 of each spell');if(S.q.length>=qMax())return toast('Queue is full');
S.e-=s.c;S.q.push({k,left:s.tt,tt:s.tt,c:s.c});snd('click');army();hud();save()}
function qSpeed(i){const it=S.q[i];if(!it)return;const c=qCost(it);if(S.g<c)return toast('Not enough gold');S.g-=c;qDone(it);S.q.splice(i,1);snd('ding');army();hud();save()}
function qAll(){const c=S.q.reduce((a,i)=>a+qCost(i),0);if(S.g<c)return toast('Not enough gold');S.g-=c;S.q.forEach(qDone);S.q=[];toast('⚡ Training complete');snd('ding');army();hud();save()}
function qCancel(i){const it=S.q[i];if(!it)return;S.e+=it.c;S.q.splice(i,1);army();hud();save()}
