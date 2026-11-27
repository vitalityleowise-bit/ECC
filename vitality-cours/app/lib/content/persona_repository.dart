// Loads the conversation styles catalog from bundled assets.

import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'persona.dart';

class PersonaRepository {
  const PersonaRepository();

  static const String _assetPath = 'assets/personas/personas.json';

  Future<PersonaCatalog> load() async {
    final raw = await rootBundle.loadString(_assetPath);
    final json = jsonDecode(raw) as Map<String, dynamic>;
    return PersonaCatalog.fromJson(json);
  }
}

final personaRepositoryProvider = Provider<PersonaRepository>(
  (ref) => const PersonaRepository(),
);

final personaCatalogProvider = FutureProvider<PersonaCatalog>(
  (ref) => ref.watch(personaRepositoryProvider).load(),
);
