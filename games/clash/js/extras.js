// Extras: daily quests, campaign, Clan Castle reinforcements
// Quest: [stat key, text, goal, base reward]. Reward = base x (1 + 0.5 x (Town Hall - 1)) gold -- see QR()
const QP=[['w','Win 2 battles',2,400],['s','Earn 4 stars',4,500],['dst','Destroy 25 buildings',25,450],['col','Collect 2000 resources',2000,400],['bld','Build or upgrade 2 things',2,350],['ob','Clear 3 obstacles',3,350]];
const QR=i=>Math.round(QP[i][3]*(1+.5*(th()-1)));
function dq(){const t=new Date().toISOString().slice(0,10);if(!S.dq||S.dq.day!=t)S.dq={day:t,q:sh(QP.map((_,i)=>i)).slice(0,3),p:{},c:{}};return S.dq}
function prog(k,n){if(n>0){const q=dq();q.p[k]=(q.p[k]||0)+n}}
function quests(){closeP();const q=dq();let h='<h3>📜 Daily Quests</h3>';
q.q.forEach(i=>{const[k,nm,g]=QP[i],p=Math.min(g,q.p[k]||0);h+=`<div class=r><span>${nm}<br><small>${p}/${g} · 💰${QR(i)}</small></span><button ${p<g||q.c[i]?'disabled':''} onclick="claimQ(${i})">${q.c[i]?'✔':'Claim'}</button></div>`});
P(h+'<p><small>New quests every day.</small></p><button onclick="closeP()">Close</button>')}
function claimQ(i){const q=dq(),r=QR(i);if(q.c[i])return;S.g+=r;q.c[i]=1;S.st.qc++;toast('+'+r+' 💰');xp(30);snd('coin');quests();hud();save()}
const CN=['Goblin Outpost','Mossy Keep','Iron Gate','Bandit Camp','Stone Fort','Ember Hold','Frost Citadel','Shadow Spire','Dragon Roost','Warlord Throne'];
const ct=i=>Math.min(8,1+Math.floor(i*.8));
// Bonus for each NEW star on a campaign village (first clears pay most, later stages pay more)
const CB=i=>Math.round(150*(i+1)+60*(i+1)*(i+1)/2);
function seeded(seed,f){const o=Math.random;let s=seed;Math.random=()=>{s=s*16807%2147483647;return(s-1)/2147483646};try{return f()}finally{Math.random=o}}
function campaign(){closeP();S.cp=S.cp||[];let h='<h3>🗺️ Campaign</h3><p>Fixed villages, double loot. Each new star pays a bonus.</p>';
CN.forEach((n,i)=>{const open=!i||S.cp[i-1]>0,st=S.cp[i]||0;h+=`<div class=r><span>${n} <small>TH${ct(i)} · ${'⭐'.repeat(st)||'☆☆☆'} · +💰${CB(i)}/star</small></span><button ${open?'':'disabled'} onclick="cgo(${i})">${open?'⚔️':'🔒'}</button></div>`});
P(h+'<button onclick="closeP()">Close</button>')}
function cgo(i){if(!used())return toast('Train troops first');const B=seeded(1000+i*77,()=>gen(ct(i)));B.name=CN[i];B.camp=i;B.lg*=2;B.le*=2;
// each later stage is tougher: +9% defense damage and +7% building HP per stage
B.dm=1+.09*i;B.bl.forEach(b=>{b.hp=b.mhp=Math.round(b.hp*(1+.07*i))});begin(B)}
// called from endBattle: pays the bonus for newly earned stars, returns the amount
function campEnd(){if(BT.camp==null)return 0;S.cp=S.cp||[];const g=BT.stars-(S.cp[BT.camp]||0);if(g>0){S.cp[BT.camp]=BT.stars;const r=g*CB(BT.camp);S.g+=r;return r}return 0}
function ccp(){closeP();const c=S.b.find(b=>b.t=='cc'&&b.l),cap=5*(c?c.l:0);
let h=`<h3>🏰 Clan Castle Lv ${c?c.l:0}</h3><p>Free reinforcements in every attack (housing ${cap}). Current: ${S.cc?S.cc.n+' × '+TR[S.cc.k].n:'none'}</p>`;
['ba','ar','gi','wz','mi','hl'].forEach(k=>{const n=Math.floor(cap/TR[k].h);h+=`<div class=r><span>${ic('t_'+k)} ${TR[k].n} ×${n}</span><button ${n?'':'disabled'} onclick="S.cc={k:'${k}',n:${n}};save();ccp()">Request</button></div>`});
P(h+'<button onclick="closeP()">Close</button>')}
