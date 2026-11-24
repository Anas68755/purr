// Battle engine (shared by live battles and headless raids on your village),
// enemy village generator, and the battle UI.
// An engine "battle" B has: bl (buildings), tr (troops), tp (bomb traps), fx, time, d/nb (destroyed/total),
// occ (tile -> building), live (true for the on-screen battle), ev (optional event hook), more() (more troops to deploy?)
const WC=16;                       // path cost of breaking through a wall tile (so troops prefer gaps if the detour is shorter)
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const clampT=v=>Math.max(0,Math.min(N-1,v|0));

function occ(B=BT){B.occ=[];B.bl.forEach(b=>{if(b.dead)return;const s=DEF[b.t].s;for(let i=0;i<s;i++)for(let j=0;j<s;j++)B.occ[(b.y+j)*N+b.x+i]=b});B.ver=(B.ver||0)+1;B.ff={}}
function mkU(k,x,y,lv=0){const f=1+.25*lv,h=TR[k].hp*f;return{k,x,y,hp:h,mhp:h,cd:0,g:null,rage:0,cloak:0,lv,ph:Math.random()*6,fx:1,atk:0,mv:0,ad:0}}
const hurt=(u,dm)=>{u.hp-=dm*(TR[u.k].rs||1)};
// distance from a point to a building's rectangle
function rectD(u,b){const s=DEF[b.t].s;return Math.hypot(Math.max(b.x-u.x,0,u.x-b.x-s),Math.max(b.y-u.y,0,u.y-b.y-s))}

function hit(B,b,dm){if(b.dead)return;b.hp-=dm;
if(dm>=12&&b.t!='wl'&&B.live)B.fx.push({k:'t',x1:b.x+DEF[b.t].s/2,y1:b.y,txt:Math.round(dm),t:.7});
if(b.hp<=0){b.dead=1;occ(B);const s=DEF[b.t].s;
B.fx.push({k:'c',x1:b.x+s/2,y1:b.y+s/2,r:1.2,t:.35,c:'#f80'});
if(b.t!='wl'){B.d++;B.sk=.2;if(B.live){puff(b.x+s/2,b.y+s/2,16+s*4,s);snd('boom')}}else if(B.live)puff(b.x+.5,b.y+.5,5,1);
if(b.t=='th')B.thd=1;if(B.ev)B.ev(b.t=='wl'?'wall':'bld',b)}}

function tgt(B,u,pf){let best=null,bd=1e9;
for(const b of B.bl){if(b.dead)continue;const t=b.t,d=DEF[t];
if(pf=='d'&&!d.def||pf=='r'&&!d.res||pf=='w'&&t!='wl'||!pf&&t=='wl')continue;
const q=rectD(u,b);if(q<bd){bd=q;best=b}}
return best||(pf?tgt(B,u,''):(B.bl.find(b=>!b.dead)||null))}

