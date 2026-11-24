# إعداد الحفظ السحابي (Supabase مجاني + GitHub Pages)

## 1) أنشئ مشروع Supabase
1. ادخل supabase.com ← New project (الخطة المجانية). اختر أي اسم وكلمة سر لقاعدة البيانات واحفظها.
2. **Authentication ← Providers ← Email**: عطّل **Confirm email** (مهم جداً، لأن البريد وهمي ولن يصل إليه شيء). احفظ.
3. **SQL Editor ← New query**: الصق محتوى الملف `supabase/setup.sql` ثم Run. (ينشئ جدول `saves` ويحمي كل لاعب بحيث لا يرى إلا حفظه.)
4. **Project Settings ← API**: انسخ `Project URL` و `anon public key`.

## 2) اربطهما باللعبة
افتح `js/cloud-config.js` وضع القيمتين:
```js
const CLOUD={url:'https://xxxx.supabase.co',key:'eyJ...anon...',domain:'players.cokgame.app'};
```
مفتاح anon عام بطبيعته ولا بأس بنشره؛ الحماية تأتي من سياسات الجدول (RLS). **لا تضع أبداً service_role key.**

## 3) انشر على GitHub Pages
ارفع كل الملفات لمستودع ← Settings ← Pages ← Deploy from branch (main / root).

## 4) منع إيقاف المشروع (اختياري لكن مهم)
الخطة المجانية توقف المشروع بعد أسبوع بلا نشاط. في المستودع: Settings ← Secrets and variables ← Actions، أضف `SUPABASE_URL` و `SUPABASE_ANON_KEY`؛ الملف `.github/workflows/keepalive.yml` سيرسل طلباً كل 3 أيام.

## كيف يعمل
- اللاعب يكتب أي بريد بصيغة `xxx@xxx.xxx` (حتى لو وهمي) وكلمة سر (6+ أحرف). البريد مجرد اسم حساب: تُحوَّل إلى بصمة SHA-256 قبل الإرسال فلا يرى Supabase النطاق الذي كتبه اللاعب.
- الحفظ تلقائي كل دقيقة وعند مغادرة الصفحة، ومن زر ⚙️ ← ☁️ يمكن المزامنة يدوياً.
- عند الدخول من جهاز جديد وفي الحسابين قرية مختلفة تظهر شاشة تسأل أي قرية تُبقي.
- **لا توجد استعادة كلمة السر** (البريد وهمي). من نسي كلمته يخسر الحساب؛ زر Export في الإعدادات نسخة احتياطية.
- حجم الحفظ الواحد صغير (عشرات KB) والجدول يرفض أكثر من 300KB، فالخطة المجانية (500MB) تكفي آلاف الحسابات.
- ملاحظة: يمكن لأي شخص إنشاء حسابات كثيرة؛ إن امتلأت القاعدة راقب Database ← Usage.
- زر Reset game أثناء تسجيل الدخول سيرفع القرية الجديدة فوق السحابية عند المزامنة التالية.

# English summary
Create a free Supabase project, disable *Confirm email* (Auth → Providers → Email), run `supabase/setup.sql`, paste the Project URL and anon key into `js/cloud-config.js`, deploy to GitHub Pages. Players sign up with any `xxx@xxx.xxx` string (fake is fine, it is hashed locally); no password recovery. Add the keepalive secrets so the free project is not paused.
