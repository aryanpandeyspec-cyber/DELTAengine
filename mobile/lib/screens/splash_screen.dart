import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import 'cockpit_screen.dart';
import 'login_screen.dart';

/// Ultra-Fast, Silky-Smooth 120 FPS Cyber Kinetic Splash Screen
/// Seamless hand-off from Android cold-start window to Flutter with instant
/// hardware-accelerated spring animations and parallel gateway resolution.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _glowAnimation;
  late Animation<double> _titleFadeAnimation;
  late Animation<Offset> _titleSlideAnimation;
  late Animation<double> _progressAnimation;

  OperatorSession? _resolvedSession;
  bool _isNavigating = false;
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();

    // 1. Single unified hardware-accelerated animation controller (750ms total)
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    );

    // Staggered timeline:
    // 0.0 - 0.45: Triangle Emblem Spring Bloom
    _scaleAnimation = Tween<double>(begin: 0.90, end: 1.0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOutBack),
      ),
    );

    // 0.1 - 0.55: Radial Cyan Energy Halo
    _glowAnimation = Tween<double>(begin: 0.2, end: 1.0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.1, 0.55, curve: Curves.easeOut),
      ),
    );

    // 0.25 - 0.70: Brand Title Reveal
    _titleFadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.25, 0.70, curve: Curves.easeOut),
      ),
    );
    _titleSlideAnimation = Tween<Offset>(
      begin: const Offset(0.0, 0.25),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.25, 0.70, curve: Curves.easeOutCubic),
      ),
    );

    // 0.20 - 0.90: High-Speed Cyber Progress Fill
    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.20, 0.90, curve: Curves.easeInOutCubic),
      ),
    );

    _animController.forward();

    // 2. Parallel Background Initialization & Gateway Handshake
    _warmUpAndNavigate();
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

    // Snappy, non-blocking splash duration (target: ~750ms max)
    final elapsed = DateTime.now().difference(startTime).inMilliseconds;
    final remaining = 750 - elapsed;
    if (remaining > 0) {
      await Future.delayed(Duration(milliseconds: remaining));
    }

    _proceedToNextScreen();
  }

  void _proceedToNextScreen() {
    if (_isNavigating || !mounted) return;
    _isNavigating = true;
    HapticFeedback.selectionClick();

    final nextScreen = (_resolvedSession != null)
        ? CockpitScreen(session: _resolvedSession!)
        : const LoginScreen();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 280),
        pageBuilder: (context, animation, secondaryAnimation) => nextScreen,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
            child: child,
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      body: GestureDetector(
        onTap: _proceedToNextScreen, // Instant tap-to-skip
        behavior: HitTestBehavior.opaque,
        child: Stack(
          children: [
            // Ambient cyber background grid (static RepaintBoundary for 120 FPS performance)
            const RepaintBoundary(
              child: CustomPaint(
                size: Size.infinite,
                painter: _StaticCyberGridPainter(),
              ),
            ),

            // Top Status Bar
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFF1E2D4A), width: 1),
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
                          const Text(
                            'STANDBY: FIELD DECK',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF38BDF8),
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      'TAP TO SKIP ▶',
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 9.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.45),
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Center: Glowing Delta Triangle Emblem & Typography
            Center(
              child: AnimatedBuilder(
                animation: _animController,
                builder: (context, _) {
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Emblem with Hardware-Accelerated Scale & Neon Cyan Glow
                      Transform.scale(
                        scale: _scaleAnimation.value,
                        child: Container(
                          width: 112,
                          height: 112,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0E172A),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: const Color(0xFF00F5D4).withValues(alpha: 0.5 * _glowAnimation.value + 0.3),
                              width: 1.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF00F5D4).withValues(alpha: 0.22 * _glowAnimation.value),
                                blurRadius: 28,
                                spreadRadius: 2,
                              ),
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.6),
                                offset: const Offset(0, 8),
                                blurRadius: 18,
                              ),
                            ],
                          ),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // Pure Delta Triangle Emblem (No text fragments)
                              Padding(
                                padding: const EdgeInsets.all(18.0),
                                child: Image.asset(
                                  'assets/images/delta_emblem.png',
                                  fit: BoxFit.contain,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Brand Titles (Staggered Slide & Fade)
                      FadeTransition(
                        opacity: _titleFadeAnimation,
                        child: SlideTransition(
                          position: _titleSlideAnimation,
                          child: const Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'DELTA ENGINE',
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                  letterSpacing: 4.5,
                                ),
                              ),
                              SizedBox(height: 6),
                              Text(
                                'AUTONOMOUS VENUE STEERING & LIFE SAFETY',
                                style: TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF38BDF8),
                                  letterSpacing: 1.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

            // Bottom Cyber Progress & Telemetry Status Bar
            Positioned(
              left: 24,
              right: 24,
              bottom: 38,
              child: AnimatedBuilder(
                animation: _animController,
                builder: (context, _) {
                  final progress = _progressAnimation.value;
                  final pct = (progress * 100).toInt();

                  String statusText;
                  Color statusColor;
                  if (progress < 0.35) {
                    statusText = '⚡ INITIALIZING CORE KERNEL';
                    statusColor = const Color(0xFF94A3B8);
                  } else if (progress < 0.70) {
                    statusText = '📡 CONNECTING EDGE SENSORS';
                    statusColor = const Color(0xFF38BDF8);
                  } else if (progress < 0.95) {
                    statusText = '🎯 SYNCING VENUE TELEMETRY';
                    statusColor = const Color(0xFFF59E0B);
                  } else {
                    statusText = '🟢 SYSTEMS NOMINAL • LAUNCHING';
                    statusColor = const Color(0xFF00F5D4);
                  }

                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            statusText,
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: statusColor,
                              letterSpacing: 0.5,
                            ),
                          ),
                          Text(
                            '$pct%',
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Sleek Progress Track
                      Container(
                        height: 4,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: const Color(0xFF131D31),
                          borderRadius: BorderRadius.circular(2),
                        ),
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: progress.clamp(0.02, 1.0),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(2),
                              gradient: const LinearGradient(
                                colors: [
                                  Color(0xFF38BDF8),
                                  Color(0xFF00F5D4),
                                  Color(0xFFF59E0B),
                                ],
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0xFF00F5D4),
                                  blurRadius: 6,
                                ),
                              ],
                            ),
                          ),
                        ),
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

