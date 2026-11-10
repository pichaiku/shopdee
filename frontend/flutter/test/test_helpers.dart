import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Base URLs used by every test (ApiConfig reads them from dotenv).
const apiUrl = 'http://api.test/api/node';
const mlUrl = 'http://api.test/api/flask';

void loadTestEnv() {
  dotenv.testLoad(fileInput: 'API_URL=$apiUrl\nML_URL=$mlUrl\nomise_public_key=pkey_test_dummy');
}

/// Logged-out by default; pass custID/token to simulate a logged-in customer.
void setPrefs({int? custID, String? token}) {
  SharedPreferences.setMockInitialValues({
    if (custID != null) 'custID': custID,
    if (token != null) 'token': token,
  });
}

/// A JWT whose `exp` is far in the future (the app only decodes it, never verifies it).
String fakeJwt({int custID = 1}) {
  String b64(Map<String, dynamic> m) => base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  return '${b64({'alg': 'HS256', 'typ': 'JWT'})}.${b64({'custID': custID, 'exp': 4102444800})}.signature';
}

/// Ten best sellers as returned by GET /product/popular.
List<Map<String, dynamic>> popularProducts([int n = 10]) => List.generate(
      n,
      (i) => {
        'productID': i + 1,
        'productName': 'สินค้าขายดี ${i + 1}',
        'price': '${(i + 1) * 100}.00',
        'quantity': 10,
        'typeName': i.isEven ? 'เสื้อ' : 'หมวก',
        'imageFile': 'img${i + 1}.jpg',
        'totalSold': 100 - i,
      },
    );

/// Routes requests by path; anything unknown answers 404. Records every request.
MockClient mockApi(Map<String, http.Response Function(http.Request req)> routes, {List<http.Request>? log}) {
  return MockClient((req) async {
    log?.add(req);
    for (final entry in routes.entries) {
      if (req.url.toString().contains(entry.key)) return entry.value(req);
    }
    return http.Response('not found', 404);
  });
}

http.Response json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json; charset=utf-8'});
