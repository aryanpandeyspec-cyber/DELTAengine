import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:delta_mobile/models/models.dart';
import 'package:delta_mobile/services/api_service.dart';

void main() {
  group('AuthException & Security Tests', () {
    test('AuthException stores message and status code correctly', () {
      final exc401 = AuthException('Invalid email or password', statusCode: 401);
      expect(exc401.statusCode, equals(401));
      expect(exc401.toString(), equals('Invalid email or password'));

      final exc403 = AuthException('Access Denied: Super Admin required', statusCode: 403);
      expect(exc403.statusCode, equals(403));
      expect(exc403.message, contains('Access Denied'));
    });
  });
  group('TaskItem Model Tests', () {
    test('Handles case-insensitive status and priority correctly', () {
      final task = TaskItem.fromJson({
        'id': 't1',
        'title': 'Test Bottleneck',
        'severity': 'critical',
        'status': 'claimed',
        'claimedBy': 'Aryan',
      });

      expect(task.isUrgent, isTrue);
      expect(task.isClaimed, isTrue);
      expect(task.isResolved, isFalse);
      expect(task.isPending, isFalse);
      expect(task.assignedTo, equals('Aryan'));

      final resolved = task.copyWith(status: 'resolved');
      expect(resolved.isResolved, isTrue);
      expect(resolved.isClaimed, isFalse);
    });

    test('Pending and Open status normalization', () {
      final taskOpen = TaskItem.fromJson({'id': 't2', 'status': 'open'});
      expect(taskOpen.isPending, isTrue);
      expect(taskOpen.status, equals('PENDING'));
    });
  });

  group('RoomTelemetry Model Tests', () {
    test('Correctly parses seats string format and calculates density', () {
      final room = RoomTelemetry.fromJson({
        'id': 'room1',
        'seats': '200 / 250 Seats',
        'status': 'nominal',
      });

      expect(room.capacity, equals(250));
      expect(room.currentOccupancy, equals(200));
      expect(room.currentDensity, equals(80.0));
      expect(room.name, equals('Turing Grand Hall'));
      expect(room.isCritical, isTrue);
    });
  });

  group('VoiceTransmission Model Tests', () {
    test('Safely handles numeric and string waveforms without exceptions', () {
      final voice = VoiceTransmission.fromJson({
        'channel': '1',
        'speaker': 'Suryansh',
        'message': 'Clear path',
        'waveform': [0.1, '0.5', 0.9, null],
      });

      expect(voice.waveform.length, equals(4));
      expect(voice.waveform[0], equals(0.1));
      expect(voice.waveform[1], equals(0.5));
      expect(voice.waveform[2], equals(0.9));
      expect(voice.waveform[3], equals(0.5));
    });

    test('Direct constructor creates valid offline VoiceTransmission', () {
      final voice = VoiceTransmission(
        channel: '2',
        speaker: 'Aryan',
        message: 'Gate bottleneck cleared',
        timestamp: DateTime(2026, 11, 1, 10, 30),
        waveform: [0.2, 0.4, 0.6],
      );
      expect(voice.channel, equals('2'));
      expect(voice.speaker, equals('Aryan'));
      expect(voice.message, equals('Gate bottleneck cleared'));
      expect(voice.waveform.length, equals(3));
    });
  });

  group('ApiService URL Normalization Tests', () {
    test('setBaseUrl normalizes raw IP addresses and strips trailing slashes', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      SharedPreferences.setMockInitialValues({});
      final api = ApiService();
      await api.setBaseUrl('192.168.1.5:3000/');
      expect(api.baseUrl, equals('http://192.168.1.5:3000'));

      await api.setBaseUrl('https://deltaengine.vercel.app///');
      expect(api.baseUrl, equals('https://deltaengine.vercel.app'));

      await api.setBaseUrl('127.0.0.1:3000');
      expect(api.baseUrl, equals('http://127.0.0.1:3000'));
    });
  });

  group('ActiveOperatorSession Model Tests', () {
    test('Correctly handles empty strings and null fallbacks', () {
      final session = ActiveOperatorSession.fromJson({
        'sessionId': 'sess_123',
        'name': '',
        'role': '   ',
        'title': '',
        'ip': '   ',
        'deviceModel': '',
        'status': '',
      });

      expect(session.name, equals('Unknown Operator'));
      expect(session.role, equals('VOLUNTEER'));
      expect(session.title, equals('Field Operator'));
      expect(session.ip, equals('127.0.0.1'));
      expect(session.deviceModel, equals('Mobile Terminal'));
      expect(session.status, equals('ACTIVE'));
      expect(session.isActive, isTrue);
      expect(session.isRevoked, isFalse);
    });
  });

  group('AttendeeBadgeResult & Offline Verification Tests', () {
    test('Offline verification issues valid edge attendee badge', () async {
      final api = ApiService();
      final res = await api.verifyBadge(code: 'VIP-9941', scannedBy: 'Gate Marshal');
      expect(res.valid, isTrue);
      expect(res.ticketId, equals('VIP-9941'));
      expect(res.name, contains('VIP'));
      expect(res.tier, contains('VIP'));
      expect(res.tamperCheckPassed, isTrue);
    });

    test('Offline verification detects SPK and CREW codes', () async {
      final api = ApiService();
      final spk = await api.verifyBadge(code: 'SPK-1022', scannedBy: 'Gate Marshal');
      expect(spk.valid, isTrue);
      expect(spk.name, equals('Keynote Speaker'));
      expect(spk.tier, equals('Speaker Pass'));

      final crew = await api.verifyBadge(code: 'CREW-0771', scannedBy: 'Gate Marshal');
      expect(crew.valid, isTrue);
      expect(crew.name, equals('Event Production Crew'));
      expect(crew.tier, equals('Production Crew'));
    });
  });

  group('Store-and-Forward Mesh Queue Tests', () {
    test('enqueueOfflineAction records and counts queued actions', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      SharedPreferences.setMockInitialValues({});
      final api = ApiService();
      final initialCount = api.offlineQueueCount;

      await api.enqueueOfflineAction(
        endpoint: '/api/sensors/door',
        payload: {'hallId': 'hall-1', 'type': 'in', 'count': 1},
      );

      expect(api.offlineQueueCount, equals(initialCount + 1));
    });

    test('triggerEmergencySos enqueues to mesh queue when network fails', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      SharedPreferences.setMockInitialValues({});
      final api = ApiService();
      api.setBaseUrl('http://127.0.0.1:59999');
      final beforeCount = api.offlineQueueCount;

      final res = await api.triggerEmergencySos(
        volunteerName: 'Aryan Pandey',
        hallId: 'hall-1',
        note: 'Stairwell crowd surge',
      );

      expect(res, isFalse);
      expect(api.offlineQueueCount, equals(beforeCount + 1));
    });
  });

  group('SecurityDiscrepancy Model Tests', () {
    test('Correctly parses discrepancy and defaults missing fields', () {
      final disc = SecurityDiscrepancy.fromJson({
        'id': 'disc_1',
        'severity': 'HIGH',
        'type': 'DUAL_SESSION_ANOMALY',
        'title': 'Concurrent Sign-in Anomaly',
        'description': 'Dual login from 2 IP addresses',
      });

      expect(disc.id, equals('disc_1'));
      expect(disc.severity, equals('HIGH'));
      expect(disc.type, equals('DUAL_SESSION_ANOMALY'));
      expect(disc.title, contains('Concurrent Sign-in'));
      expect(disc.description, contains('Dual login'));
      expect(disc.sessionIds, isEmpty);
    });

    test('Correctly parses email and sessionIds in forensic discrepancies', () {
      final disc = SecurityDiscrepancy.fromJson({
        'id': 'disc_2',
        'severity': 'CRITICAL',
        'type': 'DUAL_SESSION_ANOMALY',
        'title': 'Concurrent Sign-in Anomaly (test@delta.in)',
        'description': 'Dual login detected',
        'email': 'test@delta.in',
        'sessionIds': ['sess_1', 'sess_2'],
      });

      expect(disc.email, equals('test@delta.in'));
      expect(disc.sessionIds.length, equals(2));
      expect(disc.sessionIds.first, equals('sess_1'));
    });
  });
}

