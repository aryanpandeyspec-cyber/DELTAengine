// Data models for DELTA Engine Mobile Coordinator

class RoomTelemetry {
  final String id;
  final String name;
  final double currentDensity; // percentage 0..100
  final int capacity;
  final int currentOccupancy;
  final String status; // OPTIMAL, ELEVATED, CRITICAL, OVERFLOW
  final double predictedRisk; // 0..1
  final String trend; // STABLE, RISING, FALLING
  final double temperature; // Celsius
  final int co2; // ppm
  final int doorCountIn;
  final int doorCountOut;

  RoomTelemetry({
    required this.id,
    required this.name,
    required this.currentDensity,
    required this.capacity,
    required this.currentOccupancy,
    required this.status,
    required this.predictedRisk,
    this.trend = 'STABLE',
    this.temperature = 22.5,
    this.co2 = 650,
    this.doorCountIn = 0,
    this.doorCountOut = 0,
  });

  factory RoomTelemetry.fromJson(Map<String, dynamic> json) {
    final cap = (json['capacity'] is num) ? (json['capacity'] as num).toInt() : 100;
    final occ = (json['currentOccupancy'] is num)
        ? (json['currentOccupancy'] as num).toInt()
        : (json['occupancy'] is num)
            ? (json['occupancy'] as num).toInt()
            : ((json['density'] is num) ? ((json['density'] as num).toDouble() / 100 * cap).round() : 0);

    double density = 0.0;
    if (json['currentDensity'] is num) {
      density = (json['currentDensity'] as num).toDouble();
    } else if (json['density'] is num) {
      density = (json['density'] as num).toDouble();
    } else if (cap > 0) {
      density = (occ / cap) * 100.0;
    }

    return RoomTelemetry(
      id: json['id']?.toString() ?? json['roomId']?.toString() ?? 'room-unknown',
      name: json['name']?.toString() ?? json['roomName']?.toString() ?? 'Monitored Zone',
      currentDensity: density.clamp(0.0, 150.0),
      capacity: cap,
      currentOccupancy: occ,
      status: json['status']?.toString().toUpperCase() ??
          (density > 85 ? 'CRITICAL' : density > 65 ? 'ELEVATED' : 'OPTIMAL'),
      predictedRisk: (json['predictedRisk'] is num)
          ? (json['predictedRisk'] as num).toDouble()
          : (density > 80 ? 0.85 : 0.2),
      trend: json['trend']?.toString() ?? 'STABLE',
      temperature: (json['temperature'] is num) ? (json['temperature'] as num).toDouble() : 23.0,
      co2: (json['co2'] is num) ? (json['co2'] as num).toInt() : 680,
      doorCountIn: (json['doorCountIn'] is num) ? (json['doorCountIn'] as num).toInt() : occ,
      doorCountOut: (json['doorCountOut'] is num) ? (json['doorCountOut'] as num).toInt() : 0,
    );
  }
}

class TaskItem {
  final String id;
  final String title;
  final String description;
  final String location;
  final String severity; // CRITICAL, HIGH, MEDIUM, LOW
  final String status; // PENDING, CLAIMED, RESOLVED
  final String? assignedTo;
  final DateTime createdAt;

  TaskItem({
    required this.id,
    required this.title,
    required this.description,
    required this.location,
    required this.severity,
    required this.status,
    this.assignedTo,
    required this.createdAt,
  });

