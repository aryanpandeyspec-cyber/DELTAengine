import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Signature Neubrutalist Color Palette for DELTA Engine
class DeltaColors {
  static const Color yaleBlue = Color(0xFF094074);
  static const Color balticBlue = Color(0xFF3C6997);
  static const Color skyAqua = Color(0xFF5ADBFF);
  static const Color mustard = Color(0xFFFFDD4A);
  static const Color deepSaffron = Color(0xFFFE9000);

  // Neon & Tactical Accents
  static const Color neonCyan = Color(0xFF00F5D4);
  static const Color electricPurple = Color(0xFF7B2CBF);
  static const Color hotPink = Color(0xFFFF007F);
  static const Color mintGreen = Color(0xFF06D6A0);
  static const Color coralRed = Color(0xFFFF4365);

  // Dark & Neutral tones
  static const Color background = Color(0xFF070B14);
  static const Color surface = Color(0xFF101728);
  static const Color surfaceLight = Color(0xFF18223B);
  static const Color surfaceElevated = Color(0xFF202D4F);
  static const Color borderBlack = Color(0xFF000000);
  static const Color textLight = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color dangerRed = Color(0xFFEF4444);
  static const Color successGreen = Color(0xFF10B981);
}

/// Neubrutalist Decorator Utilities
class Neubrutalism {
  static const double borderWidth = 2.5;
  static const double borderRadius = 12.0;
  static const Offset shadowOffset = Offset(4.0, 4.0);

  static BoxDecoration boxDecoration({
    Color color = DeltaColors.surface,
    Color borderColor = DeltaColors.borderBlack,
    double radius = borderRadius,
    Color shadowColor = DeltaColors.borderBlack,
    Offset shadow = shadowOffset,
    Gradient? gradient,
  }) {
    return BoxDecoration(
      color: gradient == null ? color : null,
      gradient: gradient,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(
        color: borderColor,
        width: borderWidth,
      ),
      boxShadow: [
        BoxShadow(
          color: shadowColor,
          offset: shadow,
          blurRadius: 0,
        ),
      ],
    );
  }

  static ThemeData get themeData {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: DeltaColors.background,
      primaryColor: DeltaColors.yaleBlue,
      colorScheme: const ColorScheme.dark(
        primary: DeltaColors.skyAqua,
        secondary: DeltaColors.mustard,
        surface: DeltaColors.surface,
        error: DeltaColors.dangerRed,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.outfit(
          fontSize: 28,
          fontWeight: FontWeight.w900,
          color: DeltaColors.textLight,
          letterSpacing: -0.5,
        ),
        headlineMedium: GoogleFonts.outfit(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: DeltaColors.textLight,
        ),
        titleMedium: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: DeltaColors.textLight,
        ),
        bodyLarge: GoogleFonts.spaceGrotesk(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: DeltaColors.textLight,
        ),
        bodyMedium: GoogleFonts.spaceGrotesk(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: DeltaColors.textMuted,
        ),
        labelLarge: GoogleFonts.spaceGrotesk(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: DeltaColors.borderBlack,
        ),
      ),
    );
  }
}

/// Tactile Neubrutalist Card with Press Depression Animation
class NeubrutalistCard extends StatefulWidget {
  final Widget child;
  final Color backgroundColor;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double radius;
  final Gradient? gradient;
  final Color borderColor;

  const NeubrutalistCard({
    super.key,
    required this.child,
    this.backgroundColor = DeltaColors.surface,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.radius = Neubrutalism.borderRadius,
    this.gradient,
    this.borderColor = DeltaColors.borderBlack,
  });

  @override
  State<NeubrutalistCard> createState() => _NeubrutalistCardState();
}

class _NeubrutalistCardState extends State<NeubrutalistCard> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final effectiveShadow = _isPressed ? Offset.zero : Neubrutalism.shadowOffset;
    final transformOffset = _isPressed ? const Offset(3, 3) : Offset.zero;

    Widget card = Transform.translate(
      offset: transformOffset,
      child: Container(
        padding: widget.padding,
        decoration: Neubrutalism.boxDecoration(
          color: widget.backgroundColor,
          radius: widget.radius,
          gradient: widget.gradient,
          borderColor: widget.borderColor,
          shadow: effectiveShadow,
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

/// Tactile Neubrutalist Action Button
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

  const NeubrutalistButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.backgroundColor = DeltaColors.mustard,
    this.textColor = DeltaColors.borderBlack,
    this.isFullWidth = true,
    this.isLoading = false,
    this.height = 48,
    this.fontSize = 13,
  });

  @override
  State<NeubrutalistButton> createState() => _NeubrutalistButtonState();
}

class _NeubrutalistButtonState extends State<NeubrutalistButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final effectiveShadow = _isPressed ? Offset.zero : const Offset(3.5, 3.5);
    final transformOffset = _isPressed ? const Offset(2.5, 2.5) : Offset.zero;

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
      child: Transform.translate(
        offset: transformOffset,
        child: Container(
          width: widget.isFullWidth ? double.infinity : null,
          height: widget.height,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: Neubrutalism.boxDecoration(
            color: widget.backgroundColor,
            shadow: effectiveShadow,
            radius: 10,
          ),
          child: Row(
            mainAxisSize: widget.isFullWidth ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.isLoading) ...[
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    valueColor: AlwaysStoppedAnimation<Color>(widget.textColor),
                  ),
                ),
                const SizedBox(width: 10),
              ] else if (widget.icon != null) ...[
                Icon(widget.icon, color: widget.textColor, size: 16),
                const SizedBox(width: 8),
              ],
              Text(
                widget.label,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: widget.fontSize,
                  fontWeight: FontWeight.w800,
                  color: widget.textColor,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact Neubrutalist Badge
class NeubrutalistBadge extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final IconData? icon;

  const NeubrutalistBadge({
    super.key,
    required this.label,
    this.backgroundColor = DeltaColors.skyAqua,
    this.textColor = DeltaColors.borderBlack,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: DeltaColors.borderBlack, width: 1.8),
        boxShadow: const [
          BoxShadow(
            color: DeltaColors.borderBlack,
            offset: Offset(2, 2),
            blurRadius: 0,
          )
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: GoogleFonts.spaceGrotesk(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}

/// Animated Pulsing Heartbeat / Live Signal Dot
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

    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.3).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _opacityAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
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
              width: widget.size * _scaleAnimation.value * 1.5,
              height: widget.size * _scaleAnimation.value * 1.5,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color.withValues(alpha: 0.3 * _opacityAnimation.value),
              ),
            ),
            Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.color,
                border: Border.all(color: Colors.black, width: 1.2),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Live Audio Waveform Equalizer Visualizer
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
      duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final multipliers = [0.3, 0.8, 0.5, 1.0, 0.7, 0.4, 0.9, 0.6, 0.2, 0.85, 0.45, 0.75];

    return AnimatedBuilder(
      animation: _anim,
      builder: (context, _) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: List.generate(multipliers.length, (index) {
            final activeHeight = widget.isBroadcasting
                ? 10.0 + (32.0 * multipliers[index] * (0.4 + 0.6 * _anim.value))
                : 6.0;

            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 2.5),
              width: 5,
              height: activeHeight,
              decoration: BoxDecoration(
                color: widget.isBroadcasting ? widget.barColor : DeltaColors.textMuted.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(3),
                border: Border.all(color: Colors.black, width: 1),
              ),
            );
          }),
        );
      },
    );
  }
}
