import 'package:flutter/material.dart';

/// Central theme for VITALITY COURS. Colors are defined once here so the app
/// stays visually consistent (see the design-system skill).
const Color kBrandPrimary = Color(0xFF2E5BFF);
const Color kBrandAccent = Color(0xFF00C2A8);

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: kBrandPrimary,
    primary: kBrandPrimary,
    secondary: kBrandAccent,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: const Color(0xFFF7F8FC),
    appBarTheme: const AppBarTheme(centerTitle: true),
  );
}
