import asyncio

from fastapi import WebSocket

from shaktios_api.incident_models import Incident
from shaktios_api.models import Event


class IncidentConnectionManager:
    """Tracks incident subscribers for the single-process demo API."""

    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        await self.connect_after_accept(websocket)

    async def connect_after_accept(self, websocket: WebSocket) -> None:
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, incident: Incident) -> None:
        message = {"type": "incident.updated", "incident": incident.model_dump(mode="json")}
        disconnected: list[WebSocket] = []
        for websocket in tuple(self.connections):
            try:
                await asyncio.wait_for(websocket.send_json(message), timeout=1.0)
            except Exception:
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(websocket)


incident_connections = IncidentConnectionManager()


class EventConnectionManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        await self.connect_after_accept(websocket)

    async def connect_after_accept(self, websocket: WebSocket) -> None:
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, event: Event) -> None:
        message = {"type": "event.created", "event": event.model_dump(mode="json")}
        disconnected: list[WebSocket] = []
        for websocket in tuple(self.connections):
            try:
                await asyncio.wait_for(websocket.send_json(message), timeout=1.0)
            except Exception:
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(websocket)


event_connections = EventConnectionManager()
