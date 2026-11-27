// Data integrity test for the conversation styles catalog.
// Runs without a device: pure JSON + model parsing.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:vitality_cours/content/persona.dart';

void main() {
  test('personas.json parses and is complete', () {
    final raw = File('assets/personas/personas.json').readAsStringSync();
    final catalog =
        PersonaCatalog.fromJson(jsonDecode(raw) as Map<String, dynamic>);

    expect(catalog.targetLanguages, containsAll(<String>['en', 'es', 'fr']));
    expect(catalog.levels.length, 3);
    expect(catalog.styles.length, greaterThanOrEqualTo(6));

    for (final style in catalog.styles) {
      expect(style.label.resolve('en').isNotEmpty, true);
      expect(style.goal.isNotEmpty, true);
      expect(style.topics.isNotEmpty, true);
    }
  });
}
