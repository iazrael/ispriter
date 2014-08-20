var fs = require('fs'),
    path = require('path'),
    us = require('underscore'),
    util = require('util'),

    EventEmitter = require('events').EventEmitter,


    FileTool = require('../FileTool'),
    Logger = require('../Logger');

// canvas 的 node-canvas 实现
var Canvas = require('./Canvas').Canvas;
var Image = require('./Canvas').Image;

// TODO 未完成