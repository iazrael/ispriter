var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    us = require('underscore'),
    CleanCSS = require('clean-css'),
    EventEmitter = require('events').EventEmitter,

    Logger = require('./Logger'),
    zTool = require('./ztool'),
    constant = require('./constant'),
    FileTool = require('./FileTool'),
    SpriteImage = require('./SpriteImage'),

    CSSSheet = require('./css').CSSSheet,
    BgInterpreter = require('./css/BackgroundInterpreter'),
    iImage = require('./canvas').Image,

    info = Logger.info,
    debugInfo = Logger.debug;

//TODO 这文件需要整理！！方法啊，参数啊之类的

function SpriteTask(env, cssUri) {

    EventEmitter.call(this);

    this.env = env; // ispriter 的环境相关信息, 也就是 iSpriter 的实例

    this.cssUri = cssUri;

    this.init();
}

util.inherits(SpriteTask, EventEmitter);


SpriteTask.prototype.init = function() {

    var context = this,
        config = this.env.config;

    this.cssSheet = CSSSheet.parse(config, this.cssUri);
    // 这里要做的事情:
    // 1. 遍历所有 cssRules, 把里面的图片都解析出来
    // 2. 收集把需要进行合并的图片
    // 3. 收集不需要合并的图片, 用于合并之后统一输出
    var result = filtercssRules(this);
    var unspriteImages = result[1],
        toSpriteCssRules = result[0];

    //之前的cssRules是所有有background的，现在赋值的cssRules都是需要合图的
    this.cssSheet.cssRules = toSpriteCssRules;
    // 没有被合并的图片会被拷贝到目标目录
    if(!this.env.unspriteImages){
        this.env.unspriteImages = unspriteImages;  //unspriteImages为filepath数组
    }

    // 4. imageInfos：搜集同一图片的所有cssRules（图片信息没有读取）
    this.imageInfos = collectImageRules(toSpriteCssRules); 

    // 5. 并读取图片 info,cache 住
    readImagesInfo(this, function(){
        context.emit('inited');
    });
    


};

/**
 * 返回这个 task 是否是有效的, 既是否有精灵图需要合并, 如果没有这没必要进行后续的处理
 *
 * @return {Boolean}
 */
SpriteTask.prototype.isValid = function() {

    return this.cssSheet && !!this.cssSheet.cssRules.length;
};

SpriteTask.prototype.exec = function() {

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

};

/**
 * 规整背景样式，同时过滤掉合图不需要的属性
 * @param  {Config} config
 * @param  {CSSRule} cssRule
 * @return {Object} 合图需要的关键背景样式
 *
 * {
 *         width:
 *         height:
 *         background-repeat:
 *         background-image:
 *         background-size:
 *         background-position
 * }
 */
function normalizeCSSRule(config, cssRule) {

    var normalizer = {},
        value;

    // FIXME 这里可能会有顺序问题, 如
    // background: XXX; background-image: YYY
    // background-image 会被 background 覆盖掉

    // FIXME 这里默认了 width/height 的单位是 px
    if (value = cssRule['width']) {
        normalizer['width'] = parseFloat(value.value);
    }
    if (value = cssRule['height']) {
        normalizer['height'] = parseFloat(value.value);
    }
    if (value = cssRule['background-repeat']) {
        normalizer['background-repeat'] = value.value;
    }
    if (value = cssRule['background-size']) {
        value = value.value.trim().replace(/\s{2}/g, '').split(' ');

        if (!value[1]) {
            value[1] = value[0];
        }
        normalizer['background-size-x'] = parseFloat(value[0]);
        normalizer['background-size-y'] = parseFloat(value[1]);

    }
    if (value = cssRule['background-position']) {

        value = value.value.trim().replace(/\s{2}/g, '').split(' ');
        if (!value[1]) {
            value[1] = value[0];
        }
        normalizer['background-position-x'] = parseFloat(value[0]);
        normalizer['background-position-y'] = parseFloat(value[1]);
    }
    if (value = cssRule['background-position-x']){
        normalizer['background-position-x'] = parseFloat(value.value);
    }
    if (value = cssRule['background-position-y']){
        normalizer['background-position-y'] = parseFloat(value.value);
    }
    if (value = cssRule['background-image']) {
        var validBgImg, cssImg;

        // 这里的 value 是个数组, 没有任何处理的 CSS 样式,
        // 只提取最后一个有效的 background-image 来使用
        for (var a = value.length - 1; a >= 0; a--) {
            cssImg = value[a].value;
            var result = resolveBackgroundImage(config, cssImg);
            if (result && result.length === 2) {
                validBgImg = cssImg;
                break;
            }else{
                //证明这个background-image的value是不需要合图的，要从cssRule删除
                value.splice(a,1);
            }
        }
        if (validBgImg) {
            normalizer['background-image'] = validBgImg;
        }
    }

    if (value = cssRule['background']) {
        var validBg, item;

        // 这里的 value 是个数组, 没有任何处理的 CSS 样式,
        // 只提取最后一个 background 来使用
        for (var i = value.length - 1; i >= 0; i--) {

            var bg = BgInterpreter.analyse(value[i].value);
            if (bg.length !== 1) {

                //多个background会自动获取最后一个作为可用值
                for (var j = bg.length - 1; j >= 0; j--) {
                    item = bg[j];
                    var result = resolveBackgroundImage(config, item['background-image']);
                    if (result && result.length === 2) {
                        validBg = item;
                        break;
                    }else{
                        value.splice(i,1);
                    }
                }
            } else {
                validBg = bg[0];
            }
        }
        if (validBg) {
            normalizer = us.extend({}, normalizer, validBg);

        }
    }
    return normalizer;

}

