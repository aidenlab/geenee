/**
 * geenee prod is released only from a pushed prod- tag (ADR 0004):
 * scripts/deploy.sh refuses any other ref before it does anything. Each test
 * runs a copy of the script in a throwaway repository with its own origin.
 */
import { spawnSync, execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let root: string
let repo: string
const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
/** Runs the copy for `ref`, answering `answer` when it asks whether the Host check passed. */
const deploy = (ref: string, answer = 'yes') => {
  // No wrangler on the PATH the copy sees, so a ref that got past the checks would fail on the login instead.
  const run = spawnSync(join(repo, 'scripts/deploy.sh'), [ref], { cwd: repo, encoding: 'utf8', input: `${answer}\n`, env: { ...process.env, PATH: '/usr/bin:/bin', GEENEE_DEPLOYMENT: '' } })
  return { status: run.status, stdout: run.stdout, stderr: run.stderr }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'geenee-deploy-'))
  repo = join(root, 'geenee')
  execFileSync('git', ['init', '-q', '--bare', join(root, 'origin.git')])
  mkdirSync(join(repo, 'scripts'), { recursive: true })
  copyFileSync(resolve(__dirname, '../scripts/deploy.sh'), join(repo, 'scripts/deploy.sh'))
  writeFileSync(join(repo, 'a.txt'), 'one')
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  git('add', '.')
  git('commit', '-q', '-m', 'one')
  git('remote', 'add', 'origin', join(root, 'origin.git'))
  git('push', '-q', 'origin', 'main')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const REFUSED = /geenee production is released only from a pushed prod-YYYY-MM-DD\[\.N\] tag/

describe('releasing geenee production', () => {
  it('refuses a branch', () => {
    const { status, stderr } = deploy('main')

    expect(status).not.toBe(0)
    expect(stderr).toMatch(REFUSED)
  })

  for (const tag of ['v1.0', 'prod-2026-11', 'prod-2026-11-12-hotfix', 'view-prod-2026-11-12']) {
    it(`refuses the tag ${tag}, which is not a prod- tag`, () => {
      git('tag', tag)
      git('push', '-q', 'origin', tag)

      const { status, stderr } = deploy(tag)

      expect(status).not.toBe(0)
      expect(stderr).toMatch(REFUSED)
    })
  }

  it('refuses a prod- tag that has not been pushed', () => {
    git('tag', 'prod-2026-11-12')

    const { status, stderr } = deploy('prod-2026-11-12')

    expect(status).not.toBe(0)
    expect(stderr).toContain('prod-2026-11-12 is not on origin: push it first')
  })

  it('refuses a prod- tag that names another commit on origin', () => {
    git('tag', 'prod-2026-11-12')
    git('push', '-q', 'origin', 'prod-2026-11-12')
    git('commit', '-q', '--allow-empty', '-m', 'two')
    git('tag', '-f', 'prod-2026-11-12')

    const { status, stderr } = deploy('prod-2026-11-12')

    expect(status).not.toBe(0)
    expect(stderr).toContain('prod-2026-11-12 is not on origin: push it first')
  })

  for (const tag of ['prod-2026-11-12', 'prod-2026-11-12.2']) {
    it(`goes past the check for the pushed tag ${tag}`, () => {
      git('tag', tag)
      git('push', '-q', 'origin', tag)

      const { stderr } = deploy(tag)

      // The next step is the Cloudflare login, which the copy cannot pass.
      expect(stderr).toContain('not logged in to Cloudflare')
      expect(stderr).not.toMatch(REFUSED)
    })
  }
})

describe('the Host check before a release', () => {
  beforeEach(() => {
    git('tag', 'prod-2026-11-12')
    git('push', '-q', 'origin', 'prod-2026-11-12')
  })

  it('asks whether it passed on geenee dev for the commit being released, naming docs/host-check.md', () => {
    const { stdout, stderr } = deploy('prod-2026-11-12')

    const asked = stdout + stderr
    expect(asked).toContain('docs/host-check.md')
    expect(asked).toContain('https://geenee-dev.3dg.io')
    expect(asked).toContain(git('rev-parse', '--short', 'prod-2026-11-12'))
  })

  for (const answer of ['no', '', 'y']) {
    it(`does not release when the answer is ${JSON.stringify(answer)}, not yes`, () => {
      const { status, stderr } = deploy('prod-2026-11-12', answer)

      expect(status).not.toBe(0)
      expect(stderr).toContain('not released: run the Host check (docs/host-check.md) on geenee dev first')
      expect(stderr).not.toContain('not logged in to Cloudflare')
    })
  }

  it('goes on to the release when the answer is yes', () => {
    const { stderr } = deploy('prod-2026-11-12', 'yes')

    expect(stderr).not.toContain('not released')
    expect(stderr).toContain('not logged in to Cloudflare')
  })
})
