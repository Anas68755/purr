// Sound: sound effects (Howler.js, optional CDN) + generated background music (Web Audio, no files needed).
// Volume / mute live in SET and are saved between visits.
function wav(f,d,o={}){const r=22050,L=r*d|0,b=new Uint8Array(44+L),v=new DataView(b.buffer),W=(p,x)=>[...x].forEach((c,i)=>b[p+i]=c.charCodeAt(0));
W(0,'RIFF');v.setUint32(4,36+L,true);W(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,r,true);v.setUint32(28,r,true);v.setUint16(32,1,true);v.setUint16(34,8,true);W(36,'data');v.setUint32(40,L,true);
for(let i=0;i<L;i++){const k=i/L,ph=2*Math.PI*(f+(o.s||0)*k)*i/r,x=o.n?Math.random()*2-1:(o.q?Math.sign(Math.sin(ph)):Math.sin(ph));b[44+i]=128+x*(1-k)*70}
let s='';b.forEach(c=>s+=String.fromCharCode(c));return 'data:audio/wav;base64,'+btoa(s)}
const SFX={s:{},play(k){if(!SET.mute&&this.s[k])this.s[k].play()},vol(){for(const k in this.s)this.s[k].volume(SET.sv*.5);if(window.Howler)Howler.mute(!!SET.mute)}};
if(window.Howl){const D={click:[660,.06,{q:1}],place:[300,.12,{s:150}],coin:[880,.18,{s:700}],boom:[110,.3,{n:1}],win:[520,.6,{s:420}],lose:[300,.6,{s:-220,q:1}],ding:[1040,.22,{s:500}]};
for(const k in D)SFX.s[k]=new Howl({src:[wav(...D[k])],format:['wav'],volume:SET.sv*.5})}
SFX.vol();
// ---- Music: a looping chord/arpeggio/bass/drum sequencer. Calm theme at home, faster one in battle.
const MU={ctx:null,g:null,mood:'home',st:0,nt:0,tm:null,nz:null,
 SONG:{home:{bpm:84,ch:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],mel:[[72,0,76,0,74,72,0,67],[69,0,72,0,71,69,0,65],[67,0,72,0,71,67,0,64],[67,0,71,0,69,67,0,62]],drum:0},
       battle:{bpm:132,ch:[[50,53,57],[46,50,53],[53,57,60],[48,52,55]],mel:[[74,0,77,74,81,0,77,74],[70,0,74,70,77,0,74,70],[72,0,77,72,81,0,77,72],[72,0,76,72,79,0,76,72]],drum:1}},
 init(){if(this.ctx)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;this.ctx=new A();this.g=this.ctx.createGain();this.g.connect(this.ctx.destination);
  const c=this.ctx,b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nz=b;this.vol()},
 vol(){if(!this.g)return;this.g.gain.setTargetAtTime(SET.mute||!SET.music?0:SET.mv*.4,this.ctx.currentTime,.05)},
 start(){this.init();if(!this.ctx)return;if(this.ctx.state=='suspended')this.ctx.resume();if(!this.tm){this.nt=this.ctx.currentTime+.1;this.tm=setInterval(()=>this.pump(),100)}},
 setMood(m){if(m!=this.mood){this.mood=m;this.st=0}},
 note(m,t,len,type,vol,lp){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=440*Math.pow(2,(m-69)/12);
  let out=g;if(lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=lp;g.connect(f);out=f}
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+len);o.connect(g);out.connect(this.g);o.start(t);o.stop(t+len+.05)},
 drum(t,kind){const c=this.ctx;if(kind=='k'){const o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(40,t+.15);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g);g.connect(this.g);o.start(t);o.stop(t+.25)}
  else{const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.nz;f.type='highpass';f.frequency.value=kind=='s'?1500:6000;g.gain.setValueAtTime(kind=='s'?.35:.08,t);g.gain.exponentialRampToValueAtTime(.001,t+(kind=='s'?.12:.04));s.connect(f);f.connect(g);g.connect(this.g);s.start(t);s.stop(t+.15)}},
 pump(){if(!this.ctx||this.ctx.state!='running'||SET.mute||!SET.music)return;const S_=this.SONG[this.mood],e=60/S_.bpm/2;
  if(this.nt<this.ctx.currentTime-.5)this.nt=this.ctx.currentTime+.05;
  while(this.nt<this.ctx.currentTime+.3){const i=this.st%32,bar=(i>>3)&3,s=i&7,ch=S_.ch[bar],t=this.nt;
   if(s%4==0)this.note(ch[0]-12,t,e*(S_.drum?1.6:3.6),S_.drum?'sawtooth':'sine',S_.drum?.25:.5,S_.drum?500:0);
   if(S_.drum&&s%2==1)this.note(ch[0]-12,t,e*.8,'sawtooth',.2,500);
   this.note(ch[s%3]+(s>2&&s<6?12:0),t,e*1.4,'triangle',.18);
   const m=S_.mel[bar][s];if(m)this.note(m,t,e*1.8,'square',.07,1800);
   if(S_.drum){if(s%4==0)this.drum(t,'k');if(s%4==2)this.drum(t,'s');this.drum(t,'h')}
   this.nt+=e;this.st++}}};
const unlockAudio=()=>{MU.start();removeEventListener('pointerdown',unlockAudio);removeEventListener('keydown',unlockAudio)};
addEventListener('pointerdown',unlockAudio);addEventListener('keydown',unlockAudio);
function applyAudio(){SFX.vol();MU.vol();$('mute').textContent=SET.mute?'🔇':'🔊'}
$('mute').onclick=()=>{SET.mute=SET.mute?0:1;saveSet();applyAudio();if(!SET.mute)MU.start()};
applyAudio();
