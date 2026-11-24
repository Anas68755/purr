// Cloud save through Supabase (Auth + PostgREST over plain fetch, no libraries).
// The player types any address shaped like xxx@xxx.xxx (it may be fake). It is only an account name:
// we hash it into an internal address so Supabase never sees (or rejects) the typed domain.
const CL=(()=>{
const KEY='cok_cloud',on=()=>!!(CLOUD.url&&CLOUD.key);
let st=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}})();
const keep=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
const okMail=s=>/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s)&&s.length<=120;
async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const inner=async m=>(await sha('cok:'+m.trim().toLowerCase())).slice(0,40)+'@'+CLOUD.domain;
const hdr=tok=>({apikey:CLOUD.key,Authorization:'Bearer '+(tok||CLOUD.key),'Content-Type':'application/json'});
async function api(path,opt={},tok){const r=await fetch(CLOUD.url.replace(/\/$/,'')+path,Object.assign({headers:hdr(tok)},opt));
let j=null;try{j=await r.json()}catch(e){}
if(!r.ok){const m=(j&&(j.msg||j.error_description||j.message||j.error))||('HTTP '+r.status);const e=new Error(m);e.code=r.status;e.j=j;throw e}return j}
function sess(j){st.at=j.access_token;st.rt=j.refresh_token;st.exp=Date.now()+(j.expires_in||3600)*1000-60000;st.uid=j.user&&j.user.id||st.uid;keep()}
async function token(){if(!st.rt)throw new Error('Not signed in');
if(!st.at||Date.now()>st.exp){try{sess(await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:st.rt})}))}
catch(e){if(e.code==400||e.code==401){st={};keep()}throw e}}return st.at}
// fingerprint of what the player did (ignores values that change every tick: clock, mine stock, resources)
const fpS=()=>{const c=Object.assign({},S,{last:0,g:0,e:0,b:S.b.map(b=>Object.assign({},b,{st:0}))});const t=JSON.stringify(c);let h=5381;for(let i=0;i<t.length;i++)h=(h*33^t.charCodeAt(i))>>>0;return h+':'+t.length};
const brief=d=>{const b=(d.b||[]).find(x=>x.t=='th');return`🏰 TH ${b&&b.l||1} · 🏆 ${d.tr||0} · ⭐ Lv ${d.lv||1} · 💰 ${Math.floor(d.g||0)}`};
async function fetchRow(){const tok=await token();const r=await api('/rest/v1/saves?select=data,updated_at&limit=1',{},tok);return r&&r[0]||null}
async function push(){const tok=await token();const body={user_id:st.uid,data:S,updated_at:new Date().toISOString()};
await api('/rest/v1/saves?on_conflict=user_id',{method:'POST',headers:Object.assign(hdr(tok),{Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(body)});
st.h=fpS();st.sync=Date.now();st.err='';keep()}
let busy=0;
async function sync(force){if(!on()||!st.rt||busy||BT)return;busy=1;
try{if(force||fpS()!=st.h){await push();if(PK=='cloud')ui()}}catch(e){st.err=e.message;keep();if(PK=='cloud')ui()}busy=0}
async function auth(mail,pw,create){
if(!on())throw new Error('Cloud save is not configured');
if(!okMail(mail))throw new Error('Use an address like name@site.com (it can be made up)');
if((pw||'').length<6)throw new Error('Password needs at least 6 characters');
const email=await inner(mail),body=JSON.stringify({email,password:pw});let j;
if(create){j=await api('/auth/v1/signup',{method:'POST',body});if(!j.access_token)throw new Error('Supabase still requires email confirmation. Turn it off (see CLOUD_SETUP.md)')}
else j=await api('/auth/v1/token?grant_type=password',{method:'POST',body});
st={mail:mail.trim().toLowerCase()};sess(j);
const row=await fetchRow();
if(!row){await push();toast('☁️ Account ready, village saved');return'new'}
// existing cloud save: decide
const same=JSON.stringify(row.data).length&&brief(row.data)==brief(S)&&row.data.last==S.last;
if(same){st.h=fpS();keep();return'same'}
st.pend=row;return'conflict'}
function ui(){const c=$('pn');if(PK!='cloud')return;cloud()}
function conflictHtml(){const r=st.pend;return`<h3>☁️ Which village to keep?</h3><p><small>This account already has a saved village.</small></p>
<div class=r><span>☁️ <b>Cloud</b><br><small>${brief(r.data)}<br>saved ${new Date(r.updated_at).toLocaleString()}</small></span><button onclick="CL.useCloud()">Use cloud</button></div>
<div class=r><span>📱 <b>This device</b><br><small>${brief(S)}</small></span><button onclick="CL.useLocal()">Use this</button></div>
<p><small>The one you do not choose is overwritten.</small></p>`}
return{on,st:()=>st,okMail,sync,auth,fpS,
async login(create){const m=$('cm').value,p=$('cp_').value;$('ce').textContent='…';
try{const r=await auth(m,p,create);if(r=='conflict')return cloud();cloud()}catch(e){$('ce').textContent='⚠️ '+(e.code==400&&!create?'Wrong address or password':e.code==422||/already/i.test(e.message)?'This address already has an account — use Sign in':e.message)}},
useCloud(){const r=st.pend;if(!r)return;try{localStorage.setItem('cok2',JSON.stringify(r.data))}catch(e){}st.pend=null;st.h=null;keep();
// reload with the cloud village; fingerprint is stored after load in init()
st.adopt=1;keep();location.reload()},
async useLocal(){st.pend=null;try{await push();toast('☁️ Cloud updated from this device')}catch(e){st.err=e.message;keep()}cloud()},
out(){st={};keep();cloud()},
html(){const on_=on();if(!on_)return'<p><small>Cloud save is not set up in this copy. Add your Supabase URL and key in js/cloud-config.js (see CLOUD_SETUP.md).</small></p>';
if(st.pend)return conflictHtml();
if(st.rt)return`<div class=r><span>✅ Signed in<br><small>${st.mail||''}</small></span><button onclick="CL.out()">Sign out</button></div>
<div class=r><span><small>${st.sync?'Last sync '+new Date(st.sync).toLocaleTimeString():'Not synced yet'}${st.err?'<br>⚠️ '+st.err:''}</small></span><button onclick="CL.now()">Sync now</button></div>
<p><small>Saves automatically every minute and when you leave the page.</small></p>`;
return`<p><small>Pick any address like <b>name@site.com</b> (it can be fake) and a password. There is no password recovery, so remember them.</small></p>
<input id=cm placeholder="name@site.com" autocomplete=username style="width:100%;margin:3px 0"><input id=cp_ type=password placeholder="password (6+ chars)" autocomplete=current-password style="width:100%;margin:3px 0">
<div class=r><span id=ce><small></small></span><span><button onclick="CL.login(0)">Sign in</button> <button onclick="CL.login(1)">Create account</button></span></div>`},
async now(){await sync(1);cloud()},
init(){if(!on()||!st.rt)return;
if(st.adopt){st.adopt=0;st.h=fpS();st.sync=Date.now();keep();toast('☁️ Cloud village loaded');return}
// pull on start: if the cloud copy is newer than our last sync and this device did not change since, load it
token().then(fetchRow).then(row=>{if(!row)return;const ct=Date.parse(row.updated_at);
if(ct>(st.sync||0)+2000){if(fpS()==st.h){localStorage.setItem('cok2',JSON.stringify(row.data));st.adopt=1;keep();location.reload()}
else{st.pend=row;keep();cloud()}}}).catch(e=>{st.err=e.message;keep()});
setInterval(()=>sync(),60000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)sync()});addEventListener('pagehide',()=>{sync()})}}})();
function cloud(){closeP();let h='<h3>☁️ Cloud save</h3>'+CL.html();P(h+'<button onclick="closeP()">Close</button>','cloud')}
