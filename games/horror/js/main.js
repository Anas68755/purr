    import * as THREE from 'three';
    import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

    // ════════════════════════════════════════════════════════════════════
    //  SCENE / RENDERER / CAMERA
    // ════════════════════════════════════════════════════════════════════
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0303, 0.035); // Denser, darker fog
    scene.background = new THREE.Color(0x050101);

    const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.rotation.order = 'YXZ';
    scene.add(camera); // Add camera to scene explicitly to attach flashlight

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const controls = new PointerLockControls(camera, document.body);

    function resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', resize);
    resize();

    // Mobile detection for joystick / touch controls
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches);
    if (isMobile) {
      document.getElementById('joystick-container').classList.remove('hidden');
    }

    // ════════════════════════════════════════════════════════════════════
    //  AUDIO
    // ════════════════════════════════════════════════════════════════════
    let audioCtx = null, masterGain, whisperGain, heartbeatGain;

    const CATS = ['footsteps', 'heartbeat', 'whispers', 'scares', 'ambient'];
    let bus = {};
    function applyAudioSettings() {
      if (!audioCtx) return;
      masterGain.gain.value = 0.55 * S.vol.master / 100;
      for (const c of CATS) bus[c].gain.value = S.vol[c] / 100;
    }

    function initAudio() {
      if (audioCtx) { audioCtx.resume(); return; }
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      bus = {};
      for (const c of CATS) { bus[c] = audioCtx.createGain(); bus[c].connect(masterGain); }
      applyAudioSettings();

      // Ambient whisper bed: its level is driven by sanity in the game loop
      whisperGain = audioCtx.createGain();
      whisperGain.gain.value = 0;
      whisperGain.connect(bus.whispers);

      heartbeatGain = audioCtx.createGain();
      heartbeatGain.gain.value = 0;
      heartbeatGain.connect(bus.heartbeat);

      loadSfx();
    }

    // Sampled sound effects. They are embedded as base64 in the sfx-data block
    // just before this script, so the game stays a single self-contained file.
    const sfx = {};
    let sfxLoading = false;
    function b64ToArrayBuffer(b64) {
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8.buffer;
    }
    async function loadSfx() {
      if (sfxLoading) return;
      sfxLoading = true;
      let data;
      try { data = window.SFX_DATA || JSON.parse(document.getElementById('sfx-data').textContent); } catch (e) { return; }
      await Promise.all(Object.entries(data).map(async ([name, b64]) => {
        try { sfx[name] = await audioCtx.decodeAudioData(b64ToArrayBuffer(b64)); } catch (e) { /* skip a sound that fails to decode */ }
      }));
      if (sfx.bed) { // seamless whisper loop, faded in by sanity through whisperGain
        const src = audioCtx.createBufferSource();
        src.buffer = sfx.bed; src.loop = true;
        src.connect(whisperGain); src.start();
      }
    }

    function playSfx(name, vol = 1, jitter = 0, cat = 'ambient', pan = 0) {
      const buf = sfx[name];
      if (!audioCtx || !buf) return;
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      if (jitter) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
      const g = audioCtx.createGain();
      g.gain.value = vol;
      let out = src.connect(g);
      if (pan && audioCtx.createStereoPanner) { const p = audioCtx.createStereoPanner(); p.pan.value = pan; out = out.connect(p); }
      out.connect(bus[cat] || masterGain);
      src.start();
    }
    const lastVariant = {};
    function pickVariant(prefix, count) { // random variant, never the same twice in a row
      let i;
      do { i = Math.floor(Math.random() * count); } while (count > 1 && i === lastVariant[prefix]);
      lastVariant[prefix] = i;
      return prefix + i;
    }

    function playFootstep()     { playSfx(pickVariant('step', 4), 0.55, 0.07, 'footsteps'); }
    function playStinger()      { playSfx('stinger', 1, 0, 'scares'); }
    function playHeartbeat()    { playSfx('heart', 0.9, 0, 'heartbeat'); }
    function playWhisper()      { playSfx(pickVariant('whisper', 3), 0.6, 0.04, 'whispers'); }
    function playMetalClank()   { playSfx(pickVariant('clank', 2), 0.7, 0.05); }
    function playEerieCry()     { playSfx('cry', 0.6); }
    function playLowRumble()    { playSfx('rumble', 0.8); }
    function playDistantSound() { playSfx(pickVariant('distant', 3), 0.6, 0.05); }

    // ════════════════════════════════════════════════════════════════════
    //  LIGHTING (Creepier & Darker)
    // ════════════════════════════════════════════════════════════════════
    scene.add(new THREE.AmbientLight(0x110303, 0.15)); // Very low ambient
    scene.add(new THREE.HemisphereLight(0x220808, 0x000000, 0.1)); // Dark red hemi

    const horrorLight = new THREE.PointLight(0xff2222, 4, 80);
    horrorLight.position.set(0, 8, 20);
    scene.add(horrorLight);

    // Flashlight (Spotlight attached to camera)
    let flashlightOn = true; const FL = 24;
    const flashlight = new THREE.SpotLight(0xff9560, FL, 0, 0.34, 0.85, 1.15);
    flashlight.position.set(0.25, -0.25, 0); // Offset slightly like holding it
    flashlight.target.position.set(0, 0, -12);
    camera.add(flashlight);
    camera.add(flashlight.target);

    // ════════════════════════════════════════════════════════════════════
    //  TEXTURES & MATERIALS
    // ════════════════════════════════════════════════════════════════════
    const SEG_LEN = 40;
    const SEG_COUNT = 8;
    const TOTAL_LEN = SEG_LEN * SEG_COUNT;

    // Use ONLY the photo texture provided
    const wallTextureUrl = 'https://z-cdn-media.chatglm.cn/files/30baffde-92e5-41c7-9343-248816d76b95.jpg?auth_key=1884237634-462c903c33f34124a9aa24764c1d88da-0-d6f75ac04aa1a8540249744c36d18a1b';
    const textureLoader = new THREE.TextureLoader();
    const wallTex = textureLoader.load(wallTextureUrl, undefined, undefined, () => { wallMat.map = null; wallMat.color.set(0x3a1a1a); wallMat.needsUpdate = true; });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(1, 1); // UVs will be scaled manually per-mesh to prevent stretching

    function makeFloorTexture() {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1c0808';
      ctx.fillRect(0, 0, size, size);
      const step = size / 4;
      ctx.strokeStyle = '#0a0303';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
      }
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        if (Math.random() < 0.4) {
          ctx.fillStyle = `rgba(${30 + Math.random()*30}, ${10 + Math.random()*15}, ${10 + Math.random()*10}, 0.5)`;
          ctx.fillRect(i * step, j * step, step, step);
        }
      }
      for (let i = 0; i < 15; i++) {
        const x = Math.random() * size, y = Math.random() * size;
        const r = 10 + Math.random() * 30;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(5, 0, 0, ${0.5 + Math.random() * 0.3})`);
        grad.addColorStop(1, 'rgba(5, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    function makeCeilingTexture() {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#150505';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#080202';
      ctx.lineWidth = 2;
      const step = size / 5;
      for (let i = 0; i <= 5; i++) {
        ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * size, y = Math.random() * size;
        const r = 15 + Math.random() * 40;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(40, 20, 10, ${0.4 + Math.random() * 0.3})`);
        grad.addColorStop(0.7, `rgba(20, 10, 5, 0.2)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    function makeBloodTexture() {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(80, 0, 0, 0.85)';
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * size, y = Math.random() * size;
        const r = 5 + Math.random() * 15;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 4; i++) {
        const x = Math.random() * size;
        ctx.fillRect(x, 0, 2 + Math.random() * 3, 20 + Math.random() * 40);
      }
      for (let i = 0; i < 15; i++) {
        const x = Math.random() * size, y = Math.random() * size;
        ctx.beginPath(); ctx.arc(x, y, 1 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
      }
      return new THREE.CanvasTexture(canvas);
    }

    function makePosterTexture() {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = ['#4a3030', '#30304a', '#3a4a30', '#4a3a30'][Math.floor(Math.random()*4)];
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, size-8, size-8);
      ctx.fillStyle = '#aa8888';
      for (let i = 0; i < 5; i++) {
        const y = 20 + i * 18;
        const w = 30 + Math.random() * 80;
        ctx.fillRect(15, y, w, 6);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      return new THREE.CanvasTexture(canvas);
    }

    const floorTex = makeFloorTexture();
    floorTex.repeat.set(4, SEG_LEN / 6);
    const ceilingTex = makeCeilingTexture();
    ceilingTex.repeat.set(4, SEG_LEN / 6);

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x884444, roughness: 0.95, side: THREE.DoubleSide });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0x553030, roughness: 1, side: THREE.DoubleSide });
    const ceilingMat = new THREE.MeshStandardMaterial({ map: ceilingTex, color: 0x442222, roughness: 1, side: THREE.DoubleSide });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.75, metalness: 0.05 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.6, metalness: 0.1 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xccaa55, roughness: 0.3, metalness: 0.8 });
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7 });
    const bloodMat = new THREE.MeshStandardMaterial({ map: makeBloodTexture(), transparent: true, roughness: 0.6, emissive: 0x330000, emissiveIntensity: 0.3 });
    const posterMat = new THREE.MeshStandardMaterial({ map: makePosterTexture(), transparent: true, roughness: 0.9, side: THREE.DoubleSide });
    const signMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.8 });

    // ════════════════════════════════════════════════════════════════════
    //  CORRIDOR SEGMENTS
    // ════════════════════════════════════════════════════════════════════
    const segments = [];
    const ceilingLights = [];

    function createDoor(wallX, zPos, insetDir, variant) {
      const g = new THREE.Group();
      const doorW = 3.2, doorH = 7.2, doorD = 0.15;
      const frameW = 3.7, frameH = 7.7, frameD = 0.28;

      const frame = new THREE.Mesh(new THREE.BoxGeometry(frameD, frameH, frameW), frameMat);
      frame.position.set(wallX + insetDir * frameD / 2, frameH / 2, zPos);
      g.add(frame);

      const panel = new THREE.Mesh(new THREE.BoxGeometry(doorD, doorH, doorW), doorMat);
      panel.position.set(wallX + insetDir * (frameD / 2 + 0.02), doorH / 2, zPos);
      if (variant === 'ajar') panel.rotation.y = insetDir * 0.5;
      doors.push({ panel, dir: insetDir, base: panel.rotation.y, target: panel.rotation.y });
      g.add(panel);

      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), handleMat);
      handle.position.set(wallX + insetDir * (frameD / 2 + 0.15), doorH * 0.45, zPos + doorW * 0.32);
      g.add(handle);

      if (variant === 'bloody') {
        const stain = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4), bloodMat);
        stain.position.set(wallX + insetDir * (frameD / 2 + 0.05), 3, zPos);
        stain.rotation.y = insetDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(stain);
      }

      return g;
    }

    function createCeilingFixture(zPos) {
      const group = new THREE.Group();
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.2, 1),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.4 })
      );
      housing.position.set(0, 15.8, zPos);
      group.add(housing);

      const bulbMat = new THREE.MeshStandardMaterial({ color: 0x441111, emissive: 0xff1100, emissiveIntensity: 0.6 });
      const bulb = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), bulbMat);
      bulb.rotation.x = Math.PI / 2;
      bulb.position.set(0, 15.68, zPos);
      group.add(bulb);

      // Dim, creepy red light
      const light = new THREE.PointLight(0xff3322, 0.8, 18);
      light.position.set(0, 14.5, zPos);
      group.add(light);

      const roll = Math.random();
      const kind = roll < 0.4 ? 'flicker' : roll < 0.75 ? 'blink' : 'stutter';
      return { group, light, bulbMat, phase: Math.random() * 10, kind, isOn: true, blinkTimer: Math.random() * 2, z: zPos, dead: 0 };
    }

    const GRAF = ['HELP ME', 'BEHIND YOU', 'TURN BACK', 'IT SEES YOU', "DON'T STOP", 'NO EXIT', 'RUN', 'HE IS HERE', 'LET ME OUT'];
    const grafMats = {};
    function grafMat(txt) {
      if (grafMats[txt]) return grafMats[txt];
      const c = document.createElement('canvas'); c.width = 512; c.height = 192;
      const x = c.getContext('2d');
      x.font = 'bold 82px "Courier New", monospace'; x.textAlign = 'center';
      x.fillStyle = '#8c0606'; x.shadowColor = '#300'; x.shadowBlur = 6; x.fillText(txt, 256, 95);
      const w = Math.min(480, x.measureText(txt).width);
      for (let i = 0; i < 14; i++) { // dripping blood
        const dx = 256 - w / 2 + Math.random() * w, len = 15 + Math.random() * 80;
        x.fillRect(dx, 85, 3 + Math.random() * 3, len);
        x.beginPath(); x.arc(dx + 2.5, 85 + len, 4.5, 0, 7); x.fill();
      }
      return grafMats[txt] = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), transparent: true, alphaTest: 0.3, roughness: 0.5, emissive: 0x200000, side: THREE.DoubleSide });
    }
    const swingers = [], doors = [], colliders = [];
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x3a2515, roughness: 0.9 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 1 });
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const hbulbMat = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a40, emissiveIntensity: 2 });
    function makeChair() {
      const g = new THREE.Group(), add = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), chairMat); m.position.set(x, y, z); g.add(m); };
      add(0.9, 0.12, 0.9, 0, 0.9, 0); add(0.9, 1, 0.1, 0, 1.45, -0.4);
      for (const lx of [-0.4, 0.4]) for (const lz of [-0.4, 0.4]) add(0.1, 0.9, 0.1, lx, 0.45, lz);
      g.scale.setScalar(1.5); return g;
    }
    const handMat = (() => { // bloody handprint decal
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#700606';
      x.beginPath(); x.ellipse(64, 88, 26, 30, 0, 0, 7); x.fill();
      [[-22, -0.25, 36], [-8, -0.08, 44], [7, 0.06, 46], [21, 0.25, 38], [-40, -1.1, 28]].forEach(([dx, r, l], i) => {
        x.save(); x.translate(i === 4 ? 40 : 64 + dx, i === 4 ? 98 : 64); x.rotate(r); x.fillRect(-5, -l, 10, l); x.beginPath(); x.arc(0, -l, 5, 0, 7); x.fill(); x.restore();
      });
      x.fillRect(58, 110, 4, 18); x.beginPath(); x.arc(60, 128, 3, 0, 7); x.fill();
      return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), transparent: true, alphaTest: 0.3, roughness: 0.6, emissive: 0x180000, side: THREE.DoubleSide });
    })();
    const zoneTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,190,100,.6)'); g.addColorStop(0.75, 'rgba(255,150,60,.25)'); g.addColorStop(1, 'rgba(255,140,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    function makeZone(zc) { // amber safe light: heals while you stand in it, burns out
      const g = new THREE.Group(), x = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true, depthWrite: false, opacity: 0.8 }));
      disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.05, zc); g.add(disc);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8), cordMat); base.position.set(x, 0.3, zc); g.add(base);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffbb66 })); bulb.position.set(x, 0.9, zc); g.add(bulb);
      const light = new THREE.PointLight(0xffa850, 2.4, 16); light.position.set(x, 2, zc); g.add(light);
      return { g, x, z: zc, fuel: 14, disc, bulb, light };
    }
    function createProps(zc) {
      const g = new THREE.Group(), zr = () => zc + (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 13), sd = () => Math.random() < 0.5 ? -1 : 1;
      for (let i = Math.random() * 2 | 0; i >= 0; i--) { // scattered chairs, some knocked over
        const c = makeChair(); c.position.set(sd() * (6 + Math.random() * 2.6), 0, zr()); c.rotation.y = Math.random() * 6.28;
        if (Math.random() < 0.5) { c.rotation.z = (Math.random() < 0.5 ? -1 : 1) * 1.45; c.position.y = 0.7; }
        g.add(c); colliders.push({ h: g, x: c.position.x, z: c.position.z, r: 0.95, o: c, chair: true, fallen: c.rotation.z !== 0 });
      }
      for (let i = Math.random() * 3 | 0; i > 0; i--) { // stacked boxes
        const x = sd() * (6.5 + Math.random() * 2.5), z = zr(); colliders.push({ h: g, x, z, r: 1.25 });
        for (let k = 0, n = 1 + (Math.random() * 3 | 0); k < n; k++) {
          const s = 1.4 + Math.random() * 0.8, b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), boxMat);
          b.position.set(x + (Math.random() - 0.5) * 0.4, s / 2 + k * 1.5, z); b.rotation.y = Math.random() * 3; g.add(b);
        }
      }
      for (let i = 0, n = 1 + (Math.random() * 2 | 0); i < n; i++) { // hanging bulbs
        const p = new THREE.Group(); p.position.set((Math.random() - 0.5) * 12, 16, zr());
        const cg = new THREE.CylinderGeometry(0.02, 0.02, 3.6, 4); cg.translate(0, -1.8, 0); p.add(new THREE.Mesh(cg, cordMat));
        const bu = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), hbulbMat); bu.position.y = -3.7; p.add(bu);
        swingers.push({ p, ph: Math.random() * 6 }); g.add(p);
      }
      return g;
    }

    function createWallDetails(wallX, zCenter, facing) {
      const g = new THREE.Group();
      if (Math.random() < 0.6) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, SEG_LEN * 0.9, 8), pipeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(wallX + facing * 0.15, 12 + Math.random() * 2, zCenter);
        g.add(pipe);
      }
      if (Math.random() < 0.35) {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 1.4), signMat);
        sign.position.set(wallX + facing * 0.2, 11, zCenter + (Math.random() - 0.5) * SEG_LEN * 0.5);
        const signLight = new THREE.PointLight(0xff0000, 0.5, 8);
        signLight.position.set(wallX + facing * 0.5, 11, sign.position.z);
        g.add(sign); g.add(signLight);
      }
      if (Math.random() < 0.45) {
        const stain = new THREE.Mesh(new THREE.PlaneGeometry(2 + Math.random() * 3, 3 + Math.random() * 4), bloodMat);
        stain.position.set(wallX + facing * 0.1, 3 + Math.random() * 4, zCenter + (Math.random() - 0.5) * SEG_LEN * 0.7);
        stain.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(stain);
      }
      if (Math.random() < 0.3) {
        const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2), posterMat);
        poster.position.set(wallX + facing * 0.08, 5 + Math.random() * 2, zCenter + (Math.random() - 0.5) * SEG_LEN * 0.6);
        poster.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(poster);
      }
      if (Math.random() < 0.5) {
        const gr = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), grafMat(GRAF[Math.floor(Math.random() * GRAF.length)]));
        gr.position.set(wallX + facing * 0.12, 4.5 + Math.random() * 2, zCenter + (Math.random() - 0.5) * SEG_LEN * 0.5);
        gr.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(gr);
      }
      for (let i = Math.random() * 4 | 0; i > 0; i--) {
        const h = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), handMat);
        h.position.set(wallX + facing * 0.1, 2.5 + Math.random() * 4, zCenter + (Math.random() - 0.5) * SEG_LEN * 0.7);
        h.rotation.set(0, facing > 0 ? Math.PI / 2 : -Math.PI / 2, (Math.random() - 0.5) * 1.2);
        g.add(h);
      }
      return g;
    }

    // Helper to create wall pieces with properly scaled UVs so the texture doesn't stretch
    function createWallPiece(length, x, z, rotY) {
      const geo = new THREE.PlaneGeometry(length, 16);
      // Modify UVs to repeat texture based on length
      const uvX = length / 10;
      const uvY = 16 / 10;
      const uvs = geo.attributes.uv.array;
      uvs[0] = 0; uvs[1] = uvY;
      uvs[2] = uvX; uvs[3] = uvY;
      uvs[4] = 0; uvs[5] = 0;
      uvs[6] = uvX; uvs[7] = 0;
      geo.attributes.uv.needsUpdate = true;

      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, 8, z);
      mesh.rotation.y = rotY;
      return mesh;
    }

    function createSegment(z) {
      const group = new THREE.Group();
      const zCenter = z - SEG_LEN / 2;
      
      // Split walls to leave a gap for doors (so texture doesn't overlay them)
      const wallPieceLen = (SEG_LEN / 2) - 2.0; // 18 units long
      const offset = (SEG_LEN / 2) - (wallPieceLen / 2); // 11 units from center

      // Left Wall (2 pieces)
      group.add(createWallPiece(wallPieceLen, -10, zCenter - offset, Math.PI / 2));
      group.add(createWallPiece(wallPieceLen, -10, zCenter + offset, Math.PI / 2));

      // Right Wall (2 pieces)
      group.add(createWallPiece(wallPieceLen, 10, zCenter - offset, -Math.PI / 2));
      group.add(createWallPiece(wallPieceLen, 10, zCenter + offset, -Math.PI / 2));

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, SEG_LEN), floorMat);
      floor.rotation.x = Math.PI / 2;
      floor.position.set(0, 0, zCenter);
      group.add(floor);

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(22, SEG_LEN), ceilingMat);
      ceiling.rotation.x = -Math.PI / 2;
      ceiling.position.set(0, 16, zCenter);
      group.add(ceiling);

      const variants = ['closed', 'ajar', 'bloody', 'closed'];
      const lv = variants[Math.floor(Math.random() * variants.length)];
      const rv = variants[Math.floor(Math.random() * variants.length)];
      group.add(createDoor(-10, zCenter, 1, lv));
      group.add(createDoor(10, zCenter, -1, rv));

      group.add(createWallDetails(-10, zCenter, 1));
      group.add(createWallDetails(10, zCenter, -1));

      const fixture = createCeilingFixture(zCenter);
      group.add(fixture.group);
      ceilingLights.push(fixture);

      group.add(createProps(zCenter));
      const zone = Math.random() < 0.28 ? makeZone(zCenter) : null; if (zone) group.add(zone.g);
      scene.add(group);
      return { group, z, zone };
    }

    for (let i = 0; i < SEG_COUNT; i++) segments.push(createSegment(-i * SEG_LEN));

    camera.position.set(0, 1.8, 10);

    // ════════════════════════════════════════════════════════════════════
    //  MONSTER
    // ════════════════════════════════════════════════════════════════════
    const monsterGroup = new THREE.Group(), rig = new THREE.Group();
    monsterGroup.add(rig);
    const monsterMat = new THREE.MeshStandardMaterial({ color: 0x4A0404, roughness: 0.9, emissive: 0x4A0404, emissiveIntensity: 0.55 });
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8d0b0, roughness: 0.5, emissive: 0x332a10, emissiveIntensity: 0.5 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4a30, fog: false });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 6, 8), monsterMat);
    body.position.y = 3; rig.add(body);
    const headG = new THREE.Group(); headG.position.y = 6.9; rig.add(headG);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), monsterMat);
    skull.scale.set(0.85, 1.9, 0.95); headG.add(skull);
    for (const sx of [-1, 1]) { // hollow sockets with a tiny burning core
      const sock = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), voidMat);
      sock.scale.set(1, 1.5, 0.6); sock.position.set(sx * 0.2, 0.55, 0.5); headG.add(sock);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), glowMat);
      core.position.set(sx * 0.2, 0.55, 0.57); headG.add(core);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), haloMat); halo.position.copy(core.position); headG.add(halo);
    }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), voidMat);
    mouth.scale.set(0.3, 0.55, 0.12); mouth.position.set(0, -0.45, 0.44); headG.add(mouth);
    for (let i = 0; i < 16; i++) { // ring of teeth around the gaping mouth
      const a = i / 16 * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 4), toothMat);
      tooth.position.set(Math.cos(a) * 0.29, -0.45 + Math.sin(a) * 0.56, 0.5);
      tooth.rotation.z = a + Math.PI / 2; headG.add(tooth);
    }
    const arms = []; // 4 long, double-jointed arms
    [[5.4, 0.3], [4.3, 0.34]].forEach(([y, x]) => [-1, 1].forEach(side => {
      const up = new THREE.Group(); up.position.set(side * x, y, 0); rig.add(up);
      const ug = new THREE.CylinderGeometry(0.07, 0.11, 2.6, 6); ug.translate(0, -1.3, 0); up.add(new THREE.Mesh(ug, monsterMat));
      const lo = new THREE.Group(); lo.position.y = -2.6; up.add(lo);
      const lg = new THREE.CylinderGeometry(0.03, 0.07, 2.8, 6); lg.translate(0, -1.4, 0); lo.add(new THREE.Mesh(lg, monsterMat));
      for (let f = -1; f <= 1; f++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.7, 4), monsterMat);
        c.position.set(f * 0.07, -3.1, 0); c.rotation.z = Math.PI + f * 0.3; lo.add(c);
      }
      arms.push({ up, lo, side, tx: 0, tz: side * 0.3, tl: 0 });
    }));
    const headT = { x: 0, y: 0, z: 0 };
    function animateMonster(lunging) { // jerky stop-motion twitching
      const p = lunging ? 0.5 : 0.1;
      for (const a of arms) {
        if (Math.random() < p) { a.tx = (Math.random() - 0.5) * 1.6 - (lunging ? 1.5 : 0); a.tz = a.side * (0.15 + Math.random() * (lunging ? 2 : 1.1)); a.tl = (Math.random() - 0.2) * 1.6; }
        a.up.rotation.x += (a.tx - a.up.rotation.x) * 0.55;
        a.up.rotation.z += (a.tz - a.up.rotation.z) * 0.55;
        a.lo.rotation.x += (a.tl - a.lo.rotation.x) * 0.55;
      }
      if (Math.random() < 0.07) { headT.z = (Math.random() - 0.5) * 0.9; headT.x = (Math.random() - 0.3) * 0.5; headT.y = (Math.random() - 0.5) * 0.6; }
      headG.rotation.set(headT.x, headT.y, headT.z);
      if (Math.random() < 0.2) mouth.scale.y = 0.45 + Math.random() * 0.3;
      if (Math.random() < 0.15) { rig.position.x = (Math.random() - 0.5) * 0.14; rig.rotation.z = (Math.random() - 0.5) * 0.07; }
    }
    const monsterLight = new THREE.PointLight(0xff0000, 0, 10);
    monsterLight.position.set(0, 6.5, 0.5);
    monsterGroup.add(monsterLight);

    monsterGroup.visible = false;
    scene.add(monsterGroup);

    const monsterState = {
      active: false,
      speed: 2.2,
      watchTime: 0,
      respawnTimer: 6,
      attacking: false,
      attackId: 0
    };

    // ════════════════════════════════════════════════════════════════════
    //  DUST PARTICLES
    // ════════════════════════════════════════════════════════════════════
    const DUST_COUNT = 400;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(DUST_COUNT * 3);
    const dustVel = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i*3]   = (Math.random() - 0.5) * 20;
      dustPos[i*3+1] = Math.random() * 16;
      dustPos[i*3+2] = (Math.random() - 0.5) * 80;
      dustVel[i*3]   = (Math.random() - 0.5) * 0.2;
      dustVel[i*3+1] = -0.05 - Math.random() * 0.1;
      dustVel[i*3+2] = (Math.random() - 0.5) * 0.2;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xaa8866, size: 0.09, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // ════════════════════════════════════════════════════════════════════
    //  CONTROLS — KEYBOARD
    // ════════════════════════════════════════════════════════════════════
    const keys = { forward: false, back: false, left: false, right: false };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.back = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprintHeld = true;
      if (e.code === 'KeyP' && started && !dead && !settingsOpen) { if (paused) resumeGame(); else if (controls.isLocked) controls.unlock(); else openPause(); }
      if (e.code === 'KeyF' && !e.repeat) {
        flashlightOn = !flashlightOn;
        flashlight.intensity = flashlightOn ? FL : 0;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprintHeld = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.back = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    });

    // ════════════════════════════════════════════════════════════════════
    //  CONTROLS — JOYSTICK (mobile)
    // ════════════════════════════════════════════════════════════════════
    function releaseKeys() { keys.forward = keys.back = keys.left = keys.right = false; sprintHeld = false; }
    window.addEventListener('blur', releaseKeys);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseKeys(); });
    controls.addEventListener('unlock', releaseKeys);

    const knob = document.getElementById('joystick-knob');
    const joystickEl = document.getElementById('joystick-container');
    const moveVec = { x: 0, z: 0 };
    let joystickTouchId = null;

    joystickEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joystickTouchId = t.identifier;
    }, { passive: false });

    joystickEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== joystickTouchId) continue;
        const rect = joystickEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        const maxR = rect.width / 2 - 10;
        const dist = Math.min(maxR, Math.sqrt(dx*dx + dy*dy));
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * dist;
        dy = Math.sin(angle) * dist;
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        moveVec.x = dx / maxR;
        moveVec.z = dy / maxR;
      }
    }, { passive: false });

    function resetJoystick() {
      joystickTouchId = null;
      moveVec.x = 0; moveVec.z = 0; sprintTouch = false;
      knob.style.transform = 'translate(-50%, -50%)';
    }
    joystickEl.addEventListener('touchend', resetJoystick);
    joystickEl.addEventListener('touchcancel', resetJoystick);

    // ════════════════════════════════════════════════════════════════════
    //  CONTROLS — TOUCH LOOK (mobile)
    // ════════════════════════════════════════════════════════════════════
    let lookTouchId = null;
    let lastLookX = 0, lastLookY = 0;
    let pitch = 0;

    window.addEventListener('touchstart', (e) => {
      if (!started) return;
      const jRect = joystickEl.getBoundingClientRect();
      for (const t of e.changedTouches) {
        const inJoy = t.clientX >= jRect.left && t.clientX <= jRect.right &&
                      t.clientY >= jRect.top && t.clientY <= jRect.bottom;
        if (!inJoy && lookTouchId === null) {
          lookTouchId = t.identifier;
          { const n = performance.now(); if (n - lastTap < 320) sprintTouch = true; lastTap = n; }
          lastLookX = t.clientX;
          lastLookY = t.clientY;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (controls.isLocked) return;
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) {
          const dx = t.clientX - lastLookX;
          const dy = t.clientY - lastLookY;
          camera.rotation.y -= dx * 0.004 * (S.sens / 100);
          pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.004));
          camera.rotation.x = pitch;
          lastLookX = t.clientX;
          lastLookY = t.clientY;
        }
      }
    }, { passive: true });

    const endLookTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    };
    window.addEventListener('touchend', endLookTouch);
    window.addEventListener('touchcancel', endLookTouch); // a system gesture used to leave look controls dead

    // ════════════════════════════════════════════════════════════════════
    //  START / RESTART / DEATH
    // ════════════════════════════════════════════════════════════════════
    const startOverlay = document.getElementById('start-overlay');
    const deathOverlay = document.getElementById('death-overlay');
    const hud = document.getElementById('hud');
    const vignette = document.getElementById('vignette');
    const bloodFlash = document.getElementById('blood-flash');
    const sanityBar = document.getElementById('sanity-bar');
    const distanceEl = document.getElementById('distance');
    const timeEl = document.getElementById('time');
    const deathStats = document.getElementById('death-stats');

    let started = false;
    let dead = false;
    let sanity = 100;
    let distance = 0;
    let survivedTime = 0;
    let maxDistance = 0;

    function showStartOverlay(text) {
      startOverlay.querySelector('.enter').textContent = text;
      startOverlay.classList.remove('hidden');
    }

    function startGame() {
      if (dead) resetGame();
      initAudio();
      startOverlay.classList.add('hidden');
      deathOverlay.classList.add('hidden');
      hud.classList.remove('hidden');
      started = true;
      dead = false;
      paused = false;
      if (!isMobile) {
        controls.lock();
      }
    }

    startOverlay.addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);

    controls.addEventListener('lock', () => {
      paused = false;
      startOverlay.classList.add('hidden');
      deathOverlay.classList.add('hidden');
      pauseEl.classList.add('hidden');
    });

    controls.addEventListener('unlock', () => {
      if (started && !dead) openPause();
    });

    function resetGame() {
      twistReset();
      noise = 0; inSafe = false; stamina = 100; exhausted = false; scareZoom = 0; fovBoost = 0; tearT = 0; sprinting = false;
      camera.fov = baseFov; camera.updateProjectionMatrix();
      sanity = 100;
      distance = 0;
      survivedTime = 0;
      maxDistance = 0;
      dead = false;
      monsterState.active = false;
      monsterState.attacking = false;
      monsterState.watchTime = 0;
      monsterState.respawnTimer = 6;
      monsterState.attackId++; 
      monsterGroup.visible = false;
      monsterGroup.position.set(0, 0, 50);
      monsterGroup.scale.setScalar(1);
      camera.position.set(0, 1.8, 10);
      camera.rotation.set(0, 0, 0);
      pitch = 0;
      for (let i = 0; i < segments.length; i++) {
        segments[i].group.position.set(0, 0, 0);
        segments[i].z = -i * SEG_LEN; if (segments[i].zone) segments[i].zone.fuel = 14;
      }
    }

    // ════════════════════════════════════════════════════════════════════
    //  MONSTER LOGIC
    // ════════════════════════════════════════════════════════════════════
    const _camForward = new THREE.Vector3();
    const _toMonster = new THREE.Vector3();

    function isMonsterInView() {
      if (!monsterGroup.visible) return false;
      camera.getWorldDirection(_camForward);
      _toMonster.subVectors(monsterGroup.position, camera.position);
      const dist = _toMonster.length();
      if (dist > 60) return false;
      _toMonster.normalize();
      return _camForward.dot(_toMonster) > 0.6; 
    }

    function spawnMonster() {
      const camForward = camera.getWorldDirection(new THREE.Vector3());
      const behind = camForward.clone().multiplyScalar(-1);
      const spawnDist = 25 + Math.random() * 15;
      monsterGroup.position.copy(camera.position).add(behind.multiplyScalar(spawnDist));
      monsterGroup.position.x = Math.max(-9, Math.min(9, monsterGroup.position.x));
      monsterGroup.position.y = 0;
      monsterGroup.visible = true;
      monsterState.active = true;
      monsterState.watchTime = 0;
      monsterState.speed = 1.8 + Math.random() * 1.6;
      monsterLight.intensity = 1;
    }

    function triggerJumpscare() {
      if (monsterState.attacking) return;
      monsterState.attacking = true;
      monsterState.attackId++;
      const myAttackId = monsterState.attackId;
      
      bloodFlash.classList.remove('fire');
      void bloodFlash.offsetWidth; 
      bloodFlash.classList.add('fire');
      
      playStinger(); scareZoom = 1; startTear();
      horrorLight.intensity = S.calmFlash ? 10 : 30;
      horrorLight.color.setHex(0xffffff);
      
      _toMonster.subVectors(monsterGroup.position, camera.position);
      camera.rotation.y = Math.atan2(_toMonster.x, _toMonster.z);
      
      const lungeStart = monsterGroup.position.clone();
      const lungeEnd = camera.position.clone().add(new THREE.Vector3(0, -0.5, 0));
      const lungeT0 = performance.now();
      const lungeDur = 280;
      
      function lungeAnim() {
        if (monsterState.attackId !== myAttackId) return;
        const t = Math.min(1, (performance.now() - lungeT0) / lungeDur);
        monsterGroup.position.lerpVectors(lungeStart, lungeEnd, t);
        monsterGroup.scale.setScalar(1 + t * 1.5);
        if (t < 1) {
          requestAnimationFrame(lungeAnim);
        } else {
          setTimeout(() => {
            if (monsterState.attackId !== myAttackId) return;
            monsterGroup.scale.setScalar(1);
            triggerDeath();
          }, 200);
        }
      }
      lungeAnim();
    }

    function triggerDeath() {
      dead = true;
      started = false;
      if (controls.isLocked) controls.unlock();
      deathStats.textContent = `You survived ${Math.floor(survivedTime)} seconds and traveled ${Math.floor(maxDistance)} meters. Best: ${recordBest()}m.`;
      deathOverlay.classList.remove('hidden');
      hud.classList.add('hidden');
      monsterGroup.visible = false;
      horrorLight.intensity = 4;
      horrorLight.color.setHex(0xff2222);
    }

    // ════════════════════════════════════════════════════════════════════
    //  ANIMATION LOOP
    // ════════════════════════════════════════════════════════════════════
    const clock = new THREE.Clock();
    const MOVE_SPEED = 6;
    let footstepTimer = 0;
    let time = 0;
    let scareTimer = 0;
    let nextScareAt = 8 + Math.random() * 6;
    let heartbeatTimer = 0;
    let whisperTimer = 0;
    let distantSoundTimer = 4 + Math.random() * 6;
    let metalClankTimer = 5 + Math.random() * 10;
    let eerieCryTimer = 15 + Math.random() * 20;
    let lowRumbleTimer = 10 + Math.random() * 15;
    let bobPhase = 0;
    let shakeAmount = 0;
    let baseFov = 76;

    // ── Settings (saved in localStorage) ──
    const DEFAULTS = { vol: { master: 100, footsteps: 100, heartbeat: 100, whispers: 100, scares: 100, ambient: 100 },
                       sens: 100, fov: 76, bright: 100, bob: true, shake: true, calmFlash: false, fx: true, diff: 'normal' };
    const SKEY = 'psychotic_corridor_settings';
    const S = (() => {
      let j = null; try { j = JSON.parse(localStorage.getItem(SKEY)); } catch (e) {}
      if (!j || typeof j !== 'object') j = {};
      return { ...DEFAULTS, ...j, vol: { ...DEFAULTS.vol, ...(j.vol && typeof j.vol === 'object' ? j.vol : {}) } };
    })();
    const DIFF = { easy: { speed: 0.75, drain: 0.7 }, normal: { speed: 1, drain: 1 }, hard: { speed: 1.25, drain: 1.3 } };
    if (!DIFF[S.diff]) S.diff = 'normal';
    let settingsOpen = false, paused = false;
    const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} };
    function applySettings() {
      controls.pointerSpeed = S.sens / 100;
      baseFov = S.fov; camera.fov = S.fov; camera.updateProjectionMatrix();
      renderer.domElement.style.filter = `brightness(${S.bright / 100})`;
      applyAudioSettings();
    }
    const ROWS = [
      ['h', 'VOLUME'],
      ['vol.master', 'Master', 0, 100, 1, '%'], ['vol.footsteps', 'Footsteps', 0, 100, 1, '%'],
      ['vol.heartbeat', 'Heartbeat', 0, 100, 1, '%'], ['vol.whispers', 'Whispers & voices', 0, 100, 1, '%'],
      ['vol.scares', 'Monster & jump scares', 0, 100, 1, '%'], ['vol.ambient', 'Ambient (clanks, wail, rumble)', 0, 100, 1, '%'],
      ['h', 'CONTROLS & VIDEO'],
      ['sens', 'Look sensitivity', 20, 200, 5, '%'], ['fov', 'Field of view', 60, 100, 1, '\u00b0'], ['bright', 'Brightness', 50, 150, 5, '%'],
      ['h', 'COMFORT'],
      ['t:bob', 'Head bob'], ['t:shake', 'Screen shake'], ['t:calmFlash', 'Reduce flashing'], ['t:fx', 'Film grain & scanlines'],
      ['h', 'GAME'],
      ['d:diff', 'Difficulty']
    ];
    const PREVIEW = { master: () => playFootstep(), footsteps: () => playFootstep(), heartbeat: () => playHeartbeat(),
                      whispers: () => playWhisper(), scares: () => playStinger(), ambient: () => playMetalClank() };
    const getP = p => { const [a, b] = p.split('.'); return b ? S[a][b] : S[a]; };
    const setP = (p, v) => { const [a, b] = p.split('.'); if (b) S[a][b] = v; else S[a] = v; };
    const panel = document.getElementById('settings-panel'), settingsEl = document.getElementById('settings');
    function buildSettings() {
      panel.innerHTML = '<h2 style="text-align:center;margin:0">SETTINGS</h2>';
      for (const [key, label, min, max, step, unit] of ROWS) {
        if (key === 'h') { const h = document.createElement('h3'); h.textContent = label; panel.appendChild(h); continue; }
        const row = document.createElement('label'), name = document.createElement('span'); name.textContent = label; row.appendChild(name);
        const path = key.replace(/^[td]:/, '');
        if (key.startsWith('t:')) {
          const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!getP(path);
          c.onchange = () => { setP(path, c.checked); saveSettings(); }; row.appendChild(c);
        } else if (key.startsWith('d:')) {
          const sel = document.createElement('select');
          for (const k of Object.keys(DIFF)) { const o = document.createElement('option'); o.value = k; o.textContent = k.toUpperCase(); sel.appendChild(o); }
          sel.value = S.diff; sel.onchange = () => { S.diff = sel.value; saveSettings(); }; row.appendChild(sel);
        } else {
          const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = getP(path);
          const pct = document.createElement('span'); pct.className = 'pct'; pct.textContent = r.value + unit;
          r.oninput = () => { setP(path, +r.value); pct.textContent = r.value + unit; applySettings(); saveSettings(); };
          r.onchange = () => { const k = path.split('.')[1]; if (PREVIEW[k]) { initAudio(); PREVIEW[k](); } };
          row.append(r, pct);
        }
        panel.appendChild(row);
      }
      const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:12px';
      const reset = document.createElement('button'); reset.className = 'btn'; reset.textContent = 'RESET';
      reset.onclick = () => { Object.assign(S, JSON.parse(JSON.stringify(DEFAULTS))); saveSettings(); applySettings(); buildSettings(); };
      const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'BACK'; close.onclick = closeSettings;
      bar.append(reset, close); panel.appendChild(bar);
    }
    function openSettings() { buildSettings(); settingsOpen = true; settingsEl.classList.remove('hidden'); if (controls.isLocked) controls.unlock(); }
    function closeSettings() { settingsOpen = false; settingsEl.classList.add('hidden'); }
    document.getElementById('gear').addEventListener('click', openSettings);
    document.getElementById('open-settings').addEventListener('click', e => { e.stopPropagation(); openSettings(); });
    applySettings();

    // ── Twists & content ──
    const blackoutEl = document.getElementById('blackout'), flashMsg = document.getElementById('flash-msg'), noteEl = document.getElementById('note');
    const MSGS = ['TURN AROUND', 'IT IS BEHIND YOU', "DON'T LOOK", "YOU CAN'T LEAVE", 'WE SEE YOU', 'KEEP WALKING', 'IT LEARNED YOUR NAME'];
    const NOTES = ['Day 1. The hallway was supposed to be a shortcut.', 'Day 3. The lights flicker whenever I stop walking.',
      'Day 4. I counted the doors. There are none.', 'Day 6. It only moves when I am not looking.', 'Day 7. The whispers use my voice now.',
      'Day 9. I heard footsteps while standing perfectly still.', 'Day 11. The dark is not empty. The dark is hungry.',
      "Day ?. If you are reading this, don't stop walking. Don't blink."];
    let phantom, blackout, msgNext, noteIdx;
    function twistReset() {
      phantom = { left: 0, t: 0, next: 20, pan: 1 }; blackout = { t: 0, next: 50 + Math.random() * 40 };
      msgNext = 14; noteIdx = 0; blackoutEl.style.opacity = 0;
    }
    twistReset();
    function showFlash(text) { flashMsg.textContent = text; flashMsg.style.opacity = 1; setTimeout(() => flashMsg.style.opacity = 0, 1600); }
    function recordBest() {
      let best = 0; try { best = +localStorage.getItem('psychotic_best') || 0; } catch (e) {}
      best = Math.max(best, Math.floor(maxDistance)); try { localStorage.setItem('psychotic_best', best); } catch (e) {}
      return best;
    }
    function twistTick(dt, moveMag) {
      // 1) Phantom footsteps: something walks behind you only while you stand still
      phantom.next -= dt;
      if (moveMag > 0.3) phantom.left = 0;
      else if (phantom.left <= 0 && phantom.next <= 0 && sanity < 60) { phantom.left = 4 + Math.floor(Math.random() * 4); phantom.t = 0; phantom.pan = Math.random() < 0.5 ? -1 : 1; }
      if (phantom.left > 0 && (phantom.t -= dt) <= 0) {
        playSfx(pickVariant('step', 4), 0.5, 0.12, 'footsteps', phantom.pan * 0.7); phantom.pan *= 0.85; phantom.t = 0.55;
        if (--phantom.left === 0) phantom.next = 25 + Math.random() * 25;
      }
      // 2) Blackout: the lights die and the monster gets faster
      blackout.next -= dt;
      if (blackout.t <= 0 && blackout.next <= 0) {
        blackout.t = 4 + Math.random() * 3; playSfx('clank0', 1, 0, 'ambient'); showFlash('THE LIGHTS DIED');
        blackoutEl.style.opacity = S.calmFlash ? 0.75 : 0.94;
      }
      if (blackout.t > 0) {
        blackout.t -= dt; sanity -= dt * 1.5 * DIFF[S.diff].drain;
        if (blackout.t <= 0) { blackoutEl.style.opacity = 0; blackout.next = 60 + Math.random() * 50; }
      }
      // 3) Whispered messages at low sanity
      msgNext -= dt;
      if (sanity < 50 && msgNext <= 0) { showFlash(MSGS[Math.floor(Math.random() * MSGS.length)]); playWhisper(); msgNext = 12 + Math.random() * 18; }
      // 4) Diary notes every 120 m
      if (noteIdx < NOTES.length && maxDistance >= (noteIdx + 1) * 120) {
        noteEl.textContent = '\u201c' + NOTES[noteIdx++] + '\u201d'; noteEl.style.opacity = 1; setTimeout(() => noteEl.style.opacity = 0, 6000);
      }
    }

    // ════════════════════════════════════════════════════════════════════
    //  ANALOG-HORROR FX · SPRINT · EYES · DOOR SLAMS · TEAR
    // ════════════════════════════════════════════════════════════════════
    let sprintHeld = false, sprintTouch = false, lastTap = 0, sprinting = false;
    let stamina = 100, exhausted = false, fovBoost = 0, scareZoom = 0, idleW = 0, swayPrev = 0, tearT = 0;
    let doorTimer = 20 + Math.random() * 15;
    const staminaBar = document.getElementById('stamina-bar');
    const grainEl = document.getElementById('grain'), scanEl = document.getElementById('scan'), goreEl = document.getElementById('gore');
    const tearEl = document.getElementById('tear'), tctx = tearEl.getContext('2d');

    (function () { // film-grain tile
      const c = document.createElement('canvas'); c.width = c.height = 180;
      const x = c.getContext('2d'), im = x.createImageData(180, 180);
      for (let i = 0; i < im.data.length; i += 4) { im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.random() * 255; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0); grainEl.style.backgroundImage = `url(${c.toDataURL()})`;
    })();
    (function () { // blood splatter hugging the screen edges
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const x = c.getContext('2d');
      for (let i = 0; i < 90; i++) {
        const e = Math.random() * 4 | 0, d = Math.pow(Math.random(), 2) * 95, u = Math.random() * 512;
        const px = e === 0 ? u : e === 1 ? u : e === 2 ? d : 512 - d, py = e === 0 ? d : e === 1 ? 512 - d : u;
        const r = 5 + Math.random() * 26;
        x.fillStyle = `rgba(${90 + Math.random() * 60 | 0},0,0,${0.5 + Math.random() * 0.45})`;
        x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
        for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(px + (Math.random() - 0.5) * r * 4, py + (Math.random() - 0.5) * r * 4, 1 + Math.random() * 4, 0, 7); x.fill(); }
        if (e === 0 && Math.random() < 0.5) { const len = 30 + Math.random() * 110; x.fillRect(px - 2, py, 4, len); x.beginPath(); x.arc(px, py + len, 4, 0, 7); x.fill(); }
      }
      goreEl.style.backgroundImage = `url(${c.toDataURL()})`;
    })();

    function fxTick() {
      const low = 1 - Math.max(0, Math.min(100, sanity)) / 100, on = S.fx;
      grainEl.style.display = scanEl.style.display = on ? 'block' : 'none';
      if (on) {
        grainEl.style.opacity = (0.07 + low * 0.3).toFixed(3);
        grainEl.style.backgroundPosition = `${Math.random() * 180 | 0}px ${Math.random() * 180 | 0}px`;
        scanEl.style.opacity = (0.15 + low * 0.45).toFixed(3);
      }
      goreEl.style.opacity = Math.max(0, Math.min(1, (55 - sanity) / 40)).toFixed(2);
    }
    function startTear() { tearT = 0.75; }
    function tearTick(dt) { // slices the rendered frame and shifts the strips
      if (tearT <= 0 || S.calmFlash) { tearT = 0; if (tearEl.style.display !== 'none') tearEl.style.display = 'none'; return; }
      tearT -= dt;
      const src = renderer.domElement, W = tearEl.width = src.width, H = tearEl.height = src.height, k = Math.min(1, tearT / 0.4);
      tearEl.style.display = 'block';
      for (let i = 0, n = 5 + Math.random() * 6 | 0; i < n; i++) {
        const h = H * (0.02 + Math.random() * 0.12), y = Math.random() * (H - h), off = (Math.random() - 0.5) * W * 0.25 * k;
        tctx.drawImage(src, 0, y, W, h, off, y, W, h);
        if (Math.random() < 0.5) { tctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,0,0,.35)' : 'rgba(0,255,255,.25)'; tctx.fillRect(0, y, W, h); }
      }
    }

    function playDoorSlam() { // synthesized thud + noise burst, panned hard to one side
      if (!audioCtx) return;
      const t = audioCtx.currentTime, pan = Math.random() < 0.5 ? -0.8 : 0.8, sr = audioCtx.sampleRate;
      const nb = audioCtx.createBuffer(1, sr * 0.5, sr), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const ns = audioCtx.createBufferSource(); ns.buffer = nb;
      const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const ng = audioCtx.createGain(); ng.gain.value = 1.4;
      const o = audioCtx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.35);
      const og = audioCtx.createGain(); og.gain.setValueAtTime(1.2, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      const out = audioCtx.createGain(); out.connect(bus.scares);
      let last = out; if (audioCtx.createStereoPanner) { const p = audioCtx.createStereoPanner(); p.pan.value = pan; p.connect(out); last = p; }
      ns.connect(lp); lp.connect(ng); ng.connect(last); o.connect(og); og.connect(last);
      ns.start(t); o.start(t); o.stop(t + 0.55);
      setTimeout(() => playSfx('clank1', 0.5, 0.1, 'ambient', pan), 90);
      sanity = Math.max(0, sanity - 2); noise = 1;
      horrorLight.intensity = S.calmFlash ? 6 : 14; setTimeout(() => { if (!dead) horrorLight.intensity = 4; }, 100);
    }

    // Eyes in the dark: appear when sanity is low, vanish if you stare back
    function makeCreature(arms) { // same look as the main monster: #4A0404 body, hollow sockets, glowing eyes
      const g = new THREE.Group(), eyesArr = [];
      const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 6, 8), monsterMat); bd.position.y = 3; g.add(bd);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), monsterMat); hd.scale.set(0.85, 1.9, 0.95); hd.position.y = 6.9; g.add(hd);
      for (const sx of [-1, 1]) {
        const sock = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), voidMat); sock.scale.set(1, 1.5, 0.6); sock.position.set(sx * 0.2, 7.45, 0.5); g.add(sock);
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), glowMat); core.position.set(sx * 0.2, 7.45, 0.57); g.add(core);
        const halo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), haloMat); halo.position.copy(core.position); g.add(halo);
        eyesArr.push(core, halo);
        if (arms) { const ag = new THREE.CylinderGeometry(0.06, 0.1, 5, 6); ag.translate(0, -2.5, 0); const am = new THREE.Mesh(ag, monsterMat); am.position.set(sx * 0.5, 5.4, 0); am.rotation.z = sx * 0.15; g.add(am); }
      }
      g.userData.eyes = eyesArr; return g;
    }
    const eyes = [], eyeGeo = new THREE.SphereGeometry(0.1, 8, 6), eyeM = new THREE.MeshBasicMaterial({ color: 0xff1010, fog: false });
    for (let i = 0; i < 6; i++) {
      const g = makeCreature(false); g.visible = false; scene.add(g);
      eyes.push({ g, life: 0, cool: Math.random() * 4, stare: 0 });
    }
    const _ef = new THREE.Vector3(), _ed = new THREE.Vector3();
    function eyesTick(dt) {
      const want = sanity < 55 ? Math.min(6, Math.ceil((55 - sanity) / 8)) : 0;
      camera.getWorldDirection(_ef);
      eyes.forEach((e, i) => {
        if (e.g.visible) {
          e.life -= dt; _ed.subVectors(e.g.position, camera.position); const dist = _ed.length(); _ed.normalize();
          const stare = _ef.dot(_ed) > 0.985 && dist < 40;
          e.stare = stare ? e.stare + dt : 0;
          { const bl = Math.random() < 0.03 ? 0.1 : 1; e.g.userData.eyes.forEach(m => m.scale.y = bl); }
          if (e.life <= 0 || e.stare > 0.6 || i >= want) { e.g.visible = false; e.cool = 3 + Math.random() * 6; e.stare = 0; }
        } else if (i < want && (e.cool -= dt) <= 0) {
          const f = new THREE.Vector3(_ef.x, 0, _ef.z).normalize(), ahead = (sanity < 30 && Math.random() < 0.3 ? -1 : 1) * (14 + Math.random() * 26);
          e.g.position.copy(camera.position).addScaledVector(f, ahead);
          e.g.position.x = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 3.3); e.g.position.y = 0; e.g.scale.setScalar(0.15 + Math.random() * 0.6);
          e.g.lookAt(camera.position.x, e.g.position.y, camera.position.z);
          e.life = 4 + Math.random() * 6; e.g.visible = true;
        }
      });
    }

    // ════════════════════════════════════════════════════════════════════
    //  NOISE · SAFE LIGHTS · CORRIDOR TRICKS · SHADOWS · COLLISION · PAUSE
    // ════════════════════════════════════════════════════════════════════
    let noise = 0, bumpCd = 0, inSafe = false, wasSafe = false, trickTimer = 25 + Math.random() * 20;
    const noiseBar = document.getElementById('noise-bar'), pauseEl = document.getElementById('pause'), pauseStats = document.getElementById('pause-stats');
    const _wp = new THREE.Vector3(), _fw = new THREE.Vector3();

    function collide(dt) { // props are solid; bumping them is loud
      bumpCd -= dt;
      for (const c of colliders) {
        const dx = camera.position.x - c.x, dz = camera.position.z - (c.h.parent.position.z + c.z), d = Math.hypot(dx, dz), min = c.r + 0.45;
        if (d < min && d > 0.001) {
          camera.position.x += dx / d * (min - d); camera.position.z += dz / d * (min - d);
          if (bumpCd <= 0) {
            bumpCd = 0.6; playMetalClank(); noise = Math.max(noise, 0.85);
            if (c.chair && sprinting && !c.fallen) { c.fallen = true; c.o.rotation.z = 1.45; c.o.position.y = 0.7; }
          }
        }
      }
    }

    const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
      g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const shadows = [0, 1, 2].map(() => { const m = makeCreature(true); m.visible = false; m.scale.setScalar(0.9); scene.add(m); return { m, vx: 0, life: 0 }; });

    const circTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,120,80,.4)'); g.addColorStop(0.7, 'rgba(210,60,40,.28)'); g.addColorStop(0.93, 'rgba(150,20,15,.16)'); g.addColorStop(1, 'rgba(120,10,10,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const lightCirc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: circTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    lightCirc.visible = false; scene.add(lightCirc);
    const _fw2 = new THREE.Vector3();
    function lightCircle() { // glowing circle on whatever surface the flashlight points at
      if (!flashlightOn) { lightCirc.visible = false; return; }
      camera.getWorldDirection(_fw2); const o = camera.position; let t = 60, n = null;
      const hit = (ax, v, nx, ny, nz) => { const d = _fw2[ax]; if (Math.abs(d) < 1e-4) return; const tt = (v - o[ax]) / d; if (tt > 0.3 && tt < t) { t = tt; n = [nx, ny, nz]; } };
      hit('x', -10, 1, 0, 0); hit('x', 10, -1, 0, 0); hit('y', 0, 0, 1, 0); hit('y', 16, 0, -1, 0);
      if (!n) { lightCirc.visible = false; return; }
      lightCirc.position.copy(o).addScaledVector(_fw2, t);
      lightCirc.position.x += n[0] * 0.05; lightCirc.position.y += n[1] * 0.05;
      lightCirc.lookAt(lightCirc.position.x + n[0], lightCirc.position.y + n[1], lightCirc.position.z + n[2]);
      const r = Math.min(6, t * Math.tan(0.28)); lightCirc.scale.set(r * 2, r * 2, 1);
      lightCirc.material.opacity = Math.max(0.2, 0.8 - t / 50); lightCirc.visible = true;
    }

    function systemsTick(dt, moveMag) {
      lightCircle();
      // noise: loud actions raise it, it decays; the monster hurries toward noise (speed + respawn)
      noise = Math.max((sprinting ? 0.9 : moveMag > 0.15 ? 0.3 : 0) * (inSafe ? 0.3 : 1), noise - dt * 0.5);
      noiseBar.style.width = (noise * 100).toFixed(0) + '%';
      if (!monsterState.active) monsterState.respawnTimer -= dt * noise * 1.2;

      // safe lights
      inSafe = false;
      for (const s of segments) {
        const z = s.zone; if (!z) continue;
        const lvl = Math.min(1, z.fuel / 4), d = Math.hypot(camera.position.x - z.x, camera.position.z - (s.group.position.z + z.z));
        z.light.intensity = 2.4 * lvl * (0.9 + Math.random() * 0.1); z.disc.material.opacity = 0.8 * lvl; z.bulb.visible = z.fuel > 0;
        if (d < 4.2 && z.fuel > 0) {
          inSafe = true; z.fuel -= dt; sanity += dt * 2.5; stamina = Math.min(100, stamina + dt * 15);
          if (z.fuel <= 0) { z.fuel = 0; showFlash('THE LIGHT DIED'); playSfx('clank0', 1, 0, 'ambient'); if (!monsterState.active) spawnMonster(); sanity -= 4; }
        }
      }
      if (inSafe && !wasSafe) showFlash('SAFE LIGHT');
      wasSafe = inSafe;
      if (inSafe && monsterState.active && !monsterState.attacking && monsterGroup.position.distanceTo(camera.position) < 16) {
        monsterGroup.visible = false; monsterState.active = false; monsterState.respawnTimer = 10; monsterLight.intensity = 0;
      }

      // corridor tricks
      camera.getWorldDirection(_fw); _fw.y = 0; _fw.normalize();
      for (const d of doors) {
        d.panel.getWorldPosition(_wp); _wp.sub(camera.position);
        const along = _wp.dot(_fw), dist = _wp.length();
        if (Math.abs(d.target) > 0.3 && along > 0 && dist < 14) { // open door ahead slams shut as you approach
          if (d.armed === undefined) d.armed = Math.random() < 0.35;
          if (d.armed) { d.armed = false; d.target = 0; d.fast = true; playDoorSlam(); }
        }
        d.panel.rotation.y += (d.target - d.panel.rotation.y) * Math.min(1, dt * (d.fast ? 14 : 1.6));
        if (d.fast && Math.abs(d.panel.rotation.y) < 0.02) d.fast = false;
      }
      trickTimer -= dt;
      if (trickTimer <= 0 && sanity < 85) { // a shut door behind you creaks open
        trickTimer = 22 + Math.random() * 28;
        const cand = doors.filter(d => { d.panel.getWorldPosition(_wp); _wp.sub(camera.position); const a = _wp.dot(_fw); return a < -6 && a > -45 && Math.abs(d.base) < 0.01 && Math.abs(d.target) < 0.01; });
        if (cand.length) { const d = cand[Math.random() * cand.length | 0]; d.target = d.dir * 1.1; playSfx(pickVariant('distant', 3), 0.8, 0.05, 'ambient'); playSfx('clank0', 0.4, 0.1, 'ambient', d.dir * 0.7); }
      }

      // ceiling lights burst
      const low = 1 - sanity / 100;
      if (Math.random() < dt * 0.06 * (1 + low * 3)) {
        const near = ceilingLights.filter(f => f.dead <= 0 && Math.abs(f.group.parent.position.z + f.z - camera.position.z) < 35);
        if (near.length) { near[Math.random() * near.length | 0].dead = 25 + Math.random() * 20; playSfx('clank1', 0.7, 0.2, 'ambient', (Math.random() - 0.5) * 1.4); horrorLight.intensity = S.calmFlash ? 5 : 10; setTimeout(() => { if (!dead) horrorLight.intensity = 4; }, 80); }
      }

      // shadows slipping across the floor
      const want = sanity < 75 ? 1 + (sanity < 45 ? 1 : 0) + (sanity < 25 ? 1 : 0) : 0;
      shadows.forEach((s, i) => {
        if (s.life > 0) {
          s.life -= dt; s.m.position.x += s.vx * dt; s.m.visible = s.life > 0 && Math.random() > 0.3;
          if (s.life <= 0) s.m.visible = false;
        } else if (i < want && Math.random() < dt * 0.12) {
          const side = Math.random() < 0.5 ? -1 : 1;
          s.m.position.set(side * -9, 0.06, camera.position.z + _fw.z * (8 + Math.random() * 18)); s.vx = side * (5 + Math.random() * 3); s.m.rotation.y = side * Math.PI / 2; s.life = 3; s.m.visible = true;
        }
      });
    }

    function openPause() {
      if (!pauseEl.classList.contains('hidden')) return;
      paused = true; releaseKeys();
      pauseStats.textContent = `${Math.floor(survivedTime)}s survived · ${Math.floor(maxDistance)}m · sanity ${Math.floor(sanity)}%`;
      pauseEl.classList.remove('hidden'); if (audioCtx) audioCtx.suspend();
    }
    function resumeGame() {
      pauseEl.classList.add('hidden'); paused = false; if (audioCtx) audioCtx.resume(); if (!isMobile) controls.lock();
    }
    document.getElementById('p-resume').onclick = resumeGame;
    document.getElementById('p-set').onclick = openSettings;
    document.getElementById('p-restart').onclick = () => { resetGame(); resumeGame(); };
    document.getElementById('pausebtn').onclick = () => { if (controls.isLocked) controls.unlock(); else openPause(); };

    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      time += dt;

      if (started && !dead && !paused && !settingsOpen) {
        survivedTime += dt;

        // ── Movement input ──
        let fwd = 0, strafe = 0;
        if (keys.forward) fwd += 1;
        if (keys.back) fwd -= 1;
        if (keys.right) strafe += 1;
        if (keys.left) strafe -= 1;
        fwd += -moveVec.z;
        strafe += moveVec.x;
        const moveMag = Math.min(1, Math.hypot(fwd, strafe));

        const prevZ = camera.position.z;
        sprinting = (sprintHeld || sprintTouch) && moveMag > 0.3 && fwd > -0.1 && !exhausted && stamina > 0;
        if (sprinting) { stamina -= 24 * dt; sanity -= 1.1 * dt * DIFF[S.diff].drain; if (stamina <= 0) { stamina = 0; exhausted = true; } }
        else { stamina = Math.min(100, stamina + (moveMag > 0.15 ? 8 : 20) * dt); if (exhausted && stamina > 30) exhausted = false; }
        const sm = sprinting ? 1.75 : (exhausted ? 0.8 : 1);
        controls.moveForward(fwd * MOVE_SPEED * sm * dt);
        controls.moveRight(strafe * MOVE_SPEED * sm * dt);

        camera.position.x = Math.max(-8.5, Math.min(8.5, camera.position.x));
        collide(dt);
        const dz = prevZ - camera.position.z;
        if (dz > 0) {
          distance += dz;
          if (distance > maxDistance) maxDistance = distance;
        }

        // ── Head bob ──
        if (moveMag > 0.15) {
          bobPhase += dt * moveMag * 9 * sm;
          const bobY = Math.sin(bobPhase * 2) * 0.06 * (S.bob ? 1 : 0);
          camera.position.y = 1.8 + bobY;
          footstepTimer -= dt;
          if (footstepTimer <= 0) {
            playFootstep();
            footstepTimer = 0.42 / (moveMag * sm);
          }
        } else {
          camera.position.y += (1.8 + Math.sin(time * 1.6) * 0.025 - camera.position.y) * 0.1;
          footstepTimer = 0;
        }

        // ── Idle breathing sway ──
        idleW += ((moveMag <= 0.15 ? 1 : 0) - idleW) * 0.05;
        { const sw = Math.sin(time * 1.6 + 0.6) * 0.005 * idleW; camera.rotation.x += sw - swayPrev; swayPrev = sw; }

        // ── Recycle segments ──
        for (const seg of segments) {
          const worldZ = seg.z + seg.group.position.z;
          if (worldZ > camera.position.z + SEG_LEN) {
            seg.group.position.z -= TOTAL_LEN; if (seg.zone) seg.zone.fuel = 14;
          }
        }

        // ── Horror light flicker ──
        if (horrorLight.intensity < 8) {
          horrorLight.intensity = 3.5 + Math.sin(time * 9) * 0.6 + (Math.random() - 0.5) * 0.6;
        }

        // ── Flashlight flicker (worse at low sanity) ──
        if (flashlightOn) {
          let flicker = 1.0;
          /* steady beam: never flickers out */
          flashlight.intensity = FL * flicker;
        }

        // ── Ceiling lights ──
        let litCount = 0;
        for (const fx of ceilingLights) {
          let level;
          if (fx.kind === 'flicker') {
            level = 0.85 + Math.sin(time * 6 + fx.phase) * 0.15;
            if (Math.random() < 0.012) level *= 0.15;
          } else {
            fx.blinkTimer -= dt;
            if (fx.blinkTimer <= 0) {
              fx.isOn = !fx.isOn;
              if (fx.kind === 'blink') {
                fx.blinkTimer = fx.isOn ? 1.4 + Math.random() * 2 : 0.15 + Math.random() * 0.35;
              } else {
                fx.blinkTimer = fx.isOn ? 0.05 + Math.random() * 0.12 : 0.03 + Math.random() * 0.1;
              }
            }
            level = fx.isOn ? 1 : 0.04;
          }
          if (fx.dead > 0) { fx.dead -= dt; level = 0; }
          const sanityFactor = Math.max(0.3, sanity / 100);
          fx.light.intensity = Math.max(0.05, 0.8 * level * sanityFactor);
          fx.bulbMat.emissiveIntensity = Math.max(0.08, 0.6 * level * sanityFactor);
          if (level > 0.3) litCount++;
        }

        // ── Monster logic ──
        if (!monsterState.active) {
          monsterState.respawnTimer -= dt;
          const spawnBoost = (100 - sanity) / 100 * 3;
          if (monsterState.respawnTimer <= 0 && sanity < 90) {
            spawnMonster();
            monsterState.respawnTimer = 12 - spawnBoost + Math.random() * 6;
          }
        } else if (!monsterState.attacking) {
          const inView = isMonsterInView();
          if (inView) {
            monsterState.watchTime += dt;
            monsterLight.intensity = Math.max(0.3, monsterLight.intensity - dt * 2);
            const back = camera.getWorldDirection(new THREE.Vector3());
            monsterGroup.position.add(back.multiplyScalar(-1.5 * dt));
            monsterGroup.position.y = 0;
            sanity -= dt * 4;
            if (monsterState.watchTime > 2.5) {
              monsterGroup.visible = false;
              monsterState.active = false;
              monsterState.respawnTimer = 8 + Math.random() * 8;
              monsterLight.intensity = 0;
            }
          } else {
            monsterState.watchTime = Math.max(0, monsterState.watchTime - dt * 0.5);
            monsterLight.intensity = Math.min(2, monsterLight.intensity + dt * 1.5);
            _toMonster.subVectors(camera.position, monsterGroup.position);
            const dist = _toMonster.length();
            _toMonster.normalize();
            const sp = monsterState.speed * (1 + (100 - sanity) / 150) * DIFF[S.diff].speed * (blackout.t > 0 ? 1.3 : 1) * (0.9 + noise * 0.5);
            monsterGroup.position.add(_toMonster.multiplyScalar(sp * dt));
            monsterGroup.position.y = 0;
            monsterGroup.lookAt(camera.position.x, monsterGroup.position.y, camera.position.z);
            if (dist < 1.8) {
              triggerJumpscare();
            }
          }
        }

        // ── Sanity drain / regen ──
        sanity -= dt * 0.6 * DIFF[S.diff].drain;
        if (moveMag > 0.3 && dz > 0) sanity += dt * 0.3;
        sanity = Math.max(0, Math.min(100, sanity));
        if (sanity <= 0 && !monsterState.attacking) {
          triggerJumpscare();
        }

        // ── Sanity-driven effects ──
        sanityBar.style.width = sanity + '%';
        distanceEl.textContent = Math.floor(maxDistance);
        timeEl.textContent = Math.floor(survivedTime);

        vignette.classList.toggle('low', sanity < 60);
        vignette.classList.toggle('critical', sanity < 30);
        if (sanity < 60) {
          vignette.style.opacity = (1 - sanity / 60 * 0.5).toFixed(2);
        } else {
          vignette.style.opacity = '1';
        }

        if (whisperGain) {
          const whisperTarget = sanity < 60 ? Math.min(0.12, (60 - sanity) / 60 * 0.15) : 0;
          whisperGain.gain.value += (whisperTarget - whisperGain.gain.value) * 0.05;
        }

        if (sanity < 40) {
          heartbeatTimer -= dt;
          if (heartbeatTimer <= 0) {
            playHeartbeat();
            heartbeatTimer = 1.2 - (40 - sanity) / 40 * 0.6;
          }
        }

        if (sanity < 70) {
          whisperTimer -= dt;
          if (whisperTimer <= 0) {
            playWhisper();
            whisperTimer = 3 + Math.random() * 6;
          }
        }

        // ── Random Creepy Ambient Sounds ──
        distantSoundTimer -= dt;
        if (distantSoundTimer <= 0) {
          playDistantSound();
          distantSoundTimer = 8 + Math.random() * 12;
        }

        metalClankTimer -= dt;
        if (metalClankTimer <= 0) {
          playMetalClank();
          metalClankTimer = 6 + Math.random() * 15;
        }

        eerieCryTimer -= dt;
        if (eerieCryTimer <= 0) {
          playEerieCry();
          eerieCryTimer = 18 + Math.random() * 35;
        }

        lowRumbleTimer -= dt;
        if (lowRumbleTimer <= 0) {
          playLowRumble();
          lowRumbleTimer = 12 + Math.random() * 25;
        }

        twistTick(dt, moveMag);
        systemsTick(dt, moveMag);
        if (monsterGroup.visible) animateMonster(monsterState.attacking);
        for (const s of swingers) s.p.rotation.z = Math.sin(time * 1.1 + s.ph) * 0.12;
        eyesTick(dt);
        doorTimer -= dt;
        if (doorTimer <= 0) { playDoorSlam(); doorTimer = 22 + Math.random() * 35; }
        staminaBar.style.width = stamina + '%'; staminaBar.classList.toggle('ex', exhausted);
        scareTimer += dt;
        if (scareTimer >= nextScareAt) {
          scareTimer = 0;
          nextScareAt = 10 + Math.random() * 10;
          horrorLight.intensity = S.calmFlash ? 6 : 12;
          setTimeout(() => { if (!dead) horrorLight.intensity = 4; }, 120);
          playWhisper();
        }

        // ── Camera shake + speed/zoom FOV ──
        if (sanity < 30) { shakeAmount = (30 - sanity) / 30 * 0.04 * (S.shake ? 1 : 0); camera.rotation.z = (Math.random() - 0.5) * shakeAmount; }
        else if (camera.rotation.z !== 0) camera.rotation.z *= 0.9;
        fovBoost += ((sprinting ? 16 : 0) - fovBoost) * Math.min(1, dt * 5);
        camera.fov += (baseFov + fovBoost + (sanity < 30 ? Math.sin(time * 4) * 2 : 0) - scareZoom * 34 - camera.fov) * 0.15;
        camera.updateProjectionMatrix();

        // ── Dust particles ──
        const positions = dustGeo.attributes.position.array;
        for (let i = 0; i < DUST_COUNT; i++) {
          positions[i*3]   += dustVel[i*3]   * dt;
          positions[i*3+1] += dustVel[i*3+1] * dt;
          positions[i*3+2] += dustVel[i*3+2] * dt;
          const dx2 = positions[i*3] - camera.position.x;
          const dz2 = positions[i*3+2] - camera.position.z;
          if (dx2 > 12)  positions[i*3] -= 24;
          if (dx2 < -12) positions[i*3] += 24;
          if (dz2 > 40)  positions[i*3+2] -= 80;
          if (dz2 < -40) positions[i*3+2] += 80;
          if (positions[i*3+1] < 0) positions[i*3+1] = 16;
          if (positions[i*3+1] > 16) positions[i*3+1] = 0;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      tearTick(dt); fxTick(dt);
    }

    animate();
