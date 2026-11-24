// Progression: leagues, achievements, obstacles
// ---- Leagues: a one-time bonus (gold + elixir) the first time you reach each league
function chkLeague(){const cur=lgIdx();if(cur<=S.lgr)return'';let h='',tot=0;
for(let i=S.lgr+1;i<=cur;i++){S.g+=LG[i].r;S.e+=LG[i].r;tot+=LG[i].r;h+=`<p>${LG[i].e} <b>${LG[i].n} League reached!</b> Bonus 💰${LG[i].r} 💧${LG[i].r}</p>`}
S.lgr=cur;banner(LG[cur].e+' '+LG[cur].n+' League! +'+tot+' 💰 +'+tot+' 💧');snd('win');if(window.confetti)confetti({particleCount:120,spread:90,origin:{y:.3}});save();return h}
function banner(t){const b=$('bn');b.textContent=t;b.classList.add('on');clearTimeout(banner.t);banner.t=setTimeout(()=>b.classList.remove('on'),3800)}
function leagues(){closeP();const cur=lgIdx(),nx=LG[cur+1];
let h=`<h3>🏆 Leagues <small>${S.tr} trophies</small></h3>`;
LG.forEach((l,i)=>{h+=`<div class=r style="${i==cur?'background:#fff2;border-radius:8px;padding:5px 8px':''}"><span>${l.e} ${l.n}<br><small>${l.at}+ 🏆${l.r?' · rank-up bonus 💰'+l.r+' 💧'+l.r:''}</small></span><span>${i<=S.lgr?'✔':i==cur+1?'next':'🔒'}</span></div>`});
if(nx)h+=`<p>${nx.at-S.tr} more trophies to ${nx.n}.</p><div class=pb><u style="width:${100*(S.tr-LG[cur].at)/(nx.at-LG[cur].at)}%"></u></div>`;else h+='<p>You are in the top league. 👑</p>';
P(h+'<p><small>Win battles for +10 🏆 per star. Losing costs 12; raids on your village can cost trophies too.</small></p><button onclick="closeP()">Close</button>')}
// ---- Achievements (progress bars; a toast pops when one becomes claimable)
const acDone=a=>a.v()>=a.g;
function achCheck(){const t=now();if(achCheck.t>t)return;achCheck.t=t+1000;AC.forEach(a=>{if(acDone(a)&&!S.cl[a.id]&&!S.an[a.id]){S.an[a.id]=1;toast('🏅 Achievement ready: '+a.n)}})}
function ach(){closeP();const sc=PK=='ach'?$('pn').scrollTop:0;const n=AC.filter(a=>S.cl[a.id]).length;let h=`<h3>🏅 Achievements <small>${n}/${AC.length}</small></h3>`;
[...AC].sort((a,b)=>(!!S.cl[a.id]-!!S.cl[b.id])||(acDone(b)-acDone(a))).forEach(a=>{const v=Math.min(a.g,a.v()),c=S.cl[a.id],r=acDone(a);
h+=`<div class=r><span>${a.n}<br><small>${a.d} · ${v}/${a.g}</small><div class=pb><u style="width:${100*v/a.g}%"></u></div></span><button ${!r||c?'disabled':''} onclick="clm('${a.id}')">${c?'✔':'💰'+a.r}</button></div>`});
P(h+'<button onclick="closeP()">Close</button>','ach');$('pn').scrollTop=sc}
function clm(id){const a=AC.find(x=>x.id==id);if(!acDone(a)||S.cl[id])return;S.g+=a.r;S.cl[id]=1;toast('+'+a.r+' 💰');snd('coin');ach();hud();save()}
// ---- Obstacles: trees and rocks that block building space. Clear them for gold; they pay XP (and sometimes hide a stash).
const obCost=o=>Math.round(OB[o.t].c*(1+.25*(th()-1)));
const obAt=(p,q)=>S.ob.find(o=>p>=o.x&&p<o.x+OB[o.t].s&&q>=o.y&&q<o.y+OB[o.t].s);
function obInfo(o){const d=OB[o.t],c=obCost(o);P(`<h3>${ic('o_'+o.t)} ${d.n}</h3><p>Clear it for 💰${c} to free up space. Gives +${d.xp} XP and sometimes hides a stash.</p><button ${S.g<c?'disabled':''} onclick="obClear(${o.id})">🪓 Clear 💰${c}</button> <button onclick="closeP()">✕</button>`)}
function obClear(id){const o=S.ob.find(x=>x.id==id);if(!o)return;const c=obCost(o),d=OB[o.t];if(S.g<c)return toast('Not enough gold');
S.g-=c;S.ob=S.ob.filter(x=>x!==o);S.st.ob++;prog('ob',1);xp(d.xp);
const cx=o.x+d.s/2,cy=o.y+d.s/2;puff(cx,cy,14,d.s);spark(cx,cy,'#ffe27a',8);snd('boom');
if(Math.random()<.3){const g=Math.random()<.5,a=(100+Math.floor(Math.random()*150))*th();g?add('g',a):add('e',a);toast('🎁 Hidden stash! +'+a+(g?' 💰':' 💧'));spark(cx,cy,g?'#ffd34d':'#e07bff',12)}else toast('Cleared! +'+d.xp+' XP');
closeP();hud();save()}
function obTick(t){if(t>S.obn){S.obn=t+720000;if(S.ob.length<9)spawnOb(1)}}
// ---- Loot Cart: loot that does not fit your storage waits here (and part of what raiders steal comes back).
// Collect it once there is room. Capacity per resource grows with Town Hall; anything beyond that is lost.
const cartCap=()=>3000*th();
function cartAdd(r,n){n=Math.floor(n);if(n<=0)return 0;const a=Math.min(n,cartCap()-S.cart[r]);if(a>0)S.cart[r]+=a;return Math.max(0,a)}
const cartFull=()=>S.cart.g>0||S.cart.e>0;
function cart(){closeP();const g=S.cart.g,e=S.cart.e,sg=capOf('g')-S.g,se=capOf('e')-S.e;
P(`<h3>🛒 Loot Cart</h3><p>Loot that did not fit in your storage, and part of what raiders took, waits here (max 💰${cartCap()} 💧${cartCap()}).</p><div class=r><span>💰 ${g}<br><small>storage free: ${Math.max(0,Math.floor(sg))}</small></span></div><div class=r><span>💧 ${e}<br><small>storage free: ${Math.max(0,Math.floor(se))}</small></span></div>${!cartFull()?'<p>The cart is empty.</p>':''}<button ${cartFull()?'':'disabled'} onclick="cartTake()">Collect what fits</button> <button onclick="closeP()">Close</button>`,'cart')}
function cartTake(){let g=0,e=0;for(const r of['g','e']){const a=add(r,S.cart[r]);S.cart[r]-=a;r=='g'?g=a:e=a}
S.st.l+=g+e;if(g||e){toast('🛒 +'+g+' 💰 +'+e+' 💧');snd('coin');spark(2,27,'#ffd34d',10)}else toast('Storage is full — spend resources or upgrade vaults');hud();save();cart()}
