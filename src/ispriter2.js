
var fs = require('fs'),
    path = require('path'),

    us = require('underscore'),
    CSSOM = require('cssom'),
    PNG = require('pngjs').PNG,
    GrowingPacker = require('./GrowingPacker'),
    BI = require('./BackgroundInterpreter'),
    nf = require('./node-file'),
    ztool = require('./ztool');

//****************************************************************
// 0. 声明和配置一些常量
//****************************************************************

var CURRENT_DIR =  path.resolve('./');

/** 
 * 默认配置
 * 注意: 所有配置中, 跟路径有关的都必须使用 linux 的目录分隔符 "/", 不能使用 windows 的 "\". 
 */
var DEFAULT_CONFIG = {

    /**
     * 精灵图合并算法, 目前只有 growingpacker
     * 
     * @optional 
     * @default "growingpacker"
     */
    "algorithm": "growingpacker",
    "input": {

        /**
         * @test
         * 工作目录, 可以是相对路径或者绝对路径
         * 
         * @optional
         * @default 运行 ispriter 命令时所在的目录
         * @example
         * "./": 当前运行目录, 默认值
         * "../": 当前目录的上一级
         * "/data": 根目录下的 data 目录
         * "D:\\sprite": D 盘下的 sprite 目录
         */
        "workspace": CURRENT_DIR,

        /**
         * 原 cssRoot
         * 需要进行精灵图合并的 css 文件路径或文件列表, 单个时使用字符串, 多个时使用数组.
         * 
         * @required 
         * @example
         * "cssSource": "../css/";
         * "cssSource": ["../css/style.css", "../css2/*.css"]
         */
        "cssSource": null,

        /**
         * 输出的精灵图的格式, 目前只支持输出 png 格式, 
         * 如果是其他格式, 也是以PNG格式输出, 仅仅把后缀改为所指定后缀
         * 
         * @optional 
         * @default "png"
         */
        "format": "png"
    },
    "output": {

        /**
         * 原 cssRoot
         * 精灵图合并之后, css 文件的输出目录
         * 
         * @optional 
         * @default "./sprite/"
         */
        "cssDist": "./sprite/",

        /**
         * 原 imageRoot
         * 生成的精灵图相对于 cssDist 的路径, 最终会变成合并后的的图片路径写在 css 文件中
         * 
         * @optional
         * @default "./img/"
         * @example
         * 如果指定 imageDist 为 "./images/sprite/", 则在输出的 css 中会显示为
         * background: url("./images/sprite/sprite_1.png");
         * 
         */
        "imageDist": "./img/",

        /**
         * 原 maxSize
         * 单个精灵图的最大大小, 单位 KB, 
         * 如果合并之后图片的大小超过 maxSingleSize, 则会对图片进行拆分
         *
         * @optional 
         * @default 0
         * @example
         * 如指定 "maxSingleSize": 60, 而生成的精灵图(sprite_all.png)的容量为 80KB, 
         * 则会把精灵图拆分为 sprite_0.png 和 sprite_1.png 两张
         * 
         */
        "maxSingleSize": 0,

        /**
         * 合成之后, 图片间的空隙, 单位 px
         * 
         * @optional 
         * @default 0
         */
        "margin": 0,

        /**
         * 生成的精灵图的前缀
         * 
         * @optional
         * @default "sprite_"
         */
        "prefix": "sprite_",

        /**
         * 精灵图的输出格式
         * 
         * @optional
         * @default "png"
         */
        "format": "png",

        /**
         * 配额是否要将所有精灵图合并成为一张, 当有很多 css 文件输入的时候可以使用.
         * 为 true 时将所有图片合并为一张, 同时所有 css 文件合并为一个文件.
         * 注意: 此时 maxSingleSize 仍然生效, 超过限制时也会进行图片拆分
         * 
         * @optional
         * @default false
         */
        "combine": false
    }
};


//****************************************************************
// 1. 读取配置
// 把传入的配置(最简配置或者完整配置等)进行适配和整理
//****************************************************************

/**
 * 读取配置, 支持config 为配置文件名或者为配置对象
 * 
 * @param  {Object|String} config 配置文件或者配置对象
 * @return {Object}        读取并解析完成的配置对象
 */
