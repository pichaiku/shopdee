import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:badges/badges.dart' as badges;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'src/api_config.dart';
import 'src/home.dart';
import 'src/account.dart';
import 'src/cart.dart';
import 'src/history.dart';
import 'src/login.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Shopdee App',
      scrollBehavior: const AppScrollBehavior(),
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const MainPage(),
    );
  }
}

/// Flutter web only drags scrollables with touch by default, so horizontal lists
/// (recommendations, category chips) could not be scrolled with a mouse/trackpad.
class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
        PointerDeviceKind.trackpad,
        PointerDeviceKind.stylus,
        PointerDeviceKind.invertedStylus,
      };
}

class MainPage extends StatefulWidget {
  const MainPage({super.key});

  static final ValueNotifier<int> cartItemCountNotifier = ValueNotifier<int>(0);

  static void updateCartItemCount(int count) {
    cartItemCountNotifier.value = count;
  }

  static int get cartItemCount => cartItemCountNotifier.value;

  @override
  _MainPageState createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> {
  int _selectedIndex = 0;

  final List<Widget> _pages = [
    const HomePage(),
    const CartPage(),
    const HistoryPage(),    
    const AccountPage(),
  ];

  @override
  void initState() {
    super.initState();
    _initializeCartData();
  }


  Future<void> _initializeCartData() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    int? custID = prefs.getInt('custID');
    String? token = prefs.getString('token');

    // Check if token is null or expired
    if (custID != null && await _isLoggedIn()) {
      await fetchCartData(custID.toString(), token!);
    } else {
      MainPage.updateCartItemCount(0);
    }
  }

  Future<void> fetchCartData(String custID, String token) async {
    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.cart}$custID'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json; charset=UTF-8',
        },
      );
      
      
      if (response.statusCode == 200) {
        var responseData = jsonDecode(response.body);
        // Use the class method to update the cart count
        MainPage.updateCartItemCount(responseData is List && responseData.isNotEmpty ? (responseData[0]['itemCount'] ?? 0) : 0);
      } else {
        // e.g. 401 when the token is no longer valid: just show no badge
        MainPage.updateCartItemCount(0);
      }
    } catch (e) {
      // The badge is cosmetic: never crash the app because the cart count could not be loaded
      debugPrint('fetchCartData failed: $e');
      MainPage.updateCartItemCount(0);
    }
  }


  void setSelectedIndex(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }
  
  Future<bool> _isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (prefs.getInt('custID') == null || token == null) return false;
    try {
      return !JwtDecoder.isExpired(token);
    } catch (_) {
      return false;
    }
  }

  Future<void> _onItemTapped(int index) async {
    // "บัญชี" when not logged in -> go straight to the login page
    if (index == 3 && !await _isLoggedIn()) {
      if (!mounted) return;
      Navigator.push(context, MaterialPageRoute(builder: (context) => const LoginPage()));
      return;
    }
    setState(() {
      _selectedIndex = index;
    });

    // Fetch cart data when "ตะกร้า" is selected
    if (index == 1) {
      _initializeCartData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed, // Ensure all labels are shown
        items: <BottomNavigationBarItem>[
          const BottomNavigationBarItem(icon: Icon(Icons.home), label: 'หน้าแรก'),
          BottomNavigationBarItem(
            icon: ValueListenableBuilder<int>(
              valueListenable: MainPage.cartItemCountNotifier,
              builder: (context, count, child) {
                return badges.Badge(
                  badgeContent: Text(
                    '$count',
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                  showBadge: count > 0,
                  child: child,
                );
              },
              child: const Icon(Icons.shopping_cart),
            ),
            label: 'ตะกร้า',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.history), label: 'ประวัติ'),
          //const BottomNavigationBarItem(icon: Icon(Icons.bar_chart), label: 'รายงาน'),
          const BottomNavigationBarItem(icon: Icon(Icons.account_circle), label: 'บัญชี'),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: const Color(0xFF2F80ED),
        unselectedItemColor: Colors.grey,
        onTap: _onItemTapped,
      ),
    );
  }
}