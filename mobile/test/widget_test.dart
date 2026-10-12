import 'package:flutter_test/flutter_test.dart';
import 'package:delta_mobile/main.dart';

void main() {
  testWidgets('Delta Mobile App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const DeltaMobileApp());

    // Verify that the login screen header renders
    expect(find.text('MOBILE\nCOORDINATOR'), findsOneWidget);
    expect(find.text('OPERATOR AUTH'), findsOneWidget);
  });
}
