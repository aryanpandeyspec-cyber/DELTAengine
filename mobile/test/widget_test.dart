import 'package:flutter_test/flutter_test.dart';
import 'package:delta_mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('Delta Mobile App smoke test', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const DeltaMobileApp());

    // Advance frame for splash screen animation and navigation to complete
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1400));
    await tester.pump(const Duration(milliseconds: 200));

    // Verify that the login screen header and components render properly
    expect(find.text('DELTA ENGINE'), findsWidgets);
    expect(find.text('MOBILE COORDINATOR OS'), findsOneWidget);
    expect(find.text('OPERATOR AUTH'), findsOneWidget);
  });
}
