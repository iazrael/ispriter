var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    EventProxy = require('eventproxy'),
    us = require('underscore'),

    Config = require('./Config'),
    Logger = require('./Logger'),
    zTool = require('./ztool'),
    FileTool = require('./FileTool'),
    constant = require('./constant'),
    SpriteTask = require('./SpriteTask'),

    info = Logger.info,
    debugInfo = Logger.debug;

//其内部逻辑只是简单的做了计时log，核心逻辑在run方法的SpriteTask内
function iSpriter() {

    var startTime;
    EventEmitter.call(this);

    this.on('start', function() {

        startTime = Date.now();
        Logger.log('Sprite start!');
    })
        .on('end', function() {

            var timeUse = Date.now() - startTime;
            Logger.info('>>All done: Time use:', timeUse, 'ms');
        });
}

util.inherits(iSpriter, EventEmitter);

iSpriter.prototype.run = function(config) {
    var self = this;

    // 触发start项目
    this.emit('start');

    // 创建一个 cache 对象来保存缓存
    this.cache = {};

    // 读取和处理合图配置
    config = Config.parse(config);
    this.config = config;

    Logger.debuging = config.debug || false;

    var ep = new EventProxy();

    // 创建合并任务
    this.createTasks(this, function(tasks) {
        // 如果指定了 combine, 先把所有 cssRules 和 styleSheet 合并
        if(config.output.combine){
            // 这时候的task是init过后的，并且是获取了图片信息imageInfos，但是没有合图的关键spriteArray
            tasks = self.combineSpriteTasks(tasks);
        }

        // 所有task都抛taskDone事件后，self抛ispriter的end事件 (必须ep.after在前，ep.group在后)
        ep.after('taskDone', tasks.length, function() {
            if(config.output.copyUnspriteImage) {
                //console.log(self.unspriteImages)
                // 把不需要合并的图片进行拷贝
                self.execCopyUnspriteImage(self.unspriteImages);
            }
            self.emit('end');
        });
        // task开始执行，并且组成group事件
        tasks.forEach(function(task) {
            Logger.log('One Task is exec.');
            task.exec(ep.group('taskDone'));
        });


    });
};


/**
 * 合并所有 spriteTask
 * @param  {Array} spriteTaskArray
 * @return {Array} 转换后的 SpriteTask 数组, 只会包含一个 SpriteTask
 */
iSpriter.prototype.combineSpriteTasks = function(spriteTaskArray) {
    Logger.info('combineSpriteTasks')
    var spriteConfig = this.config;
    var combinedCssSheetArray = [],
        combinedImageInfos = {
            length: 0
        },
        combinedFileName,
        combinedSpriteTask;


    //output.combine  扩展配置类型, 可以指定输出的文件名, 如: "combine": "exam_all.css" , 精灵图则为: sprite_exam_all.png
    combinedFileName = typeof spriteConfig.output.combine == 'string' ? spriteConfig.output.combine : constant.DEFAULT_COMBINE_CSS_NAME;

    spriteTaskArray.forEach(function(spriteTask) {

        // var spriteTask = { // an SpriteTask
        //     cssFileName: cssFileName, // css 文件的路径
        //     styleSheet: readStyleSheet(cssFileName), // css 文件的内容
        //     imageInfo: null, // 搜集到的需要合并图片的样式和相关图片信息(大小宽高等)
        // };

        var imageInfos = spriteTask.imageInfos,
            imageInfo,
            existSObj;

        for (var url in imageInfos) {
            if (url === 'length') {
                continue;
            }
            imageInfo = imageInfos[url];
            if (existSObj = combinedImageInfos[url]) {
                existSObj.cssRules = existSObj.cssRules.concat(imageInfo.cssRules);
            } else {
                combinedImageInfos[url] = imageInfo;
                combinedImageInfos.length++;
            }
        }

        // 合并后输出的一个css文件的文件名是合并的文件名
        spriteTask.cssSheet.filename = combinedFileName;
        combinedCssSheetArray.push(spriteTask.cssSheet);
    });

    //构造一个一个包含了合并后的spriteTask，包含里spriteTask要exec所需要的关键属性
    combinedSpriteTask = spriteTaskArray[0];
    combinedSpriteTask.cssSheetArray = combinedCssSheetArray;
    combinedSpriteTask.imageInfos = combinedImageInfos;

    return [combinedSpriteTask];
}


// 这里逻辑多层事件和异步机制，其原意为：让cssSource一个一个顺序执行SpriteTask。TODO 能否让这里逻辑更加让人易懂
iSpriter.prototype.createTasks = function(env, callback) {

    var taskArr = [],
        config = env.config;
    //注意这个next，是用于触发处理异步递归数组，进行下一次的逻辑回调。
    zTool.forEach(config.input.cssSource, function(cssUri, index, next) { // onEach
        var task = new SpriteTask(env, cssUri);

        //由于new SpriteTask也是异步的，所以使用事件机制，让其SrpiteTask内部触发inited，才进行zTool的下一个forEach
        //TODO 应该在new的时候应该内部自己inited
        task.on('inited', function() {
            // 没有需要合并的图片的 task 就没必要放到 taskArr
            // if(task.isValid()){
            taskArr.push(task);
            // }
        }).on('inited', next);

        // 绑定后inited事件后再inited
        task.init();

    }, function() { //onDone
        callback && callback(taskArr);
    });
};

//TODO 等待代码结构的优化吧
iSpriter.prototype.execCopyUnspriteImage = function(imgPathArray){

    var self = this;
    imgPathArray.forEach(function(sourcePath){
        var imageDist = path.join(self.config.output.cssDist, self.config.output.imageDist)
        var imageDistABS = path.resolve(path.join(self.config.workspace, imageDist));
        //console.log('source:'+sourcePath)
        //console.log('dist:'+imageDistABS)
        
        FileTool.copyFile(sourcePath,imageDistABS,true)
    })
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