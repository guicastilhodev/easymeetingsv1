"""
EasyMeetings Backend — Ponto de entrada da aplicação FastAPI.
Sistema corporativo de gestão de salas de reunião.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import initialize_database

app = FastAPI(
    title="EasyMeetings API",
    description="API para gestão de salas de reunião corporativas",
    version="1.0.0",
)

# CORS middleware — permite todas as origens (POC)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Inicializa o banco de dados e executa migrations na inicialização."""
    initialize_database()


# Inclusão dos routers por domínio
from routers.auth import router as auth_router
from routers.rooms import router as rooms_router
from routers.resources import router as resources_router
from routers.users import router as users_router
from routers.reservations import router as reservations_router

app.include_router(auth_router)
app.include_router(rooms_router)
app.include_router(resources_router)
app.include_router(users_router)
app.include_router(reservations_router)

from routers.history import router as history_router

app.include_router(history_router)

from routers.reports import router as reports_router

app.include_router(reports_router)


@app.get("/api/health")
async def health_check():
    """Endpoint de verificação de saúde da aplicação."""
    return {"status": "ok", "service": "EasyMeetings API"}
