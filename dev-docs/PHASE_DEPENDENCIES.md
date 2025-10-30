# Phase Dependencies and Timeline

This document visualizes the dependencies between implementation phases and provides guidance on parallel development.

## Dependency Graph

```
Phase 1: Task Update Operations (Week 1-2) [P1]
    └── Foundation for all other phases
        ├── Phase 2: Project Management (Week 3-4) [P1]
        │   └── Phase 5: Team & Workspace (Week 9-10) [P2]
        │
        ├── Phase 3: Subtasks & Dependencies (Week 5-6) [P1]
        │   └── Depends on Phase 1 + Phase 2
        │
        ├── Phase 4: Collaboration (Week 7-8) [P1]
        │   └── Independent after Phase 1
        │
        └── Phase 6: Advanced Features (Week 11-12) [P2]
            └── Depends on Phase 1 + Phase 2
```

## Critical Path

The critical path for core functionality:

```
Phase 1 (2 weeks) → Phase 2 (2 weeks) → Phase 3 (2 weeks) → Phase 4 (2 weeks)
Total: 8 weeks for core P1 features
```

## Parallel Development Opportunities

### After Phase 1 Completes (Week 3+)

Multiple phases can be developed in parallel:

```
┌─────────────────────┐
│   Phase 1 Complete  │
└──────────┬──────────┘
           │
    ┌──────┴──────┬──────────────┬───────────────┐
    │             │              │               │
    ▼             ▼              ▼               ▼
┌───────┐    ┌───────┐      ┌───────┐      ┌───────┐
│Phase 2│    │Phase 4│      │Phase 3│      │Phase 6│
│(P1)   │    │(P1)   │      │(P1)   │      │(P2)   │
└───┬───┘    └───────┘      └───────┘      └───┬───┘
    │                                            │
    ├────────────────────────────────────────────┤
    │                                            │
    ▼                                            ▼
┌───────┐                                   ┌───────┐
│Phase 5│                                   │Future │
│(P2)   │                                   │Phases │
└───────┘                                   └───────┘
```

**Recommended Parallel Tracks**:

**Track A (Core P1)**: Phase 1 → Phase 2 → Phase 3
- Sequential due to tight integration
- Core project management features

**Track B (Collaboration P1)**: Phase 4 (can start after Phase 1)
- Independent feature set
- Can develop in parallel with Track A

**Track C (Team P2)**: Phase 5 (starts after Phase 2)
- Medium priority
- Enhances existing features

**Track D (Advanced P2)**: Phase 6 (starts after Phase 2)
- Nice-to-have features
- Can be developed independently

## Timeline with Parallel Development

### Conservative Approach (Sequential)
```
Week 1-2:   Phase 1
Week 3-4:   Phase 2
Week 5-6:   Phase 3
Week 7-8:   Phase 4
Week 9-10:  Phase 5
Week 11-12: Phase 6
Total: 12 weeks
```

### Optimized Approach (2 parallel developers)
```
Week 1-2:   Phase 1 (both devs)
Week 3-4:   Phase 2 (Dev A) | Phase 4 (Dev B)
Week 5-6:   Phase 3 (Dev A) | Phase 6 (Dev B)
Week 7-8:   Phase 5 (Dev A) | Testing & polish (Dev B)
Total: 8 weeks for all P1 features + 2 weeks for P2 features
```

### Aggressive Approach (3+ parallel developers)
```
Week 1-2:   Phase 1 (all devs)
Week 3-4:   Phase 2 (Dev A) | Phase 4 (Dev B) | Phase 6 (Dev C)
Week 5-6:   Phase 3 (Dev A) | Phase 5 (Dev B+C)
Week 7-8:   Testing, polish, documentation (all)
Total: 8 weeks for all features
```

## Phase Dependencies Explained

### Phase 1: Foundation
**Blocks**: All other phases
**Why**: Establishes core task update patterns that all other features build upon.

### Phase 2: Projects
**Blocked by**: Phase 1
**Blocks**: Phase 3, Phase 5, Phase 6
**Why**: Many features need project context (subtasks in projects, team-project relationships)

### Phase 3: Subtasks
**Blocked by**: Phase 1, Phase 2
**Why**: Needs task updates (Phase 1) and project context (Phase 2) for comprehensive functionality

### Phase 4: Collaboration
**Blocked by**: Phase 1
**Can run parallel with**: Phase 2, Phase 3
**Why**: Independent feature set; only needs basic task operations from Phase 1

### Phase 5: Teams
**Blocked by**: Phase 2
**Can run parallel with**: Phase 3, Phase 4, Phase 6
**Why**: Enhances project management; needs project commands but otherwise independent

### Phase 6: Advanced
**Blocked by**: Phase 1, Phase 2
**Can run parallel with**: Phase 3, Phase 4, Phase 5
**Why**: Nice-to-have features that enhance existing functionality but are not core dependencies

## Risk Mitigation

### Integration Risks

**Risk**: Phases developed in parallel may have integration conflicts
**Mitigation**:
- Phase 1 establishes clear patterns (output formatting, error handling, testing)
- Each phase has isolated command files (minimal overlap)
- Regular integration testing
- Code review for cross-phase impacts

**Risk**: API client wrapper changes affect multiple phases
**Mitigation**:
- Complete `asana-client.ts` extensions in Phase 1
- Document API wrapper patterns
- Use TypeScript interfaces for compile-time checks

**Risk**: Test infrastructure changes mid-project
**Mitigation**:
- Establish test patterns in Phase 1
- Document test double strategies
- Create reusable test fixtures

### Dependency Risks

**Risk**: Phase 1 delays cascade to all other phases
**Mitigation**:
- Prioritize Phase 1 completion
- Break Phase 1 into smaller deliverables (update, then move)
- Allow Phase 4 to start early if Phase 1 update is complete

**Risk**: Phase 2 delays block multiple downstream phases
**Mitigation**:
- Minimum viable Phase 2: just project list/get/create
- Phase 3, 5, 6 can use basic project support
- Enhanced project features can be added later

## Recommended Development Strategy

### Iteration 1: MVP (4 weeks)
```
Week 1-2: Phase 1 (Task updates)
Week 3-4: Phase 2 (Basic projects) + Phase 4 (Comments & followers)
```
**Result**: Core personal task management + basic collaboration

### Iteration 2: Team Features (3 weeks)
```
Week 5-6: Phase 3 (Subtasks & dependencies)
Week 7:   Phase 5 (Team management - partial)
```
**Result**: Complex workflows + team collaboration

### Iteration 3: Polish & Advanced (2 weeks)
```
Week 8-9: Phase 6 (Advanced features - selective)
          Testing, documentation, bug fixes
```
**Result**: Production-ready with nice-to-have features

## Progress Tracking

Use GitHub issue labels to track progress:

- `status:in-progress` - Currently being developed
- `status:needs-review` - Ready for code review
- `status:blocked` - Waiting on dependencies
- `epic` - Phase-level tracking

Example queries:
- All P1 features: `label:p1 label:epic`
- Phases ready to start: `label:epic -label:status:blocked`
- Current work: `label:epic label:status:in-progress`

## Related Documentation

- [ROADMAP.md](ROADMAP.md) - Full feature roadmap
- [GitHub Issues](https://github.com/pleaseai/asana/issues?q=is%3Aissue+label%3Aepic) - Phase tracking
- [STANDARDS.md](STANDARDS.md) - Development standards
