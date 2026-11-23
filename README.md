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
  calc-chall/     index.html · css/style.css · js/game.js
  truda/          index.html (loads truda.html via the runtime splitter)
  ...             one folder per game
  civilization/   the cloud-backed evolution sim (untouched core scripts)
  _runtime/       shared split-loader used by the folder shells
```

The classic single-file versions (`games/<name>.html`) are still linked from the folder shells, so every old URL keeps working. `games/2048.html` and `games/calc-chall.html` are now tiny redirect stubs pointing to their new folders.

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
  calc-chall/     index.html · css/style.css · js/game.js
  truda/          index.html (يحمّل truda.html عبر الفاصل الزمني)
  ...             مجلد لكل لعبة
  civilization/   محاكي الحضارة المدعوم بالسحابة (بدون تعديل)
  _runtime/       مُحمّل الفصل المشترك المستخدم في واجهات المجلدات
```

النسخ أحادية الملف القديمة (`games/<name>.html`) ما زالت مرتبطة من واجهات المجلدات، لذا كل الروابط القديمة تعمل. الملفان `games/2048.html` و `games/calc-chall.html` أصبحا الآن صفحات تحويل صغيرة تشير إلى المجلدات الجديدة.
