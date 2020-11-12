# mqtt-win-exec
An agent to execute commands in response to mqtt messages and publish result of command executions.

One example of use would be in a home automation scenario. You can install this tool on a Windows or linux machine and then control it centrally from Home Assistant or a similar software. You would also require a MQTT broker.

This tool only executes pre-defined set of commands. This is by design due to security considerations.

This was developed with Windows in mind as linux machines have more options from the get-go but it should run on any platform that is supported by nodejs. You would need to define proper command for your OS, of course.

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

## Troubleshooting

MQTT can be debugged per https://github.com/mqttjs/MQTT.js/blob/master/README.md#debug-logs , by setting the 'DEBUG' env var to 'mqttjs*'.

This can be set on a service by adding:

```
	env: [{
		name: "DEBUG",
		value: "mqttjs*",
	}],
```

to the windows-service-install.js script, then uninstalling and re-installing the service. Debug output of the service then goes to .\daemon\mqttwinexec.err.log .

## Some useful powershell scripts that you can use with this executor

updates.ps1

```
$u = New-Object -ComObject Microsoft.Update.Session
$u.ClientApplicationID = 'MSDN Sample Script'
$s = $u.CreateUpdateSearcher()
$r = $s.Search("IsInstalled=0 and Type='Software' and IsHidden=0")
#$r = $s.Search('IsInstalled=0')
$r.updates|Select-Object -ExpandProperty Title
```

notification.ps1

```
param (
	[string]$notificationTitle = "Notification: " + [DateTime]::Now.ToShortTimeString()
)

$ErrorActionPreference = "Stop"

[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText01)

#Convert to .NET type for XML manipuration
$toastXml = [xml] $template.GetXml()
$toastXml.GetElementsByTagName("text").AppendChild($toastXml.CreateTextNode($notificationTitle)) > $null

#Convert back to WinRT type
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($toastXml.OuterXml)

$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
$toast.Tag = "PowerShell"
$toast.Group = "PowerShell"
$toast.ExpirationTime = [DateTimeOffset]::Now.AddSeconds(5)
#$toast.SuppressPopup = $true

$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("PowerShell")
$notifier.Show($toast);
```

## Credits

Inspired by

https://gitlab.com/iotlink/iotlink  
https://github.com/denschu/mqtt-exec  
https://github.com/msiedlarek/winthing  
https://github.com/jpmens/mqtt-launcher  
https://github.com/rainu/mqtt-executor  
