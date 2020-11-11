# mqtt-win-exec
An agent to execute commands in response to mqtt messages and publish result of command executions

## Installation instructions

Have git and the node runtime installed (https://nodejs.org/). If you prefer not to install git you can download the zip and expand it manually.

```
git clone https://github.com/ayavilevich/mqtt-win-exec
cd mqtt-win-exec
npm i
```

Create a `.env` based on `.env.sample`.  
Create a `topics.json5` based on `topics.sample.json5` and reference it in the `.env`.  

```
node index.js
```

See that it works. Check that you are able to get and send mqtt messages. If all is correct, install as a service on Windows:

```
node windows-service-install.js
```

This will run the Windows 'net' command several times as an Administrator to add and configure the new service.

## TODO

None at this time

## Credits

Inspired by

https://gitlab.com/iotlink/iotlink  
https://github.com/denschu/mqtt-exec  
https://github.com/msiedlarek/winthing  
https://github.com/jpmens/mqtt-launcher  
https://github.com/rainu/mqtt-executor  
