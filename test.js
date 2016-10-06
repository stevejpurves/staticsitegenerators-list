const joe = require('joe')
const fs = require('fs')
const {equal} = require('assert-helpers')
const assert = require('assert')
const validSPDX = require('spdx-expression-validate')
const ssgs = require('./')
const {sort, sourcePath, renderPath} = require('./util')

function checkURL (url, next) {
	const http = (/^https/).test(url) ? require('https') : require('http')
	const req = http.get(url, (res) => {
		try {
			equal(res.statusCode, 200, 'response http status code should be 200 success')
		}
		catch (err) {
			return next(err)
		}
		res.destroy()
		return next()
	})
	req.on('error', function (err) {
		req.destroy()
		next(err)
	})
	req.setTimeout(30 * 1000, function () {
		req.destroy('socket timed out')
	})
}

joe.suite('static site generators list', function (suite, test) {
	let data = null

	test('load content', function (done) {
		ssgs.source(function (err, result) {
			if (err)  return done(err)
			data = result
			return done()
		})
	})

	test('minimum required fields', function () {
		const missingIs = []
		data.forEach(function (entry) {
			const {name, github, gitlab, bitbucket, website, is} = entry
			const location = (github || gitlab || bitbucket || website)
			assert(name && location, `missing required fields on ${name || location}`)
			if ( !is )  missingIs.push(name)
		})
		console.warn(`The following entries are missing the "is" field, please add what you can if you have time:\n${missingIs.join(', ')}`)
	})

	test('licenses are valid SPDX', function () {
		data.forEach(function ({name, license}) {
			if ( license ) {
				assert(validSPDX(license), `${name}: license of ${license} is not a valid SPDX identifier: http://spdx.org/licenses/`)
			}
		})
	})

	suite('uris are valid / still exist', function (suite, test) {
		this.setConfig({concurrency: 30})
		data.forEach(function ({name, github, website, testWebsite}) {
			if ( github ) {
				github = `https://github.com/${github}`
				test(`${name}: http get github: ${github}`, function (done) {
					checkURL(github, done)
				})
			}
			if ( website && testWebsite !== false ) {
				test(`${name}: http get website: ${website}`, function (done) {
					checkURL(website, done)
				})
			}
		})
	})

	suite('render', function (done) {
		this.setConfig({concurrency: 0})
		ssgs.render({corrective: true}, function (err, results, sources) {
			if ( err )  return done(err)
			test(`writing corrected source listing ${sourcePath}`, function (done) {
				fs.writeFile(sourcePath, JSON.stringify(sources, null, '  '), done)
			})
			test(`writing rendered listing to ${renderPath}`, function (done) {
				fs.writeFile(renderPath, JSON.stringify(results, null, '  '), done)
			})
			done()
		})
	})

})