/**
 * 从 background-image 的值中提取图片的路径,如果return中成功地只返回两个的话，则这background-image需要合图
 * @return {Array}     [uri, ext, result]
 * network: 网络图片
 * ignore: 不需要合并的图片
 * ext: 后缀不符合
 *
 */
function resolveBackgroundImage(config, value) {
    var format = config.input.format,
        ignoreImages = config.input.ignoreImages,
        uri,
        ext,
        match;

    if (!value) {
        return null;
    }

    match = value.match(constant.REGEXP_IMAGE);

    if (!match) {
        return null;
    }

    uri = match[1];
    ext = match[2];

    if (constant.REGEXP_IGNORE_NETWORK.test(uri)) { // 遇到网络图片就跳过

        return [uri, ext, 'network'];
    }

    if (constant.REGEXP_IGNORE_IMAGE.test(uri)) { // 去掉不需要合并图片

        return [uri, ext, 'ignore'];

    }

    if (ignoreImages) {

        for (var i = 0; i < ignoreImages.length; i++) {

            if (ignoreImages[i].test(uri)) {
                return [uri, ext, 'ignore'];
            }
        }
    }

    if (format.indexOf(ext) === -1) { // 去掉非指定后缀的图片

        return [uri, ext, 'ext'];
    }


    return [uri, ext];

}
/**
 * 过滤出需要合并图片的样式,过滤掉不需要合图的CSSRule
 * @param  {SpriteTask}   task
 * @param  {Function} callback
 * @return {Array} [cssRules, unspriteImages]
 */
function filtercssRules(task, callback) {
    var cssRules = task.cssSheet.cssRules;
    var config = task.env.config;

    var toSpriteCssRules = [];
    var unspriteImages = [];

    cssRules.forEach(function(cssRule) {
        var normalizer;
        if (cssRule['background'] || cssRule['background-image']) {
            // 先规整一下属性, 把 background 拆分, 同时提取 background-position 和 background-image 等
            normalizer = normalizeCSSRule(config, cssRule);
            cssRule.__normalizer = normalizer;
        }
        if (!normalizer || !normalizer['background-image']) {

            // 没有图片的, 滚粗
            return;
        }
        if (constant.REGEXP_IGNORE_POSSITION.test(normalizer['background-position-x']) ||
            constant.REGEXP_IGNORE_POSSITION.test(normalizer['background-position-y'])) {
            debugInfo('----- background position no fixed -----')
            /**
             * FIXME
             * background 定位是 right center bottom 的图片不合并
             * 因为这三个的定位方式比较特殊, 浏览器有个自动适应的特性
             * 这里先不处理先, 后面优化
             */
            return;
        }
        if (constant.REGEXP_IGNORE_REPEAT.test(normalizer['background-repeat']) ||
            constant.REGEXP_IGNORE_REPEAT.test(normalizer['background-repeat-x']) ||
            constant.REGEXP_IGNORE_REPEAT.test(normalizer['background-repeat-y'])) {

            /**
             * FIXME 显式的使用了平铺的图片, 也不进行合并
             * 理论上要把 repreat-x 的合并为一张, repreat-y 的合并为一张, 先不弄
             */
            return;
        }

        // [uri, ext, reason]
        var match = resolveBackgroundImage(config, normalizer['background-image']);
        
        if (!match) {
            return;
        }
        if (match.length === 2) {

            // 符合要求的图片
            cssRule.__spriteImage = {
                uri: match[0],
                ext: match[1]
            };
            toSpriteCssRules.push(cssRule);

        } else if (match[2] === 'ext') {

            // 后缀不符合配置要求的, 只做文件拷贝
            unspriteImages.push(path.join(task.cssSheet.filepath, match[0]));
        } else {

            // 其他不符合要求的都抛弃这个CSSRule
        }

    });
    return [toSpriteCssRules, unspriteImages];
}

/**
 * 收集同一张图片下的所有cssRules(以图片路径为key)
 * @param  {[type]} cssRules [description]
 * @return {[type]}          [description]
 */
function collectImageRules(cssRules){
    var imageInfos = {},
        length = 0;
    cssRules.forEach(function(cssRule){
        var imagePath = cssRule.__spriteImage.uri,
            imageInfo = imageInfos[imagePath];
        if(imageInfo){ //同一张图片，增加到rules里面
            imageInfo.cssRules.push(cssRule)
        }else{
            imageInfos[imagePath] = {
                cssRules : [cssRule]
            }
            length++;
        }
    });

    imageInfos.length = length;
    return imageInfos
}

