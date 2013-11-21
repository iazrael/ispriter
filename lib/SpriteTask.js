var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,

    Logger = require('./Logger');


function SpriteTask() {

    EventEmitter.call(this);

    this.ispriter = ispriter;
}

util.inherits(SpriteTask, EventEmitter);

SpriteTask.createTasks = function(ispriter, callback) {
    
    var config = ispriter.config;

    zTool.forEach(config.input.cssSource, function(cssFileName, i, next){ // onEach

        var spriteTask = { // an SpriteTask, 一个文件一个 SpriteTask
            cssFileName: cssFileName, // css 文件的路径
            styleSheet: readStyleSheet(cssFileName), // css 文件的内容
            styleObjList: null, // 搜集到的需要合并图片的样式和相关图片信息(大小宽高等)
            spriteArray: null // 精灵图的所有小图片数组
        };
        


        // debug(spriteTask.styleSheet);
        // 收集需要合并的图片信息
        var styleObjList = collectStyleRules(spriteTask.styleSheet, null, cssFileName);
        spriteTask.styleObjList = styleObjList;

        if(!styleObjList.length){
            next(); // 这个 css 没有需要合并的图片
        }else{

            // 把结果塞到列表中方便 combine 使用
            spriteTaskArray.push(spriteTask);

            // 读取图片的内容, 宽高和大小
            readImagesInfo(styleObjList, next);
        }
    });
}

SpriteTask.prototype.exec = function() {
    
}