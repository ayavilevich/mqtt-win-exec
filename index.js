/* eslint-disable no-console */
// load config
const dotenv = require('dotenv');

dotenv.config();

// 3rd party
const fs = require('fs');
const child_process = require('child_process'); // eslint-disable-line camelcase

const mqtt = require('mqtt');
const JSON5 = require('json5');

// consts
const CONSTANTS = {
	EXEC_METHODS: {
		EXEC: 'exec',
		EXEC_FILE: 'execFile',
	},
};

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

// functions
function executeTopicCallback(error, stdout, stderr) {
	console.log(`Done execution of command. Error ${error}, Stdout: ${stdout}, Stderr: ${stderr}`);
}

function executeTopic(topic, inCommand, callback = executeTopicCallback) {
	// handle flexibility in input format
	let command;
	if (typeof inCommand === 'string') {
		command = {
			method: CONSTANTS.EXEC_METHODS.EXEC,
			command: inCommand,
		};
	} else {
		command = inCommand;
	}
	// execute
	switch (command.method) {
	case CONSTANTS.EXEC_METHODS.EXEC:
		if (command.args) {
			child_process.exec(`${command.command} ${command.args}`, callback);
		} else {
			child_process.exec(command.command, callback);
		}
		break;
	case CONSTANTS.EXEC_METHODS.EXEC_FILE:
		child_process.execFile(command.command, command.args, callback);
		break;
	default:
		console.error(`Invalid exec method: ${command.method}`);
		break;
	}
}

function publishTopic(topic, command) {
	console.log('pub', topic);
	executeTopic(topic, command, (error, stdout, stderr) => {
		// console.log(`Done execution of command. Error ${error}, Stdout: ${stdout}, Stderr: ${stderr}`);
		if (error) {
			console.error(error);
		}
		mqttClient.publish(topic, stdout);
		if (stderr) {
			mqttClient.publish(`${topic}/error`, stderr);
		}
	});
}

// main logic
mqttClient.on('connect', () => {
	// subscribe
	const subTopics = Object.keys(topics.subscribe);
	console.info(`Subscribe to topics...: ${subTopics}`);
	mqttClient.subscribe(subTopics);
	// handle incoming messages
	mqttClient.on('message', (topic, message) => {
		console.log(`topic: ${topic}, payload: ${message.toString()}`);
		executeTopic(topic, topics.subscribe[topic]);
	});
	// create intervals for sending
	const pubTopics = Object.keys(topics.publish);
	pubTopics.forEach((topic) => {
		// run right away
		publishTopic(topic, topics.publish[topic].command);
		// setup interval
		if (topics.publish[topic].intervalHandle) {
			clearInterval(topics.publish[topic].intervalHandle);
		}
		topics.publish[topic].intervalHandle = setInterval(() => { publishTopic(topic, topics.publish[topic].command); }, topics.publish[topic].interval * 1000);
	});
});

mqttClient.on('error', (error) => {
	console.error('MQTT error', error);
});