var readConfig = function(config){
    if(us.isString(config)){
        if(!fs.existsSync(config)){
            throw 'place give in a sprite config or config file!';
        }
        var content = fs.readFileSync(config).toString();
        config = ztool.jsonParse(content);
    }
    config = config || {};

    // 适配最简配置
    if(us.isString(config.input)){
        config.input = {
            cssSource: config.input
        };
    }
    if(us.isString(config.output)){
        config.output = {
            cssSource: config.output
        }
    }

    // 对旧的配置项进行兼容
    config = adjustOldProperty(config);

    // 
    config = ztool.merge({}, DEFAULT_CONFIG, config);

    var cssSource = config.input.cssSource;
    if(!cssSource){
        throw 'there is no cssSource specific!';
    }else if(us.isString(cssSource)){
        cssSource = [cssSource];
    }

    // 读取所有指定的 css 文件
    var cssFiles = [], cssPattern, queryResult;
    for(var i = 0; i < cssSource.length; i++){
        cssPattern = path.normalize(cssSource[i]);

        if(ztool.endsWith(cssPattern, path.sep)){
            cssPattern += '*.css';
        }
        queryResult = nf.query(CURRENT_DIR, cssPattern);
        cssFiles = cssFiles.concat(queryResult);
    }
    if(!cssFiles.length){
        throw 'there is no any css file contain!';
    }
    // console.log(cssFiles);
    // console.log('cssFiles before unique size: ' + cssFiles.length);

    // 去重
    cssFiles = us.unique(cssFiles);
    // console.log('cssFiles after unique size: ' + cssFiles.length);

    config.input.cssSource = cssFiles;

    // 确保输出路径是个目录
    config.output.cssDist = path.resolve(config.output.cssDist) + path.sep;
    
    // KB 换算成 B
    config.output.maxSingleSize *= 1024;

    // 确保 margin 是整数
    config.output.margin = parseInt(config.output.margin);
    
    console.log(config);
    return config;
}

/**
 * 对旧的配置项做兼容
 * @param  {Object} config 
 * @return {Object}        
 */
var adjustOldProperty = function(config){
    if(!config.input.cssSource && config.input.cssRoot){
        config.input.cssSource = config.input.cssRoot;
        delete config.input.cssRoot;
    }
    if(!config.output.cssDist && config.output.cssRoot){
        config.output.cssDist = config.output.cssRoot;
        delete config.output.cssRoot;
    }
    if(!config.output.imageDist && config.output.imageRoot){
        config.output.imageDist = config.output.imageRoot;
        delete config.output.imageRoot;
    }
    if(!config.output.maxSingleSize && config.output.maxSize){
        config.output.maxSingleSize = config.output.maxSize;
        delete config.output.maxSize;
    }
    return config;
}

//****************************************************************
// 2. 合并任务
//****************************************************************

function SpriteTask(fileName){
    this.workspace = mergeTask.config.input.workspace;
    this.fileName = fileName;

}

//****************************************************************
// 2. CSS 样式处理
//****************************************************************

/**
 * 读取并解析样式表文件   
 * @return {CSSStyleSheet} 
 * @example
 * CSSStyleSheet: {
 *  cssRules: [
 *      {
 *          selectorText: "img",
 *         style: {
 *             0: "border",
 *             length: 1,
 *              border: "none"
 *          }
 *      }
 *   ]
 *  } 
 */
var readStyleSheet = function(fileName) {
    fileName = path.join(mergeTask.config.input.workspace, fileName);
    if(!fs.existsSync(fileName)){
        return null;
    }
    var content = fs.readFileSync(fileName);
    var styleSheet = CSSOM.parse(content.toString());
    return styleSheet;
};

/**
 * CSS Style Declaration 的通用方法定义
 * @type {Object}
 * @example
 * CSSStyleDeclaration: {
 *     0: "border",
 *     1: "color",
 *     length: 2,
 *     border: "none",
 *     color: "#333"
 * }
 */
