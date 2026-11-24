// Core state, settings, helpers, economy, save/load, tick
const T=22,N=30,C=document.getElementById('c'),X=C.getContext('2d');C.width=C.height=T*N;
const $=i=>document.getElementById(i),now=()=>Date.now();
let S,mode=null,sel=null,ptr=null,BT=null,place=null,PK=null; // PK = kind of the open panel (so it can live-refresh)
// Settings live in their own key so "reset game" and "import save" never wipe them
const SET=Object.assign({mute:0,music:1,mv:.5,sv:.7,speed:1,dm:'day',shake:1,anim:1,fx:1},(()=>{try{return JSON.parse(localStorage.getItem('cok_set'))||{}}catch(e){return{}}})());
const saveSet=()=>{try{localStorage.setItem('cok_set',JSON.stringify(SET))}catch(e){}};
const snd=k=>{try{SFX.play(k)}catch(e){}};
const th=()=>{const b=S.b.find(x=>x.t=='th');return b&&b.l?b.l:1};
const hpOf=(t,l)=>Math.round(DEF[t].hp*(1+.4*(Math.max(l,1)-1)));
const cost=(t,l)=>Math.round(DEF[t].c*Math.pow(l,1.8));
const maxL=t=>t=='th'?8:Math.min(DEF[t].max,th()+2);
// How many of a building you may own at a given Town Hall level
const limAt=(t,h)=>({th:1,gm:1+h,ec:1+h,gs:1+(h>2),es:1+(h>2),cn:1+h,at:h-1,mo:h>2?h-2:0,wl:40+h*20,cp:1+(h>2),bh:2,ad:h>2?h-2:0,lb:h>1?1:0,cc:h>1?1:0,
 br:1+(h>2)+(h>4),bm:1+h,wt:h>2?Math.min(4,h-2):0,it:h>3?(h>5?2:1):0})[t];
