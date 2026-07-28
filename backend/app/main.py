import os
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.v1.auth import router as auth_router
from api.v1.roadmap import router as roadmap_router
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# ── CORS ──────────────────────────────────────────────────────
origins = [
    "https://hk-tech-tracker.vercel.app",
    "http://localhost:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ──────────────────────────────────────────────────────────────

app.include_router(auth_router, prefix="/api/v1")
app.include_router(roadmap_router, prefix="/api/v1")

@app.get("/")
def main():
    return {
        "message": "HK Roadmap Tracker Is Up And Running!"
    }
