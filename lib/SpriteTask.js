var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,

    Logger = require('./Logger'),
    ImageTool = require('./ImageTool');


function SpriteTask(env, cssUri) {

    EventEmitter.call(this);

    this.env = env; // ispriter 的环境相关信息, 也就是 iSpriter 的实例

    // this.config = config; // ispriter 的配置

    // this.cssUri = cssUri; // css 文件的路径

    // this.styleSheet = null; // css 文件的内容

    // this.spriteImages = []; // SpriteImage 数组, 每个 SpriteImage 就是一张精灵图
    
    // this.styleObjList = null; // 搜集到的需要合并图片的样式和相关图片信息(大小宽高等)

    // this.spriteArray = null; // 精灵图的所有小图片数组

    this.cssSheet

    this.init();
}

util.inherits(SpriteTask, EventEmitter);

module.exports = SpriteTask;


SpriteTask.createTasks = function(env, callback) {
    
    var taskArr = [],
        config = env.config;

    zTool.forEach(config.input.cssSource, function(cssUri, index, next){ // onEach

        var task = new SpriteTask(env, cssUri);

        task.on('inited', function(){

                    // 没有需要合并的图片的 task 就没必要放到 taskArr
                    if(task.isValid()){

                        taskArr.push(task);
                    }
                })
                .on('inited', next);
    }, function(){ //onDone

        callback && callback(taskArr);
    });
};

SpriteTask.prototype.init = function() {

    var context = this,
        config = this.env.config,
        styleObjList;

    this.styleSheet = BaseStyleSheet.createStyleSheet(config, this.cssUri);

    if(!this.styleSheet){

        return this.emit('inited');
    }

    // 收集需要合并的图片信息, 这个是 ispriter 的核心之一
    styleObjList = this.styleObjList = this.styleSheet.collectStyleRules();

    if(!styleObjList.length){

        return this.emit('inited');
    }

    // 读取图片的内容, 宽高和大小
    zTool.forEach(styleObjList, function(styleObj, url, next){

        var fileName;
        function onGetImageInfo(imageInfo){

            if(imageInfo){

                // 从所有style里面, 选取图片宽高最大的作为图片宽高
                // TODO
                setImageWidthHeight(styleObj, imageInfo);

                styleObj.imageInfo = imageInfo;

            }else{ // 没有读取到图片信息, 可能是图片签名或格式不对, 读取出错了
                
                delete styleObjList[url];
                styleObj.cssRules.forEach(function(style){

                    style.mergeBackgound();
                });
            }
            next();
        }

        fileName = path.join(config.workspace, styleObj.imageAbsUrl);
        ImageTool.getImageInfo(fileName, onGetImageInfo);
    }, function(){

        context.emit('inited');
    });
    
};

/**
 * 返回这个 task 是否是有效的, 既是否有精灵图需要合并, 如果没有这没必要进行后续的处理
 * 
 * @return {Boolean} 
 */
SpriteTask.prototype.isValid = function() {

    return !!this.spriteImages.length;
};

SpriteTask.prototype.exec = function() {
    // TODO
};
