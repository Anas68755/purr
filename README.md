# 🐱 Gam Lub (purr)

**A playful home for browser games.** Explore 18 games and interactive experiences through a 3D globe, or find your next game with search and the mobile-friendly grid.

[Play online](https://anas68755.github.io/purr/) · [العربية](#العربية)

## Play

**Online:** [Open Gam Lub](https://anas68755.github.io/purr/). GitHub Actions deploys the site when changes are pushed to `main`. If Pages is not enabled yet, go to **Settings → Pages → Build and deployment** and choose **GitHub Actions** as the source.

**On your computer:** run a static web server from the repository root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Using a local server is recommended because the hub and some games load JavaScript modules and other assets.

## Games

| Game | File |
|---|---|
| Truth or Dare | [`games/truda.html`](games/truda.html) |
| Chess Cards | [`games/chard.html`](games/chard.html) |
| Horror game | [`games/horror.html`](games/horror.html) |
| Void Breaker | [`games/voidbreaker.html`](games/voidbreaker.html) |
| Calc Chall | [`games/calc-chall.html`](games/calc-chall.html) |
| Purr Clicker | [`games/purr-clicker.html`](games/purr-clicker.html) |
| Shadow Rise | [`games/notavailable.html`](games/notavailable.html) |
| Clash Kingdoms | [`games/clash.html`](games/clash.html) |
| Catch The Cat | [`games/purch.html`](games/purch.html) |
| Tik Tak Toe | [`games/tiktak.html`](games/tiktak.html) |
| Civilization Evo Sim | [`games/civilization/index.html`](games/civilization/index.html) |
| الساحر الناجي | [`games/survivor-ar.html`](games/survivor-ar.html) |
| CyberHack Sim | [`games/cack.html`](games/cack.html) |
| Russian Roulette | [`games/revolver.html`](games/revolver.html) |
| 2048 | [`games/2048.html`](games/2048.html) |
| Neon Monopoly X | [`games/monopoly.html`](games/monopoly.html) |
| Keyboar | [`games/keyboar.html`](games/keyboar.html) |
| Echo Cartographer | [`games/echo.html`](games/echo.html) |

## Add a game

1. Add your game under `games/`. It can be a single HTML file or a folder with the files it needs.
2. Add an entry to the `ORBS` array in `index.html`:

```js
["My Game", "🎲", "A short description", "my-game"],
```

For a game inside a folder, use a path such as `"my-folder/index"`. The hub uses the entry to add the game to the globe, search, and grid views.

## Good to know

- Game progress, high scores, and saves are stored in your browser using `localStorage` and stay on that device.
- Some games load libraries or fonts from external CDNs and need an internet connection for those features.
- This repository does not currently include a license. Add one if you want to specify how others may reuse the project.

---

## العربية

**مساحة ممتعة لألعاب المتصفح.** استكشف ١٨ لعبة وتجربة تفاعلية عبر كرة أرضية ثلاثية الأبعاد، أو ابحث عن لعبتك المفضلة باستخدام البحث والشبكة المناسبة للهواتف.

[العب عبر الإنترنت](https://anas68755.github.io/purr/) · [English](#-gam-lub-purr)

### العب

**عبر الإنترنت:** [افتح Gam Lub](https://anas68755.github.io/purr/). ينشر GitHub Actions الموقع تلقائيًا عند رفع التغييرات إلى فرع `main`. إذا لم يكن GitHub Pages مفعّلًا، فانتقل إلى **Settings → Pages → Build and deployment** واختر **GitHub Actions** مصدرًا للنشر.

**على جهازك:** شغّل خادم ويب ثابتًا من المجلد الرئيسي للمستودع:

```bash
python3 -m http.server 8000
```

ثم افتح <http://localhost:8000>. يُنصح باستخدام خادم محلي لأن الواجهة وبعض الألعاب تحمّل وحدات JavaScript وملفات أخرى.

### الألعاب

| اللعبة | الملف |
|---|---|
| حقيقة أم جرأة | [`games/truda.html`](games/truda.html) |
| بطاقات الشطرنج | [`games/chard.html`](games/chard.html) |
| الممر النفسي | [`games/horror.html`](games/horror.html) |
| محطم الفراغ | [`games/voidbreaker.html`](games/voidbreaker.html) |
| لعبة الحساب | [`games/calc-chall.html`](games/calc-chall.html) |
| نقرة القط | [`games/purr-clicker.html`](games/purr-clicker.html) |
| صعود الظلال | [`games/notavailable.html`](games/notavailable.html) |
| ممالك الصراع | [`games/clash.html`](games/clash.html) |
| أمسك القطة | [`games/purch.html`](games/purch.html) |
| إكس-أوه | [`games/tiktak.html`](games/tiktak.html) |
| محاكي تطور الحضارة | [`games/civilization/index.html`](games/civilization/index.html) |
| الساحر الناجي | [`games/survivor-ar.html`](games/survivor-ar.html) |
| محاكي الاختراق الإلكتروني | [`games/cack.html`](games/cack.html) |
| الروليت الروسية | [`games/revolver.html`](games/revolver.html) |
| ٢٠٤٨ | [`games/2048.html`](games/2048.html) |
| مونوبولي نيون إكس | [`games/monopoly.html`](games/monopoly.html) |
| اختبار سرعة الكتابة | [`games/keyboar.html`](games/keyboar.html) |
| رسام خرائط الصدى | [`games/echo.html`](games/echo.html) |

### أضف لعبة

١. أضف لعبتك داخل `games/`. يمكن أن تكون ملف HTML واحدًا أو مجلدًا يضم الملفات التي تحتاج إليها.
٢. أضف سطرًا إلى مصفوفة `ORBS` في ملف `index.html`:

```js
["My Game", "🎲", "وصف قصير", "my-game"],
```

إذا كانت اللعبة داخل مجلد فرعي، استخدم مسارًا مثل `"my-folder/index"`. ستظهر اللعبة تلقائيًا في الكرة والبحث والشبكة.

### ملاحظات

- يُحفَظ التقدم وأعلى النتائج وملفات الحفظ في `localStorage` بالمتصفح، وتبقى على الجهاز نفسه.
- تحمّل بعض الألعاب مكتبات أو خطوطًا من خدمات خارجية، لذا تحتاج هذه الميزات إلى اتصال بالإنترنت.
- لا يتضمن المستودع حاليًا ملف ترخيص. أضف ترخيصًا إذا أردت تحديد شروط إعادة استخدام المشروع.
