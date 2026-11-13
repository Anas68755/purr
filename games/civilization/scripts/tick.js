import { createClient } from '@supabase/supabase-js';
import { serializeWorld, deserializeWorld, createInitialWorld, SAVE_VERSION } from './world.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// تحديد مسار مجلد public بشكل صحيح
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const JSON_PATH  = path.join(PUBLIC_DIR, 'world.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// تهيئة عميل Supabase (بدون أي إعدادات WebSocket إضافية لأن Node 22 يدعمها)
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const TABLE = 'world_state';

// إعدادات سرعة العالم
const TICK_MS_TARGET = 5 * 60 * 1000; // سنة كل 5 دقائق
const TICKS_MIN = 1;
const TICKS_MAX = 50; // حد أقصى لمنع القفزات الهائلة إذا تأخر التشغيل

async function main() {
  // 1. محاولة قراءة الحالة الحالية من Supabase
  const { data, error } = await sb.from(TABLE).select('*').eq('id', 1).maybeSingle();
  if (error) { 
    console.error('خطأ في القراءة من Supabase:', error); 
    process.exit(1); 
  }

  let w;

  // 2. إذا لم يوجد عالم، نقوم بإنشاء عالم جديد
  if (!data || !data.data || !data.data.year) {
    console.log('🌱 إنشاء عالم جديد');
    w = createInitialWorld();
    const { error: e } = await sb.from(TABLE).upsert({
      id: 1, 
      version: SAVE_VERSION,
      data: serializeWorld(w),
      last_tick: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (e) { 
      console.error('خطأ في إنشاء العالم:', e); 
      process.exit(1); 
    }
  } else {
    // 3. إذا كان العالم موجوداً، نتحقق من الإصدار ونقوم بتطويره
    if (data.version !== SAVE_VERSION) {
      console.warn(`⚠️ نسخة قديمة (${data.version} ≠ ${SAVE_VERSION})`);
      return;
    }
    
    // حساب كم سنة يجب أن تمر بناءً على الوقت المنقضي
    const elapsed = Date.now() - new Date(data.last_tick).getTime();
    const ticks = Math.max(TICKS_MIN, Math.min(TICKS_MAX, Math.floor(elapsed / TICK_MS_TARGET)));
    
    w = deserializeWorld(data.data);
    for (let i = 0; i < ticks; i++) w.tick();
    
    // حفظ الحالة الجديدة في Supabase
    const { error: e } = await sb.from(TABLE).update({
      data: serializeWorld(w),
      last_tick: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', 1);
    if (e) { 
      console.error('خطأ في تحديث العالم:', e); 
      process.exit(1); 
    }
  }

  // 4. كتابة ملف world.json ليقرأه المتصفح
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(serializeWorld(w)), 'utf8');

  console.log(`✅ السنة ${w.year} · ${w.totalAlive()} شخص · ${w.kingdoms.length} مملكة`);
}

main().catch(e => { 
  console.error('خطأ غير متوقع:', e); 
  process.exit(1); 
});
