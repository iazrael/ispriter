/**
 * 这是个接口定义文件
 */
var util = require('util'),

    EventEmitter = require('events').EventEmitter;


/**
 * @class
 * 定义一个画布
 */
function Canvas(width, height) {

    this.width = width;
    this.height = height;

    // to implement
    this.init();
    this.clear();
}

/**
 * 画布初始化
 */
Canvas.prototype.init = function() {

    // to implement
};

/*
 * 清理画布
 */
Canvas.prototype.clear = function() {

    // to implement
};

/**
 * 绘制指定 image 对象到画布上
 */
Canvas.prototype.drawImage = function(image, x, y, width, height) {

    // to implement
};

/**
 * 把画布上的图片内容输出到文件
 */
Canvas.prototype.toFile = function(filename, callback) {

    // to implement
};

/**
 * @class
 * 定义一个图片
 */
function Image() {

    this.content = null;
    this.filepath = null;

    this.width = 0;
    this.height = 0;

    this.size = 0;

    // to implement

    EventEmitter.call(this);

}

util.inherits(Image, EventEmitter);

Image.prototype.__defineSetter__('src', function(filepath) {

    this.filepath = filepath;
    this.load();
});

Image.prototype.__defineGetter__('src', function() {

    return this.filepath;
});

/**
 * 加载图片数据
 */
Image.prototype.load = function() {

    // to implement
    this.emit('load', this);
};


exports.Canvas = Canvas;

exports.Image = Image;