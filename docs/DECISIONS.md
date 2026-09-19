# ADR-001

## Decision
PostgreSQL is the persistence layer.

## Why
Simple, relational, easy to operate during the hackathon.

## Rejected
MongoDB, because ShaktiOS has relational incident/event/action relationships.

# ADR-002

## Decision
Use WebSockets for live operator updates.

## Why
Dashboard needs real-time incident state updates.

## Rejected
Polling, because it introduces unnecessary latency and traffic.