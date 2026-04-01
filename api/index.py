"""
api/index.py
FastAPI entrypoint for Python serverless functions on Vercel.

Wraps individual handlers (optimize.handler, backfill_debut.handler)
as FastAPI route handlers under experimentalServices.
"""

import json
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from . import backfill_debut, optimize

app = FastAPI()


@app.post("/optimize")
async def do_optimize(request: Request) -> Response:
    """Proxy to optimize.handler."""
    body = await request.body()
    event: dict[str, Any] = {
        "method": "POST",
        "body": body.decode("utf-8") if body else "{}",
    }
    result = optimize.handler(event)
    status_code = result.get("statusCode", 200)
    body_out = result.get("body", "{}")
    headers = result.get("headers", {"Content-Type": "application/json"})
    return JSONResponse(content=json.loads(body_out), status_code=status_code, headers=headers)


@app.post("/backfill_debut")
async def do_backfill_debut(request: Request) -> Response:
    """Proxy to backfill_debut.handler."""
    body = await request.body()
    event: dict[str, Any] = {
        "method": "POST",
        "body": body.decode("utf-8") if body else "{}",
    }
    result = backfill_debut.handler(event)
    status_code = result.get("statusCode", 200)
    body_out = result.get("body", "{}")
    headers = result.get("headers", {"Content-Type": "application/json"})
    return JSONResponse(content=json.loads(body_out), status_code=status_code, headers=headers)
