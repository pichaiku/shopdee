import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:shopdee/src/home.dart';

import 'test_helpers.dart';

void main() {
  setUpAll(loadTestEnv);

  group('fetchRecommendations', () {
    test('guest gets the 10 best sellers in order', () async {
      final result = await http.runWithClient(
        () => fetchRecommendations(null),
        () => mockApi({'/product/popular': (_) => json(popularProducts(20))}),
      );
      expect(result.recommendedCount, 0);
      expect(result.items, hasLength(10));
      expect(result.items.first['productID'], 1);
      expect(result.items.every((p) => p['source'] == 'popular'), isTrue);
    });

    test('customer: ML picks come first, duplicates removed, filled up to 10 with best sellers', () async {
      final log = <http.Request>[];
      final result = await http.runWithClient(
        () => fetchRecommendations(9),
        () => mockApi({
          '/recommend/9': (_) => json([
                {'productID': 5, 'productName': 'หมวกแก็บ'},
                {'productID': 5, 'productName': 'หมวกแก็บ'}, // duplicate
                {'productID': 7, 'productName': 'ร้องเท้าผ้าใบ'},
              ]),
          '/product/popular': (_) => json(popularProducts(20)),
        }, log: log),
      );
      expect(log.map((r) => r.url.toString()), contains('$mlUrl/recommend/9'));
      expect(result.recommendedCount, 2);
      expect(result.items, hasLength(10));
      expect(result.items.take(2).map((p) => p['productID']), [5, 7]);
      expect(result.items.take(2).every((p) => p['source'] == 'recommended'), isTrue);
      // ML item enriched with best-seller data (typeName) and never repeated
      expect(result.items.first['typeName'], isNotNull);
      final ids = result.items.map((p) => p['productID']).toList();
      expect(ids.toSet(), hasLength(ids.length));
    });

    test('NaN in the Flask response (pandas NULL) is tolerated', () async {
      final result = await http.runWithClient(
        () => fetchRecommendations(9),
        () => mockApi({
          '/recommend/9': (_) => http.Response('[{"productID": 3, "productDetail": NaN, "price": 500.0}]', 200),
          '/product/popular': (_) => json(popularProducts()),
        }),
      );
      expect(result.recommendedCount, 1);
      expect(result.items.first['productID'], 3);
      expect(result.items.first['productDetail'], isNull);
    });

    test('ML service down -> best sellers only', () async {
      final result = await http.runWithClient(
        () => fetchRecommendations(9),
        () => mockApi({
          '/recommend/9': (_) => http.Response('error', 500),
          '/product/popular': (_) => json(popularProducts()),
        }),
      );
      expect(result.recommendedCount, 0);
      expect(result.items, hasLength(10));
    });
  });

  group('HomePage', () {
    Future<void> pumpHome(WidgetTester tester, http.Client client) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.reset);
      await http.runWithClient(() async {
        await tester.pumpWidget(const MaterialApp(home: HomePage()));
        await tester.pumpAndSettle();
      }, () => client);
    }

    http.Client catalogue() => mockApi({
          '/product/popular': (_) => json(popularProducts()),
          '/product': (_) => json(popularProducts()),
        });

    testWidgets('guest sees the best-seller section and the product grid', (tester) async {
      setPrefs();
      await pumpHome(tester, catalogue());
      expect(find.byKey(const Key('recommended-title')), findsOneWidget);
      expect(find.text('สินค้าขายดี 10 อันดับ'), findsOneWidget);
      expect(find.text('ขายดี #1'), findsOneWidget);
      expect(find.text('สินค้าทั้งหมด'), findsOneWidget);
      expect(find.text('10 รายการ'), findsOneWidget);
    });

    testWidgets('search filters the grid and hides the recommendations', (tester) async {
      setPrefs();
      await pumpHome(tester, catalogue());
      await tester.enterText(find.byType(TextField), 'สินค้าขายดี 10');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('recommended-title')), findsNothing);
      expect(find.text('1 รายการ'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'ไม่มีแน่นอน');
      await tester.pumpAndSettle();
      expect(find.text('ไม่พบสินค้าที่ตรงกับเงื่อนไข'), findsOneWidget);
    });

    testWidgets('category chip filters by product type', (tester) async {
      setPrefs();
      await pumpHome(tester, catalogue());
      await tester.tap(find.widgetWithText(ChoiceChip, 'หมวก'));
      await tester.pumpAndSettle();
      expect(find.text('5 รายการ'), findsOneWidget);
    });

    testWidgets('logged-in customer with ML data sees personal recommendations', (tester) async {
      setPrefs(custID: 9, token: fakeJwt(custID: 9));
      await pumpHome(
        tester,
        mockApi({
          '/recommend/9': (_) => json([{'productID': 4, 'productName': 'สินค้าขายดี 4'}]),
          '/product/popular': (_) => json(popularProducts()),
          '/product': (_) => json(popularProducts()),
        }),
      );
      expect(find.text('สินค้าแนะนำสำหรับคุณ'), findsOneWidget);
      expect(find.text('แนะนำ'), findsOneWidget);
    });

    testWidgets('API error shows a retry button', (tester) async {
      setPrefs();
      await pumpHome(tester, mockApi({}));
      expect(find.text('ไม่สามารถโหลดรายการสินค้าได้'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'ลองใหม่'), findsOneWidget);
    });
  });
}
