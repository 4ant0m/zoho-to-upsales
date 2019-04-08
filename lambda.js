const listener = require('./sqs/listener');

exports.handler = async (event) => {
	for(const record of event.Records) {
		const body = JSON.parse(record.body);
		await listener(body);
	}
};
