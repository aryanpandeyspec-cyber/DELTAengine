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
  final _nameController = TextEditingController(text: 'Aryan Pandey');
  final _emailController = TextEditingController(text: 'aryan.pandey777hyd@gmail.com');
  final _passwordController = TextEditingController(text: 'deltaAdmin2026!');
  final _api = ApiService();

  bool _isLoading = false;
  bool _isRestoringSession = false;
  bool _rememberMe = true;
  String? _errorMessage;
  String _selectedRole = 'ADMIN';

  late AnimationController _badgeAnimController;
  List<DynamicOperatorProfile> _dynamicOperators = [];

  final List<Map<String, dynamic>> _rolePresets = [
    {
      'id': 'ADMIN',
      'label': 'COMMANDER',
      'title': 'Super Admin',
      'name': 'Aryan Pandey',
      'email': 'aryan.pandey777hyd@gmail.com',
      'pass': 'deltaAdmin2026!',
      'icon': Icons.admin_panel_settings,
      'color': DeltaColors.mustard,
      'tag': 'SUPER ADMIN',
      'desc': 'Full authority, remote volunteer revocation & security audits',
    },
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
      'desc': 'Chokepoint steering, gate balancing & mesh communications',
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
      'desc': 'NFPA egress clearance, CO2 & crowd density safety thresholds',
    },
    {
      'id': 'VOLUNTEER',
      'label': 'VOLUNTEER',
      'title': 'Field Marshal',
      'name': 'Shahid',
      'email': 'volunteer@delta-engine.in',
      'pass': 'delta2026',
      'icon': Icons.how_to_reg,
      'color': DeltaColors.neonCyan,
      'tag': 'FIELD DESK',
      'desc': 'Turnstile headcounts, badge validation & incident pickup',
    },
  ];

  @override
  void initState() {
    super.initState();
    _badgeAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _checkAutoLogin();
    _loadDynamicOperators();
  }

  Future<void> _checkAutoLogin() async {
    try {
      final session = await _api.restoreSessionFromStorage();
      if (session != null && !session.isExpired) {
        final isValid = await _api.validateSession().timeout(
          const Duration(milliseconds: 600),
          onTimeout: () => true, // Allow offline entry if session is active
        );
        if (isValid && mounted) {
          WebSocketService().connect();
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => CockpitScreen(session: session),
            ),
          );
          return;
        }
      }
    } catch (_) {}

    if (mounted) {
      setState(() => _isRestoringSession = false);
    }
  }

  Future<void> _loadDynamicOperators() async {
    try {
      final list = await _api.fetchDynamicOperators();
      if (mounted && list.isNotEmpty) {
        setState(() => _dynamicOperators = list);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _nameController.dispose();
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
        rememberMe: _rememberMe,
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
    WebSocketService().connect();

    final activePreset = _rolePresets.firstWhere(
      (r) => r['id'] == _selectedRole,
      orElse: () => _rolePresets[0],
    );

    final demoSession = OperatorSession(
      id: 'demo-${DateTime.now().millisecondsSinceEpoch % 10000}',
      name: _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : activePreset['name'] as String,
      email: _emailController.text.trim().isNotEmpty ? _emailController.text.trim() : activePreset['email'] as String,
      role: _selectedRole.toLowerCase(),
      token: 'jwt-delta-demo-instant-pass',
      sessionId: 'sess-demo-${DateTime.now().millisecondsSinceEpoch}',
      expiresAt: DateTime.now().add(const Duration(hours: 3)),
      rememberMe: _rememberMe,
    );

    if (_rememberMe) {
      _api.saveSessionToStorage(demoSession);
    }

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
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: DeltaColors.surfaceLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: DeltaColors.cardBorder, width: 1.0),
              ),
              child: const Icon(Icons.dns_outlined, color: DeltaColors.skyAqua, size: 20),
            ),
            const SizedBox(width: 10),
            Text(
              'NETWORK BACKEND',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w800,
                color: Colors.white,
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
              'DELTA Engine Host Address:',
              style: GoogleFonts.spaceGrotesk(fontSize: 12, color: DeltaColors.textMuted),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: hostController,
              style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: DeltaColors.background,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: DeltaColors.skyAqua, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Quick Rebind Presets:',
              style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.bold, color: DeltaColors.textMuted),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _buildHostPresetChip('Wi-Fi Host (192.168.1.6)', 'http://192.168.1.6:3000', hostController),
                _buildHostPresetChip('Wi-Fi PC (3000)', 'http://192.168.1.2:3000', hostController),
                _buildHostPresetChip('Wi-Fi LAN (3000)', 'http://192.168.1.4:3000', hostController),
                _buildHostPresetChip('Hotspot (3000)', 'http://192.168.137.1:3000', hostController),
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
            child: Text(
              'CANCEL',
              style: GoogleFonts.spaceGrotesk(color: DeltaColors.textMuted, fontWeight: FontWeight.bold),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: DeltaColors.skyAqua,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onPressed: () async {
              final nav = Navigator.of(ctx);
              await _api.setBaseUrl(hostController.text);
              if (mounted) setState(() {});
              nav.pop();
            },
            child: Text(
              'SAVE & REBIND',
              style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w800, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHostPresetChip(String label, String url, TextEditingController controller) {
    return ActionChip(
      backgroundColor: DeltaColors.surfaceLight,
      label: Text(label, style: const TextStyle(fontSize: 11, color: DeltaColors.skyAqua, fontWeight: FontWeight.bold)),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: DeltaColors.cardBorder, width: 1.0),
      ),
      onPressed: () {
        controller.text = url;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isRestoringSession) {
      return Scaffold(
        backgroundColor: DeltaColors.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: const Color(0xFF0F1523),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF222F47), width: 1.0),
                boxShadow: [
                  BoxShadow(
                    color: DeltaColors.skyAqua.withValues(alpha: 0.18),
                    blurRadius: 30,
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const PulsingDot(color: DeltaColors.skyAqua, size: 14),
                  const SizedBox(height: 18),
                  Text(
                    'RESTORING VERIFIED EVENT SESSION',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Validating 4-Hour active event token with DELTA Security Gateway...',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 11.5,
                      color: DeltaColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 22),
                  const SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation<Color>(DeltaColors.skyAqua),
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextButton(
                    onPressed: () => setState(() => _isRestoringSession = false),
                    child: Text(
                      'LOG IN AS DIFFERENT IDENTITY',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 11,
                        color: DeltaColors.skyAqua,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: DeltaColors.background,
      body: Stack(
        children: [
          // Ambient backlight bloom (Linear / Obsidian subtle lighting)
          Positioned(
            top: -120,
            left: MediaQuery.of(context).size.width / 2 - 160,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF00E5FF).withValues(alpha: 0.12),
                    const Color(0xFF3B82F6).withValues(alpha: 0.05),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 18),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Luxury Frosted Titanium Squircle for DELTA Engine Emblem
                      Center(
                        child: Container(
                          width: 86,
                          height: 86,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF1E283E), Color(0xFF101625)],
                            ),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: const Color(0xFF38BDF8).withValues(alpha: 0.35),
                              width: 1.2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF00E5FF).withValues(alpha: 0.22),
                                blurRadius: 28,
                                spreadRadius: 1,
                              ),
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.5),
                                offset: const Offset(0, 8),
                                blurRadius: 20,
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

                      // Refined Enterprise Chip with live telemetry pip
                      Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(0xFF121B2C),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: const Color(0xFF23324C),
                              width: 1.0,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const PulsingDot(color: DeltaColors.neonCyan, size: 6.5),
                              const SizedBox(width: 8),
                              Text(
                                'SUPABASE AUTH • ENTERPRISE OS',
                                style: GoogleFonts.spaceGrotesk(
                                  color: const Color(0xFFCBD5E1),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 10,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Brand Header
                      Text(
                        'DELTA ENGINE',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(
                          fontSize: 34,
                          fontWeight: FontWeight.w900,
                          height: 1.05,
                          color: Colors.white,
                          letterSpacing: -0.6,
                        ),
                      ),
                      const SizedBox(height: 6),

                      // Sub-badge: MOBILE COORDINATOR OS (Required by widget test!)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF131F33),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: DeltaColors.skyAqua.withValues(alpha: 0.4),
                                width: 1.0,
                              ),
                            ),
                            child: Text(
                              'MOBILE COORDINATOR OS',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: DeltaColors.skyAqua,
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
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Command & Authority Hierarchy
                      Row(
                        children: [
                          Container(
                            width: 3,
                            height: 12,
                            decoration: BoxDecoration(
                              color: DeltaColors.mustard,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'COMMAND & AUTHORITY HIERARCHY',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              color: DeltaColors.textMuted,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
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
                                _nameController.text = role['name'] as String;
                                _emailController.text = role['email'] as String;
                                _passwordController.text = role['pass'] as String;
                              });
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              curve: Curves.easeOutCubic,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? const Color(0xFF162238)
                                    : const Color(0xFF0F1523),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected
                                      ? color
                                      : const Color(0xFF1E283D),
                                  width: isSelected ? 1.4 : 1.0,
                                ),
                                boxShadow: isSelected
                                    ? [
                                        BoxShadow(
                                          color: color.withValues(alpha: 0.22),
                                          blurRadius: 12,
                                          offset: const Offset(0, 2),
                                        ),
                                      ]
                                    : null,
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? color.withValues(alpha: 0.18)
                                          : const Color(0xFF161F33),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      role['icon'] as IconData,
                                      size: 16,
                                      color: isSelected ? color : DeltaColors.textMuted,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          role['title'] as String,
                                          style: GoogleFonts.outfit(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: isSelected ? Colors.white : const Color(0xFFE2E8F0),
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Row(
                                          children: [
                                            if (isSelected) ...[
                                              Container(
                                                width: 5,
                                                height: 5,
                                                decoration: BoxDecoration(
                                                  shape: BoxShape.circle,
                                                  color: color,
                                                ),
                                              ),
                                              const SizedBox(width: 4),
                                            ],
                                            Flexible(
                                              child: Text(
                                                role['tag'] as String,
                                                style: GoogleFonts.spaceGrotesk(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w800,
                                                  color: isSelected ? color : DeltaColors.textDim,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
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
                      const SizedBox(height: 14),

                      // Dynamic Personnel Selector Strip
                      if (_dynamicOperators.isNotEmpty) ...[
                        Row(
                          children: [
                            Container(
                              width: 3,
                              height: 12,
                              decoration: BoxDecoration(
                                color: DeltaColors.neonCyan,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'LIVE EVENT PERSONNEL ROSTER',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: DeltaColors.textMuted,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          physics: const BouncingScrollPhysics(),
                          child: Row(
                            children: _dynamicOperators.map((op) {
                              final isCurrent = _emailController.text == op.email;
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ActionChip(
                                  backgroundColor: isCurrent ? const Color(0xFF16253D) : const Color(0xFF0F1523),
                                  side: BorderSide(
                                    color: isCurrent ? DeltaColors.neonCyan : const Color(0xFF1E283D),
                                    width: 1.0,
                                  ),
                                  avatar: CircleAvatar(
                                    radius: 10,
                                    backgroundColor: DeltaColors.surfaceLight,
                                    child: Text(
                                      op.name.isNotEmpty ? op.name[0].toUpperCase() : '?',
                                      style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  label: Text(
                                    '${op.name} (${op.role})',
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 11,
                                      fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                      color: isCurrent ? Colors.white : DeltaColors.textMuted,
                                    ),
                                  ),
                                  onPressed: () {
                                    HapticFeedback.selectionClick();
                                    setState(() {
                                      _nameController.text = op.name;
                                      _emailController.text = op.email;
                                      _selectedRole = op.role;
                                    });
                                  },
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Refined Obsidian Auth Card (Contains required OPERATOR AUTH header)
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F1523),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: const Color(0xFF222F47),
                            width: 1.0,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.35),
                              offset: const Offset(0, 8),
                              blurRadius: 24,
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.shield_outlined, color: DeltaColors.skyAqua, size: 18),
                                    const SizedBox(width: 8),
                                    Text(
                                      'OPERATOR AUTH',
                                      style: GoogleFonts.outfit(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                                InkWell(
                                  borderRadius: BorderRadius.circular(8),
                                  onTap: _showHostConfigDialog,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF161F33),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: const Color(0xFF283652),
                                        width: 1.0,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.tune, size: 12, color: DeltaColors.skyAqua),
                                        const SizedBox(width: 4),
                                        Text(
                                          'HOST',
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
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
                                  color: DeltaColors.dangerRed.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: DeltaColors.dangerRed.withValues(alpha: 0.4), width: 1.0),
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
                                              color: const Color(0xFFFCA5A5),
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (_errorMessage!.contains('reach') || _errorMessage!.contains('timed out') || _errorMessage!.contains('Socket') || _errorMessage!.contains('connect')) ...[
                                      const SizedBox(height: 10),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: OutlinedButton(
                                              style: OutlinedButton.styleFrom(
                                                side: BorderSide(color: DeltaColors.mustard.withValues(alpha: 0.6), width: 1.0),
                                                padding: const EdgeInsets.symmetric(vertical: 6),
                                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
                                                padding: const EdgeInsets.symmetric(vertical: 6),
                                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                              ),
                                              onPressed: _handleInstantDemoBypass,
                                              child: Text('⚡ DEMO BYPASS', style: GoogleFonts.spaceGrotesk(fontSize: 11, fontWeight: FontWeight.w800)),
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

                            // Name Field
                            Text(
                              'OPERATOR NAME',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: DeltaColors.textMuted,
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _nameController,
                              style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 13),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFF0A0E17),
                                hintText: 'Enter your name',
                                hintStyle: GoogleFonts.spaceGrotesk(color: DeltaColors.textDim, fontSize: 13),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                prefixIcon: const Icon(Icons.person_outline, color: DeltaColors.skyAqua, size: 18),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFF1E283D), width: 1.0),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFF1E283D), width: 1.0),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: DeltaColors.skyAqua, width: 1.5),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),

                            // Email Field
                            Text(
                              'OPERATOR IDENTITY / EMAIL',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: DeltaColors.textMuted,
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _emailController,
                              style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 13),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFF0A0E17),
                                hintText: 'coordinator@delta-engine.in',
                                hintStyle: GoogleFonts.spaceGrotesk(color: DeltaColors.textDim, fontSize: 13),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                prefixIcon: const Icon(Icons.badge_outlined, color: DeltaColors.skyAqua, size: 18),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFF1E283D), width: 1.0),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFF1E283D), width: 1.0),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: DeltaColors.skyAqua, width: 1.5),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),

                            // Password Field
                            Text(
                              'SECURITY PASSKEY',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: DeltaColors.textMuted,
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _passwordController,
                              obscureText: true,
                              style: GoogleFonts.spaceGrotesk(color: Colors.white, fontSize: 13),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFF0A0E17),
                                hintText: '••••••••',
                                hintStyle: GoogleFonts.spaceGrotesk(color: DeltaColors.textDim, fontSize: 13),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                prefixIcon: const Icon(Icons.lock_outline, color: DeltaColors.skyAqua, size: 18),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFF1E283D), width: 1.0),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFF1E283D), width: 1.0),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: DeltaColors.skyAqua, width: 1.5),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),

                            // 4-Hour Event Window Remember Me Toggle
                            GestureDetector(
                              onTap: () {
                                HapticFeedback.selectionClick();
                                setState(() => _rememberMe = !_rememberMe);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                decoration: BoxDecoration(
                                  color: _rememberMe
                                      ? const Color(0xFF122238)
                                      : const Color(0xFF0A0E17),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _rememberMe
                                        ? DeltaColors.skyAqua.withValues(alpha: 0.55)
                                        : const Color(0xFF1E283D),
                                    width: 1.0,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 20,
                                      height: 20,
                                      decoration: BoxDecoration(
                                        color: _rememberMe ? DeltaColors.skyAqua : Colors.transparent,
                                        borderRadius: BorderRadius.circular(5),
                                        border: Border.all(
                                          color: _rememberMe ? DeltaColors.skyAqua : DeltaColors.textMuted,
                                          width: 1.5,
                                        ),
                                      ),
                                      child: _rememberMe
                                          ? const Icon(Icons.check, size: 15, color: Colors.black)
                                          : null,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Wrap(
                                            crossAxisAlignment: WrapCrossAlignment.center,
                                            spacing: 6,
                                            runSpacing: 2,
                                            children: [
                                              Text(
                                                'REMEMBER ME',
                                                style: GoogleFonts.spaceGrotesk(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w800,
                                                  color: Colors.white,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: DeltaColors.skyAqua.withValues(alpha: 0.2),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  '3-4 HOURS WINDOW',
                                                  style: GoogleFonts.spaceGrotesk(
                                                    fontSize: 8.5,
                                                    fontWeight: FontWeight.w800,
                                                    color: DeltaColors.skyAqua,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            'Stay logged in across restarts. Remotely revocable by Admin.',
                                            style: GoogleFonts.spaceGrotesk(
                                              fontSize: 9.5,
                                              color: DeltaColors.textMuted,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 18),

                            // Linear-Style Electric Action Button
                            GestureDetector(
                              onTap: _isLoading ? null : _handleLogin,
                              child: Container(
                                width: double.infinity,
                                height: 48,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: const Color(0xFF38BDF8).withValues(alpha: 0.5),
                                    width: 1.0,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF0284C7).withValues(alpha: 0.35),
                                      blurRadius: 16,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    if (_isLoading) ...[
                                      const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.0,
                                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                    ] else ...[
                                      const Icon(Icons.rocket_launch, color: Colors.white, size: 16),
                                      const SizedBox(width: 8),
                                    ],
                                    Text(
                                      'INITIALIZE COCKPIT',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                        letterSpacing: 0.6,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            const SizedBox(height: 10),

                            // One-Tap Instant Demo Bypass Button (Frosted Titanium Pill)
                            GestureDetector(
                              onTap: _handleInstantDemoBypass,
                              child: Container(
                                width: double.infinity,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF131D31),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: DeltaColors.neonCyan.withValues(alpha: 0.35),
                                    width: 1.0,
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.flash_on, color: DeltaColors.neonCyan, size: 15),
                                    const SizedBox(width: 6),
                                    Flexible(
                                      child: Text(
                                        '⚡ 1-TAP DEMO BYPASS',
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
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
                      const SizedBox(height: 16),

                      // Live Connection Status Footer
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const PulsingDot(color: DeltaColors.successGreen, size: 7),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              'Target Engine: ${_api.baseUrl}',
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 11,
                                color: DeltaColors.textDim,
                                fontWeight: FontWeight.w500,
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
        ],
      ),
    );
  }
}