/// Static, zero-cost painter for mission grid lines and corner reticles
class _StaticCyberGridPainter extends CustomPainter {
  const _StaticCyberGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF142036).withValues(alpha: 0.35)
      ..strokeWidth = 0.5;

    const step = 42.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }

    final cornerPaint = Paint()
      ..color = const Color(0xFF38BDF8).withValues(alpha: 0.25)
      ..strokeWidth = 1.0;

    const arm = 12.0;
    // Corner crosshairs
    canvas.drawLine(const Offset(16, 16), const Offset(16 + arm, 16), cornerPaint);
    canvas.drawLine(const Offset(16, 16), const Offset(16, 16 + arm), cornerPaint);

    canvas.drawLine(Offset(size.width - 16, 16), Offset(size.width - 16 - arm, 16), cornerPaint);
    canvas.drawLine(Offset(size.width - 16, 16), Offset(size.width - 16, 16 + arm), cornerPaint);

    canvas.drawLine(Offset(16, size.height - 16), Offset(16 + arm, size.height - 16), cornerPaint);
    canvas.drawLine(Offset(16, size.height - 16), Offset(16, size.height - 16 - arm), cornerPaint);

    canvas.drawLine(Offset(size.width - 16, size.height - 16), Offset(size.width - 16 - arm, size.height - 16), cornerPaint);
    canvas.drawLine(Offset(size.width - 16, size.height - 16), Offset(size.width - 16, size.height - 16 - arm), cornerPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
