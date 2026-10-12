import 'package:flutter_test/flutter_test.dart';
import 'package:delta_mobile/main.dart';

void main() {
  testWidgets('Delta Mobile App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const DeltaMobileApp());

    // Verify that the login screen header and components render properly
    expect(find.text('DELTA ENGINE'), findsOneWidget);
    expect(find.text('MOBILE COORDINATOR OS'), findsOneWidget);
    expect(find.text('OPERATOR AUTH'), findsOneWidget);
  });
}