// ---- Pathing: a cost field per goal building (reverse Dijkstra over the tile grid).
// Walls cost WC to enter, other buildings are impassable (unless `all`, the fallback for fully boxed-in goals).
// Troops walk downhill on the field, so they use gaps in walls and only break a wall when that is cheaper than walking around.
function field(B,g,all){const key=g.id+(all?'a':'');if(B.ff[key])return B.ff[key];
const F=new Float32Array(N*N).fill(1e9),Q=[],s=DEF[g.t].s;
const push=(c,i)=>{Q.push([c,i]);let j=Q.length-1;while(j>0){const p=(j-1)>>1;if(Q[p][0]<=Q[j][0])break;[Q[p],Q[j]]=[Q[j],Q[p]];j=p}};
const pop=()=>{const t=Q[0],l=Q.pop();if(Q.length){Q[0]=l;let j=0;for(;;){const a=2*j+1,b=a+1;let m=j;if(a<Q.length&&Q[a][0]<Q[m][0])m=a;if(b<Q.length&&Q[b][0]<Q[m][0])m=b;if(m==j)break;[Q[m],Q[j]]=[Q[j],Q[m]];j=m}}return t};
for(let i=0;i<s;i++)for(let j=0;j<s;j++){const x=g.x+i,y=g.y+j;if(x>=0&&y>=0&&x<N&&y<N){F[y*N+x]=0;push(0,y*N+x)}}
while(Q.length){const[c,i]=pop();if(c>F[i])continue;const cx=i%N,cy=(i/N)|0,co=B.occ[i],en=co&&co!==g?(co.t=='wl'?WC:25):0;
for(const[dx,dy]of DIRS){const mx=cx+dx,my=cy+dy;if(mx<0||my<0||mx>=N||my>=N)continue;
if(dx&&dy&&(B.occ[cy*N+mx]||B.occ[my*N+cx]))continue;
const mo=B.occ[my*N+mx];if(mo&&mo!==g&&mo.t!='wl'&&!all)continue;
const nc=c+(dx&&dy?1.414:1)+en,m=my*N+mx;if(nc<F[m]){F[m]=nc;push(nc,m)}}}
return B.ff[key]=F}
// Next tile for a ground unit heading to goal g: {x,y,o} (o = wall/building standing on that tile that must be broken)
function nav(B,u,g){const cx=clampT(u.x),cy=clampT(u.y);
for(const all of[false,true]){const F=field(B,g,all),f0=F[cy*N+cx];if(f0>=1e8)continue;let best=null,bc=1e9;
for(const[dx,dy]of DIRS){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;if(dx&&dy&&(B.occ[cy*N+nx]||B.occ[ny*N+cx]))continue;
const c=F[ny*N+nx];if(c>=1e8)continue;const o=B.occ[ny*N+nx],blk=o&&o!==g?o:null,tot=c+(dx&&dy?1.414:1)+(blk?(blk.t=='wl'?WC:25):0);
if(tot<bc){bc=tot;best={x:nx+.5,y:ny+.5,o:blk}}}
if(best&&bc<=f0+.01)return best}
return null}
// Is the straight line from the unit to the goal free of other buildings?
function clearTo(B,u,g){const s=DEF[g.t].s,tx=g.x+s/2,ty=g.y+s/2,l=Math.hypot(tx-u.x,ty-u.y),n=Math.ceil(l/.4);
for(let i=1;i<n;i++){const o=B.occ[clampT(u.y+(ty-u.y)*i/n)*N+clampT(u.x+(tx-u.x)*i/n)];if(o&&o!==g)return false}return true}
function step(u,tx,ty,sp){const dx=tx-u.x,dy=ty-u.y,l=Math.hypot(dx,dy);if(l<1e-4)return;const st=Math.min(l,sp);u.x+=dx/l*st;u.y+=dy/l*st;u.mv=st;u.ph+=st*1.1;if(Math.abs(dx)>.04)u.fx=dx>0?1:-1}

function stepHeal(B,u,dt){const d=TR[u.k];let t=null,bd=1e9;
B.tr.forEach(v=>{if(v===u||TR[v.k].heal)return;const q=Math.hypot(v.x-u.x,v.y-u.y)-(v.hp<v.mhp*.85?4:0);if(q<bd){bd=q;t=v}});
if(!t)return;const q=Math.hypot(t.x-u.x,t.y-u.y);if(q>1.3)step(u,t.x,t.y,d.sp*dt*(u.rage>0?1.5:1));
u.cd-=dt;if(u.cd<=0&&q<=d.rng){u.cd=1;const h=d.heal*(1+.25*u.lv);let any=0;
B.tr.forEach(v=>{if(!TR[v.k].heal&&Math.hypot(v.x-t.x,v.y-t.y)<1.8&&v.hp<v.mhp){v.hp=Math.min(v.mhp,v.hp+h);any=1}});
if(any){B.fx.push({k:'c',x1:t.x,y1:t.y,r:1.6,t:.4,c:'#4f4'});u.atk=.25}}}

