/**
 * The version a build of geenee reports (scripts/version.sh): its tag or branch
 * and its short commit, read from git. Each test runs the script in a throwaway
 * repository.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = resolve(__dirname, '../scripts/version.sh')

let repo: string
const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
const version = (env: Record<string, string> = {}) =>
  execFileSync(SCRIPT, { cwd: repo, encoding: 'utf8', env: { ...process.env, GEENEE_REF: '', ...env } }).trim()

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'geenee-version-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  writeFileSync(join(repo, 'a.txt'), 'one')
  git('add', '.')
  git('commit', '-q', '-m', 'one')
})
afterEach(() => rmSync(repo, { recursive: true, force: true }))

describe('the version of a build', () => {
  it('is the tag and short commit, when built from a tag', () => {
    git('tag', 'prod-2026-11-12')
    git('checkout', '-q', '--detach', 'prod-2026-11-12')

    expect(version()).toBe(`prod-2026-11-12 (${git('rev-parse', '--short', 'HEAD')})`)
  })

  it('is the branch and short commit, when built from a branch', () => {
    expect(version()).toBe(`main (${git('rev-parse', '--short', 'HEAD')})`)
  })

  it('names the ref the deploy script gives it, over a tag at the same commit, when the checkout is detached', () => {
    git('tag', 'prod-2026-11-12')
    git('checkout', '-q', '--detach', 'main')

    expect(version({ GEENEE_REF: 'main' })).toBe(`main (${git('rev-parse', '--short', 'HEAD')})`)
  })

  it('marks the commit dirty when tracked files have uncommitted changes', () => {
    writeFileSync(join(repo, 'a.txt'), 'two')

    expect(version()).toBe(`main (${git('rev-parse', '--short', 'HEAD')}-dirty)`)
  })

  it('is "detached" and the short commit, when built from a commit on no branch or tag', () => {
    const commit = git('rev-parse', 'HEAD')
    git('checkout', '-q', '--detach', commit)

    expect(version({ GEENEE_REF: commit })).toBe(`detached (${git('rev-parse', '--short', 'HEAD')})`)
  })
})
