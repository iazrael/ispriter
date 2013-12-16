var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    us = require('underscore'),

    Config = require('./Config'),
    Logger = require('./Logger'),
    SpriteTask = require('./SpriteTask');


function iSpriter() {

    var startTime;
    EventEmitter.call(this);

    this.on('start', function(){
                startTime = +new Date;
            })
            .on('end', function(){
                var timeUse = +new Date - startTime;
                Logger.info('>>All done: Time use:', timeUse, 'ms');
            });
}

util.inherits(iSpriter, EventEmitter);

iSpriter.prototype.run = function(config) {

    var context = this;

    this.emit('start');

    // 读取和处理合图配置
    config = Config.parse(config);
    this.config = config;

    Logger.debuging = config.debug || false;

    // 创建合并任务
    SpriteTask.createTasks(this, function(tasks){
    
                tasks.forEach(function(task){

                    task.exec();
                });

                context.emit('end');
            });
}

/**
 * ispriter 的主要入口函数
 * @param  {Object|String} config ispriter 的配置对象或者是配置文件, 
 * 如不清楚请参照 README.md
 * @param {Function} done 当精灵图合并完成后触发
 */
exports.merge = function(config, done){

    new iSpriter().on('end', done)
            .run(config);
}

// Task.JS Specification API https://github.com/taskjs/spec
exports.run = function(options, done){

    exports.merge(options, done);
}