/**
 * 读取筛选过 cssRules 的图片信息 包括图片的长宽大小
 * @param  {[SpriteTask]}    task     
 * @param  {[Function]}      callback 
 * @return {[type]}                
 */
function readImagesInfo(task, callback){
    var config = task.env.config,
        cache = task.env.cache,
        imageInfos = task.imageInfos;

    zTool.forEach(imageInfos, function(imageInfo, imagePath, next) {
        //ztool 会自动转obj为array，并且能够自动忽略length的key

        var img = new iImage();  //注意这不是个图片的Image对象

        var styleSheetDir = path.dirname(config.input.cssSource),
            imageAbsUrl = path.join(styleSheetDir,imagePath),
            filepath = path.join(config.workspace, imageAbsUrl);

        if(!fs.existsSync(filepath)){
            // 如果这个图片是不存在的, 就直接返回了, 进行容错
            info('>>Skip: "' + filepath + '" is not exist');
            return;
        }
        //曾经处理过cache住的就直接赋值
        if(cache[filepath]){
            //TODO 直接赋值
            return;
        }

        img.src = filepath;
        img.on('load',function(image){
            //方便查看信息的正确与否
            //TODO imageInfo 这里跟PNG实例 重复度非常高
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

            //debugInfo('[imageInfo]',imageInfo);


            next();
        });

    },callback );

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

//****************************************************************
// 7. 输出修改后的样式表    
//****************************************************************

/**
 * 输出修改后的样式表
 * @param  {SpriteTask} spriteTask        
 */
function exportCssFile(spriteTask){
    var cssContentList = [],
        cssContent = '',
        cssSheet = spriteTask.cssSheet,
        spriteImage = spriteTask.spriteImage,
        spriteConfig = spriteTask.env.config,
        compressOptions = spriteConfig.output.compress, //boolean or Object
        fileName,
        fileName2; // 用于输出 log


    cssContentList.push(cssSheet.toString());
    fileName = path.basename(cssSheet.filename);
    
    fileName2 = path.join(spriteConfig.output.cssDist, fileName);
    fileName2 = path.normalize(fileName2);

    fileName = path.join(spriteConfig.workspace, fileName2);
    fileName = path.resolve(fileName);
    
    // 把合并了的样式统一在一起输出到文件的最后
    if(spriteConfig.output.combineCSSRule){
        var combinedCssRules = spriteImage.combinedCssRules;

        for(var imageName in combinedCssRules){
            cssContent += combinedCssRules[imageName].join(',') + '{' +
                          'background-image: url(' + imageName +');' + 
                         '}\n';
        }
    }
    
    cssContent = cssContentList.join('\n') + cssContent;

    if(compressOptions){ // true or Object
        if(!us.isObject(compressOptions)){
            compressOptions = null;
        }
        cssContent = new CleanCSS(compressOptions).minify(cssContent);
    }

    FileTool.writeFileSync(fileName, cssContent, true);
    info('>>Output css:', fileName2);
}

/**
 * 拷贝那些不需要合图的css文件到目标目录
 * TODO 这里没有完成，变量参数不对，这也也可考虑完全是直接使用FileTool直接copy,连新的文件什么时候触发也是个问题
 * @param  {[type]} spriteTask [description]
 * @return {[type]}            [description]
 */
function copyUnspriteCss(spriteTask) {
    var fileName,
        fileName2, // 用于输出 log
        spriteConfig = spriteTask.env.config,
        cssContent;


    fileName = path.basename(spriteTask.cssSheet.filename);

    fileName2 = path.join(spriteConfig.output.cssDist, fileName);
    fileName2 = path.normalize(fileName2);

    fileName = path.join(spriteConfig.workspace, fileName2);
    fileName = path.resolve(fileName);

    cssContent = styleSheetToString(spriteTask.styleSheet);

    nf.writeFileSync(fileName, cssContent, true);
    info('>>Output unsprite css:', fileName2);
};


//TODO 不应该在SpriteTask类中，而是在index.js中 【by bzai】
//     这里逻辑多层事件和异步机制，其原意为：让cssSource一个一个顺序执行SpriteTask。能否让这里逻辑更加让人易懂
SpriteTask.createTasks = function(env, callback) {

    var taskArr = [],
        config = env.config;
    //注意这个next，是用于触发处理异步递归数组，进行下一次的逻辑回调。
    zTool.forEach(config.input.cssSource, function(cssUri, index, next) { // onEach

        var task = new SpriteTask(env, cssUri);
        //由于new SpriteTask也是异步的，所以使用事件机制，让其SrpiteTask内部触发inited，才进行zTool的下一个forEach
        task.on('inited', function() {

            // 没有需要合并的图片的 task 就没必要放到 taskArr
            // if(task.isValid()){
            taskArr.push(task);
            // }
        })
            .on('inited', next);
    }, function() { //onDone

        callback && callback(taskArr);
    });
};

module.exports = SpriteTask;