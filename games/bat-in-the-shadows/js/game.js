// ============================================================================
// BAT IN THE SHADOWS — v2.1
// Touch overhaul: multi-touch-safe joystick (touch-ID tracking, floating
// centre, dead zone, camera-relative screen-correct axes), drag-to-look
// camera on touch, touch pause button, refresh-rate-independent movement.
// Screen-direction fixes: A/D, mouse look, Q/E, bat facing.
// v2.0 systems: sonar pulse, power-ups, stalactites & seeker beams, ambient
// music, settings persistence. Original difficulty curve unchanged.
// ============================================================================

import * as THREE from 'three';

// ===== Settings (persisted) =====
const SETTINGS_KEY = 'batSettings_v2';
const settings = {
    volume: 80,
    music: true,
    sfx: true,
    sensitivity: 100,
    particles: true,
    mouseLook: true,
    invertLook: false,
    invertSide: false,
    fog: 50
};
function loadSettings() {
    try {
        const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        for (const k in settings) {
            if (raw[k] !== undefined) settings[k] = raw[k];
        }
    } catch (e) {}
}
function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}
loadSettings();

// ===== Audio =====
const AudioSys = {
    ctx: null,
    masterGain: null,
    sfxEnabled: true,
    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = settings.volume / 100;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (MusicSys.enabled) MusicSys.start();
    },
    play(type) {
        if (!this.ctx || !this.sfxEnabled) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(this.masterGain || ctx.destination);
        switch(type) {
            case 'collect':
                o.type = 'sine'; o.frequency.setValueAtTime(660, t);
                o.frequency.exponentialRampToValueAtTime(1320, t + 0.1);
                g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                o.start(t); o.stop(t + 0.15); break;
            case 'collect_rare':
                o.type = 'sine'; o.frequency.setValueAtTime(880, t);
                o.frequency.exponentialRampToValueAtTime(1760, t + 0.15);
                g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                o.start(t); o.stop(t + 0.25); break;
            case 'damage':
                o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t);
                o.frequency.exponentialRampToValueAtTime(50, t + 0.3);
                g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                o.start(t); o.stop(t + 0.3); break;
            case 'warn':
                o.type = 'triangle'; o.frequency.setValueAtTime(440, t);
                o.frequency.linearRampToValueAtTime(660, t + 0.15);
                g.gain.setValueAtTime(0.06, t); g.gain.linearRampToValueAtTime(0, t + 0.15);
                o.start(t); o.stop(t + 0.15); break;
            case 'gameover':
                o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t);
                o.frequency.exponentialRampToValueAtTime(60, t + 1.2);
                g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
                o.start(t); o.stop(t + 1.5); break;
            case 'sonar': {
                // Descending echo ping with a faint second bounce
                o.type = 'sine'; o.frequency.setValueAtTime(1300, t);
                o.frequency.exponentialRampToValueAtTime(320, t + 0.45);
                g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
                o.start(t); o.stop(t + 0.5);
                const o2 = ctx.createOscillator();
                const g2 = ctx.createGain();
                o2.connect(g2); g2.connect(this.masterGain || ctx.destination);
                o2.type = 'sine'; o2.frequency.setValueAtTime(700, t + 0.28);
                o2.frequency.exponentialRampToValueAtTime(220, t + 0.75);
                g2.gain.setValueAtTime(0.001, t);
                g2.gain.setValueAtTime(0.05, t + 0.28);
                g2.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
                o2.start(t + 0.28); o2.stop(t + 0.8);
                break;
            }
            case 'powerup': {
                // Quick rising arpeggio
                const notes = [523.25, 659.25, 880];
                notes.forEach((f, i) => {
                    const oo = ctx.createOscillator();
                    const gg = ctx.createGain();
                    oo.connect(gg); gg.connect(this.masterGain || ctx.destination);
                    oo.type = 'sine'; oo.frequency.value = f;
                    const st = t + i * 0.07;
                    gg.gain.setValueAtTime(0.09, st);
                    gg.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
                    oo.start(st); oo.stop(st + 0.25);
                });
                o.frequency.value = 523.25;
                g.gain.setValueAtTime(0.001, t);
                g.gain.linearRampToValueAtTime(0, t + 0.01);
                o.start(t); o.stop(t + 0.02);
                break;
            }
            case 'shield':
                o.type = 'square'; o.frequency.setValueAtTime(880, t);
                o.frequency.exponentialRampToValueAtTime(330, t + 0.18);
                g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                o.start(t); o.stop(t + 0.25); break;
            case 'impact':
                o.type = 'triangle'; o.frequency.setValueAtTime(120, t);
                o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
                g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                o.start(t); o.stop(t + 0.3); break;
        }
    }
};

// ===== Ambient Music (procedural: cave drone + sparse chimes) =====
const MusicSys = {
    enabled: settings.music,
    started: false,
    nodes: null,
    start() {
        if (!AudioSys.ctx || this.started || !this.enabled) return;
        const ctx = AudioSys.ctx;
        const bus = ctx.createGain();
        bus.gain.setValueAtTime(0, ctx.currentTime);
        bus.connect(AudioSys.masterGain);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;
        filter.Q.value = 0.7;
        filter.connect(bus);
        const oscs = [];
        [[55, 'sine', 0.20], [82.41, 'sine', 0.16], [110, 'triangle', 0.10]].forEach(([f, type, vol]) => {
            const o = ctx.createOscillator();
            o.type = type; o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = vol;
            o.connect(g); g.connect(filter);
            o.start();
            oscs.push(o);
        });
        // Slow LFO sweeps the filter for a breathing, cavernous feel
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 130;
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
        lfo.start();
        // Sparse pentatonic chimes drifting through the cave
        const chimeTimer = setInterval(() => {
            if (!this.enabled || !AudioSys.ctx) return;
            this.chime(ctx, bus);
        }, 3400);
        bus.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3);
        this.nodes = { bus, oscs, lfo, chimeTimer };
        this.started = true;
    },
    chime(ctx, bus) {
        const notes = [523.25, 587.33, 659.25, 783.99, 880];
        const f = notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.3 ? 2 : 1);
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        o.connect(g); g.connect(bus);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
        o.start(t); o.stop(t + 3.6);
    },
    setEnabled(on) {
        this.enabled = on;
        if (!AudioSys.ctx) return;
        if (on) {
            this.start();
            if (this.nodes) {
                this.nodes.bus.gain.cancelScheduledValues(AudioSys.ctx.currentTime);
                this.nodes.bus.gain.linearRampToValueAtTime(0.5, AudioSys.ctx.currentTime + 1);
            }
        } else if (this.nodes) {
            this.nodes.bus.gain.cancelScheduledValues(AudioSys.ctx.currentTime);
            this.nodes.bus.gain.linearRampToValueAtTime(0, AudioSys.ctx.currentTime + 0.6);
        }
    }
};

// ===== Scene =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e3a);
scene.fog = new THREE.FogExp2(0x2a2a50, 0.006);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
document.body.appendChild(renderer.domElement);

// ===== Terrain =====
const worldSize = 800;
const worldHalf = worldSize / 2;
const seg = 128;
const terrainGeo = new THREE.PlaneGeometry(worldSize, worldSize, seg, seg);
const tPos = terrainGeo.attributes.position;

function terrainHeight(x, z) {
    let y = 0;
    y += Math.sin(x * 0.015) * Math.cos(z * 0.015) * 4;
    y += Math.sin(x * 0.05 + z * 0.03) * 1.5;
    y += Math.sin(x * 0.1) * Math.cos(z * 0.08) * 0.6;
    y += Math.sin(x * 0.25 + z * 0.2) * 0.2;
    return y;
}

for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i), z = tPos.getY(i);
    tPos.setZ(i, terrainHeight(x, z));
}
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x2d2d55, roughness: 0.92, metalness: 0.05, flatShading: true
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
scene.add(terrain);

