
(function() {
    'use strict';

    // ---- عناصر DOM ----
    const keys = document.querySelectorAll('.key');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const comboDisplay = document.getElementById('comboDisplay');
    const accuracyDisplay = document.getElementById('accuracyDisplay');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBar = document.getElementById('timerBar');
    const statusMsg = document.getElementById('statusMsg');
    const starsDisplay = document.getElementById('starsDisplay');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const hall1 = document.getElementById('hall1');
    const hall2 = document.getElementById('hall2');
    const hall3 = document.getElementById('hall3');
    const diffBtns = document.querySelectorAll('.diff-btn');
    const styleBtns = document.querySelectorAll('.style-btn');

    // ---- حالة اللعبة ----
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let totalClicks = 0;
    let correctClicks = 0;
    let isPlaying = false;
    let isWaitingForClick = false;
    let activeKey = null;
    let gameTimer = null;
    let roundTimeout = null;
    let timeLeft = 30;
    let maxTime = 30;
    let difficulty = 'medium';
    let lightStyle = 'glow';

    // ---- إعدادات الصعوبة ----
    const DIFFICULTY = {
        easy: { time: 40, baseSpeed: 1600, minSpeed: 600, decrease: 40 },
        medium: { time: 30, baseSpeed: 1300, minSpeed: 450, decrease: 50 },
        hard: { time: 20, baseSpeed: 900, minSpeed: 300, decrease: 60 },
        expert: { time: 15, baseSpeed: 600, minSpeed: 200, decrease: 70 }
    };

    // ---- أنماط الإضاءة ----
    const STYLES = {
        glow: 'active-glow',
        neon: 'active-neon',
        rainbow: 'active-rainbow'
    };

    // ---- أفضل النتائج ----
    let bestScores = [];
    try {
        const saved = JSON.parse(localStorage.getItem('neonKeyBestScores'));
        if (Array.isArray(saved)) bestScores = saved.filter(n => Number.isFinite(n));
    } catch (e) { /* corrupt or blocked storage: start fresh */ }

    // ---- تحديث لوحة الشرف ----
    function updateHallOfFame() {
        const sorted = [...bestScores].sort((a, b) => b - a);
        hall1.textContent = sorted[0] || '--';
        hall2.textContent = sorted[1] || '--';
        hall3.textContent = sorted[2] || '--';
    }
    updateHallOfFame();

    // ---- دالة حفظ النتيجة ----
    function saveScore(score) {
        bestScores.push(score);
        bestScores.sort((a, b) => b - a);
        if (bestScores.length > 3) bestScores = bestScores.slice(0, 3);
        try { localStorage.setItem('neonKeyBestScores', JSON.stringify(bestScores)); } catch (e) {}
        updateHallOfFame();
    }

    // ---- دالة تحديث النجوم ----
    function updateStars(score) {
        const stars = starsDisplay.querySelectorAll('span');
        let count = 0;
        if (score >= 10) count = 3;
        else if (score >= 5) count = 2;
        else if (score >= 1) count = 1;

        stars.forEach((s, i) => {
            s.className = i < count ? 'on' : 'off';
        });
    }

    // ---- دالة اختيار زر عشوائي ----
    function getRandomKey() {
        const allKeys = Array.from(keys);
        const available = allKeys.filter(k => k !== activeKey);
        return available[Math.floor(Math.random() * available.length)];
    }

    // ---- دالة إضاءة زر ----
    function lightUpKey() {
        if (activeKey) {
            activeKey.classList.remove(STYLES[lightStyle]);
        }

        const newKey = getRandomKey();
        activeKey = newKey;
        newKey.classList.add(STYLES[lightStyle]);

        statusMsg.textContent = `🔆 اضغط على: ${newKey.dataset.key}`;
        statusMsg.className = 'waiting';
        isWaitingForClick = true;

        const diff = DIFFICULTY[difficulty];
        const timeLeft = Math.max(diff.minSpeed, diff.baseSpeed - (score * diff.decrease));

        if (roundTimeout) clearTimeout(roundTimeout);
        roundTimeout = setTimeout(() => {
            if (isPlaying && isWaitingForClick) {
                handleMiss();
            }
        }, timeLeft);
    }

    // ---- دالة إنشاء انفجار نيون ----
    function createBurst(x, y) {
        const burst = document.createElement('div');
        burst.className = 'neon-burst';
        const size = 40 + Math.random() * 60;
        burst.style.width = size + 'px';
        burst.style.height = size + 'px';
        burst.style.left = (x - size/2) + 'px';
        burst.style.top = (y - size/2) + 'px';
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 700);
    }

    // ---- دالة النجاح ----
    function handleSuccess(keyElement, event) {
        if (!isPlaying || !isWaitingForClick || keyElement !== activeKey) return;

        isWaitingForClick = false;
        if (roundTimeout) clearTimeout(roundTimeout);

        keyElement.classList.remove(STYLES[lightStyle]);

        score++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        totalClicks++;
        correctClicks++;

        scoreDisplay.textContent = score;
        comboDisplay.textContent = combo;
        accuracyDisplay.textContent = Math.round((correctClicks / totalClicks) * 100) + '%';

        keyElement.classList.add('hit');
        setTimeout(() => keyElement.classList.remove('hit'), 300);

        if (event) {
            createBurst(event.clientX || event.pageX, event.clientY || event.pageY);
        }

        if (combo >= 3) {
            statusMsg.textContent = `🔥 سلسلة ${combo}! +${combo}`;
            statusMsg.className = 'combo';
        } else {
            statusMsg.textContent = `✅ صحيح! (${score})`;
            statusMsg.className = 'success';
        }

        setTimeout(() => {
            if (isPlaying && timeLeft > 0) {
                lightUpKey();
            }
        }, 250);
    }

    // ---- دالة الفشل ----
    function handleMiss() {
        if (!isPlaying) return;
        isWaitingForClick = false;
        if (activeKey) {
            activeKey.classList.remove(STYLES[lightStyle]);
        }
        combo = 0;
        comboDisplay.textContent = '0';
        statusMsg.textContent = `❌ فاتك الزر! النقاط: ${score}`;
        statusMsg.className = 'fail';
        endGame(false);
    }

    // ---- دالة الضغط الخطأ ----
    function handleWrongPress(keyElement) {
        if (!isPlaying || !isWaitingForClick) return;
        combo = 0;
        comboDisplay.textContent = '0';
        totalClicks++;
        accuracyDisplay.textContent = Math.round((correctClicks / totalClicks) * 100) + '%';

        keyElement.style.background = 'rgba(255,0,0,0.3)';
        keyElement.style.borderColor = '#ff0000';
        setTimeout(() => {
            keyElement.style.background = '';
            keyElement.style.borderColor = '';
        }, 200);

        statusMsg.textContent = `❌ زر خاطئ! اضغط ${activeKey ? activeKey.dataset.key : '?'}`;
        statusMsg.className = 'fail';
    }

    // ---- دالة إنهاء اللعبة ----
    function endGame(win = false) {
        if (!isPlaying) return;
        isPlaying = false;
        isWaitingForClick = false;

        if (roundTimeout) clearTimeout(roundTimeout);
        if (gameTimer) clearInterval(gameTimer);

        if (activeKey) {
            activeKey.classList.remove(STYLES[lightStyle]);
            activeKey = null;
        }

        startBtn.disabled = false;
        startBtn.textContent = '🔄 العب مرة أخرى';

        if (score > 0) saveScore(score);
        updateStars(score);

        if (win) {
            statusMsg.textContent = `🎉 انتهى الوقت! النقاط: ${score} 🎉`;
            statusMsg.className = 'success';
        }
    }

    // ---- دالة بدء اللعبة ----
    function startGame() {
        if (isPlaying) return;

        score = 0;
        combo = 0;
        maxCombo = 0;
        totalClicks = 0;
        correctClicks = 0;

        const diff = DIFFICULTY[difficulty];
        maxTime = diff.time;
        timeLeft = maxTime;

        scoreDisplay.textContent = '0';
        comboDisplay.textContent = '0';
        accuracyDisplay.textContent = '0%';
        timerDisplay.textContent = maxTime;
        timerBar.style.width = '100%';

        if (activeKey) {
            activeKey.classList.remove(STYLES[lightStyle]);
            activeKey = null;
        }
        if (roundTimeout) clearTimeout(roundTimeout);

        isPlaying = true;
        isWaitingForClick = false;

        startBtn.disabled = true;
        startBtn.textContent = '⏳ جاري اللعب...';

        statusMsg.textContent = '🎯 استعد...';
        statusMsg.className = '';

        starsDisplay.querySelectorAll('span').forEach(s => s.className = 'off');

        gameTimer = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = timeLeft;
            timerBar.style.width = (timeLeft / maxTime * 100) + '%';

            if (timeLeft <= 5) {
                timerBar.style.background = 'linear-gradient(90deg, #ff6b6b, #ff00cc)';
            }

            if (timeLeft <= 0) {
                clearInterval(gameTimer);
                endGame(true);
            }
        }, 1000);

        setTimeout(() => {
            if (isPlaying) {
                lightUpKey();
            }
        }, 500);
    }

    // ---- دالة إعادة التعيين ----
    function resetGame() {
        isPlaying = false;
        isWaitingForClick = false;

        if (roundTimeout) clearTimeout(roundTimeout);
        if (gameTimer) clearInterval(gameTimer);

        if (activeKey) {
            activeKey.classList.remove(STYLES[lightStyle]);
            activeKey = null;
        }

        score = 0;
        combo = 0;
        maxCombo = 0;
        totalClicks = 0;
        correctClicks = 0;

        const diff = DIFFICULTY[difficulty];
        maxTime = diff.time;
        timeLeft = maxTime;

        scoreDisplay.textContent = '0';
        comboDisplay.textContent = '0';
        accuracyDisplay.textContent = '0%';
        timerDisplay.textContent = maxTime;
        timerBar.style.width = '100%';
        timerBar.style.background = 'linear-gradient(90deg, #2efcff, #ff00cc)';

        startBtn.disabled = false;
        startBtn.textContent = '🚀 بدء اللعبة';

        statusMsg.textContent = '🔄 تم إعادة التعيين';
        statusMsg.className = '';

        starsDisplay.querySelectorAll('span').forEach(s => s.className = 'off');

        keys.forEach(k => {
            k.style.background = '';
            k.style.borderColor = '';
            k.style.transform = '';
            k.classList.remove(STYLES[lightStyle], 'hit');
        });

        updateHallOfFame();
    }

    // ---- مستمعات الأحداث ----
    keys.forEach(key => {
        key.addEventListener('click', function(e) {
            if (!isPlaying) {
                statusMsg.textContent = '⚠️ اضغط "بدء" أولاً!';
                statusMsg.className = 'fail';
                return;
            }

            if (this === activeKey && isWaitingForClick) {
                handleSuccess(this, e);
            } else if (isWaitingForClick) {
                handleWrongPress(this);
            }
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const keyChar = e.key.toUpperCase();
        if (keyChar.length === 1 && keyChar >= 'A' && keyChar <= 'Z') {
            const keyElement = document.querySelector(`.key[data-key="${keyChar}"]`);
            if (keyElement) {
                keyElement.click();
                keyElement.style.transform = 'scale(0.9)';
                setTimeout(() => keyElement.style.transform = '', 100);
            }
        }
    });

    // ---- مستويات الصعوبة ----
    diffBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (isPlaying) return;
            diffBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            difficulty = this.dataset.diff;
            const diff = DIFFICULTY[difficulty];
            timerDisplay.textContent = diff.time;
            timerBar.style.width = '100%';
            resetGame();
        });
    });

    // ---- أنماط الإضاءة ----
    styleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            styleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            lightStyle = this.dataset.style;
            if (activeKey) {
                activeKey.classList.remove('active-glow', 'active-neon', 'active-rainbow');
                activeKey.classList.add(STYLES[lightStyle]);
            }
        });
    });

    startBtn.addEventListener('click', startGame);
    resetBtn.addEventListener('click', resetGame);

    const diff = DIFFICULTY[difficulty];
    timerDisplay.textContent = diff.time;
    timerBar.style.width = '100%';

})();
