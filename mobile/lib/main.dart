import 'package:flutter/material.dart';
import 'services/api_service.dart';
import 'screens/login_screen.dart';
import 'theme/neubrutalism.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService().init();
  runApp(const DeltaMobileApp());
}

class DeltaMobileApp extends StatelessWidget {
  const DeltaMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DELTA Engine Mobile',
      debugShowCheckedModeBanner: false,
      theme: Neubrutalism.themeData,
      home: const LoginScreen(),
    );
  }
}
