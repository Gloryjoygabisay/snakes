import * as THREE from 'three';

export interface ThreeGameState {
  snakeHeads: Array<{ x: number; y: number; color: number }>;
  foodPositions: Array<{ x: number; y: number }>;
  exitZone: { x: number; y: number } | null;
  elapsed: number;
}

export interface ThreeEffects {
  update(state: ThreeGameState): void;
  destroy(): void;
  triggerEvent(type: 'food' | 'death' | 'win', x: number, y: number): void;
}

const W = 640;
const H = 480;

function toThree(px: number, py: number): [number, number] {
  return [px, H - py];
}

interface ParticleBurst {
  points: THREE.Points;
  velocities: Float32Array;
  lifetime: number;
  maxLifetime: number;
}

export function createThreeEffects(container: HTMLElement, _width: number, _height: number): ThreeEffects {
  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '10';
  container.style.position = 'relative';
  container.appendChild(canvas);

  // ── Scene & camera ────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, W, 0, H, -500, 500);
  scene.add(new THREE.AmbientLight(0x111111));

  // ── Ambient floating particles ────────────────────────────────────────────
  const PARTICLE_COUNT = 80;
  const ambientGeo = new THREE.BufferGeometry();
  const ambientPos = new Float32Array(PARTICLE_COUNT * 3);
  const ambientColors = new Float32Array(PARTICLE_COUNT * 3);
  const ambientSpeeds = new Float32Array(PARTICLE_COUNT);

  const palette = [
    new THREE.Color(0x1a5c3a),
    new THREE.Color(0x0d4d3a),
    new THREE.Color(0x3d3010),
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    ambientPos[i * 3]     = Math.random() * W;
    ambientPos[i * 3 + 1] = Math.random() * H;
    ambientPos[i * 3 + 2] = 0;
    ambientSpeeds[i] = 0.1 + Math.random() * 0.25;
    const c = palette[Math.floor(Math.random() * palette.length)];
    ambientColors[i * 3]     = c.r;
    ambientColors[i * 3 + 1] = c.g;
    ambientColors[i * 3 + 2] = c.b;
  }

  ambientGeo.setAttribute('position', new THREE.BufferAttribute(ambientPos, 3));
  ambientGeo.setAttribute('color',    new THREE.BufferAttribute(ambientColors, 3));

  const ambientMat = new THREE.PointsMaterial({ size: 2, vertexColors: true, transparent: true, opacity: 0.6 });
  const ambientPoints = new THREE.Points(ambientGeo, ambientMat);
  scene.add(ambientPoints);

  // ── Snake head glow ───────────────────────────────────────────────────────
  const MAX_SNAKES = 8;
  const snakeLights: THREE.PointLight[] = [];
  const snakeGlows: THREE.Mesh[] = [];
  const glowGeo = new THREE.SphereGeometry(4, 8, 8);

  for (let i = 0; i < MAX_SNAKES; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 80);
    light.visible = false;
    scene.add(light);
    snakeLights.push(light);

    const mesh = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    mesh.visible = false;
    scene.add(mesh);
    snakeGlows.push(mesh);
  }

  // ── Food torus rings ──────────────────────────────────────────────────────
  const MAX_FOOD = 32;
  const foodTori: THREE.Mesh[] = [];
  const torusGeo = new THREE.TorusGeometry(5, 1.2, 8, 24);

  for (let i = 0; i < MAX_FOOD; i++) {
    const mesh = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0 }));
    mesh.visible = false;
    scene.add(mesh);
    foodTori.push(mesh);
  }

  // ── Exit portal ───────────────────────────────────────────────────────────
  const portalRings: THREE.Mesh[] = [];
  const portalRadii = [8, 12, 16];
  const portalSpeeds = [0.02, -0.015, 0.01];

  for (const r of portalRadii) {
    const geo = new THREE.TorusGeometry(r, 1.5, 8, 24);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8 }));
    mesh.visible = false;
    scene.add(mesh);
    portalRings.push(mesh);
  }

  const portalLight = new THREE.PointLight(0x00ff88, 0, 100);
  portalLight.visible = false;
  scene.add(portalLight);

  const columnGeo = new THREE.CylinderGeometry(1.5, 1.5, 40, 8);
  const columnMesh = new THREE.Mesh(columnGeo, new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.4 }));
  columnMesh.visible = false;
  scene.add(columnMesh);

  // ── Particle bursts ───────────────────────────────────────────────────────
  const bursts: ParticleBurst[] = [];

  function triggerEvent(type: 'food' | 'death' | 'win', x: number, y: number): void {
    const [tx, ty] = toThree(x, y);

    let count: number;
    let maxLifetime: number;
    let colors: number[][];
    let spread: number;

    if (type === 'food') {
      count = 20; maxLifetime = 500; spread = 40;
      colors = [[1.0, 0.9, 0.1], [1.0, 0.7, 0.0], [0.9, 1.0, 0.3]];
    } else if (type === 'death') {
      count = 40; maxLifetime = 800; spread = 80;
      colors = [[1.0, 0.1, 0.1], [1.0, 0.4, 0.0], [0.8, 0.0, 0.0]];
    } else {
      count = 60; maxLifetime = 1200; spread = 300;
      colors = [
        [1,0,0],[1,0.5,0],[1,1,0],[0,1,0],[0,0.5,1],[0.5,0,1],[1,0,0.5]
      ];
    }

    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const vertColors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = tx;
      positions[i * 3 + 1] = ty;
      positions[i * 3 + 2] = 1;

      const angle = Math.random() * Math.PI * 2;
      const speed = (0.3 + Math.random() * 0.7) * (spread / 80);
      velocities[i * 3]     = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = Math.sin(angle) * speed + (type === 'win' ? 0.4 : 0);
      velocities[i * 3 + 2] = 0;

      const c = colors[Math.floor(Math.random() * colors.length)];
      vertColors[i * 3]     = c[0];
      vertColors[i * 3 + 1] = c[1];
      vertColors[i * 3 + 2] = c[2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(vertColors, 3));

    const mat = new THREE.PointsMaterial({ size: 4, vertexColors: true, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    bursts.push({ points, velocities, lifetime: maxLifetime, maxLifetime });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(state: ThreeGameState): void {
    const elapsed = state.elapsed;

    // Ambient particles float upward
    const posAttr = ambientGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      posAttr.array[i * 3 + 1] = (posAttr.array[i * 3 + 1] as number) + ambientSpeeds[i];
      if ((posAttr.array[i * 3 + 1] as number) > H) {
        posAttr.array[i * 3 + 1] = 0;
        posAttr.array[i * 3]     = Math.random() * W;
      }
    }
    posAttr.needsUpdate = true;

    // Snake head glows
    for (let i = 0; i < MAX_SNAKES; i++) {
      if (i < state.snakeHeads.length) {
        const s = state.snakeHeads[i];
        const [tx, ty] = toThree(s.x, s.y);
        const intensity = Math.sin(elapsed * 0.003) * 0.5 + 1.5;
        const color = new THREE.Color(s.color);

        snakeLights[i].position.set(tx, ty, 10);
        snakeLights[i].color = color;
        snakeLights[i].intensity = intensity;
        snakeLights[i].visible = true;

        const mat = snakeGlows[i].material as THREE.MeshBasicMaterial;
        mat.color = color;
        mat.opacity = 0.7;
        snakeGlows[i].position.set(tx, ty, 1);
        snakeGlows[i].visible = true;
      } else {
        snakeLights[i].visible = false;
        snakeGlows[i].visible = false;
      }
    }

    // Food torus rings
    for (let i = 0; i < MAX_FOOD; i++) {
      if (i < state.foodPositions.length) {
        const f = state.foodPositions[i];
        const [tx, ty] = toThree(f.x, f.y);
        const scale = 0.8 + Math.sin(elapsed * 0.004 + i) * 0.2;

        foodTori[i].position.set(tx, ty, 1);
        foodTori[i].rotation.y += 0.04;
        foodTori[i].scale.set(scale, scale, scale);
        const mat = foodTori[i].material as THREE.MeshBasicMaterial;
        mat.opacity = 0.85;
        foodTori[i].visible = true;
      } else {
        foodTori[i].visible = false;
      }
    }

    // Exit portal
    if (state.exitZone) {
      const [tx, ty] = toThree(state.exitZone.x, state.exitZone.y);
      for (let i = 0; i < portalRings.length; i++) {
        portalRings[i].position.set(tx, ty, 1);
        portalRings[i].rotation.y += portalSpeeds[i];
        portalRings[i].rotation.x += portalSpeeds[i] * 0.7;
        portalRings[i].visible = true;
      }
      const pulseIntensity = Math.sin(elapsed * 0.005) * 0.8 + 1.5;
      portalLight.position.set(tx, ty, 20);
      portalLight.intensity = pulseIntensity;
      portalLight.visible = true;

      columnMesh.position.set(tx, ty, 1);
      columnMesh.visible = true;
    } else {
      for (const ring of portalRings) ring.visible = false;
      portalLight.visible = false;
      columnMesh.visible = false;
    }

    // Particle bursts
    for (let b = bursts.length - 1; b >= 0; b--) {
      const burst = bursts[b];
      burst.lifetime -= 16;

      if (burst.lifetime <= 0) {
        scene.remove(burst.points);
        burst.points.geometry.dispose();
        (burst.points.material as THREE.Material).dispose();
        bursts.splice(b, 1);
        continue;
      }

      const t = burst.lifetime / burst.maxLifetime;
      const geo = burst.points.geometry;
      const posArr = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < posArr.length / 3; i++) {
        posArr[i * 3]     += burst.velocities[i * 3];
        posArr[i * 3 + 1] += burst.velocities[i * 3 + 1];
      }
      geo.attributes.position.needsUpdate = true;
      (burst.points.material as THREE.PointsMaterial).opacity = t;
    }

    renderer.render(scene, camera);
  }

  // ── Destroy ───────────────────────────────────────────────────────────────
  function destroy(): void {
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    for (const burst of bursts) {
      burst.points.geometry.dispose();
      (burst.points.material as THREE.Material).dispose();
    }
    bursts.length = 0;
  }

  return { update, destroy, triggerEvent };
}
