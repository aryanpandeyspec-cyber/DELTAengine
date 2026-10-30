import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import 'cockpit_screen.dart';
import 'login_screen.dart';

/// Tactical Aerospace Boot / Splash Screen for DELTA Engine Mobile
/// Renders an ultra-smooth, futuristic cyber-boot sequence with real-time
/// micro-telemetry, glowing Delta triangle emblem, and instant gateway resolution.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  late AnimationController _scanlineController;
  late Animation<double> _scanlineAnimation;

  late AnimationController _progressController;
  late Animation<double> _progressAnimation;

  final List<String> _bootLogs = [
    '⚡ KERNEL MOUNTED [DELTA-OS v2.4]',
    '📡 PROBING EDGE GATEWAYS (PARALLEL MESH)...',
    '🛡️ ZERO-TRUST HARDWARE ENCLAVE VERIFIED',
    '🎯 CROWD PERCEPTION & OPTICAL LIDAR READY',
    '🟢 ALL SYSTEMS NOMINAL • LAUNCHING DECK',
  ];

  int _visibleLogsCount = 1;
  Timer? _logTimer;
  OperatorSession? _resolvedSession;
  bool _isNavigating = false;
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();

    // 1. Breathing Glow Animation for Emblem
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.85, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // 2. Optical Scanline Sweep across the Triangle
    _scanlineController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
    _scanlineAnimation = Tween<double>(begin: -0.2, end: 1.2).animate(
      CurvedAnimation(parent: _scanlineController, curve: Curves.linear),
    );

    // 3. Fast Tactical Loading Progress Bar (0% to 100% in 1200ms)
    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
    );
    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _progressController, curve: Curves.easeOutCubic),
    );
    _progressController.forward();

    // 4. Progressive Terminal Telemetry Typing Effect
    _logTimer = Timer.periodic(const Duration(milliseconds: 240), (timer) {
      if (_visibleLogsCount < _bootLogs.length) {
        if (mounted) {
          setState(() {
            _visibleLogsCount++;
          });
          HapticFeedback.selectionClick();
        }
      } else {
        timer.cancel();
      }
    });

    // 5. Run Background Initialization & Session Check
    _warmUpAndNavigate();
  }

  Future<void> _warmUpAndNavigate() async {
    final startTime = DateTime.now();

    // Run parallel gateway detection & session restore
    try {
      await _api.init();
      final session = await _api.restoreSessionFromStorage();
      if (session != null && !session.isExpired) {
        final isValid = await _api.validateSession().timeout(
          const Duration(milliseconds: 800),
          onTimeout: () => true, // Proceed offline if session is unexpired
        );
        if (isValid) {
          _resolvedSession = session;
          WebSocketService().connect();
        }
      }
    } catch (_) {}

    // Ensure minimum splash duration of 1200ms so animation is visually satisfying
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
    HapticFeedback.lightImpact();

    final nextScreen = (_resolvedSession != null)
        ? CockpitScreen(session: _resolvedSession!)
        : const LoginScreen();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 400),
        pageBuilder: (context, animation, secondaryAnimation) => nextScreen,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: CurvedAnimation(parent: animation, curve: Curves.easeInOut),
            child: child,
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _scanlineController.dispose();
    _progressController.dispose();
    _logTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      body: GestureDetector(
        onTap: _proceedToNextScreen, // Quick tap-to-skip for instant entry
        behavior: HitTestBehavior.opaque,
        child: Stack(
          children: [
            // Ambient cyber-grid background
            Positioned.fill(
              child: CustomPaint(
                painter: _TacticalGridPainter(),
              ),
            ),

            // Top Status Pill
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10192C),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF223554), width: 1),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Color(0xFF00F5D4),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'STANDBY: FIELD DECK',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF38BDF8),
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      'TAP TO SKIP ▶',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.4),
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Center Content: Glowing Delta Emblem & Title
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Glowing Delta Triangle Emblem Container
                  AnimatedBuilder(
                    animation: _pulseAnimation,
                    builder: (context, child) {
                      return Transform.scale(
                        scale: _pulseAnimation.value,
                        child: Container(
                          width: 110,
                          height: 110,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0E172A),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: const Color(0xFF00F5D4).withValues(alpha: 0.6),
                              width: 1.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF00E5FF).withValues(alpha: 0.28 * _pulseAnimation.value),
                                blurRadius: 36 * _pulseAnimation.value,
                                spreadRadius: 4,
                              ),
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.6),
                                offset: const Offset(0, 10),
                                blurRadius: 24,
                              ),
                            ],
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // Pure Delta Triangle Emblem (No text fragments)
                              Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Image.asset(
                                  'assets/images/delta_emblem.png',
                                  fit: BoxFit.contain,
                                ),
                              ),
                              // Animated Optical Scanline Passing Through
                              AnimatedBuilder(
                                animation: _scanlineAnimation,
                                builder: (context, _) {
                                  return Positioned(
                                    top: 110 * _scanlineAnimation.value,
                                    left: 0,
                                    right: 0,
                                    child: Container(
                                      height: 3,
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: [
                                            Colors.transparent,
                                            const Color(0xFF00F5D4).withValues(alpha: 0.9),
                                            const Color(0xFF38BDF8),
                                            Colors.transparent,
                                          ],
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFF00F5D4).withValues(alpha: 0.8),
                                            blurRadius: 8,
                                            spreadRadius: 2,
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 22),

                  // Brand Title
                  Text(
                    'DELTA ENGINE',
                    style: GoogleFonts.outfit(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 4.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'AUTONOMOUS VENUE STEERING & LIFE SAFETY',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF38BDF8),
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ),

            // Bottom Console: Micro Terminal Feed & Progress Bar
            Positioned(
              left: 24,
              right: 24,
              bottom: 36,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Terminal Telemetry Window
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A101D),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF1E2E4A), width: 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: List.generate(_visibleLogsCount, (index) {
                        final log = _bootLogs[index];
                        final isLast = (index == _visibleLogsCount - 1);
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2.0),
                          child: Text(
                            log,
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 10,
                              fontWeight: isLast ? FontWeight.w700 : FontWeight.w500,
                              color: isLast ? const Color(0xFF00F5D4) : const Color(0xFF94A3B8),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Animated Progress Bar Header
                  AnimatedBuilder(
                    animation: _progressAnimation,
                    builder: (context, _) {
                      final pct = (_progressAnimation.value * 100).toInt();
                      return Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            pct < 100 ? 'INITIALIZING SUBSYSTEMS...' : 'SYSTEMS ONLINE',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: pct < 100 ? const Color(0xFF94A3B8) : const Color(0xFF00F5D4),
                            ),
                          ),
                          Text(
                            '$pct%',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 6),

                  // Progress Bar Track
                  Container(
                    height: 5,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: const Color(0xFF152238),
                      borderRadius: BorderRadius.circular(3),
                    ),
                    alignment: Alignment.centerLeft,
                    child: AnimatedBuilder(
                      animation: _progressAnimation,
                      builder: (context, _) {
                        return Container(
                          width: MediaQuery.of(context).size.width * _progressAnimation.value,
                          height: 5,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(3),
                            gradient: const LinearGradient(
                              colors: [
                                Color(0xFF38BDF8),
                                Color(0xFF00F5D4),
                                Color(0xFFF59E0B),
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF00F5D4).withValues(alpha: 0.6),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Subtle tactical crosshairs and micro-grid background painter
class _TacticalGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF132038).withValues(alpha: 0.35)
      ..strokeWidth = 0.5;

    // Draw subtle grid lines
    const step = 40.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }

    // Corner crosshairs
    final crossPaint = Paint()
      ..color = const Color(0xFF38BDF8).withValues(alpha: 0.3)
      ..strokeWidth = 1.0;

    const arm = 12.0;
    // Top-left
    canvas.drawLine(const Offset(16, 16), const Offset(16 + arm, 16), crossPaint);
    canvas.drawLine(const Offset(16, 16), const Offset(16, 16 + arm), crossPaint);
    // Top-right
    canvas.drawLine(Offset(size.width - 16, 16), Offset(size.width - 16 - arm, 16), crossPaint);
    canvas.drawLine(Offset(size.width - 16, 16), Offset(size.width - 16, 16 + arm), crossPaint);
    // Bottom-left
    canvas.drawLine(Offset(16, size.height - 16), Offset(16 + arm, size.height - 16), crossPaint);
    canvas.drawLine(Offset(16, size.height - 16), Offset(16, size.height - 16 - arm), crossPaint);
    // Bottom-right
    canvas.drawLine(Offset(size.width - 16, size.height - 16), Offset(size.width - 16 - arm, size.height - 16), crossPaint);
    canvas.drawLine(Offset(size.width - 16, size.height - 16), Offset(size.width - 16, size.height - 16 - arm), crossPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