// ===== Ceiling =====
const ceilGeo = new THREE.PlaneGeometry(worldSize, worldSize, 32, 32);
const cPos = ceilGeo.attributes.position;
for (let i = 0; i < cPos.count; i++) {
    const x = cPos.getX(i), y = cPos.getY(i);
    cPos.setZ(i, Math.sin(x * 0.02) * Math.cos(y * 0.02) * 3 + Math.random() * 0.5);
}
ceilGeo.computeVertexNormals();
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x3a3a60, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 55;
scene.add(ceiling);

// ===== Instanced Rocks =====
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3a5a, roughness: 0.9, flatShading: true });
const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, 250);
rockMesh.receiveShadow = true;
const dummy = new THREE.Object3D();

for (let i = 0; i < 250; i++) {
    const x = (Math.random() - 0.5) * worldSize * 0.95;
    const z = (Math.random() - 0.5) * worldSize * 0.95;
    const h = terrainHeight(x, z);
    dummy.position.set(x, h + 0.5, z);
    dummy.scale.setScalar(0.5 + Math.random() * 2);
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
}
rockMesh.instanceMatrix.needsUpdate = true;
scene.add(rockMesh);

// ===== Instanced Pillars =====
const pillarGeo = new THREE.CylinderGeometry(0.3, 0.8, 6, 6);
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4a4a7a, roughness: 0.8, flatShading: true });
const glowPillarMat = new THREE.MeshStandardMaterial({ color: 0x6644aa, emissive: 0x442288, emissiveIntensity: 0.5, roughness: 0.6, flatShading: true });

const pillarMesh = new THREE.InstancedMesh(pillarGeo, pillarMat, 100);
const glowPillarMesh = new THREE.InstancedMesh(pillarGeo, glowPillarMat, 50);
pillarMesh.castShadow = true; pillarMesh.receiveShadow = true;
glowPillarMesh.castShadow = true; glowPillarMesh.receiveShadow = true;

let pIdx = 0, gIdx = 0;
for (let i = 0; i < 150; i++) {
    const x = (Math.random() - 0.5) * worldSize * 0.9;
    const z = (Math.random() - 0.5) * worldSize * 0.9;
    const h = terrainHeight(x, z);
    dummy.position.set(x, h + 3, z);
    dummy.scale.set(1 + Math.random(), 0.5 + Math.random() * 1.5, 1 + Math.random());
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.updateMatrix();

    if (Math.random() > 0.3 && gIdx < 50) {
        glowPillarMesh.setMatrixAt(gIdx++, dummy.matrix);
    } else if (pIdx < 100) {
        pillarMesh.setMatrixAt(pIdx++, dummy.matrix);
    }
}
pillarMesh.instanceMatrix.needsUpdate = true;
glowPillarMesh.instanceMatrix.needsUpdate = true;
scene.add(pillarMesh);
scene.add(glowPillarMesh);

// ===== Instanced Mushrooms =====
const stemGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.5, 6);
const capGeo = new THREE.SphereGeometry(0.8, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const stemMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.9 });
const capMat = new THREE.MeshStandardMaterial({ color: 0xff6688, emissive: 0x441122, emissiveIntensity: 0.2, roughness: 0.7 });

const stemMesh = new THREE.InstancedMesh(stemGeo, stemMat, 80);
const capMesh = new THREE.InstancedMesh(capGeo, capMat, 80);
stemMesh.castShadow = true; capMesh.castShadow = true;

for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * worldSize * 0.9;
    const z = (Math.random() - 0.5) * worldSize * 0.9;
    const h = terrainHeight(x, z);
    const s = 0.8 + Math.random() * 1.5;

    dummy.position.set(x, h + 0.75 * s, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, h + 1.4 * s, z);
    dummy.scale.set(s, s * 0.6, s);
    dummy.updateMatrix();
    capMesh.setMatrixAt(i, dummy.matrix);
}
stemMesh.instanceMatrix.needsUpdate = true;
capMesh.instanceMatrix.needsUpdate = true;
scene.add(stemMesh);
scene.add(capMesh);

// ===== Dust =====
const dustCount = 2500;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
    dustPos[i*3] = (Math.random() - 0.5) * worldSize;
    dustPos[i*3+1] = Math.random() * 30;
    dustPos[i*3+2] = (Math.random() - 0.5) * worldSize;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustSystem = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xccddff, size: 0.12, transparent: true, opacity: 0.5, sizeAttenuation: true
}));
scene.add(dustSystem);

// ===== Lighting =====
scene.add(new THREE.AmbientLight(0x445588, 0.7));
const sun = new THREE.DirectionalLight(0xffeedd, 0.6);
sun.position.set(50, 40, -30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
sun.shadow.camera.far = 200;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x6688cc, 0.3);
fillLight.position.set(-40, 20, 40);
scene.add(fillLight);

// ===== Bat =====
const batGroup = new THREE.Group();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.5, metalness: 0.4 });
const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), bodyMat);
body.scale.set(1, 0.85, 1.2);
body.castShadow = true;
batGroup.add(body);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), bodyMat);
head.position.set(0, 0.25, -0.55);
batGroup.add(head);

const earGeo = new THREE.ConeGeometry(0.1, 0.35, 4);
const earL = new THREE.Mesh(earGeo, bodyMat);
earL.position.set(-0.18, 0.55, -0.5); earL.rotation.z = 0.3; earL.rotation.x = -0.3;
batGroup.add(earL);
const earR = new THREE.Mesh(earGeo, bodyMat);
earR.position.set(0.18, 0.55, -0.5); earR.rotation.z = -0.3; earR.rotation.x = -0.3;
batGroup.add(earR);

const wingShape = new THREE.Shape();
wingShape.moveTo(0, 0); wingShape.lineTo(1.8, 0.4); wingShape.lineTo(2.2, -0.3);
wingShape.lineTo(1.5, -0.8); wingShape.lineTo(0.6, -0.5); wingShape.lineTo(0, 0);
const wingGeo2 = new THREE.ShapeGeometry(wingShape);
const wingMat2 = new THREE.MeshStandardMaterial({
    color: 0x252535, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.95
});
const leftWing = new THREE.Mesh(wingGeo2, wingMat2);
leftWing.position.set(-0.2, 0, 0); leftWing.rotation.y = Math.PI;
batGroup.add(leftWing);
const rightWing = new THREE.Mesh(wingGeo2, wingMat2);
rightWing.position.set(0.2, 0, 0);
batGroup.add(rightWing);

const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
eyeL.position.set(-0.14, 0.3, -0.82);
batGroup.add(eyeL);
const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
eyeR.position.set(0.14, 0.3, -0.82);
batGroup.add(eyeR);
const eyeGlow = new THREE.PointLight(0xff3355, 0.6, 4);
eyeGlow.position.set(0, 0.3, -0.9);
batGroup.add(eyeGlow);

