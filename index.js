const API_URI = 'https://smart.gardena.com/v1/';

const rp = require('request-promise-native');
const jq = require('json-query');
var timeout;

let Service, Characteristic;

module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUID = homebridge.hap.uuid;

  FakeGatoHistoryService = require("fakegato-history")(homebridge);
  homebridge.registerAccessory("homebridge-gardena-smart", "gardena-smart", MyGardenaSmart);
};

function MyGardenaSmart(log, config) {
  this.log = log;
  this.username = config['username'];
  this.password = config['password'];
  this.manufactInfo = "Gardena";
  this.modelInfo = config['model'];
  this.updateInterval = config['updateInterval']
  this.serialNumberInfo = null;
  this.batteryLevel = null;
  
  this.user_id = null;
  this.locationId = null;
  this.devices = this.updateDevices();;
  this.lastupdate = Date.now();
}

MyGardenaSmart.prototype = {

//

  getToken: function () {
    const me = this;

    return new Promise((resolve, reject) => {
      let token = me.token;
      //me.log('getToken', 'try token.expires: ' + (token ? token.expires : 'null'));
      if (token && token.expires && token.expires > Date.now()) {
        //me.log('getToken', 'use existing token');
        resolve(me.token);
        return;
      }

      const options = {
        method: 'POST',
        uri: API_URI + 'auth/token',
        body: {data: {type: 'token', attributes: {username: this.username, password: this.password}}},
        json: true // Automatically stringifies the body to JSON
      };

      rp(options)
        .then(function (response) {
          const data = response.data;
          me.log('getToken', 'Successful login');

          // Handle attributes
          const attributes = data['attributes'];
          const expires = Date.now() + attributes['expires_in'] - 5000;
          const provider = attributes['provider'];
          const user_id = attributes['user_id'];

          me.locationId = null;
          me.user_id = user_id;

          // Set token
          token = {
            token: data.id,
            expires: expires,
            provider: provider,
            user_id: user_id,
          };

          me.token = token;
          resolve(me.token);
        })
        .catch(function (err) {
          me.log('Cannot get Token', {options}, err.statusCode, err.statusMessage);
          reject(err);
        });
    });
  },

  getUserId: async function () {
    if (!this.user_id) {
      this.log('getUserId', 'get user_id');
      const token = await this.getToken();
      const user_id = token.user_id;
      this.user_id = user_id;
      //this.log('getUserId', {user_id});
    }

    return this.user_id;
  },

  getLocationsLocationId: async function () {
    if (this.locationId === null) {
      //this.log('getLocationsLocationId', 'get locationId');
      const query = 'locations[0].id';
      const locationId = await this.queryLocations(query);
      //this.log('getLocationsLocationId', {locationId});
      this.locationId = locationId;

    }
    return this.locationId;
  },

  queryLocations: async function (query) {
    const data = await this.getLocations();
    const result = jq(query, {data});
    // this.log('queryLocations', {data, query, result});
    return result ? result.value : null;
  },

  getLocations: async function () {
    const user_id = await this.getUserId();

    return await this.callApi(
      'GET',
      API_URI + 'locations',
      {
        //locationId: null,
        user_id: user_id,
      }
    );
  },

 
  getDevicesSensorStatus: async function () {
    const query = 'devices[category=sensor2].abilities[type=device_info][properties][name=connection_status].value';
    return await this.queryDevices(query);
  },


  getDevicesSensorHumidity: async function () {
    const query = 'devices[category=sensor2].abilities[type=soil_humidity_sensor][properties][name=humidity].value';
    return await this.queryDevices(query);
  },

//  getDevicesSensorLight: async function () {
//    const query = 'devices[category=sensor].abilities[type=light_sensor][properties][name=light].value';
//    return await this.queryDevices(query);
//  },


  getDevicesSensorTemperature: async function () {
    const query = 'devices[category=sensor2].abilities[type=soil_temperature_sensor][properties][name=temperature].value';
    return await this.queryDevices(query);
  },


  getDevicesBatteryLevel: async function () {
    if (this.batteryLevel == null) {
      const query = 'devices[category=sensor2].abilities[type=battery_power].properties[name=level].value';
      this.batteryLevel = await this.queryDevices(query);
    }
    return this.batteryLevel;
  },

  getSerialNumber: async function () {
    if (this.serialNumber == null) {
      const query = 'devices[category=sensor2].abilities[type=device_info].properties[name=serial_number].value';
      const serial = await this.queryDevices(query);
      this.serialNumber = serial;
      return serial;
    }
    return this.serialNumber;
  },

  // general helper method to query json
  queryDevices: async function (query) {
    const data = await this.getDevices();
    const result = jq(query, {data});

    return result ? result.value : null;
  },

  // update devices from API
  updateDevices: async function () {
    const locationId = await this.getLocationsLocationId();
    this.devices = await this.callApi(
      'GET',
      API_URI + 'devices',
      {
        locationId: locationId
      }
    );

    return this.devices;
  },

  getDevices: async function () {
    const millidifference = Date.now() - this.lastupdate;
    if (Math.floor(millidifference / 1000) > this.updateInterval) {
      //this.log("Refreshing device data from server");
      data = await this.updateDevices();
      this.devices = data;
      this.lastupdate = Date.now();
    }
    return this.devices;
  },

  callApi: async function (method, uri, qs, body) {
    const me = this;
    const token = await this.getToken();

    return new Promise((resolve, reject) => {
      const options = {
        method: method,
        uri: uri,
        qs: qs,
        body: body,
        headers: {
          'Authorization': 'Bearer ' + token.token,
          'Authorization-Provider': token.provider,
        },
        json: true // Automatically parses the JSON string in the response
      };

      rp(options)
        .then(function (response) {
          resolve(response);
        })
        .catch(function (err) {
          me.log('Cannot call API.', {options}, err.statusCode, err.statusMessage);
          reject(err);
        });

    });
  },

  updateSensorData: async function () {
    const value = await this.getDevicesSensorHumidity();
    const temperature = await this.getDevicesSensorTemperature();
    //const light = await this.getDevicesSensorLight();

    this.fakeGatoHistoryService.addEntry({
                time: new Date().getTime() / 1000,
                temp: temperature,
                humidity: value
    });
  

    this.log('Update sensor data. Humidtiy: ', value + "; temperature: " + temperature );
    // repeat this every 10 minutes
    timeout = setTimeout(this.updateSensorData.bind(this), 10 * 60 * 1000);

  },
  

  getDevicesSensorStatusCharacteristic: async function (next) {
    next(null, 1);
    /*const status = await this.getDevicesSensorStatus();
    statusBool = ['online'].includes(status);

    const sensorStatus = statusBool ? 1 : 0;
    next(null, sensorStatus);*/
  },

  getBatteryLevelCharacteristic: async function (next) {
    const value = await this.getDevicesBatteryLevel();
    // this.log('getBatteryLevelCharacteristic', {value});
    next(null, value);
  },

  getSerialNumberCharacteristic: async function (next) {
    const value = await this.getSerialNumber();
    // this.log('getBatteryLevelCharacteristic', {value});
    next(null, value);
  },

  getSensorHumidityCharacteristic: async function (next) {
    const value = await this.getDevicesSensorHumidity();
    //this.log('getSensorHumidityCharacteristic', {value});
    next(null, value);
  },

  getSensorTemperatureCharacteristic: async function (next) {
    const value = await this.getDevicesSensorTemperature();
    //this.log('getSensorHumidityCharacteristic', {value});
    next(null, value);
  },

  //getSensorLightCharacteristic: async function (next) {
  //const value = await this.getDevicesSensorLight();
    //this.log('getSensorLightCharacteristic', {value});
  //  next(null, value);
  //},



  getServices: function () {
    this.services = [];

    /* Information Service */

    let informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufactInfo)
      .setCharacteristic(Characteristic.Model, this.modelInfo)
      .getCharacteristic(Characteristic.SerialNumber)
        .on('get', this.getSerialNumberCharacteristic.bind(this));;
    this.services.push(informationService);

    this.fakeGatoHistoryService = new FakeGatoHistoryService("room", this, { storage: 'fs' });
    this.services.push(this.fakeGatoHistoryService)

    /* Battery Service */

    let batteryService = new Service.BatteryService("Battery");
    batteryService
      .setCharacteristic(Characteristic.ChargingState, 
                        Characteristic.ChargingState.NOT_CHARGEABLE);
    batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .on('get', this.getBatteryLevelCharacteristic.bind(this));
    this.services.push(batteryService);

    /* Humidity Service */
    
    let humidityService = new Service.HumiditySensor('Soil Humidity');
    humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on('get', this.getSensorHumidityCharacteristic.bind(this));
    humidityService.getCharacteristic(Characteristic.StatusActive)
      .on('get', this.getDevicesSensorStatusCharacteristic.bind(this));
    this.services.push(humidityService);
    
     /* Temperature Service */
    
    let temperatureService = new Service.TemperatureSensor('Soil Temperature');
    temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getSensorTemperatureCharacteristic.bind(this));
    temperatureService.getCharacteristic(Characteristic.StatusActive)
      .on('get', this.getDevicesSensorStatusCharacteristic.bind(this));

    this.services.push(temperatureService);

     /* Light Service 
    
    let lightService = new Service.LightSensor('Ambient Light');
    lightService
      .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
      .setProps({
                    minValue: 0,
                    maxValue: 100000
                })
      .on("get", this.getSensorLightCharacteristic.bind(this));
    
    this.services.push(lightService);
    */



    this.updateSensorData();
    /* Switch Service */

    /*
    let switchService = new Service.Switch('Auto/Home');
    switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchOnCharacteristic.bind(this))
      .on('set', this.setSwitchOnCharacteristic.bind(this));
    this.services.push(switchService);
    */

  
    return this.services;
  },
  
  /*
    getSwitchOnCharacteristic: function (next) {
      const me = this;
      var onn = false;
      request({
          url: me.statusUrl,
          method: 'GET',
        },
        function (error, response, body) {
          if (error) {
            me.log(error.message);
            return next(error);
          }
          var obj = JSON.parse(body);
          if (obj.status.mode === 0) {
            onn = true;
          }
          return next(null, onn);
        });
    },

    setSwitchOnCharacteristic: function (on, next) {
      const me = this;
      if (on) {
        me.setModeUrl = me.setAutoModeUrl;
      } else {
        me.setModeUrl = me.setHomeModeUrl;
      }
      request({
          url: me.setModeUrl,
          method: 'GET',
        },
        function (error, response) {
          if (error) {
            me.log(error.message);
            return next(error);
          }
          return next();
        });
    },
     */
};
