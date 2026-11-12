import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Session worktrees live under .claude/worktrees; keep their test copies out.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
