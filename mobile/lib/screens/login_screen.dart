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

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController(text: 'coordinator@delta-engine.in');
  final _passwordController = TextEditingController(text: 'delta2026');
  final _api = ApiService();

  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
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
        title: Text(
          'SERVER CONFIGURATION',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w900,
            color: DeltaColors.mustard,
            fontSize: 18,
          ),
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
                borderRadius: BorderRadius.circular(6),
                side: const BorderSide(color: Colors.black, width: 1.8),
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
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Badge / Brand Header
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: Neubrutalism.boxDecoration(
                        color: DeltaColors.yaleBlue,
                        radius: 8,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.bolt, color: DeltaColors.mustard, size: 16),
                          const SizedBox(width: 6),
                          Text(
                            'DELTA ENGINE OS v3.6',
                            style: GoogleFonts.spaceGrotesk(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 12,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Title
                  Text(
                    'MOBILE\nCOORDINATOR',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 34,
                      fontWeight: FontWeight.w900,
                      height: 1.05,
                      color: DeltaColors.textLight,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Enterprise Crowd Safety & Event Orchestration',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 13,
                      color: DeltaColors.textMuted,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 28),

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
                            Text(
                              'OPERATOR AUTH',
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                color: DeltaColors.mustard,
                                letterSpacing: 0.5,
                              ),
                            ),
                            InkWell(
                              onTap: _showHostConfigDialog,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: DeltaColors.surfaceLight,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black, width: 1.5),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.settings, size: 12, color: DeltaColors.skyAqua),
                                    const SizedBox(width: 4),
                                    Text(
                                      'HOST',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
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
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: DeltaColors.dangerRed.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: DeltaColors.dangerRed, width: 1.5),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline, color: DeltaColors.dangerRed, size: 16),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: GoogleFonts.spaceGrotesk(
                                      color: Colors.redAccent,
                                      fontSize: 12,
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
                          style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 14),
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
                          style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 14),
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
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Quick Role Switchers
                        Row(
                          children: [
                            Expanded(
                              child: _buildRolePresetBtn('COORDINATOR', 'coordinator@delta-engine.in'),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildRolePresetBtn('ADMIN', 'admin@delta-engine.in'),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildRolePresetBtn('SAFETY', 'safety@delta-engine.in'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // Login Action Button
                        NeubrutalistButton(
                          label: 'INITIALIZE COCKPIT',
                          icon: Icons.login,
                          backgroundColor: DeltaColors.mustard,
                          textColor: Colors.black,
                          isLoading: _isLoading,
                          onPressed: _handleLogin,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Live Connection Status Footer
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: DeltaColors.successGreen,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Target Server: ${_api.baseUrl}',
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 11,
                            color: DeltaColors.textMuted,
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

  Widget _buildRolePresetBtn(String label, String email) {
    final isSelected = _emailController.text == email;
    return GestureDetector(
      onTap: () {
        setState(() {
          _emailController.text = email;
          _passwordController.text = 'delta2026';
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? DeltaColors.skyAqua : DeltaColors.surfaceLight,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.black, width: 1.5),
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.spaceGrotesk(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: isSelected ? Colors.black : DeltaColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}
