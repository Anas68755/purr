(function(){
  // DOM elements
  const container = document.getElementById('gameContainer');
  const livesArea = document.getElementById('livesArea');
  const questionEl = document.getElementById('questionText');
  const scoreSpan = document.getElementById('score');
  const levelSpan = document.getElementById('level');
  const correctSpan = document.getElementById('correctCount');
  const highScoreSpan = document.getElementById('highScore');
  const calcDisplay = document.getElementById('calcDisplay');
  const messageDiv = document.getElementById('messageArea');
  const timerFill = document.getElementById('timerFill');
  const timerTextSpan = document.getElementById('timerText');
  const comboDisplay = document.getElementById('comboDisplay');
  const leaderboardDiv = document.getElementById('leaderboardList');

  // ---------- Leaderboard Management ----------
  let highScores = [];
  function loadScores() {
    try {
      let stored = localStorage.getItem('mathHighScores');
      if (stored) highScores = JSON.parse(stored);
      else highScores = [];
    } catch(e) { highScores = []; }
    highScores.sort((a,b) => b.score - a.score);
    updateLeaderboardDisplay();
  }
  function saveScores() {
    try { localStorage.setItem('mathHighScores', JSON.stringify(highScores.slice(0,10))); } catch(e) {}
  }
  function addScore(name, scoreValue) {
    if (!name.trim()) name = "Mystery Adventurer";
    highScores.push({ name: name.trim(), score: scoreValue });
    highScores.sort((a,b) => b.score - a.score);
    if (highScores.length > 10) highScores.pop();
    saveScores();
    updateLeaderboardDisplay();
  }
  function updateLeaderboardDisplay() {
    if (!leaderboardDiv) return;
    if (highScores.length === 0) {
      leaderboardDiv.innerHTML = '<div class="leaderboard-item">✨ No scores yet ✨</div>';
      return;
    }
    let html = '';
    highScores.forEach((item, idx) => {
      html += `<div class="leaderboard-item">
                  <span class="leaderboard-rank">${idx+1}</span>
                  <span>${escapeHtml(item.name)}</span>
                  <span>⭐ ${item.score}</span>
                </div>`;
    });
    leaderboardDiv.innerHTML = html;
  }
  function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
  function getCurrentHighScore() {
    if (highScores.length === 0) return 0;
    return highScores[0].score;
  }
  function updateHighScoreDisplay() {
    highScoreSpan.innerText = getCurrentHighScore();
  }

  // ---------- Game State ----------
  let lives = 5;
  let currentQuestion = { text: "", answer: 0 };
  let score = 0;
  let level = 1;
  let correctAnswers = 0;
  let combo = 1;
  let timer = 10.0;
  let timerInterval = null;
  let waitingForAnswer = false;
  let gameActive = true;
  let expression = "0";
  let currentValue = 0;

  function updateLivesDisplay() {
    let heartsHtml = '';
    for (let i=0; i<5; i++) {
      heartsHtml += (i < lives) ? '❤️ ' : '🖤 ';
    }
    livesArea.innerHTML = heartsHtml;
  }

  let timerEnd = 0, hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && timerInterval) { timerEnd += Date.now() - hiddenAt; hiddenAt = 0; }
  });
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function startTimer() {
    if (!gameActive) return;
    stopTimer();
    timer = 10.0;
    timerEnd = Date.now() + 10000;
    updateTimerUI();
    timerInterval = setInterval(() => {
      if (!waitingForAnswer || !gameActive || document.hidden) return;
      timer = Math.max(0, (timerEnd - Date.now()) / 1000);
      if (timer <= 0) {
        timer = 0;
        updateTimerUI();
        if (waitingForAnswer && gameActive) {
          waitingForAnswer = false;
          stopTimer();
          loseLife("⏰ Time's up!");
        }
      } else {
        updateTimerUI();
        if (timer < 3) {
          document.querySelector('.timer-text').style.color = "#ff3333";
          document.querySelector('.timer-bar-fill').style.background = "linear-gradient(90deg, #ff6666, #ff0000)";
        } else {
          document.querySelector('.timer-text').style.color = "#ffaa66";
          document.querySelector('.timer-bar-fill').style.background = "linear-gradient(90deg, #facc15, #ff4d4d)";
        }
      }
    }, 100);
  }

  function updateTimerUI() {
    let percent = (timer / 10.0) * 100;
    timerFill.style.width = `${Math.max(0, percent)}%`;
    timerTextSpan.innerText = timer.toFixed(1);
  }

  function loseLife(reason) {
    if (!gameActive) return;
    lives--;
    updateLivesDisplay();
    combo = 1;
    updateComboDisplay();
    container.classList.add('shake');
    setTimeout(() => container.classList.remove('shake'), 300);
    messageDiv.style.backgroundColor = "#4a0f0f";
    messageDiv.innerHTML = `❌ ${reason}! You lost a life. ${lives} lives left.`;
    setTimeout(() => messageDiv.style.backgroundColor = "", 1200);

    if (lives <= 0) {
      gameOver();
      return;
    }
    waitingForAnswer = false;
    stopTimer();
    generateQuestion();
    startTimer();
    waitingForAnswer = true;
    expression = "0";
    currentValue = 0;
    updateDisplay();
  }

  function gameOver() {
    gameActive = false;
    waitingForAnswer = false;
    stopTimer();
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay';
    overlay.innerHTML = `
      <div class="game-over-text">💀 GAME OVER 💀</div>
      <div class="final-score">⭐ Your score: ${score} | Level: ${level}</div>
      <input type="text" id="playerNameInput" class="name-input" placeholder="Enter your name" maxlength="15">
      <button id="saveScoreBtn" class="save-btn">💾 Save Score</button>
      <button id="overlayRestartBtn" class="restart-overlay-btn">🔥 Play Again 🔥</button>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);

    const saveBtn = overlay.querySelector('#saveScoreBtn');
    const restartBtn = overlay.querySelector('#overlayRestartBtn');
    const nameInput = overlay.querySelector('#playerNameInput');

    saveBtn.addEventListener('click', () => {
      if (saveBtn.disabled) return;
      let playerName = nameInput.value.trim();
      if (playerName === "") playerName = "Adventurer";
      addScore(playerName, score);
      updateHighScoreDisplay();
      saveBtn.disabled = true;
      saveBtn.innerText = "✓ Saved!";
    });

    restartBtn.addEventListener('click', () => {
      overlay.remove();
      fullReset();
    });
  }

  function handleCorrect() {
    let points = Math.floor(10 + level * 1.5 + (timer * 0.8) + (combo * 2));
    points = Math.max(5, points);
    score += points;
    correctAnswers++;
    combo++;
    if (combo > 12) combo = 12;
    updateComboDisplay();

    messageDiv.style.backgroundColor = "#1f5a2e";
    messageDiv.innerHTML = `✅ Correct! +${points} (Combo x${combo-1}) 🔥`;
    setTimeout(() => messageDiv.style.backgroundColor = "", 800);

    let newLevel = 1 + Math.floor(correctAnswers / 3);
    if (newLevel > level) {
      level = newLevel;
      messageDiv.innerHTML += ` 🎉 Level ${level}! 🎉`;
      container.style.borderColor = "#ffaa44";
      setTimeout(() => container.style.borderColor = "#ff5e3a", 300);
    }
    updateUI();
    if (score > getCurrentHighScore()) {
      updateHighScoreDisplay();
    }
    waitingForAnswer = false;
    stopTimer();
    generateQuestion();
    startTimer();
    waitingForAnswer = true;
    expression = "0";
    currentValue = 0;
    updateDisplay();
  }

  function generateQuestion() {
    let maxNum = Math.min(25 + level * 6, 250);
    let useDivision = (level >= 4) && (Math.random() < 0.25);
    let useMultiplication = (level >= 2) && (Math.random() < 0.4);

    let a, b, answer, text;
    if (useDivision && level >= 4) {
      let divisor = Math.floor(Math.random() * (Math.min(maxNum/3, 15))) + 2;
      let quotient = Math.floor(Math.random() * (Math.min(maxNum/divisor, 15))) + 1;
      a = divisor * quotient;
      b = divisor;
      answer = quotient;
      text = `${a} ÷ ${b} = ?`;
    } else if (useMultiplication) {
      a = Math.floor(Math.random() * (Math.min(maxNum/5, 12))) + 2;
      b = Math.floor(Math.random() * (Math.min(maxNum/a, 12))) + 2;
      answer = a * b;
      text = `${a} × ${b} = ?`;
    } else {
      let isSubtraction = (Math.random() > 0.5);
      if (isSubtraction) {
        a = Math.floor(Math.random() * maxNum) + 10;
        b = Math.floor(Math.random() * (a - 1)) + 1;
        answer = a - b;
        text = `${a} - ${b} = ?`;
      } else {
        a = Math.floor(Math.random() * maxNum) + 1;
        b = Math.floor(Math.random() * (maxNum - a + 5)) + 1;
        answer = a + b;
        text = `${a} + ${b} = ?`;
      }
    }
    currentQuestion = { text, answer };
    questionEl.innerText = text;
  }

  function updateComboDisplay() {
    comboDisplay.innerHTML = `🔥 Combo: x${combo}`;
    if (combo >= 5) comboDisplay.classList.add('combo-glow');
    else comboDisplay.classList.remove('combo-glow');
  }

  function updateUI() {
    scoreSpan.innerText = score;
    levelSpan.innerText = level;
    correctSpan.innerText = correctAnswers;
    updateHighScoreDisplay();
  }

  function checkAnswer() {
    if (!gameActive || !waitingForAnswer) return;
    let userAnswer = currentValue;
    if (isNaN(userAnswer)) {
      messageDiv.innerHTML = "⚠️ Please enter a valid number!";
      return;
    }
    let correct = currentQuestion.answer;
    if (Math.abs(userAnswer - correct) < 0.001) {
      handleCorrect();
    } else {
      waitingForAnswer = false;
      stopTimer();
      loseLife(`Wrong answer! Correct: ${correct}`);
    }
  }

  function fullReset() {
    gameActive = true;
    lives = 5;
    score = 0;
    level = 1;
    correctAnswers = 0;
    combo = 1;
    updateLivesDisplay();
    updateComboDisplay();
    updateUI();
    generateQuestion();
    waitingForAnswer = false;
    stopTimer();
    startTimer();
    waitingForAnswer = true;
    expression = "0";
    currentValue = 0;
    updateDisplay();
    messageDiv.innerHTML = "🔥 New game! You have 5 lives. 🔥";
    messageDiv.style.backgroundColor = "";
    container.classList.remove('shake');
  }

  // Calculator logic
  function evaluateExpression(expr) {
    try {
      const tokens = expr.replace(/×/g, '*').replace(/÷/g, '/').match(/\d+\.?\d*|\.\d+|[-+*/]|\S/g) || [];
      let i = 0;
      const unary = () => {
        if (tokens[i] === '-') { i++; return -unary(); }
        if (tokens[i] === '+') { i++; return unary(); }
        const t = tokens[i++];
        if (t === undefined || !/^(\d|\.\d)/.test(t)) throw 0;
        return parseFloat(t);
      };
      const term = () => {
        let v = unary();
        while (tokens[i] === '*' || tokens[i] === '/') v = tokens[i++] === '*' ? v * unary() : v / unary();
        return v;
      };
      const sum = () => {
        let v = term();
        while (tokens[i] === '+' || tokens[i] === '-') v = tokens[i++] === '+' ? v + term() : v - term();
        return v;
      };
      const result = sum();
      if (i !== tokens.length) throw 0;
      return isFinite(result) ? result : NaN;
    } catch(e) { return NaN; }
  }

  function updateExpression(newExpr) {
    expression = newExpr;
    if (expression === "") expression = "0";
    let evaluated = evaluateExpression(expression);
    if (!isNaN(evaluated) && isFinite(evaluated)) currentValue = evaluated;
    else currentValue = 0;
    updateDisplay();
  }

  function updateDisplay() {
    calcDisplay.innerText = expression.length > 28 ? expression.slice(0,26)+"…" : expression;
  }

  // Button bindings
  function initButtons() {
    document.querySelectorAll('.calc-btn[data-value]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!gameActive) return;
        let val = btn.getAttribute('data-value');
        if (expression === "0") expression = val;
        else expression += val;
        updateExpression(expression);
      });
    });
    document.querySelectorAll('.calc-btn[data-op]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!gameActive) return;
        let op = btn.getAttribute('data-op');
        let last = expression.slice(-1);
        if ("+-*/".includes(last)) expression = expression.slice(0, -1);
        expression += op;
        updateExpression(expression);
      });
    });
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (!gameActive) return;
      expression = "0";
      updateExpression(expression);
    });
    document.getElementById('clearAllBtn').addEventListener('click', () => {
      if (!gameActive) return;
      expression = "0";
      updateExpression(expression);
    });
    document.getElementById('backspaceBtn').addEventListener('click', () => {
      if (!gameActive) return;
      if (expression.length > 1) expression = expression.slice(0, -1);
      else expression = "0";
      updateExpression(expression);
    });
    document.getElementById('negativeBtn').addEventListener('click', () => {
      if (!gameActive) return;
      let val = currentValue;
      let newVal = -val;
      expression = newVal.toString();
      updateExpression(expression);
    });
    document.getElementById('equalsBtn').addEventListener('click', () => {
      if (!gameActive) return;
      checkAnswer();
    });
  }

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!gameActive || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = e.key;
      let sel = null;
      if (/^[0-9]$/.test(k)) sel = `.calc-btn[data-value="${k}"]`;
      else if (k === '+' || k === '-' || k === '*' || k === '/') sel = `.calc-btn[data-op="${k}"]`;
      else if (k === 'Enter' || k === '=') sel = '#equalsBtn';
      else if (k === 'Backspace') sel = '#backspaceBtn';
      else if (k === 'Escape' || k === 'Delete') sel = '#clearBtn';
      if (!sel) return;
      const btn = document.querySelector(sel);
      if (btn) { e.preventDefault(); btn.click(); }
    });
  }
  function init() {
    loadScores();
    initButtons();
    initKeyboard();
    fullReset();
  }

  init();
})();
