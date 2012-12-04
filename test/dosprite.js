// var spriter = require('ispriter');
var spriter = require('../');
var path = require('path');

var configFile = '../src/config.json';

spriter.merge(configFile);
spriter.merge(path.resolve('css/style.css'));
spriter.merge(path.resolve('css/'));
