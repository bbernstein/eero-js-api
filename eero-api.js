'use strict';

const req = require("request")
const cookieStore = require("tough-cookie-file-store")
const fs = require('fs')
const debug = require('debug')('eero')

const timeout = 5000
const apiEndpoint = "https://api-user.e2ro.com"
const apiVersion = "2.2"
const cookieFile = "/tmp/cookiefilestore2298723872398423487623"

class Eero {
	constructor() {
		// this.token = null
		this.networkUrl = null

		// make a cookie file if needed
		if (!fs.existsSync(cookieFile)) {
			let createStream = fs.createWriteStream(cookieFile)
			createStream.end()
		}
		this.cookieJar = req.jar(new cookieStore(cookieFile))
	}

	_loggedIn() {
		let cookies = this.cookieJar.getCookies(`${apiEndpoint}/${apiVersion}/`)
		for (const cookie of cookies) {
			if (cookie.key == 's') {
				debug("cookie is "+cookie.value)
				return cookie.value.length > 16
			}
		}
		debug("not logged in")
		return false
	}

	logout() {
		let options = { maxAge: 0 }
		this.cookieJar.setCookie('s=none', `${apiEndpoint}/`, options)
	}

	_post(path, form = null) {
		return new Promise((resolve, reject) => {
			let url = `${apiEndpoint}/${apiVersion}/${path}`
			debug(`_post ${url}`)
			let options = { url: url, jar: this.cookieJar, json: true, timeout: timeout }
			if (form) {
				options.form = form
			}
			req.post(
				options,
				(err, res, body) => {
					if (err) {
						reject({
							error: err, response: res, 
							message: `POST Error path: ${path}'. ERROR ${err}`
						})
						return
					}
					if (res.statusCode !== 200) {
						reject({
							error: err, response: res, 
							message: `POST failed to ${path}. Response: ${res.statusCode} ${
								res.statusMessage}`
						})

						return
					}
					resolve(body.data)
				}
			)
		})
	}

	_get(path) {
		debug("GET", path)
		return new Promise((resolve, reject) => {
			debug("_get - loggedIn?")
			if (!this._loggedIn()) {
				reject ({ error: new Error("User not logged in"), response: null, message: 'GET failed, not logged in'})
				return
			}
			let url = `${apiEndpoint}${path}`;
			let that = this
			req({ url: url, jar: this.cookieJar, json:true, timeout: timeout},
				(err, res, body) => {
					if (err) {
						reject({
							error: err, response: res, 
							message: `GET Error path: ${path}'. ERROR ${err}`
						})
						return
					}
					if (res.statusCode !== 200) {
						reject({
							error: err, response: res, 
							message: `GET failed to ${path}. Response: ${res.statusCode} ${
								res.statusMessage}`
						})
						return
					}
					debug("GET: got body, size=%s", Object.keys(body.data).length)
					resolve(body.data);
				}
			)
		})
	}

	_retryGet(path, retries = 1) {
		return this._get(path)
			.then(res => {
				return res
			})
			.catch(reject => {
				if (retries == 0) {
					if (reject.response && reject.response.statusCode == 401) {
						// we ran out of retries and its 401 status, kill the cookie
						this.logout()
						debug("FAILED, rejected 401")
						throw reject
					}
					else {
						debug("FAILED, rejected", reject)
						throw reject
					}
				}
				debug("_retryGet - loggedIn?")
				if (!this._loggedIn()) {
					// nothing to refresh, just retry
					return this._retryGet(path, retries - 1)
				}
				// refresh login and try again
				return this.loginRefresh()
					.then(() => {
						debug("Retry", path)
						return this._retryGet(path, retries - 1)
					})
					.catch(reject => {
						throw reject
					})
			})
	}

	login(identifier) {
		let form = { 'login': identifier }
		return this._post('login', form)
			.then(res => {
				return res
			})
	}

	loginVerify(verificationCode) {
		let form = { 'code': verificationCode }
		return this._post('login/verify', form)
			.then(res => {
				return res
			})
			.catch(reject => {
				if (reject.response.statusCode == 401) {
					reject.message = 'You need to login() to set up your session'
				}
				throw reject
			})
	}

	loginRefresh() {
		return this._post('login/refresh')
			.then(res => {
				return res
			})
			.catch(reject => {
				_logout()
			})
	}

	get(url) {
		return this._retryGet(url)
	}

	account() {
		return this._retryGet(`/${apiVersion}/account`)
	}

	networks() {
		return this._retryGet(`/${apiVersion}/networks`)
	}

	network(networkUrl) {
		return this._retryGet(networkUrl)
	}

	devices(networkUrl) {
		return this._retryGet(`${networkUrl}/devices`)
	}

	eeros(networkUrl) {
		return this._retryGet(`${networkUrl}/eeros`)
	}

	reboot(deviceId) {
		return this._retryGet(`eeros/${deviceId}/reboot`)
	}

}

module.exports = Eero
