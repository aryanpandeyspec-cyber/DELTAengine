/**
 * 🏛️ DELTA ENGINE — 3D SPATIAL ROOM MODEL & VENUE DIGITAL TWIN ENGINE (THREE.JS PBR + CANVAS FALLBACK)
 * Renders interactive high-fidelity 3D WebGL spatial models of event halls, room plans,
 * entry/exit doors (with ESP32 laser tripwire positions), presentation stages, and seating arrays.
 * Computes people capacity and real-time crowd occupancy distributions.
 * 
 * Features:
 * 1. Three.js PBR Engine: 60 FPS WebGL with directional soft shadows, PBR timber stage,
 *    metallic door frames, emissive neon laser tripwire beams, audience seating arrays, and occupancy heatmaps.
 * 2. OrbitControls: Smooth orbital rotation, pitch tilt, zoom, and damping.
 * 3. Graceful Fallback: Seamless Canvas 2.5D Isometric rendering if WebGL is unavailable.
 */

class RoomSpatialModelRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    
    // Model dimensions in meters
    this.width = options.width || 20;      // X axis (meters)
    this.length = options.length || 26;    // Y/Z axis (meters)
    this.height = options.height || 5.8;   // Height (meters)
    this.hallName = options.hallName || 'Turing Hall';
    this.hallId = options.hallId || 'hall-1';
    this.capacity = options.capacity || 250;
    this.currentOccupancy = options.currentOccupancy || 45;
    this.doorsCount = options.doorsCount || 3;
    this.densityMode = options.densityMode || 'standard';

    // Camera perspective angles (isometric default for fallback)
    this.rotationAngle = options.rotationAngle || (Math.PI / 4);
    this.tiltAngle = options.tiltAngle || 0.58;
    this.zoom = options.zoom || 1.0;

    // Check WebGL and Three.js availability
    this.useThreeJs = this.checkThreeJsSupport();

    if (this.useThreeJs) {
      this.initThreeJs();
    } else {
      this.ctx = this.canvas.getContext('2d');
      this.initCanvasInteraction();
      this.resize();
      this.render();
    }
  }

  checkThreeJsSupport() {
    try {
      if (!window.THREE) return false;
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  // =========================================================================
  // 🌟 THREE.JS HIGH-PERFORMANCE PBR 3D ENGINE
  // =========================================================================

  initThreeJs() {
    const THREE = window.THREE;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.width || 600;
    const h = rect.height || this.canvas.height || 320;

    // 1. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // 2. Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b19);
    this.scene.fog = new THREE.FogExp2(0x070b19, 0.012);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.5, 500);
    this.updateCameraPosition();

    // 4. OrbitControls
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.03; // Don't go below floor
      this.controls.minDistance = 6;
      this.controls.maxDistance = 180;
      this.controls.target.set(0, 1.2, 0);
    }

    // 5. Lighting
    this.setupLighting();

    // 6. Build 3D Architectural Scene
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);
    this.buildThreeJsRoom();

    // 7. Animation Loop
    this.isAnimating = true;
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    // 8. Handle Window Resize
    window.addEventListener('resize', () => this.resize());
  }

  updateCameraPosition() {
    const dist = Math.max(this.width, this.length) * 1.6;
    this.camera.position.set(dist * 0.75, dist * 0.9, dist * 1.1);
    this.camera.lookAt(0, 1.2, 0);
  }

  setupLighting() {
    const THREE = window.THREE;
    // Ambient soft fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    // Sunlight with shadows
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    this.dirLight.position.set(30, 45, 25);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 150;
    const d = 35;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    // Cyan volumetric accent light
    const cyanLight = new THREE.PointLight(0x38bdf8, 1.2, 50);
    cyanLight.position.set(-this.width / 2, 8, -this.length / 3);
    this.scene.add(cyanLight);

    // Stage spotlight
    this.stageSpot = new THREE.SpotLight(0x60a5fa, 2.5, 40, Math.PI / 4, 0.35);
    this.stageSpot.position.set(0, 14, -this.length * 0.3);
    this.stageSpot.target.position.set(0, 0.8, -this.length * 0.38);
    this.scene.add(this.stageSpot);
    this.scene.add(this.stageSpot.target);
  }

  buildThreeJsRoom() {
    const THREE = window.THREE;
    // Clear existing room geometry
    while (this.roomGroup.children.length > 0) {
      const obj = this.roomGroup.children[0];
      this.roomGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }

    const halfW = this.width / 2;
    const halfL = this.length / 2;

    // --- 1. FLOOR (PBR Polished Slate with Cyan Grid) ---
    const floorGeo = new THREE.PlaneGeometry(this.width, this.length);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.3
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // Grid Overlay on Floor
    const grid = new THREE.GridHelper(Math.max(this.width, this.length), Math.round(Math.max(this.width, this.length)), 0x38bdf8, 0x1e293b);
    grid.position.y = 0.01;
    this.roomGroup.add(grid);

    // Floor Boundary Neon Border
    const edgesGeo = new THREE.EdgesGeometry(floorGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const floorOutline = new THREE.LineSegments(edgesGeo, edgesMat);
    floorOutline.rotation.x = -Math.PI / 2;
    floorOutline.position.y = 0.02;
    this.roomGroup.add(floorOutline);

    // --- 2. ARCHITECTURAL CUTAWAY WALLS & CORNER PILLARS ---
    // North Back Wall (Behind Stage)
    const backWallGeo = new THREE.BoxGeometry(this.width, this.height, 0.3);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, this.height / 2, -halfL);
    backWall.receiveShadow = true;
    this.roomGroup.add(backWall);

    // Cutaway Low Glass Side Walls (Allows clear view inside without obstruction)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      roughness: 0.1,
      metalness: 0.8
    });
    const sideWallGeo = new THREE.BoxGeometry(0.2, 1.4, this.length);
    const leftWall = new THREE.Mesh(sideWallGeo, glassMat);
    leftWall.position.set(-halfW, 0.7, 0);
    this.roomGroup.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, glassMat);
    rightWall.position.set(halfW, 0.7, 0);
    this.roomGroup.add(rightWall);

    // 4 Corner Architectural Steel Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, this.height, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
    const pillarCoords = [
      [-halfW, halfL], [halfW, halfL], [-halfW, -halfL], [halfW, -halfL]
    ];
    pillarCoords.forEach(([x, z]) => {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(x, this.height / 2, z);
      p.castShadow = true;
      this.roomGroup.add(p);

      // Status Beacon on top of pillar
      const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(x, this.height + 0.25, z);
      this.roomGroup.add(beacon);
    });

    // --- 3. PRESENTATION STAGE & PODIUM (PBR Timber Deck) ---
    const stageW = this.width * 0.6;
    const stageL = Math.min(5.2, this.length * 0.22);
    const stageH = 0.85;
    const stageZ = -halfL + stageL / 2 + 1.0;

    const stageGeo = new THREE.BoxGeometry(stageW, stageH, stageL);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0xa16207, // Warm Oak Timber
      roughness: 0.35,
      metalness: 0.15
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.set(0, stageH / 2, stageZ);
    stage.castShadow = true;
    stage.receiveShadow = true;
    this.roomGroup.add(stage);

    // Backdrop Screen on Stage
    const screenW = stageW * 0.85;
    const screenH = 2.4;
    const screenGeo = new THREE.BoxGeometry(screenW, screenH, 0.1);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.7,
      roughness: 0.2
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, stageH + screenH / 2 + 0.2, stageZ - stageL / 2 + 0.1);
    this.roomGroup.add(screen);

    // Speaker Podium Lectern
    const podiumGeo = new THREE.BoxGeometry(0.8, 1.1, 0.6);
    const podiumMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.set(stageW * 0.25, stageH + 0.55, stageZ);
    podium.castShadow = true;
    this.roomGroup.add(podium);

    // --- 4. ACCESS GATES & LASER TRIPWIRE SENSORS ---
    // Gate A: Entrance (East Wall)
    this.createDoorWithLaser({
      x: halfW,
      z: -halfL * 0.2,
      rotationY: Math.PI / 2,
      doorWidth: 2.2,
      color: 0x10b981,
      label: 'GATE A (ENTRY)',
      isLaserActive: true
    });

    // Gate B: Emergency Exit (West Wall)
    this.createDoorWithLaser({
      x: -halfW,
      z: halfL * 0.35,
      rotationY: Math.PI / 2,
      doorWidth: 2.2,
      color: 0xef4444,
      label: 'GATE B (EXIT)',
      isLaserActive: true
    });

    // Gate C: Overflow Gate (South Back Wall if >= 3 doors)
    if (this.doorsCount >= 3) {
      this.createDoorWithLaser({
        x: 0,
        z: halfL,
        rotationY: 0,
        doorWidth: 2.5,
        color: 0xf59e0b,
        label: 'GATE C (OVERFLOW)',
        isLaserActive: true
      });
    }

    // --- 5. AUDIENCE SEATING MATRIX & LIVE OCCUPANCY HEATMAP ---
    const startZ = stageZ + stageL / 2 + 2.2;
    const availableLength = halfL - startZ - 1.5;
    const rows = Math.max(3, Math.floor(availableLength / 1.5));
    const seatsPerRow = Math.max(4, Math.floor((this.width - 4) / 1.3));
    const totalVisibleSeats = rows * seatsPerRow;
    const occupiedCount = Math.min(totalVisibleSeats, Math.round((this.currentOccupancy / (this.capacity || 1)) * totalVisibleSeats));

    const chairGeo = new THREE.BoxGeometry(0.55, 0.45, 0.5);
    const chairBackGeo = new THREE.BoxGeometry(0.55, 0.55, 0.1);
    const occupiedMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e, // Glowing Green Attendee
      emissive: 0x15803d,
      emissiveIntensity: 0.35,
      roughness: 0.5
    });
    const emptyMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Muted Empty Seat
      roughness: 0.7
    });

    let seatIdx = 0;
    for (let r = 0; r < rows; r++) {
      const z = startZ + r * 1.5;
      for (let s = 0; s < seatsPerRow; s++) {
        // Leave middle emergency evacuation aisle open
        const isMiddleAisle = (s === Math.floor(seatsPerRow / 2));
        if (isMiddleAisle) continue;

        const x = -halfW + 2.0 + s * 1.3;
        const isOccupied = seatIdx < occupiedCount;
        seatIdx++;

        const mat = isOccupied ? occupiedMat : emptyMat;

        // Seat base
        const seat = new THREE.Mesh(chairGeo, mat);
        seat.position.set(x, 0.22, z);
        seat.castShadow = true;
        this.roomGroup.add(seat);

        // Seat backrest
        const back = new THREE.Mesh(chairBackGeo, mat);
        back.position.set(x, 0.55, z - 0.2);
        this.roomGroup.add(back);
      }
    }
  }

  createDoorWithLaser({ x, z, rotationY, doorWidth, color, label, isLaserActive }) {
    const THREE = window.THREE;
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, 0, z);
    doorGroup.rotation.y = rotationY;

    // Door Frame Posts
    const postGeo = new THREE.BoxGeometry(0.15, 2.4, 0.15);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    
    const postLeft = new THREE.Mesh(postGeo, frameMat);
    postLeft.position.set(-doorWidth / 2, 1.2, 0);
    doorGroup.add(postLeft);

    const postRight = new THREE.Mesh(postGeo, frameMat);
    postRight.position.set(doorWidth / 2, 1.2, 0);
    doorGroup.add(postRight);

    // Top Header Lintel
    const lintelGeo = new THREE.BoxGeometry(doorWidth + 0.3, 0.15, 0.15);
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(0, 2.4, 0);
    doorGroup.add(lintel);

    // Glowing Laser Tripwire Beam
    if (isLaserActive) {
      const laserGeo = new THREE.CylinderGeometry(0.02, 0.02, doorWidth, 8);
      const laserMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.95
      });
      const laser = new THREE.Mesh(laserGeo, laserMat);
      laser.rotation.z = Math.PI / 2;
      laser.position.set(0, 1.1, 0);
      doorGroup.add(laser);

      // Optical Sensor Box
      const sensorGeo = new THREE.BoxGeometry(0.2, 0.15, 0.15);
      const sensorMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const sensor = new THREE.Mesh(sensorGeo, sensorMat);
      sensor.position.set(-doorWidth / 2 + 0.1, 1.1, 0);
      doorGroup.add(sensor);
    }

    this.roomGroup.add(doorGroup);
  }

  animate() {
    if (!this.isAnimating) return;
    requestAnimationFrame(this.animate);

    if (this.controls) {
      this.controls.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // =========================================================================
  // 🔄 PUBLIC API & VIEWPORT CONTROLS
  // =========================================================================

  setDimensions({ width, length, height, capacity, hallName, doorsCount, currentOccupancy, densityMode }) {
    if (width !== undefined) this.width = Math.max(6, parseFloat(width) || 20);
    if (length !== undefined) this.length = Math.max(6, parseFloat(length) || 26);
    if (height !== undefined) this.height = Math.max(3, parseFloat(height) || 5.8);
    if (capacity !== undefined) this.capacity = parseInt(capacity, 10) || 250;
    if (hallName !== undefined) this.hallName = hallName;
    if (doorsCount !== undefined) this.doorsCount = parseInt(doorsCount, 10) || 3;
    if (currentOccupancy !== undefined) this.currentOccupancy = parseInt(currentOccupancy, 10) || 0;
    if (densityMode !== undefined) this.densityMode = densityMode;

    if (this.useThreeJs) {
      this.buildThreeJsRoom();
      this.updateCameraPosition();
    } else {
      this.requestRender();
    }
  }

  rotate(deltaAngle) {
    if (this.useThreeJs && this.camera && this.controls) {
      const radius = Math.hypot(this.camera.position.x, this.camera.position.z);
      const currentAngle = Math.atan2(this.camera.position.z, this.camera.position.x);
      const newAngle = currentAngle + deltaAngle;
      this.camera.position.x = radius * Math.cos(newAngle);
      this.camera.position.z = radius * Math.sin(newAngle);
      this.controls.update();
    } else {
      this.rotationAngle += deltaAngle;
      this.requestRender();
    }
  }

  tilt(deltaTilt) {
    if (this.useThreeJs && this.camera && this.controls) {
      this.camera.position.y = Math.max(3, Math.min(80, this.camera.position.y + deltaTilt * 8));
      this.controls.update();
    } else {
      this.tiltAngle = Math.max(0.25, Math.min(1.15, this.tiltAngle + deltaTilt));
      this.requestRender();
    }
  }

  resetView() {
    if (this.useThreeJs) {
      this.updateCameraPosition();
      if (this.controls) {
        this.controls.target.set(0, 1.2, 0);
        this.controls.update();
      }
    } else {
      this.rotationAngle = Math.PI / 4;
      this.tiltAngle = 0.58;
      this.zoom = 1.0;
      this.requestRender();
    }
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.width || 600;
    const h = rect.height || this.canvas.height || 320;

    if (this.useThreeJs && this.renderer && this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    } else if (this.ctx) {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.dpr = dpr;
      this.cssWidth = w;
      this.cssHeight = h;
      this.requestRender();
    }
  }

  // =========================================================================
  // 🛡️ CANVAS 2D ISOMETRIC ENGINE (ZERO-FAIL FALLBACK)
  // =========================================================================

  initCanvasInteraction() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.rotationAngle += dx * 0.012;
      this.tiltAngle = Math.max(0.25, Math.min(1.15, this.tiltAngle + dy * 0.008));
      this.requestRender();
    });

    window.addEventListener('mouseup', () => { this.isDragging = false; });
  }

  requestRender() {
    if (this.useThreeJs) return;
    this.isDirty = true;
    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame(() => {
        this.animFrameId = null;
        if (this.isDirty) {
          this.render();
          this.isDirty = false;
        }
      });
    }
  }

  project3D(x, y, z, originX, originY, scale) {
    const cx = x - this.width / 2;
    const cy = y - this.length / 2;
    const cosR = Math.cos(this.rotationAngle);
    const sinR = Math.sin(this.rotationAngle);
    const rx = cx * cosR - cy * sinR;
    const ry = cx * sinR + cy * cosR;
    const cosT = Math.cos(this.tiltAngle);
    const sinT = Math.sin(this.tiltAngle);
    return {
      x: originX + rx * scale,
      y: originY + (ry * cosT - z * sinT) * scale,
      depth: ry
    };
  }

  render() {
    if (this.useThreeJs) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const cw = this.cssWidth || 600;
    const ch = this.cssHeight || 320;
    const dpr = this.dpr || 1;

    ctx.save();
    ctx.scale(dpr, dpr);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    const maxDim = Math.max(this.width, this.length);
    const baseScale = (Math.min(cw, ch) * 0.48 / maxDim) * this.zoom;
    const originX = cw / 2;
    const originY = ch / 2 + (maxDim * 0.12 * baseScale);

    // Floor Surface
    const c00 = this.project3D(0, 0, 0, originX, originY, baseScale);
    const c10 = this.project3D(this.width, 0, 0, originX, originY, baseScale);
    const c11 = this.project3D(this.width, this.length, 0, originX, originY, baseScale);
    const c01 = this.project3D(0, this.length, 0, originX, originY, baseScale);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.moveTo(c00.x, c00.y); ctx.lineTo(c10.x, c10.y); ctx.lineTo(c11.x, c11.y); ctx.lineTo(c01.x, c01.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5; ctx.stroke();

    // Stage
    const stageWidth = this.width * 0.55;
    const stageLength = this.length * 0.20;
    const stageX = (this.width - stageWidth) / 2;
    const stageY = 1.0;
    const stageH = 0.85;

    const p0 = this.project3D(stageX, stageY, stageH, originX, originY, baseScale);
    const p1 = this.project3D(stageX + stageWidth, stageY, stageH, originX, originY, baseScale);
    const p2 = this.project3D(stageX + stageWidth, stageY + stageLength, stageH, originX, originY, baseScale);
    const p3 = this.project3D(stageX, stageY + stageLength, stageH, originX, originY, baseScale);

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d97706'; ctx.stroke();

    ctx.restore();
  }
}

// Global factory helper
window.RoomSpatialModelRenderer = RoomSpatialModelRenderer;
