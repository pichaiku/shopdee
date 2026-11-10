# -----------------------------
# 🔹 Import Python libraries
# -----------------------------
from flask import Flask                 # สำหรับสร้าง web API
from flask import jsonify               # สำหรับข้อมูล JSON
from flask_cors import CORS             # เพื่อเปิด CORS ให้สามารถเรียกจาก front-end ได้
import mysql.connector as mysql         # สำหรับเชื่อมต่อ MySQL
import pandas as pd                     # สำหรับอ่านข้อมูลจาก MySQL
import warnings                         # สำหรับปิด warning จาก python
from model import RecommendationModel   # สำหรับ import ml model
from dotenv import load_dotenv
import os

# -----------------------------
# 🔹 Configuration
# -----------------------------
warnings.filterwarnings("ignore") # ปิด warning
load_dotenv()  # โหลดค่าจากไฟล์ .env เข้ามาในระบบ
app = Flask(__name__) # สร้าง Flask app เพื่อใช้สร้าง API
CORS(app)  # เปิดใช้งาน CORS เพื่อให้ front-end เรียก API ได้
FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))

# -----------------------------
#  Create a MySQL connection
# -----------------------------
def get_db_connection():
    try:
        conn = mysql.connect(
            host=os.getenv("DB_HOST", "mysql"),
            database=os.getenv("DB_NAME", "shopdee"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "1234")
        )
        if conn.is_connected():
            return conn
        else:            
            raise Exception("Failed to connect to MySQL")
    except mysql.Error as err:        
        return jsonify({
            "status": False,
            "message": f"MySQL connection error: {err}"            
        }), 500        

# -----------------------------
#  Healht check API
# -----------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "flask"
    }), 200

# -----------------------------
#  Recommendation API
# -----------------------------
@app.route('/api/recommend/<int:id>', methods=['GET'])
def recommend(id):    
    conn = get_db_connection() # Establish connection
    try:
        # Load data
        #sql = "call recommend_procedure()"
        sql = "SELECT * FROM recommend_view"
        x = pd.read_sql(sql, conn, index_col=['custID'])

        # Define prediction data and training data
        x_login_user = x[x.index == id] # prediction data        
        x_other_users = x.drop(id)  # training data        

        # Filter only columns where login user has value > 0
        cols = x_login_user.columns[x_login_user.iloc[0] > 0]
        x_login_user_filtered = x_login_user[cols]      
        x_other_users_filtered = x_other_users[cols]

        # Build and train model 
        model = RecommendationModel()
        model.train(x_other_users_filtered)

        # Predict (หาลูกค้าคนอื่นที่มีพฤติกรรมคล้ายมากที่สุด)
        index = model.find_similar_user(x_login_user_filtered) #user index        
        x_similar = x_other_users.iloc[[index]] #user data        

        # หาชื่อสินค้าที่จะแนะนำ        
        product_names = model.get_product_name(x_login_user, x_similar)

        if len(product_names) == 0:
            return jsonify([]), 200
        else:
            conn = get_db_connection() 
        
        # แสดงรายการสินค้าที่ต้องการแนะนำ
        sql = f'SELECT * FROM product WHERE productName IN ({product_names})'
        products = pd.read_sql(sql, conn)    

        # Return the result
        return jsonify(products.to_dict(orient='records')), 200

    except Exception as e:        
        return jsonify({"status": False,"message": str(e)}), 500  
    finally:
        conn.close() # ปิดการเชื่อมต่อ กับ MySQL

# -----------------------------
#  Run API server
# -----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=True)