// Shield bubble (visible while the shield power-up is active)
const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 24, 16),
    new THREE.MeshBasicMaterial({
        color: 0x66ccff, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
);
shieldBubble.visible = false;
batGroup.add(shieldBubble);

batGroup.position.set(0, 5, 0);
scene.add(batGroup);

// ===== Collectables =====
const collectables = [];
const collectableTypes = {
    firefly: { color: 0xffdd44, lightColor: 0xffdd44, emissive: 0xaa8800, size: 0.14, value: 10, geo: new THREE.SphereGeometry(1, 8, 8) },
    crystal: { color: 0x44ffaa, lightColor: 0x44ffaa, emissive: 0x00aa66, size: 0.24, value: 25, geo: new THREE.OctahedronGeometry(1, 0) },
    moonshard: { color: 0xaa88ff, lightColor: 0xaa88ff, emissive: 0x6644cc, size: 0.2, value: 50, geo: new THREE.IcosahedronGeometry(1, 0) }
};

function spawnCollectable() {
    const types = ['firefly','firefly','firefly','crystal','crystal','moonshard'];
    const typeKey = types[Math.floor(Math.random() * types.length)];
    const type = collectableTypes[typeKey];

    const mesh = new THREE.Mesh(type.geo, new THREE.MeshStandardMaterial({
        color: type.color, emissive: type.emissive, emissiveIntensity: 0.6,
        roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.95
    }));
    mesh.scale.setScalar(type.size);

    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 40;
    const x = batGroup.position.x + Math.cos(angle) * dist;
    const z = batGroup.position.z + Math.sin(angle) * dist;
    const y = Math.max(terrainHeight(x, z) + 2, 2) + Math.random() * 8;

    mesh.position.set(
        THREE.MathUtils.clamp(x, -worldHalf + 5, worldHalf - 5),
        y,
        THREE.MathUtils.clamp(z, -worldHalf + 5, worldHalf - 5)
    );

    const light = new THREE.PointLight(type.lightColor, 1.5, 10);
    mesh.add(light);

    mesh.userData = {
        type: typeKey, value: type.value, baseY: y,
        baseScale: type.size, baseEmissive: 0.6,
        phase: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2,
        bobSpeed: 1 + Math.random(), active: true,
        sonarTimer: 0, sonarPulse: -1
    };

    scene.add(mesh);
    collectables.push(mesh);
}

for (let i = 0; i < 25; i++) spawnCollectable();

// Particles
const particles = [];
function spawnParticles(pos, color) {
    if (!particlesEnabled) return;
    const count = 14;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
        positions[i*3] = pos.x; positions[i*3+1] = pos.y; positions[i*3+2] = pos.z;
        velocities.push({
            x: (Math.random() - 0.5) * 0.2,
            y: (Math.random() - 0.5) * 0.2,
            z: (Math.random() - 0.5) * 0.2,
            life: 1.0
        });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.18, transparent: true, opacity: 1 });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    particles.push({ mesh: pts, velocities });
}

// ===== Beams =====
const beams = [];
const beamPool = [];
const MAX_BEAMS = 12;
const SEEKER_CHANCE = 0.22;      // fraction of beams that hunt the bat
const SEEKER_SPEED = 2.6;        // world units per second

