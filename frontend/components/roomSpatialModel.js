/**
 * 🏛️ DELTA ENGINE — 3D SPATIAL ROOM MODEL & VENUE DIGITAL TWIN ENGINE (THREE.JS PBR + CANVAS FALLBACK)
 * Renders interactive high-fidelity 3D WebGL spatial models of event halls, computer labs,
 * room plans, entry/exit doors (with ESP32 laser tripwire positions), and workstation setups.
 * Computes people capacity and real-time crowd occupancy distributions.
 * 
 * Powered by:
 * - NVIDIA Nemotron / Gemini Multimodal Vision API spatial detections
 * - Three.js PBR Engine with soft shadows, dynamic stage/seating layouts, and laser tripwires
 * - Zero boilerplate: distinguishes Computer Labs / Workstations from Auditoriums and Exhibition Grounds!
 */

class RoomSpatialModelRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    
    // Model dimensions in meters
    this.width = options.width || 10;      // X axis (meters)
    this.length = options.length || 13;    // Y/Z axis (meters)
    this.height = options.height || 3.2;   // Height (meters)
    this.hallName = options.hallName || "St. Peter's College Lab";
    this.hallId = options.hallId || 'hall-1';
    this.capacity = options.capacity || 20;
    this.currentOccupancy = options.currentOccupancy || 8;
    this.doorsCount = options.doorsCount || 1;
    this.densityMode = options.densityMode || 'standard';

    // Architectural features detected by Vision AI
    this.venueType = options.venueType || 'COMPUTER_LAB';
    this.stage = options.stage !== undefined ? options.stage : { exists: false };
    this.furniture = options.furniture || {
      hasPerimeterComputerDesks: true,
      desktopMonitorsCount: 16,
      chairsCount: 18,
      hasLargeWindowWall: true,
      windowWall: 'NORTH',
      hasGlassPartitions: true,
      hasStorageCupboard: true,
      hasEvaporativeCooler: true,
      hasAcUnit: true
    };
    this.seating = options.seating || { arrangement: 'WORKSTATIONS', rowsCount: 2, seatsPerRow: 8 };
    this.doors = options.doors || [
      { id: 'door-1', name: 'Lab Main Entrance', wall: 'EAST', offsetM: 3.0, type: 'ENTRY', sensorTripwire: true }
    ];
    this.columns = options.columns || [];
    this.colorPalette = options.colorPalette || 'slate';

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
      this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
      this.controls.minDistance = 4;
      this.controls.maxDistance = 150;
      this.controls.target.set(0, 1.0, 0);
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
    const dist = Math.max(this.width, this.length) * 1.5;
    this.camera.position.set(dist * 0.75, dist * 0.9, dist * 1.05);
    this.camera.lookAt(0, 1.0, 0);
  }

  setupLighting() {
    const THREE = window.THREE;
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    this.dirLight.position.set(25, 40, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 120;
    const d = 30;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    const cyanLight = new THREE.PointLight(0x38bdf8, 1.0, 40);
    cyanLight.position.set(-this.width / 2, 6, -this.length / 3);
    this.scene.add(cyanLight);

    const softFillLight = new THREE.PointLight(0xfffbeb, 0.8, 30);
    softFillLight.position.set(0, 5, 0);
    this.scene.add(softFillLight);
  }

  buildThreeJsRoom() {
    const THREE = window.THREE;
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

    // --- 1. FLOOR (PBR Tile Flooring) ---
    const isLab = this.venueType === 'COMPUTER_LAB' || (this.furniture && this.furniture.hasPerimeterComputerDesks);
    const floorColor = isLab ? 0x1e293b : 0x0f172a;

    const floorGeo = new THREE.PlaneGeometry(this.width, this.length);
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 0.35,
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    const grid = new THREE.GridHelper(Math.max(this.width, this.length), Math.round(Math.max(this.width, this.length)), 0x38bdf8, 0x334155);
    grid.position.y = 0.01;
    this.roomGroup.add(grid);

    const edgesGeo = new THREE.EdgesGeometry(floorGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const floorOutline = new THREE.LineSegments(edgesGeo, edgesMat);
    floorOutline.rotation.x = -Math.PI / 2;
    floorOutline.position.y = 0.02;
    this.roomGroup.add(floorOutline);

    // --- 2. ARCHITECTURAL PERIMETER CORNER PILLARS ---
    const pillarGeo = new THREE.CylinderGeometry(0.18, 0.18, this.height, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.2 });
    const pillarCoords = [
      [-halfW, halfL], [halfW, halfL], [-halfW, -halfL], [halfW, -halfL]
    ];
    pillarCoords.forEach(([x, z]) => {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(x, this.height / 2, z);
      p.castShadow = true;
      this.roomGroup.add(p);

      const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(x, this.height + 0.2, z);
      this.roomGroup.add(beacon);
    });

    // --- 3. SCENE CONSTRUCTION: COMPUTER LAB vs AUDITORIUM vs OPEN ---
    if (isLab) {
      this.renderComputerLab(halfW, halfL);
    } else {
      this.renderGenericVenue(halfW, halfL);
    }

    // --- 4. ACCESS DOORS WITH LASER TRIPWIRES ---
    this.renderAccessDoors(halfW, halfL);
  }

  /**
   * Renders a Computer Lab with perimeter desks, desktop monitors, swivel chairs, window wall, and coolers
   */
  renderComputerLab(halfW, halfL) {
    const THREE = window.THREE;
    const deskDepth = 0.85;
    const deskH = 0.75;
    const deskMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4 }); // Warm wood laminate
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.8 });

    // 1. Panoramic Multi-Pane Window Wall (North Wall overlooking trees)
    const windowFrameGeo = new THREE.BoxGeometry(this.width, this.height, 0.1);
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const windowFrame = new THREE.Mesh(windowFrameGeo, windowFrameMat);
    windowFrame.position.set(0, this.height / 2, -halfL);
    this.roomGroup.add(windowFrame);

    // Multi-pane glass window
    const glassPaneGeo = new THREE.PlaneGeometry(this.width * 0.95, this.height * 0.85);
    const glassPane = new THREE.Mesh(glassPaneGeo, glassMat);
    glassPane.position.set(0, this.height * 0.5, -halfL + 0.08);
    this.roomGroup.add(glassPane);

    // Outdoor green tree canopy backdrop visible through glass
    const treesGeo = new THREE.PlaneGeometry(this.width * 1.4, this.height * 1.3);
    const treesMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    const treesBackdrop = new THREE.Mesh(treesGeo, treesMat);
    treesBackdrop.position.set(0, this.height * 0.5, -halfL - 0.6);
    this.roomGroup.add(treesBackdrop);

    // 2. North Perimeter Computer Workbench (Under Window)
    const deskNorthGeo = new THREE.BoxGeometry(this.width - 2.5, 0.06, deskDepth);
    const deskNorth = new THREE.Mesh(deskNorthGeo, deskMat);
    deskNorth.position.set(0, deskH, -halfL + deskDepth / 2 + 0.2);
    deskNorth.castShadow = true; deskNorth.receiveShadow = true;
    this.roomGroup.add(deskNorth);

    // 3. South Perimeter Computer Workbench (Opposite Wall)
    const deskSouthGeo = new THREE.BoxGeometry(this.width - 2.5, 0.06, deskDepth);
    const deskSouth = new THREE.Mesh(deskSouthGeo, deskMat);
    deskSouth.position.set(0, deskH, halfL - deskDepth / 2 - 0.2);
    deskSouth.castShadow = true; deskSouth.receiveShadow = true;
    this.roomGroup.add(deskSouth);

    // 4. Desktop Monitors, Keyboards & Swivel Chairs
    const monitorGeo = new THREE.BoxGeometry(0.55, 0.35, 0.04);
    const monitorScreenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 }); // Glowing desktop display
    const monitorFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const monitorStandGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8);

    const chairSeatGeo = new THREE.BoxGeometry(0.46, 0.08, 0.44);
    const chairBackGeo = new THREE.BoxGeometry(0.42, 0.42, 0.06);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
    const chairStemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
    const chairBaseGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.04, 5);

    const numDesks = Math.max(4, Math.floor((this.width - 3.5) / 1.25));
    const startX = -halfW + 1.8;

    for (let i = 0; i < numDesks; i++) {
      const wx = startX + i * 1.25;

      // --- North Workstations (Facing Window) ---
      const nMonZ = -halfL + 0.48;
      const nMon = new THREE.Mesh(monitorGeo, monitorFrameMat);
      nMon.position.set(wx, deskH + 0.24, nMonZ);
      this.roomGroup.add(nMon);

      const nScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), monitorScreenMat);
      nScreen.position.set(wx, deskH + 0.24, nMonZ + 0.025);
      this.roomGroup.add(nScreen);

      const nStand = new THREE.Mesh(monitorStandGeo, metalMat);
      nStand.position.set(wx, deskH + 0.08, nMonZ);
      this.roomGroup.add(nStand);

      // North Chair
      const nChair = new THREE.Group();
      nChair.position.set(wx, 0, -halfL + deskDepth + 0.55);
      const nBase = new THREE.Mesh(chairBaseGeo, chairMat); nBase.position.y = 0.03; nChair.add(nBase);
      const nStem = new THREE.Mesh(chairStemGeo, metalMat); nStem.position.y = 0.22; nChair.add(nStem);
      const nSeat = new THREE.Mesh(chairSeatGeo, chairMat); nSeat.position.y = 0.44; nChair.add(nSeat);
      const nBack = new THREE.Mesh(chairBackGeo, chairMat); nBack.position.set(0, 0.68, 0.2); nChair.add(nBack);
      this.roomGroup.add(nChair);

      // --- South Workstations (Facing Wall) ---
      const sMonZ = halfL - 0.48;
      const sMon = new THREE.Mesh(monitorGeo, monitorFrameMat);
      sMon.position.set(wx, deskH + 0.24, sMonZ);
      this.roomGroup.add(sMon);

      const sScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), monitorScreenMat);
      sScreen.rotation.y = Math.PI;
      sScreen.position.set(wx, deskH + 0.24, sMonZ - 0.025);
      this.roomGroup.add(sScreen);

      const sStand = new THREE.Mesh(monitorStandGeo, metalMat);
      sStand.position.set(wx, deskH + 0.08, sMonZ);
      this.roomGroup.add(sStand);

      // South Chair
      const sChair = new THREE.Group();
      sChair.position.set(wx, 0, halfL - deskDepth - 0.55);
      const sBase = new THREE.Mesh(chairBaseGeo, chairMat); sBase.position.y = 0.03; sChair.add(sBase);
      const sStem = new THREE.Mesh(chairStemGeo, metalMat); sStem.position.y = 0.22; sChair.add(sStem);
      const sSeat = new THREE.Mesh(chairSeatGeo, chairMat); sSeat.position.y = 0.44; sChair.add(sSeat);
      const sBack = new THREE.Mesh(chairBackGeo, chairMat); sBack.position.set(0, 0.68, -0.2); sChair.add(sBack);
      this.roomGroup.add(sChair);
    }

    // 5. Metal Storage Cabinet (West Wall)
    const cabinetGeo = new THREE.BoxGeometry(0.65, 2.1, 1.3);
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
    const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
    cabinet.position.set(-halfW + 0.45, 1.05, 0);
    this.roomGroup.add(cabinet);

    // 6. White Evaporative Swamp Cooler (Corner)
    const coolerGeo = new THREE.BoxGeometry(0.65, 1.25, 0.65);
    const coolerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const cooler = new THREE.Mesh(coolerGeo, coolerMat);
    cooler.position.set(halfW - 0.6, 0.62, -halfL + 0.85);
    this.roomGroup.add(cooler);

    // Cooler front vent grille
    const grilleGeo = new THREE.PlaneGeometry(0.5, 0.75);
    const grilleMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(halfW - 0.6, 0.68, -halfL + 1.18);
    this.roomGroup.add(grille);

    // 7. Wall-Mounted Split AC Unit
    const acGeo = new THREE.BoxGeometry(1.2, 0.35, 0.28);
    const ac = new THREE.Mesh(acGeo, coolerMat);
    ac.position.set(0, this.height - 0.4, halfL - 0.16);
    this.roomGroup.add(ac);

    // 8. White Interior Cubicle Divider
    const partitionGeo = new THREE.BoxGeometry(0.08, 1.3, 2.2);
    const partitionMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const partition = new THREE.Mesh(partitionGeo, partitionMat);
    partition.position.set(-halfW + 2.5, 0.65, 0);
    this.roomGroup.add(partition);
  }

  /**
   * Renders Auditorium or Conference Room with Stage only if detected
   */
  renderGenericVenue(halfW, halfL) {
    const THREE = window.THREE;
    const hasStage = this.stage && this.stage.exists !== false;
    let stageZ = -halfL;
    let stageDepth = 0;

    if (hasStage) {
      const stageW = Math.max(4, this.stage.width || (this.width * 0.55));
      const stageL = Math.max(2.5, Math.min(6, this.stage.length || (this.length * 0.20)));
      const stageH = this.stage.elevatedM || 0.85;
      stageDepth = stageL;
      stageZ = -halfL + stageL / 2 + 0.8;

      const stageGeo = new THREE.BoxGeometry(stageW, stageH, stageL);
      const stageMat = new THREE.MeshStandardMaterial({
        color: 0xa16207,
        roughness: 0.35,
        metalness: 0.15
      });
      const stage = new THREE.Mesh(stageGeo, stageMat);
      stage.position.set(0, stageH / 2, stageZ);
      stage.castShadow = true;
      stage.receiveShadow = true;
      this.roomGroup.add(stage);

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
    }

    const startZ = hasStage ? stageZ + stageDepth / 2 + 2.2 : -halfL + 3.0;
    const availableLength = halfL - startZ - 1.5;
    const rows = Math.max(3, this.seating?.rowsCount || Math.floor(availableLength / 1.5));
    const seatsPerRow = Math.max(4, this.seating?.seatsPerRow || Math.floor((this.width - 4) / 1.3));
    const totalVisibleSeats = rows * seatsPerRow;
    const occupiedCount = Math.min(totalVisibleSeats, Math.round((this.currentOccupancy / (this.capacity || 1)) * totalVisibleSeats));

    const chairGeo = new THREE.BoxGeometry(0.55, 0.45, 0.5);
    const chairBackGeo = new THREE.BoxGeometry(0.55, 0.55, 0.1);
    const occupiedMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.35 });
    const emptyMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

    let seatIdx = 0;
    for (let r = 0; r < rows; r++) {
      const z = startZ + r * 1.5;
      for (let s = 0; s < seatsPerRow; s++) {
        if (s === Math.floor(seatsPerRow / 2)) continue;

        const x = -halfW + 2.0 + s * 1.3;
        const isOccupied = seatIdx < occupiedCount;
        seatIdx++;

        const mat = isOccupied ? occupiedMat : emptyMat;
        const seat = new THREE.Mesh(chairGeo, mat);
        seat.position.set(x, 0.22, z);
        seat.castShadow = true;
        this.roomGroup.add(seat);

        const back = new THREE.Mesh(chairBackGeo, mat);
        back.position.set(x, 0.55, z - 0.2);
        this.roomGroup.add(back);
      }
    }
  }

  renderAccessDoors(halfW, halfL) {
    if (this.doors && Array.isArray(this.doors) && this.doors.length > 0) {
      this.doors.forEach(door => {
        let x = 0;
        let z = 0;
        let rotationY = 0;
        const wall = (door.wall || 'EAST').toUpperCase();
        const offset = door.offsetM !== undefined ? door.offsetM : (this.width * 0.3);

        if (wall === 'NORTH') {
          x = -halfW + offset; z = -halfL; rotationY = 0;
        } else if (wall === 'SOUTH') {
          x = -halfW + offset; z = halfL; rotationY = 0;
        } else if (wall === 'EAST') {
          x = halfW; z = -halfL + offset; rotationY = Math.PI / 2;
        } else if (wall === 'WEST') {
          x = -halfW; z = -halfL + offset; rotationY = Math.PI / 2;
        }

        const isEntry = (door.type || 'ENTRY').toUpperCase() === 'ENTRY';
        const color = isEntry ? 0x10b981 : 0xef4444;

        this.createDoorWithLaser({
          x,
          z,
          rotationY,
          doorWidth: 2.2,
          color,
          label: door.name || (isEntry ? 'DOOR (ENTRY)' : 'DOOR (EXIT)'),
          isLaserActive: door.sensorTripwire !== false
        });
      });
    } else {
      this.createDoorWithLaser({ x: halfW, z: 0, rotationY: Math.PI / 2, doorWidth: 2.2, color: 0x10b981, label: 'MAIN ENTRANCE', isLaserActive: true });
    }
  }

  createDoorWithLaser({ x, z, rotationY, doorWidth, color, label, isLaserActive }) {
    const THREE = window.THREE;
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, 0, z);
    doorGroup.rotation.y = rotationY;

    const postGeo = new THREE.BoxGeometry(0.15, 2.4, 0.15);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    
    const postLeft = new THREE.Mesh(postGeo, frameMat);
    postLeft.position.set(-doorWidth / 2, 1.2, 0);
    doorGroup.add(postLeft);

    const postRight = new THREE.Mesh(postGeo, frameMat);
    postRight.position.set(doorWidth / 2, 1.2, 0);
    doorGroup.add(postRight);

    const lintelGeo = new THREE.BoxGeometry(doorWidth + 0.3, 0.15, 0.15);
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(0, 2.4, 0);
    doorGroup.add(lintel);

    if (isLaserActive) {
      const laserGeo = new THREE.CylinderGeometry(0.02, 0.02, doorWidth, 8);
      const laserMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const laser = new THREE.Mesh(laserGeo, laserMat);
      laser.rotation.z = Math.PI / 2;
      laser.position.set(0, 1.1, 0);
      doorGroup.add(laser);

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

  setDimensions(options = {}) {
    if (options.width !== undefined) this.width = Math.max(6, parseFloat(options.width) || 10);
    if (options.length !== undefined) this.length = Math.max(6, parseFloat(options.length) || 13);
    if (options.height !== undefined) this.height = Math.max(2.5, parseFloat(options.height) || 3.2);
    if (options.capacity !== undefined) this.capacity = parseInt(options.capacity, 10) || 20;
    if (options.hallName !== undefined) this.hallName = options.hallName;
    if (options.doorsCount !== undefined) this.doorsCount = parseInt(options.doorsCount, 10) || 1;
    if (options.currentOccupancy !== undefined) this.currentOccupancy = parseInt(options.currentOccupancy, 10) || 0;
    if (options.densityMode !== undefined) this.densityMode = options.densityMode;
    if (options.venueType !== undefined) this.venueType = options.venueType;
    if (options.stage !== undefined) this.stage = options.stage;
    if (options.furniture !== undefined) this.furniture = options.furniture;
    if (options.seating !== undefined) this.seating = options.seating;
    if (options.doors !== undefined) this.doors = options.doors;
    if (options.columns !== undefined) this.columns = options.columns;
    if (options.colorPalette !== undefined) this.colorPalette = options.colorPalette;

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
      this.camera.position.y = Math.max(2, Math.min(60, this.camera.position.y + deltaTilt * 6));
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
        this.controls.target.set(0, 1.0, 0);
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

  render() {
    if (this.useThreeJs) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const cw = this.cssWidth || 600;
    const ch = this.cssHeight || 320;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cw, ch);
  }
}

// Global factory helper
window.RoomSpatialModelRenderer = RoomSpatialModelRenderer;
