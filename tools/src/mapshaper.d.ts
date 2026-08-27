/**
 * mapshaper ships no types. We use exactly one entry point, so declaring it here
 * beats pulling in an untyped `any` at the import site.
 */
declare module 'mapshaper' {
  export function applyCommands(
    commands: string,
    input: Record<string, string | Buffer>
  ): Promise<Record<string, Buffer>>;
}
