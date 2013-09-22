
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
         * 如果指定 imageDist 为 "./img/sprite/", 则在输出的 css 中会显示为
         * background: url("./img/sprite/sprite_1.png");
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
    config = us.extend({}, DEFAULT_CONFIG, config);
    console.log(config);
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
// 0000. for test
//****************************************************************
readConfig('./config.example.json');