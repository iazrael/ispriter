var fs = require('fs'),
    path = require('path');

/**
 * [SpriteImage description]
 * @param {[type]} imgUri    [description]
 * @param {[type]} imgAbsUri [description]
 */
function SpriteImage(imgUri, imgAbsUri){

    this.imgUri = imgUri;
    this.imgAbsUri = imgAbsUri;

    this.width = this.height = 0;
    this.size = 0;
    this.pics = null; // 保存了该 SpriteImage 的所有小图片
}

module.exports = SpriteImage;


/**
 * 返回该 SpriteImage 是否是空图片
 * @return {Boolean} 
 */
SpriteImage.prototype.isEmpty = function() {

    return this.pics && this.pics.length;
}

/**
 * 绘制该 SpriteImage, 并输出到文件中
 */
SpriteImage.prototype.draw = function() {
    
    // TODO
}
