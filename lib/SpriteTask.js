var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    _ = require('underscore'),
    CleanCSS = require('clean-css'),
    EventEmitter = require('events').EventEmitter,

    Logger = require('./Logger'),
    zTool = require('./ztool'),
    constant = require('./constant'),
    FileTool = require('./FileTool'),
    SpriteImage = require('./SpriteImage'),

    CSSSheet = require('./css').CSSSheet,
    iImage = require('./canvas').Image,

    info = Logger.info,
    debugInfo = Logger.debug;


function SpriteTask(env, cssUri) {

    EventEmitter.call(this);

    this.env = env; // ispriter 的环境相关信息, 也就是 iSpriter 的实例

    this.config = env.config;

    this.cssUri = cssUri;

    this.init();
}

util.inherits(SpriteTask, EventEmitter);


SpriteTask.prototype.init = function() {

    this.cssSheet = new CSSSheet(this.config, this.cssUri);

    // filtercssRules 筛选把需要进行合并的图片，
    // 并且输出不需要合并的图片, 用于合并之后统一输出
    var unspriteImages = this.cssSheet.filtercssRules();

    // 没有被合并的图片会被拷贝到目标目录
    if(unspriteImages.length > 0){
        this.env.unspriteImages = _.union(this.env.unspriteImages, unspriteImages);
    }

    // imageInfos：搜集同一图片的所有cssRules（图片信息没有读取）
    this.imageInfos = collectImageRules(this.cssSheet.cssRules); 

};


SpriteTask.prototype.exec = function(callback) {

    // 这里要做的事: 对小图片进行定位排列和输出, 输出合并后的 css 文件

    // 1. 合并 cssRules 和 cssSheet
    // 2. 定位和排列小图, 修改样式里的 background
    // 3. 输出合并的后的大图
    // 4. 输出修改后的样式表
    // 
    // var spriteImage = new SpriteImage(this.env.config, this.imageInfos);
    // this.spriteArray = spriteImage.positionImages();
    this.spriteImage = new SpriteImage(this);

    // 输出合并的图片 并修改样式表里面的background
    this.spriteImage.drawImageAndPositionBackground();

    // 输出修改后的样式表
    exportCssFile(this);

    callback && callback();
};

/**
* 读取筛选过 imageInfo 的图片信息 包括图片的长宽大小
**/
SpriteTask.prototype.readImagesInfo = function(callback){
    var self = this,
        config = this.env.config,
        cache = this.env.cache,
        imageInfos = this.imageInfos;

    zTool.forEach(imageInfos, function(imageInfo, imagePath, next) {
        var img = new iImage(); //注意这不是个图片的Image对象

        var styleSheetDir = path.dirname(self.cssSheet.uri),
            imageAbsUrl = path.join(styleSheetDir,imagePath),
            filepath = path.join(config.workspace, imageAbsUrl);

        if(!fs.existsSync(filepath)){
            // 如果这个图片是不存在的, 就直接返回了, 进行容错
            info('>>Skip: "' + filepath + '" is not exist');
            next();
            return;
        }
        if(cache[filepath]){
            //要通用一个imageInfos，所以clone类copy类都不行
            //self.imageInfos[imagePath] = zTool.extend(imageInfo, cache[filepath], false)

            var cacheImageInfo = cache[filepath];

            imageInfo.cssRules.forEach(function(cssRule){
                cacheImageInfo.cssRules.push(cssRule)
            });
            //注意要把这个task的imageInfos引用要指向cache
            self.imageInfos[imagePath] = cacheImageInfo;

            next();
            return;
        }

        img.src = filepath;
        img.on('load',function(image){
            //方便查看信息的正确与否
            imageInfo.filepath = image.filepath;
            imageInfo.width =  image.width;
            imageInfo.height=  image.height;
            imageInfo.size  = image.size;
            imageInfo.image = image;

            //(很有必要，里面还设置了必要参数w和h)从所有style里面，选取图片宽高最大的作为图片宽高
            var mx = setImageMaxWidthHeight(imageInfo,config);
            imageInfo.w = mx.w;
            imageInfo.h = mx.h;

            //注意cache的key是以filepath的为key，因为多文件的css路径是不一致，有引用同一图片但是书写的路径却不一样，使用filepath提供唯一性
            cache[filepath] = imageInfo;

            next();
        });
        

    },callback);

}

