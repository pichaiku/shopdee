# Import Python Library
from sklearn.neighbors import NearestNeighbors
import pandas as pd

class RecommendationModel:
    # Build (กำหนดโครงสร้างของโมเดล)
    def __init__(self, n_neighbors=1, metric='minkowski', p=2):
        self.net = NearestNeighbors(n_neighbors=n_neighbors, metric=metric, p=p)

    # Train (ฝึกโมเดลด้วยข้อมูลลูกค้าคนอื่น")
    def train(self, x_other_users: pd.DataFrame):        
        self.net.fit(x_other_users)

    # Test (หาลูกค้าที่มีพฤติกรรมคล้ายกับ login user)
    def find_similar_user(self, x_login_user: pd.DataFrame):        
        index = self.net.kneighbors(x_login_user)[1][0][0]
        return index

    # Get product names from the DataFrame
    def get_product_name(self, x_login_user: pd.DataFrame, x_similar: pd.DataFrame) -> str:
        product_count = len(x_login_user.columns)
        product_names = []

        for i in range(product_count):    
            if (x_login_user.iloc[0, i] == 0 and x_similar.iloc[0, i] > 0):
                product_names.append(str(x_similar.columns[i]))

        product_names_str = ', '.join(f"'{name}'" for name in product_names)
        return product_names_str

# For testing purposes
if __name__ == "__main__":
    # Example training data
    # Suppose we have 4 customers, each row = customer
    # Columns = a number of purchased products
    train_data = [
        [1, 1, 2],  # Cust1
        [0, 1, 5],  # Cust2
        [3, 1, 0],  # Cust3
        [0, 4, 0]   # Cust4
    ]

    # สร้าง DataFrame พร้อม column และ index
    train_df = pd.DataFrame(train_data,
        columns=["ProductA", "ProductB", "ProductC"],
        index=["Cust1", "Cust2", "Cust3", "Cust4"]
    )   
    print("Training Data:")
    print(train_df)

    # Example login user who bought A=1, B=0, C=2 (similar to Cust1)
    test_data = [[1, 0, 2]]
    login_user = pd.DataFrame(test_data, columns=["ProductA", "ProductB", "ProductC"])    
    print("\nTest Data (User Login):")
    print(login_user)

    # Build and train model 
    model = RecommendationModel()
    model.train(train_df)

    # Test with a Login User
    similar_index = model.find_similar_user(login_user)
    similar_customer_id = train_df.index[similar_index] 
    similar_customer_data = train_df.loc[[similar_customer_id]]     
    print("\nMost similar customer data:\n", similar_customer_data)    

    # Show recommended products
    print("\nMost similar products:")
    print(model.get_product_name(login_user, similar_customer_data))


