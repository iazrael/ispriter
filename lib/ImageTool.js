var fs = require('fs'),
    path = require('path'),

    us = require('underscore'),
    PNG = require('pngjs').PNG,
    FileTool = require('./FileTool');

var imageInfoCache = {};


/**
 * 创建一个指定宽高的图片
 * @param  {Number} width 
 * @param  {Number} height
 * @return {PNG} 返回 png 对象
 */
exports.createImage = function(width, height) {

    var png = new PNG({
        width: width,
        height: height
    });

    /*
     * 必须把图片的所有像素都设置为 0, 否则会出现一些随机的噪点
     */
    for (var y = 0; y < png.height; y++) {

        for (var x = 0; x < png.width; x++) {

            var idx = (png.width * y + x) << 2;
            png.data[idx] = 0;
            png.data[idx+1] = 0;
            png.data[idx+2] = 0;
            png.data[idx+3] = 0;
        }
    }
    return png;
}

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
    // fileName = path.join(spriteConfig.workspace, fileName);
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

                // info('>>Skip: ' + e.message + ' of "' + fileName + '"');
                // throw 'getImageInfoError', e
                callback(null);
            });
}

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

/**
 * 把图片内容输出成文件
 * @param  {String} imageName 图片名字
 * @param  {PNG} image     图片对象
 * @param  {Function} callback     输出完成后的回调
 */
exports.writeImage = function(imageName, image, callback){

    FileTool.mkdirsSync(path.dirname(imageName));
    image.pack()
            .pipe(fs.createWriteStream(imageName))
            .on('end', callback);
}