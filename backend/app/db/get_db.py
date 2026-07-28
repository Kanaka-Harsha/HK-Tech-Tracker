import psycopg2
from fastapi import HTTPException
import os
from dotenv import load_dotenv

load_dotenv()

db_host = os.getenv("DATABASE_HOST")
db_port = os.getenv("DATABASE_PORT")
db_name = os.getenv("DATABASE_NAME")
db_user = os.getenv("DATABASE_USER")
db_pass = os.getenv("DATABASE_PASS")

def get_db_conn():
    try:
        conn = psycopg2.connect(
            host = db_host,
            port = db_port,
            database = db_name,
            user = db_user,
            password = db_pass
        )
        print("Connected")
        return conn
    except Exception:
        print("Error")
        raise HTTPException(
            status_code=500, # 500  = Error from server side, here the DB
            detail="Database Connection Failed"
        )

# get_db_conn()