import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Signature Neubrutalist Color Palette for DELTA Engine
class DeltaColors {
  static const Color yaleBlue = Color(0xFF094074);
  static const Color balticBlue = Color(0xFF3C6997);
  static const Color skyAqua = Color(0xFF5ADBFF);
  static const Color mustard = Color(0xFFFFDD4A);
  static const Color deepSaffron = Color(0xFFFE9000);

  // Dark & Neutral tones
  static const Color background = Color(0xFF0A0F1D);
  static const Color surface = Color(0xFF131D31);
  static const Color surfaceLight = Color(0xFF1B2845);
  static const Color borderBlack = Color(0xFF000000);
  static const Color textLight = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color dangerRed = Color(0xFFEF4444);
  static const Color successGreen = Color(0xFF10B981);
}

/// Neubrutalist Decorator Utilities
class Neubrutalism {
  static const double borderWidth = 2.5;
  static const double borderRadius = 10.0;
  static const Offset shadowOffset = Offset(3.5, 3.5);

  static BoxDecoration boxDecoration({
    Color color = DeltaColors.surface,
    Color borderColor = DeltaColors.borderBlack,
    double radius = borderRadius,
    Color shadowColor = DeltaColors.borderBlack,
    Offset shadow = shadowOffset,
  }) {
    return BoxDecoration(
      color: color,
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

/// Tactile Neubrutalist Card
class NeubrutalistCard extends StatelessWidget {
  final Widget child;
  final Color backgroundColor;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double radius;

  const NeubrutalistCard({
    super.key,
    required this.child,
    this.backgroundColor = DeltaColors.surface,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.radius = Neubrutalism.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = Container(
      padding: padding,
      decoration: Neubrutalism.boxDecoration(
        color: backgroundColor,
        radius: radius,
      ),
      child: child,
    );

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
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

  const NeubrutalistButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.backgroundColor = DeltaColors.mustard,
    this.textColor = DeltaColors.borderBlack,
    this.isFullWidth = true,
    this.isLoading = false,
  });

  @override
  State<NeubrutalistButton> createState() => _NeubrutalistButtonState();
}

class _NeubrutalistButtonState extends State<NeubrutalistButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final effectiveShadow = _isPressed ? Offset.zero : Neubrutalism.shadowOffset;
    final transformOffset = _isPressed ? const Offset(2, 2) : Offset.zero;

    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
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
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          decoration: Neubrutalism.boxDecoration(
            color: widget.backgroundColor,
            shadow: effectiveShadow,
          ),
          child: Row(
            mainAxisSize: widget.isFullWidth ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.isLoading) ...[
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(widget.textColor),
                  ),
                ),
                const SizedBox(width: 10),
              ] else if (widget.icon != null) ...[
                Icon(widget.icon, color: widget.textColor, size: 18),
                const SizedBox(width: 8),
              ],
              Text(
                widget.label,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 14,
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
