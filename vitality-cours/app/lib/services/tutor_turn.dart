// Immutable result of one tutor turn, returned by the backend.

import 'package:flutter/foundation.dart';

@immutable
class TutorTurn {
  const TutorTurn({
    required this.reply,
    required this.correction,
    required this.tip,
    this.tier = '',
  });

  final String reply;
  final String correction;
  final String tip;
  final String tier;

  bool get wasCorrect => correction.trim().toLowerCase() == 'ok';

  factory TutorTurn.fromJson(Map<String, dynamic> json) {
    return TutorTurn(
      reply: (json['reply'] ?? '').toString(),
      correction: (json['correction'] ?? '').toString(),
      tip: (json['tip'] ?? '').toString(),
      tier: (json['tier'] ?? '').toString(),
    );
  }
}
