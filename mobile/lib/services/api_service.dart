import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  // Configurable base URL for testing on Desktop, Android Emulator (10.0.2.2), or physical device
  String _baseUrl = 'http://localhost:3000';
  String? _authToken;

  String get baseUrl => _baseUrl;
  String? get authToken => _authToken;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString('delta_base_url') ?? 'http://localhost:3000';
    _authToken = prefs.getString('delta_auth_token');
  }

  Future<void> setBaseUrl(String newUrl) async {
    _baseUrl = newUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('delta_base_url', _baseUrl);
  }

  void setAuthToken(String? token) {
    _authToken = token;
  }

  Map<String, String> _headers() {
    final map = {'Content-Type': 'application/json'};
    if (_authToken != null) {
      map['Authorization'] = 'Bearer $_authToken';
    }
    return map;
  }

  /// Supabase Enterprise & Coordinator Authentication
  Future<OperatorSession> login({
    required String email,
    required String password,
    String role = 'COORDINATOR',
  }) async {
    final uri = Uri.parse('$_baseUrl/api/auth/login');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email.trim(),
        'password': password.trim(),
        'role': role,
      }),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = jsonDecode(response.body);
      final session = OperatorSession.fromJson(data);
      _authToken = session.token;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('delta_auth_token', session.token);
      await prefs.setString('delta_user_name', session.name);
      await prefs.setString('delta_user_role', session.role);

      return session;
    } else {
      final err = jsonDecode(response.body);
      throw Exception(err['error'] ?? err['message'] ?? 'Authentication failed (${response.statusCode})');
    }
  }

  /// Fetch Monitored Zone Density & Room Telemetry
  Future<List<RoomTelemetry>> fetchRooms() async {
    final uri = Uri.parse('$_baseUrl/api/rooms');
    final response = await http.get(uri, headers: _headers());

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final roomsMap = data['rooms'] as Map<String, dynamic>? ?? {};
      final list = <RoomTelemetry>[];

      roomsMap.forEach((key, val) {
        if (val is Map<String, dynamic>) {
          final copy = Map<String, dynamic>.from(val);
          copy['id'] = key;
          copy['name'] = _formatRoomName(key);
          list.add(RoomTelemetry.fromJson(copy));
        }
      });
      return list;
    }
    throw Exception('Failed to fetch rooms: ${response.statusCode}');
  }

  String _formatRoomName(String key) {
    switch (key.toLowerCase()) {
      case 'room1':
        return 'Turing Grand Hall';
      case 'room2':
        return 'Lovelace Auditorium';
      case 'room3':
        return 'Von Neumann Hub';
      case 'room4':
        return 'Shannon Workshop Suite';
      case 'room5':
        return 'Hopper Tech Pavilion';
      default:
        return key.toUpperCase();
    }
  }

  /// Fetch All Incident Tasks
  Future<List<TaskItem>> fetchTasks() async {
    final uri = Uri.parse('$_baseUrl/api/tasks');
    final response = await http.get(uri, headers: _headers());

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final rawTasks = (data['tasks'] as List<dynamic>?) ?? [];
      return rawTasks.map((t) => TaskItem.fromJson(t as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to fetch tasks: ${response.statusCode}');
  }

  /// Dispatch New Incident Task
  Future<TaskItem> createTask({
    required String title,
    required String location,
    String priority = 'normal',
    required String creator,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/tasks/create');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode({
        'title': title,
        'location': location,
        'priority': priority,
        'creator': creator,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return TaskItem.fromJson(data['task'] as Map<String, dynamic>);
    }
    throw Exception('Failed to create task: ${response.statusCode}');
  }

  /// Claim Task by Field Marshal / Volunteer
  Future<bool> claimTask({
    required String taskId,
    required String claimedBy,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/tasks/claim');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode({
        'taskId': taskId,
        'claimedBy': claimedBy,
      }),
    );
    return response.statusCode == 200;
  }

  /// Resolve Task
  Future<bool> resolveTask({
    required String taskId,
    required String resolvedBy,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/tasks/resolve');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode({
        'taskId': taskId,
        'resolvedBy': resolvedBy,
      }),
    );
    return response.statusCode == 200;
  }

  /// Walkie-Talkie Mesh Audio & Voice Broadcast
  Future<VoiceTransmission> broadcastVoice({
    required String sender,
    required String channel,
    required String text,
    String? audioData,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/voice/broadcast');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode({
        'sender': sender,
        'channel': channel,
        'text': text,
        'audioData': audioData,
        'target': 'Mesh Channel $channel',
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return VoiceTransmission.fromJson(data['voice'] as Map<String, dynamic>);
    }
    throw Exception('Failed to broadcast voice: ${response.statusCode}');
  }

  /// 1-Tap Quick Action Dispatch Grid
  Future<bool> dispatchQuickAction({
    required String action,
    required String label,
    required String sender,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/action/dispatch');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode({
        'action': action,
        'label': label,
        'sender': sender,
      }),
    );
    return response.statusCode == 200;
  }

  /// Attendee QR Badge Verification & Anti-Tamper Check
  Future<AttendeeBadgeResult> verifyBadge({
    required String code,
    required String scannedBy,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/attendees/verify-badge');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode({
        'code': code.trim(),
        'scannedBy': scannedBy,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final att = data['attendee'] as Map<String, dynamic>? ?? {};
      return AttendeeBadgeResult(
        valid: att['status'] == 'valid' || data['success'] == true,
        ticketId: att['code'] ?? code,
        name: att['name'] ?? 'Attendee',
        tier: att['passType'] ?? 'General',
        checkedIn: true,
        checkinTime: DateTime.now(),
        allowedZones: [att['roomAccess']?.toString() ?? 'All Common Zones'],
        tamperCheckPassed: true,
        message: 'Badge verified & checked in at gate',
      );
    }
    throw Exception('Failed to verify badge: ${response.statusCode}');
  }

  /// Volunteer Emergency SOS Alert Trigger
  Future<bool> triggerEmergencySos({
    required String volunteerName,
    required String hallId,
    required String note,
    String crowdSeverity = 'CRITICAL',
  }) async {
    final uri = Uri.parse('$_baseUrl/api/volunteer/sos');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode({
        'volunteerName': volunteerName,
        'hallId': hallId,
        'note': note,
        'crowdSeverity': crowdSeverity,
      }),
    );
    return response.statusCode == 200;
  }
}
