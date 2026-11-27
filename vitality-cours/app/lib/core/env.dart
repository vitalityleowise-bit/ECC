/// App configuration. The backend base URL is set at build time with
/// --dart-define=BACKEND_URL=... so it is never hard-coded to one machine.
class Env {
  static const String backendUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: 'http://10.0.2.2:8080', // Android emulator -> host machine
  );
}
