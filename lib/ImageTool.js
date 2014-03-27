var fs = require('fs'),
    path = require('path'),

    us = require('underscore'),
    PNG = require('pngjs').PNG,
    FileTool = require('./FileTool'),
    Logger = require('./Logger');

var imageInfoCache = {};


/**
 * 读取单个图片的内容和信息
 * @param {String} fileName
 * @param {Function} callback callback(ImageInfo)
 * { // ImageInfo
 *     image: null, // 图片数据
 *     width: 0,
 *     height: 0,
 *     size: 0 // 图片数据的大小
 * }
 */
exports.getImageInfo = function(fileName, callback){
    
    if(imageInfoCache[fileName]){

        callback(imageInfoCache[fileName]);
        return;
    }
    fs.createReadStream(fileName)
            .pipe(new PNG())
            .on('parsed', function() {

        var imageInfo = {
            image: this,
            width: this.width,
            height: this.height
        };
        getImageSize(this, function(size){

            imageInfo.size = size;
            callback(imageInfo);
        });
    })
    .on('error', function(e){

        Logger.info('>>getImageInfo Error: ' + e.message + ', filename: "' + fileName + '"');
        callback(null);
    });
};

/**
 * 读取图片内容所占硬盘空间的大小
 * @param  {PNG}   image    
 * @param  {Function} callback callback(Number)
 */
function getImageSize(image, callback){

    var size = 0;

    /*
     * 这里读取图片大小的范式比较折腾, pngjs 没有提供直接获取 size 的通用方法, 
     * 同时它只提供了文件流的方式读取, 所以只能一段一段的读取数据时把长度相加
     */
    image.pack()
            .on('data', function(chunk){

        size += chunk.length;
    }).on('end', function(){

        callback(size);
    });
}

