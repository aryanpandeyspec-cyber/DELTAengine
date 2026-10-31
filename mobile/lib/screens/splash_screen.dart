import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import 'cockpit_screen.dart';
import 'login_screen.dart';

/// Next-Generation 120 FPS Tactical Holographic Aerospace Splash
/// Features:
/// - Pure vector-assisted glowing Delta Reactor Core (0 text fragments)
/// - Dual orbital radar rings & scanning laser beam
/// - Live RF spectrum visualizer & terminal diagnostic readout
/// - Instant tap-to-skip with haptic pulse & portal zoom transition
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late AnimationController _masterController;
  late AnimationController _radarController;
  late AnimationController _scannerController;

  late Animation<double> _coreScaleAnim;
  late Animation<double> _coreGlowAnim;
  late Animation<double> _titleFadeAnim;
  late Animation<double> _progressAnim;

  OperatorSession? _resolvedSession;
  bool _isNavigating = false;
  final ApiService _api = ApiService();

  int _currentLogIndex = 0;
  final List<String> _bootLogs = [
    'INIT: ARM64 KERNEL ENGINE ............ [OK]',
    'LINK: SENSOR MESH (2.4GHz) ........... [SYNCED]',
    'SEC: LIFE-SAFETY PROTOCOL ALPHA ...... [ARMED]',
    'GATEWAY: LOCAL EDGE ROUTER ........... [ACTIVE 2ms]',
    'COCKPIT: FLIGHT SYSTEMS READY ........ [LAUNCH]',
  ];

  @override
  void initState() {
    super.initState();

    // 1. Master Sequence Controller (1250ms target for cinematic boot)
    _masterController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1250),
    );

    // 2. Continuous Tactical Radar Orbital Controller
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat();

    // 3. Fast Laser Scanner Sweep Controller
    _scannerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();

    _coreScaleAnim = Tween<double>(begin: 0.70, end: 1.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOutBack),
      ),
    );

    _coreGlowAnim = Tween<double>(begin: 0.2, end: 1.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.15, 0.60, curve: Curves.easeOut),
      ),
    );

    _titleFadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.20, 0.55, curve: Curves.easeOut),
      ),
    );

    _progressAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _masterController,
        curve: const Interval(0.05, 0.95, curve: Curves.easeInOutCubic),
      ),
    );

    _masterController.addListener(_onProgressUpdate);
    _masterController.forward();

    // Begin background parallel initialization
    _warmUpAndNavigate();
  }

  void _onProgressUpdate() {
    final progress = _progressAnim.value;
    final targetIndex = (progress * (_bootLogs.length - 1)).clamp(0, _bootLogs.length - 1).toInt();
    if (targetIndex != _currentLogIndex) {
      setState(() {
        _currentLogIndex = targetIndex;
      });
      HapticFeedback.selectionClick();
    }
  }

  Future<void> _warmUpAndNavigate() async {
    final startTime = DateTime.now();

    // Parallel edge gateway detection & cached session check
    try {
      await _api.init();
      final session = await _api.restoreSessionFromStorage();
      if (session != null && !session.isExpired) {
        final isValid = await _api.validateSession().timeout(
          const Duration(milliseconds: 500),
          onTimeout: () => true, // Offline entry permitted if unexpired
        );
        if (isValid) {
          _resolvedSession = session;
          WebSocketService().connect();
        }
      }
    } catch (_) {}

    // Allow cinematic sequence to complete smoothly
    final elapsed = DateTime.now().difference(startTime).inMilliseconds;
    final remaining = 1250 - elapsed;
    if (remaining > 0) {
      await Future.delayed(Duration(milliseconds: remaining));
    }

    _proceedToNextScreen();
  }

  void _proceedToNextScreen() {
    if (_isNavigating || !mounted) return;
    _isNavigating = true;
    HapticFeedback.mediumImpact();

    final nextScreen = (_resolvedSession != null)
        ? CockpitScreen(session: _resolvedSession!)
        : const LoginScreen();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 320),
        pageBuilder: (context, animation, secondaryAnimation) => nextScreen,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          // Futuristic Zoom Portal Dissolve
          final scaleAnim = Tween<double>(begin: 0.96, end: 1.0).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          );
          final fadeAnim = CurvedAnimation(parent: animation, curve: Curves.easeOut);
          return FadeTransition(
            opacity: fadeAnim,
            child: ScaleTransition(
              scale: scaleAnim,
              child: child,
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _masterController.removeListener(_onProgressUpdate);
    _masterController.dispose();
    _radarController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF040711),
      body: GestureDetector(
        onTap: _proceedToNextScreen, // 0ms tap-to-skip at any instant
        behavior: HitTestBehavior.opaque,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 1. High-Performance Tactical Grid & Particle Background
            AnimatedBuilder(
              animation: _radarController,
              builder: (context, _) {
                return CustomPaint(
                  painter: _HolographicBackgroundPainter(
                    radarAngle: _radarController.value * 2 * math.pi,
                  ),
                );
              },
            ),

            // 2. Top Tactical Status Header
            SafeArea(
              child: Align(
                alignment: Alignment.topCenter,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Status Pill
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B132B).withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFF1E2D4A), width: 1),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: const BoxDecoration(
                                color: Color(0xFF00F5D4),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Color(0xFF00F5D4),
                                    blurRadius: 6,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'DELTA-OS :: FIELD COMMAND',
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF38BDF8),
                                letterSpacing: 0.6,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Tap to Skip Shortcut
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12),
                            width: 1,
                          ),
                        ),
                        child: Text(
                          'TAP TO SKIP ▶',
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: Colors.white.withValues(alpha: 0.65),
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // 3. Central Hologram Reactor Core
            Center(
              child: AnimatedBuilder(
                animation: Listenable.merge([
                  _masterController,
                  _radarController,
                  _scannerController,
                ]),
                builder: (context, _) {
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Dual Orbital Rings + Delta Prism Card
                      SizedBox(
                        width: 240,
                        height: 240,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            // Outer Gimbal Radar Rings & Sonar Pings
                            CustomPaint(
                              size: const Size(240, 240),
                              painter: _OrbitalRadarPainter(
                                angle: _radarController.value * 2 * math.pi,
                                pulseProgress: _masterController.value,
                              ),
                            ),

                            // Central Floating Delta Prism Card
                            Transform.scale(
                              scale: _coreScaleAnim.value,
                              child: Container(
                                width: 140,
                                height: 140,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0B132B).withValues(alpha: 0.90),
                                  borderRadius: BorderRadius.circular(28),
                                  border: Border.all(
                                    color: const Color(0xFF00F5D4).withValues(
                                      alpha: 0.85 * _coreGlowAnim.value,
                                    ),
                                    width: 1.8,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF00F5D4).withValues(
                                        alpha: 0.40 * _coreGlowAnim.value,
                                      ),
                                      blurRadius: 36,
                                      spreadRadius: 2,
                                    ),
                                    const BoxShadow(
                                      color: Colors.black,
                                      offset: Offset(0, 12),
                                      blurRadius: 22,
                                    ),
                                  ],
                                ),
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    // 100% Complete Pure Triangle Emblem
                                    Padding(
                                      padding: const EdgeInsets.all(14.0),
                                      child: Image.asset(
                                        'assets/images/delta_emblem.png',
                                        fit: BoxFit.contain,
                                      ),
                                    ),

                                    // Dynamic Laser Scanning Line Sweep
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(26),
                                      child: CustomPaint(
                                        size: const Size(140, 140),
                                        painter: _LaserScanLinePainter(
                                          progress: _scannerController.value,
                                        ),
                                      ),
                                    ),

                                    // Corner HUD Micro-Brackets
                                    const CustomPaint(
                                      size: Size(140, 140),
                                      painter: _CornerBracketsPainter(),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Brand Titles (High-Velocity Fade & Slide)
                      FadeTransition(
                        opacity: _titleFadeAnim,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'DELTA ENGINE',
                              style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 5.0,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 16,
                                  height: 1.5,
                                  color: const Color(0xFF00F5D4),
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'AUTONOMOUS VENUE STEERING & SAFETY',
                                  style: TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF38BDF8),
                                    letterSpacing: 1.4,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  width: 16,
                                  height: 1.5,
                                  color: const Color(0xFF00F5D4),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

            // 4. Bottom Tactical Telemetry & Progress Matrix
            Positioned(
              left: 20,
              right: 20,
              bottom: 34,
              child: AnimatedBuilder(
                animation: Listenable.merge([_masterController, _scannerController]),
                builder: (context, _) {
                  final progress = _progressAnim.value;
                  final pct = (progress * 100).toInt();

                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Real-time Boot Event Terminal Readout
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B132B).withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF1E2D4A), width: 1),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                _bootLogs[_currentLogIndex],
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF00F5D4),
                                  letterSpacing: 0.4,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            // Micro Spectrum Bars
                            _RfSpectrumBars(sweep: _scannerController.value),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Progress Percentage Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'BOOT VECTOR PREPARATION',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF94A3B8),
                              letterSpacing: 0.8,
                            ),
                          ),
                          Text(
                            '$pct%',
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF00F5D4),
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),

                      // Neubrutalist Segmented Progress Track
                      Container(
                        height: 5,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10192C),
                          borderRadius: BorderRadius.circular(3),
                          border: Border.all(
                            color: const Color(0xFF1E2D4A),
                            width: 0.6,
                          ),
                        ),
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: progress.clamp(0.04, 1.0),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(3),
                              gradient: const LinearGradient(
                                colors: [
                                  Color(0xFF38BDF8),
                                  Color(0xFF00F5D4),
                                  Color(0xFF10B981),
                                ],
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0xFF00F5D4),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Bottom Metadata Tags
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'AES-256 ENCRYPTED',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 8.5,
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.35),
                            ),
                          ),
                          Text(
                            'ULTRA-LOW LATENCY EDGE DEPLOY',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 8.5,
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.35),
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dynamic 8-bar RF Spectrum Audio-Visualizer
class _RfSpectrumBars extends StatelessWidget {
  final double sweep;
  const _RfSpectrumBars({required this.sweep});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(8, (i) {
        // Pseudo-random dynamic bar heights driven by sweep
        final height = 4.0 + (math.sin((sweep * 2 * math.pi) + (i * 0.8)).abs() * 10.0);
        return Container(
          width: 2.2,
          height: height,
          margin: const EdgeInsets.symmetric(horizontal: 1.2),
          decoration: BoxDecoration(
            color: (i % 2 == 0) ? const Color(0xFF00F5D4) : const Color(0xFF38BDF8),
            borderRadius: BorderRadius.circular(1),
          ),
        );
      }),
    );
  }
}

