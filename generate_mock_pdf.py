import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_blueprint_pdf(filename):
    """
    Generates a high-precision, architectural blueprint mock PDF
    for Turing Hall (Hall 1) with vector CAD elements, dimensions,
    gate sensors, and safety capacity analysis.
    """
    # Use landscape letter (792 pt wide, 612 pt high)
    c = canvas.Canvas(filename, pagesize=landscape(letter))
    width, height = landscape(letter)

    # 1. Background
    c.setFillColor(colors.HexColor('#F8FAFC'))
    c.rect(0, 0, width, height, stroke=0, fill=1)

    # 2. Outer Technical Blueprint Border (Neubrutalist double border)
    c.setStrokeColor(colors.HexColor('#0F172A'))
    c.setLineWidth(3)
    c.rect(20, 20, width - 40, height - 40)
    
    c.setStrokeColor(colors.HexColor('#2563EB'))
    c.setLineWidth(1)
    c.rect(26, 26, width - 52, height - 52)

    # 3. Top Header Bar
    c.setFillColor(colors.HexColor('#1E293B'))
    c.rect(26, height - 76, width - 52, 48, stroke=0, fill=1)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, height - 54, "DELTAengine ARCHITECTURAL BLUEPRINT & SPATIAL ROOM PLAN")

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor('#38BDF8'))
    c.drawRightString(width - 40, height - 46, "DOC ID: DELTA-BLPRNT-2026-H1")
    c.setFillColor(colors.HexColor('#94A3B8'))
    c.drawRightString(width - 40, height - 60, "SCALE: 1:100 (METRIC) | REV: 3.5-PROD | EPHEMERAL TTL: 2.0h")

    # Sub-header bar
    c.setFillColor(colors.HexColor('#E2E8F0'))
    c.rect(26, height - 100, width - 52, 24, stroke=0, fill=1)
    c.setFillColor(colors.HexColor('#0F172A'))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, height - 94, "VENUE TARGET: TURING HALL (HALL-1)  |  FLOOR AREA: 600 m²  |  CLEAR CEILING HEIGHT: 5.50 m")
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 40, height - 94, "INGESTION CLASSIFICATION: [ROOM_PLAN]  |  STATUS: VERIFIED CAD SURVEY")

    # -------------------------------------------------------------
    # 4. CAD FLOOR PLAN DRAWING AREA (Left Side: x=40 to 450, y=40 to 490)
    # -------------------------------------------------------------
    cad_x = 42
    cad_y = 42
    cad_w = 420
    cad_h = 450

    # CAD Area Background (Subtle blueprint blueprint grid)
    c.setFillColor(colors.HexColor('#FFFFFF'))
    c.setStrokeColor(colors.HexColor('#CBD5E1'))
    c.setLineWidth(1.5)
    c.rect(cad_x, cad_y, cad_w, cad_h, stroke=1, fill=1)

    # CAD Grid Lines (1m intervals scaled)
    c.setStrokeColor(colors.HexColor('#F1F5F9'))
    c.setLineWidth(0.5)
    for gx in range(cad_x + 15, cad_x + cad_w, 20):
        c.line(gx, cad_y, gx, cad_y + cad_h)
    for gy in range(cad_y + 15, cad_y + cad_h, 20):
        c.line(cad_x, gy, cad_x + cad_w, gy)

    # Room Outer Perimeter Walls (20m W x 30m L)
    # Let room occupy 300 pt wide x 380 pt high inside cad box
    room_x = cad_x + 60
    room_y = cad_y + 35
    room_w = 300
    room_h = 380

    # Draw Wall Thickness (Double-line with concrete hatch feel)
    c.setStrokeColor(colors.HexColor('#0F172A'))
    c.setLineWidth(4)
    c.rect(room_x, room_y, room_w, room_h, stroke=1, fill=0)

    c.setStrokeColor(colors.HexColor('#3B82F6'))
    c.setLineWidth(1)
    c.rect(room_x - 3, room_y - 3, room_w + 6, room_h + 6, stroke=1, fill=0)

    # Dimensions Callout Lines
    # Horizontal: 20.0m at the bottom
    c.setStrokeColor(colors.HexColor('#EF4444'))
    c.setLineWidth(1)
    dim_y = room_y - 18
    c.line(room_x, dim_y, room_x + room_w, dim_y)
    c.line(room_x, dim_y - 4, room_x, dim_y + 4)
    c.line(room_x + room_w, dim_y - 4, room_x + room_w, dim_y + 4)
    c.setFillColor(colors.HexColor('#EF4444'))
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(room_x + room_w / 2, dim_y - 10, "<---  WIDTH = 20.0 METERS  --->")

    # Vertical: 30.0m at the left
    dim_x = room_x - 22
    c.line(dim_x, room_y, dim_x, room_y + room_h)
    c.line(dim_x - 4, room_y, dim_x + 4, room_y)
    c.line(dim_x - 4, room_y + room_h, dim_x + 4, room_y + room_h)
    
    c.saveState()
    c.translate(dim_x - 8, room_y + room_h / 2)
    c.rotate(90)
    c.drawCentredString(0, 0, "<---  LENGTH = 30.0 METERS  --->")
    c.restoreState()

    # Elevated Keynote Stage (Top of Hall)
    stage_x = room_x + 45
    stage_y = room_y + room_h - 65
    stage_w = room_w - 90
    stage_h = 50

    c.setFillColor(colors.HexColor('#DBEAFE'))
    c.setStrokeColor(colors.HexColor('#2563EB'))
    c.setLineWidth(1.5)
    c.rect(stage_x, stage_y, stage_w, stage_h, stroke=1, fill=1)

    c.setFillColor(colors.HexColor('#1D4ED8'))
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(stage_x + stage_w / 2, stage_y + 30, "MAIN KEYNOTE STAGE")
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(stage_x + stage_w / 2, stage_y + 16, "Elevated +0.85m | LED Video Wall 12m x 4m | AV Podium")

    # Stage Ramp & Tech Desk
    c.setFillColor(colors.HexColor('#93C5FD'))
    c.rect(stage_x - 18, stage_y + 10, 14, 30, stroke=1, fill=1)
    c.setFillColor(colors.HexColor('#1E3A8A'))
    c.setFont("Helvetica-Bold", 6)
    c.drawCentredString(stage_x - 11, stage_y + 22, "RAMP")

    # Audience Seating Grid Array (3 Sectors: West, Center, East)
    sector_y_start = room_y + 60
    sector_h = stage_y - sector_y_start - 25

    # Center Aisle & Walkways
    aisle_w = 26
    c.setFillColor(colors.HexColor('#F8FAFC'))
    c.setStrokeColor(colors.HexColor('#CBD5E1'))
    c.setLineWidth(0.5)
    c.rect(room_x + (room_w - aisle_w) / 2, sector_y_start, aisle_w, sector_h, stroke=1, fill=1)
    
    c.saveState()
    c.translate(room_x + room_w / 2, sector_y_start + sector_h / 2)
    c.rotate(90)
    c.setFillColor(colors.HexColor('#94A3B8'))
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(0, -2, "CENTRAL SAFETY AISLE (2.4m CLEAR)")
    c.restoreState()

    # Draw Representative Seating Rows (Rows A to J)
    row_count = 10
    row_gap = sector_h / row_count
    
    c.setStrokeColor(colors.HexColor('#059669'))
    c.setFillColor(colors.HexColor('#D1FAE5'))
    c.setLineWidth(0.8)

    left_block_w = (room_w - aisle_w - 40) / 2
    right_block_w = left_block_w
    left_x = room_x + 15
    right_x = room_x + room_w - 15 - right_block_w

    for r in range(row_count):
        curr_y = sector_y_start + (r * row_gap) + 4
        # West block row
        c.rect(left_x, curr_y, left_block_w, 10, stroke=1, fill=1)
        # East block row
        c.rect(right_x, curr_y, right_block_w, 10, stroke=1, fill=1)

    c.setFillColor(colors.HexColor('#047857'))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(left_x + 10, sector_y_start + sector_h - 12, "SECTOR WEST (160 CHAIRS)")
    c.drawString(right_x + 10, sector_y_start + sector_h - 12, "SECTOR EAST (160 CHAIRS)")

    # Gate A (Main Ingress - Top Left)
    c.setFillColor(colors.HexColor('#22C55E'))
    c.setStrokeColor(colors.HexColor('#15803D'))
    c.setLineWidth(2)
    c.rect(room_x + 20, room_y + room_h - 3, 45, 6, stroke=1, fill=1)
    
    # Gate A Sensor Symbol (Dual VL53L0X Laser Tripwire)
    c.setFillColor(colors.HexColor('#DC2626'))
    c.circle(room_x + 25, room_y + room_h + 10, 4, stroke=1, fill=1)
    c.circle(room_x + 60, room_y + room_h + 10, 4, stroke=1, fill=1)
    c.setStrokeColor(colors.HexColor('#DC2626'))
    c.setLineWidth(1)
    c.line(room_x + 25, room_y + room_h + 10, room_x + 60, room_y + room_h + 10)

    c.setFillColor(colors.HexColor('#0F172A'))
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(room_x + 5, room_y + room_h + 18, "GATE A [INGRESS]")
    c.setFont("Helvetica", 6.5)
    c.setFillColor(colors.HexColor('#B91C1C'))
    c.drawString(room_x + 5, room_y + room_h + 27, "Dual VL53L0X LiDAR Tripwire")

    # Gate B (Emergency Egress - Bottom Right)
    c.setFillColor(colors.HexColor('#F97316'))
    c.setStrokeColor(colors.HexColor('#C2410C'))
    c.setLineWidth(2)
    c.rect(room_x + room_w - 65, room_y - 3, 45, 6, stroke=1, fill=1)

    c.setFillColor(colors.HexColor('#0F172A'))
    c.setFont("Helvetica-Bold", 7.5)
    c.drawRightString(room_x + room_w - 5, room_y - 25, "GATE B [EMERGENCY EGRESS]")
    c.setFont("Helvetica", 6.5)
    c.setFillColor(colors.HexColor('#EA580C'))
    c.drawRightString(room_x + room_w - 5, room_y - 34, "Double Panic Egress | 180 pax/min")

    # North Arrow Indicator
    p = c.beginPath()
    p.moveTo(cad_x + cad_w - 30, cad_y + cad_h - 20)
    p.lineTo(cad_x + cad_w - 36, cad_y + cad_h - 45)
    p.lineTo(cad_x + cad_w - 30, cad_y + cad_h - 40)
    p.lineTo(cad_x + cad_w - 24, cad_y + cad_h - 45)
    p.close()
    c.drawPath(p, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(cad_x + cad_w - 30, cad_y + cad_h - 15, "N")


    # -------------------------------------------------------------
    # 5. RIGHT SIDE PANEL: TECHNICAL SPECIFICATIONS & CAPACITY
    # -------------------------------------------------------------
    info_x = 480
    info_y = 42
    info_w = width - info_x - 30
    info_h = 450

    # Section 1: Overview Card
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor('#0F172A'))
    c.setLineWidth(2)
    c.rect(info_x, info_y + 310, info_w, 140, stroke=1, fill=1)

    c.setFillColor(colors.HexColor('#2563EB'))
    c.rect(info_x, info_y + 422, info_w, 28, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(info_x + 12, info_y + 432, "1. ROOM DIMENSIONS & GEOMETRY")

    specs = [
        ("Hall Identifier:", "hall-1 (Turing Hall / Grand Pavilion)"),
        ("Room Width (W):", "20.00 Meters (65.62 Feet)"),
        ("Room Length (L):", "30.00 Meters (98.43 Feet)"),
        ("Ceiling Clearance (H):", "5.50 Meters (18.04 Feet)"),
        ("Gross Floor Area:", "600.00 m² (6,458.35 sq ft)"),
        ("Active Egress Portals:", "2 Portals (Gate A + Gate B)"),
    ]

    curr_spec_y = info_y + 406
    for label, val in specs:
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(colors.HexColor('#334155'))
        c.drawString(info_x + 12, curr_spec_y, label)
        c.setFont("Helvetica", 8.5)
        c.setFillColor(colors.HexColor('#0F172A'))
        c.drawRightString(info_x + info_w - 12, curr_spec_y, val)
        curr_spec_y -= 15

    # Section 2: Calculated Capacity Standards (Neubrutalist Table)
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor('#0F172A'))
    c.setLineWidth(2)
    c.rect(info_x, info_y + 115, info_w, 185, stroke=1, fill=1)

    c.setFillColor(colors.HexColor('#16A34A'))
    c.rect(info_x, info_y + 272, info_w, 28, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(info_x + 12, info_y + 282, "2. LIFE SAFETY & OCCUPANCY CAPACITY")

    # Table Header
    c.setFillColor(colors.HexColor('#F1F5F9'))
    c.rect(info_x + 8, info_y + 246, info_w - 16, 20, stroke=1, fill=1)
    c.setFillColor(colors.HexColor('#0F172A'))
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(info_x + 14, info_y + 252, "STANDARD")
    c.drawString(info_x + 105, info_y + 252, "DENSITY")
    c.drawRightString(info_x + info_w - 14, info_y + 252, "MAX CAPACITY")

    cap_rows = [
        ("Safe Fire Egress", "1.80 m² / pax", "333 PAX", colors.HexColor('#16A34A'), "RECOMMENDED"),
        ("High-Density Seating", "1.40 m² / pax", "429 PAX", colors.HexColor('#2563EB'), "CONFERENCE"),
        ("Standing Reception", "0.75 m² / pax", "800 PAX", colors.HexColor('#D97706'), "MAX PEAK"),
        ("Doorway Clear Width", "1.20 m / door", "3.60 METERS", colors.HexColor('#0F172A'), "NFPA COMPLIANT"),
        ("Evacuation Discharge", "90 pax/min/door", "180 PAX/MIN", colors.HexColor('#DC2626'), "SAFE EGRESS"),
    ]

    r_y = info_y + 226
    for std, density, cap, col, badge in cap_rows:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.HexColor('#1E293B'))
        c.drawString(info_x + 14, r_y, std)
        
        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor('#64748B'))
        c.drawString(info_x + 105, r_y, density)
        
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(col)
        c.drawRightString(info_x + info_w - 14, r_y, cap)
        
        c.setStrokeColor(colors.HexColor('#E2E8F0'))
        c.setLineWidth(0.5)
        c.line(info_x + 8, r_y - 4, info_x + info_w - 8, r_y - 4)
        r_y -= 21

    # Section 3: Ephemeral Storage & Privacy Protocol Block
    c.setFillColor(colors.HexColor('#FFFBEB'))
    c.setStrokeColor(colors.HexColor('#F59E0B'))
    c.setLineWidth(1.5)
    c.rect(info_x, info_y, info_w, 105, stroke=1, fill=1)

    c.setFillColor(colors.HexColor('#B45309'))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(info_x + 12, info_y + 88, "🛡️ EPHEMERAL IN-MEMORY RETENTION GUARANTEE")

    c.setFillColor(colors.HexColor('#78350F'))
    c.setFont("Helvetica", 7.5)
    e_text = [
        "- File buffer retained ephemerally in RAM (Zero permanent disk trace).",
        "- Automated TTL Background Reaper triggers precisely 2.0 hours post-event.",
        "- IoT Laser Tripwire telemetry stream strictly monitors live headcount delta.",
        "- Safe capacity automatically triggers AI Self-Healing agent if threshold exceeded."
    ]
    e_y = info_y + 72
    for line in e_text:
        c.drawString(info_x + 12, e_y, line)
        e_y -= 13

    # Technical Stamp Box
    c.setFillColor(colors.HexColor('#0F172A'))
    c.rect(info_x + info_w - 90, info_y + 10, 80, 24, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(info_x + info_w - 50, info_y + 22, "DELTA-VERIFIED")
    c.setFont("Helvetica", 6)
    c.setFillColor(colors.HexColor('#38BDF8'))
    c.drawCentredString(info_x + info_w - 50, info_y + 14, "SPATIAL ENGINE 3.5")

    c.showPage()
    c.save()
    print(f"Generated Blueprint PDF: {filename} ({os.path.getsize(filename)} bytes)")

def generate_presentation_pdf(filename):
    """
    Generates a realistic keynote presentation slides PDF
    for 'Advanced WebAssembly Runtimes & Edge Swarms' by Dr. Elena Rostova
    to test the presentation slides ingestion pipeline.
    """
    c = canvas.Canvas(filename, pagesize=landscape(letter))
    width, height = landscape(letter)

    # ------------------ SLIDE 1: TITLE SLIDE ------------------
    # Background
    c.setFillColor(colors.HexColor('#0F172A'))
    c.rect(0, 0, width, height, stroke=0, fill=1)

    # Top accent line
    c.setFillColor(colors.HexColor('#2563EB'))
    c.rect(0, height - 8, width, 8, stroke=0, fill=1)

    # Decorative dots / grid
    c.setFillColor(colors.HexColor('#1E293B'))
    for x in range(40, int(width), 40):
        for y in range(40, int(height), 40):
            c.circle(x, y, 1.5, stroke=0, fill=1)

    # Badge
    c.setFillColor(colors.HexColor('#1D4ED8'))
    c.roundRect(60, height - 120, 160, 26, 4, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(140, height - 108, "KEYNOTE SESSION [TECH-401]")

    # Main Title
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 32)
    c.drawString(60, height - 180, "Advanced WebAssembly Runtimes")
    c.setFillColor(colors.HexColor('#38BDF8'))
    c.drawString(60, height - 225, "& Edge Swarms")

    # Subtitle
    c.setFillColor(colors.HexColor('#94A3B8'))
    c.setFont("Helvetica", 14)
    c.drawString(60, height - 270, "Architecting Low-Latency Autonomous Edge Intelligence with Sandboxed WASM")

    # Speaker Card
    c.setFillColor(colors.HexColor('#1E293B'))
    c.setStrokeColor(colors.HexColor('#334155'))
    c.setLineWidth(1)
    c.roundRect(60, 80, 480, 120, 8, stroke=1, fill=1)

    c.setFillColor(colors.HexColor('#3B82F6'))
    c.circle(110, 140, 32, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(110, 134, "ER")

    c.setFont("Helvetica-Bold", 14)
    c.drawString(160, 155, "Dr. Elena Rostova")
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor('#94A3B8'))
    c.drawString(160, 135, "Principal Research Scientist, Autonomous Distributed Systems")
    c.drawString(160, 118, "DELTAengine Systems Architecture Group")

    # Tags
    tags = ["#Wasm", "#Rust", "#EdgeSwarm", "#DistributedAI", "#LowLatency"]
    tag_x = 160
    for tag in tags:
        c.setFillColor(colors.HexColor('#0F172A'))
        c.roundRect(tag_x, 92, len(tag)*7 + 10, 18, 3, stroke=0, fill=1)
        c.setFillColor(colors.HexColor('#38BDF8'))
        c.setFont("Helvetica-Bold", 8)
        c.drawString(tag_x + 5, 97, tag)
        tag_x += len(tag)*7 + 16

    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor('#64748B'))
    c.drawRightString(width - 60, 95, "DELTAengine HackIndia 2026")

    c.showPage()

    # ------------------ SLIDE 2: ARCHITECTURE OVERVIEW ------------------
    c.setFillColor(colors.HexColor('#F8FAFC'))
    c.rect(0, 0, width, height, stroke=0, fill=1)

    # Header
    c.setFillColor(colors.HexColor('#0F172A'))
    c.rect(0, height - 60, width, 60, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, height - 38, "System Architecture: Distributed Sandboxed WASM")
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor('#38BDF8'))
    c.drawRightString(width - 40, height - 38, "SLIDE 2 / 3")

    # Column 1
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor('#E2E8F0'))
    c.roundRect(40, 80, 210, 420, 8, stroke=1, fill=1)
    c.setFillColor(colors.HexColor('#2563EB'))
    c.roundRect(40, 460, 210, 40, 6, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(145, 475, "1. EDGE INGESTION")
    
    col1_text = [
        "• Native WASM Bytecode compile",
        "• Memory isolation via Wasmtime",
        "• < 1.2ms cold start instantiation",
        "• Zero JIT overhead on ARM/x86",
        "• Direct hardware sensor binding"
    ]
    ty = 430
    c.setFillColor(colors.HexColor('#334155'))
    c.setFont("Helvetica", 9)
    for t in col1_text:
        c.drawString(55, ty, t)
        ty -= 25

    # Column 2
    c.setFillColor(colors.white)
    c.roundRect(290, 80, 210, 420, 8, stroke=1, fill=1)
    c.setFillColor(colors.HexColor('#16A34A'))
    c.roundRect(290, 460, 210, 40, 6, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(395, 475, "2. SWARM CONSENSUS")
    
    col2_text = [
        "• Peer-to-peer WebRTC mesh",
        "• CRDT state synchronization",
        "• Ephemeral session memory",
        "• Automatic network partition heal",
        "• Cryptographic token exchange"
    ]
    ty = 430
    c.setFillColor(colors.HexColor('#334155'))
    c.setFont("Helvetica", 9)
    for t in col2_text:
        c.drawString(305, ty, t)
        ty -= 25

    # Column 3
    c.setFillColor(colors.white)
    c.roundRect(540, 80, 210, 420, 8, stroke=1, fill=1)
    c.setFillColor(colors.HexColor('#7C3AED'))
    c.roundRect(540, 460, 210, 40, 6, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(645, 475, "3. AUTONOMOUS HEALING")
    
    col3_text = [
        "• Closed-loop real-time monitor",
        "• Hall capacity overflow alerts",
        "• Dynamic schedule rescheduling",
        "• Zero human intervention SLA",
        "• Multi-agent arbitration matrix"
    ]
    ty = 430
    c.setFillColor(colors.HexColor('#334155'))
    c.setFont("Helvetica", 9)
    for t in col3_text:
        c.drawString(555, ty, t)
        ty -= 25

    c.showPage()
    c.save()
    print(f"Generated Presentation PDF: {filename} ({os.path.getsize(filename)} bytes)")

def generate_blueprint_image(filename):
    """
    Generates a high-resolution 1200x900 architectural blueprint PNG photo
    for Turing Hall (Hall 1) for photo ingestion testing.
    """
    from PIL import Image, ImageDraw, ImageFont

    w, h = 1200, 900
    img = Image.new('RGB', (w, h), color='#F8FAFC')
    draw = ImageDraw.Draw(img)

    # Outer border
    draw.rectangle([20, 20, w - 20, h - 20], outline='#0F172A', width=5)
    draw.rectangle([30, 30, w - 30, h - 30], outline='#2563EB', width=2)

    # Header Bar
    draw.rectangle([30, 30, w - 30, 110], fill='#1E293B')
    draw.text((50, 45), "DELTAengine ARCHITECTURAL BLUEPRINT & SPATIAL ROOM PLAN", fill='#FFFFFF')
    draw.text((50, 75), "TARGET: TURING HALL (HALL-1)  |  DIMENSIONS: 20m x 30m = 600m²  |  CLEAR CEILING: 5.5m", fill='#38BDF8')
    draw.text((w - 380, 50), "DOC ID: DELTA-BLPRNT-2026-H1", fill='#94A3B8')
    draw.text((w - 380, 75), "SCALE: 1:100 (METRIC) | EPHEMERAL TTL: 2.0h", fill='#94A3B8')

    # Drawing Box
    cad_x, cad_y, cad_w, cad_h = 50, 140, 680, 710
    draw.rectangle([cad_x, cad_y, cad_x + cad_w, cad_y + cad_h], fill='#FFFFFF', outline='#CBD5E1', width=2)

    # Grid lines
    for x in range(cad_x + 25, cad_x + cad_w, 35):
        draw.line([(x, cad_y), (x, cad_y + cad_h)], fill='#F1F5F9', width=1)
    for y in range(cad_y + 25, cad_y + cad_h, 35):
        draw.line([(cad_x, y), (cad_x + cad_w, y)], fill='#F1F5F9', width=1)

    # Outer walls of Hall
    rx, ry, rw, rh = cad_x + 80, cad_y + 60, 520, 600
    draw.rectangle([rx, ry, rx + rw, ry + rh], outline='#0F172A', width=6)
    draw.rectangle([rx - 4, ry - 4, rx + rw + 4, ry + rh + 4], outline='#3B82F6', width=2)

    # Dimension lines
    draw.line([(rx, ry + rh + 25), (rx + rw, ry + rh + 25)], fill='#EF4444', width=2)
    draw.text((rx + rw//2 - 90, ry + rh + 32), "<--- WIDTH = 20.0 METERS --->", fill='#EF4444')

    draw.line([(rx - 25, ry), (rx - 25, ry + rh)], fill='#EF4444', width=2)
    draw.text((rx - 70, ry + rh//2 - 10), "LENGTH\n30.0m", fill='#EF4444')

    # Keynote Stage
    sx, sy, sw, sh = rx + 80, ry + 30, rw - 160, 90
    draw.rectangle([sx, sy, sx + sw, sy + sh], fill='#DBEAFE', outline='#2563EB', width=3)
    draw.text((sx + sw//2 - 80, sy + 25), "MAIN KEYNOTE STAGE", fill='#1D4ED8')
    draw.text((sx + sw//2 - 130, sy + 50), "Elevated +0.85m | LED Video Wall | Podium", fill='#1E3A8A')

    # Aisle & Seating
    aisle_w = 40
    draw.rectangle([rx + (rw - aisle_w)//2, ry + 150, rx + (rw + aisle_w)//2, ry + rh - 40], fill='#F8FAFC', outline='#CBD5E1', width=1)
    draw.text((rx + rw//2 - 15, ry + rh//2), "A\nI\nS\nL\nE", fill='#94A3B8')

    # Seating blocks
    block_w = (rw - aisle_w - 70) // 2
    for row in range(9):
        curr_y = ry + 160 + row * 42
        draw.rectangle([rx + 25, curr_y, rx + 25 + block_w, curr_y + 22], fill='#D1FAE5', outline='#059669', width=2)
        draw.rectangle([rx + rw - 25 - block_w, curr_y, rx + rw - 25, curr_y + 22], fill='#D1FAE5', outline='#059669', width=2)

    # Gate A & Sensor
    draw.rectangle([rx + 30, ry - 6, rx + 110, ry + 6], fill='#22C55E', outline='#15803D', width=3)
    draw.text((rx + 25, ry - 35), "GATE A [INGRESS]", fill='#0F172A')
    draw.text((rx + 25, ry - 20), "Dual VL53L0X Laser LiDAR Tripwire", fill='#DC2626')

    # Gate B
    draw.rectangle([rx + rw - 120, ry + rh - 6, rx + rw - 40, ry + rh + 6], fill='#F97316', outline='#C2410C', width=3)
    draw.text((rx + rw - 150, ry + rh + 10), "GATE B [EMERGENCY EGRESS]", fill='#EA580C')

    # Right Info Panel
    ix, iy, iw, ih = 760, 140, 390, 710
    draw.rectangle([ix, iy, ix + iw, iy + 250], fill='#FFFFFF', outline='#0F172A', width=3)
    draw.rectangle([ix, iy, ix + iw, iy + 45], fill='#2563EB')
    draw.text((ix + 15, iy + 12), "1. ROOM DIMENSIONS & GEOMETRY", fill='#FFFFFF')

    spec_lines = [
        ("Hall ID:", "hall-1 (Turing Hall)"),
        ("Room Width:", "20.00 Meters"),
        ("Room Length:", "30.00 Meters"),
        ("Ceiling Clearance:", "5.50 Meters"),
        ("Floor Area:", "600.00 m² (6,458 sq ft)"),
        ("Portals:", "Gate A (IN) + Gate B (OUT)"),
    ]
    py = iy + 65
    for l, v in spec_lines:
        draw.text((ix + 15, py), l, fill='#475569')
        draw.text((ix + iw - 180, py), v, fill='#0F172A')
        py += 28

    # Capacity Box
    cy = iy + 270
    draw.rectangle([ix, cy, ix + iw, cy + 280], fill='#FFFFFF', outline='#0F172A', width=3)
    draw.rectangle([ix, cy, ix + iw, cy + 45], fill='#16A34A')
    draw.text((ix + 15, cy + 12), "2. LIFE SAFETY & CAPACITY LIMITS", fill='#FFFFFF')

    cap_lines = [
        ("Safe Fire Egress:", "333 PAX (1.80 m²/pax)"),
        ("High-Density Seating:", "429 PAX (1.40 m²/pax)"),
        ("Standing Reception:", "800 PAX (0.75 m²/pax)"),
        ("Door Clear Width:", "3.60 METERS (2 Doors)"),
        ("Evacuation Discharge:", "180 PAX / MINUTE"),
    ]
    cpy = cy + 65
    for l, v in cap_lines:
        draw.text((ix + 15, cpy), l, fill='#1E293B')
        draw.text((ix + iw - 190, cpy), v, fill='#16A34A')
        cpy += 38

    # Ephemeral Box
    ey = cy + 300
    draw.rectangle([ix, ey, ix + iw, ey + 140], fill='#FFFBEB', outline='#F59E0B', width=2)
    draw.text((ix + 15, ey + 15), "🛡️ EPHEMERAL STORAGE GUARANTEE", fill='#B45309')
    draw.text((ix + 15, ey + 45), "- In-memory RAM buffer only (Zero disk trace).", fill='#78350F')
    draw.text((ix + 15, ey + 70), "- 2.0 Hours post-event TTL auto-purge daemon.", fill='#78350F')
    draw.text((ix + 15, ey + 95), "- Telemetry binds directly to 3D spatial room model.", fill='#78350F')

    img.save(filename, format='PNG')
    print(f"Generated Blueprint Image: {filename} ({os.path.getsize(filename)} bytes)")

if __name__ == '__main__':
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, 'frontend')

    # Generate Room Blueprint PDF
    blueprint_root = os.path.join(root_dir, 'venue_room_plan_blueprint.pdf')
    blueprint_fe = os.path.join(frontend_dir, 'venue_room_plan_blueprint.pdf')
    generate_blueprint_pdf(blueprint_root)
    generate_blueprint_pdf(blueprint_fe)

    # Generate Room Blueprint PNG Photo
    blueprint_img_root = os.path.join(root_dir, 'venue_room_plan_blueprint.png')
    blueprint_img_fe = os.path.join(frontend_dir, 'venue_room_plan_blueprint.png')
    generate_blueprint_image(blueprint_img_root)
    generate_blueprint_image(blueprint_img_fe)

    # Generate Presentation Slides PDF
    presentation_root = os.path.join(root_dir, 'sample_advanced_wasm_presentation.pdf')
    presentation_fe = os.path.join(frontend_dir, 'sample_advanced_wasm_presentation.pdf')
    generate_presentation_pdf(presentation_root)
    generate_presentation_pdf(presentation_fe)

    print("All mock data files (PDFs and PNG) created successfully!")

