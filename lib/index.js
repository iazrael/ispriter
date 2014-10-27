var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    EventProxy = require('eventproxy'),
    us = require('underscore'),

    Config = require('./Config'),
    Logger = require('./Logger'),
    SpriteTask = require('./SpriteTask'),

    info = Logger.info,
    debugInfo = Logger.debug;

//其内部逻辑只是简单的做了计时log，核心逻辑在run方法的SpriteTask内
function iSpriter() {

    var startTime;
    EventEmitter.call(this);

    this.on('start', function() {

        startTime = Date.now();
        Logger.info('>>Sprite start!');
    })
        .on('end', function() {

            var timeUse = Date.now() - startTime;
            Logger.info('>>All done: Time use:', timeUse, 'ms');
        });
}

util.inherits(iSpriter, EventEmitter);

iSpriter.prototype.run = function(config) {

    var context = this;

    //触发start项目
    this.emit('start');

    // 创建一个 cache 对象来保存缓存
    this.cache = {};

    // 读取和处理合图配置
    config = Config.parse(config);
    this.config = config;

    Logger.debuging = config.debug || false;

    // Logger.debug('config=', config);

    var ep = new EventProxy();

    // 创建合并任务
    SpriteTask.createTasks(this, function(tasks) {

        ep.after('taskDone', tasks.length, function() {

            context.emit('end');
        });

        if(config.output.combine){
            // 如果指定了 combine, 先把所有 cssRules 和 styleSheet 合并
            tasks = context.combineSpriteTasks(tasks);
        }

        tasks.forEach(function(task) {

            task.exec(ep.group('taskDone'));
        });
    });
};


/**
 * 合并所有 spriteTask
 * @param  {Array} spriteTaskArray 
 * @return {Array} 转换后的 SpriteTask 数组, 只会包含一个 SpriteTask
 */
iSpriter.prototype.combineSpriteTasks = function(spriteTaskArray){
    info('--- in combineSpriteTasks---'); return spriteTaskArray;

    //TODO 这里的SpriteTask的属性是否一致，有待处理
    var combinedStyleSheetArray = [],
        combinedStyleObjList = { 
            length: 0 
        },
        combinedFileName,
        combinedSpriteTask;

    combinedFileName = DEFAULT_COMBINE_CSS_NAME;
    // combineFileName = path.resolve(combineFileName);

    spriteTaskArray.forEach(function(spriteTask){
        
        // var spriteTask = { // an SpriteTask
        //     cssFileName: cssFileName, // css 文件的路径
        //     styleSheet: readStyleSheet(cssFileName), // css 文件的内容
        //     styleObjList: null, // 搜集到的需要合并图片的样式和相关图片信息(大小宽高等)
        // };
        
        var styleObjList = spriteTask.styleObjList,
            styleObj,
            existSObj;

        for(var url in styleObjList){
            if(url === 'length'){
                continue;
            }
            styleObj = styleObjList[url];
            if(existSObj = combinedStyleObjList[url]){
                existSObj.cssRules = existSObj.cssRules.concat(styleObj.cssRules);
            }else{
                combinedStyleObjList[url] = styleObj;
                combinedStyleObjList.length++;
            }
        }

        combinedStyleSheetArray.push(spriteTask.styleSheet);
    });

    combinedSpriteTask = {
        cssFileName: combinedFileName,
        styleSheetArray: combinedStyleSheetArray,
        styleObjList: combinedStyleObjList
    }

    return [combinedSpriteTask];
}

/**
 * ispriter 的主要入口函数
 * @param  {Object|String} config ispriter 的配置对象或者是配置文件,
 * 如不清楚请参照 README.md
 * @param {Function} done 当精灵图合并完成后触发
 */
exports.merge = function(config, done) {

    new iSpriter().on('end', done || function() {})
        .run(config);
};

// Task.JS Specification API https://github.com/taskjs/spec
exports.run = function(options, done) {

    exports.merge(options, done);
};