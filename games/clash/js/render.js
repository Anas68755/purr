// Canvas rendering: ground, obstacles, animated buildings/troops, effects, day/night tint
const G=document.createElement('canvas');G.width=G.height=T*N;
(function(){const g=G.getContext('2d');for(let y=0;y<N;y++)for(let x=0;x<N;x++){const h=Math.abs(Math.sin(x*12.9+y*78.2)*437.5)%1;g.fillStyle=`hsl(${95+h*12},${42+h*10}%,${27+((x+y)%2)*2+h*5}%)`;g.fillRect(x*T,y*T,T,T);if(h>.86){g.fillStyle='#ffffff55';g.fillRect(x*T+h*9,y*T+7,2,2)}}
g.strokeStyle='#c9a86a';g.lineWidth=T*.9;g.globalAlpha=.3;g.beginPath();g.moveTo(0,15*T);g.lineTo(N*T,15*T);g.moveTo(15*T,0);g.lineTo(15*T,N*T);g.stroke()})();
(function(){const f=()=>{const g=G.getContext('2d');g.globalAlpha=.5;g.fillStyle=g.createPattern(IMG.grass,'repeat');g.fillRect(0,0,T*N,T*N);g.globalAlpha=1;bakeGround()};if(ok(IMG.grass))f();else IMG.grass.addEventListener('load',f)})();
let GI=null;   // ground baked to an <img>; drawn instead of the canvas when available
function bakeGround(){try{const i=new Image();i.onload=()=>{GI=i};i.src=G.toDataURL()}catch(e){}}
const tm=()=>SET.anim?now():0;
function dOb(o){const d=OB[o.t],x=o.x*T,y=o.y*T,w=d.s*T,im=IMG['o_'+o.t],sw=SET.anim?Math.sin(now()/1100+o.x*2.3+o.y)*.02:0;
X.fillStyle='#0004';X.beginPath();X.ellipse(x+w/2,y+w-2,w*.4,w*.1,0,0,7);X.fill();
X.save();X.translate(x+w/2,y+w);X.rotate(o.t=='tr'?sw:0);X.translate(-w/2,-w);
if(ok(im))X.drawImage(im,0,o.t=='tr'?-w*.25:0,w,o.t=='tr'?w*1.25:w);else{X.font=w*.8+'px serif';X.fillText(d.e,w/2,w*.8)}X.restore()}
function dB(b){const d=DEF[b.t],s=d.s,x=b.x*T,y=b.y*T,w=s*T;
if(b.dead){if(ok(IMG.rub))X.drawImage(IMG.rub,x,y,w,w);else{X.fillStyle='#1c1610';X.fillRect(x+2,y+2,w-4,w-4)}return}
if(b.t=='wl'){const hp=b.mhp&&b.hp<b.mhp;if(ok(IMG.b_wl)){X.drawImage(IMG.b_wl,x,y,T,T)}else{const g=X.createLinearGradient(0,y,0,y+T);g.addColorStop(0,'#d6d0c0');g.addColorStop(1,'#7b7566');X.fillStyle=g;X.beginPath();X.roundRect(x+1,y+1,T-2,T-2,3);X.fill();X.strokeStyle='#0005';X.lineWidth=1;X.stroke()}
if(hp){X.fillStyle='#0006';X.fillRect(x+1,y+1,T-2,(1-b.hp/b.mhp)*(T-2))}return}
if(b.t=='bm'){const im=IMG.b_bm;if(ok(im))X.drawImage(im,x+1,y+1,T-2,T-2);else{X.font='16px serif';X.fillText('💣',x+T/2,y+T*.75)}X.fillStyle='#fff';X.font='bold 8px sans-serif';X.fillText(b.l||1,x+T-5,y+T-3);return}
X.fillStyle='#0005';X.beginPath();X.ellipse(x+w/2,y+w-1,w*.48,w*.13,0,0,7);X.fill();
// idle sway (slow, per-building phase) + recoil when a defense fires
const t=tm(),idle=b.l&&!(b.up>now())&&SET.anim?Math.sin(t/900+b.id*1.7):0,rc=b.fire>0?b.fire/.22:0;
X.save();X.translate(x+w/2,y+w);X.rotate(idle*.012);X.scale(1+idle*.004+rc*.05,1-idle*.006+rc*.03);
if(rc)X.translate(-Math.cos(b.fa||0)*rc*2.5,-Math.sin(b.fa||0)*rc*1.5);X.translate(-w/2,-w);
const im=IMG['b_'+b.t];X.globalAlpha=b.l?1:.55;
if(ok(im))X.drawImage(im,0,-w*.08,w,w*1.08);else{X.fillStyle=COL[b.t];X.beginPath();X.roundRect(2,2,w-4,w-5,7);X.fill();
const g=X.createLinearGradient(0,0,0,w);g.addColorStop(0,'#fff6');g.addColorStop(.5,'#fff0');g.addColorStop(1,'#0008');X.fillStyle=g;X.fill();X.strokeStyle='#000a';X.lineWidth=1.5;X.stroke();X.globalAlpha=1;X.font=w*.55+'px serif';X.fillStyle='#000';X.fillText(d.e,w/2,w*.66)}
X.restore();X.globalAlpha=1;
if(rc){const a=b.fa||0,fx_=x+w/2+Math.cos(a)*w*.42,fy_=y+w*.45+Math.sin(a)*w*.3,g=X.createRadialGradient(fx_,fy_,0,fx_,fy_,9*rc+3);g.addColorStop(0,`rgba(255,240,170,${.9*rc})`);g.addColorStop(1,'rgba(255,140,40,0)');X.fillStyle=g;X.fillRect(fx_-12,fy_-12,24,24)}
if(!BT||b.l>1||b.t!='cp'){X.fillStyle='#f2c14e';X.beginPath();X.arc(x+9,y+9,7,0,7);X.fill();X.strokeStyle='#6b4310';X.lineWidth=1;X.stroke();X.fillStyle='#2a1707';X.font='bold 9px sans-serif';X.fillText(b.l,x+9,y+12)}
if(b.up>now()){X.fillStyle='#0009';X.fillRect(x+2,y+2,w-4,w-5);X.fillStyle='#ffd';X.font='11px sans-serif';X.fillText('⏳'+Math.ceil((b.up-now())/1000)+'s',x+w/2,y+w/2+4);const pr=1-(b.up-now())/((d.t*(b.l+1)*1000)||1);X.fillStyle='#000a';X.fillRect(x+4,y+w-11,w-8,6);X.fillStyle='#6f6';X.fillRect(x+4,y+w-11,(w-8)*Math.max(0,Math.min(1,pr)),6)}
if(d.rate&&b.st>=10){X.font='14px serif';X.fillText('❗',x+w-8,y+12+Math.sin(now()/150)*2)}
if(b.mhp&&b.hp<b.mhp){X.fillStyle='#300';X.fillRect(x+2,y-5,w-4,4);X.fillStyle='#5e5';X.fillRect(x+2,y-5,(w-4)*Math.max(0,b.hp)/b.mhp,4)}}
// Troops: walk cycle (hop + lean + step squash keyed to distance walked), idle breathing, attack lunge
function dU(u){const d=TR[u.k],f=d.fly,mv=u.mv>0,an=SET.anim,ph=u.ph,t=now();
const sw=Math.sin(ph*Math.PI*1.0),hop=an?(mv?Math.abs(sw)*(f?1.5:3.2):Math.sin(t/320+ph)*.5):0;
let ox=0,oy=0,sc=1;if(u.atk>0&&an){const k=Math.sin((1-u.atk/.25)*Math.PI);ox=Math.cos(u.ad)*k*(d.rng>2?1:4);oy=Math.sin(u.ad)*k*(d.rng>2?1:3);sc=1+k*.12}
const z=f?28:d.hero||u.k=='gi'||u.k=='pk'?26:20,im=IMG['t_'+u.k],px=u.x*T,py=u.y*T;
X.fillStyle='#0005';X.beginPath();X.ellipse(px,py+6,6*(f?1.1:1)-(f?hop*.4:0),3,0,0,7);X.fill();
X.save();if(u.cloak>0)X.globalAlpha=.4;
X.translate(px+ox,py+6+oy-(f?8:0)-hop);X.rotate(an&&mv?sw*.11*u.fx:0);X.scale(sc*(u.fx<0?-1:1)*(1+(mv&&an?Math.abs(sw)*.05:0)),sc*(1-(mv&&an?Math.abs(sw)*.05:0)));
if(ok(im))X.drawImage(im,-z/2,-z*.6-6,z,z);else{X.font=(f?22:16)+'px serif';X.fillText(d.e,0,-1)}
X.restore();
if(u.rage>0){X.strokeStyle='#f4a';X.lineWidth=2;X.beginPath();X.arc(px,py,9,0,7);X.stroke()}
if(u.cloak>0){X.strokeStyle='#c8f';X.lineWidth=1.5;X.setLineDash([3,3]);X.beginPath();X.arc(px,py,10,0,7);X.stroke();X.setLineDash([])}
X.fillStyle='#300';X.fillRect(px-8,py-13-(f?8:0),16,3);X.fillStyle='#5e5';X.fillRect(px-8,py-13-(f?8:0),16*Math.max(0,u.hp)/u.mhp,3)}
function draw(){X.save();if(BT&&BT.sk>0&&SET.shake)X.translate((Math.random()-.5)*5,(Math.random()-.5)*5);X.textAlign='center';X.fillStyle='#35561f';X.fillRect(0,0,T*N,T*N);X.drawImage(GI||G,0,0);
const bl=BT?BT.bl:S.b,mvB=!BT&&mode=='move'&&sel?sel:null;(BT?BT.ob||[]:S.ob).forEach(dOb);
if(!BT&&cartFull()){X.font='34px serif';X.fillText('🛒',2*T,27.3*T+Math.sin(now()/400)*1.5);X.font='bold 9px sans-serif';X.fillStyle='#fff';X.strokeStyle='#000';X.lineWidth=3;const tx=S.cart.g+S.cart.e;X.strokeText(tx,2*T,28.4*T);X.fillText(tx,2*T,28.4*T)}
// draw back-to-front so tall sprites overlap correctly (walls and bombs first)
bl.filter(b=>b!==mvB&&(b.t=='wl'||b.t=='bm'||b.dead)).forEach(dB);bl.filter(b=>b!==mvB&&b.t!='wl'&&b.t!='bm'&&!b.dead).sort((a,b)=>a.y+DEF[a.t].s-b.y-DEF[b.t].s).forEach(dB);
if(!BT&&sel&&!mode){const d=DEF[sel.t];X.strokeStyle='#fd6';X.lineWidth=2;X.strokeRect(sel.x*T,sel.y*T,d.s*T,d.s*T)}
if(!BT&&mode&&ptr){const d=DEF[mode=='place'?place:sel.t],x=Math.max(0,Math.min(N-d.s,Math.floor(ptr[0])-(d.s>>1))),y=Math.max(0,Math.min(N-d.s,Math.floor(ptr[1])-(d.s>>1)));if(mode=='move'){X.strokeStyle='#fff8';X.lineWidth=1.5;X.setLineDash([4,3]);X.strokeRect(sel.x*T+1,sel.y*T+1,d.s*T-2,d.s*T-2);X.setLineDash([])}   // old spot
X.fillStyle=free(x,y,d.s,mode=='move'?sel:null)?'#4f48':'#f448';X.fillRect(x*T,y*T,d.s*T,d.s*T);
if(mode=='move'){X.globalAlpha=.85;dB({...sel,x,y,fire:0,up:0});X.globalAlpha=1}}
if(BT){BT.tr.slice().sort((a,b)=>a.y-b.y).forEach(dU);
BT.fx.forEach(f=>{if(f.k=='t'){X.font='bold 11px sans-serif';X.fillStyle='#fff';X.strokeStyle='#000';X.lineWidth=3;const yy=f.y1*T-(.7-f.t)*18;X.strokeText(f.txt,f.x1*T,yy);X.fillText(f.txt,f.x1*T,yy);return}if(f.k=='l'){X.strokeStyle=f.c||'#fff';X.lineWidth=f.w||2;X.beginPath();X.moveTo(f.x1*T,f.y1*T);X.lineTo(f.x2*T,f.y2*T);X.stroke()}
else{const cx=f.x1*T,cy=f.y1*T,g=X.createRadialGradient(cx,cy,0,cx,cy,f.r*T);g.addColorStop(0,f.c);g.addColorStop(1,'#0000');X.globalAlpha=Math.min(1,f.t*3);X.fillStyle=g;X.beginPath();X.arc(cx,cy,f.r*T,0,7);X.fill();X.globalAlpha=1}})}
drawPT();
if(BT&&!BT.end&&ptr&&BT.sel){X.strokeStyle='#fff9';X.lineWidth=2;X.beginPath();X.arc(ptr[0]*T,ptr[1]*T,TR[BT.sel]?9:BT.sel=='cc'?9:(BT.sel=='li'?2.5*T:3*T),0,7);X.stroke()}
drawTint(bl);
const v=X.createRadialGradient(330,330,220,330,330,470);v.addColorStop(0,'#0000');v.addColorStop(1,dayTint().night>.3?'#0004':'#0008');X.fillStyle=v;X.fillRect(0,0,660,660);X.restore()}
let lt=0;function loop(t){const dt=Math.min(.05,(t-lt)/1000||0);lt=t;if(BT&&!BT.end)sim(dt*(BT.spd||1));ptStep(dt);try{draw()}catch(e){console.error(e);X.setTransform(1,0,0,1,0,0);X.globalAlpha=1;X.globalCompositeOperation='source-over';X.setLineDash([])}requestAnimationFrame(loop)}
