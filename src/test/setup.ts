import 'dotenv/config'

// `server-only` throws when imported outside a React Server Component build.
// Under Vitest the modules under test are plain Node code, so it is stubbed out.
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))
