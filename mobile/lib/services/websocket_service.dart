import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/models.dart';
import 'api_service.dart';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  bool _isConnected = false;

  final StreamController<bool> _connectionStateController = StreamController<bool>.broadcast();
  final StreamController<TaskItem> _taskEventController = StreamController<TaskItem>.broadcast();
  final StreamController<List<RoomTelemetry>> _roomEventController = StreamController<List<RoomTelemetry>>.broadcast();
  final StreamController<VoiceTransmission> _voiceEventController = StreamController<VoiceTransmission>.broadcast();
  final StreamController<Map<String, dynamic>> _sosEventController = StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _badgeEventController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<bool> get isConnectedStream => _connectionStateController.stream;
  Stream<TaskItem> get onTaskEvent => _taskEventController.stream;
  Stream<List<RoomTelemetry>> get onRoomEvent => _roomEventController.stream;
  Stream<VoiceTransmission> get onVoiceEvent => _voiceEventController.stream;
  Stream<Map<String, dynamic>> get onSosEvent => _sosEventController.stream;
  Stream<Map<String, dynamic>> get onBadgeEvent => _badgeEventController.stream;
  int _reconnectAttempts = 0;
  bool get isConnected => _isConnected;

  void connect() {
    _reconnectTimer?.cancel();

    try {
      final base = ApiService().baseUrl;
      final wsUrl = base.replaceFirst('http://', 'ws://').replaceFirst('https://', 'wss://');
      final uri = Uri.parse('$wsUrl/ws');

      _channel = WebSocketChannel.connect(uri);
      _isConnected = true;
      _reconnectAttempts = 0;
      _connectionStateController.add(true);

      _subscription = _channel!.stream.listen(
        (message) {
          _isConnected = true;
          _reconnectAttempts = 0;
          _handleMessage(message);
        },
        onError: (err) {
          _isConnected = false;
          _connectionStateController.add(false);
          _scheduleReconnect();
        },
        onDone: () {
          _isConnected = false;
          _connectionStateController.add(false);
          _scheduleReconnect();
        },
      );
    } catch (e) {
      _isConnected = false;
      _connectionStateController.add(false);
      _scheduleReconnect();
    }
  }

  void _handleMessage(dynamic message) {
    try {
      final decoded = jsonDecode(message.toString());
      if (decoded is! Map<String, dynamic>) return;

      final type = decoded['type']?.toString();
      final data = decoded['data'];

      switch (type) {
        case 'TASK_CREATED':
        case 'TASK_UPDATED':
          if (data is Map<String, dynamic>) {
            _taskEventController.add(TaskItem.fromJson(data));
          }
          break;

        case 'ROOMS_UPDATE':
          if (data is Map<String, dynamic> && data['rooms'] is Map<String, dynamic>) {
            final roomsMap = data['rooms'] as Map<String, dynamic>;
            final list = <RoomTelemetry>[];
            roomsMap.forEach((k, v) {
              if (v is Map<String, dynamic>) {
                final copy = Map<String, dynamic>.from(v);
                copy['id'] = k;
                copy['name'] = k.toUpperCase();
                list.add(RoomTelemetry.fromJson(copy));
              }
            });
            _roomEventController.add(list);
          }
          break;

        case 'VOICE_BROADCAST':
          if (data is Map<String, dynamic>) {
            _voiceEventController.add(VoiceTransmission.fromJson(data));
          }
          break;

        case 'VOLUNTEER_SOS_ALERT':
        case 'GATE_RELEASE_PULSE':
          if (data is Map<String, dynamic>) {
            _sosEventController.add(data);
          }
          break;

        case 'BADGE_SCANNED':
          if (data is Map<String, dynamic>) {
            _badgeEventController.add(data);
          }
          break;

        case 'INIT_STATE':
          if (data is Map<String, dynamic>) {
            if (data['tasks'] is List) {
              for (final t in data['tasks'] as List) {
                if (t is Map<String, dynamic>) {
                  _taskEventController.add(TaskItem.fromJson(t));
                }
              }
            }
            final roomsData = data['rooms'];
            if (roomsData is Map<String, dynamic>) {
              final list = <RoomTelemetry>[];
              roomsData.forEach((k, v) {
                if (v is Map<String, dynamic>) {
                  final copy = Map<String, dynamic>.from(v);
                  copy['id'] = k;
                  copy['name'] = k.toUpperCase();
                  list.add(RoomTelemetry.fromJson(copy));
                }
              });
              _roomEventController.add(list);
            }
          }
          break;
      }
    } catch (_) {
      // Ignore malformed packets gracefully
    }
  }

  bool send(Map<String, dynamic> data) {
    if (_isConnected && _channel != null) {
      try {
        _channel!.sink.add(jsonEncode(data));
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    final delays = [2, 4, 8, 15, 25];
    final delaySeconds = (_reconnectAttempts < delays.length)
        ? delays[_reconnectAttempts]
        : 25;
    _reconnectAttempts++;
    _reconnectTimer = Timer(Duration(seconds: delaySeconds), () {
      connect();
    });
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _reconnectAttempts = 0;
    _subscription?.cancel();
    _channel?.sink.close();
    _isConnected = false;
    _connectionStateController.add(false);
  }

  void dispose() {
    disconnect();
    _connectionStateController.close();
    _taskEventController.close();
    _roomEventController.close();
    _voiceEventController.close();
    _sosEventController.close();
    _badgeEventController.close();
  }
}
