# 🐱 Gam Lub (purr)

**A playful universe of browser games.** Explore 19 games and interactive experiences through a 3D globe, discover something new with search, or browse the mobile-friendly game grid. From quick puzzles to arcade action, there’s always another game to try.

[Play Gam Lub](https://anas68755.github.io/purr/)

## Find your next favorite

Jump into a mix of playful challenges, strategy, puzzles, and interactive adventures—all in your browser.

### The collection

Truth or Dare (330+ English and 300+ Arabic prompts) · Chess Cards · Horror game · Void Breaker · Calc Chall · Purr Clicker · Clash Kingdoms · Catch The Cat · Tik Tak Toe · Civilization Evo Sim · الساحر الناجي · Shadowrise EN · CyberHack Sim · Russian Roulette · 2048 · Neon Monopoly X · Keyboar · Echo Cartographer · Bat in the Shadows

## Made for easy play

- Explore the collection through a 3D globe, search, or a mobile-friendly grid.
- Play directly in your browser—no installation required.
- Game progress, high scores, and saves are stored in your browser with `localStorage` and stay on that device.
- Civilization Evo Sim additionally keeps its world state in a free Supabase cloud table so the world keeps living between visits (see `games/civilization/scripts/tick.js`).
- Some games use external libraries or fonts, which require an internet connection.

## Project structure

Each game lives in its own folder under `games/<name>/` with a separate `index.html`, stylesheet, and scripts, so files stay small and easy to edit:

```
games/
  2048/           index.html · css/style.css · js/game.js
  survivor-ar/    index.html · css/style.css · js/game-01..03.js
  ...             15 games as real css/js folders (2048, calc-chall, keyboar,
                  echo, purch, purr-clicker, revolver, monopoly, tiktak,
                  bat-in-the-shadows, chard, truda, cack, survivor, survivor-ar)
  clash/          already a modular css/js game (left untouched)
  horror/         already a modular css/js game (left untouched)
  civilization/   the cloud-backed evolution sim (untouched core scripts)
```

The classic single-file versions (`games/<name>.html`) are now tiny redirect stubs pointing to their new folders, so every old URL keeps working. `clash/` and `horror/` were already modular multi-file games and were left untouched; the old shared runtime splitter (`games/_runtime/`) is no longer referenced by any page and has been removed.

---

## العربية

**عالم ممتع لألعاب المتصفح.** استكشف ١٩ لعبة وتجربة تفاعلية عبر كرة أرضية ثلاثية الأبعاد، واكتشف ألعابًا جديدة باستخدام البحث أو تصفح الشبكة المناسبة للهاتف. من الألغاز السريعة إلى ألعاب الحركة، هناك دائمًا لعبة جديدة لتجربتها.

[العب Gam Lub](https://anas68755.github.io/purr/)

### اكتشف لعبتك المفضلة

استمتع بمجموعة متنوعة من التحديات والألغاز وألعاب الاستراتيجية والمغامرات التفاعلية، مباشرةً في متصفحك.

### مجموعة الألعاب

حقيقة أم جرأة (أكثر من ٣٣٠ سؤالًا بالإنجليزية و٣٠٠ بالعربية) · بطاقات الشطرنج · الممر النفسي · محطم الفراغ · لعبة الحساب · نقرة القط · ممالك الصراع · أمسك القطة · إكس-أوه · محاكي تطور الحضارة · الساحر الناجي · Shadowrise بالإنجليزية · محاكي الاختراق الإلكتروني · الروليت الروسية · ٢٠٤٨ · مونوبولي نيون إكس · اختبار سرعة الكتابة · رسام خرائط الصدى · الخفاش في الظلال

### تجربة لعب سهلة

- استكشف الألعاب عبر الكرة ثلاثية الأبعاد أو البحث أو الشبكة الملائمة للهاتف.
- العب مباشرةً في المتصفح دون الحاجة إلى تثبيت.
- يُحفَظ التقدم وأعلى النتائج وملفات الحفظ في `localStorage` وتبقى على الجهاز نفسه.
- محاكي الحضارة يحفظ حالة العالم في جدول Supabase مجاني حتى يستمر العالم في النمو بين الزيارات (انظر `games/civilization/scripts/tick.js`).
- تستخدم بعض الألعاب مكتبات أو خطوطًا خارجية، وقد تحتاج هذه الميزات إلى اتصال بالإنترنت.

## بنية المشروع

كل لعبة لها مجلدها الخاص تحت `games/<name>/` بملف `index.html` وملفات أنماط وسكربتات منفصلة، لتسهيل التعديل وتقليل حجم الملفات:

```
games/
  2048/           index.html · css/style.css · js/game.js
  survivor-ar/    index.html · css/style.css · js/game-01..03.js
  ...             ١٥ لعبة كمجلدات حقيقية بملفات css/js
  clash/          لعبة ملفات متعددة (css/js) منذ البداية (بدون تعديل)
  horror/         لعبة ملفات متعددة (css/js) منذ البداية (بدون تعديل)
  civilization/   محاكي الحضارة المدعوم بالسحابة (بدون تعديل)
```

النسخ أحادية الملف القديمة (`games/<name>.html`) أصبحت الآن صفحات تحويل صغيرة تشير إلى المجلدات الجديدة، لذا كل الروابط القديمة تعمل. كانت `clash/` و `horror/` منذ البداية لعبتين متعددتَي الملفات ولم تُلمس؛ ولم يعد أي صفحة تشير إلى مُحمّل الفصل المشترك القديم (`games/_runtime/`) وقد حُذف.
