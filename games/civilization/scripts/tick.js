import { createClient } from '@supabase/supabase-js';
import { serializeWorld, deserializeWorld, createInitialWorld, SAVE_VERSION } from './world.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const JSON_PATH  = path.join(PUBLIC_DIR, 'world.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// سطر التهيئة هذا هو الأهم: لا يحتوي على أي كلمة ws
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const TABLE = 'world_state';

const TICK_MS_TARGET = 5 * 60 * 1000;
const TICKS_MIN = 1;
const TICKS_MAX = 50;

async function main() {
  const { data, error } = await sb.from(TABLE).select('*').eq('id', 1).maybeSingle();
  if (error) { 
    console.error('خطأ في القراءة:', error); 
    process.exit(1); 
  }

  let w;

  if (!data || !data.data || typeof data.data.year !== 'number') {
    console.log('🌱 إنشاء عالم جديد');
    w = createInitialWorld();
    const { error: e } = await sb.from(TABLE).upsert({
      id: 1, 
      version: SAVE_VERSION,
      data: serializeWorld(w),
      last_tick: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (e) { console.error('خطأ في الإنشاء:', e); process.exit(1); }
  } else {
    if (data.version !== SAVE_VERSION) {
      console.warn(`⚠️ نسخة قديمة (${data.version} ≠ ${SAVE_VERSION})`);
      return;
    }
    const elapsed = Date.now() - new Date(data.last_tick).getTime();
    const ticks = Math.max(TICKS_MIN, Math.min(TICKS_MAX, Math.floor(elapsed / TICK_MS_TARGET)));
    w = deserializeWorld(data.data);
    for (let i = 0; i < ticks; i++) w.tick();
    
    const { error: e } = await sb.from(TABLE).update({
      data: serializeWorld(w),
      last_tick: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', 1);
    if (e) { console.error('خطأ في التحديث:', e); process.exit(1); }
  }

  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(serializeWorld(w)), 'utf8');

  console.log(`✅ السنة ${w.year} · ${w.totalAlive()} شخص · ${w.kingdoms.length} مملكة`);
}

main().catch(e => { 
  console.error('خطأ غير متوقع:', e); 
  process.exit(1); 
});
