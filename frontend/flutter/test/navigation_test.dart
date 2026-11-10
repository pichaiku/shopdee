import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:shopdee/main.dart';
import 'package:shopdee/src/history.dart';
import 'package:shopdee/src/login.dart';

import 'test_helpers.dart';

/// Behaviour of the bottom tabs when nobody is logged in.
void main() {
  setUpAll(loadTestEnv);

  http.Client catalogue() => mockApi({
        '/product/popular': (_) => json(popularProducts()),
        '/product': (_) => json(popularProducts()),
      });

  Future<void> pumpApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(const MyApp());
    await tester.pumpAndSettle();
  }

  Future<void> tapTab(WidgetTester tester, String label) async {
    await tester.tap(find.descendant(of: find.byType(BottomNavigationBar), matching: find.text(label)));
    await tester.pumpAndSettle();
  }

  testWidgets('ตะกร้า: no "please log in" alert, shows the empty cart', (tester) async {
    setPrefs();
    await http.runWithClient(() async {
      await pumpApp(tester);
      await tapTab(tester, 'ตะกร้า');
    }, catalogue);
    expect(find.text('กรุณาเข้าสู่ระบบ'), findsNothing);
    expect(find.byType(SnackBar), findsNothing);
    expect(find.text('ตะกร้าสินค้าของคุณว่างเปล่า'), findsOneWidget);
  });

  testWidgets('ประวัติ: no alert, shows a centered message with a login button', (tester) async {
    setPrefs();
    await http.runWithClient(() async {
      await pumpApp(tester);
      await tapTab(tester, 'ประวัติ');
    }, catalogue);
    expect(find.byType(SnackBar), findsNothing);
    expect(find.byType(HistoryPage), findsOneWidget);
    expect(find.text('ยังไม่มีประวัติการสั่งซื้อ'), findsOneWidget);
    expect(find.byIcon(Icons.receipt_long_outlined), findsOneWidget);

    await tester.tap(find.widgetWithText(ElevatedButton, 'เข้าสู่ระบบ'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
  });

  testWidgets('บัญชี: no alert, opens the login page instead', (tester) async {
    setPrefs();
    await http.runWithClient(() async {
      await pumpApp(tester);
      await tapTab(tester, 'บัญชี');
    }, catalogue);
    expect(find.byType(SnackBar), findsNothing);
    expect(find.byType(LoginPage), findsOneWidget);

    // back returns to the app on the same tab (home)
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsNothing);
    expect(find.text('สินค้าทั้งหมด'), findsOneWidget);
  });

  testWidgets('บัญชี with an expired token is treated as logged out', (tester) async {
    setPrefs(custID: 1, token: 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.sig'); // exp = 1970
    await http.runWithClient(() async {
      await pumpApp(tester);
      await tapTab(tester, 'บัญชี');
    }, catalogue);
    expect(find.byType(LoginPage), findsOneWidget);
  });
}
