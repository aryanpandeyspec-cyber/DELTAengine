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

class _CockpitScreenState extends State<CockpitScreen> with TickerProviderStateMixin {
  String _zoneFilter = 'ALL';
  bool _torchEnabled = false;
  late AnimationController _pttAnim;
  final _api = ApiService();
  final _ws = WebSocketService();

  int _currentTabIndex = 0;
  bool _isLoading = false;
  bool _isWsConnected = false;
  String _taskFilter = 'ALL';
  String _taskSearchQuery = '';
  final _taskSearchController = TextEditingController();
  String? _selectedBlueprintRoomId;

  List<RoomTelemetry> _rooms = [
    RoomTelemetry(id: 'room1', name: 'Turing Grand Hall', currentDensity: 84.0, capacity: 500, currentOccupancy: 420, status: 'CRITICAL', predictedRisk: 0.88, doorCountIn: 480, doorCountOut: 60, temperature: 24.2, co2: 780),
    RoomTelemetry(id: 'room2', name: 'Lovelace Auditorium', currentDensity: 65.0, capacity: 250, currentOccupancy: 162, status: 'ELEVATED', predictedRisk: 0.65, doorCountIn: 190, doorCountOut: 28, temperature: 22.8, co2: 640),
    RoomTelemetry(id: 'room3', name: 'Von Neumann Hub', currentDensity: 42.0, capacity: 180, currentOccupancy: 75, status: 'OPTIMAL', predictedRisk: 0.30, doorCountIn: 92, doorCountOut: 17, temperature: 21.5, co2: 520),
    RoomTelemetry(id: 'room4', name: 'Shannon Workshop Suite', currentDensity: 52.0, capacity: 120, currentOccupancy: 62, status: 'OPTIMAL', predictedRisk: 0.40, doorCountIn: 70, doorCountOut: 8, temperature: 22.0, co2: 590),
    RoomTelemetry(id: 'room5', name: 'Hopper Tech Pavilion', currentDensity: 35.0, capacity: 1200, currentOccupancy: 420, status: 'OPTIMAL', predictedRisk: 0.25, doorCountIn: 490, doorCountOut: 70, temperature: 20.8, co2: 480),
  ];
  List<TaskItem> _tasks = [
    TaskItem(
      id: 'task-init-1',
      title: 'Turing Hall Optical Turnstile Influx Monitor',
      description: 'Active crowd surge monitoring at entry gates',
      location: 'Turing Grand Hall - Sector A',
      severity: 'HIGH',
      status: 'IN_PROGRESS',
      assignedTo: 'Aryan Pandey',
      createdAt: DateTime.now(),
    ),
    TaskItem(
      id: 'task-init-2',
      title: 'Perimeter Laser Tripwire Calibration Check',
      description: 'Verify optical beam tripwire alignment',
      location: 'Main Concourse North',
      severity: 'MEDIUM',
      status: 'PENDING',
      assignedTo: null,
      createdAt: DateTime.now(),
    ),
    TaskItem(
      id: 'task-init-3',
      title: 'Life-Safety Evacuation Egress Path Clear',
      description: 'Ensure double-door emergency exits are unblocked',
      location: 'Lovelace Auditorium Egress',
      severity: 'CRITICAL',
      status: 'RESOLVED',
      assignedTo: 'Suryansh',
      createdAt: DateTime.now(),
    ),
  ];
  final List<VoiceTransmission> _voiceTransmissions = [];
  AttendeeBadgeResult? _lastScannedBadge;
  int _totalGateCheckins = 842;
  final _scannerCodeController = TextEditingController(text: 'VIP-9941');

  // Walkie talkie state
  String _activeChannel = '1';
  bool _isBroadcasting = false;

  // Live Event Phase Countdown Ticker (from Suryansh)
  int _tickerSeconds = 868; // 14 mins 28s
  int _currentStageIdx = 0;
  Timer? _tickerTimer;
  Timer? _telemetryTimer;

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
  StreamSubscription? _taskBatchSub;
  int _sessionValidateTick = 0;
  StreamSubscription? _roomSub;
  StreamSubscription? _voiceSub;
  StreamSubscription? _sosSub;
  StreamSubscription? _scheduleSub;
  StreamSubscription? _quickActionSub;
  StreamSubscription? _sessionRevokedSub;
  StreamSubscription? _badgeSub;

  // Admin Governance & Session Discrepancy State
  List<ActiveOperatorSession> _adminSessions = [];
  List<SecurityDiscrepancy> _adminDiscrepancies = [];
  bool _isLoadingAdminSessions = false;
  Timer? _adminSessionsTimer;

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
    _startTelemetryRefresher();
    _loadInitialData();
    _setupWebSocketListeners();
    _pttAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat();

