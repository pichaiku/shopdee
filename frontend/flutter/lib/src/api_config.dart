import 'package:flutter_dotenv/flutter_dotenv.dart';
class ApiConfig {
  static final String baseUrl = dotenv.env['API_URL'] ?? 'http://localhost/api/node';
  static final String mlUrl = dotenv.env['ML_URL'] ?? 'http://localhost/api/flask';

  static final String register = '$baseUrl/register';//สมัครสมาชิก
  static final String login = '$baseUrl/login';//เข้าสู่ระบบ
  static final String profile = '$baseUrl/profile/';//แสดงข้อมูลส่วนตัว /custID
  static final String customer = '$baseUrl/customer/';//แก้ไขลูกค้า, ลบลูกค้า /custID
  static final String customerImage = '$baseUrl/customer/image/';//แสดงรูปภาพลูกค้า /imageFile
  static final String customerImageUpload = '$baseUrl/customer/image/upload/';//อัปโหลดรูปภาพลูกค้า /custID

  static final String productList = '$baseUrl/product';//แสดงรายการสินเค้า, แสดงรายละเอียดสินค้า
  static final String productImage = '$baseUrl/product/image/';//แสดงรูปภาพสินค้า /imageFile
  
  static final String makeorder = '$baseUrl/makeorder';//เพิ่มสินค้าเข้าตะกร้า
  static final String confirmorder = '$baseUrl/confirmorder';//ยืนยันการสั่งซื้อ
  static final String confirmpayment = '$baseUrl/confirmpayment';//ชำระเงินด้วยบัตรเครดิต (Omise)
  static final String payment = '$baseUrl/payment';//อัปโหลดสลิปการโอนเงิน (multipart: custID, orderID, price, slipFile)
  static final String cart = '$baseUrl/cart/';//แสดงข้อมูลการสั่งซื้อที่อยู่ในตะกร้า /custID
  static final String cartproduct = '$baseUrl/cart/product/';//แสดงรายการสินค้า, อัปเดตจำนวน, ลบรายการสินค้าในตะกร้า /custID
  
  static final String history = '$baseUrl/history/';//แสดงรายการประวัติการสั่งซื้อ /custID?year=orderYear
  static final String orderinfo = '$baseUrl/orderinfo/';//แสดงข้อมูลการสั่งซื้อ ของรายการที่เลือก /custID/orderID
  static final String orderdetail = '$baseUrl/orderdetail/';//แสดงรายละเอียดการสั่งซื้อ /custID/orderID

  static final String yearlySale = '$baseUrl/reports/sales/year/';//ยอดการสั่งซื้อรายปี (บาท) /custID
}
