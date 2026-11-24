// Settings panel: sound, speed, display options, save management
const onoff=v=>v?'On':'Off';
function setS(k,v){SET[k]=v;saveSet();if(k=='mute'||k=='music'||k=='mv'||k=='sv'){applyAudio();if(!SET.mute&&SET.music)MU.start()}settings()}
function settings(){closeP();const sc=PK=='set'?$('pn').scrollTop:0;
const row=(l,c)=>`<div class=r><span>${l}</span><span>${c}</span></div>`,tg=(k,l)=>row(l,`<button onclick="setS('${k}',${SET[k]?0:1})">${onoff(SET[k])}</button>`);
const sl=(k,fn)=>`<input type=range min=0 max=100 value="${Math.round(SET[k]*100)}" oninput="SET.${k}=this.value/100;saveSet();${fn}">`;
let h='<h3>⚙️ Settings</h3>'+row('🔊 Sound (all)',`<button onclick="setS('mute',${SET.mute?0:1})">${SET.mute?'Muted':'On'}</button>`)
+row('🎵 Music',`<button onclick="setS('music',${SET.music?0:1})">${onoff(SET.music)}</button>`)
+row('Music volume',sl('mv','MU.vol()'))+row('Effects volume',sl('sv','SFX.vol()'))
+row('⏩ Battle speed',[1,2,3].map(v=>`<button class="${SET.speed==v?'on':''}" onclick="setS('speed',${v})">${v}x</button>`).join(' '))
+row('🌗 Day / night',[['day','Off (day)'],['auto','Follow clock'],['dusk','Dusk'],['night','Night']].map(([v,t])=>`<button class="${SET.dm==v?'on':''}" onclick="setS('dm','${v}')">${t}</button>`).join(' '))
+tg('anim','🎞️ Animations')+tg('fx','✨ Particles')+tg('shake','📳 Screen shake')
+'<p><small>The day/night tint is off by default; Follow clock dims the map at dusk and night. Settings are saved on this device and are not touched by Reset.</small></p>'
+row('☁️ Cloud save',`<button onclick="cloud()">${CL.st().rt?'✅ '+(CL.st().mail||'Account'):CL.on()?'Sign in':'Not set up'}</button>`)
+'<div class=r><span>💾 Save</span><span><button onclick="exportSave()">Export</button> <button onclick="importSave()">Import</button></span></div>'
+'<div class=r><span>⚠️ Danger zone</span><button onclick="if(confirm(\'Erase your village and start over? This cannot be undone.\')){newGame();toast(\'New game started\')}">Reset game</button></div>';
P(h+'<button onclick="closeP()">Close</button>','set');$('pn').scrollTop=sc}
