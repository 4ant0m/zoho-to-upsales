const queue = require('./queue');
const logger = require('../lib/log');
const integrate = require('../index.js');
const configApp = require('./config');


exports.handleMsgFromUpsales = async (msg) => {
	let config = msg.config;
	integrate({
		zoho:{
			clientId: config.zoho.clientId,
			clientSecret: config.zoho.clientSecret,
			redirectUrl: config.zoho.redirectUrl,
			userId: config.zoho.redirectUrl,
			grantToken: config.zoho.grantToken
		},
		upsales: {
			apiKey: config.upsales.apiKey,
			clientId: config.upsales.clientId,
			importId: config.upsales.importId
		}
	});
	
	/*return queue.saveToQueue({
		source: 'zoho',
		topic: 'users',
		type: 'users-created-v1',
		collections:  ,
		config: config
	});*/
};
