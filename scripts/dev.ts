import { $ } from 'bun';

const app = process.argv[2] ?? 'study';

console.log(`Starting ${app} dev server...`);
await $`cd apps/${app} && bun run dev`;
