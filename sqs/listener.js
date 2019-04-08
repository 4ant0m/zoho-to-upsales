const initController = require('./init');
const logger = require('../lib/log');


const isUpsalesInitMessage = message => {
	return (
		message &&
		message.entity === 'init' && 
		message.type === 'init'
	);
};

module.exports = async (message) => {
	if(!message){
		throw new Error('Message is required');
	}

	logger.info('Handling messager', message);
	if(message.source === 'upsales'){
		if(isUpsalesInitMessage(message)){
			return await initController.handleMsgFromUpsales(message);
		}else{
			throw new Error('No controller for message');
		}
	}else{
		throw new Error('No controller for message');
	}
	logger.info('Done with message', message);
};
