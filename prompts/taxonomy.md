---
description: Find and fix closed-set ownership drift and taxonomy bypasses
argument-hint: "[set, area, or extra focus]"
---
Audit this codebase for closed-set ownership drift. A closed set is a finite semantic taxonomy such as platforms, roles, sources, purposes, kinds, states, event names, capabilities, modes, or feature keys.

For each relevant closed set, identify its owning module. The owner must be the single source of truth for the members, types, metadata, validation, and reusable predicates that belong to that taxonomy. Do not create a second list that can drift from the owner.

Sweep rule sites for taxonomy bypasses. Include authorization, routing, validation, filtering, serialization, schemas, user-interface options, feature checks, migrations, and tests. Find raw member literals, duplicated arrays, parallel unions or enums, repeated switch assumptions, and local predicates that recreate knowledge owned elsewhere. Make each rule site derive from the owning module.

If a closed set has no clear owner, create the smallest cohesive owning module and move the taxonomy knowledge into it. Preserve intentional boundaries for external protocols, persisted wire values, fixtures, and unrelated domains that happen to use the same string. Do not centralize open-ended data or coincidental literals.

Pin the ownership rule after the repair. Add the strongest maintainable test or lint rule that fails when a new bypass, duplicate taxonomy, or unowned member appears. Prefer structural or AST-based enforcement over fragile text matching when the codebase supports it.

Read every affected file fully before editing. Keep the fix narrow, remove superseded declarations, run the repository verification gates, and report the owner for each repaired taxonomy and how future bypasses are prevented.

Additional focus: $ARGUMENTS
