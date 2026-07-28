from fastapi import APIRouter, HTTPException, Request
from db.get_db import get_db_conn
from utils.logger import log

router = APIRouter(
    prefix = "/auth",
    tags = ["Authentication"]
)

# Login Logic
@router.post("/login")
async def login(request: Request):
    data = await request.json()
    print(data)
    user_id = data.get("user_id")
    user_pass = data.get("user_pass")
    log.info(f"New Login: USER ID: {user_id}")
    conn = None
    cursor = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        query1 = """
            SELECT id, name, user_id FROM users
            WHERE user_id = %s AND user_pass = %s;
        """
        cursor.execute(query1, (user_id, user_pass))
        #  conn.commit() -> No commit for new entries or a select query
        user = cursor.fetchone()
        if user is None:
            raise HTTPException(
                status_code = 401,
                detail = "Invalid Id/Password"
            )
        
        return {
            "message": "Login Successful",
            "token": f"user-token-{user[0]}",
            "user": {
                "id": user[0],
                "name": user[1],
                "user_id": user[2]
            }
        }
    except HTTPException as e:
        print(e)
        raise

    except Exception as e:
        print(e)
        raise HTTPException(
            status_code = 500,
            detail = "Server Error"
        )

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# Signup Logic
@router.post("/signup")
async def signup(request: Request):
    data = await request.json()
    name = data.get("name")
    user_id = data.get("user_id")
    user_pass = data.get("user_pass")
    log.info(f"New Signup: USER ID: {user_id}, USER NAME: {name}")
    conn = None
    cursor = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        query1 = """
            INSERT INTO users(name, user_id, user_pass)
            VALUES
                (%s, %s, %s);
        """
        cursor.execute(query1, (name, user_id, user_pass))
        conn.commit()
        return  {
            "message": "Signup Successful"
            }

    except HTTPException as e:
        raise

    except Exception as e:
        raise HTTPException(
            status_code = 500,
            detail = "Server Error"
        )

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()