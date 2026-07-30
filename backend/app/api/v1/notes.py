from pydantic_core.core_schema import none_schema
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.get_db import get_db_conn
import logging
from pydantic import BaseModel
from typing import Optional
from utils.logger import log

router = APIRouter (
    prefix = "/notes",
    tags = ["Notes"]
)

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None

@router.get("/{roadmap_id}")
async def getNotes(roadmap_id: str):
    log.info(f"Getting Notes For The Roadmap: {roadmap_id}")
    conn = None
    cursor = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        query = """
            SELECT roadmap_id, title, notes
            FROM notes
            WHERE LOWER(roadmap_id) = LOWER(%s);
        """
        cursor.execute(query, (roadmap_id,))
        notes = cursor.fetchone()
        if not notes:
            return {
                "roadmap_id": roadmap_id,
                "title": "",
                "notes": ""
            }
        return {
            "roadmap_id": notes[0],
            "title": notes[1],
            "notes": notes[2]
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error getting notes: {e}")

        raise HTTPException(
            status_code=500,
            detail="Internal Server Error"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.put("/updateNote/{roadmap_id}")
async def updateNote(roadmap_id: str, payload: NoteUpdate):
    log.info(f"Notes Updated For the Roadmap: {roadmap_id}")
    conn = None
    cursor = None 
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        base_query = """
            SELECT id, name
            FROM roadmaps
            WHERE LOWER(name) = LOWER(%s);
        """
        cursor.execute(base_query, (roadmap_id,))
        n_db_id = cursor.fetchone()
        if not n_db_id:
            raise HTTPException(
            status_code=404,
            detail="Roadmap not found"
        )
        

        query = """
            UPDATE notes
            SET title = %s,
            notes = %s,
            updated_at= CURRENT_TIMESTAMP
            WHERE LOWER(roadmap_id) = LOWER(%s);
        """
        cursor.execute(query, (payload.title, payload.notes, roadmap_id))
        conn.commit()

        return {
            "message": "Notes updated successfully",
            "title": payload.title,
            "notes": payload.notes
        }

    except HTTPException:
        raise
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code = 500,
            detail = "Server Issue"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()