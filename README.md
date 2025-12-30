# Brainstorm - React + Vite

A simple React application with Vite, featuring a button and notification system.

## Quick Start

```bash
npm install
npm run dev
```

## Cursor Worktrees Setup

This project is configured to use [Cursor's worktree feature](https://cursor.com/docs/configuration/worktrees) for parallel agent development. Worktrees allow you to run multiple agents in parallel without interfering with each other.

### Configuration

The worktree setup is configured in `.cursor/worktrees.json`. When Cursor creates a worktree, it will automatically:
- Install npm dependencies
- Copy environment files from the root worktree (if they exist)

### Using Worktrees in Cursor

1. **Create a worktree**: In Cursor, use the worktree dropdown to create a new agent run in a worktree
2. **Run agents in parallel**: You can run multiple agents simultaneously, each in their own isolated worktree
3. **Best-of-N**: Run a single prompt across multiple models to compare results

### Viewing Worktree Results in Browser

To see the results from different worktrees in your browser:

#### Step 1: List Available Worktrees

```bash
git worktree list
```

This will show output like:
```
/Users/you/Documents/Projects/brainstorm                   15ae12e   [main]
/Users/you/.cursor/worktrees/brainstorm/98Zlw             15ae12e   [feat-1-98Zlw]
/Users/you/.cursor/worktrees/brainstorm/a4Xiu             15ae12e   [feat-2-a4Xiu]
```

#### Step 2: Navigate to a Worktree

```bash
cd ~/.cursor/worktrees/brainstorm/98Zlw
```

Or use the full path shown in `git worktree list`.

#### Step 3: Start Dev Server in Worktree

Each worktree needs its own dev server running. You can:

**Option A: Use Different Terminals**
- Open multiple terminal windows/tabs
- In each terminal, navigate to a different worktree
- Run `npm run dev` in each

**Option B: Use Different Ports**

By default, Vite uses port 5173. To run multiple instances on different ports:

```bash
# In worktree 1
npm run dev -- --port 5173

# In worktree 2 (different terminal)
npm run dev -- --port 5174

# In worktree 3 (different terminal)
npm run dev -- --port 5175
```

Then access each in your browser:
- Worktree 1: http://localhost:5173
- Worktree 2: http://localhost:5174
- Worktree 3: http://localhost:5175

#### Step 4: Apply Changes

After reviewing the changes in a worktree:
1. Test the changes in the browser
2. Click the "Apply" button in Cursor to merge the changes back to your main branch
3. The worktree will be cleaned up automatically

### Worktree Management

- **Automatic cleanup**: Cursor automatically manages worktrees (max 20 per workspace)
- **View in SCM**: Enable `git.showCursorWorktrees` setting to see worktrees in the SCM pane
- **Debug setup**: Check the "Output" panel → "Worktrees Setup" for setup script logs

### Example Workflow

1. Create a worktree agent run in Cursor with a prompt like "Add a new feature"
2. Wait for the agent to complete
3. Navigate to the worktree: `cd ~/.cursor/worktrees/brainstorm/[worktree-id]`
4. Run `npm run dev -- --port 5174` (use a different port than your main branch)
5. Open http://localhost:5174 in your browser to test
6. If satisfied, click "Apply" in Cursor to merge changes
7. If not satisfied, try another agent run or modify manually

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