function getBeam() {
    if (beamPool.length) return beamPool.pop();
    const group = new THREE.Group();
    const warnGeo = new THREE.RingGeometry(0.4, 0.7, 32);
    const warnMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const warn = new THREE.Mesh(warnGeo, warnMat);
    warn.rotation.x = -Math.PI / 2;
    group.add(warn);

    const shaftGeo = new THREE.CylinderGeometry(0.15, 3.0, 55, 16, 1, true);
    const shaftMat = new THREE.MeshBasicMaterial({
        color: 0xfff5cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 26;
    group.add(shaft);

    const spot = new THREE.SpotLight(0xffeedd, 0, 50, 0.45, 0.5, 1.0);
    spot.position.set(0, 52, 0);
    spot.target.position.set(0, -5, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(256, 256);
    group.add(spot);
    group.add(spot.target);

    const glowGeo = new THREE.CircleGeometry(1.5, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 52;
    group.add(glow);

    return { group, warn, shaft, spot, glow, active: false, phase: 'warn', timer: 0, x: 0, z: 0, swayOffset: 0, seeker: false, maxLife: 2.0 };
}

function spawnBeam() {
    if (beams.length >= MAX_BEAMS) return;
    const b = getBeam();
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 50;
    b.x = batGroup.position.x + Math.cos(angle) * dist;
    b.z = batGroup.position.z + Math.sin(angle) * dist;
    b.x = THREE.MathUtils.clamp(b.x, -worldHalf + 10, worldHalf - 10);
    b.z = THREE.MathUtils.clamp(b.z, -worldHalf + 10, worldHalf - 10);

    // FIX: lifetime is decided once per beam (was re-randomized every frame)
    b.seeker = Math.random() < SEEKER_CHANCE;
    b.maxLife = b.seeker ? 3.5 : 2.0 + Math.random() * 1.5;
    // Seekers are tinted amber so they can be told apart from normal beams
    b.shaft.material.color.setHex(b.seeker ? 0xffd9a0 : 0xfff5cc);
    b.glow.material.color.setHex(b.seeker ? 0xffaa66 : 0xffcc66);
    b.warn.material.color.setHex(b.seeker ? 0xff9955 : 0xff4444);

    b.group.position.set(b.x, 0, b.z);
    b.active = true; b.phase = 'warn'; b.timer = 0; b.swayOffset = Math.random() * Math.PI * 2;
    b.warn.material.opacity = 0;
    b.shaft.material.opacity = 0;
    b.spot.intensity = 0;
    b.glow.material.opacity = 0;
    scene.add(b.group);
    beams.push(b);
    AudioSys.play('warn');
}

function returnBeam(b) {
    scene.remove(b.group);
    b.active = false;
    beamPool.push(b);
}

// ===== Stalactites (new hazard: telegraphed falls from the ceiling) =====
const stalactites = [];
const stalactitePool = [];
const MAX_STALACTITES = 3;
let stalactiteTimer = 8;

function getStalactite() {
    if (stalactitePool.length) return stalactitePool.pop();
    const group = new THREE.Group();
    const warnGeo = new THREE.RingGeometry(0.5, 0.85, 24);
    const warnMat = new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const warn = new THREE.Mesh(warnGeo, warnMat);
    warn.rotation.x = -Math.PI / 2;
    group.add(warn);

    const coneGeo = new THREE.ConeGeometry(0.9, 4.5, 7);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x555578, roughness: 0.85, flatShading: true, transparent: true, opacity: 1 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI; // tip points down
    cone.castShadow = true;
    group.add(cone);

    return { group, warn, cone, warnMat, coneMat, active: false, phase: 'warn', timer: 0, x: 0, z: 0, vy: 0, groundY: 0, tilt: 0 };
}

function spawnStalactite() {
    if (stalactites.length >= MAX_STALACTITES) return;
    const s = getStalactite();
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 23;
    s.x = batGroup.position.x + Math.cos(angle) * dist;
    s.z = batGroup.position.z + Math.sin(angle) * dist;
    s.x = THREE.MathUtils.clamp(s.x, -worldHalf + 10, worldHalf - 10);
    s.z = THREE.MathUtils.clamp(s.z, -worldHalf + 10, worldHalf - 10);
    s.groundY = terrainHeight(s.x, s.z);

    s.group.position.set(s.x, 0, s.z);
    s.warn.position.y = s.groundY + 0.35;
    s.cone.position.y = 55;
    s.cone.rotation.z = 0;
    s.tilt = (Math.random() - 0.5) * 0.25;
    s.phase = 'warn'; s.timer = 0; s.vy = 0;
    s.warnMat.opacity = 0;
    s.coneMat.opacity = 1;
    s.active = true;
    scene.add(s.group);
    stalactites.push(s);
    AudioSys.play('warn');
}

function returnStalactite(s) {
    scene.remove(s.group);
    s.active = false;
    stalactitePool.push(s);
}

function updateStalactites(dt) {
    stalactiteTimer -= dt;
    if (stalactiteTimer <= 0) {
        spawnStalactite();
        stalactiteTimer = 5 + Math.random() * 4;
    }

    for (let i = stalactites.length - 1; i >= 0; i--) {
        const s = stalactites[i];
        s.timer += dt;

        if (s.phase === 'warn') {
            const progress = s.timer / 0.9;
            const pulse = Math.sin(progress * Math.PI * 7) * 0.3 + 0.7;
            s.warnMat.opacity = (1 - progress) * 0.75 * pulse;
            s.warn.scale.setScalar(1 + progress * 1.2);
            if (progress >= 1) {
                s.phase = 'fall'; s.timer = 0;
                s.warnMat.opacity = 0;
            }
        } else if (s.phase === 'fall') {
            s.vy += 60 * dt;
            s.cone.position.y -= s.vy * dt;
            if (s.cone.position.y <= s.groundY + 2.25) {
                s.cone.position.y = s.groundY + 2.25;
                s.cone.rotation.z = s.tilt;
                // Impact: dust burst, thud, small shake, damage if close
                spawnParticles(new THREE.Vector3(s.x, s.groundY + 0.6, s.z), 0x9999aa);
                screenShake = Math.max(screenShake, 0.35);
                AudioSys.play('impact');
                const dx = batGroup.position.x - s.x;
                const dz = batGroup.position.z - s.z;
                if (Math.sqrt(dx*dx + dz*dz) < 2.2 && batGroup.position.y < s.groundY + 4) {
                    takeDamage();
                }
                s.phase = 'stuck'; s.timer = 0;
            }
        } else if (s.phase === 'stuck') {
            if (s.timer >= 1.0) { s.phase = 'fade'; s.timer = 0; }
        } else if (s.phase === 'fade') {
            s.coneMat.opacity = Math.max(0, 1 - s.timer / 0.5);
            if (s.timer >= 0.5) {
                returnStalactite(s);
                stalactites.splice(i, 1);
            }
        }
    }
}

// ===== Power-ups (shield / speed boost / magnet) =====
const powerups = [];
const POWERUP_KINDS = ['shield', 'speed', 'magnet'];
const powerupTypes = {
    shield: { color: 0x55aaff, emissive: 0x1144aa },
    speed:  { color: 0x00e5ff, emissive: 0x0088aa },
    magnet: { color: 0xff4fa3, emissive: 0xaa2277 }
};
const POWERUP_CORE_GEO = new THREE.OctahedronGeometry(0.42, 0);
const POWERUP_RING_GEO = new THREE.TorusGeometry(0.62, 0.045, 8, 32);
const POWERUP_DURATIONS = { shield: 12, speed: 7, magnet: 9 };
let powerupTimer = 6;
const activePowers = { shield: 0, speed: 0, magnet: 0 };

function spawnPowerup() {
    const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
    const spec = powerupTypes[kind];

    const group = new THREE.Group();
    const core = new THREE.Mesh(POWERUP_CORE_GEO, new THREE.MeshStandardMaterial({
        color: spec.color, emissive: spec.emissive, emissiveIntensity: 0.7,
        roughness: 0.25, metalness: 0.6, transparent: true, opacity: 0.95
    }));
    group.add(core);
    const ring = new THREE.Mesh(POWERUP_RING_GEO, new THREE.MeshBasicMaterial({
        color: spec.color, transparent: true, opacity: 0.45
    }));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    group.add(new THREE.PointLight(spec.color, 1.3, 12));

    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 35;
    const x = batGroup.position.x + Math.cos(angle) * dist;
    const z = batGroup.position.z + Math.sin(angle) * dist;
    const y = Math.max(terrainHeight(x, z) + 2, 2) + Math.random() * 10;

    group.position.set(
        THREE.MathUtils.clamp(x, -worldHalf + 5, worldHalf - 5),
        y,
        THREE.MathUtils.clamp(z, -worldHalf + 5, worldHalf - 5)
    );

    group.userData = {
        kind, core, ring,
        baseY: y, baseScale: 1, baseEmissive: 0.7,
        phase: Math.random() * Math.PI * 2,
        sonarTimer: 0, sonarPulse: -1
    };

    scene.add(group);
    powerups.push(group);
}

function disposePowerup(g) {
    const d = g.userData;
    if (d.core) d.core.material.dispose();
    if (d.ring) d.ring.material.dispose();
    scene.remove(g);
}

function activatePower(kind) {
    activePowers[kind] = POWERUP_DURATIONS[kind];
    AudioSys.play('powerup');
}

function updatePowerups(dt) {
    powerupTimer -= dt;
    if (powerupTimer <= 0 && powerups.length < 2) {
        spawnPowerup();
        powerupTimer = 11 + Math.random() * 6;
    }

    const batPos = batGroup.position;
    const magnetOn = activePowers.magnet > 0;
    const pullRadius = magnetOn ? 14 : 3.5;

    for (let i = powerups.length - 1; i >= 0; i--) {
        const g = powerups[i];
        const d = g.userData;

        d.phase += dt;
        g.position.y = d.baseY + Math.sin(d.phase) * 0.6;
        d.core.rotation.y += dt * 2.2;
        d.ring.rotation.z += dt * 1.4;

        // Sonar highlight decay
        if (d.sonarTimer > 0) {
            d.sonarTimer -= dt;
            const k = Math.max(0, d.sonarTimer) / 2.5;
            g.scale.setScalar(d.baseScale * (1 + 0.6 * k));
            d.core.material.emissiveIntensity = d.baseEmissive + 1.2 * k;
            if (d.sonarTimer <= 0) {
                g.scale.setScalar(d.baseScale);
                d.core.material.emissiveIntensity = d.baseEmissive;
            }
        }

        const dist = batPos.distanceTo(g.position);
        if (dist < pullRadius) {
            const pull = (pullRadius - dist) / pullRadius;
            g.position.lerp(batPos, pull * dt * (magnetOn ? 8 : 2));
        }

        if (dist < 1.3) {
            activatePower(d.kind);
            spawnParticles(g.position.clone(), powerupTypes[d.kind].color);
            disposePowerup(g);
            powerups.splice(i, 1);
        }
    }
}

// ===== Sonar Pulse =====
const sonar = { cooldown: 0, maxCooldown: 4, active: false, timer: 0, duration: 1.4, radiusMax: 60 };
let sonarPulseId = 0;
const sonarOrigin = new THREE.Vector3();
let sonarRadius = 0;

const sonarRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.0, 64),
    new THREE.MeshBasicMaterial({
        color: 0x7fe7ff, transparent: true, opacity: 0,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    })
);
sonarRing.rotation.x = -Math.PI / 2;
sonarRing.visible = false;
scene.add(sonarRing);

function fireSonar() {
    if (gameState !== 'playing' || sonar.cooldown > 0) return;
    sonar.cooldown = sonar.maxCooldown;
    sonar.active = true;
    sonar.timer = 0;
    sonarPulseId++;
    sonarOrigin.copy(batGroup.position);
    sonarRing.position.copy(sonarOrigin);
    sonarRing.visible = true;
    AudioSys.play('sonar');
}

function sonarPingObj(o) {
    const d = o.userData;
    if (d.sonarPulse === sonarPulseId) return;
    const dist = Math.sqrt(
        (o.position.x - sonarOrigin.x) ** 2 +
        (o.position.y - sonarOrigin.y) ** 2 +
        (o.position.z - sonarOrigin.z) ** 2
    );
    if (Math.abs(dist - sonarRadius) < 3) {
        d.sonarPulse = sonarPulseId;
        d.sonarTimer = 2.5;
    }
}

function updateSonar(dt) {
    if (sonar.cooldown > 0) sonar.cooldown = Math.max(0, sonar.cooldown - dt);

    if (sonar.active) {
        sonar.timer += dt;
        const p = sonar.timer / sonar.duration;
        if (p >= 1) {
            sonar.active = false;
            sonarRing.visible = false;
            sonarRadius = 0;
        } else {
            sonarRadius = p * sonar.radiusMax;
            sonarRing.scale.setScalar(Math.max(sonarRadius, 0.01));
            sonarRing.material.opacity = 0.55 * (1 - p);
            for (const c of collectables) sonarPingObj(c);
            for (const g of powerups) sonarPingObj(g);
        }
    }

    // HUD
    const fill = sonarFillEl, text = sonarTextEl;
    if (sonar.cooldown > 0) {
        fill.style.width = ((1 - sonar.cooldown / sonar.maxCooldown) * 100) + '%';
        text.textContent = sonar.cooldown.toFixed(1) + 's';
        sonarBadgeEl.classList.remove('ready');
    } else {
        fill.style.width = '100%';
        text.textContent = 'Ready';
        sonarBadgeEl.classList.add('ready');
    }
}

// ===== Game State =====
let gameState = 'menu';
let particlesEnabled = true;
let score = 0, highScore = 0;
try { highScore = parseInt(localStorage.getItem('batHighScore') || '0', 10) || 0; } catch (e) {}
let health = 3, combo = 0, comboTimer = 0;
let difficulty = 1;
let beamTimer = 0, nextBeamTime = 2.0;
let invincibleTimer = 0;
let screenShake = 0;

document.getElementById('highScoreVal').textContent = highScore;

// ===== CAMERA ROTATION STATE =====
let cameraYaw = 0, cameraPitch = 0;
const keyLookSpeed = 2.0; // radians per second

// ===== MOUSE LOOK STATE =====
let mouseLookEnabled = true;
let invertLook = false;
let invertSideMovement = false;
let mouseDeltaX = 0;
const mouseLookSpeed = 0.003; // radians per pixel

// ===== SCROLL STATE =====
let scrollVelocity = 0;
const scrollForce = 0.08;
const scrollDecay = 0.85;

// ===== Cached DOM =====
const el = id => document.getElementById(id);
const scoreValEl = el('scoreVal');
const sonarFillEl = el('sonarFill');
const sonarTextEl = el('sonarText');
const sonarBadgeEl = el('sonarBadge');
const sensSliderEl = el('sensSlider');
const vignetteEl = el('vignette');
const pauseOverlayEl = el('pauseOverlay');
const volSliderEl = el('volSlider');
const volValEl = el('volVal');
const sensValEl = el('sensVal');
const fogSliderEl = el('fogSlider');
const fogValEl = el('fogVal');

// ===== Input =====
const keys = {};
document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    keys[e.code] = true;
    if (e.code === 'Escape' && !e.repeat) {
        if (gameState === 'playing') setPause(true);
        else if (gameState === 'paused') setPause(false);
    }
    if (e.code === 'KeyF' && !e.repeat) fireSonar();
    if (e.code === 'Enter' && !e.repeat && gameState === 'menu') startGame();
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ===== MOUSE LOOK INPUT =====
document.addEventListener('mousemove', e => {
    if (gameState !== 'playing' || !mouseLookEnabled) return;
    mouseDeltaX += e.movementX;
});

// ===== SCROLL WHEEL FOR ALTITUDE =====
document.addEventListener('wheel', e => {
    if (gameState !== 'playing') return;
    e.preventDefault();
    // Scroll up (negative deltaY) = fly up
    // Scroll down (positive deltaY) = fly down
    scrollVelocity += e.deltaY > 0 ? -scrollForce : scrollForce;
    // Clamp max scroll impulse
    scrollVelocity = Math.max(-0.5, Math.min(0.5, scrollVelocity));
}, { passive: false });

// ===== TOUCH INPUT (v2.1 overhaul) =====
// Fixes vs v2.0:
//  - Tracks the steering touch by identifier, so the joystick keeps working
//    while other fingers hold the altitude / sonar buttons. v2.0 read
//    e.touches[0], which can be the *other* finger, killing steering mid-game.
//  - Floating centre: the pad recentres under the thumb wherever it lands.
//  - Real dead zone + full deflection at the ring edge.
//  - Output is SCREEN space (+x right, +y down); updateBat converts it with
//    the same camera-relative vectors as the keyboard. v2.0 added raw world
//    x/z, which moved the bat opposite to the thumb on screen.
const touchState = { x: 0, y: 0, up: false, down: false };
const joyZone = el('joyLeft');
const joyKnob = el('joyKnob');
const JOY_RADIUS = 55; // px of thumb travel for full speed
const JOY_DEAD = 9;    // px dead zone

let joyTouchId = null;
let joyCenter = null;         // floating centre = touch-down point
let joyBase = { x: 0, y: 0 }; // knob offset from ring centre at touch-down

function setKnob(dx, dy) {
    joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function joyStart(x, y) {
    const r = joyZone.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    joyBase = { x: THREE.MathUtils.clamp(x - cx, -32, 32), y: THREE.MathUtils.clamp(y - cy, -32, 32) };
    joyCenter = { x, y };
    setKnob(joyBase.x, joyBase.y);
}
function joyMove(x, y) {
    if (!joyCenter) return;
    const dx = x - joyCenter.x, dy = y - joyCenter.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < JOY_DEAD) {
        touchState.x = 0; touchState.y = 0;
        setKnob(joyBase.x, joyBase.y);
        return;
    }
    const mag = Math.min(len, JOY_RADIUS);
    const ux = dx / len, uy = dy / len;
    const k = (mag - JOY_DEAD) / (JOY_RADIUS - JOY_DEAD);
    touchState.x = ux * k;
    touchState.y = uy * k;
    setKnob(joyBase.x + ux * mag, joyBase.y + uy * mag);
}
function joyEnd() {
    joyTouchId = null; joyCenter = null;
    touchState.x = 0; touchState.y = 0;
    setKnob(0, 0);
}
joyZone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (joyTouchId !== null) return; // already steering with another finger
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    joyStart(t.clientX, t.clientY);
}, { passive: false });
joyZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) joyMove(t.clientX, t.clientY);
    }
}, { passive: false });
const joyFinish = e => {
    for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) joyEnd();
    }
};
joyZone.addEventListener('touchend', joyFinish);
joyZone.addEventListener('touchcancel', joyFinish);