  factory TaskItem.fromJson(Map<String, dynamic> json) {
    return TaskItem(
      id: json['id']?.toString() ?? json['taskId']?.toString() ?? 'task-${DateTime.now().millisecondsSinceEpoch}',
      title: json['title']?.toString() ?? json['action']?.toString() ?? 'Automated Incident Task',
      description: json['description']?.toString() ?? json['details']?.toString() ?? '',
      location: json['location']?.toString() ?? json['zone']?.toString() ?? 'General Area',
      severity: json['severity']?.toString().toUpperCase() ?? 'MEDIUM',
      status: json['status']?.toString().toUpperCase() ?? 'PENDING',
      assignedTo: json['assignedTo']?.toString() ?? json['claimedBy']?.toString(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : json['timestamp'] != null
              ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
              : DateTime.now(),
    );
  }

  TaskItem copyWith({
    String? status,
    String? assignedTo,
  }) {
    return TaskItem(
      id: id,
      title: title,
      description: description,
      location: location,
      severity: severity,
      status: status ?? this.status,
      assignedTo: assignedTo ?? this.assignedTo,
      createdAt: createdAt,
    );
  }
}

class OperatorSession {
  final String id;
  final String email;
  final String name;
  final String role; // coordinator, security, admin, medic
  final String token;

  OperatorSession({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.token,
  });

  factory OperatorSession.fromJson(Map<String, dynamic> json) {
    final user = json['user'] is Map<String, dynamic> ? json['user'] as Map<String, dynamic> : json;
    return OperatorSession(
      id: user['id']?.toString() ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
      email: user['email']?.toString() ?? 'operator@deltaengine.internal',
      name: user['name']?.toString() ?? user['user_metadata']?['full_name']?.toString() ?? 'Lead Coordinator',
      role: user['role']?.toString() ?? 'coordinator',
      token: json['token']?.toString() ?? json['access_token']?.toString() ?? 'token-demo-valid',
    );
  }
}

class AttendeeBadgeResult {
  final bool valid;
  final String ticketId;
  final String name;
  final String tier; // VIP, SPEAKER, GENERAL, CREW
  final bool checkedIn;
  final DateTime? checkinTime;
  final List<String> allowedZones;
  final bool tamperCheckPassed;
  final String message;

  AttendeeBadgeResult({
    required this.valid,
    required this.ticketId,
    required this.name,
    required this.tier,
    required this.checkedIn,
    this.checkinTime,
    required this.allowedZones,
    required this.tamperCheckPassed,
    required this.message,
  });

  factory AttendeeBadgeResult.fromJson(Map<String, dynamic> json) {
    return AttendeeBadgeResult(
      valid: json['valid'] == true || json['status'] == 'APPROVED' || json['verified'] == true,
      ticketId: json['ticketId']?.toString() ?? json['id']?.toString() ?? 'UNKNOWN',
      name: json['name']?.toString() ?? json['attendeeName']?.toString() ?? 'Unknown Attendee',
      tier: json['tier']?.toString().toUpperCase() ?? 'GENERAL',
      checkedIn: json['checkedIn'] == true || json['status'] == 'APPROVED',
      checkinTime: json['checkinTime'] != null
          ? DateTime.tryParse(json['checkinTime'].toString())
          : DateTime.now(),
      allowedZones: (json['allowedZones'] is List)
          ? (json['allowedZones'] as List).map((e) => e.toString()).toList()
          : ['Auditorium', 'Exhibition Hall'],
      tamperCheckPassed: json['tamperCheckPassed'] != false,
      message: json['message']?.toString() ?? 'Badge successfully verified',
    );
  }
}

class VoiceTransmission {
  final String channel;
  final String speaker;
  final String message;
  final DateTime timestamp;
  final List<double> waveform;

  VoiceTransmission({
    required this.channel,
    required this.speaker,
    required this.message,
    required this.timestamp,
    required this.waveform,
  });

  factory VoiceTransmission.fromJson(Map<String, dynamic> json) {
    return VoiceTransmission(
      channel: json['channel']?.toString() ?? 'OPS-GENERAL',
      speaker: json['speaker']?.toString() ?? 'Tactical Unit',
      message: json['message']?.toString() ?? json['transcript']?.toString() ?? 'Radio transmission received',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
      waveform: (json['waveform'] is List)
          ? (json['waveform'] as List).map((e) => (e as num).toDouble()).toList()
          : [0.3, 0.7, 0.4, 0.9, 0.6, 0.2, 0.8, 0.5, 0.3],
    );
  }
}
