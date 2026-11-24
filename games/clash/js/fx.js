// Particles (dust, debris, sparkles) and the day/night tint. Positions are in tile units.
const PT=[];
function puff(x,y,n=10,s=1){if(!SET.fx)return;if(PT.length>350)return;
for(let i=0;i<n;i++){const a=Math.random()*6.28,v=.4+Math.random()*1.4*s;
PT.push({k:'d',x:x+(Math.random()-.5)*s*.8,y:y+(Math.random()-.5)*s*.5,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.6-.25,l:.7+Math.random()*.5,m:1.2,r:.18+Math.random()*.25*s,c:Math.random()<.5?'#c9b99a':'#9c8f78'})}
for(let i=0;i<Math.min(8,n/2);i++){const a=Math.random()*6.28,v=1+Math.random()*2;PT.push({k:'f',x,y,vx:Math.cos(a)*v,vy:-1.5-Math.random()*2,l:.6+Math.random()*.3,m:.9,r:.07+Math.random()*.06,c:Math.random()<.5?'#6b4a2a':'#8a8a92'})}}
function spark(x,y,c='#ffe27a',n=8){if(!SET.fx)return;for(let i=0;i<n;i++)PT.push({k:'s',x:x+(Math.random()-.5)*1.4,y:y+(Math.random()-.5)*1.2,vx:(Math.random()-.5)*.5,vy:-.5-Math.random()*.9,l:.7+Math.random()*.6,m:1.3,r:.12+Math.random()*.1,c,tw:Math.random()*6})}
function ptStep(dt){for(let i=PT.length-1;i>=0;i--){const p=PT[i];p.l-=dt;if(p.l<=0){PT.splice(i,1);continue}
p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.k=='f')p.vy+=9*dt;else if(p.k=='d'){p.vx*=.96;p.vy*=.96}}}
function drawPT(){PT.forEach(p=>{const a=Math.max(0,p.l/p.m),x=p.x*T,y=p.y*T;
if(p.k=='d'){X.globalAlpha=a*.6;X.fillStyle=p.c;X.beginPath();X.arc(x,y,(p.r+(1-a)*.5)*T,0,7);X.fill()}
else if(p.k=='f'){X.globalAlpha=Math.min(1,a*2);X.fillStyle=p.c;X.fillRect(x,y,p.r*T,p.r*T)}
else{const r=p.r*T*(.7+.5*Math.sin(now()/90+p.tw));X.globalAlpha=Math.min(1,a*1.6);X.fillStyle=p.c;X.beginPath();X.moveTo(x,y-r*2);X.lineTo(x+r*.5,y-r*.5);X.lineTo(x+r*2,y);X.lineTo(x+r*.5,y+r*.5);X.lineTo(x,y+r*2);X.lineTo(x-r*.5,y+r*.5);X.lineTo(x-r*2,y);X.lineTo(x-r*.5,y-r*.5);X.closePath();X.fill()}});X.globalAlpha=1}
// ---- Day / night: multiply tint follows your local clock (Settings can force day or night)
const DK=[[0,[150,165,225]],[5,[150,165,225]],[6.5,[255,190,150]],[8,[255,255,255]],[17,[255,255,255]],[18.5,[255,176,125]],[20.5,[150,165,225]],[24,[150,165,225]]];
function dayHour(){return{day:12,dusk:19,night:0}[SET.dm]??(()=>{const d=new Date();return d.getHours()+d.getMinutes()/60})()}
function dayTint(){const h=dayHour();for(let i=1;i<DK.length;i++)if(h<=DK[i][0]){const[a,b]=[DK[i-1],DK[i]],f=(h-a[0])/(b[0]-a[0]);const c=a[1].map((v,j)=>Math.round(v+(b[1][j]-v)*f));return{c,night:Math.max(0,Math.min(1,(255-c[0])/120))}}return{c:[255,255,255],night:0}}
const LAMPS={th:1,cn:1,at:1,mo:1,ad:1,wt:1,it:1.4,cc:1,br:1,lb:1,cp:.7};
function drawTint(bl){const{c,night}=dayTint();if(night<=0&&c[2]>=250)return;
X.globalCompositeOperation='multiply';X.fillStyle=`rgb(${c})`;X.fillRect(0,0,T*N,T*N);
if(night>.25){X.globalCompositeOperation='lighter';bl.forEach(b=>{const k=LAMPS[b.t];if(!k||b.dead||(b.l===0))return;const s=DEF[b.t].s,cx=(b.x+s/2)*T,cy=(b.y+s*.55)*T,r=s*T*(.9+.08*Math.sin(now()/260+b.id))*k,g=X.createRadialGradient(cx,cy,0,cx,cy,r);
g.addColorStop(0,`rgba(255,190,90,${.55*night})`);g.addColorStop(1,'rgba(255,150,60,0)');X.fillStyle=g;X.fillRect(cx-r,cy-r,r*2,r*2)})}
X.globalCompositeOperation='source-over'}