// Drag-to-look: any empty screen area turns the camera (touch devices only).
// Drives yaw AND pitch; sensitivity + invert-look settings are respected.
const lookZone = el('lookZone');
let lookTouchId = null, lookLast = null;
lookZone.addEventListener('touchstart', e => {
    if (gameState !== 'playing') return;
    e.preventDefault();
    if (lookTouchId !== null) return;
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lookLast = { x: t.clientX, y: t.clientY };
}, { passive: false });
lookZone.addEventListener('touchmove', e => {
    if (lookTouchId === null || gameState !== 'playing') return;
    e.preventDefault();
    for (const t of e.changedTouches) {
        if (t.identifier !== lookTouchId) continue;
        const dx = t.clientX - lookLast.x, dy = t.clientY - lookLast.y;
        lookLast = { x: t.clientX, y: t.clientY };
        const k = 0.0042 * (settings.sensitivity / 100);
        const dir = invertLook ? -1 : 1;
        cameraYaw -= dx * k * dir;  // drag right = look right
        cameraPitch = THREE.MathUtils.clamp(cameraPitch + dy * k * dir, -0.5, 0.7); // drag up = look up
    }
}, { passive: false });
const lookFinish = e => {
    for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) { lookTouchId = null; lookLast = null; }
    }
};
lookZone.addEventListener('touchend', lookFinish);
lookZone.addEventListener('touchcancel', lookFinish);

// Altitude buttons (scoped cancels: v2.0 wiped the whole joystick on any cancel)
el('btnUp').addEventListener('touchstart', e => { e.preventDefault(); touchState.up = true; }, { passive: false });
el('btnUp').addEventListener('touchend', e => { e.preventDefault(); touchState.up = false; }, { passive: false });
el('btnUp').addEventListener('touchcancel', () => { touchState.up = false; });
el('btnDown').addEventListener('touchstart', e => { e.preventDefault(); touchState.down = true; }, { passive: false });
el('btnDown').addEventListener('touchend', e => { e.preventDefault(); touchState.down = false; }, { passive: false });
el('btnDown').addEventListener('touchcancel', () => { touchState.down = false; });
// Sonar button
el('btnSonar').addEventListener('touchstart', e => { e.preventDefault(); fireSonar(); }, { passive: false });
// Pause button (there was previously no way to pause on a phone)
const pauseBtnEl = el('btnPause');
pauseBtnEl.addEventListener('touchstart', e => { e.preventDefault(); if (gameState === 'playing') setPause(true); }, { passive: false });
pauseBtnEl.addEventListener('click', () => { if (gameState === 'playing') setPause(true); });

