
        import * as THREE from 'three';

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
                this.masterGain.gain.value = 0.8;
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
                phase: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 2,
                bobSpeed: 1 + Math.random(), active: true
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

            return { group, warn, shaft, spot, glow, active: false, phase: 'warn', timer: 0, x: 0, z: 0, swayOffset: 0 };
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
        let mouseAccumX = 0;
        const mouseLookSpeed = 0.003; // radians per pixel

        // ===== SCROLL STATE =====
        let scrollVelocity = 0;
        const scrollForce = 0.08;
        const scrollDecay = 0.85;

        // ===== Input =====
        const keys = {};
        document.addEventListener('keydown', e => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            keys[e.code] = true;
            if (e.code === 'Escape' && !e.repeat) {
                if (gameState === 'playing') setPause(true);
                else if (gameState === 'paused') setPause(false);
            }
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

        const touchState = { x: 0, y: 0, up: false, down: false };
        const joyZone = document.getElementById('joyLeft');
        let joyCenter = null;
        joyZone.addEventListener('touchstart', e => {
            e.preventDefault(); const t = e.touches[0];
            const r = joyZone.getBoundingClientRect();
            joyCenter = { x: r.left + r.width/2, y: r.top + r.height/2 };
        }, {passive:false});
        joyZone.addEventListener('touchmove', e => {
            e.preventDefault(); if (!joyCenter) return;
            const t = e.touches[0];
            touchState.x = Math.max(-1, Math.min(1, (t.clientX - joyCenter.x) / 50));
            touchState.y = Math.max(-1, Math.min(1, (t.clientY - joyCenter.y) / 50));
        }, {passive:false});
        joyZone.addEventListener('touchend', e => { e.preventDefault(); touchState.x = 0; touchState.y = 0; joyCenter = null; }, {passive:false});
        const releaseTouch = () => { touchState.x = 0; touchState.y = 0; touchState.up = false; touchState.down = false; joyCenter = null; };
        joyZone.addEventListener('touchcancel', releaseTouch);
        document.getElementById('btnUp').addEventListener('touchcancel', releaseTouch);
        document.getElementById('btnDown').addEventListener('touchcancel', releaseTouch);
        function releaseAllInput() { for (const k in keys) keys[k] = false; releaseTouch(); mouseDeltaX = 0; }
        function autoPause() {
            releaseAllInput();
            if (gameState === 'playing') setPause(true);
        }
        window.addEventListener('blur', autoPause);
        document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
        document.getElementById('btnUp').addEventListener('touchstart', e => { e.preventDefault(); touchState.up = true; });
        document.getElementById('btnUp').addEventListener('touchend', e => { e.preventDefault(); touchState.up = false; });
        document.getElementById('btnDown').addEventListener('touchstart', e => { e.preventDefault(); touchState.down = true; });
        document.getElementById('btnDown').addEventListener('touchend', e => { e.preventDefault(); touchState.down = false; });

        // ===== UI =====
        function setScreen(id, show) {
            const el = document.getElementById(id);
            if (show) el.classList.add('show'); else el.classList.remove('show');
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
            beams.forEach(b => returnBeam(b)); beams.length = 0;
            collectables.forEach(c => scene.remove(c)); collectables.length = 0;
            for (let i = 0; i < 25; i++) spawnCollectable();
            updateHealthUI();
            document.getElementById('scoreVal').textContent = '0';
            setScreen('startScreen', false);
            setScreen('gameoverScreen', false);
            document.getElementById('pauseOverlay').classList.remove('show');
        }

        function setPause(p) {
            const overlay = document.getElementById('pauseOverlay');
            if (p) {
                gameState = 'paused';
                overlay.classList.add('show');
                // Reset to main tab
                switchPauseTab('main');
            } else {
                gameState = 'playing';
                overlay.classList.remove('show');
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

        // Settings: Volume slider
        document.getElementById('volSlider').addEventListener('input', e => {
            const val = e.target.value;
            document.getElementById('volVal').textContent = val + '%';
            if (AudioSys.ctx && AudioSys.masterGain) {
                AudioSys.masterGain.gain.value = val / 100;
            }
        });

        // Settings: Sensitivity slider
        document.getElementById('sensSlider').addEventListener('input', e => {
            const val = e.target.value;
            document.getElementById('sensVal').textContent = (val / 100).toFixed(1) + 'x';
        });

        // Settings: Fog slider
        document.getElementById('fogSlider').addEventListener('input', e => {
            const val = parseInt(e.target.value);
            const labels = ['Off', 'Low', 'Medium', 'High', 'Max'];
            const idx = Math.min(4, Math.floor(val / 25));
            document.getElementById('fogVal').textContent = labels[idx];
            const densityMap = [0, 0.0015, 0.003, 0.005, 0.008];
            scene.fog.density = densityMap[idx];
        });

        // Toggle switches
        function setupToggle(id, callback) {
            const el = document.getElementById(id);
            el.addEventListener('click', () => {
                el.classList.toggle('on');
                if (callback) callback(el.classList.contains('on'));
            });
        }
        setupToggle('musicToggle', on => { /* music toggle */ });
        setupToggle('sfxToggle', on => { AudioSys.sfxEnabled = on; });
        setupToggle('particleToggle', on => { particlesEnabled = on; });
        setupToggle('mouseLookToggle', on => { mouseLookEnabled = on; });
        setupToggle('invertLookToggle', on => { invertLook = on; });
        setupToggle('invertSideToggle', on => { invertSideMovement = on; });

        function gameOver() {
            gameState = 'gameover';
            document.getElementById('pauseOverlay').classList.remove('show');
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
            health--;
            invincibleTimer = 1.5;
            screenShake = 0.6;
            combo = 0; updateComboUI();
            updateHealthUI();
            AudioSys.play('damage');
            document.getElementById('vignette').classList.add('flash');
            setTimeout(() => document.getElementById('vignette').classList.remove('flash'), 200);
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

        // ===== Movement (WASD + SCROLL for altitude) =====
        const velocity = new THREE.Vector3();
        const speed = 0.16;
        const maxSpeed = 0.32;
        const friction = 0.88;

        function updateBat(dt) {
            const forward = new THREE.Vector3();
            const right = new THREE.Vector3();
            
            forward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
            right.set(Math.sin(cameraYaw + Math.PI/2), 0, Math.cos(cameraYaw + Math.PI/2));

            const input = new THREE.Vector3();
            if (keys['KeyW'] || keys['ArrowUp']) input.add(forward);
            if (keys['KeyS'] || keys['ArrowDown']) input.sub(forward);
            if (invertSideMovement) {
                if (keys['KeyA'] || keys['ArrowLeft']) input.add(right);
                if (keys['KeyD'] || keys['ArrowRight']) input.sub(right);
            } else {
                if (keys['KeyA'] || keys['ArrowLeft']) input.sub(right);
                if (keys['KeyD'] || keys['ArrowRight']) input.add(right);
            }

            if (Math.abs(touchState.x) > 0.1 || Math.abs(touchState.y) > 0.1) {
                input.x += touchState.x;
                input.z += touchState.y;
            }

            if (input.length() > 1) input.normalize();

            const accel = speed * dt * 60;
            velocity.x += input.x * accel;
            velocity.z += input.z * accel;

            // ===== SCROLL ALTITUDE =====
            // Apply scroll velocity with decay
            scrollVelocity *= scrollDecay;
            velocity.y += scrollVelocity * dt * 60;

            // Touch fallback for mobile
            if (keys['Space'] || touchState.up) velocity.y += accel * 0.7;
            if (keys['ShiftLeft'] || keys['ShiftRight'] || touchState.down) velocity.y -= accel * 0.7;

            velocity.multiplyScalar(friction);

            const hSpeed = Math.sqrt(velocity.x**2 + velocity.z**2);
            if (hSpeed > maxSpeed) {
                const scale = maxSpeed / hSpeed;
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
                const targetYaw = Math.atan2(velocity.x, velocity.z);
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
                    const maxLife = 2.0 + Math.random() * 1.5;
                    const progress = b.timer / maxLife;
                    if (progress >= 1) { b.phase = 'fade'; b.timer = 0; continue; }

                    let intensity = 1;
                    if (progress < 0.15) intensity = progress / 0.15;
                    else if (progress > 0.75) intensity = 1 - (progress - 0.75) / 0.25;

                    b.shaft.material.opacity = 0.18 * intensity;
                    b.spot.intensity = 140 * intensity;
                    b.glow.material.opacity = 0.5 * intensity;

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
                        const radius = heightFactor * 3.0;
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
            for (let i = collectables.length - 1; i >= 0; i--) {
                const c = collectables[i];
                const d = c.userData;

                d.phase += dt * d.bobSpeed;
                c.position.y = d.baseY + Math.sin(d.phase) * 0.5;
                c.rotation.y += dt * d.rotSpeed;
                c.rotation.x += dt * d.rotSpeed * 0.5;

                const dist = batPos.distanceTo(c.position);
                if (dist < 3.5) {
                    const pull = (3.5 - dist) / 3.5;
                    c.position.lerp(batPos, pull * dt * 2);
                }

                if (dist < 1.0) {
                    score += d.value + combo * 3;
                    combo++; comboTimer = 3;
                    updateComboUI();
                    spawnParticles(c.position.clone(), c.material.color);
                    AudioSys.play(d.value >= 40 ? 'collect_rare' : 'collect');
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
                    particles.splice(i, 1);
                }
            }
        }

        // ===== Camera =====
        const camDistance = 11;
        const camHeight = 4;

        function updateCamera(dt) {
            // Key-based camera rotation (Q/E or Arrow Left/Right for yaw)
            if (gameState === 'playing') {
                if (keys['KeyQ'] || keys['ArrowLeft']) cameraYaw -= keyLookSpeed * dt;
                if (keys['KeyE'] || keys['ArrowRight']) cameraYaw += keyLookSpeed * dt;

                // Mouse look camera rotation
                if (mouseLookEnabled && Math.abs(mouseDeltaX) > 0) {
                    const sensMultiplier = parseInt(document.getElementById('sensSlider').value) / 100;
                    const dir = invertLook ? -1 : 1;
                    cameraYaw += mouseDeltaX * mouseLookSpeed * sensMultiplier * dir;
                    mouseDeltaX = 0; // consume the delta
                }
            }

            const sinYaw = Math.sin(cameraYaw);
            const cosYaw = Math.cos(cameraYaw);
            const sinPitch = Math.sin(cameraPitch);
            const cosPitch = Math.cos(cameraPitch);

            const offsetX = sinYaw * cosPitch * camDistance;
            const offsetY = sinPitch * camDistance + camHeight;
            const offsetZ = cosYaw * cosPitch * camDistance;

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
                updateCollectables(dt);
                updateParticles();
                updateCamera(dt);
                dustSystem.rotation.y += 0.0002;

                score += dt * (1 + difficulty * 0.2);
                document.getElementById('scoreVal').textContent = Math.floor(score);
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
        document.getElementById('menuBtn').addEventListener('click', () => {
            setScreen('gameoverScreen', false);
            setScreen('startScreen', true);
            document.getElementById('pauseOverlay').classList.remove('show');
            gameState = 'menu';
        });
        document.getElementById('resumeBtn').addEventListener('click', () => setPause(false));
        document.getElementById('quitBtn').addEventListener('click', () => {
            setPause(false);
            setScreen('startScreen', true);
            gameState = 'menu';
        });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();
    
