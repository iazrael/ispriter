var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    _ = require('underscore'),
    CleanCSS = require('clean-css'),
    EventEmitter = require('events').EventEmitter,

    Logger = require('./logger'),
    zTool = require('./ztool'),
    constant = require('./constant'),
    FileTool = require('./fileTool'),

    CSSSheet = require('./css').CSSSheet,
    iImage = require('./canvas').Image,
    SpriteUtil = require('./spriteUtil'),
    iCanvas = require('./canvas').Canvas,
    GrowingPacker = require('./algorithm/GrowingPacker'),

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
    this.imageInfos = SpriteUtil.collectImageRules(this.cssSheet.cssRules); 

};


SpriteTask.prototype.exec = function(callback) {

    // 收集这个css文件的所有className（imageInfos通用性会把所有spriteTask同一张图片的cssrule都整合一起）
    this.cssNames = SpriteUtil.getCSSNamesBySheet(this); 

    // 定位position最后的位置,得到合图数组
    this.spriteArray = this.positionImages();

    // 输出合并的图片 并修改样式表里面的background
    this.drawImageAndPositionBackground();

    // 输出修改后的样式表
    this.exportCssFile();

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
            var mx = SpriteUtil.setImageMaxWidthHeight(imageInfo,config);
            imageInfo.w = mx.w;
            imageInfo.h = mx.h;

            //注意cache的key是以filepath的为key，因为多文件的css路径是不一致，有引用同一图片但是书写的路径却不一样，使用filepath提供唯一性
            cache[filepath] = imageInfo;

            next();
        });
        

    },callback);

}

/**
 * 对需要合并的图片进行布局定位
 * sprite 是个特殊数组，装载packer过的imageInfo和有个额外的root属性
 * 
 */
SpriteTask.prototype.positionImages = function(){

    var spriteArray = [],// 注意这样应该是imageInfo二维数组
        sprite = [],     // 一个sprite数组装载imageInfo，就是合并一张合图
        existArr = [],   // 保存已经合并过的图片的imageInfo
        maxSize = this.config.output.maxSingleSize,
        packer = new GrowingPacker();

    // 把已经合并了并已输出的图片先排除掉
    for(var i in this.imageInfos){
        var imageInfo = this.imageInfos[i];

        var targetArr = imageInfo.drew ? existArr : sprite;
        targetArr.push(imageInfo);
    }

    // 如果限制了输出图片的大小, 则进行分组
    if(maxSize){
        /* 
         * 限制图片大小的算法是:
         * 1. 先把图片按从大到小排序
         * 2. 顺序叠加图片 size , 超过maxSize 时, 另起一个数组
         * 3. 最终把一个数组, 拆成 N 个 总 szie 小于 maxSize 的数组
         */
        sprite.sort(function(a, b){
            return b.size - a.size;
        });
        
        var total = 0, ret = [];
        sprite.forEach(function(imageInfo){
            total += imageInfo.size;

            if(total > maxSize){
                if(ret.length){ // 避免出现空图片
                    spriteArray.push(ret);
                    ret = [];
                    total = imageInfo.size;
                }
            }
            ret.push(imageInfo);
        });

        if(ret.length){
            spriteArray.push(ret);
        }
    }else{
        spriteArray.push(sprite);
    }
    
    spriteArray.forEach(function(sprite){

        /* 
         * packer 算法需要把最大的一个放在首位...
         * 排序算法会对结果造成比较大的影响
         */
        sprite.sort(function(a, b){
            return b.w * b.h - a.w * a.h;
        });

        // 用 packer 对数组元素进行定位
        packer.fit(sprite);

        /* 
         * root 的值就是 packer 定位的结果
         * root.w / root.h 表示图片排列后的总宽高
         * 各个小图片的坐标这在 sprite 的元素中, 新增了一个 fit 属性
         * fit.x / fit.y 表示定位后元素的坐标
         */
        sprite.root = packer.root;   //直接在数组里面赋值属性，好像不按常理出牌
    });

    if(existArr.length){
        spriteArray.push(existArr);
    }
    return spriteArray;
}

/**
 * 根据定位合并图片并输出, 同时修改样式表里面的background
 **/
SpriteTask.prototype.drawImageAndPositionBackground = function(){
    
    var self = this,
        spriteArray = this.spriteArray,
        config = this.config;

    // 保存用了同一张精灵图的选择器, 用于最后输出 css 文件的时候统一设置 background-image
    // combinedCssRules = { 
    //   './sprite_output/sprite_1.png': ['.game_icon','.game_icon:hover']
    // };

    this.combinedCssRules = combinedCssRules = {};

    /* 
     * 若最后一个元素, 没有root 属性, 说明它的样式都是复用已合并的图片的, 
     * 直接替换样式即可
     */
    if(!spriteArray[spriteArray.length - 1].root){
        
        var sprite = spriteArray.pop();

        sprite.forEach(function(imageInfo){

            var imageName = imageInfo.imageName;

            if(!combinedCssRules[imageName]){
                combinedCssRules[imageName] = [];
            }
            // 修改 background 属性
            SpriteUtil.replaceAndPositionBackground(self, imageName, imageInfo, combinedCssRules[imageName]);
        });
    }

    spriteArray.forEach(function(sprite, i){
        var icanvas = new iCanvas(sprite.root.w, sprite.root.h);
        var imageName = SpriteUtil.createSpriteImageName(self, i, spriteArray.length);

        sprite.forEach(function(imageInfo){

            if(!imageInfo.image) return;

            var image = imageInfo.image;

            if(!combinedCssRules[imageName]){
                combinedCssRules[imageName] = [];
            }

            // 修改 background 属性
            SpriteUtil.replaceAndPositionBackground(self, imageName, imageInfo, combinedCssRules[imageName]);
            
            // 在画布上对图片进行填充
            icanvas.drawImage(image, imageInfo.fit.x, imageInfo.fit.y, image.width, image.height);

            imageInfo.drew = true;
            imageInfo.imageName = imageName;
            debugInfo('-----  done one imageInfo -----')
        });

        debugInfo('--- out it--');

        //  输出定位后的图片
        if(sprite.length){ // 没必要输出一张空白图片
            var imageName2 = path.join(config.output.cssDist, imageName);
            imageName2 = path.normalize(imageName2);

            var imageAbsName = path.join(config.workspace, imageName2);
            imageAbsName = path.resolve(imageAbsName);

            icanvas.toFile(imageAbsName,function(){
                info('>>Output image:', imageName2);
            });

        }
    });  
}





/**
 * 输出修改后的样式表
 */
SpriteTask.prototype.exportCssFile = function(){
    var cssContentList = [],
        cssContent = '',
        cssSheet = this.cssSheet,
        cssSheetArray = this.cssSheetArray,
        spriteConfig = this.env.config,
        compressOptions = spriteConfig.output.compress, //boolean or Object
        fileName,
        fileName2; // 用于输出 log

    if(!cssSheetArray) {
        cssSheetArray = [this.cssSheet];
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
        var combinedCssRules = this.combinedCssRules;

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