function releaseTouch() {
    touchState.x = 0; touchState.y = 0; touchState.up = false; touchState.down = false;
    joyTouchId = null; joyCenter = null; setKnob(0, 0);
    lookTouchId = null; lookLast = null;
}
function releaseAllInput() { for (const k in keys) keys[k] = false; releaseTouch(); mouseDeltaX = 0; }
function autoPause() {
    releaseAllInput();
    if (gameState === 'playing') setPause(true);
}
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

// Touch device detection (extra fallback on top of the CSS media query)
if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch');
}
// Suppress long-press context menu on the game surface
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

// ===== UI =====
function setScreen(id, show) {
    const node = document.getElementById(id);
    if (show) node.classList.add('show'); else node.classList.remove('show');
}

function clearWorld() {
    beams.forEach(b => returnBeam(b)); beams.length = 0;
    stalactites.forEach(s => returnStalactite(s)); stalactites.length = 0;
    powerups.forEach(g => disposePowerup(g)); powerups.length = 0;
    sonar.active = false; sonar.cooldown = 0; sonarRing.visible = false;
    activePowers.shield = 0; activePowers.speed = 0; activePowers.magnet = 0;
    shieldBubble.visible = false;
}

function startGame() {
    AudioSys.init();
    gameState = 'playing';
    score = 0; health = 3; combo = 0; difficulty = 1;
    beamTimer = 0; nextBeamTime = 2.5; invincibleTimer = 0; screenShake = 0;
    scrollVelocity = 0;
    cameraYaw = 0; cameraPitch = 0;
    batGroup.position.set(0, 5, 0);
    batGroup.rotation.set(0, 0, 0);
    velocity.set(0, 0, 0);
    clearWorld();
    collectables.forEach(c => scene.remove(c)); collectables.length = 0;
    for (let i = 0; i < 25; i++) spawnCollectable();
    powerupTimer = 6;
    stalactiteTimer = 8;
    updateHealthUI();
    updatePowerHud();
    scoreValEl.textContent = '0';
    setScreen('startScreen', false);
    setScreen('gameoverScreen', false);
    pauseOverlayEl.classList.remove('show');
}

function setPause(p) {
    if (p) {
        gameState = 'paused';
        pauseOverlayEl.classList.add('show');
        // Reset to main tab
        switchPauseTab('main');
    } else {
        gameState = 'playing';
        pauseOverlayEl.classList.remove('show');
    }
}

function switchPauseTab(tabName) {
    document.querySelectorAll('.pause-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.pause-panel').forEach(p => {
        p.classList.toggle('active', p.id === 'panel-' + tabName);
    });
}

// Pause tab navigation
document.querySelectorAll('.pause-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPauseTab(tab.dataset.tab));
});

// ===== Settings wiring (persisted) =====
const FOG_LABELS = ['Off', 'Low', 'Medium', 'High', 'Max'];
const FOG_DENSITIES = [0, 0.0015, 0.003, 0.005, 0.008];

function fogIndex(val) { return Math.min(4, Math.floor(val / 25)); }

volSliderEl.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    settings.volume = val;
    volValEl.textContent = val + '%';
    if (AudioSys.ctx && AudioSys.masterGain) AudioSys.masterGain.gain.value = val / 100;
    saveSettings();
});

sensSliderEl.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    settings.sensitivity = val;
    sensValEl.textContent = (val / 100).toFixed(1) + 'x';
    saveSettings();
});

fogSliderEl.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    settings.fog = val;
    fogValEl.textContent = FOG_LABELS[fogIndex(val)];
    scene.fog.density = FOG_DENSITIES[fogIndex(val)];
    saveSettings();
});

// Toggle switches
function setupToggle(id, callback) {
    const node = document.getElementById(id);
    node.addEventListener('click', () => {
        node.classList.toggle('on');
        if (callback) callback(node.classList.contains('on'));
    });
    return node;
}
function setToggleState(id, on) {
    document.getElementById(id).classList.toggle('on', on);
}

setupToggle('musicToggle', on => { settings.music = on; saveSettings(); MusicSys.setEnabled(on); });
setupToggle('sfxToggle', on => { settings.sfx = on; AudioSys.sfxEnabled = on; saveSettings(); });
setupToggle('particleToggle', on => { settings.particles = on; particlesEnabled = on; saveSettings(); });
setupToggle('mouseLookToggle', on => { settings.mouseLook = on; mouseLookEnabled = on; saveSettings(); });
setupToggle('invertLookToggle', on => { settings.invertLook = on; invertLook = on; saveSettings(); });
setupToggle('invertSideToggle', on => { settings.invertSide = on; invertSideMovement = on; saveSettings(); });

function applySettingsToUI() {
    volSliderEl.value = settings.volume;
    volValEl.textContent = settings.volume + '%';
    sensSliderEl.value = settings.sensitivity;
    sensValEl.textContent = (settings.sensitivity / 100).toFixed(1) + 'x';
    fogSliderEl.value = settings.fog;
    fogValEl.textContent = FOG_LABELS[fogIndex(settings.fog)];
    scene.fog.density = FOG_DENSITIES[fogIndex(settings.fog)];
    setToggleState('musicToggle', settings.music);
    setToggleState('sfxToggle', settings.sfx);
    setToggleState('particleToggle', settings.particles);
    setToggleState('mouseLookToggle', settings.mouseLook);
    setToggleState('invertLookToggle', settings.invertLook);
    setToggleState('invertSideToggle', settings.invertSide);
    particlesEnabled = settings.particles;
    mouseLookEnabled = settings.mouseLook;
    invertLook = settings.invertLook;
    invertSideMovement = settings.invertSide;
    AudioSys.sfxEnabled = settings.sfx;
    MusicSys.enabled = settings.music;
    if (AudioSys.ctx && AudioSys.masterGain) AudioSys.masterGain.gain.value = settings.volume / 100;
}
applySettingsToUI();

function gameOver() {
    gameState = 'gameover';
    pauseOverlayEl.classList.remove('show');
    AudioSys.play('gameover');
    if (score > highScore) {
        highScore = Math.floor(score);
        try { localStorage.setItem('batHighScore', highScore); } catch (e) {}
        document.getElementById('highScoreVal').textContent = highScore;
    }
    document.getElementById('finalScore').textContent = Math.floor(score);
    document.getElementById('finalBest').textContent = highScore;
    setScreen('gameoverScreen', true);
}

function takeDamage() {
    if (invincibleTimer > 0) return;
    // Shield absorbs one hit entirely
    if (activePowers.shield > 0) {
        activePowers.shield = 0;
        invincibleTimer = 1.0;
        screenShake = 0.3;
        AudioSys.play('shield');
        vignetteEl.classList.add('flash');
        setTimeout(() => vignetteEl.classList.remove('flash'), 200);
        return;
    }
    health--;
    invincibleTimer = 1.5;
    screenShake = 0.6;
    combo = 0; updateComboUI();
    updateHealthUI();
    AudioSys.play('damage');
    vignetteEl.classList.add('flash');
    setTimeout(() => vignetteEl.classList.remove('flash'), 200);
    if (health <= 0) gameOver();
}

function updateHealthUI() {
    document.querySelectorAll('.heart').forEach((h, i) => h.classList.toggle('lost', i >= health));
}

function updateComboUI() {
    const badge = document.getElementById('comboBadge');
    const val = document.getElementById('comboVal');
    if (combo > 1) { badge.classList.add('show'); val.textContent = combo; }
    else badge.classList.remove('show');
}

