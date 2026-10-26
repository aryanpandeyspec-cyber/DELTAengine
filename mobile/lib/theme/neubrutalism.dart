import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Signature Luxury Tactical Color Palette for DELTA Engine
class DeltaColors {
  // Primary brand anchors
  static const Color yaleBlue = Color(0xFF0E223D);
  static const Color balticBlue = Color(0xFF1E3A5F);
  static const Color skyAqua = Color(0xFF38BDF8);
  static const Color mustard = Color(0xFFF59E0B);
  static const Color deepSaffron = Color(0xFFF97316);

  // Neon & Tactical Accents
  static const Color neonCyan = Color(0xFF00F5D4);
  static const Color electricPurple = Color(0xFF8B5CF6);
  static const Color hotPink = Color(0xFFEC4899);
  static const Color mintGreen = Color(0xFF10B981);
  static const Color coralRed = Color(0xFFF43F5E);

  // Deep Obsidian Dark Surfaces (High-End Mission Control Aesthetic)
  static const Color background = Color(0xFF080D1A);
  static const Color surface = Color(0xFF0F172A);
  static const Color surfaceLight = Color(0xFF162238);
  static const Color surfaceElevated = Color(0xFF1E2D4A);
  static const Color cardBorder = Color(0xFF223452);
  static const Color borderSubtle = Color(0xFF1A263D);
  static const Color borderBlack = Color(0xFF1B2436);
  static const Color textLight = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color textDim = Color(0xFF64748B);
  static const Color dangerRed = Color(0xFFEF4444);
  static const Color successGreen = Color(0xFF10B981);
}

/// Unified High-Performance Tactical Typography for DELTA Engine
/// Built on Plus Jakarta Sans (UI clarity & elegance) and JetBrains Mono (precision telemetry)
class DeltaTypography {
  // Headings & Brand Elements (Plus Jakarta Sans)
  static TextStyle displayHero({Color color = DeltaColors.textLight, double fontSize = 28}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w800,
        color: color,
        letterSpacing: -0.6,
      );

  static TextStyle titleLarge({Color color = DeltaColors.textLight, double fontSize = 18}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        color: color,
        letterSpacing: -0.3,
      );

  static TextStyle titleMedium({Color color = DeltaColors.textLight, double fontSize = 14.5}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        color: color,
        letterSpacing: -0.2,
      );

  static TextStyle titleSmall({Color color = DeltaColors.textLight, double fontSize = 12.5}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w600,
        color: color,
      );

  // Precision Telemetry & Tabular Figures (JetBrains Mono)
  static TextStyle monoHero({Color color = DeltaColors.mustard}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: 38,
        fontWeight: FontWeight.w800,
        color: color,
        letterSpacing: -1.0,
      );

  static TextStyle monoStat({Color color = DeltaColors.textLight, double fontSize = 13}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        color: color,
      );

  static TextStyle monoLabel({Color color = DeltaColors.textMuted, double fontSize = 10.5}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: fontSize,
        fontWeight: FontWeight.w600,
        color: color,
        letterSpacing: 0.5,
      );

  static TextStyle monoBadge({Color color = Colors.black, double fontSize = 10.5}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: fontSize,
        fontWeight: FontWeight.w800,
        color: color,
        letterSpacing: 0.4,
      );

  // Clean Body & Functional Micro-Labels
  static TextStyle body({Color color = DeltaColors.textLight, double fontSize = 13}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w400,
        color: color,
        height: 1.35,
      );

  static TextStyle bodyBold({Color color = DeltaColors.textLight, double fontSize = 13}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w600,
        color: color,
      );

  static TextStyle bodyMuted({Color color = DeltaColors.textMuted, double fontSize = 11.5}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w400,
        color: color,
        height: 1.3,
      );

  static TextStyle microCaps({Color color = DeltaColors.textMuted, double fontSize = 9.5}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        color: color,
        letterSpacing: 0.8,
      );

  static TextStyle button({Color color = Colors.black, double fontSize = 12}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: FontWeight.w800,
        color: color,
        letterSpacing: 0.4,
      );
}

/// Refined Tactical Decorator Utilities (High-Precision Obsidian Aesthetic)
class Neubrutalism {
  static const double borderWidth = 1.0;
  static const double borderRadius = 14.0;
  static const Offset shadowOffset = Offset(0, 4);

  static BoxDecoration boxDecoration({
    Color color = DeltaColors.surface,
    Color? borderColor,
    double radius = borderRadius,
    Color? shadowColor,
    Offset shadow = shadowOffset,
    Gradient? gradient,
  }) {
    final effectiveBorderColor = borderColor ?? DeltaColors.cardBorder;
    final effectiveShadowColor = shadowColor ?? const Color(0x38000000);

    return BoxDecoration(
      color: gradient == null ? color : null,
      gradient: gradient,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(
        color: effectiveBorderColor,
        width: borderWidth,
      ),
      boxShadow: [
        BoxShadow(
          color: effectiveShadowColor,
          offset: shadow,
          blurRadius: 14,
          spreadRadius: 0,
        ),
      ],
    );
  }

