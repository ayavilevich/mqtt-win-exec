module.exports = {
	env: {
		browser: true,
		commonjs: true,
		es2021: true,
	},
	extends: [
		'airbnb-base',
	],
	parserOptions: {
		ecmaVersion: 12,
	},
	rules: {
		'max-len': [
			'error',
			{
				code: 200,
			},
		],
		indent: [
			'error',
			'tab',
		],
		'no-tabs': 0,
	},
};
