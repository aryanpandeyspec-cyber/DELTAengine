/**
 * 🏛️ DELTA ENGINE — 3D SPATIAL ROOM MODEL & VENUE DIGITAL TWIN ENGINE
 * Renders interactive 3D/Isometric spatial models of event halls, room plans,
 * entry/exit doors (with ESP32 laser tripwire positions), stages, and seating arrays.
 * Computes people capacity and real-time crowd occupancy distributions.
 * 
 * Performance: High-speed Canvas 2D isometric projection with kinetic idle sleep (0% CPU when static).
 */

class RoomSpatialModelRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    
    // Model dimensions in meters
    this.width = options.width || 18;      // X axis (meters)
    this.length = options.length || 24;    // Y axis (meters)
    this.height = options.height || 5.5;   // Z axis (meters)
    this.hallName = options.hallName || 'Turing Hall';
    this.hallId = options.hallId || 'hall-1';
    this.capacity = options.capacity || 240;
    this.currentOccupancy = options.currentOccupancy || 0;
    this.doorsCount = options.doorsCount || 2;
    this.densityMode = options.densityMode || 'standard'; // 'standard' (1.8m²), 'dense' (1.4m²), 'standing' (0.75m²)

    // Camera perspective angles (isometric default)
    this.rotationAngle = options.rotationAngle || (Math.PI / 4); // 45 degrees
    this.tiltAngle = options.tiltAngle || 0.58;                  // Isometric tilt ~33 degrees
    this.zoom = options.zoom || 1.0;

    // Interaction state
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.isDirty = true;
    this.animFrameId = null;

    this.initInteraction();
    this.resize();
    this.render();
  }

  setDimensions({ width, length, height, capacity, hallName, doorsCount, currentOccupancy, densityMode }) {
    if (width !== undefined) this.width = Math.max(6, parseFloat(width) || 18);
    if (length !== undefined) this.length = Math.max(6, parseFloat(length) || 24);
    if (height !== undefined) this.height = Math.max(3, parseFloat(height) || 5.5);
    if (capacity !== undefined) this.capacity = parseInt(capacity, 10) || 240;
    if (hallName !== undefined) this.hallName = hallName;
    if (doorsCount !== undefined) this.doorsCount = parseInt(doorsCount, 10) || 2;
    if (currentOccupancy !== undefined) this.currentOccupancy = parseInt(currentOccupancy, 10) || 0;
    if (densityMode !== undefined) this.densityMode = densityMode;

    this.requestRender();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width || this.canvas.width || 560;
    const h = rect.height || this.canvas.height || 360;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.dpr = dpr;
    this.cssWidth = w;
    this.cssHeight = h;
    this.requestRender();
  }

  initInteraction() {
    if (!this.canvas) return;

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

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Zoom on wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoom = Math.max(0.6, Math.min(2.2, this.zoom * zoomFactor));
      this.requestRender();
    }, { passive: false });

    // Touch support for mobile/tablets
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;

      this.rotationAngle += dx * 0.015;
      this.tiltAngle = Math.max(0.25, Math.min(1.15, this.tiltAngle + dy * 0.01));
      this.requestRender();
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  requestRender() {
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

  // 3D to 2D isometric projection matrix
  project3D(x, y, z, originX, originY, scale) {
    // Center relative to hall center
    const cx = x - this.width / 2;
    const cy = y - this.length / 2;

    // Rotate around Z axis (yaw)
    const cosR = Math.cos(this.rotationAngle);
    const sinR = Math.sin(this.rotationAngle);
    const rx = cx * cosR - cy * sinR;
    const ry = cx * sinR + cy * cosR;

    // Tilt (pitch) projection
    const cosT = Math.cos(this.tiltAngle);
    const sinT = Math.sin(this.tiltAngle);

    const screenX = originX + rx * scale;
    const screenY = originY + (ry * cosT - z * sinT) * scale;
    return { x: screenX, y: screenY, depth: ry };
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = this.dpr || 1;

    ctx.save();
    ctx.scale(dpr, dpr);
    const cw = this.cssWidth;
    const ch = this.cssHeight;

    // Background gradient (Neubrutalist blueprint grid aesthetic)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, '#0f172a'); // Deep slate blue
    bgGrad.addColorStop(1, '#020617'); // Pitch dark obsidian
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle blueprint grid lines in background
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y < ch; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    // Dynamic isometric scale based on hall dimensions
    const maxDim = Math.max(this.width, this.length);
    const baseScale = (Math.min(cw, ch) * 0.48 / maxDim) * this.zoom;
    const originX = cw / 2;
    const originY = ch / 2 + (maxDim * 0.12 * baseScale);

    // 1. Draw Floor Tile Grid
    const step = 2; // 2 meter grid tiles
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.2;

    for (let x = 0; x <= this.width; x += step) {
      const p1 = this.project3D(x, 0, 0, originX, originY, baseScale);
      const p2 = this.project3D(x, this.length, 0, originX, originY, baseScale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let y = 0; y <= this.length; y += step) {
      const p1 = this.project3D(0, y, 0, originX, originY, baseScale);
      const p2 = this.project3D(this.width, y, 0, originX, originY, baseScale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 2. Draw Floor Surface Fill with boundary stroke
    const c00 = this.project3D(0, 0, 0, originX, originY, baseScale);
    const c10 = this.project3D(this.width, 0, 0, originX, originY, baseScale);
    const c11 = this.project3D(this.width, this.length, 0, originX, originY, baseScale);
    const c01 = this.project3D(0, this.length, 0, originX, originY, baseScale);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.moveTo(c00.x, c00.y);
    ctx.lineTo(c10.x, c10.y);
    ctx.lineTo(c11.x, c11.y);
    ctx.lineTo(c01.x, c01.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. Draw Stage Area (Elevated 3D Platform at Front)
    const stageWidth = this.width * 0.55;
    const stageLength = this.length * 0.20;
    const stageX = (this.width - stageWidth) / 2;
    const stageY = 1.0; // Near front
    const stageH = 0.8; // Elevated 0.8 meters

    this.draw3DBox(ctx, stageX, stageY, 0, stageWidth, stageLength, stageH, originX, originY, baseScale, {
      topColor: '#3b82f6',
      sideColor1: '#1d4ed8',
      sideColor2: '#1e40af',
      border: '#60a5fa'
    });

    // Stage Label & Speaker Podium
    const stageCenter = this.project3D(this.width / 2, stageY + stageLength / 2, stageH, originX, originY, baseScale);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎤 MAIN STAGE & PODIUM', stageCenter.x, stageCenter.y);

    // 4. Draw Seating Rows & Audience Capacity Matrix
    const rowsCount = Math.floor((this.length - stageLength - 4) / 1.6);
    const seatsPerRow = Math.floor((this.width - 4) / 1.4);
    const totalVisibleSeats = rowsCount * seatsPerRow;
    const occupiedSeatsCount = Math.min(totalVisibleSeats, Math.round((this.currentOccupancy / (this.capacity || 1)) * totalVisibleSeats));

    let seatIndex = 0;
    const startY = stageY + stageLength + 2.5;

    for (let r = 0; r < rowsCount; r++) {
      const yPos = startY + r * 1.6;
      for (let s = 0; s < seatsPerRow; s++) {
        // Aisle gap in middle
        const isMiddleAisle = (s === Math.floor(seatsPerRow / 2));
        if (isMiddleAisle) continue;

        const xPos = 2.0 + s * 1.4;
        const seatProj = this.project3D(xPos, yPos, 0.3, originX, originY, baseScale);

        const isOccupied = seatIndex < occupiedSeatsCount;
        seatIndex++;

        // Draw individual chair seat node
        ctx.beginPath();
        ctx.arc(seatProj.x, seatProj.y, Math.max(2, 3.2 * this.zoom), 0, Math.PI * 2);
        if (isOccupied) {
          ctx.fillStyle = '#22c55e'; // Green occupied attendee
          ctx.strokeStyle = '#15803d';
        } else {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.4)'; // Open chair
          ctx.strokeStyle = '#475569';
        }
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      }
    }

    // 5. Draw Entry Gate A (with Dual VL53L0X Laser Tripwire Indicator)
    const gateAX = 1.0;
    const gateAY = this.length * 0.45;
    this.drawDoorMarker(ctx, gateAX, gateAY, '🚪 GATE A (ENTRY)', '#10b981', true, originX, originY, baseScale);

    // 6. Draw Exit Gate B (Emergency Egress Gate)
    const gateBX = this.width - 1.0;
    const gateBY = this.length * 0.75;
    this.drawDoorMarker(ctx, gateBX, gateBY, '🚨 GATE B (EXIT)', '#ef4444', false, originX, originY, baseScale);

    // If 3 or more doors configured, draw additional exit
    if (this.doorsCount >= 3) {
      const gateCX = this.width / 2;
      const gateCY = this.length - 0.5;
      this.drawDoorMarker(ctx, gateCX, gateCY, '🚪 GATE C (OVERFLOW)', '#f59e0b', false, originX, originY, baseScale);
    }

    // 7. Draw 3D Boundary Columns / Corner Pillars
    this.drawPillar(ctx, 0, 0, this.height, originX, originY, baseScale);
    this.drawPillar(ctx, this.width, 0, this.height, originX, originY, baseScale);
    this.drawPillar(ctx, this.width, this.length, this.height, originX, originY, baseScale);
    this.drawPillar(ctx, 0, this.length, this.height, originX, originY, baseScale);

    // 8. Overhead HUD & Dimension Badges
    this.renderOverlayHUD(ctx, cw, ch);

    ctx.restore();
  }

  draw3DBox(ctx, x, y, z, w, l, h, originX, originY, scale, colors) {
    const p0 = this.project3D(x, y, z, originX, originY, scale);
    const p1 = this.project3D(x + w, y, z, originX, originY, scale);
    const p2 = this.project3D(x + w, y + l, z, originX, originY, scale);
    const p3 = this.project3D(x, y + l, z, originX, originY, scale);

    const t0 = this.project3D(x, y, z + h, originX, originY, scale);
    const t1 = this.project3D(x + w, y, z + h, originX, originY, scale);
    const t2 = this.project3D(x + w, y + l, z + h, originX, originY, scale);
    const t3 = this.project3D(x, y + l, z + h, originX, originY, scale);

    // Top face
    ctx.fillStyle = colors.topColor;
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = colors.border || '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Side face front
    ctx.fillStyle = colors.sideColor1;
    ctx.beginPath();
    ctx.moveTo(t3.x, t3.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side face right
    ctx.fillStyle = colors.sideColor2;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawDoorMarker(ctx, x, y, label, color, isLaserSensor, originX, originY, scale) {
    const p = this.project3D(x, y, 0, originX, originY, scale);
    const top = this.project3D(x, y, 2.2, originX, originY, scale);

    // Doorway frame line
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();

    // Laser tripwire pulse ring
    if (isLaserSensor) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Door pill badge
    ctx.fillStyle = color;
    ctx.fillRect(top.x - 45, top.y - 18, 90, 16);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 9px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, top.x, top.y - 6);
  }

  drawPillar(ctx, x, y, height, originX, originY, scale) {
    const b = this.project3D(x, y, 0, originX, originY, scale);
    const t = this.project3D(x, y, height, originX, originY, scale);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
  }

  renderOverlayHUD(ctx, cw, ch) {
    const areaM2 = Math.round(this.width * this.length);
    const safeFireCap = Math.round(areaM2 / 1.8);
    const egressRate = this.doorsCount * 60; // 60 people per door per minute standard

    // Top-Left Venue Info Card (Neubrutalist card style)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.fillRect(16, 16, 260, 96);
    ctx.strokeRect(16, 16, 260, 96);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🏛️ 3D SPATIAL TWIN: ${this.hallName.toUpperCase()}`, 28, 36);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 11px "Outfit", sans-serif';
    ctx.fillText(`📐 Dimensions: ${this.width}m × ${this.length}m × ${this.height}m (${areaM2} m²)`, 28, 54);
    ctx.fillText(`👥 Calibrated Capacity: ${this.capacity} pax (Fire Cap: ${safeFireCap})`, 28, 70);
    ctx.fillText(`🚪 Active Doors: ${this.doorsCount} Gates • Egress: ${egressRate} pax/min`, 28, 86);
    ctx.fillText(`⚡ Dual VL53L0X Laser Tripwire: Synced (Door A)`, 28, 102);

    // Top-Right Live Occupancy Gauge
    const gaugeW = 160;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.fillRect(cw - gaugeW - 16, 16, gaugeW, 64);
    ctx.strokeRect(cw - gaugeW - 16, 16, gaugeW, 64);

    const pct = Math.min(100, Math.round((this.currentOccupancy / (this.capacity || 1)) * 100));
    ctx.fillStyle = pct >= 90 ? '#ef4444' : (pct >= 70 ? '#f59e0b' : '#10b981');
    ctx.font = 'bold 18px "Space Grotesk", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.currentOccupancy} / ${this.capacity}`, cw - 28, 40);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 10px "Space Grotesk", sans-serif';
    ctx.fillText(`OCCUPANCY: ${pct}%`, cw - 28, 56);

    // Progress bar
    ctx.fillStyle = '#334155';
    ctx.fillRect(cw - gaugeW - 8, 62, gaugeW - 16, 8);
    ctx.fillStyle = pct >= 90 ? '#ef4444' : (pct >= 70 ? '#f59e0b' : '#10b981');
    ctx.fillRect(cw - gaugeW - 8, 62, (gaugeW - 16) * (pct / 100), 8);

    // Bottom Controls Hint
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '500 10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🖱️ Drag mouse to rotate 3D hall angle • Scroll wheel to zoom', cw / 2, ch - 12);
  }

  rotate(deltaAngle) {
    this.rotationAngle += deltaAngle;
    this.requestRender();
  }

  resetView() {
    this.rotationAngle = Math.PI / 4;
    this.tiltAngle = 0.58;
    this.zoom = 1.0;
    this.requestRender();
  }
}

// Global factory helper
window.RoomSpatialModelRenderer = RoomSpatialModelRenderer;