function stepT(B,u,dt){const d=TR[u.k];u.rage-=dt;u.cloak-=dt;u.atk-=dt;u.mv=0;
if(d.heal)return stepHeal(B,u,dt);
if(!u.g||u.g.dead)u.g=tgt(B,u,d.pf);const g=u.g;if(!g)return;
const m=u.rage>0?1.5:1,sp=d.sp*dt*m;let a=null;
if(rectD(u,g)<=d.rng)a=g;
else if(d.fly){const s=DEF[g.t].s;step(u,g.x+s/2,g.y+s/2,sp)}
else if(clearTo(B,u,g)){const s=DEF[g.t].s;step(u,g.x+s/2,g.y+s/2,sp)}
else{const n=nav(B,u,g);
if(n&&n.o&&rectD(u,n.o)<=d.rng)a=n.o;        // next tile is a wall: break through it
else if(n)step(u,n.x,n.y,sp);
else{const s=DEF[g.t].s;step(u,g.x+s/2,g.y+s/2,sp)}}
if(!a)return;
u.cd-=dt;if(u.cd>0)return;u.cd=1;u.atk=.25;
const s=DEF[a.t].s,cx=a.x+s/2,cy=a.y+s/2;u.ad=Math.atan2(cy-u.y,cx-u.x);if(Math.abs(cx-u.x)>.3)u.fx=cx>u.x?1:-1;
if(u.k=='wb'){B.bl.forEach(o=>{if(!o.dead&&Math.hypot(o.x+DEF[o.t].s/2-cx,o.y+DEF[o.t].s/2-cy)<2+s/2)hit(B,o,o.t=='wl'?160:d.dmg)});
B.fx.push({k:'c',x1:cx,y1:cy,r:2,t:.35,c:'#f44'});if(B.live)puff(cx,cy,8,1);u.hp=0;return}
const dm=d.dmg*m*(u.cloak>0?1.8:1)*(1+.25*u.lv);hit(B,a,dm);
if(d.sp2)B.bl.forEach(o=>{if(o!==a&&!o.dead&&o.t!='wl'&&Math.hypot(o.x+DEF[o.t].s/2-cx,o.y+DEF[o.t].s/2-cy)<1.8)hit(B,o,dm*.5)});
if(d.rng>2)B.fx.push({k:'l',x1:u.x,y1:u.y,x2:cx,y2:cy,t:.12,c:u.k=='wz'?'#c6f':u.k=='aq'?'#d9f':'#fa4'})}

function defend(B,b,dt){const d=DEF[b.t];b.cd=(b.cd||0)-dt;b.fire=Math.max(0,(b.fire||0)-dt);if(b.cd>0)return;
const cx=b.x+d.s/2,cy=b.y+d.s/2;let best=null,bd=1e9;
for(const u of B.tr){if(u.cloak>0)continue;const f=TR[u.k].fly;if(f&&(b.t=='cn'||b.t=='mo'))continue;if(d.air&&!f)continue;
const q=Math.hypot(u.x-cx,u.y-cy);if(q<=d.rng&&q>=(d.min||0)&&q<bd){bd=q;best=u}}
if(d.ramp&&b.lk&&b.lk.hp>0&&b.lk.cloak<=0&&B.tr.includes(b.lk)&&Math.hypot(b.lk.x-cx,b.lk.y-cy)<=d.rng)best=b.lk;
if(!best){b.heat=0;b.lk=null;return}
b.cd=d.rate;b.fire=.22;b.fa=Math.atan2(best.y-cy,best.x-cx);
let dm=d.dmg*(1+.3*(b.l-1))*(B.dm||1),col='#fd6',w=2;
if(d.ramp){if(b.lk===best)b.heat=Math.min(8,(b.heat||0)+1);else{b.lk=best;b.heat=0}dm*=1+.45*b.heat;col=b.heat>5?'#fff3b0':b.heat>2?'#ffa030':'#ff5a1a';w=2+b.heat*.5}
else if(b.t=='wt')col='#c6f';
B.fx.push({k:'l',x1:cx,y1:cy,x2:best.x,y2:best.y,t:d.ramp?.15:.12,c:col,w});
B.tr.forEach(u=>{if(u===best||(d.sp&&Math.hypot(u.x-best.x,u.y-best.y)<1.6))hurt(u,dm)});
if(d.sp)B.fx.push({k:'c',x1:best.x,y1:best.y,r:1.4,t:.25,c:b.t=='wt'?'#a5f':'#f90'});
if(B.ev)B.ev('fire',b)}

