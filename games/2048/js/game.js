(function() {
    'use strict';

    // === إعدادات ===
    const SIZE = 8;
    const WIN_VALUE = 2048;

    // === عناصر DOM ===
    const gridEl = document.getElementById('grid');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const bestDisplay = document.getElementById('bestDisplay');
    const overlay = document.getElementById('overlay');
    const overlayMsg = document.getElementById('overlayMsg');
    const restartBtn = document.getElementById('restartBtn');
    const retryBtn = document.getElementById('retryBtn');
    const soundToggle = document.getElementById('soundToggle');
    const undoBtn = document.getElementById('undoBtn');

    // === حفظ اللعبة والتراجع ===
    const SAVE_KEY = 'game2048Neon8x8State';
    const history = [];
    function saveState() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify({ grid, score, win, keepPlaying, gameOver })); } catch (e) {}
    }
    function loadState() {
        try {
            const d = JSON.parse(localStorage.getItem(SAVE_KEY));
            if (!d || !Array.isArray(d.grid) || d.grid.length !== SIZE ||
                !d.grid.every(r => Array.isArray(r) && r.length === SIZE && r.every(v => Number.isInteger(v) && v >= 0))) return false;
            grid = d.grid; score = +d.score || 0;
            win = !!d.win; keepPlaying = !!d.keepPlaying; gameOver = !!d.gameOver;
            return true;
        } catch (e) { return false; }
    }
    function undo() {
        const snap = history.pop();
        if (!snap) return;
        grid = snap.grid; score = snap.score;
        gameOver = false;
        overlay.classList.remove('show');
        if (hasWon()) keepPlaying = true; else { win = false; keepPlaying = false; }
        updateDisplay();
        undoBtn.disabled = history.length === 0;
    }

    // === نظام الصوت (باستخدام Web Audio API) ===
    let audioCtx = null;
    let soundEnabled = true;

    function initAudio() {
        if (!audioCtx) {
            try {
                audioCtx = new(window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API غير مدعوم');
            }
        }
    }

    function playTone(freq, duration, volume = 0.15, type = 'sine') {
        if (!soundEnabled || !audioCtx) return;
        try {
            const oscillator = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(volume, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            oscillator.connect(gain);
            gain.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + duration);
        } catch (e) {
            // تجاهل أخطاء الصوت
        }
    }

    function playMoveSound() {
        playTone(400, 0.08, 0.08);
    }

    function playMergeSound() {
        playTone(600, 0.15, 0.15, 'square');
        setTimeout(() => playTone(800, 0.1, 0.1, 'sine'), 100);
    }

    function playWinSound() {
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 0.2, 0.12, 'sine'), i * 150);
        });
    }

    function playGameOverSound() {
        [400, 300, 200].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 0.25, 0.1, 'sawtooth'), i * 200);
        });
    }

    // === تبديل الصوت ===
    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundToggle.textContent = soundEnabled ? '🔊 صوت' : '🔇 كتم';
        if (soundEnabled) initAudio();
    });

    // === حالة اللعبة ===
    let grid = [];
    let score = 0;
    let bestScore = parseInt(localStorage.getItem('bestScoreNeon8x8')) || 0;
    let gameOver = false;
    let win = false;
    let keepPlaying = false;

    // === تهيئة ===
    function init() {
        grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
        score = 0;
        gameOver = false;
        win = false;
        keepPlaying = false;
        overlay.classList.remove('show');
        history.length = 0;
        undoBtn.disabled = true;
        addRandomTile();
        addRandomTile();
        updateDisplay();
        updateBestScore();
        initAudio();
    }

    // === إضافة بلاطة عشوائية ===
    function addRandomTile() {
        const empty = [];
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] === 0) empty.push({ r, c });
            }
        }
        if (empty.length === 0) return null;
        const pos = empty[Math.floor(Math.random() * empty.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        grid[pos.r][pos.c] = value;
        return { r: pos.r, c: pos.c, value };
    }

    // === تحديث العرض ===
    function updateDisplay(newTilePos, mergedPositions, isMerge = false) {
        gridEl.innerHTML = '';
        let hasMerged = new Set();
        if (mergedPositions) {
            mergedPositions.forEach(p => hasMerged.add(p.r + ',' + p.c));
        }
        let newSet = new Set();
        if (newTilePos) {
            newSet.add(newTilePos.r + ',' + newTilePos.c);
        }

        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const val = grid[r][c];
                if (val !== 0) {
                    let tileClass = 'tile-' + val;
                    // دعم للأرقام الأكبر من 2048
                    if (!document.querySelector(`.${tileClass}`) && val > 2048) {
                        // نضيف فئة عامة للأرقام الكبيرة
                        cell.style.background = `rgba(${Math.min(255, 100 + (val % 255))}, ${Math.min(255, 50 + (val % 200))}, ${Math.min(255, 150 + (val % 100))}, 0.3)`;
                        cell.style.boxShadow = `0 0 40px rgba(${Math.min(255, 100 + (val % 255))}, ${Math.min(255, 50 + (val % 200))}, ${Math.min(255, 150 + (val % 100))}, 0.3)`;
                        cell.style.color = '#fff';
                        cell.style.textShadow = '0 0 30px rgba(255,255,255,0.3)';
                        if (val >= 10000) cell.style.fontSize = '0.7rem';
                        else if (val >= 5000) cell.style.fontSize = '0.8rem';
                    } else {
                        cell.classList.add(tileClass);
                    }
                    cell.textContent = val;
                    const key = r + ',' + c;
                    if (newSet.has(key)) {
                        cell.classList.add('tile-new');
                    }
                    if (hasMerged.has(key)) {
                        cell.classList.add('tile-merged');
                    }
                } else {
                    cell.classList.add('tile-0');
                }
                gridEl.appendChild(cell);
            }
        }

        scoreDisplay.textContent = score;
        saveState();
        updateBestScore();

        if (!win && !keepPlaying) {
            if (hasWon()) {
                win = true;
                showOverlay('🎉 لقد فزت!', 'win');
                playWinSound();
            }
        }
        if (!gameOver && isGameOver()) {
            gameOver = true;
            if (!win || keepPlaying) {
                showOverlay('😵 انتهت اللعبة!', 'lose');
                playGameOverSound();
            }
        }
    }

    // === تحديث أفضل نقاط ===
    function updateBestScore() {
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('bestScoreNeon8x8', bestScore);
        }
        bestDisplay.textContent = bestScore;
    }

    // === عرض النافذة المنبثقة ===
    function showOverlay(text, type) {
        overlayMsg.textContent = text;
        overlayMsg.className = 'msg ' + type;
        overlay.classList.add('show');
    }

    // === التحقق من الفوز ===
    function hasWon() {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] === WIN_VALUE) return true;
            }
        }
        return false;
    }

    // === التحقق من انتهاء اللعبة ===
    function isGameOver() {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] === 0) return false;
                if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false;
                if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
            }
        }
        return true;
    }

    // === عمليات الانزلاق ===
    function slideLine(line) {
        let filtered = line.filter(v => v !== 0);
        let merged = [];
        let mergedIndices = [];
        let i = 0;
        let hasMerge = false;
        while (i < filtered.length) {
            if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
                const newVal = filtered[i] * 2;
                merged.push(newVal);
                mergedIndices.push(merged.length - 1);
                score += newVal;
                i += 2;
                hasMerge = true;
            } else {
                merged.push(filtered[i]);
                i++;
            }
        }
        while (merged.length < SIZE) {
            merged.push(0);
        }
        return { newLine: merged, mergedIndices: mergedIndices, hasMerge };
    }

    function getCol(col) {
        return grid.map(row => row[col]);
    }

    function setCol(col, values) {
        for (let r = 0; r < SIZE; r++) {
            grid[r][col] = values[r];
        }
    }

    function getRow(row) {
        return grid[row].slice();
    }

    function setRow(row, values) {
        grid[row] = values.slice();
    }

    // === تنفيذ الحركة ===
    function move(direction) {
        if (gameOver) return false;
        if (win && !keepPlaying) return false;

        // عكس الأسهم الجانبية
        let actualDirection = direction;
        if (direction === 'left') actualDirection = 'right';
        else if (direction === 'right') actualDirection = 'left';

        let moved = false;
        let newTilePos = null;
        let mergedPositions = [];
        let anyMerge = false;
        const oldGrid = grid.map(row => row.slice());
        const snap = { grid: oldGrid.map(r => r.slice()), score };

        switch (actualDirection) {
            case 'up':
                for (let c = 0; c < SIZE; c++) {
                    const col = getCol(c);
                    const result = slideLine(col);
                    const newCol = result.newLine;
                    result.mergedIndices.forEach(idx => {
                        mergedPositions.push({ r: idx, c: c });
                    });
                    setCol(c, newCol);
                    if (result.hasMerge) anyMerge = true;
                }
                break;
            case 'down':
                for (let c = 0; c < SIZE; c++) {
                    const col = getCol(c).reverse();
                    const result = slideLine(col);
                    const newCol = result.newLine.reverse();
                    result.mergedIndices.forEach(idx => {
                        const r = SIZE - 1 - idx;
                        mergedPositions.push({ r: r, c: c });
                    });
                    setCol(c, newCol);
                    if (result.hasMerge) anyMerge = true;
                }
                break;
            case 'left':
                for (let r = 0; r < SIZE; r++) {
                    const row = getRow(r);
                    const result = slideLine(row);
                    const newRow = result.newLine;
                    result.mergedIndices.forEach(idx => {
                        mergedPositions.push({ r: r, c: idx });
                    });
                    setRow(r, newRow);
                    if (result.hasMerge) anyMerge = true;
                }
                break;
            case 'right':
                for (let r = 0; r < SIZE; r++) {
                    const row = getRow(r).reverse();
                    const result = slideLine(row);
                    const newRow = result.newLine.reverse();
                    result.mergedIndices.forEach(idx => {
                        const c = SIZE - 1 - idx;
                        mergedPositions.push({ r: r, c: c });
                    });
                    setRow(r, newRow);
                    if (result.hasMerge) anyMerge = true;
                }
                break;
            default:
                return false;
        }

        // التحقق من التغيير
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (grid[r][c] !== oldGrid[r][c]) {
                    moved = true;
                    break;
                }
            }
            if (moved) break;
        }

        if (!moved) return false;
        history.push(snap);
        if (history.length > 20) history.shift();
        undoBtn.disabled = false;

        // تشغيل الأصوات
        if (anyMerge) {
            playMergeSound();
        } else {
            playMoveSound();
        }

        const newPos = addRandomTile();
        if (newPos) {
            newTilePos = { r: newPos.r, c: newPos.c };
        }

        updateDisplay(newTilePos, mergedPositions);
        return true;
    }

    // === إعادة التشغيل ===
    function restartGame() {
        init();
    }

    // === الاستمرار بعد الفوز ===
    function continueGame() {
        keepPlaying = true;
        overlay.classList.remove('show');
    }

    // === أحداث لوحة المفاتيح ===
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const key = e.key;
        if (key === 'z' || key === 'Z') { undo(); return; }
        const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                      w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right' };
        let dir = map[key] || null;
        if (!dir) return;

        e.preventDefault();
        if (dir) {
            move(dir);
        }
    });

    // === أحداث اللمس ===
    let touchStartX = 0,
        touchStartY = 0;
    let isSwiping = false;

    document.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isSwiping = true;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        if (e.target.closest && e.target.closest('#gridContainer')) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        if (touchStartX === 0 && touchStartY === 0) return;
        const touchEnd = e.changedTouches[0];
        const dx = touchEnd.clientX - touchStartX;
        const dy = touchEnd.clientY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < 20) return;

        let dir = null;
        if (absDx > absDy) {
            dir = dx > 0 ? 'right' : 'left';
        } else {
            dir = dy > 0 ? 'down' : 'up';
        }
        if (dir) move(dir);

        touchStartX = 0;
        touchStartY = 0;
    }, { passive: true });

    // === أزرار إعادة التشغيل ===
    restartBtn.addEventListener('click', restartGame);
    retryBtn.addEventListener('click', restartGame);
    undoBtn.addEventListener('click', undo);

    // النقر على الخلفية للاستمرار بعد الفوز
    overlay.addEventListener('click', (e) => {
        if (win && !keepPlaying) {
            e.stopPropagation();
            continueGame();
        }
    });

    // === بدء اللعبة ===
    if (loadState()) {
        undoBtn.disabled = true;
        updateDisplay();
        if (gameOver) showOverlay('😵 انتهت اللعبة!', 'lose');
    } else {
        init();
    }
    bestDisplay.textContent = bestScore;

})();
