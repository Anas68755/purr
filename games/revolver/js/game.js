
        // ================================================================
        //  الروليت الروسية - مع صورة المسدس
        // ================================================================

        // ---------- STATE ----------
        const state = {
            chambers: [],
            currentChamber: 0,
            bulletCount: 1,
            totalChambers: 6,
            isLoaded: false,
            isFiring: false,
            gameOver: false,
            difficulty: 'easy',
            wins: 0,
            losses: 0,
            streak: 0,
            history: [],
            revealed: false,
            firedChambers: [],
        };

        // ---------- PUNISHMENTS DATABASE ----------
        const punishments = {
            easy: [
                { name: '👋 صفعة خفيفة', desc: 'صفعة على الوجه من الجار' },
                { name: '📝 10 ضغطات', desc: 'قم بـ 10 تمارين ضغط' },
                { name: '🎤 غني أغنية', desc: 'غني أغنية كاملة بصوت عالٍ' },
                { name: '🤡 قف كالمهرج', desc: 'اقفز كالمهرج لمدة 30 ثانية' },
                { name: '📢 صرخ باسمك', desc: 'اصرخ باسمك 3 مرات' },
                { name: '🕺 ارقص', desc: 'ارقص لمدة دقيقة' },
                { name: '😄 ابتسم', desc: 'ابتسم لأطول فترة ممكنة' },
                { name: '👀 أغمض عينيك', desc: 'أغمض عينيك لمدة 30 ثانية' },
                { name: '🗣️ تحدث بلكنة', desc: 'تحدث بلكنة غريبة لدقيقة' },
                { name: '✍️ اكتب جملة', desc: 'اكتب جملة مضحكة 3 مرات' },
            ],
            medium: [
                { name: '💪 20 ضغط', desc: 'قم بـ 20 تمرين ضغط' },
                { name: '🏃 50 قفزة', desc: 'قم بـ 50 قفزة مكانية' },
                { name: '🎤 ارتجال', desc: 'ارتجل قصة لمدة دقيقتين' },
                { name: '🤹 تلاعب', desc: 'تلاعب بأي شيء لمدة دقيقة' },
                { name: '🧘 تأمل', desc: 'تأمل بصمت لمدة 3 دقائق' },
                { name: '📖 اقرأ بصوت', desc: 'اقرأ أي نص بصوت عالٍ' },
                { name: '🎭 تمثيل', desc: 'مثل دور شخصية مشهورة' },
                { name: '🧠 حفظ أرقام', desc: 'احفظ 5 أرقام عشوائية' },
                { name: '✋ 50 تصفيق', desc: 'صفق 50 مرة بسرعة' },
                { name: '🔄 دوران', desc: 'دور حول نفسك 10 مرات' },
            ],
            hard: [
                { name: '💀 50 ضغط', desc: 'قم بـ 50 تمرين ضغط' },
                { name: '🏃 100 قفزة', desc: 'قم بـ 100 قفزة مكانية' },
                { name: '🎤 غناء أوبريت', desc: 'غني أوبريت كامل' },
                { name: '🤸 حركات بهلوانية', desc: 'قم بحركات بهلوانية' },
                { name: '🧘 يوغا صعبة', desc: 'قم بوضعية يوغا صعبة' },
                { name: '📖 إلقاء خطبة', desc: 'ألقِ خطبة لمدة 3 دقائق' },
                { name: '🎭 تمثيل مسرحية', desc: 'مثل مشهداً من مسرحية' },
                { name: '🧠 حل ألغاز', desc: 'حل 3 ألغاز صعبة' },
                { name: '✍️ كتابة مقال', desc: 'اكتب مقالاً من 100 كلمة' },
                { name: '🔄 دوران 20 مرة', desc: 'دور حول نفسك 20 مرة' },
            ],
            nightmare: [
                { name: '💀 100 ضغط', desc: 'قم بـ 100 تمرين ضغط' },
                { name: '🏃 200 قفزة', desc: 'قم بـ 200 قفزة مكانية' },
                { name: '🎤 غناء أوبرا', desc: 'غني أوبرا كاملة' },
                { name: '🤸 حركات خطيرة', desc: 'قم بحركات بهلوانية خطيرة' },
                { name: '🧘 يوغا متطرفة', desc: 'قم بوضعيات يوغا متطرفة' },
                { name: '📖 حفظ نص طويل', desc: 'احفظ نصاً طويلاً واقرأه' },
                { name: '🎭 تمثيل درامي', desc: 'مثل مشهداً درامياً مؤثراً' },
                { name: '🧠 حل ألغاز معقدة', desc: 'حل 5 ألغاز معقدة' },
                { name: '✍️ كتابة قصة', desc: 'اكتب قصة من 500 كلمة' },
                { name: '🔄 دوران 50 مرة', desc: 'دور حول نفسك 50 مرة' },
                { name: '💀 تحدي الموت', desc: 'قم بتحدي جسدي قاسٍ' },
                { name: '🔥 تحدي النار', desc: 'تحدٍ خطير جداً' },
            ],
        };

        // ---------- DOM REFS ----------
        const revolverImage = document.getElementById('revolverImage');
        const muzzleFlash = document.getElementById('muzzleFlash');
        const chambersOverlay = document.getElementById('chambersOverlay');
        const statusText = document.getElementById('statusText');
        const bulletCount = document.getElementById('bulletCount');
        const punishmentText = document.getElementById('punishmentText');
        const punishmentDesc = document.getElementById('punishmentDesc');
        const fireBtn = document.getElementById('fireBtn');
        const winCount = document.getElementById('winCount');
        const loseCount = document.getElementById('loseCount');
        const streakCount = document.getElementById('streakCount');
        const historyList = document.getElementById('historyList');
        const glitchOverlay = document.getElementById('glitchOverlay');

        // ---------- FUNCTIONS ----------

        // تهيئة المسدس
        function initChambers() {
            state.chambers = [];
            state.firedChambers = [];
            state.revealed = false;
            let bulletsPlaced = 0;
            const total = state.totalChambers;
            const bulletCount = getBulletCount();

            for (let i = 0; i < total; i++) {
                state.chambers.push(false);
            }

            while (bulletsPlaced < bulletCount) {
                const idx = Math.floor(Math.random() * total);
                if (!state.chambers[idx]) {
                    state.chambers[idx] = true;
                    bulletsPlaced++;
                }
            }

            state.currentChamber = 0;
            state.isLoaded = true;
            state.gameOver = false;
            state.isFiring = false;
            updateDisplay();
            statusText.textContent = '🔫 المسدس جاهز! اضغط على الصورة أو الزر';
            statusText.className = 'status-text';
            updateUI();
        }

        // عدد الرصاص حسب الصعوبة
        function getBulletCount() {
            switch (state.difficulty) {
                case 'easy':
                    return 1;
                case 'medium':
                    return 2;
                case 'hard':
                    return 3;
                case 'nightmare':
                    return 4;
                default:
                    return 1;
            }
        }

        // تدوير المسدس
        function spinChamber() {
            if (state.isFiring) return;
            if (state.gameOver) {
                resetGame();
                return;
            }
            initChambers();
            statusText.textContent = '🔄 تم إعادة التحميل! أين الرصاصة؟';
            statusText.className = 'status-text';
            playScanSound();
        }

        // سحب الزناد
        function fire() {
            if (state.isFiring) return;
            if (!state.isLoaded || state.gameOver) {
                if (state.gameOver) {
                    statusText.textContent = '💀 اللعبة انتهت! اضغط "جديد"';
                    statusText.className = 'status-text danger';
                } else {
                    statusText.textContent = '⚠️ أعد تحميل المسدس أولاً!';
                    statusText.className = 'status-text';
                }
                return;
            }

            state.isFiring = true;
            fireBtn.disabled = true;

            // تأثير الإطلاق
            triggerMuzzleFlash();
            revolverImage.classList.add('recoil');
            setTimeout(() => revolverImage.classList.remove('recoil'), 300);

            // تأثير الصوت والوميض
            playFireSound();
            triggerGlitch(0.5);

            // التحقق من الرصاصة
            const current = state.chambers[state.currentChamber];
            const isLast = state.currentChamber === state.totalChambers - 1;

            state.revealed = true;

            if (current) {
                // 💀 خسارة
                setTimeout(() => {
                    triggerGlitch(3);
                    playLoseSound();
                    statusText.textContent = '💀 💀 💀 رصاصة!';
                    statusText.className = 'status-text danger';
                    state.gameOver = true;

                    const punishment = getRandomPunishment();
                    punishmentText.textContent = punishment.name;
                    punishmentText.className = 'punishment-text danger';
                    punishmentDesc.textContent = punishment.desc;

                    state.losses++;
                    state.streak = 0;
                    addHistory('💀 خسارة', punishment.name, state.currentChamber + 1);

                    updateDisplay(true);
                    playGlitchSound();
                    updateUI();

                    fireBtn.disabled = false;
                    state.isFiring = false;

                }, 600);

            } else {
                // ✅ فوز
                setTimeout(() => {
                    playWinSound();
                    statusText.textContent = '✅ نجوت!';
                    statusText.className = 'status-text success';
                    punishmentText.textContent = '🎉 نجوت هذه المرة!';
                    punishmentText.className = 'punishment-text success';
                    punishmentDesc.textContent = 'لا توجد عقوبة، استمر!';

                    state.wins++;
                    state.streak++;
                    state.firedChambers.push(state.currentChamber);
                    addHistory('✅ فوز', 'نجاة', state.currentChamber + 1);

                    updateDisplay(false);

                    if (isLast) {
                        statusText.textContent = '🔄 انتهت الجولة! إعادة تحميل...';
                        setTimeout(() => {
                            state.isFiring = false;
                            fireBtn.disabled = false;
                            spinChamber();
                            statusText.textContent = '🔄 تم إعادة التحميل! أين الرصاصة؟';
                            statusText.className = 'status-text';
                        }, 800);
                        updateUI();
                        return;
                    } else {
                        state.currentChamber++;
                        state.revealed = false;
                        updateDisplay(false);
                    }

                    updateUI();
                    fireBtn.disabled = false;
                    state.isFiring = false;

                }, 400);
            }
        }

        // تأثير فلاش الإطلاق
        function triggerMuzzleFlash() {
            muzzleFlash.classList.remove('active');
            void muzzleFlash.offsetWidth;
            muzzleFlash.classList.add('active');
            setTimeout(() => muzzleFlash.classList.remove('active'), 400);
        }

        // اختيار عقوبة عشوائية
        function getRandomPunishment() {
            const pool = punishments[state.difficulty] || punishments.easy;
            return pool[Math.floor(Math.random() * pool.length)];
        }

        // تحديث عرض الحجرات
        function updateDisplay(revealBullet = false) {
            chambersOverlay.innerHTML = '';
            const totalBullets = state.chambers.filter(c => c).length;

            state.chambers.forEach((hasBullet, index) => {
                const dot = document.createElement('div');
                dot.className = 'chamber-dot';

                if (index === state.currentChamber && !state.gameOver) {
                    dot.classList.add('current');
                }

                if (state.firedChambers.includes(index)) {
                    dot.classList.add('fired');
                } else if (state.gameOver && hasBullet && revealBullet) {
                    dot.classList.add('revealed-bullet');
                } else if (state.gameOver && !hasBullet && revealBullet) {
                    dot.classList.add('revealed-empty');
                } else {
                    dot.classList.add('hidden');
                }

                chambersOverlay.appendChild(dot);
            });

            const remaining = state.chambers.slice(state.currentChamber).filter(c => c).length;
            if (state.gameOver) {
                bulletCount.textContent = `💀 تم الكشف! ${totalBullets} رصاصة في المسدس`;
            } else {
                bulletCount.textContent = `💀 ${remaining} رصاصة متبقية (مخفية)`;
            }
        }

        // تحديث الواجهة
        function updateUI() {
            winCount.textContent = state.wins;
            loseCount.textContent = state.losses;
            streakCount.textContent = state.streak;
            updateHistory();
        }

        // إضافة إلى السجل
        function addHistory(result, punishment, chamber) {
            state.history.unshift({
                result: result,
                punishment: punishment,
                chamber: chamber,
                time: new Date().toLocaleTimeString(),
                difficulty: state.difficulty,
            });
            if (state.history.length > 50) state.history.pop();
        }

        // تحديث عرض السجل
        function updateHistory() {
            if (state.history.length === 0) {
                historyList.innerHTML = '<div style="color:#555;font-size:0.55rem;">لا توجد جولات بعد</div>';
                return;
            }

            let html = '';
            state.history.slice(0, 20).forEach(h => {
                const resultClass = h.result.includes('فوز') ? 'win' : 'lose';
                const icon = h.result.includes('فوز') ? '✅' : '💀';
                html += `
                    <div class="history-item">
                        <span>${h.time}</span>
                        <span class="h-result ${resultClass}">${icon} ${h.result}</span>
                        <span class="h-punishment">${h.punishment}</span>
                        <span style="color:#666;font-size:0.5rem;">#${h.chamber}</span>
                    </div>
                `;
            });
            historyList.innerHTML = html;
        }

        // تعيين الصعوبة
        function setDifficulty(diff) {
            if (state.isFiring) return;
            state.difficulty = diff;
            document.querySelectorAll('.diff-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.diff === diff);
            });
            resetGame();
            statusText.textContent = `🎯 صعوبة: ${diff}`;
            statusText.className = 'status-text';
            playScanSound();
        }

        // إعادة تعيين اللعبة
        function resetGame() {
            state.gameOver = false;
            state.isFiring = false;
            fireBtn.disabled = false;
            punishmentText.textContent = 'في انتظار الدور...';
            punishmentText.className = 'punishment-text';
            punishmentDesc.textContent = 'ستظهر العقوبة عند الخسارة';
            statusText.textContent = '🔄 جولة جديدة!';
            statusText.className = 'status-text';
            initChambers();
            updateUI();
        }

        // ---------- EFFECTS ----------

        // Glitch
        function triggerGlitch(intensity = 1) {
            glitchOverlay.classList.remove('active');
            void glitchOverlay.offsetWidth;
            glitchOverlay.style.animationDuration = (0.3 + intensity * 0.1) + 's';
            glitchOverlay.classList.add('active');
            setTimeout(() => glitchOverlay.classList.remove('active'), 400 + intensity * 200);
        }

        // Sound
        let audioCtx = null;

        function initAudio() {
            if (!audioCtx) {
                try {
                    audioCtx = new(window.AudioContext || window.webkitAudioContext)();
                } catch (e) {}
            }
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        }

        function playBeep(freq = 800, duration = 100, type = 'sine', volume = 0.15) {
            if (!audioCtx) return;
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = type;
                osc.frequency.value = freq;
                gain.gain.value = volume;
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + duration / 1000);
            } catch (e) {}
        }

        function playFireSound() {
            playBeep(100, 300, 'sawtooth', 0.25);
            setTimeout(() => playBeep(200, 200, 'sawtooth', 0.2), 80);
            setTimeout(() => playBeep(50, 400, 'square', 0.15), 160);
        }

        function playLoseSound() {
            playBeep(300, 400, 'sawtooth', 0.2);
            setTimeout(() => playBeep(200, 300, 'sawtooth', 0.15), 200);
            setTimeout(() => playBeep(100, 500, 'square', 0.1), 400);
        }

        function playWinSound() {
            playBeep(1200, 100, 'sine', 0.15);
            setTimeout(() => playBeep(1500, 100, 'sine', 0.15), 150);
            setTimeout(() => playBeep(1800, 150, 'sine', 0.15), 300);
        }

        function playScanSound() {
            playBeep(600, 50, 'sine', 0.1);
            setTimeout(() => playBeep(800, 50, 'sine', 0.1), 100);
        }

        function playGlitchSound() {
            playBeep(200, 150, 'sawtooth', 0.1);
            setTimeout(() => playBeep(400, 100, 'square', 0.08), 100);
        }

        // ---------- KEYBOARD SUPPORT ----------
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!fireBtn.disabled) fire();
            }
            if (e.key === 'r' || e.key === 'R') {
                spinChamber();
            }
        });

        // ---------- INIT ----------
        initChambers();

        // تفعيل الصوت عند النقر
        document.addEventListener('click', () => {
            initAudio();
        }, { once: true });

        console.log('🔫 الروليت الروسية - مع صورة المسدس');
        console.log('📁 تأكد من وجود ملف revolver.png في نفس المجلد');
        console.log('🎯 الصعوبة: ' + state.difficulty);
        console.log('📖 اضغط Space أو Enter لسحب الزناد');
        console.log('🔄 اضغط R لإعادة التحميل');
        console.log('🖱️ يمكنك الضغط على صورة المسدس أيضاً');
    
