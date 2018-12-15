'use strict';

const Eero = require('./eero-api.js')
const debug = require('debug')('eero-sample')
const readline = require('readline')
let urlIdPattern = new RegExp(/^\/(.+)\/(.+)\/(\d+)/)


var eprompt = 'eero> '
let rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: true,
	prompt: eprompt
})

var e = new Eero();
var netops = []
var options = []
var networkUrl = null
var curUrl = null

console.log('Starting eero manager...')
// get default account path
account()
rl.prompt()


function idFromUrl(url) {
	let res = urlIdPattern.exec(url)
	if (res.length >= 4) {
		return res[3]
	}
	return null
}

function setPrompt(p) {
	eprompt = p
	rl.setPrompt(eprompt)
}

function println(data) {
	console.log(data)
}

function quit() {
	println("exiting")
	rl.close()
	console.log()
	process.exit()
}

function logout() {
	e.logout()
}

function login() {
	rl.question('Enter your phone # for SMS verification: ', 
		phone => {
			if (phone) {
				e.login(phone)
				rl.question('Enter the code you received: ', 
					verify => {
						if (verify) {
							e.loginVerify(verify)
								.then(() => {
									println("Logged in")
									rl.prompt()
								})
								.catch(err => {
									println(`Verify failed: ${err.message}`)
									rl.prompt()
								})
						}
						else {
							console.log("No code entered")
						}
						rl.prompt()
					})
			}
			else {
				console.log("No phone # given")
			}
			rl.prompt()
		})
}

function account() {
	e.account().then(account => {
		println("Logged into account")
		println(account)
		if (account.networks.data.length == 1) {
			// only one account, use it
			networkUrl = account.networks.data[0].url
		}
		else {
			networkUrl = null
			if (!networkUrl) {
				var ind = 1
				for (const net of account.networks.data) {
					println(`${ind++}) ${net.name}`);
				}
				rl.question(`Enter the network to use: (1-${ind-1})`,
					netInd => {
						if (netInd <= ind-1) {
							networkUrl = account.networks.data[netInd-1].url
							println(`Using network: ${account.networks.data[netInd-1].name} (${networkUrl})`)
						}
						else {
							println("Not a valid network")
						}
						rl.prompt()
					})

			}
		}
		rl.prompt()
	}).catch(err => {
		console.log(`Error ${err.message}`)
		// no account, need to log in
		login()
	})
}

function network() {
	e.network(networkUrl)
		.then(nets => {
			println(nets)
			println("### Available commands for this network")
			netops = nets.resources
			for (const prop in netops) {
				println(prop)
			}
			rl.prompt()
		})
		.catch(err => {
			println(`Error: ${err.message}`)
			rl.prompt()
		})
}

function networks() {
	e.networks()
		.then(nets => {
			println(nets)
			rl.prompt()
		})
		.catch(err => {
			println(`Error: ${err.message}`)
			rl.prompt()
		})

}

function eeros(networkUrl) {
	e.eeros(networkUrl)
		.then(eeros => {
			println("########### EEROS ###############")
			for (const eero of eeros) {
				println(`\n*** Location: ${eero.location}`)
				println(eero)

			}
			rl.prompt()
		})
		.catch(err => {
			println(`Error: ${err.message}`)
			rl.prompt()
		})
}

function devices(networkUrl) {
	e.devices(networkUrl)
		.then(devices => {
			println("############## DEVICES ###################")
			var url = devices.url
			var types = []
			for (const dev of devices) {
				if (!dev.connected) {
					continue;
				}
				if (!types[dev.device_type]) {
					types[dev.device_type] = { 'count': 1, 'devices': [dev] }
				}
				else {
					types[dev.device_type].count += 1
					types[dev.device_type].devices.push(dev)
				}
			}

			options = []
			var ind = 1
			for (const type in types) {
				println(`type: ${type}, count: ${types[type].count}`)
				for (const typedev of types[type].devices) {
					println(`${ind++})\t\t${typedev.hostname
						} | ${typedev.nickname
						} | ${typedev.manufacturer
						} | ${typedev.connection_type}`)
					options.push( { url: typedev.url } )
				}
			}
			rl.prompt()
		})
		.catch(err => {
			println(`Error: ${err.message}`)
			rl.prompt()
		})
}

function doOption(optNum) {
	if (options[optNum-1]) {
		let url = options[optNum -1].url
		e.get(url)
			.then(res => {
				debug("got option %s: %s", optNum, url)
				println(res)

				if (res.resources) {
					options = []
					var ind = 1
					for (const ropt in res.resources) {
						println(`${ind++}) ${ropt}`)
						options.push(ropt)
					}
				}
				rl.prompt()
			})
			.catch(err => {
				println(`Error: ${err.message}`)
				rl.prompt()
			})

	}
}

function callUrl(url) {
	e.get(url)
		.then(res => {
			debug("URL %s:", url, res)
			rl.prompt()
		})
		.catch(err => {
			println(`Error: ${err.message}`)
			rl.prompt()
		})
}

function callCmd(cmd) {
	let url = netops[cmd]
	if (url) {
		e.get(url).then(res => {
			debug("CMD %s:", cmd, res)
			rl.prompt()
		})
		.catch(err => {
			println(`Error: ${err.message}`)
			rl.prompt()
		})
	}
}

rl
	.on('line', line => {
		let cmd = line.trim()
		switch(cmd) {
			case 'help':
			case '?':
				console.log("Commands: account | networks | network | eeros | login | logout | help | quit")
				break;
			case 'exit':
			case 'quit': rl.close()
				break
			case 'login': login()
				break
			case 'logout': logout()
				break
			case 'account': account()
				break
			case 'networks': networks()
				break
			case 'network': network()
				break
			case 'eeros': eeros(networkUrl)
				break
			case 'devices': devices(networkUrl)
				break
			default:
				if (/^\d+$/.test(cmd)) {
					doOption(cmd)
				}
				else if (/^\//.test(cmd)) {
					// starts with slash, it's a url, call it
					callUrl(cmd)
				}
				else if (cmd.length > 0) {
					callCmd(cmd)
				}
		}
		rl.prompt()
	})
	.on('close', () => {
		quit()
		// println('exiting')
		// process.exit()
	})
