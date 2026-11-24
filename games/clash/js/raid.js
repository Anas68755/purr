// Raids on YOUR village: the same battle engine runs headlessly with an AI attacker,
// so walls (and gaps), towers, bombs and army layout decide the outcome. Every raid is logged for the replay screen.
const RAID_COST_MAX=3000;
function raiders(bud){const th_=th(),pool=[['ba',4,0],['ar',3,0],['go',1.5,0],['gi',1.5,12],['wb',1,10],['wz',1,15],['mi',1.5,10],['hl',.6,20],['pk',.5,30],['dr',.4,40]]
 .filter(([k,w,min])=>bud>=min&&(k!='pk'&&k!='dr'||th_>=5)&&(k!='wz'&&k!='mi'||th_>=2)&&(k!='hl'||th_>=3));
const out=[];let guard=0;while(bud>0&&guard++<80){const ok_=pool.filter(([k])=>TR[k].h<=bud);if(!ok_.length)break;
let r=Math.random()*ok_.reduce((a,p)=>a+p[1],0),pick=ok_[0][0];for(const[k,w]of ok_){if((r-=w)<=0){pick=k;break}}out.push(pick);bud-=TR[pick].h}
return out}
// Raid strength in housing space: grows with the square of your Town Hall (defenses grow similarly) plus a little for trophies
const RB=[0,3,8,26,44,44,55,68,85],RJ=.75;   // raider housing space by Town Hall (tuned with simulated raids), +-25% random
const raidBudget=()=>Math.max(2,Math.round(RB[Math.min(8,th())]*(RJ+Math.random()*.5)+S.tr/60));
const SIDES=['north','east','south','west'];
function raidSim(){const bl=[],tp=[];let id=1;
S.b.forEach(b=>{if(b.l<1)return;if(DEF[b.t].trap){tp.push({x:b.x+.5,y:b.y+.5,l:b.l});return}
bl.push({id:id++,t:b.t,x:b.x,y:b.y,l:b.l,hp:hpOf(b.t,b.l),mhp:hpOf(b.t,b.l),up:0,st:0})});
const nb=bl.filter(b=>b.t!='wl').length;if(!nb)return null;
const bud=raidBudget(),army=raiders(bud),side=Math.floor(Math.random()*4);
const B={bl,tr:[],tp,fx:[],time:150,d:0,nb,stars:0,thd:0,occ:[],live:0,el:0,log:[],more:()=>q.length>0};
occ(B);
// spawn tiles along the chosen edge, spread out and not on top of buildings
const q=army.map((k,i)=>{const o=Math.floor(N/2)+Math.round((Math.random()-.5)*10);let x=side==1?N-.5:side==3?.5:o,y=side==0?.5:side==2?N-.5:o;
return{k,t:i*.35,x,y}});
const lg_=(t,s)=>{if(B.log.length<40)B.log.push([Math.round(t),s])},seen={};let bdn=0,traps=0,walls=0,kills=0;
B.ev=(e,o,n)=>{const t=B.el;
 if(e=='fire'&&!seen[o.t]){seen[o.t]=1;lg_(t,`${DEF[o.t].e} Your ${DEF[o.t].n} (Lv ${o.l}) opens fire`)}
 else if(e=='trap'){traps++;lg_(t,`💣 Bomb (Lv ${o.l||1}) goes off${n?' — '+n+' raider'+(n>1?'s':'')+' hit':' — nobody in range'}`)}
 else if(e=='wall'){walls++;if(walls==1)lg_(t,'🧱 Raiders breach your first wall')}
 else if(e=='bld'){bdn++;lg_(t,`💥 ${DEF[o.t].n} (Lv ${o.l}) destroyed${o.t=='th'?' — Town Hall down!':''}`)}
 else if(e=='kill')kills++};
let dn=0;for(;B.el<150&&!dn;B.el+=.1){
 while(q.length&&q[0].t<=B.el){const s=q.shift();B.tr.push(mkU(s.k,s.x,s.y,0));if(!B.first){B.first=1}}
 dn=simB(B,.1)}
const pct=Math.floor(B.d/B.nb*100);
return{B,army,side,pct,stars:B.stars,kills,traps,walls,bdn,dur:Math.round(B.el)}}
function raid(){if(BT)return;const r=raidSim();if(!r)return;
const comp={};r.army.forEach(k=>comp[k]=(comp[k]||0)+1);
const txt=Object.entries(comp).map(([k,n])=>n+' '+TR[k].n+(n>1?'s':'')).join(', ');
r.B.log.unshift([0,`⚔️ Raiders (${txt}) approach from the ${SIDES[r.side]}`]);
const repelled=r.stars==0,pctL=r.pct/100,
 g=Math.min(Math.floor(S.g*.1*pctL),RAID_COST_MAX*th()),e=Math.min(Math.floor(S.e*.1*pctL),RAID_COST_MAX*th()),
 tc=repelled?8:-8*r.stars;
S.g-=g;S.e-=e;const bg=cartAdd('g',g*.25),be=cartAdd('e',e*.25);   // a quarter of what was stolen returns in the Loot Cart
r.cartBack=[bg,be];S.tr=Math.max(0,S.tr+tc);S.sh=now()+600000;if(repelled)S.st.rr++;
r.B.log.push([r.dur,`🏁 Raid over: ${r.pct}% destroyed, ${r.kills}/${r.army.length} raiders defeated`]);
const rec={t:now(),res:repelled?'win':'loss',stars:r.stars,pct:r.pct,g,e,tc,n:r.army.length,kills:r.kills,side:r.side,comp:txt,log:r.B.log};
S.rl.unshift(rec);S.rl.length=Math.min(S.rl.length,10);
const lu=chkLeague();
P((repelled?`<h3>🛡️ Raid repelled!</h3><p>Your defenses held — ${r.kills}/${r.army.length} raiders defeated, only ${r.pct}% damage. +8 🏆</p>`
 :`<h3>💥 Village raided!</h3><p>${'⭐'.repeat(r.stars)} ${r.pct}% destroyed. Lost 💰${g} 💧${e} and ${-tc} 🏆. 🛒 💰${bg} 💧${be} are waiting in your Loot Cart. Build more defenses or close the wall gaps!</p>`)
 +lu+`<p>A shield protects you for 10 minutes.</p><button onclick="replay(0)">📼 Watch replay</button> <button onclick="closeP()">OK</button>`);
snd(repelled?'win':'lose');hud();save();return rec}
const ago=t=>{const m=Math.round((now()-t)/60000);return m<1?'just now':m<60?m+' min ago':Math.round(m/60)+' h ago'};
function replays(){closeP();let h='<h3>📼 Defense replays</h3>';
if(!S.rl.length)h+='<p>No raids yet. Raiders attack when your shield is down — build defenses!</p>';
S.rl.forEach((r,i)=>{h+=`<div class=r><span>${r.res=='win'?'🛡️ Repelled':'💥 Raided'} <small>${ago(r.t)} · ${r.n} raiders · ${r.pct}%${r.res=='loss'?' · −💰'+r.g+' −💧'+r.e:''}</small></span><button onclick="replay(${i})">📼</button></div>`});
P(h+'<button onclick="closeP()">Close</button>','replays')}
function replay(i){const r=S.rl[i];if(!r)return replays();
let h=`<h3>📼 ${r.res=='win'?'Raid repelled':'Village raided'}</h3><p><small>${ago(r.t)} · ${'⭐'.repeat(r.stars)||'no stars'} · ${r.pct}% destroyed · ${r.tc>0?'+':''}${r.tc} 🏆</small></p><div class=lg>`;
r.log.forEach(([t,s])=>{h+=`<div><b>${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}</b> ${s}</div>`});
P(h+'</div><button onclick="replays()">◀ All raids</button> <button onclick="closeP()">Close</button>')}
