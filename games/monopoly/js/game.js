
    const COLORS = ['#2efcff','#ff4fd8','#7c5cff','#6dff9f'];
    const TOKENS = ['1','2','3','4'];
    const boardEl = document.getElementById('board');
    const tilesEl = document.getElementById('tiles');
    const tokensEl = document.getElementById('tokens');
    const logEl = document.getElementById('log');
    const playerListEl = document.getElementById('playerList');
    const nameInputsEl = document.getElementById('nameInputs');
    const hintTextEl = document.getElementById('hintText');
    const turnChipEl = document.getElementById('turnChip');
    const phaseChipEl = document.getElementById('phaseChip');
    const centerCashEl = document.getElementById('centerCash');
    const centerPowerEl = document.getElementById('centerPower');
    const centerMarketEl = document.getElementById('centerMarket');
    const activeCardsEl = document.getElementById('activeCards');
    const rulesModal = document.getElementById('rulesModal');
    const auctionModal = document.getElementById('auctionModal');
    const auctionListEl = document.getElementById('auctionList');
    const auctionTitleEl = document.getElementById('auctionTitle');
    const auctionDescEl = document.getElementById('auctionDesc');

    const SPACE_TYPES = {
      start: 'start', property: 'property', tax: 'tax', event: 'event', special: 'special'
    };

    const spaces = [
      {name:'البدء', type:'start', reward:200, desc:'احصل على 200 عند المرور.'},
      {name:'مِحور زَهو', type:'property', price:120, baseRent:16, color:'#2efcff', group:'A', desc:'منطقة تجارية سريعة.'},
      {name:'سوق الليزر', type:'property', price:140, baseRent:18, color:'#2efcff', group:'A', desc:'ترقياته ترفع الإيجار بشكل حاد.'},
      {name:'ضريبة استهلاك', type:'tax', amount:110, desc:'ادفع للدولة النيورونية.'},
      {name:'بوابة', type:'special', kind:'teleport', desc:'انتقل إلى أي عقار مملوك أو إلى البدء.'},
      {name:'مركز بيانات', type:'property', price:160, baseRent:22, color:'#ff4fd8', group:'B', desc:'عقارات ذات دخل ثابت.'},
      {name:'حدث نيوني', type:'event', desc:'اسحب بطاقة من حزمة السوق.'},
      {name:'محطة شحن', type:'property', price:180, baseRent:26, color:'#ff4fd8', group:'B', desc:'حارس ممتاز ضد التقلبات.'},
      {name:'صندوق أمان', type:'special', kind:'shield', desc:'احصل على درع يمنع أول عقوبة.'},
      {name:'شارع النبض', type:'property', price:200, baseRent:30, color:'#7c5cff', group:'C', desc:'يربح أكثر مع الترقيات.'},
      {name:'ضرائب متغيرة', type:'tax', amount:140, desc:'تتغير وفق السوق.'},
      {name:'ميناء رقمي', type:'special', kind:'market', desc:'إذا فزت بالميناء، يرتفع السوق لصالحك.'},
      {name:'عقد استثمار', type:'property', price:220, baseRent:34, color:'#7c5cff', group:'C', desc:'قوي في المراحل المتأخرة.'},
      {name:'حدث نيوني', type:'event', desc:'عشوائية استراتيجية.'},
      {name:'نقطة حماية', type:'special', kind:'safe', desc:'لا إيجار هنا. لا ضريبة. استراحة تكتيكية.'},
      {name:'أبراج المصابيح', type:'property', price:240, baseRent:38, color:'#6dff9f', group:'D', desc:'عقار متطور.'},
      {name:'سوق سوداء', type:'special', kind:'auction', desc:'إذا لم تشترِ، يفتح مزاد سريع.'},
      {name:'منطقة نانو', type:'property', price:260, baseRent:42, color:'#6dff9f', group:'D', desc:'إيجار مرعب عند اكتمال السلسلة.'},
      {name:'ضريبة طاقة', type:'tax', amount:180, desc:'ضريبة متأخرة اللعبة.'},
      {name:'الذروة', type:'property', price:300, baseRent:50, color:'#2efcff', group:'E', desc:'العقار الأثمن. من يسيطر عليه يفرض الإيقاع.'}
    ];

    const eventCards = [
      {title:'طفرة سوق', text:'كل أملاكك ترتفع قيمتها مؤقتًا. +75 لكل لاعب يمر عليك هذا الدور.', effect:'buffMarket'},
      {title:'اختراق', text:'خذ 100 من بنك اللعبة من أي لاعب عشوائي يملك عقارًا.', effect:'hack'},
      {title:'إعادة تمويل', text:'إن توفر لديك 50، تُدفع تلقائيًا مقابل 150 نقدًا فورًا. وإن لم يتوفر الرصيد، تحصل على درع بدلاً من ذلك.', effect:'refi'},
      {title:'قفزة ضوئية', text:'انتقل إلى أي خانة عقار غير مملوكة واشتريها بسعر مخفّض 20%.', effect:'jumpBuy'},
      {title:'هجمة مرتدة', text:'صاحب العقار الذي على موقعك يدفع لك 60 إضافية مرة واحدة.', effect:'counter'},
      {title:'Reset', text:'عد إلى البدء وخذ 200، لكن السوق ينخفض 10%.', effect:'reset'},
    ];

    let game = null;
    let fastMode = true;

    function money(n){ return `${Math.round(n)}¤`; }
    function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
    function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
    function rollD6(){ return 1 + Math.floor(Math.random()*6); }
    function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function buildNameInputs(){
      const count = +document.getElementById('playerCount').value;
      const defaults = ['نيرو','كيو','أوميغا','ليكس'];
      nameInputsEl.innerHTML = '';
      for(let i=0;i<count;i++){
        const wrap = document.createElement('div');
        wrap.className = 'field';
        wrap.innerHTML = `<label>اسم اللاعب ${i+1}</label><input value="${defaults[i]}" id="pname${i}" />`;
        nameInputsEl.appendChild(wrap);
      }
    }

    function createGame(){
      const count = +document.getElementById('playerCount').value;
      const startMoney = +document.getElementById('startMoney').value;
      const names = [...Array(count)].map((_,i)=>(document.getElementById(`pname${i}`)?.value || '').replace(/[<>&"'`]/g,'').trim().slice(0,16) || `Player ${i+1}`);
      game = {
        turn:0,
        phase:'انتظار الرمي',
        market:100,
        winner:null,
        players: names.map((name,i)=>({
          name, color:COLORS[i], token:TOKENS[i], pos:0, cash:startMoney, shield:0,
          extraRoll:0, skipTurn:0, alive:true, jail:0, cards:[]
        })),
        ownership: Array(spaces.length).fill(null),
        upgrades: Array(spaces.length).fill(0),
        pendingMove:null,
        canBuy:false,
        currentSpace:null,
        currentRoll:null,
        marketBuffTurns:0,
        chain:0,
        lastDouble:false,
        selectedAuction:null,
      };
      log('تم إنشاء لعبة جديدة. الوضع السريع مفعّل، ويمكنك إيقافه من الزر العلوي.');
      renderAll();
      setPhase('انتظار الرمي');
      updateHint('اضغط رمي النرد لبدء الجولة.');
    }

    function currentPlayer(){ return game.players[game.turn]; }
    function alivePlayers(){ return game.players.filter(p=>p.alive); }

    function log(msg){
      const div = document.createElement('div');
      div.className = 'log-entry';
      const t = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      div.innerHTML = `<span class="t">${t}</span>${msg}`;
      logEl.prepend(div);
    }

    function updateHint(text){ hintTextEl.textContent = text; }
    function setPhase(text){ game.phase = text; phaseChipEl.textContent = `المرحلة: ${text}`; }

    function applyMarket(){
      const fluct = (Math.random()*0.4 - 0.2); // -20% .. +20%
      game.market = clamp(game.market * (1 + fluct), 70, 150);
      if(game.marketBuffTurns > 0) game.marketBuffTurns--;
      centerMarketEl.textContent = `${Math.round(game.market)}%`;
    }

    function boardIndexToXY(index){
      // عام: يحسب موضع أي خانة على محيط مربّع بعدد خانات = 4*(side-1)
      // لدينا 20 خانة => side = 6 (5 خطوات بين كل ركنين)
      const n = spaces.length;
      const side = n / 4 + 1; // = 6 لِـ 20 خانة
      const steps = side - 1; // = 5
      const size = 16.4; // المسافة بين مركزي خانتين متجاورتين (%)
      const pad = 2;     // هامش اللوحة (%)

      let x, y;
      if(index <= steps){
        // الضلع العلوي: من أعلى اليسار إلى أعلى اليمين
        x = index; y = 0;
      } else if(index <= steps*2){
        // الضلع الأيمن: من أعلى اليمين إلى أسفل اليمين
        x = steps; y = index - steps;
      } else if(index <= steps*3){
        // الضلع السفلي: من أسفل اليمين إلى أسفل اليسار
        x = steps - (index - steps*2); y = steps;
      } else {
        // الضلع الأيسر: من أسفل اليسار صعودًا إلى أعلى اليسار (دون تكرار الركن)
        x = 0; y = steps - (index - steps*3);
      }
      return [pad + x*size, pad + y*size];
    }

    function tileLabel(space){
      if(space.type==='property') return `${space.price} / ${space.baseRent}`;
      if(space.type==='tax') return `ضريبة ${space.amount}`;
      if(space.type==='event') return `بطاقة`;
      if(space.type==='special') return space.kind;
      return 'ابدأ';
    }

    function renderBoard(){
      tilesEl.innerHTML='';
      spaces.forEach((space, i)=>{
        const tile = document.createElement('div');
        tile.className = `tile ${space.type}`;
        const [x,y] = boardIndexToXY(i);
        tile.style.left = `${x}%`;
        tile.style.top = `${y}%`;
        if(i===0) tile.style.width = tile.style.height = '14.4%';
        if(game?.ownership?.[i] !== null) tile.classList.add('owned');
        if(game?.currentSpace === i) tile.classList.add('active');
        const owner = game?.ownership?.[i];
        if(owner !== null && owner !== undefined){ tile.style.setProperty('--own', game.players[owner].color); }
        tile.innerHTML = `
          <div class="ownership-bar" ${owner !== null && owner !== undefined ? '' : 'style="opacity:.1"'}></div>
          <div class="name">${space.name}</div>
          <div class="meta">${space.desc || ''}</div>
          <div class="price">${tileLabel(space)}</div>
          <div class="band"></div>
        `;
        tilesEl.appendChild(tile);
      });
    }

    function tokenPosition(pos, idx){
      const [x,y] = boardIndexToXY(pos);
      // token cluster offsets for multiple players on same tile
      const offsets = [
        [-1.3,-1.3], [1.3,-1.3], [-1.3,1.3], [1.3,1.3]
      ];
      const [ox,oy] = offsets[idx%offsets.length];
      return {left: `${x + 7 + ox}%`, top: `${y + 7 + oy}%`};
    }

    function renderTokens(){
      tokensEl.innerHTML='';
      game.players.forEach((p, i)=>{
        if(!p.alive) return;
        const token = document.createElement('div');
        token.className = 'token';
        token.dataset.id = p.token;
        token.style.background = p.color;
        const pos = tokenPosition(p.pos, i);
        token.style.left = pos.left;
        token.style.top = pos.top;
        tokensEl.appendChild(token);
      });
    }

    function renderPlayers(){
      playerListEl.innerHTML='';
      game.players.forEach((p, i)=>{
        const countProps = game.ownership.reduce((a,o)=>a + (o===i), 0);
        const row = document.createElement('div');
        row.className = 'player-row';
        if(i === game.turn) row.style.outline = `1px solid ${p.color}66`;
        row.innerHTML = `
          <div class="avatar" style="background:${p.color}"></div>
          <div class="player-meta">
            <div class="name">${esc(p.name)}${i===game.turn ? ' • الدور الآن' : ''}</div>
            <div class="sub">العقارات: ${countProps} • الدرع: ${p.shield} • بطاقات: ${p.cards.length}${p.skipTurn>0 ? ` • <span style="color:var(--danger)">محجوز (${p.skipTurn})</span>` : ''}</div>
          </div>
          <div class="pill">${money(p.cash)}</div>
        `;
        playerListEl.appendChild(row);
      });
    }

    function renderCards(){
      activeCardsEl.innerHTML='';
      const p = currentPlayer();
      p.cards.slice(-3).forEach(c=>{
        const el = document.createElement('div');
        el.className='card';
        el.innerHTML = `<div class='title'>${c.title}</div><div class='desc'>${c.text}</div>`;
        activeCardsEl.appendChild(el);
      });
      if(!p.cards.length){
        activeCardsEl.innerHTML = `<div class='card'><div class='title'>لا توجد بطاقات</div><div class='desc'>اسحب بطاقة من خانة الحدث أو استخدم الأحداث الخاصة.</div></div>`;
      }
    }

    function renderAll(){
      renderBoard();
      renderTokens();
      renderPlayers();
      renderCards();
      const p = currentPlayer();
      turnChipEl.textContent = `الدور: ${p.name}`;
      centerCashEl.textContent = money(p.cash);
      centerPowerEl.textContent = `${p.shield} درع • ${p.cards.length} بطاقة`;
      centerMarketEl.textContent = `${Math.round(game.market)}%`;
      phaseChipEl.textContent = `المرحلة: ${game.phase}`;
      document.getElementById('fastState').textContent = fastMode ? 'مفعّل' : 'عادي';
      document.getElementById('buyBtn').disabled = !game.canBuy;
      document.getElementById('upgradeBtn').disabled = game.currentSpace === null || spaces[game.currentSpace].type !== 'property';
      document.getElementById('rollBtn').disabled = !!game.winner || game.phase !== 'انتظار الرمي';
      document.getElementById('endBtn').disabled = !!game.winner || (game.phase !== 'بعد الحركة' && game.phase !== 'قرار شراء');
    }

    function movePlayer(player, steps){
      const old = player.pos;
      const next = player.pos + steps;
      if(next >= spaces.length){
        player.cash += spaces[0].reward;
        log(`مرَّ ${player.name} عبر البدء وحصل على ${money(spaces[0].reward)}.`);
      }
      player.pos = next % spaces.length;
      return {from: old, to: player.pos};
    }

    function passTurn(){
      if(game.winner) return;
      const alive = alivePlayers();
      if(alive.length <= 1){
        game.winner = alive[0]?.name || 'لا أحد';
        endGame();
        return;
      }
      let next = game.turn;
      for(let k=0;k<game.players.length;k++){
        next = (next + 1) % game.players.length;
        if(game.players[next].alive && game.players[next].skipTurn <= 0) break;
      }
      if(game.players[next].skipTurn > 0) game.players[next].skipTurn--;
      game.turn = next;
      game.canBuy = false;
      game.currentSpace = null;
      game.currentRoll = null;
      game.chain = 0;
      game.lastDouble = false;
      setPhase('انتظار الرمي');
      updateHint(`دور ${currentPlayer().name}.`);
      renderAll();
      applyMarket();
    }

    function resolveDebt(player, amount, creditorIndex = null){
      const source = creditorIndex !== null ? game.players[creditorIndex] : null;
      player.cash -= amount;
      if(source) source.cash += amount;
      log(`${player.name} دفع ${money(amount)}${source ? ` إلى ${source.name}` : ''}.`);
      if(player.cash >= 0) return;
      // auto liquidation
      const liquidatable = game.ownership
        .map((o, i) => ({o, i}))
        .filter(x => x.o === game.players.indexOf(player))
        .sort((a,b)=>game.upgrades[b.i]-game.upgrades[a.i]);
      while(player.cash < 0 && liquidatable.length){
        const item = liquidatable.shift();
        const refund = Math.floor((spaces[item.i].price * 0.6) + (game.upgrades[item.i] * 45));
        game.ownership[item.i] = null;
        game.upgrades[item.i] = 0;
        player.cash += refund;
        log(`${player.name} باع ${spaces[item.i].name} مقابل ${money(refund)}.`);
      }
      if(player.cash < 0){
        player.alive = false;
        game.ownership = game.ownership.map(o => o === game.players.indexOf(player) ? null : o);
        log(`<span style="color:var(--danger)">${esc(player.name)} أفلس وخرج من اللعبة.</span>`);
      }
    }

    function buyProperty(index){
      const p = currentPlayer();
      const s = spaces[index];
      const discounted = Math.round(s.price * (game.market / 100));
      const cost = game.selectedAuction?.cost ?? discounted;
      if(p.cash < cost){ log(`${p.name} لا يملك رصيدًا كافيًا.`); return; }
      p.cash -= cost;
      game.ownership[index] = game.turn;
      game.upgrades[index] = game.selectedAuction?.startingUpgrade ?? 0;
      log(`${p.name} اشترى ${s.name} مقابل ${money(cost)}${cost !== s.price ? ' (سعر سوقي)' : ''}.`);
      game.canBuy = false;
      game.selectedAuction = null;
      closeAuction();
      setPhase('بعد الحركة');
      updateHint('يمكنك إنهاء الدور أو ترقية إذا كنت على عقار مملوك لك.');
      renderAll();
      checkWin();
    }

    function upgradeCurrent(){
      const p = currentPlayer();
      const index = game.currentSpace;
      const s = spaces[index];
      if(s.type !== 'property') return;
      if(game.ownership[index] !== game.turn){ log('لا يمكنك الترقية لعقار لا تملكه.'); return; }
      if(game.upgrades[index] >= 3){ log('وصل العقار إلى الحد الأقصى للترقية.'); return; }
      const cost = Math.round(s.price * (0.42 + game.upgrades[index] * 0.25));
      if(p.cash < cost){ log('الرصيد غير كافٍ للترقية.'); return; }
      p.cash -= cost;
      game.upgrades[index]++;
      log(`${p.name} رقّى ${s.name} إلى المستوى ${game.upgrades[index]}.`);
      setPhase('بعد الحركة');
      renderAll();
    }

    function landOnSpace(){
      const p = currentPlayer();
      const index = p.pos;
      const s = spaces[index];
      game.currentSpace = index;
      game.canBuy = false;
      if(s.type === 'start'){
        log(`${p.name} وصل إلى البدء.`);
        setPhase('بعد الحركة');
      } else if(s.type === 'property'){
        const owner = game.ownership[index];
        if(owner === null){
          const cost = Math.round(s.price * (game.market / 100));
          game.canBuy = p.cash >= cost;
          setPhase('قرار شراء');
          updateHint(`العقار غير مملوك. السعر الحالي ${money(cost)}. يمكنك الشراء أو تركه للمزاد.`);
        } else if(owner === game.turn){
          log(`${p.name} وصل إلى عقاره الخاص.`);
          setPhase('بعد الحركة');
        } else {
          const rent = calcRent(index, owner);
          if(p.shield > 0){
            p.shield--;
            log(`${p.name} استخدم الدرع وتجنب إيجار ${money(rent)}.`);
          } else {
            resolveDebt(p, rent, owner);
          }
          setPhase('بعد الحركة');
        }
      } else if(s.type === 'tax'){
        let amount = s.amount;
        if(game.market < 90) amount = Math.round(amount * 0.9);
        if(game.market > 115) amount = Math.round(amount * 1.15);
        if(p.shield > 0){
          p.shield--;
          log(`${p.name} صدّ الضريبة بدرع.`);
        } else {
          resolveDebt(p, amount);
        }
        setPhase('بعد الحركة');
      } else if(s.type === 'event'){
        drawEventCard();
        setPhase('بعد الحركة');
      } else if(s.type === 'special'){
        handleSpecial(s.kind);
        setPhase('بعد الحركة');
      }
      if(game.marketBuffTurns > 0) game.marketBuffTurns--;
      if(game.lastDouble && game.phase === 'بعد الحركة' && !game.winner){
        game.lastDouble = false;
        setPhase('انتظار الرمي');
        updateHint(`${p.name} حصل على زوجي! ارمِ النرد مرة أخرى.`);
      }
      renderAll();
      checkWin();
      maybeAutoAdvance();
    }

    function calcRent(index, owner){
      const s = spaces[index];
      const level = game.upgrades[index];
      let rent = s.baseRent * (1 + level * 0.75);
      // group bonus: each additional same-group property owned by owner increases rent
      const groupCount = spaces.reduce((a,sp,i)=>a + (sp.group && sp.group===s.group && game.ownership[i]===owner ? 1 : 0), 0);
      if(groupCount >= 2) rent *= (1 + (groupCount-1) * 0.2);
      rent *= (game.market / 100);
      if(game.marketBuffTurns > 0 && owner === game.turn) rent *= 1.25;
      return Math.max(10, Math.round(rent));
    }

    function drawEventCard(){
      const c = rand(eventCards);
      const p = currentPlayer();
      p.cards.push(c);
      log(`بطاقة: <strong>${c.title}</strong> — ${c.text}`);
      applyEventEffect(c, p);
      renderCards();
    }

    function applyEventEffect(card, player){
      switch(card.effect){
        case 'buffMarket':
          game.marketBuffTurns = 2;
          player.cash += 50;
          log(`${player.name} حصل على دفعة سوقية: +50 وحماية مؤقتة للإيجارات.`);
          break;
        case 'hack': {
          const target = game.players.filter((x, idx)=>x.alive && idx !== game.turn && game.ownership.some(o=>o===idx));
          if(target.length){
            const victim = rand(target);
            const amount = Math.min(100, victim.cash);
            resolveDebt(victim, amount, game.turn);
            player.cash += amount;
          } else {
            player.cash += 80;
          }
          break;
        }
        case 'refi':
          if(player.cash >= 50) { player.cash -= 50; player.cash += 150; }
          else player.shield++;
          break;
        case 'jumpBuy': {
          const targetIndex = spaces.findIndex((s,i)=>s.type==='property' && game.ownership[i]===null);
          if(targetIndex >= 0){
            player.pos = targetIndex;
            const discounted = Math.round(spaces[targetIndex].price * 0.8);
            game.market = clamp(game.market, 70, 120);
            log(`${player.name} قفز إلى ${spaces[targetIndex].name}. السعر المخفض ${money(discounted)}.`);
            game.canBuy = player.cash >= discounted;
            game.selectedAuction = {cost: discounted, startingUpgrade: 1};
            game.currentSpace = targetIndex;
          }
          break;
        }
        case 'counter':
          player.cash += 60;
          break;
        case 'reset':
          player.pos = 0;
          player.cash += spaces[0].reward;
          game.market = clamp(game.market * 0.9, 70, 150);
          break;
      }
    }

    function handleSpecial(kind){
      const p = currentPlayer();
      switch(kind){
        case 'teleport': {
          const owned = spaces.map((s,i)=>({s,i})).filter(x=>x.s.type==='property' && game.ownership[x.i] !== null);
          if(owned.length){
            const pick = rand(owned);
            p.pos = pick.i;
            log(`${p.name} انتقل إلى ${pick.s.name}.`);
            landOnSpace();
          } else {
            p.pos = 0;
            log(`${p.name} عاد إلى البدء.`);
          }
          break;
        }
        case 'shield':
          p.shield++;
          log(`${p.name} حصل على درع.`);
          break;
        case 'market':
          game.market = clamp(game.market + 12, 70, 150);
          p.cash += 40;
          log(`${p.name} رفع السوق إلى ${Math.round(game.market)}% وحصل على 40.`);
          break;
        case 'safe':
          p.shield++;
          p.cash += 25;
          log(`${p.name} استراح في نقطة الحماية: +25 ودرع.`);
          break;
        case 'auction': {
          const available = spaces
            .map((s,i)=>({s,i}))
            .filter(x => x.s.type === 'property' && game.ownership[x.i] === null);
          if(available.length){
            const pick = rand(available);
            log(`${p.name} فتح سوقًا سوداء على ${pick.s.name}.`);
            openAuction(pick.i);
          } else {
            p.cash += 30;
            log(`${p.name} لم يجد أي عقار متاح للمزاد، فحصل على 30 تعويضًا.`);
          }
          break;
        }
      }
    }

    function openAuction(spaceIndex){
      const s = spaces[spaceIndex];
      const p = currentPlayer();
      auctionTitleEl.textContent = `مزاد: ${s.name}`;
      auctionDescEl.textContent = `هذا العقار يفتح نظام مزاد سريع. يمكن شراءه مباشرة أو منافسة سريعة بين اللاعبين.`;
      auctionListEl.innerHTML = '';
      const base = Math.round(s.price * (game.market/100));
      const offers = [0, 1, 2].map(n => base + n * 25 + Math.floor(Math.random()*15));
      offers.forEach((offer, idx)=>{
        const row = document.createElement('div');
        row.className='auction-item';
        const bidder = game.players[(game.turn + idx) % game.players.length];
        row.innerHTML = `<div><strong>${esc(bidder.name)}</strong><div class='small'>عرض افتراضي ${money(offer)}</div></div><span class='pill'>${offer}</span><button>اختيار</button>`;
        row.querySelector('button').onclick = () => {
          if(bidder.cash < offer){ log(`${bidder.name} لا يملك عرض المزاد.`); return; }
          bidder.cash -= offer;
          game.ownership[spaceIndex] = game.players.indexOf(bidder);
          game.upgrades[spaceIndex] = 0;
          log(`${bidder.name} فاز بالمزاد على ${s.name} مقابل ${money(offer)}.`);
          closeAuction();
          renderAll();
        };
        auctionListEl.appendChild(row);
      });
      const self = document.createElement('div');
      self.className='auction-item';
      self.innerHTML = `<div><strong>${esc(p.name)}</strong><div class='small'>شراء مباشر ${money(base)}</div></div><span class='pill'>${base}</span><button>شراء مباشر</button>`;
      self.querySelector('button').onclick = () => buyProperty(spaceIndex);
      auctionListEl.prepend(self);
      auctionModal.style.display = 'flex';
    }

    function closeAuction(){ auctionModal.style.display='none'; }

    function maybeAutoAdvance(){
      if(!fastMode) return;
      // auto-advance if no decision needed and no modal open
      if(auctionModal.style.display === 'flex') return;
      if(game.canBuy) return; // لا تتخطَّ قرار الشراء المعلّق
      if(game.phase === 'بعد الحركة'){
        const g0 = game;
        setTimeout(()=>{
          if(g0 !== game) return;
          if(game.phase === 'بعد الحركة' && !game.canBuy && !game.winner) passTurn();
        }, 350);
      }
    }

    function checkWin(){
      const alive = alivePlayers();
      if(alive.length === 1){
        game.winner = alive[0].name;
        endGame();
      }
    }

    function endGame(){
      setPhase('انتهت اللعبة');
      updateHint(`الفائز: ${game.winner}`);
      log(`<span class="winner">الفائز: ${game.winner}</span>`);
      document.getElementById('rollBtn').disabled = true;
      document.getElementById('buyBtn').disabled = true;
      document.getElementById('upgradeBtn').disabled = true;
      document.getElementById('endBtn').disabled = true;
      renderAll();
    }

    document.getElementById('playerCount').addEventListener('change', buildNameInputs);
    document.getElementById('newGameBtn').addEventListener('click', ()=>{ buildNameInputs(); createGame(); });
    document.getElementById('toggleHelpBtn').addEventListener('click', ()=> rulesModal.style.display = 'flex');
    document.getElementById('closeRules').addEventListener('click', ()=> rulesModal.style.display = 'none');
    document.getElementById('fastBtn').addEventListener('click', ()=>{ fastMode = !fastMode; renderAll(); });
    document.getElementById('rollBtn').addEventListener('click', ()=>{
      if(game.winner) return;
      const p = currentPlayer();
      if(p.skipTurn > 0){
        p.skipTurn--; log(`${p.name} محجوز ويتخطى دوره (${p.skipTurn} متبقٍ).`); passTurn(); return;
      }
      setPhase('الرمي');
      const d1 = rollD6(), d2 = rollD6();
      const roll = d1 + d2;
      game.currentRoll = roll;
      game.lastDouble = (d1 === d2);
      if(game.lastDouble){
        game.chain++;
        if(game.chain >= 3){
          game.chain = 0;
          game.lastDouble = false;
          p.skipTurn = (p.skipTurn || 0) + 1;
          log(`${p.name} رمى زوجيًا (${d1}-${d1}) للمرة الثالثة على التوالي وذهب للحجز! سيخسر دوره القادم.`);
          game.currentSpace = null;
          setPhase('بعد الحركة');
          renderAll();
          checkWin();
          maybeAutoAdvance();
          return;
        }
      } else {
        game.chain = 0;
      }
      const old = p.pos;
      const cross = old + roll >= spaces.length;
      movePlayer(p, roll);
      log(`${p.name} رمى ${d1}+${d2}=${roll}${game.lastDouble ? ' (زوجي! دور إضافي بعد التسوية)' : ''} وتحرك من ${old} إلى ${p.pos}${cross ? ' ومر بالبدء' : ''}.`);
      setPhase('تسوية الخانة');
      renderAll();
      const gameAtRoll = game;
      setTimeout(()=>{ if(gameAtRoll === game) landOnSpace(); }, fastMode ? 180 : 500);
    });
    document.getElementById('buyBtn').addEventListener('click', ()=>{
      if(game.currentSpace === null) return;
      const s = spaces[game.currentSpace];
      if(s.type !== 'property') return;
      if(game.ownership[game.currentSpace] !== null){ log('العقار مملوك بالفعل.'); return; }
      buyProperty(game.currentSpace);
    });
    document.getElementById('upgradeBtn').addEventListener('click', upgradeCurrent);
    document.getElementById('endBtn').addEventListener('click', ()=>{
      if(game.phase === 'قرار شراء'){
        log(`${currentPlayer().name} قرر عدم شراء ${spaces[game.currentSpace].name}.`);
        game.canBuy = false;
      }
      passTurn();
    });
    document.getElementById('closeAuction').addEventListener('click', closeAuction);
    document.getElementById('skipAuction').addEventListener('click', ()=>{ closeAuction(); passTurn(); });
    rulesModal.addEventListener('click', e=>{ if(e.target === rulesModal) rulesModal.style.display = 'none'; });
    auctionModal.addEventListener('click', e=>{ if(e.target === auctionModal) auctionModal.style.display = 'none'; });

    function init(){
      buildNameInputs();
      createGame();
      setTimeout(()=>{
        log('كل لاعب يبدأ بأموال متساوية. امتص السوق، لا تدعه يمتصك.');
      }, 100);
    }

    init();
  
