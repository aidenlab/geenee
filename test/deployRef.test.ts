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
const deploy = (ref: string) => {
  // No wrangler on the PATH the copy sees, so a ref that got past the check would fail on the login instead.
  const run = spawnSync(join(repo, 'scripts/deploy.sh'), [ref], { cwd: repo, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin', GEENEE_DEPLOYMENT: '' } })
  return { status: run.status, stderr: run.stderr }
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

      expect(stderr).not.toMatch(REFUSED)
      expect(stderr).not.toContain('is not on origin')
    })
  }
})
