import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'api_config.dart';
import '../main.dart';
import 'payment.dart';

class CartPage extends StatefulWidget {
  const CartPage({super.key});

  @override
  _CartPageState createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  List<dynamic> cartItems = [];
  bool isLoading = true;
  bool isProcessing = false;
  int? orderID;
  double totalPrice = 0.0;

  @override
  void initState() {
    super.initState();
    fetchCartItems();
  }

  Future<void> fetchCartItems() async {
    setState(() {
      isLoading = true;
    });
    
    try {
      SharedPreferences prefs = await SharedPreferences.getInstance();
      int? custID = prefs.getInt('custID');
      String? token = prefs.getString('token');
      
      if (custID == null || token == null) {
        // Not logged in: just show the empty cart screen (no alert)
        setState(() {
          isLoading = false;
        });
        return;
      }

      final response = await http.get(
        Uri.parse('${ApiConfig.cartproduct}$custID'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json; charset=UTF-8',
        },
      );

      if (response.statusCode == 200) {
        var responseData = jsonDecode(response.body);

        setState(() {
          isLoading = false;
          if (responseData is List && responseData.isNotEmpty) {
            cartItems = responseData;
            // Extract orderID from the first item (assuming all items share the same orderID)
            if (cartItems.isNotEmpty && cartItems[0].containsKey('orderID')) {
              orderID = cartItems[0]['orderID'];
            }
            calculateTotalPrice();
          } else {
            cartItems = [];
          }
        });

        MainPage.updateCartItemCount(cartItems.length);
      } else {
        setState(() {
          isLoading = false;
        });
        throw Exception('Failed to fetch cart items');
      }
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void calculateTotalPrice() {
    double sum = 0;
    for (var item in cartItems) {
      sum += double.parse(item['price'].toString()) *
            int.parse(item['quantity'].toString());
    }
    setState(() {
      totalPrice = sum;
    });
  }

  Future<void> updateQuantity(int index, int newQuantity) async {
    if (newQuantity < 1) return;
    
    try {
      SharedPreferences prefs = await SharedPreferences.getInstance();
      String? token = prefs.getString('token');
      int? custID = prefs.getInt('custID');
      
      if (token == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('กรุณาเข้าสู่ระบบ'),
            duration: Duration(seconds: 3),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }

      // API endpoint for updating quantity would go here
      // This is a placeholder for your actual API implementation
      final productID = cartItems[index]['productID'];
      
      // Optimistic update
      setState(() {
        cartItems[index]['quantity'] = newQuantity;
        calculateTotalPrice();
      });
      
      // Call API for updating quantity
      final response = await http.put(
        Uri.parse('${ApiConfig.cartproduct}$custID'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonEncode(<String, dynamic>{          
          'productID': productID,
          'quantity': newQuantity,
        }),
      );

      if (response.statusCode != 200) {
        // Revert the update if the API call fails
        fetchCartItems();
        throw Exception('Failed to update quantity');
      }
      
      
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> removeItem(int index) async {
    try {
      SharedPreferences prefs = await SharedPreferences.getInstance();
      String? token = prefs.getString('token');
      int? custID = prefs.getInt('custID');
      
      if (token == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('กรุณาเข้าสู่ระบบ'),
            duration: Duration(seconds: 3),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }

      final productID = cartItems[index]['productID'];
      
      // Store a copy of the removed item in case we need to restore it
      final removedItem = cartItems[index];
      
      // Optimistic delete
      setState(() {
        cartItems.removeAt(index);
        calculateTotalPrice();
      });
      
      // Call the API to remove the item from the cart
      final response = await http.delete(
        Uri.parse('${ApiConfig.cartproduct}$custID'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonEncode(<String, dynamic>{
          'orderID': orderID,
          'productID': productID,
        }),
      );

      if (response.statusCode == 200) {
        MainPage.updateCartItemCount(cartItems.length);
      } else {
        // Revert the delete if the API call fails
        setState(() {
          cartItems.insert(index, removedItem);
          calculateTotalPrice();
        });
        throw Exception('ไม่สามารถลบสินค้าออกจากตะกร้าได้');
      }
      
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> confirmOrder() async {
    if (cartItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ไม่มีสินค้าในตะกร้า'),
          duration: Duration(seconds: 3),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() {
      isProcessing = true;
    });
    
    try {
      SharedPreferences prefs = await SharedPreferences.getInstance();
      int? custID = prefs.getInt('custID');
      String? token = prefs.getString('token');
      
      if (custID == null || token == null || orderID == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('กรุณาเข้าสู่ระบบ หรือไม่พบข้อมูลคำสั่งซื้อ'),
            duration: Duration(seconds: 3),
            backgroundColor: Colors.red,
          ),
        );
        setState(() {
          isProcessing = false;
        });
        return;
      }

      final response = await http.post(
        Uri.parse('${ApiConfig.confirmorder}'),
        headers: <String, String>{
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonEncode(<String, dynamic>{
          'custID': custID,
          'orderID': orderID,
        }),
      );

      setState(() {
        isProcessing = false;
      });

      if (response.statusCode == 200) {
        // Clear cart after successful order
        setState(() {
          cartItems = [];
          totalPrice = 0;
        });
        
        // Navigate to home page
        //Navigator.of(context).pushReplacementNamed('/');
      } else {
        throw Exception('Failed to confirm order');
      }
    } catch (e) {
      setState(() {
        isProcessing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ตะกร้าสินค้า',
          style: TextStyle(            
            fontWeight: FontWeight.bold,
          )),
        foregroundColor: Colors.white,
        backgroundColor: const Color(0xFF2F80ED),
          automaticallyImplyLeading: false,
        elevation: 0,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : cartItems.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.shopping_cart_outlined,
                        size: 80,
                        color: Colors.grey[400],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'ตะกร้าสินค้าของคุณว่างเปล่า',
                        style: TextStyle(
                          fontSize: 18,
                          color: Colors.grey[600],
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: () {
                          // Use a notification to communicate with the parent widget
                          Navigator.of(context).pushReplacementNamed('/');
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2F80ED),
                          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Text(
                          'เลือกซื้อสินค้า',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.white
                            ),
                        ),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: cartItems.length,
                        itemBuilder: (context, index) {
                          final item = cartItems[index];
                          final itemTotal = double.parse(item['price'].toString()) * 
                                            int.parse(item['quantity'].toString());
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            elevation: 2,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Product Image
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.network(
                                      '${ApiConfig.productImage}${item['imageFile']}',
                                      width: 80,
                                      height: 80,
                                      fit: BoxFit.cover,
                                      errorBuilder: (context, error, stackTrace) {
                                        return Container(
                                          width: 80,
                                          height: 80,
                                          color: Colors.grey[200],
                                          child: const Icon(Icons.image_not_supported, color: Colors.grey),
                                        );
                                      },
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  // Product Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item['productName'],
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 16,
                                          ),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '฿${NumberFormat('#,##0.00').format(double.parse(item['price'].toString()))}',
                                          style: TextStyle(
                                            color: Colors.grey[800],
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            // Quantity Controls
                                            Container(
                                              decoration: BoxDecoration(
                                                border: Border.all(color: Colors.grey[300]!),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Row(
                                                children: [
                                                  // Decrease button
                                                  InkWell(
                                                    onTap: () {
                                                      if (item['quantity'] > 1) {
                                                        updateQuantity(index, item['quantity'] - 1);
                                                      }
                                                    },
                                                    child: Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                      child: Icon(
                                                        Icons.remove,
                                                        size: 18,
                                                        color: item['quantity'] > 1 ? Colors.black : Colors.grey,
                                                      ),
                                                    ),
                                                  ),
                                                  
                                                  // Quantity display
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      border: Border(
                                                        left: BorderSide(color: Colors.grey[300]!),
                                                        right: BorderSide(color: Colors.grey[300]!),
                                                      ),
                                                    ),
                                                    child: Text(
                                                      '${item['quantity']}',
                                                      style: const TextStyle(fontSize: 14),
                                                    ),
                                                  ),
                                                  
                                                  // Increase button
                                                  InkWell(
                                                    onTap: () {
                                                      updateQuantity(index, item['quantity'] + 1);
                                                    },
                                                    child: Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                      child: const Icon(Icons.add, size: 18),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            
                                            // Item total price
                                            Text(
                                              '฿${NumberFormat('#,##0.00').format(itemTotal)}',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 16,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  
                                  // Remove button
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                                    onPressed: () => removeItem(index),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    
                    // Cart Summary and Checkout
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.grey.withOpacity(0.3),
                            spreadRadius: 1,
                            blurRadius: 5,
                            offset: const Offset(0, -1),
                          ),
                        ],
                      ),
                      child: SafeArea(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'ยอดรวมทั้งหมด',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  '฿ ${NumberFormat('#,##0.00').format(totalPrice)}',
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF2F80ED),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: isProcessing
                                    ? null
                                    : () async {
                                        // capture current amount before confirmOrder clears the cart
                                        final currentAmount = totalPrice;
                                        await confirmOrder();
                                        Navigator.of(context).push(
                                          MaterialPageRoute(
                                            builder: (context) => PaymentPage(orderID: orderID ?? 0, amount: currentAmount),
                                          ),
                                        );
                                      },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF2F80ED),
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  disabledBackgroundColor: Colors.grey,
                                ),
                                child: isProcessing
                                    ? const Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              color: Colors.white,
                                              strokeWidth: 2,
                                            ),
                                          ),
                                          SizedBox(width: 12),
                                          Text('กำลังดำเนินการ...'),
                                        ],
                                      )
                                    : const Text(
                                        'ยืนยันการสั่งซื้อ',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}