function updatePowerHud() {
    const specs = [
        ['shield', 'pwShield', 'pwShieldFill'],
        ['speed', 'pwSpeed', 'pwSpeedFill'],
        ['magnet', 'pwMagnet', 'pwMagnetFill']
    ];
    for (const [kind, badgeId, fillId] of specs) {
        const v = activePowers[kind];
        const badge = document.getElementById(badgeId);
        if (v > 0) {
            badge.classList.add('active');
            document.getElementById(fillId).style.width = (v / POWERUP_DURATIONS[kind] * 100) + '%';
        } else {
            badge.classList.remove('active');
        }
    }
}

// ===== Movement (WASD + SCROLL for altitude) =====
const velocity = new THREE.Vector3();
const speed = 0.16;
const maxSpeed = 0.32;
const friction = 0.88;

function updateBat(dt) {
    // Camera-relative axes. forward = where the camera looks;
    // right = SCREEN right = cross(forward, up) = (-cos yaw, 0, sin yaw).
    // (The old sin(yaw + PI/2) vector pointed screen-LEFT, so D moved left.)
    const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    const right = new THREE.Vector3(-Math.cos(cameraYaw), 0, Math.sin(cameraYaw));

    let fwdAxis = 0, sideAxis = 0;
    if (keys['KeyW'] || keys['ArrowUp']) fwdAxis += 1;
    if (keys['KeyS'] || keys['ArrowDown']) fwdAxis -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) sideAxis += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) sideAxis -= 1;

    // Analog joystick: already dead-zoned, SCREEN space (+x right, +y down).
    // Same camera-relative path as the keyboard, so the pad matches WASD.
    sideAxis += touchState.x;
    fwdAxis += -touchState.y;

    if (invertSideMovement) sideAxis = -sideAxis;

    const input = new THREE.Vector3()
        .addScaledVector(forward, fwdAxis)
        .addScaledVector(right, sideAxis);
    if (input.lengthSq() > 1) input.normalize();

    // Speed boost power-up multiplier
    const speedMult = activePowers.speed > 0 ? 1.5 : 1;
    const accel = speed * speedMult * dt * 60;
    velocity.x += input.x * accel;
    velocity.z += input.z * accel;

    // ===== SCROLL ALTITUDE =====
    // Apply scroll velocity with decay (dt-scaled so 120 Hz devices match 60 Hz)
    scrollVelocity *= Math.pow(scrollDecay, dt * 60);
    velocity.y += scrollVelocity * dt * 60;

    // Touch fallback for mobile
    if (keys['Space'] || touchState.up) velocity.y += accel * 0.7;
    if (keys['ShiftLeft'] || keys['ShiftRight'] || touchState.down) velocity.y -= accel * 0.7;

    // dt-scaled friction: identical movement feel at 60 / 90 / 120 Hz
    velocity.multiplyScalar(Math.pow(friction, dt * 60));

    const hSpeed = Math.sqrt(velocity.x**2 + velocity.z**2);
    const maxSpd = maxSpeed * speedMult;
    if (hSpeed > maxSpd) {
        const scale = maxSpd / hSpeed;
        velocity.x *= scale;
        velocity.z *= scale;
    }
    velocity.y = THREE.MathUtils.clamp(velocity.y, -maxSpeed * 0.5, maxSpeed * 0.5);

    batGroup.position.x += velocity.x;
    batGroup.position.z += velocity.z;
    batGroup.position.y += velocity.y;

    const groundH = terrainHeight(batGroup.position.x, batGroup.position.z);
    batGroup.position.y = Math.max(batGroup.position.y, groundH + 0.8);
    batGroup.position.y = Math.min(batGroup.position.y, 52);

    batGroup.position.x = THREE.MathUtils.clamp(batGroup.position.x, -worldHalf + 2, worldHalf - 2);
    batGroup.position.z = THREE.MathUtils.clamp(batGroup.position.z, -worldHalf + 2, worldHalf - 2);

    if (hSpeed > 0.01) {
        // FIX: the model's nose is -Z, so facing travel needs atan2(-x, -z).
        // The old atan2(x, z) made the bat visually fly backwards.
        const targetYaw = Math.atan2(-velocity.x, -velocity.z);
        let yawDiff = targetYaw - batGroup.rotation.y;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        batGroup.rotation.y += yawDiff * 0.12;
    }

    const bank = -velocity.x * 2.0;
    batGroup.rotation.z += (bank - batGroup.rotation.z) * 0.15;
    batGroup.rotation.x = velocity.y * 1.5;

    const flapSpeed = 10 + hSpeed * 15;
    const flapAmp = 0.5 + Math.min(hSpeed * 3, 0.5);
    const t = Date.now() * 0.001;
    const flap = Math.sin(t * flapSpeed) * flapAmp;
    leftWing.rotation.z = flap;
    rightWing.rotation.z = -flap;

    if (invincibleTimer > 0) {
        invincibleTimer -= dt;
        batGroup.visible = Math.floor(Date.now() / 100) % 2 === 0;
    } else {
        batGroup.visible = true;
    }

    // Shield bubble pulse
    shieldBubble.visible = activePowers.shield > 0;
    if (shieldBubble.visible) {
        shieldBubble.material.opacity = 0.13 + 0.06 * Math.sin(Date.now() * 0.004);
        shieldBubble.rotation.y += dt * 0.8;
    }
}

// ===== Beams =====
function updateBeams(dt) {
    beamTimer += dt;
    const spawnRate = Math.max(0.6, 2.2 - difficulty * 0.1);
    if (beamTimer > nextBeamTime && beams.length < MAX_BEAMS) {
        spawnBeam();
        nextBeamTime = spawnRate * (0.7 + Math.random() * 0.6);
        beamTimer = 0;
    }

    for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.timer += dt;

        if (b.phase === 'warn') {
            const progress = b.timer / 1.0;
            const pulse = Math.sin(progress * Math.PI * 8) * 0.3 + 0.7;
            b.warn.material.opacity = (1 - progress) * 0.7 * pulse;
            b.warn.scale.setScalar(1 + progress * 1.5);
            if (progress >= 1) {
                b.phase = 'active'; b.timer = 0; b.warn.material.opacity = 0;
            }
        } else if (b.phase === 'active') {
            const progress = b.timer / b.maxLife; // FIX: per-beam fixed lifetime
            if (progress >= 1) { b.phase = 'fade'; b.timer = 0; continue; }

            let intensity = 1;
            if (progress < 0.15) intensity = progress / 0.15;
            else if (progress > 0.75) intensity = 1 - (progress - 0.75) / 0.25;

            b.shaft.material.opacity = 0.18 * intensity;
            b.spot.intensity = 140 * intensity;
            b.glow.material.opacity = 0.5 * intensity;

            // Seeker beams drift toward the bat while active
            if (b.seeker) {
                const dxs = batGroup.position.x - b.x;
                const dzs = batGroup.position.z - b.z;
                const dl = Math.sqrt(dxs*dxs + dzs*dzs);
                if (dl > 0.5) {
                    const step = Math.min(SEEKER_SPEED * dt, dl);
                    b.x += (dxs / dl) * step;
                    b.z += (dzs / dl) * step;
                }
                b.x = THREE.MathUtils.clamp(b.x, -worldHalf + 10, worldHalf - 10);
                b.z = THREE.MathUtils.clamp(b.z, -worldHalf + 10, worldHalf - 10);
            }

            const sway = Math.sin(Date.now() * 0.0015 + b.swayOffset) * 0.25;
            b.group.position.x = b.x + sway;
            b.spot.position.x = sway;
            b.glow.position.x = b.x + sway;

            if (intensity > 0.4) {
                const actualX = b.x + sway;
                const dx = batGroup.position.x - actualX;
                const dz = batGroup.position.z - b.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                const heightFactor = (55 - batGroup.position.y) / 55;
                const radius = heightFactor * (b.seeker ? 2.4 : 3.0);
                if (dist < radius && batGroup.position.y < 54) {
                    takeDamage();
                }
            }
        } else if (b.phase === 'fade') {
            const progress = b.timer / 0.4;
            const fade = 1 - progress;
            b.shaft.material.opacity = 0.18 * fade;
            b.spot.intensity = 140 * fade;
            b.glow.material.opacity = 0.5 * fade;
            if (progress >= 1) {
                returnBeam(b);
                beams.splice(i, 1);
            }
        }
    }
}