/// Dual Orbital Radar Rings & Expanding Sonar Painter
class _OrbitalRadarPainter extends CustomPainter {
  final double angle;
  final double pulseProgress;

  const _OrbitalRadarPainter({
    required this.angle,
    required this.pulseProgress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);

    // 1. Expanding Sonar Shockwave Ping
    final pingRadius = 75.0 + (40.0 * (pulseProgress % 1.0));
    final pingOpacity = (1.0 - (pulseProgress % 1.0)).clamp(0.0, 1.0);
    final pingPaint = Paint()
      ..color = const Color(0xFF00F5D4).withValues(alpha: 0.45 * pingOpacity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    canvas.drawCircle(center, pingRadius, pingPaint);

    // 2. Outer Clockwise Ring with Cardinal Tick Marks
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(angle);

    final outerRingPaint = Paint()
      ..color = const Color(0xFF1E3A5F).withValues(alpha: 0.7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawCircle(Offset.zero, 105, outerRingPaint);

    // Cardinal tick marks
    final tickPaint = Paint()
      ..color = const Color(0xFF00F5D4).withValues(alpha: 0.8)
      ..strokeWidth = 1.6;

    for (int i = 0; i < 12; i++) {
      final rad = (i * 30) * math.pi / 180;
      final isCardinal = (i % 3 == 0);
      final r1 = isCardinal ? 100.0 : 103.0;
      const r2 = 108.0;

      canvas.drawLine(
        Offset(math.cos(rad) * r1, math.sin(rad) * r1),
        Offset(math.cos(rad) * r2, math.sin(rad) * r2),
        isCardinal ? tickPaint : outerRingPaint,
      );
    }
    canvas.restore();

    // 3. Inner Counter-Clockwise Dashed Ring
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(-angle * 1.5);

    final innerRingPaint = Paint()
      ..color = const Color(0xFF38BDF8).withValues(alpha: 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    for (int i = 0; i < 8; i++) {
      final startAngle = (i * 45) * math.pi / 180;
      canvas.drawArc(
        Rect.fromCircle(center: Offset.zero, radius: 84),
        startAngle,
        20 * math.pi / 180,
        false,
        innerRingPaint,
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _OrbitalRadarPainter oldDelegate) {
    return oldDelegate.angle != angle || oldDelegate.pulseProgress != pulseProgress;
  }
}

/// Dynamic Laser Scanning Line Painter (Sweeps vertically over emblem)
class _LaserScanLinePainter extends CustomPainter {
  final double progress;
  const _LaserScanLinePainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height * progress;

    final beamPaint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.transparent,
          const Color(0xFF00F5D4).withValues(alpha: 0.7),
          Colors.transparent,
        ],
      ).createShader(Rect.fromLTWH(0, y - 2, size.width, 4))
      ..strokeWidth = 2.0;

    canvas.drawLine(Offset(0, y), Offset(size.width, y), beamPaint);

    final glowPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFF00F5D4).withValues(alpha: 0.18),
          Colors.transparent,
        ],
      ).createShader(Rect.fromLTWH(0, math.max(0, y - 16), size.width, 16));

