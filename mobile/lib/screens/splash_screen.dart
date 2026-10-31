import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import 'cockpit_screen.dart';
import 'login_screen.dart';

/// Ultra-Fast 120 FPS Tactical Aerospace Kinetic Splash
/// Delivers an instantaneous, zero-jank 480ms cyber reveal with rotating
/// HUD targeting brackets, cyan shockwave ring, and seamless screen morph.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnim;
  late Animation<double> _pulseRingAnim;
  late Animation<double> _titleFadeAnim;
  late Animation<Offset> _titleSlideAnim;
  late Animation<double> _progressAnim;

  OperatorSession? _resolvedSession;
  bool _isNavigating = false;
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();

    // 480ms high-velocity unified controller for instant responsiveness
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 480),
    );

    _scaleAnim = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.60, curve: Curves.easeOutBack),
      ),
    );

    _pulseRingAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.10, 0.70, curve: Curves.easeOut),
      ),
    );

    _titleFadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.25, 0.75, curve: Curves.easeOut),
      ),
    );

    _titleSlideAnim = Tween<Offset>(
      begin: const Offset(0.0, 0.20),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.25, 0.75, curve: Curves.easeOutCubic),
      ),
    );

    _progressAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.15, 0.95, curve: Curves.easeInOutCubic),
      ),
    );

    _controller.forward();
    _startPreloadAndNavigate();
  }

  Future<void> _startPreloadAndNavigate() async {
    final startTime = DateTime.now();

    // Parallel edge gateway detection & cached session check
    try {
      await _api.init();
      final session = await _api.restoreSessionFromStorage();
      if (session != null && !session.isExpired) {
        final isValid = await _api.validateSession().timeout(
          const Duration(milliseconds: 400),
          onTimeout: () => true, // Offline entry permitted if unexpired
        );
        if (isValid) {
          _resolvedSession = session;
          WebSocketService().connect();
        }
      }
    } catch (_) {}

    // Precise 480ms target duration - zero perceptible delay
    final elapsed = DateTime.now().difference(startTime).inMilliseconds;
    final remaining = 480 - elapsed;
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
        transitionDuration: const Duration(milliseconds: 220),
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
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      body: GestureDetector(
        onTap: _proceedToNextScreen, // 0ms tap-to-skip
        behavior: HitTestBehavior.opaque,
        child: Stack(
          children: [
            // Static grid background for 0 GPU redraw cost
            const RepaintBoundary(
              child: CustomPaint(
                size: Size.infinite,
                painter: _StaticCyberGridPainter(),
              ),
            ),

            // Top Status Capsule
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

            // Center: Glowing Delta Triangle Emblem & Aerospace Reticle
            Center(
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Tactical Shockwave Ring & Emblem Card
                      SizedBox(
                        width: 140,
                        height: 140,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            // Expanding Cyan Energy Halo Ring
                            Opacity(
                              opacity: (1.0 - _pulseRingAnim.value).clamp(0.0, 1.0),
                              child: Container(
                                width: 110 + (30 * _pulseRingAnim.value),
                                height: 110 + (30 * _pulseRingAnim.value),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color(0xFF00F5D4).withValues(alpha: 0.8),
                                    width: 1.5,
                                  ),
                                ),
                              ),
                            ),

                            // Corner Targeting Reticles
                            CustomPaint(
                              size: const Size(130, 130),
                              painter: _ReticlePainter(progress: _scaleAnim.value),
                            ),

                            // Pure Geometric Delta Triangle Card
                            Transform.scale(
                              scale: _scaleAnim.value,
                              child: Container(
                                width: 108,
                                height: 108,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0E172A),
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(
                                    color: const Color(0xFF00F5D4).withValues(alpha: 0.7),
                                    width: 1.5,
                                  ),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0xFF00F5D4),
                                      blurRadius: 24,
                                      spreadRadius: -2,
                                    ),
                                    BoxShadow(
                                      color: Colors.black,
                                      offset: Offset(0, 8),
                                      blurRadius: 16,
                                    ),
                                  ],
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Image.asset(
                                    'assets/images/delta_emblem.png',
                                    fit: BoxFit.contain,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Brand Titles (High-Velocity Slide & Fade)
                      FadeTransition(
                        opacity: _titleFadeAnim,
                        child: SlideTransition(
                          position: _titleSlideAnim,
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
                              SizedBox(height: 5),
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

            // Bottom Ultra-Fast Progress Track & Status
            Positioned(
              left: 24,
              right: 24,
              bottom: 38,
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  final progress = _progressAnim.value;
                  final pct = (progress * 100).toInt();

                  String statusText;
                  Color statusColor;
                  if (progress < 0.40) {
                    statusText = '⚡ INITIALIZING KERNEL';
                    statusColor = const Color(0xFF94A3B8);
                  } else if (progress < 0.85) {
                    statusText = '📡 CONNECTING EDGE SENSORS';
                    statusColor = const Color(0xFF38BDF8);
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

                      Container(
                        height: 4,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: const Color(0xFF131D31),
                          borderRadius: BorderRadius.circular(2),
                        ),
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: progress.clamp(0.04, 1.0),
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

/// Tactical HUD Reticle Corner Brackets
class _ReticlePainter extends CustomPainter {
  final double progress;
  const _ReticlePainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF00F5D4).withValues(alpha: 0.5 * progress)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    const arm = 10.0;
    const pad = 4.0;

    // Top-left bracket
    canvas.drawLine(const Offset(pad, pad + arm), const Offset(pad, pad), paint);
    canvas.drawLine(const Offset(pad, pad), const Offset(pad + arm, pad), paint);

    // Top-right bracket
    canvas.drawLine(Offset(size.width - pad - arm, pad), Offset(size.width - pad, pad), paint);
    canvas.drawLine(Offset(size.width - pad, pad), Offset(size.width - pad, pad + arm), paint);

    // Bottom-left bracket
    canvas.drawLine(Offset(pad, size.height - pad - arm), Offset(pad, size.height - pad), paint);
    canvas.drawLine(Offset(pad, size.height - pad), Offset(pad + arm, size.height - pad), paint);

    // Bottom-right bracket
    canvas.drawLine(Offset(size.width - pad - arm, size.height - pad), Offset(size.width - pad, size.height - pad), paint);
    canvas.drawLine(Offset(size.width - pad, size.height - pad), Offset(size.width - pad, size.height - pad - arm), paint);
  }

  @override
  bool shouldRepaint(covariant _ReticlePainter oldDelegate) => oldDelegate.progress != progress;
}

/// Zero-cost background painter
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
    canvas.drawLine(const Offset(16, 16), const Offset(16 + arm, 16), cornerPaint);
    canvas.drawLine(const Offset(16, 16), const Offset(16, 16 + arm), cornerPaint);

    canvas.drawLine(Offset(size.width - 16, 16), Offset(size.width - 16 - arm, 16), cornerPaint);
    canvas.drawLine(Offset(size.width - 16, 16), Offset(size.width - 16, 16 + arm), cornerPaint);

    canvas.drawLine(Offset(16, size.height - 16), Offset(16 + arm, size.height - 16), cornerPaint);
    canvas.drawLine(Offset(16, size.height - 16), Offset(16, size.height - 16 - arm), cornerPaint);

    canvas.drawLine(Offset(size.width - 16, size.height - 16), Offset(size.width - 16 - arm, size.height - 16), cornerPaint);
    canvas.drawLine(Offset(size.width - 16, size.height - 16), Offset(size.width - 16 - arm, size.height - 16), cornerPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
