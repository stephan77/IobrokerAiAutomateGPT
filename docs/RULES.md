# AI Autopilot – Core Rules

## Absolute Rules
1. control.run is an impulse, never a state
2. control.run must always reset to false immediately
3. Admin schema is a contract – never remove fields
4. New features must be additive
5. GPT must never be called without live context
6. Debug logging must be optional

## Failure Conditions
- Adapter is green but idle → BUG
- control.run remains true → BUG
- Admin tabs missing → BUG
