// node
const fs = require('fs');
const os = require('os');
const child_process = require('child_process'); // eslint-disable-line camelcase

// 3rd party
const mqtt = require('mqtt');
const JSON5 = require('json5');
const log4js = require('log4js');
const moment = require('moment');
const { substituteVariables } = require('var-expansion'); // https://www.npmjs.com/package/var-expansion

// load config
const dotenv = require('dotenv');

dotenv.config();

// configure logger
log4js.configure({
	appenders: {
		// file appender
		file: { type: 'file', filename: process.env.LOG_FILE_PATH },
		// std out appender
		out: { type: 'stdout' },
	},
	categories: { default: { appenders: ['file', 'out'], level: 'debug' } },
});
const logger = log4js.getLogger();

// consts
const CONSTANTS = {
	EXEC_METHODS: {
		EXEC: 'exec',
		EXEC_FILE: 'execFile',
	},
	INTERVAL_PERIOD_DEFAULT_MS: 10000,
	TOPIC_EXPANSION: {
		HOSTNAME: os.hostname(), // https://nodejs.org/api/os.html
	},
};

// start run
if (!process.env.MQTT_BROKER_URL || !process.env.TOPICS_JSON_FILE_PATH) {
	logger.error('Invalid parameters passed');
	process.exit();
}

// load topics config
const topics = JSON5.parse(fs.readFileSync(process.env.TOPICS_JSON_FILE_PATH));
logger.debug(topics);

// functions for expansion
function expandTopic(topic) {
	const { value, error } = substituteVariables(topic, { env: CONSTANTS.TOPIC_EXPANSION });
	if (error) {
		logger.error(error);
		return topic;
	}
	return value;
}

function expandTopicsInList(list) {
	const topicsToChange = Object.keys(list);
	topicsToChange.forEach((topic) => {
		const newTopic = expandTopic(topic);
		if (newTopic !== topic) {
			list[newTopic] = list[topic]; // eslint-disable-line no-param-reassign
			delete list[topic]; // eslint-disable-line no-param-reassign
		}
	});
}

// expand topics
expandTopicsInList(topics.subscribe);
expandTopicsInList(topics.publish);
if (topics.mqttConnectOptions && topics.mqttConnectOptions.will && topics.mqttConnectOptions.will.topic) {
	topics.mqttConnectOptions.will.topic = expandTopic(topics.mqttConnectOptions.will.topic);
}
if (topics.startTopic && topics.startTopic.topic) {
	topics.startTopic.topic = expandTopic(topics.startTopic.topic);
}
logger.debug(topics);

// connect to mqtt broker
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL, topics.mqttConnectOptions);

// misc utility functions

// https://momentjs.com/docs/#/durations/
function intervalPeriodToMs(intervalPeriod) {
	if (typeof intervalPeriod === 'number') {
		// assume seconds
		return intervalPeriod * 1000;
	}
	if (typeof intervalPeriod === 'string') {
		const ms = moment.duration(intervalPeriod).asMilliseconds();
		if (!ms) {
			logger.error('Invalid interval period passed', intervalPeriod);
			return CONSTANTS.INTERVAL_PERIOD_DEFAULT_MS;
		}
		return ms;
	}
	return CONSTANTS.INTERVAL_PERIOD_DEFAULT_MS;
}

function executeTopicCallback(error, stdout, stderr) {
	logger.info(`Done execution of command. Error ${error}, Stdout: ${stdout}, Stderr: ${stderr}`);
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
			logger.error(`Invalid exec method: ${command.method}`);
			break;
	}
}

function publishCallback(error) {
	if (error) {
		logger.warn('Error publishing', error);
	}
}

function publishTopic(topic, command, mqttPublishOptions) {
	logger.info('publish', topic);
	executeTopic(topic, command, (error, stdout, stderr) => {
		// logger.info(`Done execution of command. Error ${error}, Stdout: ${stdout}, Stderr: ${stderr}`);
		if (error) {
			logger.error('Execute topic error:', error);
		}
		mqttClient.publish(topic, stdout, mqttPublishOptions, publishCallback);
		if (stderr) {
			mqttClient.publish(`${topic}/error`, stderr, mqttPublishOptions, publishCallback);
		}
	});
}

// main logic
mqttClient.on('connect', () => {
	// subscribe
	const subTopics = Object.keys(topics.subscribe);
	logger.info(`Subscribe to topics...: ${subTopics}`);
	mqttClient.subscribe(subTopics);
	// handle incoming messages
	mqttClient.on('message', (topic, message) => {
		logger.info(`incoming topic: ${topic}, payload: ${message.toString()}`);
		executeTopic(topic, topics.subscribe[topic]);
	});
	// publish start topic
	if (topics.startTopic) {
		logger.info('publish', topics.startTopic.topic);
		mqttClient.publish(topics.startTopic.topic, topics.startTopic.payload, topics.startTopic.mqttPublishOptions, publishCallback);
	}
	// create intervals for sending
	const pubTopics = Object.keys(topics.publish);
	pubTopics.forEach((topic) => {
		const topicObject = topics.publish[topic];
		logger.info(`Topic: ${topic}, intervalPeriod: ${topicObject.intervalPeriod}, in seconds: ${intervalPeriodToMs(topicObject.intervalPeriod) / 1000}`);
		if (topicObject.runAtStart !== false) { // default is 'true'. set to 'false' to not run the command at start
			// run right away
			publishTopic(topic, topicObject.command, topicObject.mqttPublishOptions);
			// setup interval
			if (topicObject.intervalHandle) {
				clearInterval(topicObject.intervalHandle);
			}
			topicObject.intervalHandle = setInterval(() => {
				publishTopic(topic, topicObject.command, topicObject.mqttPublishOptions);
			}, intervalPeriodToMs(topicObject.intervalPeriod));
		}
	});
});

mqttClient.on('error', (error) => {
	logger.error('MQTT error', error);
});

mqttClient.on('reconnect', () => {
	logger.warn('MQTT reconnect');
});

mqttClient.on('disconnect', () => {
	logger.warn('MQTT disconnect');
});

mqttClient.on('offline', () => {
	logger.warn('MQTT offline');
});

mqttClient.on('close', () => {
	logger.warn('MQTT close');
});

mqttClient.on('end', () => {
	logger.warn('MQTT end');
});
