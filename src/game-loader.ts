export async function loadGameModule(): Promise<typeof import('./game')> {
  return import('./game');
}