const lim=t=>limAt(t,th());
const unlockTH=t=>{for(let h=1;h<=8;h++)if(limAt(t,h)>0)return h;return 9};
const capOf=r=>2000+S.b.filter(b=>b.t==(r=='g'?'gs':'es')&&b.l).reduce((a,b)=>a+DEF[b.t].cap*b.l,0);
const campCap=()=>10+S.b.filter(b=>b.t=='cp'&&b.l).reduce((a,b)=>a+10*b.l,0);
const used=()=>Object.entries(S.arm).reduce((a,[k,v])=>a+TR[k].h*v,0);
const builders=()=>1+S.b.filter(b=>b.t=='bh'&&b.l).length;
const busy=()=>S.b.filter(b=>b.up>now()).length;
const gb=id=>S.b.find(b=>b.id==id);
const lgIdx=()=>{let i=0;LG.forEach((l,j)=>{if(S.tr>=l.at)i=j});return i};
const lg=()=>LG[lgIdx()].n;
function toast(m){const d=document.createElement('div');d.textContent=m;$('ts').append(d);setTimeout(()=>d.remove(),2200)}
function add(r,n){const cap=capOf(r),a=Math.max(0,Math.min(n,cap-S[r]));S[r]+=a;return a}
function save(){try{localStorage.setItem('cok2',JSON.stringify(S))}catch(e){}}
function fresh(){let id=1;const B=(t,x,y,l=1)=>({id:id++,t,x,y,l,hp:hpOf(t,l),up:0,st:0});
return{g:2500,e:2000,tr:0,last:now(),sh:now()+600000,arm:{ba:4},spl:{},
b:[B('th',13,13),B('gm',6,8),B('ec',21,8),B('gs',6,20),B('es',21,20),B('cn',10,13),B('cn',18,13),B('cp',13,20),B('br',12,7)]}}
try{S=JSON.parse(localStorage.getItem('cok2'))}catch(e){}
if(!S||!S.b)S=fresh();
// Is a rectangle free of buildings AND obstacles?
function free(x,y,s,ig){if(x<0||y<0||x+s>N||y+s>N)return false;
return !S.b.some(b=>b!==ig&&x<b.x+DEF[b.t].s&&b.x<x+s&&y<b.y+DEF[b.t].s&&b.y<y+s)
&&!(S.ob||[]).some(o=>x<o.x+OB[o.t].s&&o.x<x+s&&y<o.y+OB[o.t].s&&o.y<y+s)}
// Nearest free spot to the village centre (used to give old saves a Barracks)
function spot(s){let best=null,bd=1e9;for(let y=1;y<=N-s-1;y++)for(let x=1;x<=N-s-1;x++){const d=Math.hypot(x-13,y-13);if(d<bd&&free(x,y,s)){bd=d;best=[x,y]}}return best}
function spawnOb(n=1){for(let i=0;i<n;i++){const t=Math.random()<.65?'tr':'rk',s=OB[t].s;
for(let k=0;k<60;k++){const x=1+Math.floor(Math.random()*(N-s-2)),y=1+Math.floor(Math.random()*(N-s-2));
if(free(x,y,s)&&!(x>10&&x<18&&y>10&&y<18)){S.ob.push({id:now()+Math.random(),t,x,y});break}}}}
// Bring any save (old or new) up to the current format
function migrate(){S.arm=S.arm||{};S.spl=S.spl||{};S.q=S.q||[];S.cl=S.cl||{};S.rl=S.rl||[];S.tl=S.tl||{};
S.st=Object.assign({w:0,s:0,l:0,dst:0,tk:0,s3:0,rr:0,ob:0,up:0,ha:0,qc:0},S.st||{});
if(S.lgr==null)S.lgr=lgIdx(); // existing players are not paid retroactively
if(!S.b.some(b=>b.t=='br')){const p=spot(3);if(p){S.b.push({id:now()+Math.random(),t:'br',x:p[0],y:p[1],l:1,hp:hpOf('br',1),up:0,st:0});setTimeout(()=>toast('⚔️ A free Barracks was added to train troops'),1500)}}
if(!S.ob){S.ob=[];spawnOb(8)}if(!S.obn)S.obn=now()+720000;S.an=S.an||{};S.cart=S.cart||{g:0,e:0}}
migrate();
function newGame(){S=fresh();migrate();save();closeP();sel=null}
function tick(){const t=now(),dt=Math.min((t-S.last)/1000,86400);S.last=t;
S.b.forEach(b=>{const d=DEF[b.t];if(b.up&&b.up<=t){b.up=0;b.l++;b.hp=hpOf(b.t,b.l);toast('✅ '+d.n+' is now level '+b.l);xp(15*b.l);S.st.up++;
 if(typeof spark=='function')spark(b.x+d.s/2,b.y+d.s/2,'#ffe27a',12);snd('place')}
if(d.rate&&b.l)b.st=Math.min(b.st+d.rate*b.l*dt/60,300*b.l)});
if(!(S.g>=0))S.g=0;if(!(S.e>=0))S.e=0;qRun(dt);obTick(t);achCheck();hud();if(PK=='army')qUI()}
function hud(){$('g').textContent=Math.floor(S.g)+'/'+capOf('g');$('e').textContent=Math.floor(S.e)+'/'+capOf('e');$('tr').textContent=S.tr+(S.sh>now()?' 🛡️':'');$('lg').textContent=LG[lgIdx()].e+' '+lg();$('bd').textContent=(builders()-busy())+'/'+builders();$('tl').textContent=th();$('lv').textContent=S.lv||1;$('gm').style.width=Math.min(100,S.g/capOf('g')*100)+'%';$('em').style.width=Math.min(100,S.e/capOf('e')*100)+'%'}
let VL=[];
const sh=a=>a.sort(()=>Math.random()-.5);
const ic=k=>'<img class="ic" src="assets/'+k+'.png" alt="">';
function xp(n){S.lv=S.lv||1;S.xp=(S.xp||0)+n;while(S.xp>=100+S.lv*80){S.xp-=100+S.lv*80;S.lv++;S.g+=200*S.lv;toast('⭐ Level '+S.lv+'! +'+200*S.lv+' 💰')}}
