var fs = require('fs'),
    path = require('path'),
    us = require('underscore'),
    util = require('util'),

    EventEmitter = require('events').EventEmitter,
    PNG = require('pngjs').PNG,

    FileTool = require('../FileTool'),
    Logger = require('../Logger');

// canvas 的 pngjs 实现
var Canvas = require('./Canvas').Canvas;
var Image = require('./Canvas').Image;


// 按路径缓存图片的信息, 已经读取过的就不用再读了
// 先不使用cache, 这里会导致多个项目文件同时合并时, cache 会产生混乱
// 实在要使用的话, cache 需要跟着 iSpriter 的上下文走
// var imageCache = {};

/*************** Canvas 的实现 *******************/

/**
 * 画布初始化
 */
Canvas.prototype.init = function() {
    this.image = new PNG({
        width: width,
        height: height
    });

};


/*
 * 使用前必须把图片的所有像素都设置为 0, 否则会出现一些随机的噪点
 */
Canvas.prototype.clear = function() {

    var image = this.image;

    for (var y = 0; y < this.height; y++) {

        for (var x = 0; x < this.width; x++) {

            var idx = (this.width * y + x) << 2;
            image.data[idx] = 0;
            image.data[idx + 1] = 0;
            image.data[idx + 2] = 0;
            image.data[idx + 3] = 0;
        }
    }
};

/**
 * 绘制指定 image 对象, 这里的 image 为 pngjs 实例
 */
Canvas.prototype.drawImage = function(image, x, y, width, height) {

    this.image.bitblt(image.content, 0, 0, width, height, x, y);
};

/**
 * 把图片内容输出到文件
 */
Canvas.prototype.toFile = function(filename, callback) {

    FileTool.mkdirsSync(path.dirname(filename));
    this.image.pack()
        .pipe(fs.createWriteStream(filename))
        .on('finish', callback);
};


/*************** Image 的实现 *******************/


/**
 * 读取图片内容所占硬盘空间的大小
 * @param  {PNG}   image
 * @param  {Function} callback callback(Number)
 */
function getImageSize(image, callback) {

    var size = 0;

    /*
     * 这里读取图片大小的方式比较折腾, pngjs 没有提供直接获取 size 的通用方法,
     * 同时它只提供了文件流的方式读取, 所以只能一段一段的读取数据时把长度相加
     */
    image.pack()
        .on('data', function(chunk) {

            size += chunk.length;
        }).on('end', function() {

            callback(size);
        });
}

/**
 * 加载图片数据
 */
Image.prototype.load = function() {

    var context = this;
    var filepath = this.filepath;
    // var cache;

    // if (cache = imageCache[filepath]) {
    //     this.content = cache.content;

    //     this.width = cache.width;
    //     this.height = cache.height;

    //     this.size = cache.size;

    //     this.emit('load', this);
    //     return;
    // }

    fs.createReadStream(filepath)
        .pipe(new PNG())
        .on('parsed', function() {

            context.width = this.width;
            context.height = this.height;

            context.content = this;

            getImageSize(this, function(size) {

                context.size = size;

                context.emit('load', context);

                // imageCache[filepath] = context;
            });
        })
        .on('error', function(e) {

            Logger.info('[Image] load error: ' + e.message + ', filepath: "' + filepath + '"');

            // 加载出错了也继续抛出 load 事件, 方便兼容处理
            context.emit('load', null);
        });
};


exports.Canvas = Canvas;

exports.Image = Image;


