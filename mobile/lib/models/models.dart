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
    int cap = (json['capacity'] is num) ? (json['capacity'] as num).toInt() : 0;
    int occ = (json['currentOccupancy'] is num)
        ? (json['currentOccupancy'] as num).toInt()
        : (json['occupancy'] is num)
            ? (json['occupancy'] as num).toInt()
            : (json['peopleDetected'] is num)
                ? (json['peopleDetected'] as num).toInt()
                : 0;

    // Handle string format e.g. "200 / 250 Seats"
    if (json['seats'] != null && (cap == 0 || occ == 0)) {
      final seatsStr = json['seats'].toString().replaceAll(',', '');
      final match = RegExp(r'(\d+)\s*/\s*(\d+)').firstMatch(seatsStr);
      if (match != null) {
        occ = int.tryParse(match.group(1) ?? '') ?? occ;
        cap = int.tryParse(match.group(2) ?? '') ?? cap;
      }
    }

    final id = json['id']?.toString() ?? json['roomId']?.toString() ?? json['hallId']?.toString() ?? 'room-unknown';

    // Set standard capacity fallback if not provided
    if (cap == 0) {
      switch (id.toLowerCase()) {
        case 'room1':
        case 'hall-1':
          cap = 250;
          break;
        case 'room2':
        case 'hall-2':
          cap = 120;
          break;
        case 'room3':
        case 'hall-3':
          cap = 60;
          break;
        case 'room4':
        case 'hall-4':
          cap = 500;
          break;
        case 'room5':
        case 'hall-5':
          cap = 1200;
          break;
        default:
          cap = 200;
      }
    }

    double density = 0.0;
    if (json['currentDensity'] is num) {
      density = (json['currentDensity'] as num).toDouble();
    } else if (json['percent'] is num) {
      density = (json['percent'] as num).toDouble();
    } else if (json['occupiedPercent'] is num) {
      density = (json['occupiedPercent'] as num).toDouble();
    } else if (json['density'] is num) {
      density = (json['density'] as num).toDouble();
    } else if (cap > 0 && occ > 0) {
      density = (occ / cap) * 100.0;
    }

    if (occ == 0 && density > 0 && cap > 0) {
      occ = ((density / 100.0) * cap).round();
    }

    String name = json['name']?.toString() ?? json['roomName']?.toString() ?? json['hallName']?.toString() ?? '';
    if (name.isEmpty || name.toUpperCase() == id.toUpperCase()) {
      switch (id.toLowerCase()) {
        case 'room1':
        case 'hall-1':
          name = 'Turing Grand Hall';
          break;
        case 'room2':
        case 'hall-2':
          name = 'Lovelace Auditorium';
          break;
        case 'room3':
        case 'hall-3':
          name = 'Von Neumann Hub';
          break;
        case 'room4':
        case 'hall-4':
          name = 'Shannon Workshop Suite';
          break;
        case 'room5':
        case 'hall-5':
          name = 'Hopper Tech Pavilion';
          break;
        default:
          name = id.toUpperCase();
      }
    }

    final rawStatus = json['status']?.toString().toUpperCase() ?? '';
    final status = rawStatus == 'NOMINAL' || rawStatus == 'OPTIMAL'
        ? (density >= 80 ? 'CRITICAL' : density >= 60 ? 'ELEVATED' : 'OPTIMAL')
        : rawStatus == 'ALERT' || rawStatus == 'CRITICAL'
            ? 'CRITICAL'
            : (density >= 80 ? 'CRITICAL' : density >= 60 ? 'ELEVATED' : 'OPTIMAL');

    final inCount = (json['doorCountIn'] is num)
        ? (json['doorCountIn'] as num).toInt()
        : (json['entries'] is num ? (json['entries'] as num).toInt() : (occ * 1.15).round());
    final outCount = (json['doorCountOut'] is num)
        ? (json['doorCountOut'] as num).toInt()
        : (json['exits'] is num ? (json['exits'] as num).toInt() : (inCount - occ).clamp(0, inCount));

    final temp = (json['temperature'] is num)
        ? (json['temperature'] as num).toDouble()
        : (21.5 + (density > 75 ? 2.5 : 0.8));
    final co2 = (json['co2'] is num)
        ? (json['co2'] as num).toInt()
        : (500 + (density * 4.5).round());

    return RoomTelemetry(
      id: id,
      name: name,
      currentDensity: density.clamp(0.0, 150.0),
      capacity: cap,
      currentOccupancy: occ,
      status: status,
      predictedRisk: (json['predictedRisk'] is num)
          ? (json['predictedRisk'] as num).toDouble()
          : (density >= 80 ? 0.85 : (density >= 60 ? 0.55 : 0.2)),
      trend: json['trend']?.toString() ?? (density > 75 ? 'RISING' : 'STABLE'),
      temperature: double.parse(temp.toStringAsFixed(1)),
      co2: co2,
      doorCountIn: inCount,
      doorCountOut: outCount,
    );
  }

  bool get isCritical => status == 'CRITICAL' || currentDensity >= 80.0;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'currentDensity': currentDensity,
      'capacity': capacity,
      'currentOccupancy': currentOccupancy,
      'status': status,
      'predictedRisk': predictedRisk,
      'trend': trend,
      'temperature': temperature,
      'co2': co2,
      'doorCountIn': doorCountIn,
      'doorCountOut': doorCountOut,
    };
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
    String pri = json['severity']?.toString().toUpperCase() ??
        json['priority']?.toString().toUpperCase() ??
        'MEDIUM';
    if (pri == 'URGENT') pri = 'CRITICAL';
    if (pri == 'NORMAL') pri = 'MEDIUM';
    if (pri == 'LOW') pri = 'LOW';

    String stat = json['status']?.toString().toUpperCase() ?? 'PENDING';
    if (stat == 'OPEN') stat = 'PENDING';

    return TaskItem(
      id: json['id']?.toString() ?? json['taskId']?.toString() ?? 'task-${DateTime.now().millisecondsSinceEpoch}',
      title: json['title']?.toString() ?? json['action']?.toString() ?? 'Automated Incident Task',
      description: json['description']?.toString() ?? json['details']?.toString() ?? '',
      location: json['location']?.toString() ?? json['zone']?.toString() ?? 'General Area',
      severity: pri,
      status: stat,
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

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'location': location,
      'severity': severity,
      'status': status,
      'assignedTo': assignedTo,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

class OperatorSession {
  final String id;
  final String email;
  final String name;
  final String role; // coordinator, security, admin, medic, volunteer
  final String token;
  final String sessionId;
  final DateTime? expiresAt;
  final bool rememberMe;

  OperatorSession({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.token,
    String? sessionId,
    this.expiresAt,
    this.rememberMe = false,
  }) : sessionId = sessionId ?? 'sess-${DateTime.now().millisecondsSinceEpoch}';

  factory OperatorSession.fromJson(Map<String, dynamic> json) {
    final user = json['user'] is Map<String, dynamic> ? json['user'] as Map<String, dynamic> : json;
    final expStr = json['expiresAt']?.toString() ?? user['expiresAt']?.toString();
    final expiresAt = expStr != null ? DateTime.tryParse(expStr) : null;
    final sessId = json['sessionId']?.toString() ??
        user['sessionId']?.toString() ??
        'sess-${DateTime.now().millisecondsSinceEpoch}';

    return OperatorSession(
      id: user['id']?.toString() ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
      email: user['email']?.toString() ?? 'operator@deltaengine.internal',
      name: user['name']?.toString() ?? user['user_metadata']?['full_name']?.toString() ?? 'Lead Coordinator',
      role: user['role']?.toString() ?? 'coordinator',
      token: json['token']?.toString() ?? json['access_token']?.toString() ?? 'token-demo-valid',
      sessionId: sessId,
      expiresAt: expiresAt,
      rememberMe: json['rememberMe'] == true || user['rememberMe'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'role': role,
      'token': token,
      'sessionId': sessionId,
      'expiresAt': expiresAt?.toIso8601String(),
      'rememberMe': rememberMe,
    };
  }

  bool get isExpired => expiresAt != null && DateTime.now().isAfter(expiresAt!);

  Duration get remainingDuration {
    if (expiresAt == null) return const Duration(hours: 4);
    final diff = expiresAt!.difference(DateTime.now());
    return diff.isNegative ? Duration.zero : diff;
  }

  String get remainingDurationFormatted {
    final rem = remainingDuration;
    if (rem.inMinutes <= 0) return 'Expired';
    final hours = rem.inHours;
    final minutes = rem.inMinutes.remainder(60);
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }

  bool get isAdmin {
    final r = role.toUpperCase();
    return r == 'ADMIN' || r == 'SUPER_ADMIN';
  }

  bool get isCoordinator => role.toUpperCase() == 'COORDINATOR';
  bool get isSafety => role.toUpperCase() == 'SAFETY';
  bool get isVolunteer => role.toUpperCase() == 'VOLUNTEER';
}

class ActiveOperatorSession {
  final String sessionId;
  final String id;
  final String name;
  final String email;
  final String role;
  final String title;
  final String ip;
  final String deviceModel;
  final DateTime loginTime;
  final DateTime lastSeen;
  final String status;
  final bool rememberMe;
  final int durationMinutes;

  ActiveOperatorSession({
    required this.sessionId,
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.title,
    required this.ip,
    required this.deviceModel,
    required this.loginTime,
    required this.lastSeen,
    required this.status,
    required this.rememberMe,
    required this.durationMinutes,
  });

  factory ActiveOperatorSession.fromJson(Map<String, dynamic> json) {
    return ActiveOperatorSession(
      sessionId: json['sessionId']?.toString() ?? '',
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unknown Operator',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? 'VOLUNTEER',
      title: json['title']?.toString() ?? 'Field Operator',
      ip: json['ip']?.toString() ?? '127.0.0.1',
      deviceModel: json['deviceModel']?.toString() ?? 'Mobile Terminal',
      loginTime: json['loginTime'] != null
          ? DateTime.tryParse(json['loginTime'].toString()) ?? DateTime.now()
          : DateTime.now(),
      lastSeen: json['lastSeen'] != null
          ? DateTime.tryParse(json['lastSeen'].toString()) ?? DateTime.now()
          : DateTime.now(),
      status: json['status']?.toString() ?? 'ACTIVE',
      rememberMe: json['rememberMe'] == true,
      durationMinutes: (json['durationMinutes'] is num) ? (json['durationMinutes'] as num).toInt() : 0,
    );
  }

  bool get isRevoked => status == 'REVOKED';
  bool get isExpired => status == 'EXPIRED';
  bool get isActive => status == 'ACTIVE';
}

class SecurityDiscrepancy {
  final String id;
  final String severity; // CRITICAL, WARNING, INFO
  final String type; // CONCURRENT_LOGIN, STALE_SESSION, INGRESS_DEFICIT
  final String title;
  final String description;
  final DateTime timestamp;
  final String? affectedUser;
  final String? roomId;

  SecurityDiscrepancy({
    required this.id,
    required this.severity,
    required this.type,
    required this.title,
    required this.description,
    required this.timestamp,
    this.affectedUser,
    this.roomId,
  });

  factory SecurityDiscrepancy.fromJson(Map<String, dynamic> json) {
    return SecurityDiscrepancy(
      id: json['id']?.toString() ?? 'disc-${DateTime.now().millisecondsSinceEpoch}',
      severity: json['severity']?.toString() ?? 'WARNING',
      type: json['type']?.toString() ?? 'ANOMALY',
      title: json['title']?.toString() ?? 'Security Anomaly',
      description: json['description']?.toString() ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
      affectedUser: json['affectedUser']?.toString(),
      roomId: json['roomId']?.toString(),
    );
  }
}

class DynamicOperatorProfile {
  final String id;
  final String name;
  final String role;
  final String email;
  final String assignedHall;
  final String location;
  final String status;

  DynamicOperatorProfile({
    required this.id,
    required this.name,
    required this.role,
    required this.email,
    required this.assignedHall,
    required this.location,
    required this.status,
  });

  factory DynamicOperatorProfile.fromJson(Map<String, dynamic> json) {
    return DynamicOperatorProfile(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Operator',
      role: json['role']?.toString() ?? 'VOLUNTEER',
      email: json['email']?.toString() ?? '',
      assignedHall: json['assignedHall']?.toString() ?? 'Main Concourse',
      location: json['location']?.toString() ?? 'Zone A',
      status: json['status']?.toString() ?? 'ON_DUTY',
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
