import 'package:flutter_test/flutter_test.dart';
import 'package:delta_mobile/models/models.dart';

void main() {
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
  });
}