/**
 * 收集同一张图片下的所有cssRules(以图片路径为key)
 * @param  {[type]} cssRules [description]
 * @return {[type]}          [description]
 */
function collectImageRules(cssRules){
    var imageInfos = {};

    cssRules.forEach(function(cssRule){
        var imagePath = cssRule.__spriteImage.uri,
            imageInfo = imageInfos[imagePath];
        if(imageInfo){ //同一张图片，增加到rules里面
            imageInfo.cssRules.push(cssRule)
        }else{
            imageInfos[imagePath] = {
                cssRules : [cssRule]
            }
        }
    });

    return imageInfos
}


/**
 * 把用了同一个图片的样式里写的大小 (with, height) 跟图片的大小相比较, 取最大值,
 * 防止有些样式写的宽高比较大, 导致合并后显示到了周边的图片内容
 * @param { ImageInfo } imageInfo 
 * @param { Object } config 
 */
function setImageMaxWidthHeight(imageInfo,config){
    var w = 0, 
        h = 0, 
        mw = imageInfo.width, 
        mh = imageInfo.height;

    // 遍历所有规则, 取最大值
    imageInfo.cssRules.forEach(function(cssRule){
        w = cssRule.__normalizer.width,
        h = cssRule.__normalizer.height;

        if(w > mw){
            mw = w;
        }
        if(h > mh){
            mh = h;
        }
    });

    /*
     * 最后的大小还要加上 config 中配置的 margin 值
     * 这里之所以用 w / h 来表示宽高, 而不是用 with / height
     * 是因为 packer 算法限定死了, 值读取传入元素的 w / h 值
     */
    return {
        w : mw + config.output.margin,
        h : mh + config.output.margin
    }

}

/**
 * 输出修改后的样式表
 * @param  {SpriteTask} spriteTask        
 */
function exportCssFile(spriteTask){
    var cssContentList = [],
        cssContent = '',
        cssSheet = spriteTask.cssSheet,
        cssSheetArray = spriteTask.cssSheetArray,
        spriteImage = spriteTask.spriteImage,
        spriteConfig = spriteTask.env.config,
        compressOptions = spriteConfig.output.compress, //boolean or Object
        fileName,
        fileName2; // 用于输出 log

    if(!cssSheetArray) {
        cssSheetArray = [spriteTask.cssSheet];
    }

    cssSheetArray.forEach(function(cssSheet) {
        cssContentList.push(cssSheet.toString());
    });

    fileName = path.basename(cssSheet.filename);
    
    fileName2 = path.join(spriteConfig.output.cssDist, fileName);
    fileName2 = path.normalize(fileName2);

    fileName = path.join(spriteConfig.workspace, fileName2);
    fileName = path.resolve(fileName);
    
    // 把合并了的样式统一在一起输出到文件的最后
    if(spriteConfig.output.combineCSSRule){
        var combinedCssRules = spriteImage.combinedCssRules;

        for(var imageName in combinedCssRules){ 
            var uniqCssRules = _.uniq( combinedCssRules[imageName] ); //去重        
            cssContent += uniqCssRules.join(',') + '{' +
                          'background-image: url(' + imageName +');' + 
                         '}\n';
        }
    }
    
    cssContent = cssContentList.join('\n') + cssContent;

    if(compressOptions){ // true or Object
        if(!_.isObject(compressOptions)){
            compressOptions = null;
        }
        cssContent = new CleanCSS(compressOptions).minify(cssContent);
    }

    FileTool.writeFileSync(fileName, cssContent, true);
    info('>>Output css:', fileName2);
}



module.exports = SpriteTask;