import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../theme/neubrutalism.dart';
import 'cockpit_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController(text: 'coordinator@delta-engine.in');
  final _passwordController = TextEditingController(text: 'delta2026');
  final _api = ApiService();

  bool _isLoading = false;
  String? _errorMessage;
  String _selectedRole = 'COORDINATOR';

  late AnimationController _badgeAnimController;

  @override
  void initState() {
    super.initState();
    _badgeAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _badgeAnimController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final session = await _api.login(
        email: _emailController.text,
        password: _passwordController.text,
        role: _selectedRole,
      );

      // Connect real-time WebSocket on successful authentication
      WebSocketService().connect();

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => CockpitScreen(session: session),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showHostConfigDialog() {
    final hostController = TextEditingController(text: _api.baseUrl);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: DeltaColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Colors.black, width: 2.5),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: DeltaColors.yaleBlue,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.black, width: 1.5),
              ),
              child: const Icon(Icons.dns, color: DeltaColors.mustard, size: 18),
            ),
            const SizedBox(width: 10),
            Text(
              'NETWORK BACKEND',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w900,
                color: DeltaColors.mustard,
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
              'DELTA Engine Backend Base URL:',
              style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: hostController,
              style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: DeltaColors.surfaceLight,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Colors.black, width: 2),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              children: [
                _buildHostPresetChip('Localhost (3000)', 'http://localhost:3000', hostController),
                _buildHostPresetChip('Android Emulator', 'http://10.0.2.2:3000', hostController),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('CANCEL', style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.skyAqua,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: Colors.black, width: 2),
              ),
            ),
            onPressed: () async {
              final nav = Navigator.of(ctx);
              await _api.setBaseUrl(hostController.text);
              if (mounted) setState(() {});
              nav.pop();
            },
            child: Text('SAVE HOST', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildHostPresetChip(String label, String url, TextEditingController controller) {
    return ActionChip(
      backgroundColor: DeltaColors.surfaceLight,
      label: Text(label, style: const TextStyle(fontSize: 11, color: DeltaColors.skyAqua)),
      side: const BorderSide(color: Colors.black, width: 1.5),
      onPressed: () {
        controller.text = url;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Badge / Brand Header with animated pulsing live tag
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: Neubrutalism.boxDecoration(
                        color: DeltaColors.yaleBlue,
                        radius: 20,
                        shadow: const Offset(3, 3),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const PulsingDot(color: DeltaColors.neonCyan, size: 7),
                          const SizedBox(width: 6),
                          Text(
                            'SUPABASE AUTH • v3.6',
                            style: GoogleFonts.spaceGrotesk(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 10,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Title with Neubrutalist drop shadow style
                  Text(
                    'DELTA ENGINE',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      height: 1.05,
                      color: DeltaColors.textLight,
                      letterSpacing: -1.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: DeltaColors.mustard,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: Colors.black, width: 1.5),
                        ),
                        child: Text(
                          'MOBILE COORDINATOR OS',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: Colors.black,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Real-time crowd telemetry, incident dispatch & mesh communications',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 12,
                      color: DeltaColors.textMuted,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Neubrutalist Login Card
                  NeubrutalistCard(
                    backgroundColor: DeltaColors.surface,
                    padding: const EdgeInsets.all(22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.shield_outlined, color: DeltaColors.mustard, size: 18),
                                const SizedBox(width: 6),
                                Text(
                                  'OPERATOR AUTH',
                                  style: GoogleFonts.outfit(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w900,
                                    color: DeltaColors.mustard,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                            InkWell(
                              onTap: _showHostConfigDialog,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: DeltaColors.surfaceLight,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black, width: 1.8),
                                  boxShadow: const [
                                    BoxShadow(color: Colors.black, offset: Offset(1.5, 1.5), blurRadius: 0),
                                  ],
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.settings, size: 12, color: DeltaColors.skyAqua),
                                    const SizedBox(width: 4),
                                    Text(
                                      'HOST',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: DeltaColors.skyAqua,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        if (_errorMessage != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: DeltaColors.dangerRed.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: DeltaColors.dangerRed, width: 2),
                              boxShadow: const [
                                BoxShadow(color: Colors.black, offset: Offset(2, 2), blurRadius: 0),
                              ],
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline, color: DeltaColors.dangerRed, size: 18),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: GoogleFonts.spaceGrotesk(
                                      color: Colors.redAccent,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],

                        // Email Field
                        Text(
                          'OPERATOR IDENTITY / EMAIL',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: DeltaColors.textLight,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _emailController,
                          style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 13),
                          decoration: InputDecoration(
                            filled: true,
                            fillColor: DeltaColors.surfaceLight,
                            hintText: 'coordinator@delta-engine.in',
                            prefixIcon: const Icon(Icons.badge_outlined, color: DeltaColors.skyAqua, size: 18),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Colors.black, width: 2),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Colors.black, width: 2),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: DeltaColors.skyAqua, width: 2.5),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Password Field
                        Text(
                          'SECURITY PASSKEY',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: DeltaColors.textLight,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _passwordController,
                          obscureText: true,
                          style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 13),
                          decoration: InputDecoration(
                            filled: true,
                            fillColor: DeltaColors.surfaceLight,
                            hintText: '••••••••',
                            prefixIcon: const Icon(Icons.lock_outline, color: DeltaColors.skyAqua, size: 18),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Colors.black, width: 2),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Colors.black, width: 2),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: DeltaColors.skyAqua, width: 2.5),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),

                        // Role Selector Tabs
                        Text(
                          'SELECT ACTIVE DUTY ROLE:',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: DeltaColors.mustard,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: _buildRolePresetBtn('COORDINATOR', 'coordinator@delta-engine.in', Icons.alt_route),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildRolePresetBtn('ADMIN', 'admin@delta-engine.in', Icons.admin_panel_settings),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildRolePresetBtn('SAFETY', 'safety@delta-engine.in', Icons.local_police),
                            ),
                          ],
                        ),
                        const SizedBox(height: 22),

                        // Login Action Button
                        NeubrutalistButton(
                          label: 'INITIALIZE COCKPIT',
                          icon: Icons.rocket_launch,
                          backgroundColor: DeltaColors.mustard,
                          textColor: Colors.black,
                          height: 52,
                          fontSize: 14,
                          isLoading: _isLoading,
                          onPressed: _handleLogin,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Live Connection Status Footer
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const PulsingDot(color: DeltaColors.successGreen, size: 8),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Target Engine: ${_api.baseUrl}',
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 11,
                            color: DeltaColors.textMuted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRolePresetBtn(String label, String email, IconData icon) {
    final isSelected = _selectedRole == label;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedRole = label;
          _emailController.text = email;
          _passwordController.text = 'delta2026';
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? DeltaColors.skyAqua : DeltaColors.surfaceLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.black, width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black,
              offset: isSelected ? const Offset(2, 2) : const Offset(1.5, 1.5),
              blurRadius: 0,
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? Colors.black : DeltaColors.textMuted,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: GoogleFonts.spaceGrotesk(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: isSelected ? Colors.black : DeltaColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
