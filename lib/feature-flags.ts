// Feature flags — read once on the server, never scattered across the codebase.
// Each flag is a boolean constant derived from the env at module load time.

export const PHASE2_EXCUSE_ENABLED =
  process.env.PHASE2_EXCUSE_ENABLED === 'true'