function simB(B,dt){B.time-=dt;B.tr.forEach(u=>stepT(B,u,dt));
B.bl.forEach(b=>{if(!b.dead&&DEF[b.t].def)defend(B,b,dt)});
B.tr.forEach(u=>{if(TR[u.k].hero)u.hp=Math.min(u.mhp,u.hp+4*dt)});
B.tp=B.tp.filter(p=>{if(!B.tr.some(u=>!TR[u.k].fly&&Math.hypot(u.x-p.x,u.y-p.y)<1.1))return true;
const dm=DEF.bm.dmg*(1+.35*((p.l||1)-1));let n=0;B.tr.forEach(v=>{if(!TR[v.k].fly&&Math.hypot(v.x-p.x,v.y-p.y)<2){hurt(v,dm);n++}});
B.fx.push({k:'c',x1:p.x,y1:p.y,r:2,t:.4,c:'#f60'});if(B.live){puff(p.x,p.y,10,1.4);snd('boom')}if(B.ev)B.ev('trap',p,n);return false});
B.tr=B.tr.filter(u=>{if(u.hp>0)return true;B.dk=(B.dk||0)+1;if(B.live)puff(u.x,u.y,4,.5);if(B.ev)B.ev('kill',u);return false});
B.fx.forEach(f=>f.t-=dt);B.sk=Math.max(0,(B.sk||0)-dt);B.fx=B.fx.filter(f=>f.t>0);
const pct=Math.floor(B.d/B.nb*100);B.stars=(pct>=50)+B.thd+(pct==100);
return B.time<=0||B.d>=B.nb||(!B.tr.some(u=>!TR[u.k].heal)&&!B.more())}

// ---- live battle on screen
function sim(dt){const end=simB(BT,dt),pct=Math.floor(BT.d/BT.nb*100),m=Math.max(0,Math.ceil(BT.time));
$('st').textContent=`⏱ ${Math.floor(m/60)}:${String(m%60).padStart(2,'0')} · ${'⭐'.repeat(BT.stars)||'☆'} · ${pct}% · 💰${Math.round(BT.lg*pct/100)} 💧${Math.round(BT.le*pct/100)}`;
if(end)endBattle()}
function endBattle(){if(BT.end)return;BT.end=1;const pct=Math.floor(BT.d/BT.nb*100),gl=Math.round(BT.lg*pct/100),le=Math.round(BT.le*pct/100);
const tc=BT.stars?BT.stars*10:-12,w=BT.stars>0;xp(10+BT.stars*30);if(w)S.st.w++;S.st.s+=BT.stars;S.st.dst+=BT.d;if(BT.stars==3)S.st.s3++;
if(VL[BT.id]&&BT.camp==null)VL[BT.id].done=1;S.tr=Math.max(0,S.tr+tc);const ag=add('g',gl),ae=add('e',le);S.st.l+=ag+ae;   // only loot that actually arrived counts
const cg=cartAdd('g',gl-ag),ce=cartAdd('e',le-ae);
prog('w',w?1:0);prog('s',BT.stars);prog('dst',BT.d);const cb=campEnd(),lu=chkLeague();
snd(w?'win':'lose');if(w&&window.confetti)confetti({particleCount:60*BT.stars,spread:80,origin:{y:.6}});
P(`<h3>${w?'Victory!':'Defeat'}</h3><p style="font-size:26px">${'⭐'.repeat(BT.stars)||'—'}</p><p>${pct}% destroyed · ${tc>0?'+':''}${tc} 🏆</p><p>Looted 💰${ag} 💧${ae}</p>${cg||ce?`<p>🛒 Storage full — 💰${cg} 💧${ce} went to your Loot Cart</p>`:''}${ag<gl-cg||ae<le-ce?'<p><small>Loot beyond the cart capacity was lost.</small></p>':''}${cb?`<p>🗺️ Campaign bonus +${cb} 💰</p>`:''}${lu}<button onclick="BT=null;$('st').style.display='none';homeBar();closeP();save()">Return home</button>`);
bar('');achCheck();hud();save()}