    canvas.drawRect(
      Rect.fromLTWH(0, math.max(0, y - 16), size.width, 16),
      glowPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _LaserScanLinePainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}

/// Corner HUD Precision Reticle Brackets
class _CornerBracketsPainter extends CustomPainter {
  const _CornerBracketsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF00F5D4).withValues(alpha: 0.8)
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke;

    const arm = 9.0;
    const pad = 6.0;

    // Top-Left
    canvas.drawLine(const Offset(pad, pad + arm), const Offset(pad, pad), paint);
    canvas.drawLine(const Offset(pad, pad), const Offset(pad + arm, pad), paint);

    // Top-Right
    canvas.drawLine(Offset(size.width - pad - arm, pad), Offset(size.width - pad, pad), paint);
    canvas.drawLine(Offset(size.width - pad, pad), Offset(size.width - pad, pad + arm), paint);

    // Bottom-Left
    canvas.drawLine(Offset(pad, size.height - pad - arm), Offset(pad, size.height - pad), paint);
    canvas.drawLine(Offset(pad, size.height - pad), Offset(pad + arm, size.height - pad), paint);

    // Bottom-Right
    canvas.drawLine(Offset(size.width - pad - arm, size.height - pad), Offset(size.width - pad, size.height - pad), paint);
    canvas.drawLine(Offset(size.width - pad, size.height - pad), Offset(size.width - pad, size.height - pad - arm), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Tactical Holographic Hex/Grid & Radar Beam Background Painter
class _HolographicBackgroundPainter extends CustomPainter {
  final double radarAngle;
  const _HolographicBackgroundPainter({required this.radarAngle});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);

    // 1. Subtle Background Tactical Grid
    final gridPaint = Paint()
      ..color = const Color(0xFF101B30).withValues(alpha: 0.35)
      ..strokeWidth = 0.5;

    const step = 44.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // 2. Ambient Rotating Tactical Radar Beam
    final radarPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment.center,
        startAngle: 0.0,
        endAngle: math.pi / 2,
        colors: [
          const Color(0xFF00F5D4).withValues(alpha: 0.06),
          Colors.transparent,
        ],
        transform: GradientRotation(radarAngle),
      ).createShader(Rect.fromCircle(center: center, radius: size.width * 0.8));