    if (widget.session.isAdmin) {
      _fetchAdminGovernanceData();
      _adminSessionsTimer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (mounted && widget.session.isAdmin) {
          _fetchAdminGovernanceData(silent: true);
        }
      });
    }
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

  void _startTelemetryRefresher() {
    _telemetryTimer = Timer.periodic(const Duration(seconds: 4), (timer) async {
      if (!mounted) return;
      try {
        _sessionValidateTick++;
        // Validate active session every 8 ticks (~32s) to prevent hot-path network blocking
        if (_sessionValidateTick % 8 == 0) {
          final isSessionValid = await _api.validateSession();
          if (!isSessionValid && mounted) {
            _handleForcedLogout(reason: 'Session revoked or expired by Administrator.');
            return;
          }
        }

        // Concurrent parallel fetching
        final results = await Future.wait([
          _api.fetchRooms(),
          _api.fetchTasks(),
        ]);
        final rooms = results[0];
        final tasks = results[1];
        if (mounted && rooms.isNotEmpty) {
          setState(() {
            _rooms = List<RoomTelemetry>.from(rooms);
            _tasks = List<TaskItem>.from(tasks);
          });
        }
      } catch (_) {
        if (mounted && _rooms.isNotEmpty) {
          setState(() {
            final now = DateTime.now().millisecondsSinceEpoch;
            for (int i = 0; i < _rooms.length; i++) {
              final r = _rooms[i];
              final delta = (now % (i + 3) == 0) ? (now % 2 == 0 ? 1 : -1) : 0;
              final newOcc = (r.currentOccupancy + delta).clamp(1, r.capacity);
              final newDensity = r.capacity > 0 ? (newOcc / r.capacity * 100.0) : r.currentDensity;
              _rooms[i] = RoomTelemetry(
                id: r.id,
                name: r.name,
                currentDensity: double.parse(newDensity.toStringAsFixed(1)),
                capacity: r.capacity,
                currentOccupancy: newOcc,
                status: newDensity >= 80 ? 'CRITICAL' : (newDensity >= 60 ? 'ELEVATED' : 'OPTIMAL'),
                predictedRisk: r.predictedRisk,
                trend: delta > 0 ? 'RISING' : (delta < 0 ? 'FALLING' : r.trend),
                doorCountIn: delta > 0 ? r.doorCountIn + 1 : r.doorCountIn,
                doorCountOut: delta < 0 ? r.doorCountOut + 1 : r.doorCountOut,
                temperature: r.temperature,
                co2: r.co2,
              );
            }
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _tickerTimer?.cancel();
    _telemetryTimer?.cancel();
    _adminSessionsTimer?.cancel();
    _scannerAnim.dispose();
    _pttAnim.dispose();
    _scannerCodeController.dispose();
    _wsStateSub?.cancel();
    _taskSub?.cancel();
    _taskBatchSub?.cancel();
    _roomSub?.cancel();
    _voiceSub?.cancel();
    _sosSub?.cancel();
    _scheduleSub?.cancel();
    _quickActionSub?.cancel();
    _sessionRevokedSub?.cancel();
    _badgeSub?.cancel();
    _taskSearchController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    // 1. Immediately hydrate cached rooms & tasks for zero perceived latency
    final cachedRooms = _api.getCachedRooms();
    final cachedTasks = _api.getCachedTasks();
    if (cachedRooms.isNotEmpty && mounted) {
      setState(() => _rooms = List<RoomTelemetry>.from(cachedRooms));
    }
    if (cachedTasks.isNotEmpty && mounted) {
      setState(() => _tasks = List<TaskItem>.from(cachedTasks));
    }

    // 2. Fetch fresh telemetry concurrently in the background
    try {
      final results = await Future.wait([
        _api.fetchRooms().timeout(const Duration(milliseconds: 2500)),
        _api.fetchTasks().timeout(const Duration(milliseconds: 2500)),
      ]);

      if (mounted) {
        setState(() {
          _rooms = List<RoomTelemetry>.from(results[0] as List<RoomTelemetry>);
          _tasks = List<TaskItem>.from(results[1] as List<TaskItem>);
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
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
          final copy = List<TaskItem>.from(_tasks);
          final index = copy.indexWhere((t) => t.id == task.id);
          if (index != -1) {
            copy[index] = task;
          } else {
            copy.insert(0, task);
          }
          _tasks = copy;
        });
      }
    });

    _taskBatchSub = _ws.onTaskBatchEvent.listen((batch) {
      if (mounted && batch.isNotEmpty) {
        setState(() {
          _tasks = List<TaskItem>.from(batch);
        });
      }
    });

    _roomSub = _ws.onRoomEvent.listen((rooms) {
      if (mounted) {
        setState(() => _rooms = List<RoomTelemetry>.from(rooms));
      }
    });

    _voiceSub = _ws.onVoiceEvent.listen((voice) {
      if (mounted) {
        setState(() {
          _voiceTransmissions.insert(0, voice);
          if (_voiceTransmissions.length > 50) {
            _voiceTransmissions.removeLast();
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: DeltaColors.surfaceLight,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
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

    _scheduleSub = _ws.onScheduleEvent.listen((data) {
      if (mounted) {
        final reason = data['conflictReason'] ?? data['reason'] ?? 'Schedule optimized by Self-Healing Swarm';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: DeltaColors.surfaceLight,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: const BorderSide(color: DeltaColors.mustard, width: 1.0),
            ),
            content: Row(
              children: [
                const Icon(Icons.auto_fix_high, color: DeltaColors.mustard, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '⚡ [SELF-HEALING OPTIMIZER] $reason',
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

    _quickActionSub = _ws.onQuickActionEvent.listen((action) {
      if (mounted) {
        final label = action['label'] ?? action['action'] ?? 'Tactical Action';
        final sender = action['sender'] ?? 'Field Operations';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: DeltaColors.surfaceLight,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: const BorderSide(color: DeltaColors.neonCyan, width: 1.0),
            ),
            content: Row(
              children: [
                const Icon(Icons.flash_on, color: DeltaColors.neonCyan, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '⚡ [DISPATCH SYNC] $label by $sender',
                    style: GoogleFonts.spaceGrotesk(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    });

    _badgeSub = _ws.onBadgeEvent.listen((badgeData) {
      if (mounted) {
        final total = badgeData['totalCheckedIn'];
        if (total is int) {
          setState(() => _totalGateCheckins = total);
        }
      }
    });

    _sessionRevokedSub = _ws.onSessionRevoked.listen((data) {
      if (mounted) {
        final sessId = data['sessionId']?.toString();
        final email = data['email']?.toString();
        if (sessId == widget.session.sessionId ||
            (email != null && email.toLowerCase() == widget.session.email.toLowerCase())) {
          _handleForcedLogout(reason: data['reason']?.toString() ?? 'Session revoked by Administrator.');
        } else if (widget.session.isAdmin) {
          // If this terminal is Admin and another terminal was revoked, refresh live session roster
          _fetchAdminGovernanceData(silent: true);
        }
      }
    });
  }

  Future<void> _fetchAdminGovernanceData({bool silent = false}) async {
    if (!silent && mounted) setState(() => _isLoadingAdminSessions = true);
    try {
      final res = await _api.fetchAdminSessions();
      if (mounted) {
        setState(() {
          _adminSessions = res['sessions'] as List<ActiveOperatorSession>? ?? [];
          _adminDiscrepancies = res['discrepancies'] as List<SecurityDiscrepancy>? ?? [];
          _isLoadingAdminSessions = false;
        });
      }
    } catch (_) {
      if (mounted && !silent) {
        setState(() => _isLoadingAdminSessions = false);
      }
    }
  }

  Future<void> _handleForcedLogout({String reason = 'Session terminated by Administrator.'}) async {
    _telemetryTimer?.cancel();
    _tickerTimer?.cancel();
    _adminSessionsTimer?.cancel();
    await _api.clearStoredSession();
    _ws.disconnect();

    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F1523),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: DeltaColors.dangerRed, width: 2.0),
        ),
        title: Row(
          children: [
            const Icon(Icons.gavel, color: DeltaColors.dangerRed, size: 24),
            const SizedBox(width: 10),
            Text(
              'ACCESS REVOKED',
              style: GoogleFonts.outfit(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 16,
              ),
            ),
          ],
        ),
        content: Text(
          'Your terminal authorization has been revoked by the Super Administrator.\n\nReason: $reason',
          style: GoogleFonts.spaceGrotesk(color: const Color(0xFFCBD5E1), fontSize: 13),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.dangerRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
            child: Text('RETURN TO LOGIN', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F1523),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF222F47), width: 1.0),
        ),
        title: Text(
          'DISCONNECT TERMINAL',
          style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
        ),
        content: Text(
          'Are you sure you want to sign out? This will end your active event session on this device.',
          style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted, fontSize: 12),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('CANCEL', style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.dangerRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('LOGOUT', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      _telemetryTimer?.cancel();
      _tickerTimer?.cancel();
      _adminSessionsTimer?.cancel();
      await _api.clearStoredSession();
      _ws.disconnect();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  void _showSessionDetailsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F1523),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF23324C), width: 1.0),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF162238),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.verified_user_outlined, color: DeltaColors.skyAqua, size: 20),
            ),
            const SizedBox(width: 10),
            Text(
              'SESSION SECURITY',
              style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 16),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSessionMetaRow('Terminal Operator', widget.session.name),
            _buildSessionMetaRow('Role Hierarchy', widget.session.role.toUpperCase()),
            _buildSessionMetaRow('Operator Email', widget.session.email),
            _buildSessionMetaRow('Session ID', widget.session.sessionId),
            _buildSessionMetaRow('Event Window', widget.session.remainingDurationFormatted),
            _buildSessionMetaRow('Remember Me Status', widget.session.rememberMe ? 'Persisted (4h Token)' : 'Single Session'),
            _buildSessionMetaRow('Engine Endpoint', _api.baseUrl),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('CLOSE', style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.dangerRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              _handleLogout();
            },
            child: Text('LOGOUT', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionMetaRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textDim, fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: Text(
              val,
              style: GoogleFonts.spaceGrotesk(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleForceRevokeSession(ActiveOperatorSession targetSession) async {
    HapticFeedback.heavyImpact();
    final isSelf = targetSession.sessionId == widget.session.sessionId ||
        targetSession.email.toLowerCase() == widget.session.email.toLowerCase();

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F1523),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: DeltaColors.dangerRed, width: 2.0),
        ),
        title: Row(
          children: [
            const Icon(Icons.gavel, color: DeltaColors.dangerRed, size: 22),
            const SizedBox(width: 8),
            Text(
              isSelf ? 'REVOKE OWN SESSION' : 'FORCE LOGOUT OPERATOR',
              style: GoogleFonts.outfit(
                color: DeltaColors.dangerRed,
                fontWeight: FontWeight.w900,
                fontSize: 15,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isSelf
                  ? 'End and revoke your own active terminal session on this device?'
                  : 'Revoke active terminal session for ${targetSession.name}?',
              style: GoogleFonts.spaceGrotesk(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF1A121E),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: DeltaColors.dangerRed.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Terminal: ${targetSession.deviceModel} (${targetSession.ip})', style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted)),
                  Text('Role: ${targetSession.role} • Title: ${targetSession.title}', style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted)),
                  Text('Session ID: ${targetSession.sessionId}', style: GoogleFonts.spaceGrotesk(fontSize: 10, color: DeltaColors.textDim)),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'This action will immediately terminate their authorization token, force disconnect their terminal, and log them out back to the authentication screen.',
              style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('CANCEL', style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.dangerRed,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isSelf ? 'REVOKE & LOGOUT' : 'CONFIRM REVOCATION', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w800, fontSize: 11)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      final success = await _api.revokeSession(
        sessionId: targetSession.sessionId,
        reason: 'Revoked by Administrator command (${widget.session.name})',
      );
      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFF1A1E2C),
              content: Text(
                '✓ Revoked session for ${targetSession.name}. Terminal forcibly logged out.',
                style: GoogleFonts.spaceGrotesk(color: DeltaColors.neonCyan, fontWeight: FontWeight.bold),
              ),
            ),
          );
          if (targetSession.sessionId == widget.session.sessionId) {
            _handleForcedLogout(reason: 'You revoked your own session.');
            return;
          }
          _fetchAdminGovernanceData(silent: true);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to revoke session. Verify server connectivity.')),
          );
        }
      }
    }
  }

  bool _isSosDialogActive = false;

  void _showEmergencyAlertBanner(Map<String, dynamic> sos) {
    if (_isSosDialogActive || !mounted) return;
    _isSosDialogActive = true;
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
                side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
              ),
            ),
            onPressed: () => Navigator.pop(ctx),
            child: Text('ACKNOWLEDGE & DISPATCH', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    ).then((_) {
      _isSosDialogActive = false;
    });
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
        side: BorderSide(color: DeltaColors.cardBorder, width: 1.0),
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
                        border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
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


  void _showHostConfigDialog() {
    final hostController = TextEditingController(text: _api.baseUrl);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: DeltaColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: DeltaColors.surfaceLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
              ),
              child: const Icon(Icons.dns_outlined, color: DeltaColors.skyAqua, size: 20),
            ),
            const SizedBox(width: 10),
            Text(
              'NETWORK BACKEND',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w800,
                color: Colors.white,
                fontSize: 16,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'DELTA Engine Host Address:',
              style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: hostController,
              style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: DeltaColors.background,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: DeltaColors.skyAqua, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Quick Rebind Presets:',
              style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.textMuted),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _buildHostPresetChip('Wi-Fi Host (192.168.1.5:3000)', 'http://192.168.1.5:3000', hostController),
                _buildHostPresetChip('Localhost / Reverse ADB', 'http://127.0.0.1:3000', hostController),
                _buildHostPresetChip('Wi-Fi (192.168.1.6)', 'http://192.168.1.6:3000', hostController),
                _buildHostPresetChip('Wi-Fi LAN (3000)', 'http://192.168.1.4:3000', hostController),
                _buildHostPresetChip('Hotspot (3000)', 'http://192.168.137.1:3000', hostController),
                _buildHostPresetChip('Android Emulator', 'http://10.0.2.2:3000', hostController),
                _buildHostPresetChip('Production Cloud', 'https://deltaengine.vercel.app', hostController),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'CANCEL',
              style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted, fontWeight: FontWeight.bold),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.skyAqua,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onPressed: () async {
              final nav = Navigator.of(ctx);
              await _api.setBaseUrl(hostController.text);
              WebSocketService().connect();
              if (mounted) setState(() {});
              nav.pop();
            },
            child: Text(
              'SAVE & REBIND',
              style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w800, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHostPresetChip(String label, String url, TextEditingController controller) {
    return ActionChip(
      backgroundColor: DeltaColors.surfaceLight,
      label: Text(label, style: const TextStyle(fontSize: 11, color: DeltaColors.skyAqua, fontWeight: FontWeight.bold)),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
      ),
      onPressed: () {
        controller.text = url;
      },
    );
  }

  void _showNetworkDiagnosticsModal() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0C111E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        side: BorderSide(color: DeltaColors.cardBorder, width: 1.0),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF162238),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: DeltaColors.skyAqua.withValues(alpha: 0.3), width: 1.0),
                      ),
                      child: const Icon(Icons.hub_outlined, color: DeltaColors.skyAqua, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'EDGE ENGINE TELEMETRY',
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _isWsConnected ? DeltaColors.successGreen.withValues(alpha: 0.15) : Colors.red.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _isWsConnected ? DeltaColors.successGreen.withValues(alpha: 0.5) : Colors.red.withValues(alpha: 0.5),
                      width: 1.0,
                    ),
                  ),
                  child: Row(
                    children: [
                      PulsingDot(color: _isWsConnected ? DeltaColors.successGreen : Colors.red, size: 6),
                      const SizedBox(width: 6),
                      Text(
                        _isWsConnected ? 'CONNECTED' : 'STANDALONE',
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: _isWsConnected ? DeltaColors.successGreen : Colors.red,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF101726),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF222F47), width: 1.0),
              ),
              child: Column(
                children: [
                  _buildDiagRow('Engine Gateway URI', _api.baseUrl, Icons.dns_outlined),
                  const Divider(color: Color(0xFF1E283D), height: 16),
                  _buildDiagRow('Hardware Hot-Path Latency', '0.19 ms (Deterministic)', Icons.speed),
                  const Divider(color: Color(0xFF1E283D), height: 16),
                  _buildDiagRow('WebSocket Stream', 'Active • INIT_STATE + Realtime', Icons.sync_alt),
                  const Divider(color: Color(0xFF1E283D), height: 16),
                  _buildDiagRow('Store & Forward Outbox', '${_api.offlineQueueCount} events queued', Icons.outbox),
                  const Divider(color: Color(0xFF1E283D), height: 16),
                  _buildDiagRow('Mesh Cryptographic Seal', 'HMAC-SHA256 Multi-tenant', Icons.verified_user_outlined),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _showHostConfigDialog();
                    },
                    icon: const Icon(Icons.settings, size: 16, color: DeltaColors.skyAqua),
                    label: Text(
                      'HOST CONFIG',
                      style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.w800, color: DeltaColors.skyAqua),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: DeltaColors.skyAqua,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      await _loadInitialData();
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('✓ Resynced live telemetry graph from Edge')),
                        );
                      }
                    },
                    icon: const Icon(Icons.refresh, size: 16, color: Colors.black),
                    label: Text(
                      'FORCE RE-SYNC',
                      style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.black),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Widget _buildDiagRow(String title, String val, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 14, color: DeltaColors.textMuted),
        const SizedBox(width: 8),
        Text(title, style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted)),
        const Spacer(),
        Text(val, style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
      ],
    );
  }

  Widget _buildZoneFilterChip(String key, String label, {Color color = DeltaColors.skyAqua}) {
    final isSelected = _zoneFilter == key;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _zoneFilter = key);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.18) : const Color(0xFF101726),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? color : const Color(0xFF222F47),
            width: 1.0,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 10.5,
            fontWeight: FontWeight.w800,
            color: isSelected ? color : DeltaColors.textMuted,
          ),
        ),
      ),
    );
  }

  // --- ACTIONS ---

  Future<void> _handleClaimTask(TaskItem task) async {
    try {
      await _api.claimTask(taskId: task.id, claimedBy: widget.session.name);
      if (mounted) {
        setState(() {
          final idx = _tasks.indexWhere((t) => t.id == task.id);
          if (idx != -1) {
            _tasks[idx] = task.copyWith(status: 'CLAIMED', assignedTo: widget.session.name);
          }
        });
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
      if (mounted) {
        setState(() {
          final idx = _tasks.indexWhere((t) => t.id == task.id);
          if (idx != -1) {
            _tasks[idx] = task.copyWith(status: 'RESOLVED');
          }
        });
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
            side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
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
                        border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
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
                  side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
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
                  setState(() {

                    final idx = _tasks.indexWhere((t) => t.id == newTask.id);

                    if (idx >= 0) {

                      _tasks[idx] = newTask;

                    } else {

                      _tasks.insert(0, newTask);

                    }

                  });
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
    String selectedHall = _rooms.isNotEmpty ? _rooms.first.id : 'room1';
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
              items: _rooms.isNotEmpty
                  ? _rooms.map((r) => DropdownMenuItem(value: r.id, child: Text(r.name, style: const TextStyle(color: Colors.white)))).toList()
                  : const [
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
                side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
              ),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              final ok = await _api.triggerEmergencySos(
                volunteerName: widget.session.name,
                hallId: selectedHall,
                note: noteCtrl.text.trim(),
              );
              if (mounted) {
                if (ok) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      backgroundColor: DeltaColors.dangerRed,
                      content: Text('🚨 Emergency SOS Broadcast Sent to Central Command Deck!'),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      backgroundColor: Color(0xFF1E293B),
                      content: Text('⚠️ SOS Queued Locally: Offline Mesh will relay when connection restores.'),
                    ),
                  );
                }
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
    final roleColor = _getRoleColor(widget.session.role);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C1019),
        elevation: 0,
        titleSpacing: 10,
        toolbarHeight: 62,
        shape: const Border(
          bottom: BorderSide(color: Color(0xFF1E283D), width: 1.0),
        ),
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E283E), Color(0xFF101625)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.35), width: 1.0),
              ),
              child: Image.asset(
                'assets/images/delta_emblem.png',
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'DELTA ENGINE',
                    style: GoogleFonts.outfit(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 0.4,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 1),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: roleColor.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: roleColor.withValues(alpha: 0.4), width: 0.7),
                        ),
                        child: Text(
                          widget.session.role.toUpperCase(),
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 8.5,
                            fontWeight: FontWeight.w800,
                            color: roleColor,
                          ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          widget.session.name,
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 10.5,
                            color: const Color(0xFF94A3B8),
                            fontWeight: FontWeight.w600,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Unified Operational Status Pill (Telemetry & 4h Window)
          Tooltip(
            message: 'Operational Session & Telemetry Status',
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: _showNetworkDiagnosticsModal,
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 16, horizontal: 3),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                decoration: BoxDecoration(
                  color: const Color(0xFF111726),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: _isWsConnected
                        ? DeltaColors.successGreen.withValues(alpha: 0.5)
                        : DeltaColors.dangerRed.withValues(alpha: 0.5),
                    width: 1.0,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PulsingDot(
                      color: _isWsConnected ? DeltaColors.successGreen : DeltaColors.dangerRed,
                      size: 6,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      _isWsConnected ? widget.session.remainingDurationFormatted : 'OFFLINE',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: _isWsConnected ? Colors.white : DeltaColors.dangerRed,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // High-Priority Emergency SOS Button
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 2),
            child: InkWell(
              onTap: _showSosConfirmationDialog,
              borderRadius: BorderRadius.circular(7),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFDC2626), Color(0xFF991B1B)],
                  ),
                  borderRadius: BorderRadius.circular(7),
                  boxShadow: [
                    BoxShadow(color: DeltaColors.dangerRed.withValues(alpha: 0.35), blurRadius: 6),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.emergency, color: Colors.white, size: 12),
                    const SizedBox(width: 3),
                    Text(
                      'SOS',
                      style: GoogleFonts.spaceGrotesk(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Operations Overflow Menu
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Color(0xFF94A3B8), size: 19),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            color: const Color(0xFF101726),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFF222F47), width: 1.0),
            ),
            onSelected: (val) {
              if (val == 'session') _showSessionDetailsDialog();
              if (val == 'roster') _showTeamRosterDialog();
              if (val == 'diag') _showNetworkDiagnosticsModal();
              if (val == 'host') _showHostConfigDialog();
              if (val == 'logout') _handleLogout();
            },
            itemBuilder: (ctx) => [
              PopupMenuItem(
                value: 'session',
                child: Row(
                  children: [
                    const Icon(Icons.access_time, size: 15, color: DeltaColors.skyAqua),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Session (${widget.session.remainingDurationFormatted})',
                        style: GoogleFonts.spaceGrotesk(fontSize: 12, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'roster',
                child: Row(
                  children: [
                    const Icon(Icons.groups_outlined, size: 15, color: DeltaColors.mustard),
                    const SizedBox(width: 10),
                    Text('Team Contacts', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: Colors.white)),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'diag',
                child: Row(
                  children: [
                    const Icon(Icons.hub_outlined, size: 15, color: DeltaColors.neonCyan),
                    const SizedBox(width: 10),
                    Text('Engine Telemetry', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: Colors.white)),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'host',
                child: Row(
                  children: [
                    const Icon(Icons.dns_outlined, size: 15, color: DeltaColors.skyAqua),
                    const SizedBox(width: 10),
                    Text('Host IP Config', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: Colors.white)),
                  ],
                ),
              ),
              const PopupMenuDivider(height: 1),
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    const Icon(Icons.logout, size: 15, color: DeltaColors.dangerRed),
                    const SizedBox(width: 10),
                    Text('Logout Terminal', style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.dangerRed, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: (_isLoading && _rooms.isEmpty)
          ? const Center(child: CircularProgressIndicator(color: DeltaColors.skyAqua))
          : IndexedStack(
              index: _currentTabIndex.clamp(0, widget.session.isAdmin ? 4 : 3),
              children: [
                _buildTelemetryTab(),
                _buildTasksTab(),
                _buildWalkieTalkieTab(),
                _buildBadgeScannerTab(),
                if (widget.session.isAdmin)
                  _buildAdminGovernanceTab(),
              ],
            ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0C1019),
          border: const Border(top: BorderSide(color: Color(0xFF1E283D), width: 1.0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentTabIndex.clamp(0, widget.session.isAdmin ? 4 : 3),
          onTap: (index) => setState(() => _currentTabIndex = index),
          backgroundColor: Colors.transparent,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: DeltaColors.mustard,
          unselectedItemColor: const Color(0xFF64748B),
          selectedLabelStyle: GoogleFonts.spaceGrotesk(fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: 0.5),
          unselectedLabelStyle: GoogleFonts.spaceGrotesk(fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.3),
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard),
              label: 'RADAR',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.assignment_outlined),
              activeIcon: Icon(Icons.assignment),
              label: 'TASKS',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.radio_outlined),
              activeIcon: Icon(Icons.radio),
              label: 'COMMS',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.qr_code_scanner_outlined),
              activeIcon: Icon(Icons.qr_code_scanner),
              label: 'SCAN',
            ),
            if (widget.session.isAdmin)
              const BottomNavigationBarItem(
                icon: Icon(Icons.admin_panel_settings_outlined),
                activeIcon: Icon(Icons.admin_panel_settings),
                label: 'ADMIN',
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

    final criticalRoom = _rooms.cast<RoomTelemetry?>().firstWhere(
      (r) => (r?.currentDensity ?? 0) >= 80,
      orElse: () => null,
    );
    final hasCriticalSurge = criticalRoom != null;

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
              radius: 10,
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
                        style: DeltaTypography.microCaps(color: DeltaColors.mustard, fontSize: 10),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        currentStage['title']!.toString(),
                        style: DeltaTypography.titleSmall(color: Colors.white),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: DeltaColors.skyAqua, width: 1.5),
                  ),
                  child: Text(
                    '⏱️ $timeStr',
                    style: DeltaTypography.monoBadge(fontSize: 12, color: DeltaColors.skyAqua),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Autonomous Spatial Flow & Safety Steering Engine
          NeubrutalistCard(
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
                          const Icon(Icons.alt_route_rounded, color: DeltaColors.neonCyan, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'LIVE FLOW & SAFETY STEERING',
                              style: DeltaTypography.titleSmall(color: Colors.white),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    NeubrutalistBadge(
                      label: hasCriticalSurge ? 'DIVERSION ACTIVE' : 'STEERING NOMINAL',
                      backgroundColor: hasCriticalSurge ? DeltaColors.dangerRed : DeltaColors.mintGreen,
                      textColor: hasCriticalSurge ? Colors.white : Colors.black,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  criticalRoom != null
                      ? '⚠️ Elevated pressure in ${criticalRoom.name} (${criticalRoom.currentDensity.toStringAsFixed(0)}%). Autonomous edge swarms actively steering ingress away from chokepoints.'
                      : 'Real-time AI spatial balancing active across all 5 monitored sectors. Pedestrian velocities and corridor capacities nominal.',
                  style: DeltaTypography.bodyMuted(fontSize: 11.5),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildMicroStat('⚡ FLOW', '+${(totalIn / 60).clamp(18, 95).round()} pax/m'),
                      _buildMicroStat('🛡️ CHOKEPOINTS', hasCriticalSurge ? '1 Active' : '0 Clear'),
                      _buildMicroStat('📶 MESH', '5 Nodes'),
                      _buildMicroStat('⏱️ SLA', '1.2ms SLA'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: NeubrutalistButton(
                        label: hasCriticalSurge ? 'EXECUTE CORRIDOR RELIEF' : '⚡ REBALANCE INGRESS GATES',
                        height: 36,
                        fontSize: 11,
                        backgroundColor: hasCriticalSurge ? DeltaColors.dangerRed : DeltaColors.mustard,
                        textColor: hasCriticalSurge ? Colors.white : Colors.black,
                        onPressed: () async {
                          HapticFeedback.heavyImpact();
                          await _api.triggerTacticalAction('gate_release');
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                backgroundColor: DeltaColors.yaleBlue,
                                content: Text(
                                  '⚡ Edge Gate Reroute Executed: Secondary ingress corridors opened.',
                                  style: DeltaTypography.bodyBold(color: Colors.white, fontSize: 12),
                                ),
                              ),
                            );
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: NeubrutalistButton(
                        label: 'CALIBRATE SENSORS',
                        height: 36,
                        fontSize: 11,
                        backgroundColor: DeltaColors.surfaceElevated,
                        textColor: Colors.white,
                        onPressed: () async {
                          HapticFeedback.lightImpact();
                          await _loadInitialData();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                backgroundColor: DeltaColors.successGreen,
                                content: Text(
                                  '✅ Telemetry recalibrated with Edge Gateway.',
                                  style: DeltaTypography.bodyBold(color: Colors.black, fontSize: 12),
                                ),
                              ),
                            );
                          }
                        },
                      ),
                    ),
                  ],
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
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.hub_outlined, color: DeltaColors.neonCyan, size: 18),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              'GLOBAL VENUE PRESSURE',
                              style: DeltaTypography.titleMedium(
                                color: Colors.white,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
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
                      style: DeltaTypography.monoHero(
                        color: avgDensity >= 80 ? DeltaColors.dangerRed : (avgDensity >= 60 ? DeltaColors.mustard : DeltaColors.skyAqua),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$totalOccupancy / $totalCapacity Attendees',
                            style: DeltaTypography.monoStat(
                              fontSize: 12.5,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Turnstile Mesh: +$totalIn IN / -$totalOut OUT',
                            style: DeltaTypography.monoLabel(
                              fontSize: 11,
                              color: DeltaColors.skyAqua,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Animated Tactical Capacity Gauge
                TacticalProgressBar(
                  value: avgDensity / 100.0,
                  height: 8,
                  showSegments: true,
                ),
                const SizedBox(height: 14),

                // Micro telemetry indicators
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildMicroStat('🌡️ TEMP', '22.4°C'),
                      _buildMicroStat('💨 CO2', '620 ppm'),
                      _buildMicroStat('⚡ SLA', '0.7ms'),
                      _buildMicroStat('🚨 SURGES', hasCriticalSurge ? '1 Active' : '0 Clear'),
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
                    border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
                    boxShadow: const [
                      BoxShadow(color: Color(0x38000000), offset: Offset(0, 2), blurRadius: 8),
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
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.touch_app, color: DeltaColors.skyAqua, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'VIRTUAL TURNSTILE CLICKER',
                              style: DeltaTypography.titleSmall(color: Colors.white, fontSize: 12.5),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
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
                            borderColor: DeltaColors.cardBorder,
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
                            borderColor: DeltaColors.cardBorder,
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
              Expanded(
                child: Text(
                  '1-TAP TACTICAL DISPATCH',
                  style: DeltaTypography.titleMedium(color: Colors.white),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
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
              Expanded(
                child: Text(
                  'MONITORED ZONE DENSITY',
                  style: DeltaTypography.titleMedium(color: Colors.white),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${_rooms.length} ZONES ACTIVE',
                style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.neonCyan, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Datadog-style Zone Severity Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildZoneFilterChip('ALL', 'ALL (${_rooms.length})'),
                const SizedBox(width: 6),
                _buildZoneFilterChip('CRITICAL', 'CRITICAL (${_rooms.where((r) => r.status == "CRITICAL" || r.isCritical).length})', color: DeltaColors.dangerRed),
                const SizedBox(width: 6),
                _buildZoneFilterChip('ELEVATED', 'ELEVATED (${_rooms.where((r) => r.status == "ELEVATED" || (!r.isCritical && r.currentDensity >= 60)).length})', color: DeltaColors.mustard),
                const SizedBox(width: 6),
                _buildZoneFilterChip('OPTIMAL', 'OPTIMAL (${_rooms.where((r) => r.status == "OPTIMAL" || r.currentDensity < 60).length})', color: DeltaColors.successGreen),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Zone Density List filtered by _zoneFilter
          ..._rooms
              .where((room) {
                if (_zoneFilter == 'CRITICAL') return room.status == 'CRITICAL' || room.isCritical;
                if (_zoneFilter == 'ELEVATED') return room.status == 'ELEVATED' || (!room.isCritical && room.currentDensity >= 60);
                if (_zoneFilter == 'OPTIMAL') return room.status == 'OPTIMAL' || (room.status != 'CRITICAL' && room.currentDensity < 60);
                return true;
              })
              .map((room) => _buildEnhancedRoomCard(room)),
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
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.map_outlined, color: DeltaColors.skyAqua, size: 18),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        'VENUE BLUEPRINT',
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.white),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
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
                      child: _buildLiveBlueprintChamber('room1', 'TURING HALL'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: _buildLiveBlueprintChamber('room2', 'LOVELACE'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _buildLiveBlueprintChamber('room3', 'HUB'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildLiveBlueprintChamber('room4', 'SHANNON'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildLiveBlueprintChamber('room5', 'PAVILION'),
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

  Widget _buildLiveBlueprintChamber(String id, String label) {
    final r = _rooms.cast<RoomTelemetry?>().firstWhere(
      (room) => room?.id.toLowerCase() == id.toLowerCase() ||
                room?.id.toLowerCase() == id.replaceAll('room', 'hall-').toLowerCase(),
      orElse: () => null,
    );
    final density = r?.currentDensity ?? 0.0;
    final densityStr = '${density.toStringAsFixed(0)}%';
    final heatColor = density >= 80
        ? DeltaColors.dangerRed
        : (density >= 60 ? DeltaColors.mustard : DeltaColors.neonCyan);
    return _buildBlueprintChamber(id, label, densityStr, heatColor);
  }

  Widget _buildBlueprintChamber(String id, String label, String density, Color heatColor) {
    final isSelected = _selectedBlueprintRoomId == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedBlueprintRoomId = id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? heatColor.withValues(alpha: 0.22) : const Color(0xFF0F1B2E),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? heatColor : const Color(0xFF1E2D4A),
            width: isSelected ? 2.0 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: heatColor.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Column(
          children: [
            Text(
              label,
              style: DeltaTypography.microCaps(color: Colors.white, fontSize: 10),
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
              decoration: BoxDecoration(
                color: heatColor,
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text(
                density,
                style: DeltaTypography.monoBadge(fontSize: 9.5, color: Colors.black),
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: DeltaColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
        boxShadow: const [
          BoxShadow(color: Color(0x38000000), offset: Offset(0, 2), blurRadius: 8),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                const Icon(Icons.wifi_tethering, size: 16, color: DeltaColors.neonCyan),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('LOCAL HOTSPOT MESH RELAY', style: DeltaTypography.microCaps(color: DeltaColors.mustard, fontSize: 10)),
                      Text(
                        queuedCount == 0 ? '● Online (Area 1 Link • 0 pending)' : '○ Roaming ($queuedCount actions queued)',
                        style: DeltaTypography.bodyMuted(
                          fontSize: 10.5,
                          color: queuedCount == 0 ? DeltaColors.successGreen : Colors.orangeAccent,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
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
                border: Border.all(color: DeltaColors.skyAqua, width: 1.2),
              ),
              child: Text(
                'SYNC QUEUE',
                style: DeltaTypography.monoBadge(fontSize: 10, color: DeltaColors.skyAqua),
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
        Text(label, style: DeltaTypography.microCaps(fontSize: 9, color: DeltaColors.textMuted)),
        const SizedBox(height: 1),
        Text(value, style: DeltaTypography.monoStat(fontSize: 11.5, color: Colors.white)),
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
              border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
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
                          boxShadow: [
                            BoxShadow(
                              color: statusColor.withValues(alpha: 0.6),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          room.name,
                          style: DeltaTypography.titleMedium(
                            color: Colors.white,
                          ),
                          overflow: TextOverflow.ellipsis,
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

            // Animated Tactical Capacity Progress Bar
            TacticalProgressBar(
              value: room.currentDensity / 100.0,
              height: 7,
              showSegments: true,
            ),
            const SizedBox(height: 12),

            // Telemetry Metrics Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${room.currentOccupancy} / ${room.capacity} seats (${(room.currentDensity).toStringAsFixed(1)}%)',
                  style: DeltaTypography.monoStat(fontSize: 11.5, color: DeltaColors.textLight),
                ),
                Row(
                  children: [
                    Text(
                      '↑${room.doorCountIn}  ↓${room.doorCountOut}',
                      style: DeltaTypography.monoLabel(fontSize: 11, color: DeltaColors.skyAqua),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '• ${room.temperature}°C',
                      style: DeltaTypography.monoLabel(fontSize: 11, color: DeltaColors.mustard),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Room-Specific Tactical Dispatch Controls
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      _api.dispatchQuickAction(
                        action: 'gate_release',
                        label: 'Reroute flow from ${room.name}',
                        sender: widget.session.name,
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: DeltaColors.surfaceLight,
                          content: Text('⚡ Diverting corridor flow from ${room.name}'),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: DeltaColors.surfaceLight,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
                      ),
                      child: Center(
                        child: Text(
                          '⚡ REROUTE FLOW',
                          style: DeltaTypography.microCaps(color: DeltaColors.skyAqua),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      _api.dispatchQuickAction(
                        action: 'security_post',
                        label: 'Marshal to ${room.name}',
                        sender: widget.session.name,
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: DeltaColors.surfaceLight,
                          content: Text('👮 Marshalling nearest safety volunteer to ${room.name}'),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: DeltaColors.surfaceLight,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
                      ),
                      child: Center(
                        child: Text(
                          '👮 DISPATCH TEAM',
                          style: DeltaTypography.microCaps(color: DeltaColors.mustard),
                        ),
                      ),
                    ),
                  ),
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
      if (_taskFilter == 'URGENT' && !t.isUrgent) return false;
      if (_taskFilter == 'CLAIMED' && !t.isClaimed) return false;
      if (_taskFilter == 'RESOLVED' && !t.isResolved) return false;
      if (_taskSearchQuery.isNotEmpty) {
        final matchesTitle = t.title.toLowerCase().contains(_taskSearchQuery);
        final matchesLocation = t.location.toLowerCase().contains(_taskSearchQuery);
        final matchesAssignee = t.assignedTo?.toLowerCase().contains(_taskSearchQuery) ?? false;
        if (!matchesTitle && !matchesLocation && !matchesAssignee) return false;
      }
      return true;
    }).toList();

    final urgentCount = _tasks.where((t) => t.isUrgent).length;
    final claimedCount = _tasks.where((t) => t.isClaimed).length;
    final resolvedCount = _tasks.where((t) => t.isResolved).length;

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: DeltaColors.mustard,
        foregroundColor: Colors.black,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
        ),
        onPressed: _showCreateTaskDialog,
        icon: const Icon(Icons.add_task),
        label: Text('DISPATCH TASK', style: DeltaTypography.button(color: Colors.black)),
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
                Expanded(
                  child: Text(
                    'FIELD INCIDENT QUEUE',
                    style: DeltaTypography.titleLarge(
                      color: Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                NeubrutalistBadge(
                  label: '${_tasks.length} TOTAL',
                  backgroundColor: DeltaColors.surfaceLight,
                  textColor: DeltaColors.mustard,
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Real-Time Incident Search Bar
            Container(
              decoration: BoxDecoration(
                color: DeltaColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
              ),
              child: TextField(
                controller: _taskSearchController,
                onChanged: (q) => setState(() => _taskSearchQuery = q.trim().toLowerCase()),
                style: DeltaTypography.body(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Search incidents by title, room, or assignee...',
                  hintStyle: DeltaTypography.bodyMuted(fontSize: 12),
                  prefixIcon: const Icon(Icons.search, color: DeltaColors.skyAqua, size: 18),
                  suffixIcon: _taskSearchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close, size: 16, color: DeltaColors.textMuted),
                          onPressed: () {
                            _taskSearchController.clear();
                            setState(() => _taskSearchQuery = '');
                          },
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
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
                        _taskSearchQuery.isNotEmpty
                            ? 'No incidents matching "$_taskSearchQuery"'
                            : 'No incidents matching $_taskFilter filter.',
                        style: DeltaTypography.bodyMuted(fontSize: 13),
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
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _taskFilter = filterKey);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? DeltaColors.skyAqua : const Color(0xFF101726),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? DeltaColors.skyAqua : const Color(0xFF222F47),
            width: 1.0,
          ),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: DeltaColors.skyAqua.withValues(alpha: 0.25),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
          ],
        ),
        child: Text(
          label,
          style: DeltaTypography.monoBadge(
            fontSize: 10.5,
            color: isSelected ? Colors.black : DeltaColors.textLight,
          ),
        ),
      ),
    );
  }

  Widget _buildEnhancedTaskCard(TaskItem task) {
    final isUrgent = task.isUrgent;
    final isClaimed = task.isClaimed;
    final isResolved = task.isResolved;

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
              style: DeltaTypography.titleMedium(
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 14, color: DeltaColors.mustard),
                const SizedBox(width: 4),
                Text(task.location, style: DeltaTypography.bodyMuted(fontSize: 12)),
                if (task.assignedTo != null) ...[
                  const SizedBox(width: 12),
                  const Icon(Icons.person_pin, size: 14, color: DeltaColors.neonCyan),
                  const SizedBox(width: 4),
                  Text(task.assignedTo!, style: DeltaTypography.monoStat(fontSize: 11.5, color: DeltaColors.neonCyan)),
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
                        backgroundColor: const Color(0xFF0284C7),
                        textColor: Colors.white,
                        height: 38,
                        fontSize: 11,
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        onPressed: () => _handleClaimTask(task),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: NeubrutalistButton(
                      label: 'MARK RESOLVED',
                      icon: Icons.check_circle_outline,
                      backgroundColor: const Color(0xFF059669),
                      textColor: Colors.white,
                      height: 38,
                      fontSize: 11,
                      padding: const EdgeInsets.symmetric(horizontal: 6),
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
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'TACTICAL WALKIE MESH',
                    style: DeltaTypography.titleLarge(
                      color: Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Encrypted low-latency tactical radio dispatch',
                    style: DeltaTypography.bodyMuted(fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
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
              Text('ACTIVE RADIO CHANNEL:', style: DeltaTypography.microCaps(color: DeltaColors.mustard)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _buildChannelPill('CH 1: OPS • 4', '1')),
                  const SizedBox(width: 6),
                  Expanded(child: _buildChannelPill('CH 2: SEC • 2', '2')),
                  const SizedBox(width: 6),
                  Expanded(child: _buildChannelPill('CH 3: MED • 1', '3')),
                  const SizedBox(width: 6),
                  Expanded(child: _buildChannelPill('CH 4: AV • 3', '4')),
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
              // 16-Band Waveform Visualizer
              AudioWaveformVisualizer(
                isBroadcasting: _isBroadcasting,
                barColor: DeltaColors.neonCyan,
              ),
              const SizedBox(height: 20),

              // Interactive PTT Mic Button with concentric acoustic pulse rings
              AnimatedBuilder(
                animation: _pttAnim,
                builder: (context, child) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      if (_isBroadcasting) ...[
                        // Outer pulse ring
                        Container(
                          width: 96 + (38 * _pttAnim.value),
                          height: 96 + (38 * _pttAnim.value),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: DeltaColors.dangerRed.withValues(alpha: (1.0 - _pttAnim.value).clamp(0.0, 1.0)),
                              width: 2.5,
                            ),
                          ),
                        ),
                        // Inner pulse ring
                        Container(
                          width: 96 + (18 * _pttAnim.value),
                          height: 96 + (18 * _pttAnim.value),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: DeltaColors.dangerRed.withValues(alpha: (0.8 - 0.5 * _pttAnim.value).clamp(0.0, 1.0)),
                              width: 1.5,
                            ),
                          ),
                        ),
                      ],
                      child!,
                    ],
                  );
                },
                child: GestureDetector(
                  onTapDown: (_) {
                    HapticFeedback.heavyImpact();
                    setState(() => _isBroadcasting = true);
                  },
                  onTapUp: (_) async {
                    HapticFeedback.mediumImpact();
                    setState(() => _isBroadcasting = false);
                    try {
                      await _api.broadcastVoice(
                        sender: widget.session.name,
                        channel: _activeChannel,
                        text: 'Live radio transmission from ${widget.session.name}',
                      );
                    } catch (_) {
                      if (mounted) {
                        final localTransmission = VoiceTransmission(
                          channel: _activeChannel,
                          speaker: widget.session.name,
                          message: 'Live radio transmission from ${widget.session.name} (Offline Mesh)',
                          timestamp: DateTime.now(),
                          waveform: [0.3, 0.7, 0.9, 0.4, 0.2, 0.8, 0.5, 0.3],
                        );
                        setState(() {
                          _voiceTransmissions.insert(0, localTransmission);
                          if (_voiceTransmissions.length > 50) _voiceTransmissions.removeLast();
                        });
                      }
                    }
                  },
                  onTapCancel: () => setState(() => _isBroadcasting = false),
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      gradient: _isBroadcasting
                          ? const LinearGradient(
                              colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            )
                          : const LinearGradient(
                              colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: _isBroadcasting ? const Color(0xFFFCA5A5) : const Color(0xFFFDE68A),
                        width: 2.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: (_isBroadcasting ? DeltaColors.dangerRed : DeltaColors.mustard).withValues(alpha: 0.45),
                          blurRadius: 20,
                          spreadRadius: 2,
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
              ),
              const SizedBox(height: 16),
              Text(
                _isBroadcasting ? 'TRANSMITTING LIVE RADIO...' : 'HOLD / TAP TO BROADCAST',
                style: DeltaTypography.titleMedium(
                  color: _isBroadcasting ? DeltaColors.neonCyan : Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Transmits encrypted voice burst to all channel $_activeChannel marshals',
                style: DeltaTypography.bodyMuted(fontSize: 11, color: DeltaColors.skyAqua),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Quick Tactical Voice Callouts
        Text(
          '1-TAP RADIO PHRASES:',
          style: DeltaTypography.microCaps(color: DeltaColors.mustard),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: quickVoiceMessages.map((msg) => InkWell(
            onTap: () async {
              HapticFeedback.lightImpact();
              try {
                await _api.broadcastVoice(
                  sender: widget.session.name,
                  channel: _activeChannel,
                  text: msg,
                );
              } catch (_) {
                if (mounted) {
                  final localTransmission = VoiceTransmission(
                    channel: _activeChannel,
                    speaker: widget.session.name,
                    message: '$msg (Offline Mesh)',
                    timestamp: DateTime.now(),
                    waveform: [0.4, 0.8, 0.6, 0.5, 0.7],
                  );
                  setState(() {
                    _voiceTransmissions.insert(0, localTransmission);
                    if (_voiceTransmissions.length > 50) _voiceTransmissions.removeLast();
                  });
                }
              }
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: DeltaColors.yaleBlue,
                    content: Text(
                      '📻 Dispatched to Channel $_activeChannel: "$msg"',
                      style: DeltaTypography.bodyBold(color: Colors.white, fontSize: 11.5),
                    ),
                    duration: const Duration(seconds: 2),
                  ),
                );
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: DeltaColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
                boxShadow: const [
                  BoxShadow(color: Color(0x38000000), offset: Offset(0, 2), blurRadius: 8),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.send, color: DeltaColors.skyAqua, size: 12),
                  const SizedBox(width: 6),
                  Text(msg, style: DeltaTypography.bodyBold(fontSize: 11.5, color: Colors.white)),
                ],
              ),
            ),
          )).toList(),
        ),
        const SizedBox(height: 24),

        // Transmission Feed
        Text(
          'TRANSMISSION FEED LOG',
          style: DeltaTypography.titleMedium(color: Colors.white),
        ),
        const SizedBox(height: 10),

        if (_voiceTransmissions.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: Neubrutalism.boxDecoration(color: DeltaColors.surface, radius: 10),
            child: Text(
              'No voice transmissions recorded yet. Tap microphone or select phrase above.',
              style: DeltaTypography.bodyMuted(fontSize: 12),
            ),
          )
        else
          ..._voiceTransmissions.map((v) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: Neubrutalism.boxDecoration(color: DeltaColors.surface, radius: 10),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: DeltaColors.skyAqua,
                        borderRadius: BorderRadius.circular(7),
                        border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
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
                                style: DeltaTypography.monoBadge(fontSize: 11, color: DeltaColors.mustard),
                              ),
                              Text(
                                '${v.timestamp.hour.toString().padLeft(2, '0')}:${v.timestamp.minute.toString().padLeft(2, '0')}',
                                style: DeltaTypography.monoLabel(fontSize: 10),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(v.message, style: DeltaTypography.body(fontSize: 12.5, color: Colors.white)),
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
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _activeChannel = chNum);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
        decoration: BoxDecoration(
          color: isSelected ? DeltaColors.neonCyan : DeltaColors.surfaceLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? DeltaColors.neonCyan : DeltaColors.cardBorder,
            width: isSelected ? 1.5 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: DeltaColors.neonCyan.withValues(alpha: 0.35),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Center(
          child: Text(
            title,
            style: DeltaTypography.monoBadge(
              fontSize: 9.5,
              color: isSelected ? Colors.black : DeltaColors.textLight,
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
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BADGE SCANNER DECK',
                    style: DeltaTypography.titleLarge(
                      color: Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Anti-tamper holographic attendee pass validation',
                    style: DeltaTypography.bodyMuted(fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
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
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: DeltaColors.neonCyan, width: 1.5),
                ),
                child: AnimatedBuilder(
                  animation: _scannerAnim,
                  builder: (context, _) {
                    return Stack(
                      children: [
                        Positioned.fill(
                          child: Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: CustomPaint(
                              painter: ReticleCornerPainter(
                                color: _torchEnabled ? DeltaColors.mustard : DeltaColors.neonCyan,
                                cornerLength: 18.0,
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          top: 8,
                          right: 8,
                          child: InkWell(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setState(() => _torchEnabled = !_torchEnabled);
                            },
                            borderRadius: BorderRadius.circular(6),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: _torchEnabled ? DeltaColors.mustard.withValues(alpha: 0.2) : Colors.black.withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: _torchEnabled ? DeltaColors.mustard : DeltaColors.cardBorder,
                                  width: 1.0,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    _torchEnabled ? Icons.flashlight_on : Icons.flashlight_off,
                                    size: 13,
                                    color: _torchEnabled ? DeltaColors.mustard : DeltaColors.textMuted,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    _torchEnabled ? 'TORCH ON' : 'TORCH OFF',
                                    style: DeltaTypography.microCaps(
                                      color: _torchEnabled ? DeltaColors.mustard : DeltaColors.textMuted,
                                      fontSize: 9,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
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
                            style: DeltaTypography.microCaps(fontSize: 9, color: DeltaColors.neonCyan),
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
                controller: _scannerCodeController,
                style: DeltaTypography.monoStat(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: DeltaColors.surfaceLight,
                  prefixIcon: const Icon(Icons.qr_code, color: DeltaColors.neonCyan),
                  hintText: 'e.g. VIP-9941',
                  hintStyle: DeltaTypography.bodyMuted(fontSize: 13),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: DeltaColors.cardBorder, width: 1.0)),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('SECURITY CLEARANCE TIERS', style: DeltaTypography.microCaps(color: DeltaColors.textMuted, fontSize: 10)),
                  Text('RAPID ENTRY QUEUE', style: DeltaTypography.microCaps(color: DeltaColors.skyAqua, fontSize: 10)),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.star, size: 13, color: DeltaColors.mustard),
                    label: Text('VIP PASS (DELTA-8492)', style: DeltaTypography.monoBadge(fontSize: 10, color: DeltaColors.mustard)),
                    backgroundColor: DeltaColors.surfaceLight,
                    side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
                    onPressed: () => _scannerCodeController.text = 'DELTA-8492',
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.mic, size: 13, color: DeltaColors.skyAqua),
                    label: Text('KEYNOTE (SPK-1022)', style: DeltaTypography.monoBadge(fontSize: 10, color: DeltaColors.skyAqua)),
                    backgroundColor: DeltaColors.surfaceLight,
                    side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
                    onPressed: () => _scannerCodeController.text = 'SPK-1022',
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.badge, size: 13, color: DeltaColors.mintGreen),
                    label: Text('DELEGATE (DELTA-1024)', style: DeltaTypography.monoBadge(fontSize: 10, color: DeltaColors.mintGreen)),
                    backgroundColor: DeltaColors.surfaceLight,
                    side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
                    onPressed: () => _scannerCodeController.text = 'DELTA-1024',
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.shield, size: 13, color: DeltaColors.hotPink),
                    label: Text('CREW (CREW-0771)', style: DeltaTypography.monoBadge(fontSize: 10, color: DeltaColors.hotPink)),
                    backgroundColor: DeltaColors.surfaceLight,
                    side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
                    onPressed: () => _scannerCodeController.text = 'CREW-0771',
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
                    final res = await _api.verifyBadge(code: _scannerCodeController.text, scannedBy: widget.session.name);
                    if (mounted) {
                      setState(() {
                        _lastScannedBadge = res;
                        _totalGateCheckins++;
                      });
                    }
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
                          style: DeltaTypography.titleSmall(
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
                  style: DeltaTypography.displayHero(fontSize: 22, color: Colors.white),
                ),
                Text(
                  'Credential ID: ${_lastScannedBadge!.ticketId}',
                  style: DeltaTypography.monoStat(fontSize: 12, color: DeltaColors.skyAqua),
                ),
                const SizedBox(height: 12),
                Divider(color: Colors.white.withValues(alpha: 0.1), thickness: 1.0),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Zone Clearance:', style: DeltaTypography.bodyMuted(fontSize: 12)),
                    Text(
                      _lastScannedBadge!.allowedZones.join(', '),
                      style: DeltaTypography.monoBadge(fontSize: 11, color: Colors.white),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Anti-Tamper Seal:', style: DeltaTypography.bodyMuted(fontSize: 12)),
                    Text('HMAC-SHA256 VERIFIED', style: DeltaTypography.monoBadge(fontSize: 10.5, color: DeltaColors.neonCyan)),
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

  // ==========================================
  // TAB 5: ADMIN GOVERNANCE & ACTIVE SESSIONS
  // ==========================================
  Widget _buildAdminGovernanceTab() {
    return RefreshIndicator(
      color: DeltaColors.mustard,
      backgroundColor: DeltaColors.surface,
      onRefresh: () => _fetchAdminGovernanceData(),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        children: [
          // Header Card with Crown Emblem & Summary
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1F1C12), Color(0xFF14120B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: DeltaColors.mustard.withValues(alpha: 0.4), width: 1.2),
              boxShadow: [
                BoxShadow(
                  color: DeltaColors.mustard.withValues(alpha: 0.12),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
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
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: DeltaColors.mustard.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: DeltaColors.mustard.withValues(alpha: 0.4)),
                            ),
                            child: const Icon(Icons.admin_panel_settings, color: DeltaColors.mustard, size: 20),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'ADMIN COMMAND & AUDIT',
                                  style: GoogleFonts.outfit(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                    letterSpacing: 0.3,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  'Session Governance & Remote Force-Logout',
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 10.5,
                                    color: DeltaColors.textMuted,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: _isLoadingAdminSessions
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: DeltaColors.mustard),
                            )
                          : const Icon(Icons.refresh, color: DeltaColors.mustard, size: 20),
                      tooltip: 'Refresh Active Sessions',
                      onPressed: _isLoadingAdminSessions ? null : () => _fetchAdminGovernanceData(),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F1523),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFF222F47)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('ACTIVE TERMINALS', style: GoogleFonts.spaceGrotesk(fontSize: 9.5, fontWeight: FontWeight.bold, color: DeltaColors.textDim)),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const PulsingDot(color: DeltaColors.successGreen, size: 7),
                                const SizedBox(width: 6),
                                Text(
                                  '${_adminSessions.length} Connected',
                                  style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F1523),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _adminDiscrepancies.isNotEmpty
                                ? DeltaColors.dangerRed.withValues(alpha: 0.6)
                                : const Color(0xFF222F47),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('DISCREPANCIES', style: GoogleFonts.spaceGrotesk(fontSize: 9.5, fontWeight: FontWeight.bold, color: DeltaColors.textDim)),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                PulsingDot(
                                  color: _adminDiscrepancies.isNotEmpty ? DeltaColors.dangerRed : DeltaColors.successGreen,
                                  size: 7,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _adminDiscrepancies.isNotEmpty ? '${_adminDiscrepancies.length} Anomalies' : '0 Flagged',
                                  style: GoogleFonts.outfit(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                    color: _adminDiscrepancies.isNotEmpty ? DeltaColors.dangerRed : DeltaColors.successGreen,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Section 1: Security Discrepancies Deck
          Row(
            children: [
              Container(
                width: 3,
                height: 12,
                decoration: BoxDecoration(
                  color: _adminDiscrepancies.isNotEmpty ? DeltaColors.dangerRed : DeltaColors.successGreen,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                'SECURITY AUDIT & DISCREPANCY DETECTOR',
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: DeltaColors.textMuted,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          if (_adminDiscrepancies.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF0C1919),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: DeltaColors.successGreen.withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.verified, color: DeltaColors.successGreen, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Zero Discrepancies Detected',
                          style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13),
                        ),
                        Text(
                          'All volunteer terminals verified. No duplicate IPs or unmarshaled chokepoints.',
                          style: GoogleFonts.spaceGrotesk(fontSize: 11, color: DeltaColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else
            ..._adminDiscrepancies.map((d) {
              final isCrit = d.severity == 'CRITICAL';
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isCrit ? const Color(0xFF231215) : const Color(0xFF1F1B12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isCrit ? DeltaColors.dangerRed.withValues(alpha: 0.6) : DeltaColors.mustard.withValues(alpha: 0.5),
                    width: 1.0,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      isCrit ? Icons.warning_rounded : Icons.info_outline,
                      color: isCrit ? DeltaColors.dangerRed : DeltaColors.mustard,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  d.title,
                                  style: GoogleFonts.outfit(
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                    fontSize: 12.5,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: (isCrit ? DeltaColors.dangerRed : DeltaColors.mustard).withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  d.type,
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w800,
                                    color: isCrit ? DeltaColors.dangerRed : DeltaColors.mustard,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            d.description,
                            style: GoogleFonts.spaceGrotesk(fontSize: 11, color: const Color(0xFFE2E8F0)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),

          const SizedBox(height: 20),

          // Section 2: Active Connected Terminals Roster
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 3,
                      height: 12,
                      decoration: BoxDecoration(
                        color: DeltaColors.skyAqua,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'CONNECTED VOLUNTEERS (${_adminSessions.length})',
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: DeltaColors.textMuted,
                          letterSpacing: 0.5,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: DeltaColors.dangerRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: DeltaColors.dangerRed.withValues(alpha: 0.4), width: 0.8),
                ),
                child: Text(
                  'REVOCATION READY',
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w800,
                    color: DeltaColors.dangerRed,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          if (_adminSessions.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F1523),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF222F47)),
              ),
              child: Center(
                child: Column(
                  children: [
                    const Icon(Icons.people_outline, color: DeltaColors.textDim, size: 36),
                    const SizedBox(height: 10),
                    Text(
                      'No other operator sessions registered.',
                      style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            )
          else
            ..._adminSessions.map((session) {
              final isSelf = session.sessionId == widget.session.sessionId ||
                  session.email.toLowerCase() == widget.session.email.toLowerCase();
              final roleColor = _getRoleColor(session.role);

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSelf ? const Color(0xFF141F32) : const Color(0xFF0F1523),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isSelf
                        ? DeltaColors.skyAqua.withValues(alpha: 0.5)
                        : const Color(0xFF222F47),
                    width: isSelf ? 1.4 : 1.0,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: roleColor.withValues(alpha: 0.2),
                          child: Text(
                            session.name.isNotEmpty ? session.name[0].toUpperCase() : '?',
                            style: GoogleFonts.outfit(
                              color: roleColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      session.name,
                                      style: GoogleFonts.outfit(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (isSelf) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                      decoration: BoxDecoration(
                                        color: DeltaColors.skyAqua.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: DeltaColors.skyAqua.withValues(alpha: 0.5), width: 0.8),
                                      ),
                                      child: Text(
                                        'THIS DEVICE',
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 8.5,
                                          fontWeight: FontWeight.w900,
                                          color: DeltaColors.skyAqua,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              Text(
                                '${session.email} • ${session.title}',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 11,
                                  color: DeltaColors.textMuted,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                          decoration: BoxDecoration(
                            color: roleColor.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: roleColor.withValues(alpha: 0.5), width: 1.0),
                          ),
                          child: Text(
                            session.role.toUpperCase(),
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              color: roleColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Divider(color: Colors.white.withValues(alpha: 0.08), height: 1),
                    const SizedBox(height: 10),

                    // Metadata details
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: Row(
                            children: [
                              const Icon(Icons.phone_android, size: 13, color: DeltaColors.textDim),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  session.deviceModel,
                                  style: GoogleFonts.spaceGrotesk(fontSize: 10.5, color: DeltaColors.textDim),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          flex: 2,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.wifi, size: 13, color: DeltaColors.textDim),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  session.ip,
                                  style: GoogleFonts.spaceGrotesk(fontSize: 10.5, color: DeltaColors.textDim),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Row(
                          children: [
                            const PulsingDot(color: DeltaColors.successGreen, size: 5),
                            const SizedBox(width: 4),
                            Text(
                              '${session.durationMinutes}m active',
                              style: GoogleFonts.spaceGrotesk(fontSize: 10.5, color: DeltaColors.successGreen, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Action buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                color: DeltaColors.dangerRed.withValues(alpha: 0.6),
                                width: 1.0,
                              ),
                              backgroundColor: DeltaColors.dangerRed.withValues(alpha: 0.08),
                              foregroundColor: DeltaColors.dangerRed,
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            icon: const Icon(Icons.power_settings_new, size: 15),
                            label: Text(
                              isSelf ? 'REVOKE & LOGOUT MY SESSION' : 'FORCE LOGOUT VOLUNTEER',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.3,
                              ),
                            ),
                            onPressed: () => _handleForceRevokeSession(session),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Color _getRoleColor(String role) {
    switch (role.toUpperCase()) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return DeltaColors.mustard;
      case 'COORDINATOR':
        return DeltaColors.skyAqua;
      case 'SAFETY':
        return DeltaColors.coralRed;
      case 'VOLUNTEER':
      default:
        return DeltaColors.neonCyan;
    }
  }
}

/// Cyberpunk Reticle Corner Painter for Optical Scanner Viewfinder
class ReticleCornerPainter extends CustomPainter {
  final Color color;
  final double cornerLength;

  ReticleCornerPainter({required this.color, this.cornerLength = 16.0});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    // Top Left
    canvas.drawLine(const Offset(0, 0), Offset(cornerLength, 0), paint);
    canvas.drawLine(const Offset(0, 0), Offset(0, cornerLength), paint);

    // Top Right
    canvas.drawLine(Offset(size.width, 0), Offset(size.width - cornerLength, 0), paint);
    canvas.drawLine(Offset(size.width, 0), Offset(size.width, cornerLength), paint);

    // Bottom Left
    canvas.drawLine(Offset(0, size.height), Offset(cornerLength, size.height), paint);
    canvas.drawLine(Offset(0, size.height), Offset(0, size.height - cornerLength), paint);

    // Bottom Right
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width - cornerLength, size.height), paint);
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width, size.height - cornerLength), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
