# Branch Protection & PR Requirements

## Branch Protection Rules

Configure these settings in GitHub → Settings → Branches for `master`:

- **Require pull request before merging** (1 approval minimum)
- **Require status checks**: lint, test, test-coverage, build, type-check
- **Require branches to be up to date**
- **Require conversation resolution**

## PR Requirements

Before merging:
1. All CI checks must pass
2. Test coverage ≥ 50%
3. Code review approval
4. Up to date with master

## Local Checks

Run before creating PR:

```bash
bun run ci          # Biome checks
bun test           # All tests
bun run type-check # TypeScript
bun run build      # Build verification
bun run check      # Auto-fix issues
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)

## Testing
- [ ] All tests pass locally
- [ ] Added new tests for new functionality
- [ ] Test coverage maintained or improved

## Checklist
- [ ] My code follows the style guidelines (bun run check)
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
```

## Handling CI Failures

### Common Issues and Fixes

1. **Lint failures**
   ```bash
   bun run lint  # See specific issues
   bun run check # Auto-fix
   ```

2. **Test failures**
   - Check error messages in CI logs
   - Run failing test locally: `bun test path/to/test`
   - Ensure mocks are properly set up

3. **Coverage below threshold**
   - Add tests for uncovered code
   - Run `bun test --coverage` to see gaps
   - Focus on critical business logic

4. **Type errors**
   - Run `bun run type-check` locally
   - Fix any type mismatches
   - Avoid using `any` type

## CI Failure Fixes

- **Lint**: `bun run check` (auto-fixes)
- **Tests**: Run failing test locally with full path
- **Coverage**: Add tests for uncovered code
- **Types**: `bun run type-check` to see errors

## Emergency Procedures

**Bypassing protection** (admin only): Document reason, get 2+ approvals  
**Reverting**: `git revert <commit>` on master