  static ThemeData get themeData {
    final baseTextTheme = GoogleFonts.plusJakartaSansTextTheme(ThemeData.dark().textTheme);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: DeltaColors.background,
      primaryColor: DeltaColors.skyAqua,
      colorScheme: const ColorScheme.dark(
        primary: DeltaColors.skyAqua,
        secondary: DeltaColors.mustard,
        surface: DeltaColors.surface,
        error: DeltaColors.dangerRed,
      ),
      textTheme: baseTextTheme.copyWith(
        displayLarge: GoogleFonts.plusJakartaSans(
          fontSize: 28,
          fontWeight: FontWeight.w800,
          color: DeltaColors.textLight,
          letterSpacing: -0.5,
        ),
        headlineMedium: GoogleFonts.plusJakartaSans(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: DeltaColors.textLight,
          letterSpacing: -0.3,
        ),
        titleMedium: GoogleFonts.plusJakartaSans(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: DeltaColors.textLight,
        ),
        bodyLarge: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: DeltaColors.textLight,
        ),
        bodyMedium: GoogleFonts.plusJakartaSans(
          fontSize: 12.5,
          fontWeight: FontWeight.w400,
          color: DeltaColors.textMuted,
        ),
        labelLarge: GoogleFonts.plusJakartaSans(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}

/// Refined Tactical Glass Card with Micro-Haptic Spring Animation
class NeubrutalistCard extends StatefulWidget {
  final Widget child;
  final Color backgroundColor;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double radius;
  final Gradient? gradient;
  final Color? borderColor;

  const NeubrutalistCard({
    super.key,
    required this.child,
    this.backgroundColor = DeltaColors.surface,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.radius = Neubrutalism.borderRadius,
    this.gradient,
    this.borderColor,
  });

  @override
  State<NeubrutalistCard> createState() => _NeubrutalistCardState();
}

class _NeubrutalistCardState extends State<NeubrutalistCard> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final effectiveBorder = widget.borderColor ?? DeltaColors.cardBorder;

    Widget card = AnimatedScale(
      scale: _isPressed ? 0.985 : 1.0,
      duration: const Duration(milliseconds: 120),
      curve: Curves.easeOutCubic,
      child: Container(
        padding: widget.padding,
        decoration: BoxDecoration(
          color: widget.gradient == null ? widget.backgroundColor : null,
          gradient: widget.gradient ??
              (widget.backgroundColor == DeltaColors.surface
                  ? const LinearGradient(
                      colors: [Color(0xFF0F1829), Color(0xFF0A101C)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null),
          borderRadius: BorderRadius.circular(widget.radius),
          border: Border.all(
            color: effectiveBorder,
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.35),
              offset: const Offset(0, 6),
              blurRadius: 18,
              spreadRadius: 0,
            ),
          ],
        ),
        child: widget.child,
      ),
    );

    if (widget.onTap != null) {
      return GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) {
          setState(() => _isPressed = false);
          widget.onTap!();
        },
        onTapCancel: () => setState(() => _isPressed = false),
        child: card,
      );
    }
    return card;
  }
}

/// Refined Tactical Action Button (Modern Linear / Obsidian Style)
class NeubrutalistButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final Color backgroundColor;
  final Color textColor;
  final bool isFullWidth;
  final bool isLoading;
  final double height;
  final double fontSize;
  final EdgeInsetsGeometry? padding;
  final Gradient? gradient;

  const NeubrutalistButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.backgroundColor = DeltaColors.mustard,
    this.textColor = Colors.black,
    this.isFullWidth = true,
    this.isLoading = false,
    this.height = 44,
    this.fontSize = 12,
    this.padding,
    this.gradient,
  });

  @override
  State<NeubrutalistButton> createState() => _NeubrutalistButtonState();
}