var BaseCSSStyleDeclaration = {

    /**
     * 把background 属性拆分
     * e.g. background: #fff url('...') repeat-x 0px top;
     */
    splitBackground: function(){
        var background, 
            value;

        if(!this['background']){

            // 有 background 属性的 style 才能拆分 background 
            return;
        }

        // 撕裂 background-position
        if(value = this['background-position']){
            value = value.trim().replace(/\s{2}/g,'').split(' ');
            if(!value[1]){
                value[1] = value[0];
            }
            this['background-position-x'] = value[0];
            this['background-position-y'] = value[1];
        }
        background = bgItpreter.analyse(this['background']);
        if(background.length != 1){

            // TODO 暂时跳过多背景的属性
            return;
        }
        background = background[0];
        if(background['background-image']){

            // 把原来缩写的 background 属性删掉
            this.removeAttr('background');

            this.extend(background);
        }
    },

    /**
     * 把 style 里面的 background 属性转换成简写形式, 用于减少代码
     */
    mergeBackgound: function(){
        var background = '', style = this;

        style['background-position'] = (('background-position-x' in style) ? style['background-position-x'] : '') + ' ' +
             (('background-position-y' in style) ? style['background-position-y'] : '');
        style['background-position'] = style['background-position'].trim();

        this.removeAttr('background-position-x');
        this.removeAttr('background-position-y');

        var toMergeAttrs = [
            'background-color', 'background-image', 'background-position', 'background-repeat',
            'background-attachment', 'background-origin', 'background-clip'];
        for(var i = 0, item; item = toMergeAttrs[i]; i++) {
            if(style[item]){
                background += this.removeAttr(item) + ' ';
            }
        }
        style['background'] = background.trim();
        style[style.length++] = 'background';
        
    },

    /**
     * 移除一个属性
     * @param  {String} attr 
     * @return {String} 返回被移除的属性值
     */
    removeAttr: function(attr){
        var value;
        if(!this[attr]){
            return null;
        }
        value = this[attr];
        delete this[attr];

        // 同时移除用数字下标索引的属性名称
        for(var i = 0, item; item = this[i]; i++) {
            if(item === attr){

                // 把后面的索引往前推进
                for(var j = i; j < this.length - 1; j++){
                    this[j] = this[j + 1];
                }

                // 删除最后一个索引
                delete this[this.length--];
                break;
            }
        }
        return value;
    },

    /**
     * 把 obj 的属性和属性值扩展合并过来, 并调整下标, 方法将被忽略
     * @param  {Object} obj 
     * @param  {Boolean} override 是否覆盖也有属性
     */
    extend: function(obj, override){
        for(var i in obj){
            if(us.isFunction(obj[i])){
                continue;
            }else if(this[i] && !override){
                continue;
            }
            this[i] = obj[i];
            this[this.length++] = i;
        }

    }

}

/**
 * 所用到的一些正则
 */
