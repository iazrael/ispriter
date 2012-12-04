// var spriter = require('ispriter');
var spriter = require('../');
var path = require('path');

var configFile = '../src/config.json';

spriter.merge(configFile);
spriter.merge('css/style.css');
spriter.merge('css/');