// Immutable models for VITALITY COURS conversation styles.
// Personas are data loaded from assets/personas/personas.json.

import 'package:flutter/foundation.dart';

@immutable
class LocalizedText {
  const LocalizedText(this.values);

  final Map<String, String> values;

  factory LocalizedText.fromJson(Map<String, dynamic> json) {
    return LocalizedText(
      json.map((key, value) => MapEntry(key, value.toString())),
    );
  }

  /// Returns the text for [languageCode], falling back to English then any value.
  String resolve(String languageCode) {
    return values[languageCode] ?? values['en'] ?? values.values.first;
  }
}

@immutable
class Level {
  const Level({
    required this.id,
    required this.label,
    required this.speakingRate,
    required this.correctionStrictness,
    required this.sentenceMaxWords,
  });

  final String id;
  final LocalizedText label;
  final double speakingRate;
  final String correctionStrictness;
  final int sentenceMaxWords;

  factory Level.fromJson(Map<String, dynamic> json) {
    return Level(
      id: json['id'] as String,
      label: LocalizedText.fromJson(json['label'] as Map<String, dynamic>),
      speakingRate: (json['speakingRate'] as num).toDouble(),
      correctionStrictness: json['correctionStrictness'] as String,
      sentenceMaxWords: json['sentenceMaxWords'] as int,
    );
  }
}

@immutable
class ConversationStyle {
  const ConversationStyle({
    required this.id,
    required this.icon,
    required this.label,
    required this.description,
    required this.goal,
    required this.topics,
  });

  final String id;
  final String icon;
  final LocalizedText label;
  final LocalizedText description;
  final String goal;
  final List<String> topics;

  factory ConversationStyle.fromJson(Map<String, dynamic> json) {
    return ConversationStyle(
      id: json['id'] as String,
      icon: json['icon'] as String,
      label: LocalizedText.fromJson(json['label'] as Map<String, dynamic>),
      description:
          LocalizedText.fromJson(json['description'] as Map<String, dynamic>),
      goal: json['goal'] as String,
      topics: (json['topics'] as List<dynamic>).map((e) => e.toString()).toList(),
    );
  }
}

@immutable
class PersonaCatalog {
  const PersonaCatalog({
    required this.targetLanguages,
    required this.levels,
    required this.styles,
  });

  final List<String> targetLanguages;
  final List<Level> levels;
  final List<ConversationStyle> styles;

  factory PersonaCatalog.fromJson(Map<String, dynamic> json) {
    return PersonaCatalog(
      targetLanguages: (json['targetLanguages'] as List<dynamic>)
          .map((e) => e.toString())
          .toList(),
      levels: (json['levels'] as List<dynamic>)
          .map((e) => Level.fromJson(e as Map<String, dynamic>))
          .toList(),
      styles: (json['styles'] as List<dynamic>)
          .map((e) => ConversationStyle.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