var regexp = {
    ignoreNetwork: /^(https?|ftp):\/\//i,
    ignorePosition: /right|center|bottom/i,
    ignoreRepeat: /^(repeat-x|repeat-y|repeat)$/i,
    image: /\(['"]?(.+\.(png|jpg|jpeg))(\?.*?)?['"]?\)/i,
    css: /(.+\.css).*/i

}

/**
 * 收集需要合并的样式和图片
 * @param  {CSSStyleSheet} styleSheet 
 * @param  {Object} result     
 * @return {Object}     
 * @example
 * result: {
 *     length: 1,
 *     "./img/icon1.png": {
 *         url: "./img/icon1.png",
 *         cssRules: []
 *     }
 * }       
 */
var collectStyleRules = function(styleSheet, result){
    if(!styleSheet.cssRules.length){
        return;
    }

    if(!result){
        result = {
            length: 0
        }
    }

    // 遍历所有 css 规则收集进行图片合并的样式规则
    styleSheet.cssRules.forEach(function(rule, i){

        // typeof rule === 'CSSStyleRule'
        if(rule.href && rule.styleSheet){

            // @import 引入的样式表, 把 css 文件读取进来继续处理
            var fileName = rule.href;
            
            // 忽略掉链接到网络上的文件
            if(!fileName || !regexp.ignoreNetwork.test(fileName)){
                return;
            }
            var match = fileName.match(regexp.css);
            if(!match){
                return;
            }
            fileName = match[1];

            var styleSheet = readStyleSheet(fileName);
            if(!styleSheet){
                return;
            }
            rule.styleSheet = styleSheet;

            // 继续收集 import 的样式
            collectStyleRules(styleSheet, result);
            return;
        }

        if(rule.cssRules && rule.cssRules.length){

            // 遇到有子样式的，比如 @media, @keyframes，递归收集
            collectStyleRules(rule, result);
            return;
        }

        if(!rule.style){

            // 有可能 @media 等中没有任何样式, 如: @media xxx {}
            return;
        }

        /* 
         * typeof style === 'CSSStyleDeclaration'
         * 给 style 对象扩展基本的方法
         */
        var style = us.extend(rule.style, BaseCSSStyleDeclaration);

        if(style['background-size']){

            /* 
             * 跳过有 background-size 的样式, 因为:
             * 1. backgrond-size 不能简写在 background 里面, 而拆分 background 之后再组装, 
             *    background 就变成在 background-size 后面了, 会导致 background-size 被 background 覆盖;
             * 2. 拥有 backgrond-size 的背景图片一般都涉及到拉伸, 这类图片是不能合并的
             */
            return;
        }
        if(style['background']){
            
            // 有 background 属性的 style 就先把 background 简写拆分出来
            style.splitBackground();
        }
        
        if(regexp.ignorePosition.test(style['background-position-x']) || 
            regexp.ignorePosition.test(style['background-position-y'])){

            /*
             * background 定位是 right center bottom 的图片不合并
             * 因为这三个的定位方式比较特殊, 浏览器有个自动适应的特性
             * 把刚刚拆分的 background 属性合并并返回
             */
             style.mergeBackgound();
            return;
        }

        if(regexp.ignoreRepeat.test(style['background-repeat']) || 
            regexp.ignoreRepeat.test(style['background-repeat-x']) || 
            regexp.ignoreRepeat.test(style['background-repeat-y'])){

            // 显式的使用了平铺的图片, 也不进行合并
            style.mergeBackgound();
            return;
        }

        if(style['background-image'] && 
            style['background-image'].indexOf(',') == -1 && // TODO 忽略掉多背景的属性
            (imageUrl = getImageUrl(style['background-image']))){
            
            // 遇到写绝对路径的图片就跳过
            if(ignoreNetworkRegexp.test(imageUrl)){

                // 这里直接返回了, 因为一个style里面是不会同时存在两个 background-image 的
                continue;
            }
        }
    });

    for(var i = 0, rule, style, imageUrl, imagePath; rule = styleSheet.cssRules[i]; i++) {
                style = rule.style;
        
        // 有背景图片, 就抽取并合并
        if(style['background-image'] && 
            style['background-image'].indexOf(',') == -1 &&//TODO 忽略掉多背景的属性
            (imageUrl = getImageUrl(style['background-image']))){
            //遇到写绝对路径的图片就跳过
            if(ignoreNetworkRegexp.test(imageUrl)){
                //这里直接返回了, 因为一个style里面是不会同时存在两个background-image的
                continue;
            }
            imagePath = path.join(spriteConfig.input.imageRoot, imageUrl);
            if(!fs.existsSync(imagePath)){
                //如果这个图片是不存在的, 就直接返回了, 进行容错
                continue;
            }
            // 把用了同一个文件的样式汇集在一起
            if(!result[imageUrl]){
                result[imageUrl] = {// an StyleObj
                    url: imageUrl,
                    cssRules: []
                };
                result.length++;
            }
            result[imageUrl].cssRules.push(style);
        }
    }
    return result;
}

/**
 * 从background-image 的值中提取图片的路径
 * @return {String}       url
 */
var getImageUrl = function(backgroundImage){
    var format = spriteConfig.input.format;
    var m = backgroundImage.match(imageRegexp);
    if(m && format.indexOf(m[2]) > -1){
        return m[1];
    }
    return null;
}


//****************************************************************
// 主逻辑
//****************************************************************

var mergeTask = {
    config: null,
    cache: null,
    onDone: null,

    start: function(config, done){
        this.start = +new Date;
        this.cache = {};
        this.onDone = done;

        // 1. 读取和处理合图配置
        this.config = readConfig(config);


    },
    finish: function(){
        var timeUse = +new Date - this.start;
        console.log('>>all done. time use:', timeUse, 'ms');
        this.onDone && this.onDone(timeUse);
    }
}

/**
 * ispriter 的主要入口函数
 * @param  {Object|String} config ispriter 的配置对象或者是配置文件, 
 * 如不清楚请参照 README.md
 * @param {Function} done 当精灵图合并完成后触发
 */
exports.merge = function(config, done){

    mergeTask.start(config, done);

}

// Task.JS Specification API https://github.com/taskjs/spec
exports.run = function(options, done){
    exports.merge(options, done);
}

//****************************************************************
// 0000. for test
//****************************************************************
readConfig('./config.example.json');