// load config
const dotenv = require('dotenv');

dotenv.config();

// 3rd party
const fs = require('fs');

const mqtt = require('mqtt');
const JSON5 = require('json5');

// start run
if (!process.env.MQTT_BROKER_URL || !process.env.TOPICS_JSON_FILE) {
	console.error('Invalid parameters passed');
	process.exit();
}

// load topics config
const topics = JSON5.parse(fs.readFileSync(process.env.TOPICS_JSON_FILE));
console.log(topics);

// connect to mqtt broker
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL);

mqttClient.on('connect', function () {
	const subTopics = ['test'];
	console.info("Subscribe to topics...: " + subTopics);
	mqttClient.subscribe(subTopics);
	mqttClient.on('message', function (topic, message) {
		console.log(topic);
		console.log(message, message.toString());
	});
});

mqttClient.on('error', function (error) {
	console.error('MQTT error', error);
});
