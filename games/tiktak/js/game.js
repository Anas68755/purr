
        // --- Start Screen & Audio Init ---
        function startGame() {
            document.getElementById('start-screen').classList.add('hidden');
            initAudio();
        }

        let audioCtx = null;
        function initAudio() {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }

        let isMuted = false;
        let bgMusicInterval = null;
        let musicNotes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
        let musicIndex = 0;

        function playSound(freq, duration, type = 'sine', volume = 0.1) {
            if (isMuted || !audioCtx) return;
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = type; osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            osc.start(); osc.stop(audioCtx.currentTime + duration);
        }

        function toggleMusic() {
            if (bgMusicInterval) {
                clearInterval(bgMusicInterval); bgMusicInterval = null;
                document.getElementById('btn-music').classList.remove('active');
            } else {
                bgMusicInterval = setInterval(() => {
                    if (isMuted || !audioCtx) return;
                    let osc = audioCtx.createOscillator();
                    let gain = audioCtx.createGain();
                    osc.connect(gain); gain.connect(audioCtx.destination);
                    osc.type = 'triangle';
                    osc.frequency.value = musicNotes[musicIndex];
                    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
                    osc.start(); osc.stop(audioCtx.currentTime + 0.5);
                    musicIndex = (musicIndex + 1) % musicNotes.length;
                }, 400);
                document.getElementById('btn-music').classList.add('active');
            }
        }

        function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

        // --- Game State ---
        const playerSword = '⚔️';
        const playerHammer = '🔨';
        const lavaSymbol = '🌋';
        
        let board = ['', '', '', '', '', '', '', '', ''];
        let currentPlayer = playerSword;
        let isGameActive = true;
        let gameMode = '2p';
        let difficulty = 'easy';
        let scores = { X: 0, O: 0, Draws: 0 };
        let streaks = { X: 0, O: 0 };
        let timerEnabled = false, timerInterval, timeLeft = 10;
        let moveHistory = []; // Will track { type: 'move', index, player } OR { type: 'lava', index }
        let undoCount = { X: 1, O: 1 };
        let playerNames = { X: 'السيف', O: 'المطرقة' };
        let powerups = { X: { bomb: 1, magic: 1, steal: 1 }, O: { bomb: 1, magic: 1, steal: 1 } };
        let activePowerup = null;
        let isCpuThinking = false;
        let cpuTimer = null;
        let lavaMode = false, turnsSinceLava = 0;
        let achievements = { flawlessWin: false };
        let usedPower = { X: { bomb: false, magic: false }, O: { bomb: false, magic: false } };

        const statusDisplay = document.getElementById('status');
        const boardElement = document.getElementById('board');
        const boardWrapper = document.getElementById('board-wrapper');
        const flashElement = document.getElementById('flash');
        const timerContainer = document.getElementById('timer-container');
        const timerBar = document.getElementById('timer-bar');
        const undoBtn = document.getElementById('undo-btn');
        const battleLog = document.getElementById('battle-log');
        const winSvg = document.getElementById('win-svg');
        const toastContainer = document.getElementById('toast-container');

        const aiPersonalities = {
            easy: { names: ['بندر', 'نوبيتا', 'مبتدئ'], emotes: ['😂', '😅', '🤪'] },
            med: { names: ['روبوكوب', 'سونيك', 'محارب'], emotes: ['🤔', '😤', '👀'] },
            hard: { names: ['التراسونيك', 'سكاي نت', 'الجدار'], emotes: ['😎', '💀', '🤖', '👁️'] }
        };

        const winningConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], 
            [0, 3, 6], [1, 4, 7], [2, 5, 8], 
            [0, 4, 8], [2, 4, 6]             
        ];

        function showToast(text, icon = '🏆') {
            const toast = document.createElement('div');
            toast.classList.add('toast');
            toast.innerHTML = `<span style="font-size:1.5em">${icon}</span> ${text}`;
            toastContainer.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        function logEvent(text) {
            const entry = document.createElement('div');
            entry.classList.add('log-entry');
            entry.innerText = text;
            battleLog.prepend(entry);
            while (battleLog.children.length > 3) battleLog.removeChild(battleLog.lastChild);
        }

        function updateNames() {
            playerNames.X = document.getElementById('name1').value || 'السيف';
            playerNames.O = document.getElementById('name2').value || 'المطرقة';
            document.getElementById('label1').innerText = `⚔️ ${playerNames.X}`;
            document.getElementById('label2').innerText = `🔨 ${playerNames.O}`;
            updateStatus();
        }

        function createBoard() {
            const svg = winSvg;
            boardElement.innerHTML = '';
            boardElement.appendChild(svg);
            svg.innerHTML = '';

            board.forEach((cell, index) => {
                const cellElement = document.createElement('div');
                cellElement.classList.add('cell');
                if (cell) cellElement.classList.add('taken');
                if (cell === lavaSymbol) cellElement.classList.add('lava');
                cellElement.setAttribute('data-index', index);
                
                if (cell && cell !== lavaSymbol) {
                    const iconSpan = document.createElement('span');
                    iconSpan.classList.add('icon');
                    iconSpan.innerText = cell;
                    cellElement.appendChild(iconSpan);
                } else if (cell === lavaSymbol) {
                    cellElement.innerText = lavaSymbol;
                }
                
                cellElement.addEventListener('click', () => handleCellClick(index));
                boardElement.appendChild(cellElement);
            });
            updateGlow();
            updatePowerupUI();
            updateUndoBtn();
        }

        function updateGlow() {
            document.getElementById('item-X').classList.toggle('active-turn', currentPlayer === playerSword && isGameActive);
            document.getElementById('item-O').classList.toggle('active-turn', currentPlayer === playerHammer && isGameActive);

            if (!isGameActive) { boardWrapper.classList.remove('sword-turn', 'hammer-turn'); return; }
            if (currentPlayer === playerSword) { boardWrapper.classList.add('sword-turn'); boardWrapper.classList.remove('hammer-turn'); }
            else { boardWrapper.classList.add('hammer-turn'); boardWrapper.classList.remove('sword-turn'); }
        }

        function updatePowerupUI() {
            let key = currentPlayer === playerSword ? 'X' : 'O';
            let isCpuTurn = (gameMode === 'cpu' && currentPlayer === playerHammer);
            ['bomb', 'magic', 'steal'].forEach(p => {
                const btn = document.getElementById(`power-${p}`);
                btn.disabled = (powerups[key][p] === 0 || !isGameActive || isCpuTurn);
                btn.querySelector('span').innerText = `${p === 'bomb' ? 'قنبلة' : p === 'magic' ? 'سحر' : 'سارق'} (${powerups[key][p]})`;
            });
        }

        function selectPowerup(type) {
            let key = currentPlayer === playerSword ? 'X' : 'O';
            if (powerups[key][type] === 0 || !isGameActive) return;
            
            if (type === 'steal') {
                useSteal();
                return;
            }

            activePowerup = (activePowerup === type) ? null : type;
            ['bomb', 'magic'].forEach(p => document.getElementById(`power-${p}`).classList.toggle('active-power', activePowerup === p));

            document.querySelectorAll('.cell').forEach(c => c.classList.remove('targetable'));
            if (activePowerup) {
                if (activePowerup === 'bomb') {
                    board.forEach((val, i) => { if(val !== '' && val !== lavaSymbol) document.querySelector(`[data-index="${i}"]`).classList.add('targetable'); });
                } else if (activePowerup === 'magic') {
                    let opp = currentPlayer === playerSword ? playerHammer : playerSword;
                    board.forEach((val, i) => { if(val === opp) document.querySelector(`[data-index="${i}"]`).classList.add('targetable'); });
                }
            }
        }

        function useSteal() {
            let key = currentPlayer === playerSword ? 'X' : 'O';
            let oppKey = key === 'X' ? 'O' : 'X';
            let available = [];
            for(let p in powerups[oppKey]) { if(powerups[oppKey][p] > 0) available.push(p); }
            
            if (available.length > 0) {
                let stolen = available[Math.floor(Math.random() * available.length)];
                powerups[oppKey][stolen]--;
                powerups[key][stolen]++;
                powerups[key].steal--; // Consume steal power
                logEvent(`🦹 ${playerNames[key]} سرق قوة (${stolen}) من ${playerNames[oppKey]}!`);
                playSound(600, 0.2, 'square', 0.1);
                vibrate(80);
                showToast(`سرقت قوة ${stolen}!`, '🦹');
                
                activePowerup = null;
                createBoard();
                if (isGameActive) { 
                    currentPlayer = currentPlayer === playerSword ? playerHammer : playerSword; 
                    updateStatus(); startTimer(); 
                }
            } else {
                logEvent(`🦹 لا يوجد ما يسرقه من ${playerNames[oppKey]}!`);
                showToast(`لا يوجد ما يسرقه!`, '🤷');
                // Return without consuming the power or switching turn
                activePowerup = null;
                createBoard();
            }
        }

        function updateUndoBtn() {
            let key = (gameMode === 'cpu') ? 'X' : (currentPlayer === playerSword ? 'X' : 'O');
            undoBtn.innerText = `↩️ تراجع (متاح: ${undoCount[key]})`;
            undoBtn.disabled = (undoCount[key] === 0 || moveHistory.length === 0 || !isGameActive || isCpuThinking);
        }

        function handleCellClick(index) {
            if (!isGameActive || isCpuThinking || board[index] === lavaSymbol) return;

            if (activePowerup) { usePowerup(index); return; }

            if (board[index] !== '') return;
            if (gameMode === 'cpu' && currentPlayer === playerHammer) return;

            makeMove(index, currentPlayer);
            
            if (isGameActive && gameMode === 'cpu' && currentPlayer === playerHammer) {
                isCpuThinking = true;
                statusDisplay.innerText = "الكمبيوتر يفكر... 🤖";
                updateUndoBtn();
                cpuTimer = setTimeout(cpuMove, 800);
            }
        }

        function usePowerup(index) {
            let key = currentPlayer === playerSword ? 'X' : 'O';
            let name = playerNames[key];
            
            if (activePowerup === 'bomb' && board[index] !== '' && board[index] !== lavaSymbol) {
                powerups[key].bomb--;
                logEvent(`💣 ${name} فجر قنبلة على الخانة ${index + 1}!`);
                board[index] = '';
                playSound(80, 0.5, 'sawtooth', 0.2); vibrate(100);
                triggerSmallExplosion(index);
                usedPower[key].bomb = true;
            } else if (activePowerup === 'magic') {
                let opp = currentPlayer === playerSword ? playerHammer : playerSword;
                if (board[index] === opp) {
                    powerups[key].magic--;
                    logEvent(`🪄 ${name} سحر رمز الخصم وحوله إلى ${currentPlayer}!`);
                    board[index] = currentPlayer;
                    playSound(1000, 0.3, 'sine', 0.1); vibrate(50);
                    usedPower[key].magic = true;
                }
            }

            activePowerup = null;
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('targetable'));
            checkResult();
            if (isGameActive) {
                currentPlayer = currentPlayer === playerSword ? playerHammer : playerSword;
                updateStatus(); startTimer();
            }
            createBoard();
        }

        function makeMove(index, player) {
            clearInterval(timerInterval);
            board[index] = player;
            moveHistory.push({ type: 'move', index, player });
            playSound(player === playerSword ? 400 : 300, 0.1, 'square', 0.05);
            vibrate(30);
            logEvent(`${player} لعب في الخانة ${index + 1}`);
            checkResult();
            
            if (isGameActive && lavaMode) {
                turnsSinceLava++;
                if (turnsSinceLava >= 3) {
                    turnsSinceLava = 0;
                    spawnLava();
                }
            }

            if (isGameActive) {
                currentPlayer = currentPlayer === playerSword ? playerHammer : playerSword;
                updateStatus(); startTimer();
            }
            createBoard();
        }

        function spawnLava() {
            let empty = board.map((val, i) => val === '' ? i : null).filter(val => val !== null);
            if (empty.length > 0) {
                let idx = empty[Math.floor(Math.random() * empty.length)];
                board[idx] = lavaSymbol;
                moveHistory.push({ type: 'lava', index: idx }); // Track lava for undo
                logEvent('🌋 ظهرت حمم بركانية وسدت خانة!');
                playSound(150, 0.5, 'sawtooth', 0.2);
                vibrate(150);
            }
        }

        function undoMove() {
            if (moveHistory.length === 0 || !isGameActive || isCpuThinking) return;

            // In CPU mode the human (Sword/X) is always the one requesting the undo,
            // since the CPU never clicks the button itself.
            let requestingKey = (gameMode === 'cpu') ? 'X' : (currentPlayer === playerSword ? 'X' : 'O');
            if (undoCount[requestingKey] <= 0) return;

            // Pops one "turn" off the history: a move, optionally preceded by a lava spawn.
            // Returns which player made that move, or null if there was nothing to undo.
            function popOneTurn() {
                if (moveHistory.length === 0) return null;
                let action = moveHistory.pop();
                if (action.type === 'lava') {
                    board[action.index] = '';
                    if (moveHistory.length === 0) return null;
                    action = moveHistory.pop();
                }
                board[action.index] = '';
                return action.player;
            }

            let lastMover = popOneTurn();
            if (lastMover === null) { updateUndoBtn(); return; }

            if (gameMode === 'cpu' && lastMover === playerHammer) {
                // The CPU's move was on top of the stack — undo it, then also undo
                // the human's preceding move so control returns to the human's turn.
                popOneTurn();
                currentPlayer = playerSword;
            } else {
                currentPlayer = lastMover;
            }

            undoCount[requestingKey]--;
            clearTimeout(cpuTimer);
            isCpuThinking = false;
            logEvent(`↩️ ${playerNames[requestingKey]} تراجع عن الحركة`);
            playSound(150, 0.2, 'triangle', 0.1);
            updateStatus();
            startTimer();
            createBoard();
        }

        function startTimer() {
            if (!timerEnabled || !isGameActive) return;
            clearInterval(timerInterval);
            timeLeft = 10;
            let last = Date.now();
            timerBar.style.width = '100%';
            timerBar.style.background = 'var(--neon-green)';
            timerInterval = setInterval(() => {
                const now = Date.now();
                if (!document.hidden) timeLeft -= (now - last) / 1000;
                last = now;
                timerBar.style.width = (timeLeft * 10) + '%';
                if (timeLeft <= 3) timerBar.style.background = 'var(--neon-pink)';
                if (timeLeft <= 0) { clearInterval(timerInterval); timeOut(); }
            }, 100);
        }

        function timeOut() {
            isGameActive = false;
            let winner = currentPlayer === playerSword ? playerHammer : playerSword;
            let winnerKey = winner === playerSword ? 'X' : 'O';
            statusDisplay.innerText = `⏱️ انتهى الوقت! الفائز ${winner}`;
            logEvent(`⏱️ انتهى وقت ${playerNames[currentPlayer === playerSword ? 'X' : 'O']}!`);
            if (winner === playerSword) { scores.X++; streaks.X++; streaks.O = 0; }
            else { scores.O++; streaks.O++; streaks.X = 0; }
            updateScores();
            triggerEpicExplosion(); playExplosionSound();
            checkAchievements(winnerKey);
            checkChampion();
            createBoard();
        }

        function cpuMove() {
            isCpuThinking = false;
            if (!isGameActive || currentPlayer !== playerHammer) return;
            let moveIndex;
            if (difficulty === 'easy') {
                let available = board.map((val, i) => val === '' ? i : null).filter(val => val !== null);
                moveIndex = available[Math.floor(Math.random() * available.length)];
            } else if (difficulty === 'med') {
                if (Math.random() > 0.5) moveIndex = findBestMove();
                else {
                    let available = board.map((val, i) => val === '' ? i : null).filter(val => val !== null);
                    moveIndex = available[Math.floor(Math.random() * available.length)];
                }
            } else {
                moveIndex = findBestMove();
            }
            if (moveIndex === undefined || moveIndex < 0) return;
            makeMove(moveIndex, playerHammer);
            
            if (Math.random() < 0.15 && isGameActive) {
                let emotes = aiPersonalities[difficulty].emotes;
                setTimeout(() => sendEmote(emotes[Math.floor(Math.random() * emotes.length)], true), 300);
            }
        }

        function findBestMove() {
            let bestScore = -Infinity, move = -1;
            for (let i = 0; i < board.length; i++) {
                if (board[i] === '') {
                    board[i] = playerHammer;
                    let score = minimax(board, 0, false);
                    board[i] = '';
                    if (score > bestScore) { bestScore = score; move = i; }
                }
            }
            return move;
        }

        function minimax(boardState, depth, isMaximizing) {
            let result = checkWinner(boardState);
            if (result !== null) {
                if (result === playerHammer) return 10 - depth;
                if (result === playerSword) return depth - 10;
                return 0;
            }
            if (isMaximizing) {
                let bestScore = -Infinity;
                for (let i = 0; i < boardState.length; i++) {
                    if (boardState[i] === '') {
                        boardState[i] = playerHammer;
                        let score = minimax(boardState, depth + 1, false);
                        boardState[i] = '';
                        bestScore = Math.max(score, bestScore);
                    }
                }
                return bestScore;
            } else {
                let bestScore = Infinity;
                for (let i = 0; i < boardState.length; i++) {
                    if (boardState[i] === '') {
                        boardState[i] = playerSword;
                        let score = minimax(boardState, depth + 1, true);
                        boardState[i] = '';
                        bestScore = Math.min(score, bestScore);
                    }
                }
                return bestScore;
            }
        }

        function checkResult() {
            let roundWon = false, winCondition = null;
            for (let i = 0; i < winningConditions.length; i++) {
                const [a, b, c] = winningConditions[i];
                if (board[a] && board[a] !== lavaSymbol && board[a] === board[b] && board[a] === board[c]) {
                    roundWon = true; winCondition = winningConditions[i]; break;
                }
            }
            if (roundWon) {
                let winnerKey = currentPlayer === playerSword ? 'X' : 'O';
                statusDisplay.innerText = `🎉 فاز ${currentPlayer} (${playerNames[winnerKey]})!`;
                logEvent(`🏆 ${playerNames[winnerKey]} يفوز بالجولة!`);
                isGameActive = false;
                winCondition.forEach(index => document.querySelector(`[data-index="${index}"]`).classList.add('win'));
                drawWinLine(winCondition);
                if (currentPlayer === playerSword) { scores.X++; streaks.X++; streaks.O = 0; }
                else { scores.O++; streaks.O++; streaks.X = 0; }
                updateScores();
                triggerEpicExplosion(); playExplosionSound();
                vibrate([200, 100, 200]);
                checkAchievements(winnerKey);
                checkChampion();
                return;
            }
            if (!board.includes('')) {
                statusDisplay.innerText = '🤝 تعادل!';
                logEvent('🤝 تعادل!');
                isGameActive = false;
                streaks.X = 0; streaks.O = 0;
                scores.Draws++;
                updateScores();
                playSound(200, 0.5, 'sawtooth', 0.1);
            }
        }

        function checkAchievements(winnerKey) {
            if (scores[winnerKey] === 3 && scores[winnerKey === 'X' ? 'O' : 'X'] === 0) {
                if (!achievements.flawlessWin) showToast('انتصار ساحق! لم تخسر جولة واحدة', '✨');
                achievements.flawlessWin = true;
            }
            if (usedPower[winnerKey].magic) showToast('انتصار بالسحر الأسود!', '🪄');
            if (usedPower[winnerKey].bomb) showToast('انتصار بالدمار!', '💣');
        }

        function drawWinLine(winCondition) {
            const cellSize = document.querySelector('.cell').offsetWidth;
            const gap = 8;
            const positions = {
                0: [0,0], 1: [1,0], 2: [2,0],
                3: [0,1], 4: [1,1], 5: [2,1],
                6: [0,2], 7: [1,2], 8: [2,2]
            };
            const [start, , end] = winCondition;
            const [sx, sy] = positions[start];
            const [ex, ey] = positions[end];
            
            const x1 = sx * (cellSize + gap) + cellSize/2;
            const y1 = sy * (cellSize + gap) + cellSize/2;
            const x2 = ex * (cellSize + gap) + cellSize/2;
            const y2 = ey * (cellSize + gap) + cellSize/2;
            
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1); line.setAttribute("y1", y1);
            line.setAttribute("x2", x2); line.setAttribute("y2", y2);
            line.setAttribute("stroke", "#2ecc71"); // Fixed Hex color for SVG
            line.classList.add('win-line');
            winSvg.appendChild(line);
        }

        function checkChampion() {
            if (scores.X === 3 || scores.O === 3) {
                let champ = scores.X === 3 ? `⚔️ ${playerNames.X}` : `🔨 ${playerNames.O}`;
                document.getElementById('champion-text').innerText = `${champ} هو البطل!`;
                document.getElementById('champion-overlay').style.display = 'flex';
                triggerConfetti();
            }
        }

        function checkWinner(boardState) {
            for (let i = 0; i < winningConditions.length; i++) {
                const [a, b, c] = winningConditions[i];
                if (boardState[a] && boardState[a] !== lavaSymbol && boardState[a] === boardState[b] && boardState[a] === boardState[c]) return boardState[a];
            }
            if (!boardState.includes('')) return 'Draw';
            return null;
        }

        function updateStatus() {
            if (!isGameActive) return;
            let key = currentPlayer === playerSword ? 'X' : 'O';
            statusDisplay.innerText = `دور ${currentPlayer} (${playerNames[key]})`;
        }

        function updateScores() {
            document.getElementById('scoreX').innerText = scores.X;
            document.getElementById('scoreO').innerText = scores.O;
            document.getElementById('streakX').innerText = `سلسلة: ${streaks.X}`;
            document.getElementById('streakO').innerText = `سلسلة: ${streaks.O}`;
            document.getElementById('draws').innerText = scores.Draws;
        }

        function triggerSmallExplosion(cellIndex) {
            const cell = document.querySelector(`[data-index="${cellIndex}"]`);
            const rect = cell.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            for (let i = 0; i < 15; i++) {
                const p = document.createElement('div');
                p.classList.add('particle');
                p.innerText = ['💨', '💥', '🔥'][Math.floor(Math.random() * 3)];
                p.style.left = `${cx}px`; p.style.top = `${cy}px`;
                const angle = Math.random() * Math.PI * 2, vel = Math.random() * 100 + 50;
                p.style.setProperty('--tx', `${Math.cos(angle) * vel}px`);
                p.style.setProperty('--ty', `${Math.sin(angle) * vel}px`);
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 1000);
            }
        }

        function triggerEpicExplosion() {
            flashElement.style.opacity = '0.8';
            setTimeout(() => flashElement.style.opacity = '0', 100);
            boardWrapper.classList.remove('shake');
            void boardWrapper.offsetWidth;
            boardWrapper.classList.add('shake');
            const rect = boardElement.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const emojis = ['💥', '🔥', '💨', '⭐', '🎉'];
            for (let i = 0; i < 40; i++) {
                const p = document.createElement('div');
                p.classList.add('particle');
                p.innerText = emojis[Math.floor(Math.random() * emojis.length)];
                p.style.left = `${cx}px`; p.style.top = `${cy}px`;
                const angle = Math.random() * Math.PI * 2, vel = Math.random() * 300 + 100;
                p.style.setProperty('--tx', `${Math.cos(angle) * vel}px`);
                p.style.setProperty('--ty', `${Math.sin(angle) * vel}px`);
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 1000);
            }
        }

        function triggerConfetti() {
            const colors = ['#ff0055', '#00f3ff', '#f1c40f', '#2ecc71', '#ffffff'];
            for (let i = 0; i < 200; i++) {
                const c = document.createElement('div');
                c.classList.add('confetti');
                c.style.left = Math.random() * 100 + 'vw';
                c.style.background = colors[Math.floor(Math.random() * colors.length)];
                c.style.animationDuration = (Math.random() * 3 + 2) + 's';
                c.style.animationDelay = Math.random() + 's';
                c.style.transform = `rotate(${Math.random() * 360}deg)`;
                if (Math.random() > 0.5) c.style.borderRadius = '50%';
                document.body.appendChild(c);
                setTimeout(() => c.remove(), 6000);
            }
        }

        function playExplosionSound() {
            playSound(100, 0.2, 'sawtooth', 0.2);
            setTimeout(() => playSound(50, 0.5, 'sawtooth', 0.15), 100);
            setTimeout(() => playSound(80, 0.3, 'square', 0.1), 200);
        }

        function sendEmote(emoji, isCpu = false) {
            const el = document.createElement('div');
            el.classList.add('flying-emote');
            el.innerText = emoji;
            el.style.left = (Math.random() * 80 + 10) + '%';
            document.body.appendChild(el);
            playSound(800, 0.1, 'sine', 0.05);
            setTimeout(() => el.remove(), 2000);
            if (!isCpu) logEvent(`أرسلت ${emoji}`);
            else logEvent(`الكمبيوتر يرسل ${emoji}`);
        }

        function toggleRules() {
            const modal = document.getElementById('rules-modal');
            modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
        }

        function toggleTimer() {
            timerEnabled = !timerEnabled;
            document.getElementById('btn-timer').classList.toggle('active', timerEnabled);
            timerContainer.style.display = timerEnabled ? 'block' : 'none';
            if (timerEnabled && isGameActive) startTimer();
            else clearInterval(timerInterval);
        }

        function toggleLava() {
            lavaMode = !lavaMode;
            document.getElementById('btn-lava').classList.toggle('active', lavaMode);
            resetGame(false);
            if (lavaMode) showToast('تم تفعيل وضع الحمم البركانية!', '🔥');
        }

        function toggleSound() {
            isMuted = !isMuted;
            document.getElementById('btn-sound').innerText = isMuted ? "🔇 الصوت" : "🔊 الصوت";
            document.getElementById('btn-sound').classList.toggle('active', !isMuted);
        }

        function setMode(mode) {
            gameMode = mode;
            document.getElementById('btn-2p').classList.toggle('active', mode === '2p');
            document.getElementById('btn-cpu').classList.toggle('active', mode === 'cpu');
            resetScores();
        }

        function setDifficulty(diff) {
            difficulty = diff;
            document.getElementById('btn-easy').classList.toggle('active', diff === 'easy');
            document.getElementById('btn-med').classList.toggle('active', diff === 'med');
            document.getElementById('btn-hard').classList.toggle('active', diff === 'hard');
            if (gameMode === 'cpu') {
                let names = aiPersonalities[diff].names;
                playerNames.O = names[Math.floor(Math.random() * names.length)];
                document.getElementById('name2').value = playerNames.O;
                updateNames();
                resetGame(false);
            }
        }

        function setTheme(theme) {
            document.body.className = `theme-${theme}`;
            document.getElementById('theme-cyber').classList.toggle('active', theme === 'cyberpunk');
            document.getElementById('theme-matrix').classList.toggle('active', theme === 'matrix');
            document.getElementById('theme-sunset').classList.toggle('active', theme === 'sunset');
        }

        function resetGame(resetScore) {
            clearInterval(timerInterval);
            clearTimeout(cpuTimer);
            board = ['', '', '', '', '', '', '', '', ''];
            currentPlayer = playerSword;
            isGameActive = true;
            moveHistory = [];
            undoCount = { X: 1, O: 1 };
            powerups = { X: { bomb: 1, magic: 1, steal: 1 }, O: { bomb: 1, magic: 1, steal: 1 } };
            activePowerup = null;
            isCpuThinking = false;
            turnsSinceLava = 0;
            achievements = { flawlessWin: false };
            usedPower = { X: { bomb: false, magic: false }, O: { bomb: false, magic: false } };
            updateStatus();
            createBoard();
            if (timerEnabled) startTimer();
            logEvent('--- جولة جديدة ---');
        }

        function resetScores() {
            scores = { X: 0, O: 0, Draws: 0 };
            streaks = { X: 0, O: 0 };
            updateScores();
            document.getElementById('champion-overlay').style.display = 'none';
            resetGame(false);
        }

        document.addEventListener('keydown', (e) => {
            if (isCpuThinking) return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            const key = parseInt(e.key);
            if (key >= 1 && key <= 9) {
                const mapping = {7:0, 8:1, 9:2, 4:3, 5:4, 6:5, 1:6, 2:7, 3:8};
                handleCellClick(mapping[key]);
            }
        });

        // --- Canvas Background & Cursor Trail (Optimized) ---
        const canvas = document.getElementById('bg-canvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouseX = -100, mouseY = -100;
        let trail = [];

        function initCanvas() {
            canvas.width = window.innerWidth; 
            canvas.height = window.innerHeight;
            particles = [];
            for(let i=0; i<50; i++) particles.push({
                x: Math.random()*canvas.width, 
                y: Math.random()*canvas.height, 
                vx: (Math.random()-0.5)*0.5, 
                vy: (Math.random()-0.5)*0.5
            });
        }

        function drawCanvas() {
            ctx.clearRect(0,0,canvas.width,canvas.height);
            let color = currentPlayer === playerSword ? '0, 243, 255' : '255, 0, 85';
            
            // Draw background particles
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if(p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if(p.y < 0 || p.y > canvas.height) p.vy *= -1;
                ctx.fillStyle = `rgba(${color}, 0.5)`;
                ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2); ctx.fill();
                
                particles.forEach(p2 => {
                    let dist = Math.hypot(p.x-p2.x, p.y-p2.y);
                    if(dist < 120) {
                        ctx.strokeStyle = `rgba(${color}, ${0.2 - dist/600})`;
                        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                    }
                });
            });

            // Draw Cursor Trail
            trail.push({x: mouseX, y: mouseY});
            if (trail.length > 15) trail.shift();
            
            for(let i=0; i<trail.length; i++) {
                let t = trail[i];
                let alpha = i / trail.length;
                ctx.fillStyle = `rgba(${color}, ${alpha})`;
                ctx.beginPath(); ctx.arc(t.x, t.y, 5 + i*0.5, 0, Math.PI*2); ctx.fill();
            }

            requestAnimationFrame(drawCanvas);
        }

        window.addEventListener('resize', initCanvas);
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX; mouseY = e.clientY;
        });
        
        // 3D Tilt Effect for Mobile & Desktop
        function handleTilt(e) {
            const rect = boardWrapper.getBoundingClientRect();
            let x, y;
            if (e.touches) {
                x = e.touches[0].clientX - rect.left - rect.width / 2;
                y = e.touches[0].clientY - rect.top - rect.height / 2;
            } else {
                x = e.clientX - rect.left - rect.width / 2;
                y = e.clientY - rect.top - rect.height / 2;
            }
            const rotateX = (y / rect.height) * -10;
            const rotateY = (x / rect.width) * 10;
            boardWrapper.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        }

        boardWrapper.addEventListener('mousemove', handleTilt);
        boardWrapper.addEventListener('touchmove', handleTilt);
        boardWrapper.addEventListener('mouseleave', () => {
            boardWrapper.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        });
        boardWrapper.addEventListener('touchend', () => {
            boardWrapper.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        });

        // Initial Load
        initCanvas();
        drawCanvas();
        createBoard();
        logEvent('مرحباً بك في ساحة المعركة!');
    
