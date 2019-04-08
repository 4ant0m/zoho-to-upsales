const AWS = require('aws-sdk');
const SQS = new AWS.SQS({apiVersion: '2012-11-05'});
const logger = require('../lib/log');

const saveToQueue = async (message) => {
	if(typeof message !== 'object'){
		throw new Error('Input to queue should be an object');
	}
	
	try{
		logger.info('Publishing message', message);

		await SQS.sendMessage({
			QueueUrl: process.env.SQS_QUEUE_URL,
			DelaySeconds: message.delay / 1000 || 1000,
			MessageBody: JSON.stringify(message)
		}).promise();
	}catch(e){
		logger.error('Error when sending to queue', e);
	}
};

module.exports = {
	saveToQueue
};