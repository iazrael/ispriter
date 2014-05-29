var fs = require('fs'),
    path = require('path'),
    us = require('underscore'),
    PNG = require('pngjs').PNG,

    FileTool = require('./FileTool'),
    Logger = require('./Logger');

/**
 * 创建一个精灵图, 这里使用 pngjs 来实现, 封装是为了以后容易扩展
 */
function SpriteImage(width, height){

    this.width = width;
    this.height = height;

    this.image = new PNG({
        width: width,
        height: height
    });

    this.clear();
}

module.exports = SpriteImage;


/*
 * 使用前必须把图片的所有像素都设置为 0, 否则会出现一些随机的噪点
 */
SpriteImage.prototype.clear = function() {

    var image = this.image;
    
    for (var y = 0; y < this.height; y++) {

        for (var x = 0; x < this.width; x++) {

            var idx = (this.width * y + x) << 2;
            image.data[idx] = 0;
            image.data[idx+1] = 0;
            image.data[idx+2] = 0;
            image.data[idx+3] = 0;
        }
    }
};

/**
 * 绘制指定 image 对象, 这里的 image 为 png 实例
 */
SpriteImage.prototype.drawImage = function(image, x, y, width, height) {
    
    this.image.bitblt(image, 0, 0, width, height, x, y);
};

/**
 * 把图片内容输出到文件
 */
SpriteImage.prototype.toFile = function(filename, callback) {

    FileTool.mkdirsSync(path.dirname(filename));
    this.image.pack()
            .pipe(fs.createWriteStream(filename))
            .on('finish', callback);
};
