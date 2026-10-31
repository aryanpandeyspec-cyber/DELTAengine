import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/splash_screen.dart';
import 'theme/neubrutalism.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Disable blocking runtime HTTP font downloads on mobile for zero-stutter 120 FPS
  GoogleFonts.config.allowRuntimeFetching = false;
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF070B14),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
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
      home: const SplashScreen(),
    );
  }
}
