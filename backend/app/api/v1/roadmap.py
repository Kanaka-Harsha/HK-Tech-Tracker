from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.get_db import get_db_conn
import logging
from psycopg2 import sql
from typing import Optional
from utils.logger import log

router = APIRouter(
    prefix = "/roadmap",
    tags = ["roadmaps"]
)

# Pydantic schema for POST payload
class TaskCreate(BaseModel):
    main_topic: str
    sub_topic: str
    description: str = ""
    status: str = "Pending"
class TaskUpdate(BaseModel):
    main_topic: Optional[str] = None
    sub_topic: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

# Getting All Rows
@router.get("/{roadmap_id}")
async def getRows(roadmap_id: str):
    log.info(f"Rows Extracted For The Roadmap {roadmap_id}.")
    conn = None
    cursor = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM roadmaps WHERE LOWER(name) = %s;", (roadmap_id.lower(),))
        roadmap = cursor.fetchone()
        if not roadmap:
            raise HTTPException(status_code=404, detail=f"Roadmap '{roadmap_id}' not found")
        r_db_id = roadmap[0]
        query = """
            SELECT id, main_topic, sub_topic, description, status, created_at, updated_at 
            FROM tasks 
            WHERE roadmap_id = %s 
            ORDER BY id ASC;
        """
        cursor.execute(query, (r_db_id,))
        raw_rows = cursor.fetchall()

        rows = []
        for r in raw_rows:
            rows.append({
                "id": r[0],
                "main_topic": r[1],
                "sub_topic": r[2],
                "description": r[3],
                "status": r[4],
                "created_at": str(r[5]) if r[5] else None,
                "updated_at": str(r[6]) if r[6] else None
            })
        return rows 
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error Fetching Rows: {e}")
        raise HTTPException(
            status_code = 500, 
            detail = "Failed to fetch data"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# Add New Row
@router.post("/{roadmap_id}")
async def addRows(roadmap_id: str, payload: TaskCreate):
    log.info(f"New Row Added For The Roadmap {roadmap_id}.")
    main_topic = payload.main_topic
    sub_topic = payload.sub_topic
    desc = payload.description
    status = payload.status

    conn = None
    cursor = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()

        base_query = """
            SELECT id 
            FROM roadmaps
            WHERE LOWER(name) = %s;
        """
        cursor.execute(base_query, (roadmap_id.lower(),))
        roadmap = cursor.fetchone()

        if not roadmap:
            raise HTTPException(status_code=404, detail=f"Roadmap '{roadmap_id}' not found")

        r_db_id = roadmap[0]

        insert_query = """
            INSERT INTO tasks (roadmap_id, main_topic, sub_topic, description, status)
            VALUES
                (%s, %s, %s, %s, %s)
            RETURNING id, main_topic, sub_topic, description, status, created_at, updated_at;
        """
        cursor.execute(insert_query, (r_db_id, main_topic, sub_topic, desc, status))
        conn.commit()
        new_row = cursor.fetchone()

        return {
            "id": new_row[0],
            "main_topic": new_row[1],
            "sub_topic": new_row[2],
            "description": new_row[3],
            "status": new_row[4],
            "created_at": str(new_row[5]),
            "updated_at": str(new_row[6])
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding row: {e}")
        raise HTTPException(status_code=500, detail="Failed to add task")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# Delete Row
@router.delete("/{roadmap_id}/{id}")
async def deleteRow(roadmap_id: str, id: int):
    log.info(f"Row Deleted For Roadmap {roadmap_id}")
    conn = None
    cursor = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        query = """
            DELETE FROM tasks
            WHERE id = %s
            RETURNING id;
        """
        cursor.execute(query, (id,))
        deleted_task = cursor.fetchone()
        if not deleted_task:
            raise HTTPException(status_code=404, detail=f"Task with id {id} not found")
        conn.commit()
        return {
            "message": "Task deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail = "Server Error"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.put("/{roadmap_id}/{id}")
async def updateRow(roadmap_id: str, id: int, payload: TaskUpdate):
    log.info(f"Row Modified For Roadmap {roadmap_id}")

    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    conn = None
    cursor = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        set_clauses = []
        values = []
        for col, val in update_data.items():
            set_clauses.append(sql.SQL("{} = %s").format(sql.Identifier(col)))
            values.append(val)
        set_clauses.append(sql.SQL("updated_at = CURRENT_TIMESTAMP"))
        values.append(id)
        query = sql.SQL("UPDATE tasks SET {} WHERE id = %s RETURNING id, main_topic, sub_topic, description, status, created_at, updated_at;").format(
            sql.SQL(", ").join(set_clauses)
        )
        cursor.execute(query, tuple(values))
        updated_row = cursor.fetchone()
        if not updated_row:
            raise HTTPException(status_code=404, detail=f"Task with id {id} not found")
        conn.commit()
        return {
            "id": updated_row[0],
            "main_topic": updated_row[1],
            "sub_topic": updated_row[2],
            "description": updated_row[3],
            "status": updated_row[4],
            "created_at": str(updated_row[5]),
            "updated_at": str(updated_row[6])
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to update task")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.get("/{roadmap_id}/progress")
async def getRoadmapProgress(roadmap_id: str):
    conn = None
    cursor = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()

        base_query = """
            SELECT id 
            FROM roadmaps
            WHERE lower(name) = %s;
        """
        cursor.execute(base_query, (roadmap_id, ))
        roadmap = cursor.fetchone()
        if not roadmap:
            return {
                "total": 0,
                "completed": 0,
                "ongoing": 0,
                "pending": 0,
                "lastUpdated": None
            }
        r_db_id = roadmap[0]

        query = """
            SELECT 
            COUNT(*) AS TOTAL,
            COUNT(*) FILTER(WHERE status = 'Completed'),
            COUNT(*) FILTER(WHERE status = 'Ongoing'),
            COUNT(*) FILTER(WHERE status = 'Pending'),
            MAX(updated_at) AS last_updated
            FROM tasks
            WHERE roadmap_id = %s;
        """
        cursor.execute(query,(r_db_id, ))
        stats = cursor.fetchone()
        return {
            "total": stats[0] or 0,
            "completed": stats[1] or 0,
            "ongoing": stats[2] or 0,
            "pending": stats[3] or 0,
            "lastUpdated": str(stats[4]) if stats[4] else None
        }
    except Exception as e:
        print(f"Error fetching progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch progress stats")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()