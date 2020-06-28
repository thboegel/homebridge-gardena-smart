[![npm](https://img.shields.io/npm/v/homebridge-gardena-smart.svg?style=plastic)](https://www.npmjs.com/package/homebridge-gardena-smart)
[![npm](https://img.shields.io/npm/dt/homebridge-gardena-smart.svg?style=plastic)](https://www.npmjs.com/package/homebridge-gardena-smart)
[![GitHub last commit](https://img.shields.io/github/last-commit/thboegel/homebridge-gardena-smart.svg?style=plastic)](https://github.com/thboegel/homebridge-gardena-smart)
# homebridge-gardena-smart

This [homebridge](https://github.com/nfarina/homebridge) plugin provides Homekit and Eve support for Gardena smart sensors that allow to measure soil humidity and temperature. The requirement is a Gardena sensor with [smart system](https://www.gardena.com/int/products/smart) connection via a Gardena gateway.
Supports [fakegato-history](https://github.com/simont77/fakegato-history) to show a history graph of humidity and temperatures.


## Usage

`npm install -g homebridge-gardena-smart`

## Configuration

Add the following to your homebridge config.json
``` json
"accessories": [
	{  
		"accessory": "gardena-smart",  
		"name": "name-of-your-sensor",  
		"manufacturer": "Sensor Manufacturer",  
		"model": "Sensor Model",
		"username": "Gardena Username",
		"password": "Gardena Password"
	}  
],
```

## Credits
This plugin is a fork from [homebridge-gardena-mower](https://github.com/neuhausf/homebridge-gardena-mower) by [neuhausf](https://github.com/neuhausf).
