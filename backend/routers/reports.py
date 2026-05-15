"""
Router de relatórios de reservas.
Endpoints para geração de relatórios e exportação CSV.
Acesso restrito a Administradores.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from auth import require_admin
from services.report_service import export_report_csv, generate_report

router = APIRouter(prefix="/api/reports", tags=["Relatórios"])


@router.get(
    "/reservations",
    responses={
        200: {"description": "Relatório gerado com sucesso"},
        400: {"description": "Período inválido"},
        401: {"description": "Não autenticado"},
        403: {"description": "Acesso negado"},
        404: {"description": "Sala não encontrada"},
    },
)
async def get_reservations_report(
    start_date: str = Query(..., description="Data de início (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Data de fim (YYYY-MM-DD)"),
    room_id: Optional[int] = Query(None, description="ID da sala (opcional)"),
    current_user: dict = Depends(require_admin),
):
    """
    Gera relatório de reservas para o período informado.

    - Acesso restrito a Administradores.
    - Parâmetros obrigatórios: start_date, end_date.
    - Parâmetro opcional: room_id (filtra por sala).
    - Retorna: total de reservas, reservas por sala, reservas por usuário e taxa de ocupação.
    """
    result = generate_report(start_date, end_date, room_id)

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return result["report"]


@router.get(
    "/reservations/export",
    responses={
        200: {"description": "CSV exportado com sucesso"},
        400: {"description": "Período inválido"},
        401: {"description": "Não autenticado"},
        403: {"description": "Acesso negado"},
        404: {"description": "Sala não encontrada"},
    },
)
async def export_reservations_report(
    start_date: str = Query(..., description="Data de início (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Data de fim (YYYY-MM-DD)"),
    room_id: Optional[int] = Query(None, description="ID da sala (opcional)"),
    current_user: dict = Depends(require_admin),
):
    """
    Exporta relatório de reservas em formato CSV.

    - Acesso restrito a Administradores.
    - Parâmetros obrigatórios: start_date, end_date.
    - Parâmetro opcional: room_id (filtra por sala).
    - Retorna arquivo CSV para download.
    """
    result = export_report_csv(start_date, end_date, room_id)

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    # Retorna como streaming response com content-type CSV
    filename = f"relatorio_reservas_{start_date}_{end_date}.csv"

    return StreamingResponse(
        iter([result["csv_content"]]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
