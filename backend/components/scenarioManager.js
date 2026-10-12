/**
 * DELTA ENGINE — Generalized Scenario Operations Layer
 * 
 * Manages configuration and operational models across varied real-world large gatherings:
 * 1. CONFERENCE (Existing baseline)
 * 2. PUBLIC RALLY (High-density political/civic gatherings)
 * 3. LARGE GATHERING (Cultural melas, fairs, exhibitions)
 * 4. MOVIE / PUBLICITY EVENT (Celebrity promotion & fan surges)
 * 5. LARGE CULTURAL / RELIGIOUS GATHERING (Pilgrimage & temple/ghat density)
 * 
 * NOTE: These are domain scenarios demonstrating engine flexibility, not claimed government integrations.
 */

const SCENARIOS = {
  CONFERENCE: {
    id: 'CONFERENCE',
    name: 'DELTA Tech Conference & Summit',
    category: 'Conference / Corporate Summit',
    description: 'Multi-track tech conference with scheduled keynote talks, speaker arrival constraints, and hall fire safety limits.',
    venue: {
      id: 'venue-conf-1',
      name: 'DELTA International Convention Center',
      totalCapacity: 830
    },
    zones: [
      { id: 'hall-1', name: 'Turing Hall', capacity: 250, safeDensity: 1.2, type: 'AUDITORIUM', connectedZones: ['hall-2', 'foyer-1'] },
      { id: 'hall-2', name: 'Lovelace Suite', capacity: 120, safeDensity: 1.0, type: 'WORKSHOP_ROOM', connectedZones: ['hall-1', 'hall-3', 'foyer-1'] },
      { id: 'hall-3', name: 'Hopper Room', capacity: 60, safeDensity: 0.9, type: 'BREAKOUT_ROOM', connectedZones: ['hall-2', 'foyer-1'] },
      { id: 'foyer-1', name: 'Main Lobby & Exhibition Foyer', capacity: 400, safeDensity: 1.8, type: 'CONCOURSE', connectedZones: ['hall-1', 'hall-2', 'hall-3', 'gate-a'] }
    ],
    entryExits: [
      { id: 'gate-a', name: 'Entrance Door A', direction: 'BIDIRECTIONAL', flowRateMax: 60, targetZone: 'foyer-1' },
      { id: 'exit-east', name: 'Emergency Egress East', direction: 'OUT', flowRateMax: 100, targetZone: 'foyer-1' }
    ],
    routes: [
      { from: 'foyer-1', to: 'hall-1', distanceMeters: 25, transitTimeSeconds: 30 },
      { from: 'foyer-1', to: 'hall-2', distanceMeters: 40, transitTimeSeconds: 45 },
      { from: 'hall-2', to: 'hall-3', distanceMeters: 15, transitTimeSeconds: 20 },
      { from: 'hall-1', to: 'hall-2', distanceMeters: 30, transitTimeSeconds: 35 }
    ],
    personnel: [
      { id: 'p_01', name: 'Aryan Pandey', role: 'Lead Event Coordinator & Systems Commander', phone: '+91 91542 76178', assignedZone: 'ALL' },
      { id: 'p_02', name: 'Suryansh', role: 'Crowd Safety & Entrance Lead', phone: '+91 83030 09159', assignedZone: 'gate-a' },
      { id: 'p_03', name: 'Shahid', role: 'Stage & Operations Coordinator', phone: '+91 63035 70916', assignedZone: 'hall-1' }
    ],
    resources: [
      { id: 'res_av_4k', name: '4K Ultra-Low-Latency Stream Rig', type: 'AV_EQUIPMENT', zoneId: 'hall-1' },
      { id: 'res_hvac_turing', name: 'IoT Climate HVAC Controller', type: 'FACILITY_CONTROL', zoneId: 'hall-1' },
      { id: 'res_clickers', name: 'Wireless Presentation Clickers & Microphones', type: 'STAGE_GEAR', zoneId: 'hall-1' },
      { id: 'res_signage', name: 'Dynamic LED Schedule Boards', type: 'SIGNAGE', zoneId: 'foyer-1' }
    ],
    telemetrySources: [
      'ESP32 VL53L0X Laser ToF Sensor',
      'Zebronics ZEB-CRYSTAL PRO 480p CCTV',
      'iCal Schedule Matrix State'
    ],
    possibleIncidents: [
      { type: 'OVER_CAPACITY', defaultSeverity: 'critical', desc: 'Keynote interest exceeds configured hall capacity limit.' },
      { type: 'SPEAKER_DELAY', defaultSeverity: 'warning', desc: 'Speaker delayed in transit, clashing with scheduled time window.' },
      { type: 'HVAC_CLIMATE_SURGE', defaultSeverity: 'info', desc: 'Room temperature spikes above comfortable range due to attendee density.' }
    ],
    supportedActions: [
      { id: 'act_reallocate_talk', type: 'REALLOCATE_VENUE', name: 'Reallocate Session to Larger Hall' },
      { id: 'act_shift_slot', type: 'RESCHEDULE_TIME', name: 'Shift Session to Later Time Slot' },
      { id: 'act_dispatch_volunteers', type: 'DEPLOY_PERSONNEL', name: 'Deploy Crowd Volunteers to Doorway' },
      { id: 'act_ical_sync', type: 'BROADCAST_SCHEDULE', name: 'Push Live iCal Calendar Updates' },
      { id: 'act_notify_whatsapp', type: 'DISPATCH_ALERT', name: 'Send Automated WhatsApp Notice to Coordinators' }
    ],
    dispatchChannels: ['WHATSAPP', 'EMAIL', 'WEBSOCKET_BROADCAST', 'ICAL']
  },

  PUBLIC_RALLY: {
    id: 'PUBLIC_RALLY',
    name: 'Civic Grounds Public Gathering & Rally',
    category: 'Public Rally & Mass Assembly',
    description: 'Open-air political or public civic address with central podium, VIP seating enclosures, media galleries, and large overflow grounds.',
    venue: {
      id: 'venue-rally-1',
      name: 'National Civic Pavilion Grounds',
      totalCapacity: 31100
    },
    zones: [
      { id: 'rally-stage', name: 'Main Dignitary Stage Lawn', capacity: 5000, safeDensity: 2.0, type: 'STAGE_ENCLOSURE', connectedZones: ['rally-vip', 'rally-media', 'rally-grounds'] },
      { id: 'rally-vip', name: 'VIP & Executive Seating Arena', capacity: 800, safeDensity: 1.0, type: 'RESTRICTED_SEATING', connectedZones: ['rally-stage', 'rally-grounds'] },
      { id: 'rally-media', name: 'Media & Broadcast Enclosure', capacity: 300, safeDensity: 1.2, type: 'MEDIA_PRESS', connectedZones: ['rally-stage', 'rally-grounds'] },
      { id: 'rally-grounds', name: 'General Public Grounds (Sector A-D)', capacity: 15000, safeDensity: 2.5, type: 'OPEN_GROUNDS', connectedZones: ['rally-stage', 'rally-overflow', 'gate-north', 'gate-south'] },
      { id: 'rally-overflow', name: 'East Overflow Park & Screenings', capacity: 8000, safeDensity: 2.0, type: 'OVERFLOW_LAWN', connectedZones: ['rally-grounds', 'gate-east-overflow'] },
      { id: 'gate-north', name: 'North Gate Concourse', capacity: 2000, safeDensity: 2.0, type: 'ENTRY_PLAZA', connectedZones: ['rally-grounds'] },
      { id: 'gate-south', name: 'South Gate Concourse', capacity: 2000, safeDensity: 2.0, type: 'ENTRY_PLAZA', connectedZones: ['rally-grounds'] }
    ],
    entryExits: [
      { id: 'gate-north-in', name: 'North Gate Turnstiles', direction: 'IN', flowRateMax: 400, targetZone: 'gate-north' },
      { id: 'gate-south-in', name: 'South Gate Turnstiles', direction: 'IN', flowRateMax: 400, targetZone: 'gate-south' },
      { id: 'exit-west-1', name: 'West Perimeter Egress 1', direction: 'OUT', flowRateMax: 500, targetZone: 'rally-grounds' },
      { id: 'exit-west-2', name: 'West Perimeter Egress 2', direction: 'OUT', flowRateMax: 500, targetZone: 'rally-grounds' },
      { id: 'gate-east-overflow', name: 'East Overflow Access Gate', direction: 'BIDIRECTIONAL', flowRateMax: 300, targetZone: 'rally-overflow' }
    ],
    routes: [
      { from: 'gate-north', to: 'rally-grounds', distanceMeters: 60, transitTimeSeconds: 70 },
      { from: 'gate-south', to: 'rally-grounds', distanceMeters: 60, transitTimeSeconds: 70 },
      { from: 'rally-grounds', to: 'rally-overflow', distanceMeters: 80, transitTimeSeconds: 90 },
      { from: 'rally-grounds', to: 'exit-west-1', distanceMeters: 40, transitTimeSeconds: 45 }
    ],
    personnel: [
      { id: 'p_rally_cmd', name: 'Operations Commander', role: 'Chief Rally Operations Officer', phone: '+91 91542 76178', assignedZone: 'ALL' },
      { id: 'p_rally_north', name: 'North Concourse Marshal', role: 'Perimeter Security Lead', phone: '+91 83030 09159', assignedZone: 'gate-north' },
      { id: 'p_rally_stage', name: 'Stage Security Lead', role: 'Stage Front Safety Marshal', phone: '+91 63035 70916', assignedZone: 'rally-stage' },
      { id: 'p_rally_medical', name: 'Medical Response Officer', role: 'First Aid & Ambulance Lead', phone: '+91 98112 23344', assignedZone: 'rally-grounds' }
    ],
    resources: [
      { id: 'res_barricades_heavy', name: 'Heavy MOJ Steel Barricades', type: 'PERIMETER_BARRIER', zoneId: 'rally-stage' },
      { id: 'res_loudspeaker_pa', name: 'Long-Throw Horn Public Address Cluster', type: 'AUDIO_PA', zoneId: 'rally-grounds' },
      { id: 'res_led_screens', name: 'Mobile 4K LED Screen Trucks (x4)', type: 'BROADCAST_DISPLAY', zoneId: 'rally-overflow' },
      { id: 'res_water_misters', name: 'High-Pressure Cooling Water Misters', type: 'RELIEF_AMENITY', zoneId: 'rally-grounds' }
    ],
    telemetrySources: [
      'Turnstile Optical Headcount Sensors',
      'Overhead Drone Thermal Density Feeds',
      'Barrier Pressure & Strain Transducers',
      'Perimeter Marshal Radio Reports'
    ],
    possibleIncidents: [
      { type: 'OVER_CAPACITY', defaultSeverity: 'emergency', desc: 'General Public Grounds surge past 15,000 capacity limit.' },
      { type: 'ENTRY_BOTTLENECK', defaultSeverity: 'critical', desc: 'North Gate inflow exceeds 400 pax/min causing street queue congestion.' },
      { type: 'STAGE_PERIMETER_BREACH', defaultSeverity: 'emergency', desc: 'Crowd surge compresses stage barricade safety gap.' }
    ],
    supportedActions: [
      { id: 'act_restrict_gate_inflow', type: 'RESTRICT_INGRESS', name: 'Throttle Entry Gate Turnstiles' },
      { id: 'act_activate_overflow_park', type: 'ACTIVATE_OVERFLOW', name: 'Open East Overflow Park with LED Relay' },
      { id: 'act_divert_south_corridor', type: 'REROUTE_CROWD', name: 'Divert Incoming Traffic to South Concourse' },
      { id: 'act_pa_announcement', type: 'PUBLIC_ANNOUNCEMENT', name: 'Broadcast Audio Public Advisory via Long-Throw PA' },
      { id: 'act_deploy_marshals', type: 'DEPLOY_PERSONNEL', name: 'Deploy Rapid Response Marshals to Perimeter' }
    ],
    dispatchChannels: ['WHATSAPP', 'PUBLIC_AUDIO_PA', 'WEBSOCKET_BROADCAST']
  },

  LARGE_GATHERING: {
    id: 'LARGE_GATHERING',
    name: 'Grand Cultural Fair & Trade Mela',
    category: 'Mela / Exhibition / Fairground',
    description: 'High-footfall multi-pavilion fairground featuring exhibition stalls, food courts, amusement rides, and family entertainment.',
    venue: {
      id: 'venue-fair-1',
      name: 'Pragati Cultural Fairgrounds',
      totalCapacity: 18500
    },
    zones: [
      { id: 'fair-pavilions', name: 'Handicraft & Trade Pavilions A-C', capacity: 3000, safeDensity: 1.5, type: 'INDOOR_EXHIBIT', connectedZones: ['fair-promenade'] },
      { id: 'fair-plaza', name: 'Food & Cultural Performance Plaza', capacity: 2500, safeDensity: 1.8, type: 'DINING_ENTERTAINMENT', connectedZones: ['fair-promenade', 'fair-rides'] },
      { id: 'fair-promenade', name: 'Central Boulevard & Promenade', capacity: 6000, safeDensity: 2.0, type: 'CENTRAL_WALKWAY', connectedZones: ['fair-pavilions', 'fair-plaza', 'fair-rides', 'gate-west', 'gate-east'] },
      { id: 'fair-rides', name: 'Amusement Carnival & Rides Sector', capacity: 4000, safeDensity: 1.6, type: 'AMUSEMENT_RIDES', connectedZones: ['fair-plaza', 'fair-promenade'] },
      { id: 'gate-west', name: 'West Gate Entry Plaza', capacity: 1500, safeDensity: 1.8, type: 'ENTRY_PLAZA', connectedZones: ['fair-promenade'] },
      { id: 'gate-east', name: 'East Gate Entry Plaza', capacity: 1500, safeDensity: 1.8, type: 'ENTRY_PLAZA', connectedZones: ['fair-promenade'] }
    ],
    entryExits: [
      { id: 'gate-west-in', name: 'West Turnstile Gates (1-6)', direction: 'IN', flowRateMax: 250, targetZone: 'gate-west' },
      { id: 'gate-east-in', name: 'East Turnstile Gates (1-6)', direction: 'IN', flowRateMax: 250, targetZone: 'gate-east' },
      { id: 'exit-south-egress', name: 'South Emergency Corridor', direction: 'OUT', flowRateMax: 400, targetZone: 'fair-promenade' }
    ],
    routes: [
      { from: 'gate-west', to: 'fair-promenade', distanceMeters: 45, transitTimeSeconds: 50 },
      { from: 'gate-east', to: 'fair-promenade', distanceMeters: 45, transitTimeSeconds: 50 },
      { from: 'fair-promenade', to: 'fair-plaza', distanceMeters: 30, transitTimeSeconds: 35 },
      { from: 'fair-promenade', to: 'fair-pavilions', distanceMeters: 25, transitTimeSeconds: 30 }
    ],
    personnel: [
      { id: 'p_fair_dir', name: 'Fairground Director', role: 'Head of Fair Operations', phone: '+91 91542 76178', assignedZone: 'ALL' },
      { id: 'p_fair_west', name: 'West Gate Marshal', role: 'Ticketing & Ingress Lead', phone: '+91 83030 09159', assignedZone: 'gate-west' },
      { id: 'p_fair_safety', name: 'Safety & Inspection Marshal', role: 'Aisle Clearance Lead', phone: '+91 63035 70916', assignedZone: 'fair-promenade' }
    ],
    resources: [
      { id: 'res_stanchions', name: 'Tensile Ribbon Crowd Stanchions', type: 'CROWD_CORRIDOR', zoneId: 'fair-promenade' },
      { id: 'res_gate_displays', name: 'Electronic Gate Status Signage', type: 'SIGNAGE', zoneId: 'gate-west' },
      { id: 'res_lost_booth', name: 'Lost Child & Information Assistance Kiosk', type: 'PUBLIC_SERVICE', zoneId: 'fair-plaza' }
    ],
    telemetrySources: [
      'Ticket Scanning Turnstile Logs',
      'Optical Foot-Traffic Sensors',
      'Food Court CCTV Density Streams'
    ],
    possibleIncidents: [
      { type: 'ENTRY_BOTTLENECK', defaultSeverity: 'warning', desc: 'West Gate ticket line backs up into outer approach road.' },
      { type: 'OVER_CAPACITY', defaultSeverity: 'critical', desc: 'Central Promenade congestion compromises safe egress.' }
    ],
    supportedActions: [
      { id: 'act_throttle_ticketing', type: 'RESTRICT_INGRESS', name: 'Throttle Ticket Scanning Pace' },
      { id: 'act_redirect_east_gate', type: 'REROUTE_CROWD', name: 'Redirect Arriving Visitors to East Gate Plaza' },
      { id: 'act_clear_fire_lane', type: 'CLEAR_AISLE', name: 'Deploy Marshals to Clear Central Promenade Fire Lane' },
      { id: 'act_public_advisory', type: 'PUBLIC_ANNOUNCEMENT', name: 'Broadcast Lost Child & Directional Notice' }
    ],
    dispatchChannels: ['WHATSAPP', 'PUBLIC_AUDIO_PA', 'WEBSOCKET_BROADCAST']
  },

  MOVIE_PROMO: {
    id: 'MOVIE_PROMO',
    name: 'Blockbuster Film Launch & Celebrity Fan Meet',
    category: 'Film Promotion & Entertainment',
    description: 'High-energy promotional gathering at a shopping mall atrium with celebrity cast arrival, red carpet, and multi-tier viewing rings.',
    venue: {
      id: 'venue-mall-1',
      name: 'Grand Galleria Mall Atrium Complex',
      totalCapacity: 6050
    },
    zones: [
      { id: 'promo-atrium', name: 'Mall Atrium Ground Zero', capacity: 1200, safeDensity: 1.5, type: 'CENTRAL_ATRIUM', connectedZones: ['promo-carpet', 'promo-gallery-l1'] },
      { id: 'promo-carpet', name: 'Red Carpet Celebrity Walkway', capacity: 400, safeDensity: 0.8, type: 'EXCLUSIVE_CORRIDOR', connectedZones: ['promo-atrium', 'promo-lounge'] },
      { id: 'promo-gallery-l1', name: 'Viewing Ring Level 1', capacity: 800, safeDensity: 1.2, type: 'BALCONY_VIEW', connectedZones: ['promo-atrium', 'promo-gallery-l2'] },
      { id: 'promo-gallery-l2', name: 'Viewing Ring Level 2', capacity: 800, safeDensity: 1.2, type: 'BALCONY_VIEW', connectedZones: ['promo-gallery-l1', 'promo-gallery-l3'] },
      { id: 'promo-gallery-l3', name: 'Viewing Ring Level 3', capacity: 800, safeDensity: 1.2, type: 'BALCONY_VIEW', connectedZones: ['promo-gallery-l2'] },
      { id: 'promo-lounge', name: 'Celebrity Green Room & Secure Holding', capacity: 50, safeDensity: 0.5, type: 'VIP_RESTRICTED', connectedZones: ['promo-carpet'] },
      { id: 'promo-multiplex', name: 'Multiplex Ingress Foyer', capacity: 600, safeDensity: 1.2, type: 'CINEMA_CONCOURSE', connectedZones: ['promo-gallery-l3'] }
    ],
    entryExits: [
      { id: 'mall-main-doors', name: 'Galleria Main Glass Doors', direction: 'IN', flowRateMax: 180, targetZone: 'promo-atrium' },
      { id: 'escalators-l1', name: 'Central Atrium Upward Escalators', direction: 'BIDIRECTIONAL', flowRateMax: 100, targetZone: 'promo-gallery-l1' },
      { id: 'vip-elevator', name: 'Secure Freight Elevator', direction: 'BIDIRECTIONAL', flowRateMax: 30, targetZone: 'promo-lounge' }
    ],
    routes: [
      { from: 'promo-atrium', to: 'promo-carpet', distanceMeters: 15, transitTimeSeconds: 15 },
      { from: 'promo-carpet', to: 'promo-lounge', distanceMeters: 20, transitTimeSeconds: 20 },
      { from: 'promo-atrium', to: 'promo-gallery-l1', distanceMeters: 35, transitTimeSeconds: 40 }
    ],
    personnel: [
      { id: 'p_mall_sec', name: 'Chief Security Officer', role: 'Mall Protection Director', phone: '+91 91542 76178', assignedZone: 'ALL' },
      { id: 'p_vip_liaison', name: 'Celebrity Security Liaison', role: 'Talent Protection Lead', phone: '+91 83030 09159', assignedZone: 'promo-carpet' },
      { id: 'p_floor_marshal', name: 'Floor Marshal Lead', role: 'Balcony Railing Monitor', phone: '+91 63035 70916', assignedZone: 'promo-gallery-l1' }
    ],
    resources: [
      { id: 'res_velvet_barriers', name: 'Reinforced Chrome Tensabarriers', type: 'BUFFER_ZONE', zoneId: 'promo-carpet' },
      { id: 'res_security_radios', name: 'Encrypted Security Transceivers', type: 'COMMUNICATION', zoneId: 'promo-atrium' },
      { id: 'res_railing_nets', name: 'High-Impact Safety Railing Guards', type: 'FALL_PROTECTION', zoneId: 'promo-gallery-l1' }
    ],
    telemetrySources: [
      'Atrium High-Angle CCTV Density Camera',
      'Escalator Ingress Sensor Beams',
      'VIP Access Card Readers'
    ],
    possibleIncidents: [
      { type: 'STAGE_PERIMETER_BREACH', defaultSeverity: 'emergency', desc: 'Over-excited fans surge past velvet barrier toward celebrity walkway.' },
      { type: 'OVER_CAPACITY', defaultSeverity: 'critical', desc: 'Ground Atrium occupancy reaches crush threshold.' }
    ],
    supportedActions: [
      { id: 'act_lock_escalator_ingress', type: 'LOCK_INGRESS', name: 'Lock Ground-to-L1 Escalator to Halt Atrium Compression' },
      { id: 'act_widen_red_carpet_buffer', type: 'EXPAND_BUFFER', name: 'Widen Security Buffer Around Red Carpet' },
      { id: 'act_route_fans_upper_rings', type: 'REROUTE_CROWD', name: 'Guide Arriving Fans Directly to Levels 2 & 3' },
      { id: 'act_secure_vip_egress', type: 'SECURE_EGRESS', name: 'Prepare Rapid Secure Green Room Evacuation Route' }
    ],
    dispatchChannels: ['WHATSAPP', 'SECURITY_RADIO', 'WEBSOCKET_BROADCAST']
  },

  RELIGIOUS_GATHERING: {
    id: 'RELIGIOUS_GATHERING',
    name: 'River Ghats Pilgrimage & Sanctum Gathering',
    category: 'Pilgrimage & Sacred Festival',
    description: 'Vast religious gathering with sacred river bathing steps, holding pens, sanctum queue channels, and historic pedestrian bridges.',
    venue: {
      id: 'venue-ghats-1',
      name: 'Holy Sangam Riverbank & Temple Precinct',
      totalCapacity: 18700
    },
    zones: [
      { id: 'ghat-steps', name: 'Sacred River Snan Ghat Steps', capacity: 4000, safeDensity: 1.2, type: 'WATERFRONT_STEPS', connectedZones: ['pen-alpha', 'bridge-east'] },
      { id: 'pen-alpha', name: 'Holding Pen Alpha (Staging Lawn)', capacity: 3500, safeDensity: 2.5, type: 'HOLDING_PEN', connectedZones: ['ghat-steps', 'sanctum-queue'] },
      { id: 'pen-beta', name: 'Holding Pen Beta (Reserve Lawn)', capacity: 3500, safeDensity: 2.5, type: 'HOLDING_PEN', connectedZones: ['pen-alpha', 'bridge-west'] },
      { id: 'sanctum-queue', name: 'Inner Sanctum Queue Barricade Channel', capacity: 1800, safeDensity: 1.5, type: 'SERPENTINE_QUEUE', connectedZones: ['pen-alpha', 'temple-inner'] },
      { id: 'temple-inner', name: 'Temple Inner Sanctum & Darshan Hall', capacity: 700, safeDensity: 1.0, type: 'SACRED_INTERIOR', connectedZones: ['sanctum-queue', 'exit-temple'] },
      { id: 'bridge-east', name: 'East Pedestrian Footbridge', capacity: 1200, safeDensity: 1.0, type: 'BRIDGE_CORRIDOR', connectedZones: ['ghat-steps'] },
      { id: 'bridge-west', name: 'West Pedestrian Footbridge', capacity: 1200, safeDensity: 1.0, type: 'BRIDGE_CORRIDOR', connectedZones: ['pen-beta'] },
      { id: 'exit-temple', name: 'Sanctum Egress Arch & Dispensary', capacity: 800, safeDensity: 1.2, type: 'EGRESS_PLAZA', connectedZones: ['bridge-west'] }
    ],
    entryExits: [
      { id: 'ghat-main-arch', name: 'Ghat Main Ingress Arch', direction: 'IN', flowRateMax: 300, targetZone: 'pen-alpha' },
      { id: 'bridge-east-in', name: 'East Bridge One-Way Entry', direction: 'IN', flowRateMax: 150, targetZone: 'bridge-east' },
      { id: 'bridge-west-out', name: 'West Bridge One-Way Exit', direction: 'OUT', flowRateMax: 200, targetZone: 'bridge-west' }
    ],
    routes: [
      { from: 'pen-alpha', to: 'ghat-steps', distanceMeters: 50, transitTimeSeconds: 60 },
      { from: 'pen-alpha', to: 'sanctum-queue', distanceMeters: 30, transitTimeSeconds: 40 },
      { from: 'sanctum-queue', to: 'temple-inner', distanceMeters: 40, transitTimeSeconds: 50 },
      { from: 'temple-inner', to: 'exit-temple', distanceMeters: 25, transitTimeSeconds: 30 }
    ],
    personnel: [
      { id: 'p_magistrate', name: 'Zonal Magistrate Liaison', role: 'Civil Administration Controller', phone: '+91 91542 76178', assignedZone: 'ALL' },
      { id: 'p_ghat_lead', name: 'Ghat Safety Commander', role: 'Riverfront Life-Safety Lead', phone: '+91 83030 09159', assignedZone: 'ghat-steps' },
      { id: 'p_pen_marshal', name: 'Holding Pen Dispatcher', role: 'Queue Batch Release Marshal', phone: '+91 63035 70916', assignedZone: 'pen-alpha' },
      { id: 'p_bridge_guard', name: 'Bridge Flow Marshal', role: 'Unidirectional Footbridge Enforcer', phone: '+91 98112 23344', assignedZone: 'bridge-east' }
    ],
    resources: [
      { id: 'res_bamboo_ballis', name: 'Heavy Sal Bamboo Barricade Arrays', type: 'HOLDING_GRID', zoneId: 'pen-alpha' },
      { id: 'res_water_rescue', name: 'Motorized Rescue Inflatables & Life Buoys', type: 'WATER_RESCUE', zoneId: 'ghat-steps' },
      { id: 'res_loudspeaker_grid', name: 'Riverfront Horn Speaker Audio Array', type: 'PUBLIC_BROADCAST', zoneId: 'ghat-steps' },
      { id: 'res_emergency_dispensary', name: 'Mobile Paramedic Trauma Post', type: 'MEDICAL_CARE', zoneId: 'exit-temple' }
    ],
    telemetrySources: [
      'Ghat Optical Water-Level & Crowd CCTV',
      'Bridge Structural Strain & Optical Counters',
      'Holding Pen Gate Pulse Scanners'
    ],
    possibleIncidents: [
      { type: 'OVER_CAPACITY', defaultSeverity: 'emergency', desc: 'River Ghat Steps exceed 4,000 pilgrims creating water edge slip hazard.' },
      { type: 'ENTRY_BOTTLENECK', defaultSeverity: 'critical', desc: 'East Footbridge experiences counter-flow congestion.' },
      { type: 'HOLDING_PEN_OVERFLOW', defaultSeverity: 'warning', desc: 'Holding Pen Alpha reaches 90% capacity waiting for Sanctum queue opening.' }
    ],
    supportedActions: [
      { id: 'act_phased_pen_release', type: 'BATCH_RELEASE', name: 'Release Holding Pen in Phased 500-Person Batches' },
      { id: 'act_enforce_oneway_bridge', type: 'ENFORCE_ONEWAY', name: 'Close East Bridge Entry to Prevent Counter-Flow' },
      { id: 'act_restrict_water_edge', type: 'CORDON_ZONE', name: 'Deploy Volunteer Rope-Line to Seal Lower River Steps' },
      { id: 'act_ghat_pa_broadcast', type: 'PUBLIC_ANNOUNCEMENT', name: 'Broadcast Calm Chanting & Flow Instructions over Loudspeaker Array' }
    ],
    dispatchChannels: ['WHATSAPP', 'PUBLIC_AUDIO_PA', 'WEBSOCKET_BROADCAST']
  }
};

