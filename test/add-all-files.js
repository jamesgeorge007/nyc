'use strict'

const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

const t = require('tap')
const ap = require('any-path')

const NYC = require('../self-coverage')
const configUtil = require('../self-coverage/lib/config-util')

const resetState = require('./helpers/reset-state')

const fixtures = path.resolve(__dirname, 'fixtures')
const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)

const transpileHook = path.resolve(__dirname, 'fixtures/transpile-hook')

t.beforeEach(resetState)

t.test('outputs an empty coverage report for all files that are not excluded', async t => {
  const nyc = new NYC(configUtil.buildYargs(fixtures).parse())
  nyc.reset()
  nyc.addAllFiles()

  const notLoadedPath = path.join(fixtures, './not-loaded.js')
  const reports = nyc.loadReports().filter(report => ap(report)[notLoadedPath])
  const report = reports[0][notLoadedPath]

  t.strictEqual(reports.length, 1)
  t.strictEqual(report.s['0'], 0)
  t.strictEqual(report.s['1'], 0)
})

t.test('outputs an empty coverage report for multiple configured extensions', async t => {
  const cwd = path.resolve(fixtures, './conf-multiple-extensions')
  const nyc = new NYC(configUtil.buildYargs(cwd).parse())
  nyc.reset()
  nyc.addAllFiles()

  const notLoadedPath1 = path.join(cwd, './not-loaded.es6')
  const notLoadedPath2 = path.join(cwd, './not-loaded.js')
  const reports = nyc.loadReports().filter(report => {
    const apr = ap(report)
    return apr[notLoadedPath1] || apr[notLoadedPath2]
  })

  t.strictEqual(reports.length, 1)

  const report1 = reports[0][notLoadedPath1]
  t.strictEqual(report1.s['0'], 0)
  t.strictEqual(report1.s['1'], 0)

  const report2 = reports[0][notLoadedPath2]
  t.strictEqual(report2.s['0'], 0)
  t.strictEqual(report2.s['1'], 0)
})

t.test('transpiles .js files added via addAllFiles', async t => {
  await writeFile(
    './test/fixtures/needs-transpile.js',
    '--> pork chop sandwiches <--\nconst a = 99',
    'utf-8'
  )

  const nyc = new NYC(configUtil.buildYargs(fixtures).parse(['--require', transpileHook]))
  nyc.reset()
  nyc.addAllFiles()

  const needsTranspilePath = path.join(fixtures, './needs-transpile.js')
  const reports = nyc.loadReports().filter(report => ap(report)[needsTranspilePath])
  const report = reports[0][needsTranspilePath]

  t.strictEqual(reports.length, 1)
  t.strictEqual(report.s['0'], 0)

  await unlink(needsTranspilePath)
})

t.test('does not attempt to transpile files when they are excluded', async t => {
  const notNeedTranspilePath = path.join(fixtures, './do-not-need-transpile.do-not-transpile')
  await writeFile(
    notNeedTranspilePath,
    '--> pork chop sandwiches <--\nconst a = 99',
    'utf-8'
  )

  const nyc = new NYC(configUtil.buildYargs(fixtures).parse([
    `--require=${transpileHook}`,
    '--extension=.do-not-transpile',
    '--include=needs-transpile.do-not-transpile'
  ]))

  nyc.reset()

  // If this ran against *.do-not-transpile it would throw
  nyc.addAllFiles()
  await unlink(notNeedTranspilePath)
})

t.test('transpiles non-.js files added via addAllFiles', async t => {
  await writeFile(
    './test/fixtures/needs-transpile.whatever',
    '--> pork chop sandwiches <--\nconst a = 99',
    'utf-8'
  )

  const nyc = (new NYC(configUtil.buildYargs(fixtures).parse([
    `--require=${transpileHook}`,
    '--extension=.whatever'
  ])))

  nyc.reset()
  nyc.addAllFiles()

  const needsTranspilePath = path.join(fixtures, './needs-transpile.whatever')
  const reports = nyc.loadReports().filter(report => ap(report)[needsTranspilePath])
  const report = reports[0][needsTranspilePath]

  t.strictEqual(reports.length, 1)
  t.strictEqual(report.s['0'], 0)

  await unlink(needsTranspilePath)
})
