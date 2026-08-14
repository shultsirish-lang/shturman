# Architecture sketch

```text
                    ┌───────────────────────┐
                    │  Klientiks / Navigator│
                    │      frontend/UI      │
                    └───────────┬───────────┘
                                │ HTTPS
                                ▼
                    ┌───────────────────────┐
                    │  Green Clinic API     │
                    │  FastAPI (prototype)  │
                    └─────┬─────────┬───────┘
                          │         │
                  search  │         │ CRM adapter (future)
                          ▼         ▼
                 ┌────────────┐  ┌────────────┐
                 │ Knowledge  │  │ Klientiks  │
                 │ repository │  │ API        │
                 └─────┬──────┘  └────────────┘
                       │
                       ▼
                 master.json
                 (prototype)
                       │
                       ▼ future
              PostgreSQL / search index
```

## Architectural principle

Knowledge content must not be coupled to the UI.

The current HTML prototype is a UX reference. `master.json` is the portable knowledge dataset. The Python service is a possible backend boundary, not a mandated production stack.

## Future split worth considering

- KnowledgeCard: stable explanatory/scenario content.
- Service: clinic service identifiers and CRM mapping.
- Price: dynamic price and promotion data.
- Doctor: specialist capabilities and routing constraints.
- RoutingRule: complaint → clarification → destination.
- RedFlagRule: escalation logic.
- MessageTemplate: copyable patient-facing wording.
- Source/Revision: provenance and clinical review.