let activeScenarioId = 'CONFERENCE';

function getScenarios() {
  return Object.values(SCENARIOS).map(s => ({
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    venueName: s.venue.name,
    totalCapacity: s.venue.totalCapacity,
    zonesCount: s.zones.length,
    telemetryCount: s.telemetrySources.length,
    incidentsCount: s.possibleIncidents.length,
    actionsCount: s.supportedActions.length
  }));
}

function getScenario(id) {
  return SCENARIOS[id] || SCENARIOS.CONFERENCE;
}

function getActiveScenario() {
  return SCENARIOS[activeScenarioId] || SCENARIOS.CONFERENCE;
}

function setActiveScenario(id) {
  if (SCENARIOS[id]) {
    activeScenarioId = id;
  }
  return getActiveScenario();
}

/**
 * Returns graph nodes and edges representation for any scenario
 */
function getScenarioGraph(id) {
  const scenario = getScenario(id);
  const nodes = [];
  const edges = [];

  // Venue node
  nodes.push({
    id: scenario.venue.id,
    label: scenario.venue.name,
    type: 'venue',
    capacity: scenario.venue.totalCapacity
  });

  // Zone nodes
  scenario.zones.forEach(zone => {
    nodes.push({
      id: zone.id,
      label: zone.name,
      type: 'zone',
      capacity: zone.capacity,
      safeDensity: zone.safeDensity
    });

    edges.push({
      source: zone.id,
      target: scenario.venue.id,
      type: 'LOCATED_IN'
    });
  });

  // Route edges (CONNECTED_TO)
  scenario.routes.forEach(route => {
    edges.push({
      source: route.from,
      target: route.to,
      type: 'CONNECTED_TO',
      distance: route.distanceMeters
    });
  });

  // Personnel nodes & edges (ASSIGNED_TO)
  scenario.personnel.forEach(person => {
    nodes.push({
      id: person.id,
      label: person.name,
      role: person.role,
      type: 'personnel'
    });

    if (person.assignedZone && person.assignedZone !== 'ALL') {
      edges.push({
        source: person.id,
        target: person.assignedZone,
        type: 'ASSIGNED_TO'
      });
    }
  });

  return { nodes, edges };
}

module.exports = {
  SCENARIOS,
  getScenarios,
  getScenario,
  getActiveScenario,
  setActiveScenario,
  getScenarioGraph
};
