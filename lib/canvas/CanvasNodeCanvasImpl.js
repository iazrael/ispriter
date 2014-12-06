var fs = require('fs'),
    path = require('path'),
    us = require('underscore'),
    util = require('util'),

    EventEmitter = require('events').EventEmitter,


    FileTool = require('../fileTool'),
    Logger = require('../logger');

// canvas 的 node-canvas 实现
var Canvas = require('./canvas').Canvas;
var Image = require('./canvas').Image;

// TODO 未完成