class _NeubrutalistButtonState extends State<NeubrutalistButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final isAmber = widget.backgroundColor == DeltaColors.mustard;

    return GestureDetector(
      onTapDown: (_) {
        if (!widget.isLoading && widget.onPressed != null) {
          setState(() => _isPressed = true);
        }
      },
      onTapUp: (_) {
        setState(() => _isPressed = false);
        if (!widget.isLoading && widget.onPressed != null) {
          widget.onPressed!();
        }
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOutCubic,
        child: Container(
          width: widget.isFullWidth ? double.infinity : null,
          height: widget.height,
          padding: widget.padding ?? const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            gradient: widget.gradient ??
                (isAmber
                    ? const LinearGradient(
                        colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      )
                    : null),
            color: (widget.gradient != null || isAmber) ? null : widget.backgroundColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isAmber
                  ? const Color(0xFFFCD34D).withValues(alpha: 0.5)
                  : Colors.white.withValues(alpha: 0.15),
              width: 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: widget.backgroundColor.withValues(alpha: 0.25),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: widget.isFullWidth ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.isLoading) ...[
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.0,
                    valueColor: AlwaysStoppedAnimation<Color>(widget.textColor),
                  ),
                ),
                const SizedBox(width: 6),
              ] else if (widget.icon != null) ...[
                Icon(widget.icon, color: widget.textColor, size: 15),
                const SizedBox(width: 6),
              ],
              Flexible(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  softWrap: false,
                  style: DeltaTypography.button(
                    fontSize: widget.fontSize,
                    color: widget.textColor,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact Modern Pill Badge
class NeubrutalistBadge extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final IconData? icon;

  const NeubrutalistBadge({
    super.key,
    required this.label,
    this.backgroundColor = DeltaColors.skyAqua,
    this.textColor = Colors.black,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7.5, vertical: 3.5),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18), width: 1.0),
        boxShadow: [
          BoxShadow(
            color: backgroundColor.withValues(alpha: 0.25),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: DeltaTypography.monoBadge(
              fontSize: 10.0,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}

/// Animated High-Precision Signal Beacon / Live Signal Dot
class PulsingDot extends StatefulWidget {
  final Color color;
  final double size;

  const PulsingDot({
    super.key,
    this.color = DeltaColors.successGreen,
    this.size = 8.0,
  });

  @override
  State<PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<PulsingDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(begin: 0.85, end: 1.5).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _opacityAnimation = Tween<double>(begin: 0.3, end: 0.9).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            Container(
              width: widget.size * _scaleAnimation.value * 1.6,
              height: widget.size * _scaleAnimation.value * 1.6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color.withValues(alpha: 0.25 * _opacityAnimation.value),
              ),
            ),
            Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color,
                boxShadow: [
                  BoxShadow(
                    color: widget.color.withValues(alpha: 0.6),
                    blurRadius: 6,
                    spreadRadius: 1,
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Dynamic Tactical Progress Bar with Glow and Auto-Severity Color Grading
class TacticalProgressBar extends StatelessWidget {
  final double value; // 0.0 to 1.0 (or percentage ratio)
  final double height;
  final Color? colorOverride;
  final bool showSegments;

  const TacticalProgressBar({
    super.key,
    required this.value,
    this.height = 6.0,
    this.colorOverride,
    this.showSegments = false,
  });

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);
    final effectiveColor = colorOverride ??
        (clamped >= 0.8
            ? DeltaColors.dangerRed
            : clamped >= 0.6
                ? DeltaColors.mustard
                : DeltaColors.mintGreen);

    return Container(
      height: height,
      width: double.infinity,
      decoration: BoxDecoration(
        color: DeltaColors.surfaceElevated,
        borderRadius: BorderRadius.circular(height / 2),
      ),
      child: Stack(
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              return AnimatedContainer(
                duration: const Duration(milliseconds: 350),
                curve: Curves.easeOutCubic,
                width: constraints.maxWidth * clamped,
                height: height,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      effectiveColor.withValues(alpha: 0.75),
                      effectiveColor,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(height / 2),
                  boxShadow: [
                    BoxShadow(
                      color: effectiveColor.withValues(alpha: 0.5),
                      blurRadius: 6,
                      spreadRadius: 0,
                    ),
                  ],
                ),
              );
            },
          ),
          if (showSegments)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(
                4,
                (_) => Container(
                  width: 1.5,
                  height: height,
                  color: Colors.black.withValues(alpha: 0.35),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Live Audio Waveform Equalizer Visualizer (Expanded 16-Band Array)
class AudioWaveformVisualizer extends StatefulWidget {
  final bool isBroadcasting;
  final Color barColor;

  const AudioWaveformVisualizer({
    super.key,
    required this.isBroadcasting,
    this.barColor = DeltaColors.skyAqua,
  });

  @override
  State<AudioWaveformVisualizer> createState() => _AudioWaveformVisualizerState();
}

class _AudioWaveformVisualizerState extends State<AudioWaveformVisualizer> with SingleTickerProviderStateMixin {
  late AnimationController _anim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final multipliers = [
      0.3, 0.7, 0.45, 0.9, 0.6, 1.0, 0.8, 0.5,
      0.85, 0.4, 0.95, 0.65, 0.75, 0.5, 0.85, 0.35
    ];

    return AnimatedBuilder(
      animation: _anim,
      builder: (context, _) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: List.generate(multipliers.length, (index) {
            final wave = (index % 2 == 0) ? _anim.value : (1.0 - _anim.value);
            final activeHeight = widget.isBroadcasting
                ? 8.0 + (32.0 * multipliers[index] * (0.35 + 0.65 * wave))
                : 6.0;

            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 2.0),
              width: 3.5,
              height: activeHeight,
              decoration: BoxDecoration(
                color: widget.isBroadcasting ? widget.barColor : DeltaColors.textMuted.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(3),
                boxShadow: widget.isBroadcasting
                    ? [
                        BoxShadow(
                          color: widget.barColor.withValues(alpha: 0.45),
                          blurRadius: 5,
                        ),
                      ]
                    : null,
              ),
            );
          }),
        );
      },
    );
  }
}
