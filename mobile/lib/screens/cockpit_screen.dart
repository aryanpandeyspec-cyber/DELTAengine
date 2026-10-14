import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

class _CockpitScreenState extends State<CockpitScreen> with SingleTickerProviderStateMixin {
  final _api = ApiService();
  final _ws = WebSocketService();

  int _currentTabIndex = 0;
  bool _isLoading = true;
  bool _isWsConnected = false;
  String _taskFilter = 'ALL';
  String? _selectedBlueprintRoomId;

  List<RoomTelemetry> _rooms = [];
  List<TaskItem> _tasks = [];
  final List<VoiceTransmission> _voiceTransmissions = [];
  AttendeeBadgeResult? _lastScannedBadge;
  int _totalGateCheckins = 842;

  // Walkie talkie state
  String _activeChannel = '1';
  bool _isBroadcasting = false;

  // Live Event Phase Countdown Ticker (from Suryansh)
  int _tickerSeconds = 868; // 14 mins 28s
  int _currentStageIdx = 0;
  Timer? _tickerTimer;

  final List<Map<String, dynamic>> _eventScheduleStages = [
    {'title': 'KEYNOTE: "Autonomous AI Swarms"', 'stage': 'STAGE 2 / TURING', 'timer': 868},
    {'title': 'WORKSHOP: "Edge Spatial Perception"', 'stage': 'STAGE 3 / LOVELACE', 'timer': 1200},
    {'title': 'CROWD TRANSITION & LUNCH RELAY', 'stage': 'MAIN CONCOURSE', 'timer': 1800},
    {'title': 'PANEL: "Future of Event Safety OS"', 'stage': 'STAGE 1 / HOPPER', 'timer': 2400},
  ];

  // Scanner animation
  late AnimationController _scannerAnim;
  late Animation<double> _scanLinePosition;

  StreamSubscription? _wsStateSub;
  StreamSubscription? _taskSub;
  StreamSubscription? _roomSub;
  StreamSubscription? _voiceSub;
  StreamSubscription? _sosSub;

  @override
  void initState() {
    super.initState();
    _scannerAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _scanLinePosition = Tween<double>(begin: 0.1, end: 0.9).animate(
      CurvedAnimation(parent: _scannerAnim, curve: Curves.easeInOut),
    );

    _startEventPhaseTicker();
    _loadInitialData();
    _setupWebSocketListeners();
  }

