/**
 * 📐 DELTA ENGINE — 2D CAD BLUEPRINT & GEOMETRIC RECONSTRUCTION TEST SUITE
 * 
 * Comprehensive regression & verification tests for:
 * 1. Document Ingestion (PDF, PNG, JPG validation & signature checks)
 * 2. Vector PDF & Contour Extraction (walls, rooms, gates, stage, aisle)
 * 3. Metric Scale Calibration & Real-World Dimensions (NFPA-101 / IBC-2024)
 * 4. CAD Blueprint REST APIs (/api/spatial/cad-parse, /cad-calibrate, /cad-save, /cad/:hallId)
 * 5. Spatial Graph Binding & Zero-Regression Preservation of 3D Models
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });

    req.on('error', reject);
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

const {
  validateFloorPlanFile,
  inspectSourceDocument,
  reconstructCadGeometryFromSource,
  recalibrateScaleWithPoints
} = require('../backend/components/cadFloorplanParser');

async function runCadBlueprintTestSuite() {
  console.log('\n============================================================');
  console.log('   DELTA ENGINE — 2D CAD BLUEPRINT & GEOMETRY TEST SUITE    ');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${desc}:`, err.message);
    }
  }

  async function testAsync(desc, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${desc}:`, err.message);
    }
  }

  // --- GROUP 1: Document Validation & Security Checks ---
  console.log('[GROUP 1] Document Validation & File Security Guards');

  const pdfPath = path.join(__dirname, '../frontend/venue_room_plan_blueprint.pdf');
  const pngPath = path.join(__dirname, '../frontend/venue_room_plan_blueprint.png');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pngBuffer = fs.readFileSync(pngPath);

  test('Validates architectural PDF floor-plan file', () => {
    const res = validateFloorPlanFile(pdfBuffer, 'venue_room_plan_blueprint.pdf', 'application/pdf');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.fileType, 'PDF');
  });

  test('Validates architectural PNG blueprint image', () => {
    const res = validateFloorPlanFile(pngBuffer, 'venue_room_plan_blueprint.png', 'image/png');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.fileType, 'PNG');
  });

  test('Rejects empty or null file buffer with clear error', () => {
    const res = validateFloorPlanFile(Buffer.alloc(0), 'empty.pdf');
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('Empty file buffer'));
  });

  test('Rejects oversized document exceeding 25MB limit', () => {
    const fakeLarge = Buffer.alloc(26 * 1024 * 1024); // 26MB
    const res = validateFloorPlanFile(fakeLarge, 'huge.pdf');
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('exceeds maximum allowed size'));
  });

  test('Rejects encrypted PDF documents', () => {
    const encryptedPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Encrypt 2 0 R >>\nendobj\n%%EOF');
    const res = validateFloorPlanFile(encryptedPdf, 'locked.pdf', 'application/pdf');
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('Encrypted or password-protected'));
  });

  test('Rejects unsupported file formats (e.g. .exe, .zip)', () => {
    const res = validateFloorPlanFile(Buffer.from('MZ\x90\x00'), 'binary.exe', 'application/octet-stream');
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('Unsupported file format'));
  });

  // --- GROUP 2: Source Document Inspection & Geometric Extraction ---
  console.log('\n[GROUP 2] Geometric & Semantic Entity Reconstruction');

  test('Inspects PDF source document and counts pages', () => {
    const meta = inspectSourceDocument(pdfBuffer, 'PDF', 'venue_room_plan_blueprint.pdf');
    assert.strictEqual(meta.fileType, 'PDF');
    assert.ok(meta.pageCount >= 1);
    assert.ok(meta.fileSizeKB > 0);
  });

  let cadModel = null;
  test('Reconstructs CAD geometry from architectural PDF blueprint', () => {
    cadModel = reconstructCadGeometryFromSource({
      buffer: pdfBuffer,
      fileType: 'PDF',
      fileName: 'venue_room_plan_blueprint.pdf',
      hallId: 'hall-1',
      hallName: 'Turing Hall'
    });
    assert.ok(cadModel);
    assert.strictEqual(cadModel.hallId, 'hall-1');
    assert.ok(cadModel.hallName.includes('Turing Hall'));
  });

  test('Extracts calibrated room dimensions (20m x 30m = 600m²)', () => {
    assert.strictEqual(cadModel.dimensions.widthM, 20.0);
    assert.strictEqual(cadModel.dimensions.lengthM, 30.0);
    assert.strictEqual(cadModel.dimensions.heightM, 5.5);
    assert.strictEqual(cadModel.dimensions.areaM2, 600);
  });

  test('Extracts exterior perimeter walls and interior partitions', () => {
    assert.ok(cadModel.walls.length >= 6);
    const exteriorWalls = cadModel.walls.filter(w => w.type === 'EXTERIOR');
    assert.strictEqual(exteriorWalls.length, 4); // North, East, South, West
    const partitionWalls = cadModel.walls.filter(w => w.type === 'PARTITION');
    assert.ok(partitionWalls.length >= 1); // Stage partition
  });

  test('Extracts enclosed rooms & functional sectors', () => {
    assert.ok(cadModel.rooms.length >= 4);
    const stage = cadModel.rooms.find(r => r.id === 'zone_keynote_stage');
    assert.ok(stage);
    assert.strictEqual(stage.zoneType, 'STAGE');
    assert.ok(stage.areaM2 > 0);

    const westSeating = cadModel.rooms.find(r => r.id === 'zone_seating_west');
    assert.ok(westSeating);
    assert.strictEqual(westSeating.zoneType, 'SEATING');

    const aisle = cadModel.rooms.find(r => r.id === 'zone_central_aisle');
    assert.ok(aisle);
    assert.strictEqual(aisle.zoneType, 'CORRIDOR');
  });

  test('Extracts entrance/egress doors with laser tripwire sensors', () => {
    assert.ok(cadModel.doors.length >= 2);
    const gateA = cadModel.doors.find(d => d.id === 'gate-a');
    assert.ok(gateA);
    assert.strictEqual(gateA.type, 'ENTRY');
    assert.strictEqual(gateA.sensorTripwire, true);

    const gateB = cadModel.doors.find(d => d.id === 'gate-b');
    assert.ok(gateB);
    assert.strictEqual(gateB.type, 'EXIT');
  });

  test('Calculates NFPA-101 compliant occupant capacity', () => {
    // 600m² / 1.8m² per person = 333 pax safe egress
    assert.strictEqual(cadModel.capacityMetrics.safeEgressCap, 333);
    assert.strictEqual(cadModel.capacityMetrics.highDensityCap, 429);
    assert.strictEqual(cadModel.capacityMetrics.standingCap, 800);
    assert.strictEqual(cadModel.capacityMetrics.effectiveCapacity, 333);
  });

  test('Establishes primary life-safety evacuation route', () => {
    assert.ok(cadModel.routes.length >= 1);
    const primaryRoute = cadModel.routes[0];
    assert.strictEqual(primaryRoute.recommended, true);
    assert.ok(primaryRoute.waypoints.length >= 3);
  });

  test('Generates validation confidence score and warnings', () => {
    assert.ok(cadModel.confidence.score > 0.80);
    assert.strictEqual(cadModel.confidence.verifiedBy, 'DELTA Life-Safety Geometry Engine');
  });

  // --- GROUP 3: Metric Scale Calibration & Recalculation ---
  console.log('\n[GROUP 3] Metric Scale Calibration & Recalculation');

  test('Initializes calibrated pixelsPerMeter ratio', () => {
    assert.ok(cadModel.scale.calibrated);
    assert.ok(cadModel.scale.pixelsPerMeter > 0);
    assert.strictEqual(cadModel.scale.unit, 'meters');
  });

  test('Recalibrates scale with user-confirmed 2-point measurement', () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 400, y: 100 }; // 300 pixels
    const realMeters = 20.0; // 300px / 20m = 15 px/meter

    const calibrated = recalibrateScaleWithPoints(cadModel, p1, p2, realMeters);
    assert.strictEqual(calibrated.scale.pixelsPerMeter, 15.0);
    assert.ok(calibrated.dimensions.widthM > 0);
    assert.ok(calibrated.dimensions.areaM2 > 0);
  });

  // --- GROUP 4: Backend CAD Blueprint REST Endpoints ---
  console.log('\n[GROUP 4] Backend CAD Blueprint REST Endpoints');

  await testAsync('POST /api/spatial/cad-parse parses sample blueprint PDF', async () => {
    const res = await makeRequest('POST', '/api/spatial/cad-parse', { 'Content-Type': 'application/json' }, {
      sampleFile: 'venue_room_plan_blueprint.pdf',
      hallId: 'hall-1'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.cadModel);
    assert.strictEqual(res.body.cadModel.dimensions.widthM, 20.0);
    assert.strictEqual(res.body.cadModel.dimensions.lengthM, 30.0);
  });

  await testAsync('POST /api/spatial/cad-parse parses sample blueprint PNG image', async () => {
    const res = await makeRequest('POST', '/api/spatial/cad-parse', { 'Content-Type': 'application/json' }, {
      sampleFile: 'venue_room_plan_blueprint.png',
      hallId: 'hall-2',
      hallName: 'Lovelace Suite'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.cadModel);
    assert.strictEqual(res.body.cadModel.hallId, 'hall-2');
  });

  await testAsync('POST /api/spatial/cad-calibrate adjusts scale via API', async () => {
    const res = await makeRequest('POST', '/api/spatial/cad-calibrate', { 'Content-Type': 'application/json' }, {
      cadModel,
      p1: { x: 50, y: 50 },
      p2: { x: 350, y: 50 },
      realDistanceM: 25.0
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.cadModel.scale.pixelsPerMeter, 12.0); // 300px / 25m = 12
  });

  await testAsync('POST /api/spatial/cad-save saves blueprint and updates hall capacity', async () => {
    const res = await makeRequest('POST', '/api/spatial/cad-save', { 'Content-Type': 'application/json' }, {
      cadModel: {
        ...cadModel,
        hallId: 'hall-1',
        hallName: 'Turing Hall (Calibrated CAD)',
        capacityMetrics: { effectiveCapacity: 350 }
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.hallId, 'hall-1');
  });

  await testAsync('GET /api/spatial/cad/:hallId returns saved CAD blueprint model', async () => {
    const res = await makeRequest('GET', '/api/spatial/cad/hall-1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.cadModel.hallId, 'hall-1');
    assert.ok(res.body.cadModel.walls.length >= 4);
    assert.ok(res.body.cadModel.rooms.length >= 4);
  });

  // --- GROUP 5: Graph Integration & Zero-Regression Verification ---
  console.log('\n[GROUP 5] Graph Integration & Zero-Regression Verification');

  await testAsync('GET /api/state confirms hall capacity was updated from CAD blueprint', async () => {
    const res = await makeRequest('GET', '/api/state');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.graph.halls['hall-1']);
    assert.strictEqual(res.body.graph.halls['hall-1'].capacity, 350);
  });

  await testAsync('3D spatial model endpoint (/api/spatial/model/hall-1) remains fully operational', async () => {
    const res = await makeRequest('GET', '/api/spatial/model/hall-1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.spatialModel);
  });

  test('Deterministic geometry extraction SLA completes under 5ms', () => {
    const start = performance.now();
    reconstructCadGeometryFromSource({
      buffer: pdfBuffer,
      fileType: 'PDF',
      fileName: 'venue_room_plan_blueprint.pdf'
    });
    const duration = performance.now() - start;
    assert.ok(duration < 5.0, `Expected <5ms, took ${duration.toFixed(2)}ms`);
  });

  console.log('\n============================================================');
  console.log(`  CAD BLUEPRINT TESTS COMPLETE: ${passed}/${total} PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runCadBlueprintTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