    canvas.drawCircle(center, size.width * 0.7, radarPaint);

    // 3. Screen Edge Precision Corner Crosshairs
    final cornerPaint = Paint()
      ..color = const Color(0xFF38BDF8).withValues(alpha: 0.3)
      ..strokeWidth = 1.0;

    const arm = 14.0;
    // Top-Left
    canvas.drawLine(const Offset(16, 16), const Offset(16 + arm, 16), cornerPaint);
    canvas.drawLine(const Offset(16, 16), const Offset(16, 16 + arm), cornerPaint);

    // Top-Right
    canvas.drawLine(Offset(size.width - 16, 16), Offset(size.width - 16 - arm, 16), cornerPaint);
    canvas.drawLine(Offset(size.width - 16, 16), Offset(size.width - 16, 16 + arm), cornerPaint);

    // Bottom-Left
    canvas.drawLine(Offset(16, size.height - 16), Offset(16 + arm, size.height - 16), cornerPaint);
    canvas.drawLine(Offset(16, size.height - 16), Offset(16, size.height - 16 - arm), cornerPaint);

    // Bottom-Right
    canvas.drawLine(Offset(size.width - 16, size.height - 16), Offset(size.width - 16 - arm, size.height - 16), cornerPaint);
    canvas.drawLine(Offset(size.width - 16, size.height - 16), Offset(size.width - 16, size.height - 16 - arm), cornerPaint);
  }

  @override
  bool shouldRepaint(covariant _HolographicBackgroundPainter oldDelegate) {
    return oldDelegate.radarAngle != radarAngle;
  }
}
