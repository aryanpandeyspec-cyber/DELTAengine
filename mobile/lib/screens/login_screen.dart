import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/models.dart';
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

  final List<Map<String, dynamic>> _rolePresets = [
    {
      'id': 'COORDINATOR',
      'label': 'COORDINATOR',
      'title': 'Lead Ops',
      'name': 'Suryansh',
      'email': 'coordinator@delta-engine.in',
      'pass': 'delta2026',
      'icon': Icons.alt_route,
      'color': DeltaColors.skyAqua,
      'tag': 'OPS LEAD',
    },
    {
      'id': 'ADMIN',
      'label': 'COMMANDER',
      'title': 'Systems Admin',
      'name': 'Aryan Pandey',
      'email': 'aryan.pandey777hyd@gmail.com',
      'pass': 'deltaAdmin2026!',
      'icon': Icons.admin_panel_settings,
      'color': DeltaColors.mustard,
      'tag': 'SUPER ADMIN',
    },
    {
      'id': 'SAFETY',
      'label': 'SAFETY DIR',
      'title': 'NFPA Marshal',
      'name': 'Safety Officer',
      'email': 'safety@delta-engine.in',
      'pass': 'delta2026',
      'icon': Icons.local_police,
      'color': DeltaColors.coralRed,
      'tag': 'FIRE MARSHAL',
    },
    {
      'id': 'AV_LEAD',
      'label': 'AV / GATES',
      'title': 'Mesh & Audio',
      'name': 'Shahid',
      'email': 'shahid@delta-engine.in',
      'pass': 'delta2026',
      'icon': Icons.headset_mic,
      'color': DeltaColors.neonCyan,
      'tag': 'FIELD DESK',
    },
  ];

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
    HapticFeedback.mediumImpact();
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

  void _handleInstantDemoBypass() {
    HapticFeedback.heavyImpact();
    // Connect WebSocket if possible
    WebSocketService().connect();

    final activePreset = _rolePresets.firstWhere(
      (r) => r['id'] == _selectedRole,
      orElse: () => _rolePresets[0],
    );

    final demoSession = OperatorSession(
      id: 'demo-operator-777',
      name: activePreset['name'] as String,
      email: _emailController.text.isNotEmpty ? _emailController.text : activePreset['email'] as String,
      role: _selectedRole.toLowerCase(),
      token: 'jwt-delta-demo-instant-pass',
    );

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => CockpitScreen(session: demoSession),
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
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Colors.black, width: 2.8),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: DeltaColors.yaleBlue,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.black, width: 2),
              ),
              child: const Icon(Icons.dns, color: DeltaColors.mustard, size: 20),
            ),
            const SizedBox(width: 10),
            Text(
              'NETWORK BACKEND',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w900,
                color: DeltaColors.mustard,
                fontSize: 17,
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
                fillColor: DeltaColors.surfaceLight,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Colors.black, width: 2),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Fast Presets:',
              style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white70),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _buildHostPresetChip('Localhost (3000)', 'http://localhost:3000', hostController),
                _buildHostPresetChip('Android Emulator', 'http://10.0.2.2:3000', hostController),
                _buildHostPresetChip('Production Cloud', 'https://deltaengine.vercel.app', hostController),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('CANCEL', style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted, fontWeight: FontWeight.bold)),
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
            child: Text('SAVE & REBIND', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }

  Widget _buildHostPresetChip(String label, String url, TextEditingController controller) {
    return ActionChip(
      backgroundColor: DeltaColors.surfaceLight,
      label: Text(label, style: const TextStyle(fontSize: 11, color: DeltaColors.skyAqua, fontWeight: FontWeight.bold)),
      side: const BorderSide(color: Colors.black, width: 1.5),
      onPressed: () {
        controller.text = url;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: DeltaColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Official DELTA Engine Brand Emblem
                  Center(
                    child: Container(
                      width: 84,
                      height: 84,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: Colors.black, width: 2.8),
                        boxShadow: const [
                          BoxShadow(
                            color: DeltaColors.neonCyan,
                            blurRadius: 18,
                            spreadRadius: 1,
                          ),
                          BoxShadow(
                            color: Colors.black,
                            offset: Offset(4, 4),
                            blurRadius: 0,
                          ),
                        ],
                      ),
                      child: Image.asset(
                        'assets/images/delta_emblem.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // App Badge / Brand Header with animated live tag
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
                          const SizedBox(width: 8),
                          Text(
                            'SUPABASE AUTH • ENTERPRISE OS',
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
                  const SizedBox(height: 16),

                  // Title with Neubrutalist drop shadow style
                  Text(
                    'DELTA ENGINE',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 38,
                      fontWeight: FontWeight.w900,
                      height: 1.05,
                      color: DeltaColors.textLight,
                      letterSpacing: -1.0,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: DeltaColors.mustard,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.black, width: 2),
                          boxShadow: const [
                            BoxShadow(color: Colors.black, offset: Offset(2, 2), blurRadius: 0),
                          ],
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
                  const SizedBox(height: 22),

                  // Role Profile Selector
                  Text(
                    'SELECT OPERATOR PROFILE:',
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: DeltaColors.mustard,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 2.2,
                    ),
                    itemCount: _rolePresets.length,
                    itemBuilder: (context, idx) {
                      final role = _rolePresets[idx];
                      final isSelected = _selectedRole == role['id'];
                      final color = role['color'] as Color;

                      return GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() {
                            _selectedRole = role['id'] as String;
                            _emailController.text = role['email'] as String;
                            _passwordController.text = role['pass'] as String;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? color.withValues(alpha: 0.18) : DeltaColors.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected ? color : Colors.black,
                              width: isSelected ? 2.6 : 2.0,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: isSelected ? color.withValues(alpha: 0.6) : Colors.black,
                                offset: isSelected ? const Offset(2.5, 2.5) : const Offset(2, 2),
                                blurRadius: isSelected ? 3 : 0,
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: isSelected ? color : DeltaColors.surfaceLight,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.black, width: 1.5),
                                ),
                                child: Icon(
                                  role['icon'] as IconData,
                                  size: 16,
                                  color: isSelected ? Colors.black : Colors.white70,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      role['name'] as String,
                                      style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: isSelected ? Colors.white : DeltaColors.textLight,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    Text(
                                      role['tag'] as String,
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w900,
                                        color: isSelected ? color : DeltaColors.textMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 18),

                  // Neubrutalist Login Card
                  NeubrutalistCard(
                    backgroundColor: DeltaColors.surface,
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.shield_outlined, color: DeltaColors.mustard, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'OPERATOR AUTH',
                                  style: GoogleFonts.outfit(
                                    fontSize: 17,
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
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.error_outline, color: DeltaColors.dangerRed, size: 18),
                                    const SizedBox(width: 8),
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
                                if (_errorMessage!.contains('reach') || _errorMessage!.contains('timed out') || _errorMessage!.contains('Socket') || _errorMessage!.contains('connect')) ...[
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton(
                                          style: OutlinedButton.styleFrom(
                                            side: const BorderSide(color: DeltaColors.mustard, width: 1.5),
                                            padding: const EdgeInsets.symmetric(vertical: 4),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                          ),
                                          onPressed: _showHostConfigDialog,
                                          child: Text('⚙️ EDIT HOST IP', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.mustard)),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: ElevatedButton(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: DeltaColors.neonCyan,
                                            foregroundColor: Colors.black,
                                            padding: const EdgeInsets.symmetric(vertical: 4),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                          ),
                                          onPressed: _handleInstantDemoBypass,
                                          child: Text('⚡ DEMO BYPASS', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.w900)),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
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
                        const SizedBox(height: 20),

                        // Primary Login Button
                        NeubrutalistButton(
                          label: 'INITIALIZE COCKPIT',
                          icon: Icons.rocket_launch,
                          backgroundColor: DeltaColors.mustard,
                          textColor: Colors.black,
                          height: 50,
                          fontSize: 14,
                          isLoading: _isLoading,
                          onPressed: _handleLogin,
                        ),

                        const SizedBox(height: 10),

                        // One-Tap Instant Demo Bypass Button
                        GestureDetector(
                          onTap: _handleInstantDemoBypass,
                          child: Container(
                            width: double.infinity,
                            height: 44,
                            decoration: BoxDecoration(
                              color: DeltaColors.surfaceLight,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: DeltaColors.neonCyan, width: 1.8),
                              boxShadow: const [
                                BoxShadow(color: Colors.black, offset: Offset(2, 2), blurRadius: 0),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.flash_on, color: DeltaColors.neonCyan, size: 16),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    '⚡ 1-TAP DEMO BYPASS',
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w900,
                                      color: DeltaColors.neonCyan,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),

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
}
