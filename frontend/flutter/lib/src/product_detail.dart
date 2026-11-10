import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'api_config.dart';
import '../main.dart';

class ProductDetailPage extends StatefulWidget {
  final Map<String, dynamic> product;

  const ProductDetailPage({super.key, required this.product});

  @override
  _ProductDetailPageState createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage> {
  int quantity = 1;

  void increaseQuantity() {
    setState(() {
      quantity++;
    });
  }

  void decreaseQuantity() {
    if (quantity > 1) {
      setState(() {
        quantity--;
      });
    }
  }

  void addToCart() async {
    try {
      // Call makeorder API
      SharedPreferences prefs = await SharedPreferences.getInstance();
      String? token = prefs.getString('token');
      int? custID = prefs.getInt('custID');
      if (token == null || custID == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('กรุณาเข้าสู่ระบบ'),
            duration: Duration(seconds: 3),), // Please log in in Thai
        );
        return;
      }
      // Check if token is valid
      final response = await http.post(
        Uri.parse(ApiConfig.makeorder),
        headers: < String, String > {          
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonEncode({
          'custID': custID,
          'productID': widget.product['productID'],
          'quantity': quantity,
          'price': widget.product['price']
              .toString()
              .replaceAll('฿', '')
              .replaceAll(',', ''),
        }),
      );

      if (response.statusCode == 200) {
        // Fetch updated cart item count
        final cartResponse = await http.get(
          Uri.parse('${ApiConfig.cart}$custID'),
          headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json; charset=UTF-8',
          },
        );

        if (cartResponse.statusCode == 200) {
          final cartData = jsonDecode(cartResponse.body);
          final itemCount = cartData[0]['itemCount'] ?? 0;

          // Update the badge count in the bottom navigation bar
          MainPage.updateCartItemCount(itemCount); // Use the class name to call the static method

          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${widget.product['productName']} added to cart!'),
              duration: Duration(seconds: 3),),
          );
        } else {
          throw Exception('Failed to fetch cart data');
        }
      } else {
        throw Exception('Failed to add item to cart');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.product['productName'],
          style: TextStyle(            
            fontWeight: FontWeight.bold,
          )),
        foregroundColor: Colors.white,
        backgroundColor: const Color(0xFF2F80ED),
      ),
      body: SingleChildScrollView( // ✅ Fix Overflow by making page scrollable
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Image.network('${ApiConfig.productImage}${widget.product['imageFile']}'),
              const SizedBox(height: 16),
              Text(widget.product['productDetail']),
              const SizedBox(height: 8),
              Text(
                '฿${NumberFormat('#,##0.00').format(double.parse(widget.product['price'].toString()))}',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue,
                ),
              ),
              const SizedBox(height: 16),

              // Quantity Selector
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.remove, color: Colors.red),
                    onPressed: decreaseQuantity,
                  ),
                  Text(
                    '$quantity',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add, color: Colors.green),
                    onPressed: increaseQuantity,
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Add to Cart Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: addToCart,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text(
                    'เพิ่มลงตะกร้า',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