// ---- enemy villages
function gen(t){let id=1;const bl=[],R=Math.random,L=()=>Math.max(1,t+(R()<.5?0:-1)),fx=R()<.5,fy=R()<.5;
const A=(k,x,y)=>{const d=DEF[k],l=Math.min(L(),d.max),o={id:id++,t:k,x:fx?N-d.s-x:x,y:fy?N-d.s-y:y,l,hp:hpOf(k,l),up:0,st:0};o.mhp=o.hp;bl.push(o)};
const r0=R()<.3?8:9,r1=29-r0;
// Outer wall ring with gaps (fewer gaps at higher Town Halls; sometimes fully sealed so troops must breach)
const gp=new Set(),ng=t>3&&R()<.25?0:t<3?3:t<6?2:1;
for(let i=0;i<ng;i++){const side=Math.floor(R()*4),o=r0+3+Math.floor(R()*(r1-r0-6)),w=R()<.5?1:2;
for(let j=0;j<w;j++){const a=o+j;gp.add(side==0?a+','+r0:side==1?a+','+r1:side==2?r0+','+a:r1+','+a)}}
const W=(x,y)=>{if(!gp.has(x+','+y))A('wl',x,y)};
for(let i=r0;i<=r1;i++){W(i,r0);W(i,r1);if(i>r0&&i<r1){W(r0,i);W(r1,i)}}
A('th',13,13);A('gs',10,13);A('es',17,13);
// Defense mix grows with Town Hall: wizard towers from TH3, inferno towers from TH4
const n=Math.min(6,1+t+(t>2&&R()<.5?1:0)),feat=['cn','at'];if(t>1)feat.push('mo');if(t>2)feat.push('wt','ad');if(t>3)feat.push('it');
const ty=feat.slice(0,n);while(ty.length<n)ty.push(R()<.5?'cn':'at');sh(ty);
const sl=sh([[10,10],[18,17],[18,10],[10,17],[13,10],[13,18]]);
for(let i=0;i<n;i++)A(ty[i],sl[i][0],sl[i][1]);
const cr=[[3,3],[24,3],[3,24],[24,24]],cs=sh(['gm','ec','gm','ec']);cr.forEach(([x,y],i)=>A(cs[i],x,y));
if(R()<.5)cr.forEach(([x,y])=>{const ring=[];for(let i=x-1;i<=x+3;i++)for(let j=y-1;j<=y+3;j++)if(i==x-1||i==x+3||j==y-1||j==y+3)ring.push([i,j]);
const mid=ring.filter(([i,j])=>!((i==x-1||i==x+3)&&(j==y-1||j==y+3))),gap=R()<.6?mid[Math.floor(R()*mid.length)]:null;   // optional gap in each mini-ring
ring.forEach(([i,j])=>{if(!(gap&&gap[0]==i&&gap[1]==j))A('wl',i,j)})});
A('cp',3,13);A('cp',24,13);if(t>1){A('cn',6,11);A('cn',22,17)}if(t>3){A('at',6,17);A('mo',22,11)}
if(t>4)A('wt',6,14);if(t>5)A('it',22,13);if(t>6)A('ad',22,20);   // extra outer defenses at high Town Halls
const nb=bl.filter(b=>b.t!='wl').length,oc=new Set();
bl.forEach(b=>{const s=DEF[b.t].s;for(let i=0;i<s;i++)for(let j=0;j<s;j++)oc.add((b.x+i)+','+(b.y+j))});
const spotF=(lo,hi)=>{for(let k=0;k<40;k++){const x=lo+Math.floor(R()*(hi-lo)),y=lo+Math.floor(R()*(hi-lo));if(!oc.has(x+','+y)){oc.add(x+','+y);return[x,y]}}return null};
// Hidden bombs (level grows with Town Hall) and decorative trees/rocks
const tp=[];for(let i=0;i<3+t;i++){const p=spotF(10,20);if(p)tp.push({x:p[0]+.5,y:p[1]+.5,l:Math.min(5,Math.max(1,t-1+(R()<.4?1:0)))})}
const ob=[];for(let i=0;i<7;i++){const p=spotF(0,30);if(p&&(p[0]<r0-1||p[0]>r1+1||p[1]<r0-1||p[1]>r1+1))ob.push({t:R()<.7?'tr':'rk',x:p[0],y:p[1]})}
return{bl,t,gaps:ng,lg:Math.round(400*t*(1+R())),le:Math.round(400*t*(1+R())),tr:[],tp,ob,fx:[],time:180,sel:null,d:0,nb,stars:0,thd:0,end:0,occ:[],ab:{}}}
function mk(){const m=['Keep','Hold','Spire','Bastion','Ridge','Fort','Citadel','Vale','Gate','Peak'];
return sh(['Iron','Storm','Ember','Shadow','Crystal','Goblin','Dragon','Frost','Thunder','Ash']).map((a,i)=>{const o=gen(Math.max(1,Math.min(8,th()+Math.floor(Math.random()*3)-1)));o.name=a+' '+m[Math.floor(Math.random()*10)];o.id=i;return o})}
function startBattle(){if(!used())return toast('Train troops first'),army();if(!VL.length)VL=mk();scout()}
function scout(){let h='<h3>🗺️ Choose a village</h3>';VL.forEach((v,i)=>{h+=`<div class=r><span>🏯 ${v.name} <small>TH${v.t} · 💰${v.lg} 💧${v.le}</small></span><button ${v.done?'disabled':''} onclick="go(${i})">${v.done?'✔':'⚔️ Attack'}</button></div>`});
P(h+`<button onclick="if(S.g<250)toast('Need 250 gold');else{S.g-=250;VL=mk();scout()}">🔄 New villages (💰250)</button> <button onclick="closeP()">Close</button>`)}
const firstSel=()=>Object.keys(TR).find(k=>S.arm[k]>0)||Object.keys(SP).find(k=>S.spl[k]>0);
// Start the on-screen battle against village B
function begin(B){closeP();mode=null;BT=B;B.live=1;B.spd=SET.speed;B.x5=0;B.ab={};B.fx=[];S.sh=0;
S.arm.ki=1;if(th()>=TR.aq.unl)S.arm.aq=1;           // heroes join every raid for free
B.cc=S.cc&&S.b.some(b=>b.t=='cc'&&b.l)?{...S.cc}:null;
B.more=()=>used()>0||!!B.cc;occ(B);B.sel=firstSel();bBar();$('st').style.display='flex';snd('click')}
function go(i){begin(VL[i])}
function deploy(x,y){if(BT.end||!BT.sel)return;const k=BT.sel,B=BT;
if(k=='cc'){const c=B.cc,t=TR[c.k];if(B.occ[Math.floor(y)*N+Math.floor(x)]&&!t.fly)return;
for(let i=0;i<c.n;i++)B.tr.push(mkU(c.k,x+(Math.random()-.5)*1.2,y+(Math.random()-.5)*1.2,S.tl[c.k]||0));
B.cc=null;B.sel=firstSel();snd('click');bBar();return}
if(TR[k]){const f=TR[k].fly;if(!(S.arm[k]>0)||(!f&&B.occ[Math.floor(y)*N+Math.floor(x)]))return;
const cnt=B.x5&&!TR[k].hero?Math.min(5,S.arm[k]):1;
for(let i=0;i<cnt;i++){let px=x,py=y;if(i){const a=Math.random()*6.28,r=.45+Math.random()*.4;px=Math.max(.2,Math.min(N-.2,x+Math.cos(a)*r));py=Math.max(.2,Math.min(N-.2,y+Math.sin(a)*r));if(!f&&B.occ[Math.floor(py)*N+Math.floor(px)]){px=x;py=y}}
S.arm[k]--;B.tr.push(mkU(k,px,py,S.tl[k]||0))}snd('click')}
else{if(!(S.spl[k]>0))return;S.spl[k]--;snd('click');
if(k=='li'){B.bl.forEach(b=>{const s=DEF[b.t].s;if(!b.dead&&Math.hypot(b.x+s/2-x,b.y+s/2-y)<2.5+s/2)hit(B,b,b.t=='wl'?60:220)});B.fx.push({k:'c',x1:x,y1:y,r:2.5,t:.4,c:'#ff0'});B.sk=.15}
else if(k=='he'){B.tr.forEach(u=>{if(Math.hypot(u.x-x,u.y-y)<3)u.hp=Math.min(u.mhp,u.hp+120)});B.fx.push({k:'c',x1:x,y1:y,r:3,t:.5,c:'#4f4'});spark(x,y,'#7fff8a',10)}
else{B.tr.forEach(u=>{if(Math.hypot(u.x-x,u.y-y)<3.5)u.rage=10});B.fx.push({k:'c',x1:x,y1:y,r:3.5,t:.5,c:'#f4a'})}}
if(!(S.arm[k]>0)&&!(S.spl[k]>0))B.sel=firstSel();bBar()}
function heroAb(k){const h=BT.tr.filter(u=>u.k==k);if(!h.length||BT.ab[k]||BT.end)return;BT.ab[k]=1;S.st.ha++;
h.forEach(u=>{if(k=='ki'){u.hp=Math.min(u.mhp,u.hp+500);u.rage=8;BT.fx.push({k:'c',x1:u.x,y1:u.y,r:3,t:.6,c:'#fd4'})}
else{u.hp=Math.min(u.mhp,u.hp+300);u.cloak=5;BT.fx.push({k:'c',x1:u.x,y1:u.y,r:3,t:.6,c:'#c8f'});
for(let i=0;i<3;i++)BT.tr.push(mkU('ar',u.x+Math.cos(i*2.1)*.8,u.y+Math.sin(i*2.1)*.8,S.tl.ar||0));spark(u.x,u.y,'#d9a8ff',14)}});
snd('win');bBar()}
function bBar(){let h='';for(const k in TR)if(S.arm[k]>0)h+=`<button class="${BT.sel==k?'on':''}" onclick="BT.sel='${k}';bBar()">${ic('t_'+k)} ${S.arm[k]}</button>`;
for(const k in SP)if(S.spl[k]>0)h+=`<button class="${BT.sel==k?'on':''}" onclick="BT.sel='${k}';bBar()">${ic('s_'+k)} ${S.spl[k]}</button>`;
if(BT.cc)h+=`<button class="${BT.sel=='cc'?'on':''}" onclick="BT.sel='cc';bBar()">${ic('t_'+BT.cc.k)} ×${BT.cc.n} 🏰</button>`;
for(const k in TR){const t=TR[k];if(t.hero&&!BT.ab[k]&&BT.tr.some(u=>u.k==k))h+=`<button class="ab" onclick="heroAb('${k}')">${t.e} ${t.ab=='rage'?'Rage!':'Cloak!'}</button>`}
bar(h+`<button class="${BT.x5?'on':''}" onclick="BT.x5=!BT.x5;bBar()" title="Deploy 5 at once">×5</button><button onclick="BT.spd=BT.spd>=3?1:BT.spd+1;bBar()">${BT.spd>1?'⏩ '+BT.spd+'x':'▶ 1x'}</button><button onclick="endBattle()">🏳 Finish</button>`)}
