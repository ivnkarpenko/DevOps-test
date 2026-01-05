from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, List
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Calculator API", version="0.1.0 (MVP-0)")

# Для MVP-0 разрешаем фронту ходить на API с другого порта.
# В следующих этапах (Docker/K8s) настроим через Nginx/Ingress и сузим CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ok для MVP-0
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


Op = Literal["+", "-", "*", "/"]


class CalcRequest(BaseModel):
    a: float = Field(..., description="First operand")
    b: float = Field(..., description="Second operand")
    op: Op = Field(..., description="Operation: +, -, *, /")


class HistoryItem(BaseModel):
    id: str
    a: float
    b: float
    op: Op
    result: float
    created_at: str  # ISO-8601


# In-memory хранилище истории (заменим на Postgres позже)
_HISTORY: List[HistoryItem] = []
_HISTORY_LIMIT = 200  # чтобы не раздувать память


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _calc(a: float, b: float, op: Op) -> float:
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        if b == 0:
            raise HTTPException(status_code=400, detail="Division by zero")
        return a / b
    raise HTTPException(status_code=400, detail="Unsupported operation")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/calc", response_model=HistoryItem)
def calculate(req: CalcRequest):
    result = _calc(req.a, req.b, req.op)
    item = HistoryItem(
        id=str(uuid4()),
        a=req.a,
        b=req.b,
        op=req.op,
        result=result,
        created_at=_now_iso(),
    )
    _HISTORY.append(item)

    # ограничим историю, чтобы MVP-0 не рос бесконечно
    if len(_HISTORY) > _HISTORY_LIMIT:
        del _HISTORY[0 : len(_HISTORY) - _HISTORY_LIMIT]

    return item


@app.get("/api/history", response_model=list[HistoryItem])
def history(limit: int = 50):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be 1..200")
    # Возвращаем последние операции (новые сверху)
    return list(reversed(_HISTORY[-limit:]))


@app.delete("/api/history")
def clear_history():
    _HISTORY.clear()
    return {"status": "cleared"}
