var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    EventProxy = require('eventproxy'),
    _ = require('underscore'),

    Config = require('./Config'),
    Logger = require('./Logger'),
    zTool = require('./ztool'),
    FileTool = require('./FileTool'),
    constant = require('./constant'),
    SpriteTask = require('./SpriteTask'),

    info = Logger.info,
    logInfo = Logger.log,
    debugInfo = Logger.debug;

//其内部逻辑只是简单的做了计时log，核心逻辑在run方法的SpriteTask内
function iSpriter() {
    var startTime,
        timeUse;
    EventEmitter.call(this);

    this.on('start', function() {
        startTime = Date.now();
        Logger.log('[ Sprite start! ]');

    }).on('end', function() {
        timeUse = Date.now() - startTime;
        Logger.log('[ All done: Time use:', timeUse, 'ms ]');
    });
}

util.inherits(iSpriter, EventEmitter);

iSpriter.prototype.run = function(config) {
    var self = this;
    var ep = new EventProxy();

    // 触发start项目
    this.emit('start');
    // 创建一个 cache 对象来保存缓存
    this.cache = {};
    // 记录所有task不需要合图的image绝对路径
    this.unspriteImages = [];

    // 读取和处理合图配置
    this.config = Config.parse(config);
    var config = this.config;

    Logger.debuging = config.debug || false;

    // 创建合并任务
    this.createTasks(this, function(tasks) {
        if(config.output.combine){
            // 如果指定了 combine, 先把所有 cssRules 和 styleSheet 合并
            // 这时候的task是init过后的，并且是获取了图片信息imageInfos，但是没有合图的关键spriteArray
            tasks = self.combineSpriteTasks(tasks);
        }

        // 所有task都抛taskDone事件后，self抛ispriter的end事件 (必须ep.after在前，ep.group在后)
        ep.after('taskDone', tasks.length, function() {
            if(config.output.copyUnspriteImage) {    // 把不需要合并的图片进行拷贝
                self.execCopyUnspriteImage(self.unspriteImages);
            }
            self.emit('end');
        });

        // task开始执行，并且组成group并行事件
        tasks.forEach(function(task) {
            debugInfo('One Task is exec.');
            task.exec(ep.group('taskDone'));
        });

    });
};


/**
* 创建 SpriteTask类
* 其中注意的是readImageInfo为异步，所以使用zTool的forEach异步队列控制执行顺序
**/
iSpriter.prototype.createTasks = function(env, callback) {

    var taskArr = [],
        cssSource = env.config.input.cssSource;

    zTool.forEach( cssSource, function(cssUri, index, next) {

        var task = new SpriteTask(env, cssUri);

        task.readImagesInfo(function(){
            taskArr.push(task);
            next();  //注意这个next，是用于触发处理异步递归数组，进行下一次的逻辑回调。
        });

    }, function() { //onDone
        callback && callback(taskArr);
    });
};


/**
 * 合并所有 spriteTask 并且其有cssSheetArray特色属性说明是合并后的task
 * @param  {Array} spriteTaskArray
 * @return {Array} 转换后的 SpriteTask 数组, 只会包含一个 SpriteTask，
 */
iSpriter.prototype.combineSpriteTasks = function(spriteTaskArray) {
    debugInfo('combineSpriteTasks');

    var config = this.config;
    var combinedCssSheetArray = [],
        combinedImageInfos = {};
        
    //output.combine  扩展配置类型, 可以指定输出的文件名, 如: "combine": "exam_all.css" , 精灵图则为: sprite_exam_all.png
    var combinedFileName = typeof config.output.combine == 'string' ? config.output.combine : constant.DEFAULT_COMBINE_CSS_NAME;

    spriteTaskArray.forEach(function(spriteTask) {

        var imageInfos = spriteTask.imageInfos;

        for (var filepath in imageInfos) {

            var imageInfo = imageInfos[filepath];
            var existImageInfo = combinedImageInfos[filepath];

            if (existImageInfo) {
                existImageInfo.cssRules = _.union(existImageInfo.cssRules, imageInfo.cssRules);
            } else {
                combinedImageInfos[filepath] = imageInfo;
            }
        }

        // 合并后输出的一个css文件的文件名是合并的文件名
        spriteTask.cssSheet.filename = combinedFileName;
        combinedCssSheetArray.push(spriteTask.cssSheet);
    });

    //构造一个一个包含了合并后的spriteTask，包含里spriteTask要exec所需要的关键属性
    var combinedSpriteTask = spriteTaskArray[0];
    //覆盖关键属性
    combinedSpriteTask.cssSheetArray = combinedCssSheetArray;
    combinedSpriteTask.imageInfos = combinedImageInfos;

    return [combinedSpriteTask];
}


//TODO 等待代码结构的优化吧
iSpriter.prototype.execCopyUnspriteImage = function(imgPathArray){

    var self = this;
    imgPathArray.forEach(function(sourcePath){
        var imageDist = path.join(self.config.output.cssDist, self.config.output.imageDist)
        var imageDistABS = path.resolve(path.join(self.config.workspace, imageDist));

        debugInfo('copyUnspriteImage: '+sourcePath);
        
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
    
    new iSpriter().on('end', done || function() {}).run(config);
};

// Task.JS Specification API https://github.com/taskjs/spec
exports.run = function(options, done) {

    exports.merge(options, done);
};