// ===== Collectables =====
function updateCollectables(dt) {
    const batPos = batGroup.position;
    const magnetOn = activePowers.magnet > 0;
    const pullRadius = magnetOn ? 14 : 3.5;

    for (let i = collectables.length - 1; i >= 0; i--) {
        const c = collectables[i];
        const d = c.userData;

        d.phase += dt * d.bobSpeed;
        c.position.y = d.baseY + Math.sin(d.phase) * 0.5;
        c.rotation.y += dt * d.rotSpeed;
        c.rotation.x += dt * d.rotSpeed * 0.5;

        // Sonar highlight decay
        if (d.sonarTimer > 0) {
            d.sonarTimer -= dt;
            const k = Math.max(0, d.sonarTimer) / 2.5;
            c.scale.setScalar(d.baseScale * (1 + 0.6 * k));
            c.material.emissiveIntensity = d.baseEmissive + 1.2 * k;
            if (d.sonarTimer <= 0) {
                c.scale.setScalar(d.baseScale);
                c.material.emissiveIntensity = d.baseEmissive;
            }
        }

        const dist = batPos.distanceTo(c.position);
        if (dist < pullRadius) {
            const pull = (pullRadius - dist) / pullRadius;
            c.position.lerp(batPos, pull * dt * (magnetOn ? 8 : 2));
        }

        if (dist < 1.0) {
            score += d.value + combo * 3;
            combo++; comboTimer = 3;
            updateComboUI();
            spawnParticles(c.position.clone(), c.material.color);
            AudioSys.play(d.value >= 40 ? 'collect_rare' : 'collect');
            c.material.dispose(); // FIX: free GPU material on collect
            scene.remove(c);
            collectables.splice(i, 1);
        }
    }
    if (collectables.length < 25) spawnCollectable();
}

// ===== Particles =====
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const positions = p.mesh.geometry.attributes.position.array;
        let alive = false;
        for (let j = 0; j < p.velocities.length; j++) {
            const v = p.velocities[j];
            v.life -= 0.02;
            if (v.life > 0) {
                positions[j*3] += v.x;
                positions[j*3+1] += v.y;
                positions[j*3+2] += v.z;
                alive = true;
            }
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        p.mesh.material.opacity = Math.max(0, p.velocities[0]?.life || 0);
        if (!alive) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose(); // FIX: free GPU resources
            p.mesh.material.dispose();
            particles.splice(i, 1);
        }
    }
}

// ===== Camera =====
const camDistance = 11;
const camHeight = 4;

function updateCamera(dt) {
    // Key-based camera rotation (Q/E for yaw; arrow keys are movement only)
    if (gameState === 'playing') {
        if (keys['KeyQ']) cameraYaw += keyLookSpeed * dt; // look left
        if (keys['KeyE']) cameraYaw -= keyLookSpeed * dt; // look right

        // Mouse look camera rotation (FIX: mouse right now turns the view right)
        if (mouseLookEnabled && Math.abs(mouseDeltaX) > 0) {
            const sensMultiplier = settings.sensitivity / 100; // no DOM read per frame
            const dir = invertLook ? -1 : 1;
            cameraYaw -= mouseDeltaX * mouseLookSpeed * sensMultiplier * dir;
            mouseDeltaX = 0; // consume the delta
        }
    }

    // Pull the camera back on narrow (portrait) screens so the bat doesn't
    // block the view; standard desktop aspects keep the original distance.
    const effDist = camDistance * Math.max(1, Math.sqrt(1.7 / camera.aspect));

    const sinYaw = Math.sin(cameraYaw);
    const cosYaw = Math.cos(cameraYaw);
    const sinPitch = Math.sin(cameraPitch);
    const cosPitch = Math.cos(cameraPitch);

    const offsetX = sinYaw * cosPitch * effDist;
    const offsetY = sinPitch * effDist + camHeight;
    const offsetZ = cosYaw * cosPitch * effDist;

    let targetPos = new THREE.Vector3(
        batGroup.position.x - offsetX,
        batGroup.position.y + offsetY,
        batGroup.position.z - offsetZ
    );

    if (screenShake > 0) {
        targetPos.x += (Math.random() - 0.5) * screenShake;
        targetPos.y += (Math.random() - 0.5) * screenShake;
        targetPos.z += (Math.random() - 0.5) * screenShake;
        screenShake *= 0.85;
        if (screenShake < 0.01) screenShake = 0;
    }

    camera.position.lerp(targetPos, 0.1);
    const lookTarget = batGroup.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    camera.lookAt(lookTarget);
}

// ===== Main Loop =====
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (gameState === 'playing') {
        updateBat(dt);
        updateBeams(dt);
        updateStalactites(dt);
        updatePowerups(dt);
        updateSonar(dt);
        updateCollectables(dt);
        updateParticles();
        updateCamera(dt);
        dustSystem.rotation.y += 0.0002;

        // Power-up timers
        for (const k in activePowers) {
            if (activePowers[k] > 0) activePowers[k] = Math.max(0, activePowers[k] - dt);
        }
        updatePowerHud();

        score += dt * (1 + difficulty * 0.2);
        scoreValEl.textContent = Math.floor(score);
        difficulty = 1 + score / 120;

        if (combo > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) { combo = 0; updateComboUI(); }
        }
    } else if (gameState === 'menu') {
        batGroup.position.y = 5 + Math.sin(Date.now() * 0.001) * 0.3;
        leftWing.rotation.z = Math.sin(Date.now() * 0.008) * 0.4;
        rightWing.rotation.z = -Math.sin(Date.now() * 0.008) * 0.4;
        dustSystem.rotation.y += 0.0002;
        camera.position.lerp(new THREE.Vector3(0, 8, 16), 0.02);
        camera.lookAt(0, 3, 0);
    }

    renderer.render(scene, camera);
}

// ===== Events =====
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
// Tap / click anywhere on the start screen to begin
document.getElementById('startScreen').addEventListener('click', () => {
    if (gameState === 'menu') startGame();
});
document.getElementById('menuBtn').addEventListener('click', () => {
    setScreen('gameoverScreen', false);
    setScreen('startScreen', true);
    pauseOverlayEl.classList.remove('show');
    clearWorld();
    gameState = 'menu';
});
document.getElementById('resumeBtn').addEventListener('click', () => setPause(false));
document.getElementById('quitBtn').addEventListener('click', () => {
    setPause(false);
    setScreen('startScreen', true);
    clearWorld();
    gameState = 'menu';
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== Debug / test hook (harmless, used for automated checks) =====
window.__BAT = {
    get state() { return gameState; },
    get score() { return Math.floor(score); },
    get health() { return health; },
    get sonarCooldown() { return sonar.cooldown; },
    get powers() { return { ...activePowers }; },
    get settings() { return { ...settings }; },
    get counts() { return { collectables: collectables.length, powerups: powerups.length, beams: beams.length, stalactites: stalactites.length }; },
    get pos() { return batGroup.position.clone(); },
    get camPos() { return camera.position.clone(); },
    get yaw() { return cameraYaw; },
    get pitch() { return cameraPitch; },
    get touch() { return { x: touchState.x, y: touchState.y, up: touchState.up, down: touchState.down }; },
    setYaw(v) { cameraYaw = v; },
    // Deterministic test helper: advance movement/camera without rAF
    step(dt) { if (gameState === 'playing') { updateBat(dt); updateCamera(dt); } },
    fireSonar,
    startGame
};

animate();