  void _startEventPhaseTicker() {
    _tickerTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          if (_tickerSeconds > 0) {
            _tickerSeconds--;
          } else {
            _currentStageIdx = (_currentStageIdx + 1) % _eventScheduleStages.length;
            _tickerSeconds = _eventScheduleStages[_currentStageIdx]['timer'] as int;
          }
        });
      }
    });
  }

  @override
  void dispose() {
    _tickerTimer?.cancel();
    _scannerAnim.dispose();
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
      if (mounted) {
        setState(() {
          _isLoading = false;
          if (_rooms.isEmpty) {
            _rooms = [
              RoomTelemetry(id: 'room1', name: 'Turing Grand Hall', currentDensity: 84.0, capacity: 500, currentOccupancy: 420, status: 'CRITICAL', predictedRisk: 0.88, doorCountIn: 480, doorCountOut: 60, temperature: 24.2, co2: 780),
              RoomTelemetry(id: 'room2', name: 'Lovelace Auditorium', currentDensity: 65.0, capacity: 250, currentOccupancy: 162, status: 'ELEVATED', predictedRisk: 0.65, doorCountIn: 190, doorCountOut: 28, temperature: 22.8, co2: 640),
              RoomTelemetry(id: 'room3', name: 'Von Neumann Hub', currentDensity: 42.0, capacity: 180, currentOccupancy: 75, status: 'OPTIMAL', predictedRisk: 0.30, doorCountIn: 92, doorCountOut: 17, temperature: 21.5, co2: 520),
              RoomTelemetry(id: 'room4', name: 'Shannon Workshop Suite', currentDensity: 52.0, capacity: 120, currentOccupancy: 62, status: 'OPTIMAL', predictedRisk: 0.40, doorCountIn: 70, doorCountOut: 8, temperature: 22.0, co2: 590),
              RoomTelemetry(id: 'room5', name: 'Hopper Tech Pavilion', currentDensity: 35.0, capacity: 1200, currentOccupancy: 420, status: 'OPTIMAL', predictedRisk: 0.25, doorCountIn: 490, doorCountOut: 70, temperature: 20.8, co2: 480),
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
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: const BorderSide(color: Colors.black, width: 2),
            ),
            content: Row(
              children: [
                const Icon(Icons.radio, color: DeltaColors.neonCyan, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '📻 [CH ${voice.channel}] ${voice.speaker}: "${voice.message}"',
                    style: GoogleFonts.spaceGrotesk(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            duration: const Duration(seconds: 4),
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
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: DeltaColors.dangerRed, width: 3.5),
        ),
        title: Row(
          children: [
            const PulsingDot(color: DeltaColors.dangerRed, size: 14),
            const SizedBox(width: 10),
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
              'Marshal: ${sos['volunteerName'] ?? 'Safety Lead'}',
              style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13),
            ),
            const SizedBox(height: 4),
            Text(
              'Location: ${sos['hallName'] ?? sos['hallId'] ?? 'Auditorium'}',
              style: GoogleFonts.spaceGrotesk(color: DeltaColors.mustard, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: DeltaColors.dangerRed.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: DeltaColors.dangerRed, width: 1.5),
              ),
              child: Text(
                'Note: "${sos['note'] ?? 'Critical crowd surge detected!'}"',
                style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 12),
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.dangerRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: Colors.black, width: 2),
              ),
            ),
            onPressed: () => Navigator.pop(ctx),
            child: Text('ACKNOWLEDGE & DISPATCH', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // Active Device Identity / Team Contacts Sheet (From Suryansh)
  void _showTeamRosterDialog() {
    final teamMembers = [
      {'name': 'Suryansh', 'role': 'Lead Coordinator', 'phone': '+91 83030 09159', 'avatar': '🧑‍💻', 'ch': 'CH 1'},
      {'name': 'Aryan Pandey', 'role': 'Core Systems Commander', 'phone': '+91 91542 76178', 'avatar': '💻', 'ch': 'CH 1'},
      {'name': 'Shahid', 'role': 'Audio & AV Lead', 'phone': '+91 63035 70916', 'avatar': '🎧', 'ch': 'CH 4'},
      {'name': 'Volunteer Runner', 'role': 'Field Gate Team', 'phone': 'Gate Desk #1', 'avatar': '🤝', 'ch': 'CH 2'},
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: DeltaColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        side: BorderSide(color: Colors.black, width: 2.5),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.people_alt, color: DeltaColors.mustard, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'COORDINATOR TEAM ROSTER',
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white),
                    ),
                  ],
                ),
                NeubrutalistBadge(label: '4 ON-GROUND', backgroundColor: DeltaColors.neonCyan, textColor: Colors.black),
              ],
            ),
            const SizedBox(height: 12),
            ...teamMembers.map((m) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: Neubrutalism.boxDecoration(color: DeltaColors.surfaceLight, radius: 8),
              child: Row(
                children: [
                  Text(m['avatar']!, style: const TextStyle(fontSize: 22)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m['name']!, style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13)),
                        Text('${m['role']} • ${m['phone']}', style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted, fontSize: 11)),
                      ],
                    ),
                  ),
                  InkWell(
                    onTap: () {
                      Navigator.pop(ctx);
                      _api.broadcastVoice(
                        sender: widget.session.name,
                        channel: m['ch']!.replaceAll('CH ', ''),
                        text: 'Paging ${m['name']} over ${m['ch']}',
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Paging ${m['name']} on ${m['ch']}!')),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: DeltaColors.mustard,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.black, width: 1.5),
                      ),
                      child: Text(
                        'PAGE ${m['ch']}',
                        style: GoogleFonts.spaceGrotesk(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.black),
                      ),
                    ),
                  ),
                ],
              ),
            )),
          ],
        ),
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
            content: Text('Claimed task: ${task.title}', style: const TextStyle(color: DeltaColors.skyAqua, fontWeight: FontWeight.bold)),
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
            content: Text('Resolved task: ${task.title}', style: const TextStyle(color: DeltaColors.successGreen, fontWeight: FontWeight.bold)),
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
    final locationCtrl = TextEditingController(text: 'Room 1 (Turing Grand Hall)');
    String priority = 'urgent';

    final presetTasks = [
      'Stage wireless lapel battery swap',
      'Restock 20 water bottles for speaker lounge',
      'Crowd bottleneck surge near main entrance',
      'First aid emergency marshal required',
      'HVAC thermal cooling boost requested',
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: DeltaColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: Colors.black, width: 2.8),
          ),
          title: Row(
            children: [
              const Icon(Icons.add_task, color: DeltaColors.mustard, size: 22),
              const SizedBox(width: 8),
              Text(
                'DISPATCH FIELD TASK',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w900, color: DeltaColors.mustard, fontSize: 17),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Directive / Title:', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.textMuted)),
                const SizedBox(height: 4),
                TextField(
                  controller: titleCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'e.g. Stage wireless lapel battery swap',
                    filled: true,
                    fillColor: DeltaColors.surfaceLight,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 10),
                Text('Quick Directives:', style: GoogleFonts.spaceGrotesk(fontSize: 10, color: DeltaColors.mustard, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: presetTasks.map((preset) => InkWell(
                    onTap: () => setDialogState(() => titleCtrl.text = preset),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: DeltaColors.surfaceLight,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.black, width: 1.5),
                      ),
                      child: Text(preset, style: const TextStyle(fontSize: 10, color: DeltaColors.skyAqua)),
                    ),
                  )).toList(),
                ),
                const SizedBox(height: 14),
                Text('Target Zone / Room:', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.textMuted)),
                const SizedBox(height: 4),
                TextField(
                  controller: locationCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: DeltaColors.surfaceLight,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 14),
                Text('Priority Level:', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.textMuted)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('URGENT'),
                      selected: priority == 'urgent',
                      selectedColor: DeltaColors.dangerRed,
                      labelStyle: TextStyle(
                        color: priority == 'urgent' ? Colors.white : DeltaColors.textMuted,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                      onSelected: (_) => setDialogState(() => priority = 'urgent'),
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('NORMAL'),
                      selected: priority == 'normal',
                      selectedColor: DeltaColors.skyAqua,
                      labelStyle: TextStyle(
                        color: priority == 'normal' ? Colors.black : DeltaColors.textMuted,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                      onSelected: (_) => setDialogState(() => priority = 'normal'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('CANCEL', style: TextStyle(color: DeltaColors.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: DeltaColors.mustard,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: const BorderSide(color: Colors.black, width: 2),
                ),
              ),
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
              child: Text('DISPATCH NOW', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w800)),
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
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: DeltaColors.dangerRed, width: 3.5),
        ),
        title: Row(
          children: [
            const PulsingDot(color: DeltaColors.dangerRed, size: 16),
            const SizedBox(width: 10),
            Text(
              'TRIGGER EMERGENCY SOS',
              style: GoogleFonts.outfit(fontWeight: FontWeight.w900, color: DeltaColors.dangerRed, fontSize: 17),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Broadcasts immediate high-priority override to all command dashboards, mesh radios, and safety marshals.',
                style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
            const SizedBox(height: 14),
            Text('Incident Location:', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
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
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 12),
            Text('Urgent Field Note:', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 4),
            TextField(
              controller: noteCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: DeltaColors.surfaceLight,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
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
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.dangerRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: Colors.black, width: 2),
              ),
            ),
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
                    content: Text('🚨 Emergency SOS Broadcast Sent to Central Command Deck!'),
                  ),
                );
              }
            },
            child: Text('SEND SOS ALERT', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }

  // --- RENDER APP BAR & TABS ---

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
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: DeltaColors.yaleBlue,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.black, width: 2),
                boxShadow: const [
                  BoxShadow(color: Colors.black, offset: Offset(2, 2), blurRadius: 0),
                ],
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
                Row(
                  children: [
                    Text(
                      widget.session.name.toUpperCase(),
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 10,
                        color: DeltaColors.mustard,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '• ${widget.session.role}',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 9,
                        color: DeltaColors.skyAqua,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Active Coordinator Roster Button (from Suryansh)
          IconButton(
            icon: const Icon(Icons.groups, size: 20, color: DeltaColors.mustard),
            tooltip: 'Team Contacts',
            onPressed: _showTeamRosterDialog,
          ),

          // Quick Emergency SOS Header Button
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
            child: InkWell(
              onTap: _showSosConfirmationDialog,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: DeltaColors.dangerRed,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.black, width: 1.8),
                  boxShadow: const [
                    BoxShadow(color: Colors.black, offset: Offset(1.5, 1.5), blurRadius: 0),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(Icons.emergency, color: Colors.white, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      'SOS',
                      style: GoogleFonts.spaceGrotesk(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Live WS indicator pill
          Container(
            margin: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _isWsConnected ? DeltaColors.successGreen.withValues(alpha: 0.18) : Colors.red.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _isWsConnected ? DeltaColors.successGreen : Colors.red,
                width: 1.8,
              ),
            ),
            child: Row(
              children: [
                PulsingDot(color: _isWsConnected ? DeltaColors.successGreen : Colors.red, size: 7),
                const SizedBox(width: 6),
                Text(
                  _isWsConnected ? 'MESH' : 'OFFLINE',
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
            icon: const Icon(Icons.logout, size: 18, color: DeltaColors.textMuted),
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
          selectedLabelStyle: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.w900),
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
    final totalCapacity = _rooms.fold<int>(0, (sum, r) => sum + r.capacity);
    final avgDensity = totalCapacity > 0 ? ((totalOccupancy / totalCapacity) * 100).round() : 0;
    final totalIn = _rooms.fold<int>(0, (sum, r) => sum + r.doorCountIn);
    final totalOut = _rooms.fold<int>(0, (sum, r) => sum + r.doorCountOut);

    final currentStage = _eventScheduleStages[_currentStageIdx];
    final m = _tickerSeconds ~/ 60;
    final s = _tickerSeconds % 60;
    final timeStr = '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';

    return RefreshIndicator(
      onRefresh: _loadInitialData,
      color: DeltaColors.mustard,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // POINT 6 (Suryansh): Live Event Phase Countdown Ticker
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: Neubrutalism.boxDecoration(
              color: DeltaColors.surfaceLight,
              radius: 8,
              borderColor: DeltaColors.borderBlack,
            ),
            child: Row(
              children: [
                const PulsingDot(color: DeltaColors.mustard, size: 8),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        currentStage['stage']!.toString(),
                        style: GoogleFonts.spaceGrotesk(fontSize: 10, fontWeight: FontWeight.w900, color: DeltaColors.mustard),
                      ),
                      Text(
                        currentStage['title']!.toString(),
                        style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: DeltaColors.skyAqua, width: 1.5),
                  ),
                  child: Text(
                    '⏱️ $timeStr',
                    style: GoogleFonts.spaceGrotesk(fontSize: 12, fontWeight: FontWeight.w900, color: DeltaColors.skyAqua),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Venue Global Pressure Index Card
          NeubrutalistCard(
            backgroundColor: DeltaColors.yaleBlue,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.hub_outlined, color: DeltaColors.neonCyan, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'GLOBAL VENUE PRESSURE',
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                    NeubrutalistBadge(
                      label: avgDensity >= 80 ? 'HIGH SURGE' : avgDensity >= 60 ? 'ELEVATED' : 'NOMINAL',
                      backgroundColor: avgDensity >= 80 ? DeltaColors.dangerRed : avgDensity >= 60 ? DeltaColors.mustard : DeltaColors.neonCyan,
                      textColor: Colors.black,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '$avgDensity%',
                      style: GoogleFonts.outfit(
                        fontSize: 42,
                        fontWeight: FontWeight.w900,
                        color: DeltaColors.mustard,
                        height: 0.9,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$totalOccupancy / $totalCapacity Attendees',
                            style: GoogleFonts.spaceGrotesk(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Turnstile Mesh: +$totalIn IN / -$totalOut OUT',
                            style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.skyAqua),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                // Micro telemetry indicators
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.black, width: 1.5),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildMicroStat('🌡️ TEMP', '22.4°C'),
                      _buildMicroStat('💨 CO2', '620 ppm'),
                      _buildMicroStat('⚡ SLA', '0.7ms'),
                      _buildMicroStat('🚨 SURGES', '0 Active'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // POINT 5 (Suryansh): Interactive Venue Blueprint Floorplan
          _buildInteractiveBlueprintFloorplan(),
          const SizedBox(height: 14),

          // Option 1 Store-and-Forward Mesh Relay Bar (Suryansh)
          _buildStoreAndForwardMeshBar(),
          const SizedBox(height: 14),

          // 1-Tap Emergency SOS Banner
          NeubrutalistCard(
            backgroundColor: DeltaColors.dangerRed.withValues(alpha: 0.18),
            borderColor: DeltaColors.dangerRed,
            onTap: _showSosConfirmationDialog,
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: DeltaColors.dangerRed,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.black, width: 2),
                    boxShadow: const [
                      BoxShadow(color: Colors.black, offset: Offset(2, 2), blurRadius: 0),
                    ],
                  ),
                  child: const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '1-TAP FIELD MARSHAL SOS',
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: DeltaColors.dangerRed,
                        ),
                      ),
                      Text(
                        'Instant crowd surge & emergency safety escalation',
                        style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textLight),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios, size: 14, color: DeltaColors.dangerRed),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // DEMAND 3: VIRTUAL TURNSTILE TALLY CLICKER (Zero-Hardware Mode)
          NeubrutalistCard(
            backgroundColor: DeltaColors.surfaceLight,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.touch_app, color: DeltaColors.skyAqua, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'VIRTUAL TURNSTILE CLICKER',
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                    NeubrutalistBadge(
                      label: 'HAPTIC ACTIVE',
                      backgroundColor: DeltaColors.mustard,
                      textColor: Colors.black,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '1-Tap tactile passage counting with instant edge store-and-forward sync.',
                  style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textLight),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.heavyImpact();
                          final targetHallId = _selectedBlueprintRoomId ?? (_rooms.isNotEmpty ? _rooms.first.id : 'hall-1');
                          _api.recordDoorTally(hallId: targetHallId, type: 'in', count: 1);
                          setState(() {
                            final idx = _rooms.indexWhere((r) => r.id == targetHallId);
                            if (idx != -1) {
                              final r = _rooms[idx];
                              final newOcc = r.currentOccupancy + 1;
                              final newDensity = r.capacity > 0 ? (newOcc / r.capacity * 100.0) : r.currentDensity;
                              _rooms[idx] = RoomTelemetry(
                                id: r.id,
                                name: r.name,
                                currentDensity: newDensity,
                                capacity: r.capacity,
                                currentOccupancy: newOcc,
                                status: newDensity > 85 ? 'CRITICAL' : (newDensity > 65 ? 'ELEVATED' : 'OPTIMAL'),
                                predictedRisk: r.predictedRisk,
                                trend: 'RISING',
                                temperature: r.temperature,
                                co2: r.co2,
                                doorCountIn: r.doorCountIn + 1,
                                doorCountOut: r.doorCountOut,
                              );
                            }
                          });
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Gate Passage Recorded (+1 IN)'),
                              duration: Duration(milliseconds: 600),
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: Neubrutalism.boxDecoration(
                            color: const Color(0xFF22C55E),
                            radius: 8,
                            borderColor: Colors.black,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.add_circle, color: Colors.black, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                '+ ENTRY IN',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.black,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.mediumImpact();
                          final targetHallId = _selectedBlueprintRoomId ?? (_rooms.isNotEmpty ? _rooms.first.id : 'hall-1');
                          _api.recordDoorTally(hallId: targetHallId, type: 'out', count: 1);
                          setState(() {
                            final idx = _rooms.indexWhere((r) => r.id == targetHallId);
                            if (idx != -1 && _rooms[idx].currentOccupancy > 0) {
                              final r = _rooms[idx];
                              final newOcc = r.currentOccupancy - 1;
                              final newDensity = r.capacity > 0 ? (newOcc / r.capacity * 100.0) : r.currentDensity;
                              _rooms[idx] = RoomTelemetry(
                                id: r.id,
                                name: r.name,
                                currentDensity: newDensity,
                                capacity: r.capacity,
                                currentOccupancy: newOcc,
                                status: newDensity > 85 ? 'CRITICAL' : (newDensity > 65 ? 'ELEVATED' : 'OPTIMAL'),
                                predictedRisk: r.predictedRisk,
                                trend: 'FALLING',
                                temperature: r.temperature,
                                co2: r.co2,
                                doorCountIn: r.doorCountIn,
                                doorCountOut: r.doorCountOut + 1,
                              );
                            }
                          });
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Gate Passage Recorded (-1 OUT)'),
                              duration: Duration(milliseconds: 600),
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: Neubrutalism.boxDecoration(
                            color: Colors.white,
                            radius: 8,
                            borderColor: Colors.black,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.remove_circle_outline, color: Colors.black, size: 20),
                              const SizedBox(width: 6),
                              Text(
                                '- EXIT',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.black,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 1-Tap Quick Action Dispatch Grid
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '1-TAP TACTICAL DISPATCH',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              Text(
                'INSTANT RELAY',
                style: GoogleFonts.spaceGrotesk(fontSize: 10, color: DeltaColors.mustard, fontWeight: FontWeight.bold),
              ),
            ],
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
              _buildTacticalActionCard('RESTOCK WATER', 'water_supply', Icons.water_drop, DeltaColors.skyAqua),
              _buildTacticalActionCard('DEPLOY SECURITY', 'security_post', Icons.shield, DeltaColors.mustard),
              _buildTacticalActionCard('OPEN OVERFLOW', 'gate_release', Icons.door_sliding, DeltaColors.deepSaffron),
              _buildTacticalActionCard('COOLING BOOST', 'hvac_boost', Icons.ac_unit, DeltaColors.balticBlue),
            ],
          ),
          const SizedBox(height: 24),

          // Monitored Zone Gauges Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'MONITORED ZONE DENSITY',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              Text(
                '${_rooms.length} ZONES ACTIVE',
                style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.neonCyan, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Zone Density List
          ..._rooms.map((room) => _buildEnhancedRoomCard(room)),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  // POINT 5 (Suryansh): Interactive Venue Blueprint Floorplan
  Widget _buildInteractiveBlueprintFloorplan() {
    return NeubrutalistCard(
      backgroundColor: DeltaColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.map_outlined, color: DeltaColors.skyAqua, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'INTERACTIVE VENUE BLUEPRINT',
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.white),
                  ),
                ],
              ),
              NeubrutalistBadge(label: 'FLOOR 1', backgroundColor: DeltaColors.mustard, textColor: Colors.black),
            ],
          ),
          const SizedBox(height: 12),

          // Blueprint SVG-styled Grid Layout
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF07111E),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: DeltaColors.balticBlue, width: 2),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: _buildBlueprintChamber('room1', 'TURING HALL', '84%', DeltaColors.dangerRed),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: _buildBlueprintChamber('room2', 'LOVELACE', '65%', DeltaColors.mustard),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _buildBlueprintChamber('room3', 'HUB', '42%', DeltaColors.neonCyan),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildBlueprintChamber('room4', 'SHANNON', '52%', DeltaColors.neonCyan),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildBlueprintChamber('room5', 'PAVILION', '35%', DeltaColors.neonCyan),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_selectedBlueprintRoomId != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: DeltaColors.surfaceLight,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: DeltaColors.skyAqua, width: 1.5),
              ),
              child: Row(
                children: [
                  const Icon(Icons.pin_drop, size: 14, color: DeltaColors.skyAqua),
                  const SizedBox(width: 6),
                  Text(
                    'Focused on ${_rooms.firstWhere((r) => r.id == _selectedBlueprintRoomId, orElse: () => _rooms.first).name}',
                    style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBlueprintChamber(String id, String label, String density, Color heatColor) {
    final isSelected = _selectedBlueprintRoomId == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedBlueprintRoomId = id),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? heatColor.withValues(alpha: 0.3) : const Color(0xFF0F1E33),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: isSelected ? heatColor : Colors.black, width: isSelected ? 2.5 : 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black,
              offset: isSelected ? const Offset(2, 2) : const Offset(1, 1),
              blurRadius: 0,
            ),
          ],
        ),
        child: Column(
          children: [
            Text(
              label,
              style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white),
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: heatColor,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                density,
                style: GoogleFonts.spaceGrotesk(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.black),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Option 1: Store-and-Forward Mesh Relay Bar (Suryansh)
  Widget _buildStoreAndForwardMeshBar() {
    final queuedCount = _api.offlineQueueCount;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: DeltaColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.black, width: 2),
        boxShadow: const [
          BoxShadow(color: Colors.black, offset: Offset(2, 2), blurRadius: 0),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.wifi_tethering, size: 16, color: DeltaColors.neonCyan),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('LOCAL HOTSPOT MESH RELAY', style: GoogleFonts.spaceGrotesk(fontSize: 10, fontWeight: FontWeight.w900, color: DeltaColors.mustard)),
                  Text(
                    queuedCount == 0 ? '● Online (Area 1 Link • 0 pending)' : '○ Roaming ($queuedCount actions queued)',
                    style: GoogleFonts.spaceGrotesk(fontSize: 10, color: queuedCount == 0 ? DeltaColors.successGreen : Colors.orangeAccent),
                  ),
                ],
              ),
            ],
          ),
          InkWell(
            onTap: () async {
              final flushed = await _api.flushOfflineQueue();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('⚡ Mesh Relay Synced ($flushed delivered)')),
                );
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: DeltaColors.surfaceLight,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: DeltaColors.skyAqua, width: 1.5),
              ),
              child: Text(
                'SYNC QUEUE',
                style: GoogleFonts.spaceGrotesk(fontSize: 10, fontWeight: FontWeight.w800, color: DeltaColors.skyAqua),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMicroStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.spaceGrotesk(fontSize: 9, color: DeltaColors.textMuted, fontWeight: FontWeight.bold)),
        Text(value, style: GoogleFonts.spaceGrotesk(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w800)),
      ],
    );
  }

  Widget _buildTacticalActionCard(String title, String actionCode, IconData icon, Color color) {
    return NeubrutalistCard(
      backgroundColor: DeltaColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
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
              content: Row(
                children: [
                  Icon(icon, color: color, size: 18),
                  const SizedBox(width: 8),
                  Text('Dispatched: $title', style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                ],
              ),
              duration: const Duration(seconds: 2),
            ),
          );
        }
      },
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.black, width: 1.5),
            ),
            child: Icon(icon, color: Colors.black, size: 16),
          ),
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
    );
  }

  Widget _buildEnhancedRoomCard(RoomTelemetry room) {
    final isCritical = room.currentDensity >= 80;
    final isElevated = room.currentDensity >= 60 && room.currentDensity < 80;
    final statusColor = isCritical ? DeltaColors.dangerRed : isElevated ? DeltaColors.mustard : DeltaColors.neonCyan;

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
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
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
                    ],
                  ),
                ),
                NeubrutalistBadge(
                  label: '${room.currentDensity.toStringAsFixed(0)}% • ${room.status}',
                  backgroundColor: statusColor,
                  textColor: isCritical ? Colors.white : Colors.black,
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Segmented Density Bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Container(
                height: 10,
                color: DeltaColors.surfaceLight,
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: (room.currentDensity / 100).clamp(0.0, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          DeltaColors.skyAqua,
                          statusColor,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Telemetry Metrics Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${room.currentOccupancy} / ${room.capacity} seats (${(room.currentDensity).toStringAsFixed(1)}%)',
                  style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted, fontWeight: FontWeight.bold),
                ),
                Row(
                  children: [
                    Text(
                      '↑${room.doorCountIn}  ↓${room.doorCountOut}',
                      style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.skyAqua, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '• ${room.temperature}°C',
                      style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.mustard),
                    ),
                  ],
                ),
              ],
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
    final filteredTasks = _tasks.where((t) {
      if (_taskFilter == 'URGENT') return t.severity == 'URGENT' || t.severity == 'CRITICAL';
      if (_taskFilter == 'CLAIMED') return t.status == 'claimed';
      if (_taskFilter == 'RESOLVED') return t.status == 'resolved';
      return true;
    }).toList();

    final urgentCount = _tasks.where((t) => t.severity == 'URGENT' || t.severity == 'CRITICAL').length;
    final claimedCount = _tasks.where((t) => t.status == 'claimed').length;
    final resolvedCount = _tasks.where((t) => t.status == 'resolved').length;

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
        label: Text('DISPATCH TASK', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w900)),
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
            const SizedBox(height: 12),

            // Filter Tabs Row
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildTaskFilterChip('ALL', 'ALL (${_tasks.length})'),
                  const SizedBox(width: 6),
                  _buildTaskFilterChip('URGENT', '🔥 URGENT ($urgentCount)'),
                  const SizedBox(width: 6),
                  _buildTaskFilterChip('CLAIMED', '✋ CLAIMED ($claimedCount)'),
                  const SizedBox(width: 6),
                  _buildTaskFilterChip('RESOLVED', '✅ RESOLVED ($resolvedCount)'),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (filteredTasks.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Center(
                  child: Column(
                    children: [
                      const Icon(Icons.task_alt, size: 48, color: DeltaColors.textMuted),
                      const SizedBox(height: 8),
                      Text(
                        'No incidents matching $_taskFilter filter.',
                        style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...filteredTasks.map((task) => _buildEnhancedTaskCard(task)),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskFilterChip(String filterKey, String label) {
    final isSelected = _taskFilter == filterKey;
    return GestureDetector(
      onTap: () => setState(() => _taskFilter = filterKey),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? DeltaColors.skyAqua : DeltaColors.surface,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.black, width: 1.8),
          boxShadow: [
            BoxShadow(
              color: Colors.black,
              offset: isSelected ? const Offset(1.5, 1.5) : const Offset(1, 1),
              blurRadius: 0,
            ),
          ],
        ),
        child: Text(
          label,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: isSelected ? Colors.black : DeltaColors.textLight,
          ),
        ),
      ),
    );
  }

  Widget _buildEnhancedTaskCard(TaskItem task) {
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
                  icon: isUrgent ? Icons.warning_amber : null,
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
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 14, color: DeltaColors.mustard),
                const SizedBox(width: 4),
                Text(task.location, style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
                if (task.assignedTo != null) ...[
                  const SizedBox(width: 12),
                  const Icon(Icons.person_pin, size: 14, color: DeltaColors.neonCyan),
                  const SizedBox(width: 4),
                  Text(task.assignedTo!, style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.neonCyan, fontWeight: FontWeight.bold)),
                ],
              ],
            ),
            const SizedBox(height: 14),

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
                        height: 40,
                        fontSize: 12,
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
                      height: 40,
                      fontSize: 12,
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
    final quickVoiceMessages = [
      'All primary venue exits verified clear.',
      'Requesting 2 runners for Turing stage water restock.',
      'Crowd surge detected at Entrance Gate 1.',
      'Medical first responder on standby at Hub.',
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
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
                  'Encrypted low-latency tactical radio dispatch',
                  style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted),
                ),
              ],
            ),
            NeubrutalistBadge(
              label: 'MESH CH $_activeChannel',
              backgroundColor: DeltaColors.neonCyan,
              textColor: Colors.black,
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Channel Selector
        NeubrutalistCard(
          backgroundColor: DeltaColors.surface,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('ACTIVE RADIO CHANNEL:', style: GoogleFonts.spaceGrotesk(fontSize: 10, fontWeight: FontWeight.bold, color: DeltaColors.mustard)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _buildChannelPill('CH 1: OPS', '1')),
                  const SizedBox(width: 6),
                  Expanded(child: _buildChannelPill('CH 2: SEC', '2')),
                  const SizedBox(width: 6),
                  Expanded(child: _buildChannelPill('CH 3: MED', '3')),
                  const SizedBox(width: 6),
                  Expanded(child: _buildChannelPill('CH 4: AV', '4')),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // PTT Big Broadcast Trigger Card
        NeubrutalistCard(
          backgroundColor: DeltaColors.yaleBlue,
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
          child: Column(
            children: [
              // Waveform Visualizer
              AudioWaveformVisualizer(
                isBroadcasting: _isBroadcasting,
                barColor: DeltaColors.neonCyan,
              ),
              const SizedBox(height: 20),

              // Interactive PTT Mic Button
              GestureDetector(
                onTapDown: (_) => setState(() => _isBroadcasting = true),
                onTapUp: (_) async {
                  setState(() => _isBroadcasting = false);
                  await _api.broadcastVoice(
                    sender: widget.session.name,
                    channel: _activeChannel,
                    text: 'Live radio transmission from ${widget.session.name}',
                  );
                },
                onTapCancel: () => setState(() => _isBroadcasting = false),
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: _isBroadcasting ? DeltaColors.dangerRed : DeltaColors.mustard,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.black, width: 3.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black,
                        offset: _isBroadcasting ? const Offset(1, 1) : const Offset(4, 4),
                        blurRadius: 0,
                      ),
                    ],
                  ),
                  child: Icon(
                    _isBroadcasting ? Icons.graphic_eq : Icons.mic,
                    size: 46,
                    color: Colors.black,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _isBroadcasting ? 'TRANSMITTING LIVE RADIO...' : 'HOLD / TAP TO BROADCAST',
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: _isBroadcasting ? DeltaColors.neonCyan : Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Transmits encrypted voice burst to all channel $_activeChannel marshals',
                style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.skyAqua),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Quick Tactical Voice Callouts
        Text(
          '1-TAP RADIO PHRASES:',
          style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.mustard),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: quickVoiceMessages.map((msg) => InkWell(
            onTap: () async {
              await _api.broadcastVoice(
                sender: widget.session.name,
                channel: _activeChannel,
                text: msg,
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: DeltaColors.surface,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.black, width: 1.8),
                boxShadow: const [
                  BoxShadow(color: Colors.black, offset: Offset(2, 2), blurRadius: 0),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.send, color: DeltaColors.skyAqua, size: 12),
                  const SizedBox(width: 6),
                  Text(msg, style: GoogleFonts.spaceGrotesk(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          )).toList(),
        ),
        const SizedBox(height: 24),

        // Transmission Feed
        Text(
          'TRANSMISSION FEED LOG',
          style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
        ),
        const SizedBox(height: 10),

        if (_voiceTransmissions.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: Neubrutalism.boxDecoration(color: DeltaColors.surface, radius: 8),
            child: Text(
              'No voice transmissions recorded yet. Tap microphone or select phrase above.',
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
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: DeltaColors.skyAqua,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.black, width: 1.5),
                      ),
                      child: const Icon(Icons.volume_up, color: Colors.black, size: 16),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${v.speaker} (CH ${v.channel})',
                                style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.mustard),
                              ),
                              Text(
                                '${v.timestamp.hour.toString().padLeft(2, '0')}:${v.timestamp.minute.toString().padLeft(2, '0')}',
                                style: GoogleFonts.spaceGrotesk(fontSize: 10, color: DeltaColors.textMuted),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
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

  Widget _buildChannelPill(String title, String chNum) {
    final isSelected = _activeChannel == chNum;
    return GestureDetector(
      onTap: () => setState(() => _activeChannel = chNum),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? DeltaColors.neonCyan : DeltaColors.surfaceLight,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.black, width: 1.8),
          boxShadow: [
            BoxShadow(
              color: Colors.black,
              offset: isSelected ? const Offset(2, 2) : const Offset(1, 1),
              blurRadius: 0,
            ),
          ],
        ),
        child: Center(
          child: Text(
            title,
            style: GoogleFonts.spaceGrotesk(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: isSelected ? Colors.black : DeltaColors.textMuted,
            ),
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
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'BADGE SCANNER DECK',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                Text(
                  'Anti-tamper holographic attendee pass validation',
                  style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted),
                ),
              ],
            ),
            NeubrutalistBadge(
              label: '$_totalGateCheckins CHECK-INS',
              backgroundColor: DeltaColors.mustard,
              textColor: Colors.black,
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Futuristic Scanner Viewfinder with Animated Laser
        NeubrutalistCard(
          backgroundColor: Colors.black,
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Container(
                height: 140,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: DeltaColors.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: DeltaColors.neonCyan, width: 2),
                ),
                child: AnimatedBuilder(
                  animation: _scannerAnim,
                  builder: (context, _) {
                    return Stack(
                      children: [
                        Center(
                          child: Icon(Icons.qr_code_2, size: 84, color: DeltaColors.textMuted.withValues(alpha: 0.25)),
                        ),
                        // Sweeping Laser Beam
                        Positioned(
                          top: 140 * _scanLinePosition.value,
                          left: 0,
                          right: 0,
                          child: Container(
                            height: 2.5,
                            decoration: BoxDecoration(
                              color: DeltaColors.neonCyan,
                              boxShadow: [
                                BoxShadow(
                                  color: DeltaColors.neonCyan.withValues(alpha: 0.8),
                                  blurRadius: 8,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 8,
                          right: 8,
                          child: Text(
                            'OPTICAL SCANNER READY',
                            style: GoogleFonts.spaceGrotesk(fontSize: 9, fontWeight: FontWeight.bold, color: DeltaColors.neonCyan),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 14),

              // Code Input & Presets
              TextField(
                controller: codeCtrl,
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: DeltaColors.surfaceLight,
                  prefixIcon: const Icon(Icons.qr_code, color: DeltaColors.neonCyan),
                  hintText: 'e.g. VIP-9941',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Colors.black, width: 2)),
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(
                    label: const Text('Preset: VIP Pass', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                    backgroundColor: DeltaColors.surfaceLight,
                    side: const BorderSide(color: Colors.black, width: 1.5),
                    onPressed: () => codeCtrl.text = 'VIP-9941',
                  ),
                  ActionChip(
                    label: const Text('Preset: Keynote Speaker', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                    backgroundColor: DeltaColors.surfaceLight,
                    side: const BorderSide(color: Colors.black, width: 1.5),
                    onPressed: () => codeCtrl.text = 'SPK-1022',
                  ),
                  ActionChip(
                    label: const Text('Preset: Delegate', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                    backgroundColor: DeltaColors.surfaceLight,
                    side: const BorderSide(color: Colors.black, width: 1.5),
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
                    setState(() {
                      _lastScannedBadge = res;
                      _totalGateCheckins++;
                    });
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Badge verification error: $e')),
                      );
                    }
                  }
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Holographic Attendee Pass Card Result
        if (_lastScannedBadge != null) ...[
          NeubrutalistCard(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: _lastScannedBadge!.valid
                  ? [DeltaColors.yaleBlue, DeltaColors.balticBlue, const Color(0xFF1B3B6F)]
                  : [DeltaColors.dangerRed, const Color(0xFF8B0000)],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.check_circle, color: DeltaColors.neonCyan, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'CLEARANCE APPROVED',
                          style: GoogleFonts.outfit(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: DeltaColors.neonCyan,
                          ),
                        ),
                      ],
                    ),
                    NeubrutalistBadge(
                      label: _lastScannedBadge!.tier,
                      backgroundColor: DeltaColors.mustard,
                      textColor: Colors.black,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  _lastScannedBadge!.name,
                  style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white),
                ),
                Text(
                  'Credential ID: ${_lastScannedBadge!.ticketId}',
                  style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.skyAqua, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                const Divider(color: Colors.black, thickness: 1.8),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Zone Clearance:', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
                    Text(
                      _lastScannedBadge!.allowedZones.join(', '),
                      style: GoogleFonts.spaceGrotesk(fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Anti-Tamper Seal:', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted)),
                    Text('HMAC-SHA256 VERIFIED', style: GoogleFonts.spaceGrotesk(color: DeltaColors.neonCyan, fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}
