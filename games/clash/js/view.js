// Map input: tap, drag-to-pan and pinch / wheel / button zoom (works for the village and for battles).
// Zoom is a CSS transform on the canvas, so tile() keeps working through getBoundingClientRect().
const VW={z:1,x:0,y:0};
function applyView(){const lim=(VW.z-1)*C.offsetWidth/2;VW.x=Math.max(-lim,Math.min(lim,VW.x));VW.y=Math.max(-lim,Math.min(lim,VW.y));
C.style.transform=VW.z>1.001?`translate(${VW.x}px,${VW.y}px) scale(${VW.z})`:'';$('w').classList.toggle('zm',VW.z>1.001)}
function zoomAt(nz,cx,cy){nz=Math.max(1,Math.min(3,nz));const r=C.getBoundingClientRect(),dx=cx-(r.left+r.width/2),dy=cy-(r.top+r.height/2),k=nz/VW.z;
VW.x+=dx-dx*k;VW.y+=dy-dy*k;VW.z=nz;if(nz==1){VW.x=VW.y=0}applyView()}
const zoomC=f=>{const r=C.getBoundingClientRect();zoomAt(VW.z*f,r.left+r.width/2,r.top+r.height/2)};
const PS=new Map();let gs=null;
const pinch=()=>{const[a,b]=[...PS.values()];return{d:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2}};
C.addEventListener('pointerdown',e=>{try{C.setPointerCapture(e.pointerId)}catch(_){}
PS.set(e.pointerId,{x:e.clientX,y:e.clientY});ptr=tile(e);
if(PS.size==1)gs={sx:e.clientX,sy:e.clientY,moved:0,pinch:0,pan:0};
else if(PS.size==2&&gs){gs.pinch=1;gs.last=pinch()}});
C.addEventListener('pointermove',e=>{const p=PS.get(e.pointerId);
if(!p){ptr=tile(e);return}
if(PS.size==2&&gs){p.x=e.clientX;p.y=e.clientY;const n=pinch(),l=gs.last;zoomAt(VW.z*n.d/l.d,n.cx,n.cy);VW.x+=n.cx-l.cx;VW.y+=n.cy-l.cy;applyView();gs.last=n;return}
const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
if(gs){gs.moved=Math.max(gs.moved,Math.hypot(e.clientX-gs.sx,e.clientY-gs.sy));
 if(VW.z>1.001&&gs.moved>8){gs.pan=1;VW.x+=dx;VW.y+=dy;applyView();return}}
ptr=tile(e)});
const upEv=e=>{const had=PS.delete(e.pointerId);if(!had||!gs)return;
if(e.type=='pointerup'&&!gs.pinch&&!gs.pan&&gs.moved<10){const[fx,fy]=tile(e);onTap(fx,fy)}
if(!PS.size)gs=null};
C.addEventListener('pointerup',upEv);C.addEventListener('pointercancel',upEv);
C.addEventListener('wheel',e=>{e.preventDefault();zoomAt(VW.z*(e.deltaY<0?1.15:1/1.15),e.clientX,e.clientY)},{passive:false});
addEventListener('resize',applyView);
