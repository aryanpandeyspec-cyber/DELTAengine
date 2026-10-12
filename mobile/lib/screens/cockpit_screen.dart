import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../theme/neubrutalism.dart';
import 'login_screen.dart';

class CockpitScreen extends StatefulWidget {
  final OperatorSession session;

  const CockpitScreen({super.key, required this.session});

  @override
  State<CockpitScreen> createState() => _CockpitScreenState();
}

class _CockpitScreenState extends State<CockpitScreen> {
  final _api = ApiService();
  final _ws = WebSocketService();

  int _currentTabIndex = 0;
  bool _isLoading = true;
  bool _isWsConnected = false;

  List<RoomTelemetry> _rooms = [];
  List<TaskItem> _tasks = [];
  final List<VoiceTransmission> _voiceTransmissions = [];
  AttendeeBadgeResult? _lastScannedBadge;

  StreamSubscription? _wsStateSub;
  StreamSubscription? _taskSub;
  StreamSubscription? _roomSub;
  StreamSubscription? _voiceSub;
  StreamSubscription? _sosSub;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
    _setupWebSocketListeners();
  }

  @override
  void dispose() {
    _wsStateSub?.cancel();
    _taskSub?.cancel();
    _roomSub?.cancel();
    _voiceSub?.cancel();
    _sosSub?.cancel();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final roomsFuture = _api.fetchRooms();
      final tasksFuture = _api.fetchTasks();
      final results = await Future.wait([roomsFuture, tasksFuture]);

      setState(() {
        _rooms = results[0] as List<RoomTelemetry>;
        _tasks = results[1] as List<TaskItem>;
        _isLoading = false;
      });
    } catch (e) {
      // Fallback sample data if server responds empty
      if (mounted) {
        setState(() {
          _isLoading = false;
          if (_rooms.isEmpty) {
            _rooms = [
              RoomTelemetry(id: 'room1', name: 'Turing Grand Hall', currentDensity: 84.0, capacity: 500, currentOccupancy: 420, status: 'CRITICAL', predictedRisk: 0.88),
              RoomTelemetry(id: 'room2', name: 'Lovelace Auditorium', currentDensity: 65.0, capacity: 250, currentOccupancy: 162, status: 'ELEVATED', predictedRisk: 0.65),
              RoomTelemetry(id: 'room3', name: 'Von Neumann Hub', currentDensity: 42.0, capacity: 180, currentOccupancy: 75, status: 'OPTIMAL', predictedRisk: 0.30),
              RoomTelemetry(id: 'room4', name: 'Shannon Workshop Suite', currentDensity: 52.0, capacity: 120, currentOccupancy: 62, status: 'OPTIMAL', predictedRisk: 0.40),
              RoomTelemetry(id: 'room5', name: 'Hopper Tech Pavilion', currentDensity: 35.0, capacity: 1200, currentOccupancy: 420, status: 'OPTIMAL', predictedRisk: 0.25),
            ];
          }
        });
      }
    }
  }

  void _setupWebSocketListeners() {
    _isWsConnected = _ws.isConnected;

    _wsStateSub = _ws.isConnectedStream.listen((connected) {
      if (mounted) setState(() => _isWsConnected = connected);
    });

    _taskSub = _ws.onTaskEvent.listen((task) {
      if (mounted) {
        setState(() {
          final index = _tasks.indexWhere((t) => t.id == task.id);
          if (index != -1) {
            _tasks[index] = task;
          } else {
            _tasks.insert(0, task);
          }
        });
      }
    });

    _roomSub = _ws.onRoomEvent.listen((rooms) {
      if (mounted) {
        setState(() => _rooms = rooms);
      }
    });

    _voiceSub = _ws.onVoiceEvent.listen((voice) {
      if (mounted) {
        setState(() {
          _voiceTransmissions.insert(0, voice);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: DeltaColors.surfaceLight,
            content: Text(
              '📻 [CH ${voice.channel}] ${voice.speaker}: "${voice.message}"',
              style: GoogleFonts.spaceGrotesk(color: DeltaColors.skyAqua),
            ),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    });

    _sosSub = _ws.onSosEvent.listen((sos) {
      if (mounted) {
        _showEmergencyAlertBanner(sos);
      }
    });
  }

  void _showEmergencyAlertBanner(Map<String, dynamic> sos) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: DeltaColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: DeltaColors.dangerRed, width: 3),
        ),
        title: Row(
          children: [
            const Icon(Icons.warning, color: DeltaColors.dangerRed, size: 28),
            const SizedBox(width: 8),
            Text(
              'FIELD MARSHAL SOS!',
              style: GoogleFonts.outfit(
                color: DeltaColors.dangerRed,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Reporter: ${sos['volunteerName'] ?? 'Safety Marshal'}',
              style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Text(
              'Location: ${sos['hallName'] ?? sos['hallId'] ?? 'Auditorium'}',
              style: GoogleFonts.spaceGrotesk(color: DeltaColors.mustard),
            ),
            const SizedBox(height: 8),
            Text(
              'Note: "${sos['note'] ?? 'Critical crowd surge detected!'}"',
              style: GoogleFonts.spaceGrotesk(color: DeltaColors.textLight),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.dangerRed,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ACKNOWLEDGE & DISPATCH'),
          ),
        ],
      ),
    );
  }

  // --- ACTIONS ---

  Future<void> _handleClaimTask(TaskItem task) async {
    try {
      await _api.claimTask(taskId: task.id, claimedBy: widget.session.name);
      setState(() {
        final idx = _tasks.indexWhere((t) => t.id == task.id);
        if (idx != -1) {
          _tasks[idx] = task.copyWith(status: 'claimed', assignedTo: widget.session.name);
        }
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: DeltaColors.surfaceLight,
            content: Text('Claimed task: ${task.title}', style: const TextStyle(color: DeltaColors.skyAqua)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to claim: $e')),
        );
      }
    }
  }

  Future<void> _handleResolveTask(TaskItem task) async {
    try {
      await _api.resolveTask(taskId: task.id, resolvedBy: widget.session.name);
      setState(() {
        final idx = _tasks.indexWhere((t) => t.id == task.id);
        if (idx != -1) {
          _tasks[idx] = task.copyWith(status: 'resolved');
        }
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: DeltaColors.surfaceLight,
            content: Text('Resolved task: ${task.title}', style: const TextStyle(color: DeltaColors.successGreen)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to resolve: $e')),
        );
      }
    }
  }

  void _showCreateTaskDialog() {
    final titleCtrl = TextEditingController();
    final locationCtrl = TextEditingController(text: 'Room 1 (Turing Hall)');
    String priority = 'urgent';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: DeltaColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Colors.black, width: 2.5),
          ),
          title: Text(
            'DISPATCH INCIDENT TASK',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w900, color: DeltaColors.mustard),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Task Directive / Title:', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
              const SizedBox(height: 4),
              TextField(
                controller: titleCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'e.g. Stage 1 wireless mic battery swap',
                  filled: true,
                  fillColor: DeltaColors.surfaceLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                ),
              ),
              const SizedBox(height: 12),
              Text('Target Zone / Room:', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
              const SizedBox(height: 4),
              TextField(
                controller: locationCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: DeltaColors.surfaceLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                ),
              ),
              const SizedBox(height: 12),
              Text('Priority Level:', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
              const SizedBox(height: 4),
              Row(
                children: [
                  ChoiceChip(
                    label: const Text('URGENT'),
                    selected: priority == 'urgent',
                    selectedColor: DeltaColors.dangerRed,
                    onSelected: (_) => setDialogState(() => priority = 'urgent'),
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('NORMAL'),
                    selected: priority == 'normal',
                    selectedColor: DeltaColors.skyAqua,
                    onSelected: (_) => setDialogState(() => priority = 'normal'),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('CANCEL', style: TextStyle(color: DeltaColors.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: DeltaColors.mustard, foregroundColor: Colors.black),
              onPressed: () async {
                if (titleCtrl.text.trim().isEmpty) return;
                try {
                  final newTask = await _api.createTask(
                    title: titleCtrl.text.trim(),
                    location: locationCtrl.text.trim(),
                    priority: priority,
                    creator: widget.session.name,
                  );
                  setState(() => _tasks.insert(0, newTask));
                  if (ctx.mounted) Navigator.pop(ctx);
                } catch (e) {
                  // Fallback local task
                  final fallback = TaskItem(
                    id: 'task_${DateTime.now().millisecondsSinceEpoch}',
                    title: titleCtrl.text.trim(),
                    location: locationCtrl.text.trim(),
                    severity: priority.toUpperCase(),
                    status: 'PENDING',
                    description: '',
                    createdAt: DateTime.now(),
                  );
                  setState(() => _tasks.insert(0, fallback));
                  if (ctx.mounted) Navigator.pop(ctx);
                }
              },
              child: const Text('DISPATCH NOW', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showSosConfirmationDialog() {
    String selectedHall = 'room1';
    final noteCtrl = TextEditingController(text: 'Crowd bottleneck surge near main entrance!');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: DeltaColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: DeltaColors.dangerRed, width: 3),
        ),
        title: Row(
          children: [
            const Icon(Icons.warning, color: DeltaColors.dangerRed),
            const SizedBox(width: 8),
            Text(
              'TRIGGER EMERGENCY SOS',
              style: GoogleFonts.outfit(fontWeight: FontWeight.w900, color: DeltaColors.dangerRed),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('This will broadcast an immediate high-priority alert to all command dashboards and mesh channels.',
                style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
            const SizedBox(height: 12),
            Text('Incident Location:', style: GoogleFonts.spaceGrotesk(fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            DropdownButtonFormField<String>(
              initialValue: selectedHall,
              dropdownColor: DeltaColors.surfaceLight,
              items: const [
                DropdownMenuItem(value: 'room1', child: Text('Turing Grand Hall', style: TextStyle(color: Colors.white))),
                DropdownMenuItem(value: 'room2', child: Text('Lovelace Auditorium', style: TextStyle(color: Colors.white))),
                DropdownMenuItem(value: 'room3', child: Text('Von Neumann Hub', style: TextStyle(color: Colors.white))),
                DropdownMenuItem(value: 'room4', child: Text('Shannon Workshop', style: TextStyle(color: Colors.white))),
                DropdownMenuItem(value: 'room5', child: Text('Hopper Pavilion', style: TextStyle(color: Colors.white))),
              ],
              onChanged: (val) {
                if (val != null) selectedHall = val;
              },
              decoration: InputDecoration(
                filled: true,
                fillColor: DeltaColors.surfaceLight,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
              ),
            ),
            const SizedBox(height: 12),
            Text('Urgent Field Note:', style: GoogleFonts.spaceGrotesk(fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            TextField(
              controller: noteCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                filled: true,
                fillColor: DeltaColors.surfaceLight,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('CANCEL', style: TextStyle(color: DeltaColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: DeltaColors.dangerRed, foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.pop(ctx);
              await _api.triggerEmergencySos(
                volunteerName: widget.session.name,
                hallId: selectedHall,
                note: noteCtrl.text.trim(),
              );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    backgroundColor: DeltaColors.dangerRed,
                    content: Text('🚨 Emergency SOS Broadcast Sent to Command Deck!'),
                  ),
                );
              }
            },
            child: const Text('SEND SOS ALERT', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // --- RENDER APP BAR & BODY ---

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: DeltaColors.surface,
        elevation: 0,
        shape: const Border(
          bottom: BorderSide(color: Colors.black, width: 2.5),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: DeltaColors.yaleBlue,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.black, width: 1.8),
              ),
              child: const Icon(Icons.bolt, color: DeltaColors.mustard, size: 18),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'DELTA ENGINE',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  widget.session.name.toUpperCase(),
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 10,
                    color: DeltaColors.mustard,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Live WS indicator pill
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _isWsConnected ? DeltaColors.successGreen.withValues(alpha: 0.2) : Colors.red.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _isWsConnected ? DeltaColors.successGreen : Colors.red,
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _isWsConnected ? DeltaColors.successGreen : Colors.red,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _isWsConnected ? 'LIVE MESH' : 'OFFLINE',
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: _isWsConnected ? DeltaColors.successGreen : Colors.red,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout, size: 20, color: DeltaColors.textMuted),
            onPressed: () {
              WebSocketService().disconnect();
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: DeltaColors.skyAqua))
          : IndexedStack(
              index: _currentTabIndex,
              children: [
                _buildTelemetryTab(),
                _buildTasksTab(),
                _buildWalkieTalkieTab(),
                _buildBadgeScannerTab(),
              ],
            ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: DeltaColors.surface,
          border: Border(top: BorderSide(color: Colors.black, width: 2.5)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentTabIndex,
          onTap: (index) => setState(() => _currentTabIndex = index),
          backgroundColor: Colors.transparent,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: DeltaColors.mustard,
          unselectedItemColor: DeltaColors.textMuted,
          selectedLabelStyle: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.w800),
          unselectedLabelStyle: GoogleFonts.spaceGrotesk(fontSize: 10, fontWeight: FontWeight.w600),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard),
              label: 'TELEMETRY',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.assignment_outlined),
              activeIcon: Icon(Icons.assignment),
              label: 'INCIDENTS',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.radio_outlined),
              activeIcon: Icon(Icons.radio),
              label: 'WALKIE MESH',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.qr_code_scanner_outlined),
              activeIcon: Icon(Icons.qr_code_scanner),
              label: 'BADGE SCAN',
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // TAB 1: TELEMETRY & 1-TAP QUICK DISPATCH
  // ==========================================
  Widget _buildTelemetryTab() {
    final totalOccupancy = _rooms.fold<int>(0, (sum, r) => sum + r.currentOccupancy);
    final avgDensity = _rooms.isEmpty ? 0 : (_rooms.fold<double>(0, (sum, r) => sum + r.currentDensity) / _rooms.length).round();

    return RefreshIndicator(
      onRefresh: _loadInitialData,
      color: DeltaColors.mustard,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Emergency SOS Banner Card
          NeubrutalistCard(
            backgroundColor: DeltaColors.dangerRed.withValues(alpha: 0.18),
            onTap: _showSosConfirmationDialog,
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: DeltaColors.dangerRed,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.black, width: 1.8),
                  ),
                  child: const Icon(Icons.emergency, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'FIELD MARSHAL SOS ALERT',
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: DeltaColors.dangerRed,
                        ),
                      ),
                      Text(
                        '1-Tap crowd surge & incident escalation',
                        style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textLight),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios, size: 16, color: DeltaColors.dangerRed),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // High-level Stats Overview
          Row(
            children: [
              Expanded(
                child: _buildStatTile('INSIDE VENUE', '$totalOccupancy', 'Attended', DeltaColors.skyAqua),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildStatTile('AVG DENSITY', '$avgDensity%', 'Global Index', DeltaColors.mustard),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildStatTile('OPEN TASKS', '${_tasks.where((t) => t.status != 'resolved').length}', 'Live Incidents', DeltaColors.deepSaffron),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Monitored Zone Gauges Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ZONE DENSITY TELEMETRY',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: DeltaColors.textLight,
                ),
              ),
              Text(
                '${_rooms.length} ZONES ACTIVE',
                style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.skyAqua, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Zone Density List
          ..._rooms.map((room) => _buildRoomDensityCard(room)),

          const SizedBox(height: 20),

          // 1-Tap Quick Action Dispatch Grid
          Text(
            '1-TAP FIELD DISPATCH GRID',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: DeltaColors.textLight,
            ),
          ),
          const SizedBox(height: 10),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 2.2,
            children: [
              _buildQuickActionBtn(
                'RESTOCK WATER',
                'water_supply',
                Icons.water_drop,
                DeltaColors.skyAqua,
              ),
              _buildQuickActionBtn(
                'DEPLOY SECURITY',
                'security_post',
                Icons.shield,
                DeltaColors.mustard,
              ),
              _buildQuickActionBtn(
                'OPEN OVERFLOW GATES',
                'gate_release',
                Icons.door_sliding,
                DeltaColors.deepSaffron,
              ),
              _buildQuickActionBtn(
                'COOLING BOOST',
                'hvac_boost',
                Icons.ac_unit,
                DeltaColors.balticBlue,
              ),
            ],
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildStatTile(String label, String value, String sub, Color accent) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: Neubrutalism.boxDecoration(color: DeltaColors.surface, radius: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.spaceGrotesk(fontSize: 9, fontWeight: FontWeight.w800, color: DeltaColors.textMuted)),
          const SizedBox(height: 4),
          Text(value, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: accent)),
          Text(sub, style: GoogleFonts.spaceGrotesk(fontSize: 9, color: DeltaColors.textLight)),
        ],
      ),
    );
  }

  Widget _buildRoomDensityCard(RoomTelemetry room) {
    final isCritical = room.currentDensity >= 80;
    final isElevated = room.currentDensity >= 60 && room.currentDensity < 80;
    final statusColor = isCritical ? DeltaColors.dangerRed : isElevated ? DeltaColors.mustard : DeltaColors.successGreen;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: NeubrutalistCard(
        backgroundColor: DeltaColors.surface,
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    room.name,
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
                NeubrutalistBadge(
                  label: '${room.currentDensity.toStringAsFixed(0)}% • ${room.status}',
                  backgroundColor: statusColor,
                  textColor: isCritical ? Colors.white : Colors.black,
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Density progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Container(
                height: 10,
                color: DeltaColors.surfaceLight,
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: (room.currentDensity / 100).clamp(0.0, 1.0),
                  child: Container(color: statusColor),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Details footer
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${room.currentOccupancy} / ${room.capacity} seats',
                  style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted),
                ),
                Text(
                  'Risk: ${(room.predictedRisk * 100).toStringAsFixed(0)}% • ${room.temperature}°C',
                  style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.skyAqua),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionBtn(String title, String actionCode, IconData icon, Color color) {
    return InkWell(
      onTap: () async {
        await _api.dispatchQuickAction(
          action: actionCode,
          label: title,
          sender: widget.session.name,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: DeltaColors.surfaceLight,
              content: Text('Dispatched: $title', style: TextStyle(color: color)),
              duration: const Duration(seconds: 2),
            ),
          );
        }
      },
      child: Container(
        decoration: Neubrutalism.boxDecoration(color: DeltaColors.surface, radius: 8),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // TAB 2: INCIDENT TASK DISPATCH BOARD
  // ==========================================
  Widget _buildTasksTab() {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: DeltaColors.mustard,
        foregroundColor: Colors.black,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: Colors.black, width: 2),
        ),
        onPressed: _showCreateTaskDialog,
        icon: const Icon(Icons.add_task),
        label: Text('DISPATCH TASK', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w800)),
      ),
      body: RefreshIndicator(
        onRefresh: _loadInitialData,
        color: DeltaColors.mustard,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'FIELD INCIDENT QUEUE',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                Text(
                  '${_tasks.length} TOTAL',
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: DeltaColors.mustard,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            if (_tasks.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Center(
                  child: Text('No active incidents reported.', style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted)),
                ),
              )
            else
              ..._tasks.map((task) => _buildTaskCard(task)),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskCard(TaskItem task) {
    final isUrgent = task.severity == 'URGENT' || task.severity == 'CRITICAL';
    final isClaimed = task.status == 'claimed';
    final isResolved = task.status == 'resolved';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: NeubrutalistCard(
        backgroundColor: DeltaColors.surface,
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                NeubrutalistBadge(
                  label: task.severity,
                  backgroundColor: isUrgent ? DeltaColors.dangerRed : DeltaColors.skyAqua,
                  textColor: isUrgent ? Colors.white : Colors.black,
                ),
                NeubrutalistBadge(
                  label: task.status.toUpperCase(),
                  backgroundColor: isResolved
                      ? DeltaColors.successGreen
                      : isClaimed
                          ? DeltaColors.mustard
                          : DeltaColors.surfaceLight,
                  textColor: isResolved || isClaimed ? Colors.black : Colors.white,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              task.title,
              style: GoogleFonts.outfit(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 14, color: DeltaColors.mustard),
                const SizedBox(width: 4),
                Text(task.location, style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
                if (task.assignedTo != null) ...[
                  const SizedBox(width: 12),
                  const Icon(Icons.person_outline, size: 14, color: DeltaColors.skyAqua),
                  const SizedBox(width: 4),
                  Text(task.assignedTo!, style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.skyAqua)),
                ],
              ],
            ),
            const SizedBox(height: 12),

            // Action Buttons
            if (!isResolved) ...[
              Row(
                children: [
                  if (!isClaimed) ...[
                    Expanded(
                      child: NeubrutalistButton(
                        label: 'CLAIM TASK',
                        icon: Icons.pan_tool_alt,
                        backgroundColor: DeltaColors.skyAqua,
                        textColor: Colors.black,
                        onPressed: () => _handleClaimTask(task),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: NeubrutalistButton(
                      label: 'MARK RESOLVED',
                      icon: Icons.check_circle_outline,
                      backgroundColor: DeltaColors.successGreen,
                      textColor: Colors.black,
                      onPressed: () => _handleResolveTask(task),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ==========================================
  // TAB 3: WALKIE-TALKIE MESH HUD
  // ==========================================
  Widget _buildWalkieTalkieTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'TACTICAL WALKIE MESH',
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: Colors.white,
          ),
        ),
        Text(
          'Low-latency encrypted radio broadcast',
          style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted),
        ),
        const SizedBox(height: 18),

        // Channel Selector
        NeubrutalistCard(
          backgroundColor: DeltaColors.surface,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('ACTIVE MESH CHANNEL', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.mustard)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _buildChannelPill('CH 1: OPS', '1', true)),
                  const SizedBox(width: 6),
                  Expanded(child: _buildChannelPill('CH 2: SEC', '2', false)),
                  const SizedBox(width: 6),
                  Expanded(child: _buildChannelPill('CH 3: MED', '3', false)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // PTT Big Broadcast Trigger
        Center(
          child: NeubrutalistCard(
            backgroundColor: DeltaColors.yaleBlue,
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
            child: Column(
              children: [
                GestureDetector(
                  onTap: () async {
                    await _api.broadcastVoice(
                      sender: widget.session.name,
                      channel: '1',
                      text: 'Field check: All primary security exits verified clear.',
                    );
                  },
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: DeltaColors.mustard,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.black, width: 3),
                      boxShadow: const [
                        BoxShadow(color: Colors.black, offset: Offset(4, 4), blurRadius: 0),
                      ],
                    ),
                    child: const Icon(Icons.mic, size: 48, color: Colors.black),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'TAP TO BROADCAST VOICE',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Transmits audio snippet to all marshals',
                  style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.skyAqua),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        // Radio Feed
        Text(
          'TRANSMISSION FEED',
          style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
        ),
        const SizedBox(height: 10),

        if (_voiceTransmissions.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: Neubrutalism.boxDecoration(color: DeltaColors.surface, radius: 8),
            child: Text(
              'No voice transmissions recorded this session. Tap microphone to send.',
              style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted),
            ),
          )
        else
          ..._voiceTransmissions.map((v) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: Neubrutalism.boxDecoration(color: DeltaColors.surface, radius: 8),
                child: Row(
                  children: [
                    const Icon(Icons.volume_up, color: DeltaColors.skyAqua, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${v.speaker} (CH ${v.channel})', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.mustard)),
                          Text(v.message, style: GoogleFonts.spaceGrotesk(fontSize: 13, color: Colors.white)),
                        ],
                      ),
                    ),
                  ],
                ),
              )),
      ],
    );
  }

  Widget _buildChannelPill(String title, String chNum, bool isSelected) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: isSelected ? DeltaColors.skyAqua : DeltaColors.surfaceLight,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.black, width: 1.5),
      ),
      child: Center(
        child: Text(
          title,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: isSelected ? Colors.black : DeltaColors.textMuted,
          ),
        ),
      ),
    );
  }

  // ==========================================
  // TAB 4: BADGE SCANNER & ACCESS CONTROL
  // ==========================================
  Widget _buildBadgeScannerTab() {
    final codeCtrl = TextEditingController(text: 'VIP-9941');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'BADGE VERIFICATION DECK',
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: Colors.white,
          ),
        ),
        Text(
          'Instant Supabase attendee credential check',
          style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted),
        ),
        const SizedBox(height: 18),

        // Verification Input Card
        NeubrutalistCard(
          backgroundColor: DeltaColors.surface,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('SCAN BADGE / ENTER TICKET ID:', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.mustard)),
              const SizedBox(height: 8),
              TextField(
                controller: codeCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: DeltaColors.surfaceLight,
                  prefixIcon: const Icon(Icons.qr_code, color: DeltaColors.skyAqua),
                  hintText: 'e.g. VIP-9941',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(
                    label: const Text('Preset: VIP Pass'),
                    backgroundColor: DeltaColors.surfaceLight,
                    onPressed: () => codeCtrl.text = 'VIP-9941',
                  ),
                  ActionChip(
                    label: const Text('Preset: Keynote Speaker'),
                    backgroundColor: DeltaColors.surfaceLight,
                    onPressed: () => codeCtrl.text = 'SPK-1022',
                  ),
                  ActionChip(
                    label: const Text('Preset: Delegate'),
                    backgroundColor: DeltaColors.surfaceLight,
                    onPressed: () => codeCtrl.text = 'DEL-4418',
                  ),
                ],
              ),
              const SizedBox(height: 14),
              NeubrutalistButton(
                label: 'VERIFY & GRANT GATE ENTRY',
                icon: Icons.verified_user,
                backgroundColor: DeltaColors.mustard,
                textColor: Colors.black,
                onPressed: () async {
                  try {
                    final res = await _api.verifyBadge(code: codeCtrl.text, scannedBy: widget.session.name);
                    setState(() => _lastScannedBadge = res);
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Badge verification failed: $e')),
                      );
                    }
                  }
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Result Card if scanned
        if (_lastScannedBadge != null) ...[
          NeubrutalistCard(
            backgroundColor: _lastScannedBadge!.valid ? DeltaColors.yaleBlue : DeltaColors.dangerRed.withValues(alpha: 0.2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'STATUS: VALID BADGE',
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: DeltaColors.successGreen,
                      ),
                    ),
                    NeubrutalistBadge(
                      label: _lastScannedBadge!.tier,
                      backgroundColor: DeltaColors.mustard,
                      textColor: Colors.black,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  _lastScannedBadge!.name,
                  style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white),
                ),
                Text(
                  'Ticket ID: ${_lastScannedBadge!.ticketId}',
                  style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.skyAqua),
                ),
                const SizedBox(height: 10),
                const Divider(color: Colors.black, thickness: 1.5),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Zone Clearance:', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
                    Text(_lastScannedBadge!.allowedZones.join(', '), style: GoogleFonts.spaceGrotesk(fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Anti-Tamper Status:', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
                    const Text('PASS (HMAC Valid)', style: TextStyle(color: DeltaColors.successGreen, fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
