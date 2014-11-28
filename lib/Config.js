/**
 * @author azrael
 * @date 2013-11-21
 * @description 解析配置
 * 把传入的配置(最简配置或者完整配置等)进行适配和整理
 */

var fs = require('fs'),
    path = require('path'),
    us = require('underscore'),

    FileTool = require('./FileTool'),
    zTool = require('./ztool'),
    constant = require('./constant');


/**
 * 对旧的配置项做兼容
 * @param  {Config} config 
 * @return {Config}        
 */
function adjustOldProperty(config){

    if(!config.input.cssSource && 'cssRoot' in config.input){

        config.input.cssSource = config.input.cssRoot;
        delete config.input.cssRoot;
    }
    if(!config.output.cssDist && 'cssRoot' in config.output){

        config.output.cssDist = config.output.cssRoot;
        delete config.output.cssRoot;
    }
    if(!config.output.imageDist && 'imageRoot' in config.output){

        config.output.imageDist = config.output.imageRoot;
        delete config.output.imageRoot;
    }
    if(!config.output.maxSingleSize && 'maxSize' in config.output){

        config.output.maxSingleSize = config.output.maxSize;
        delete config.output.maxSize;
    }
    return config;
}


/**
 * 解析配置, 支持config 为配置文件名或者为配置对象
 * 
 * @param  {Object|String} config 配置文件或者配置对象
 * @return {Config}        读取并解析完成的配置对象
 */
exports.parse = function(config){

    if(us.isString(config)){

        if(!fs.existsSync(config)){

            throw 'place give in a sprite config or config file!';
        }
        var content = fs.readFileSync(config).toString();
        config = zTool.jsonParse(content);

    }else if(us.isArray(config)){

        config = {
            input: config
        };
    }
    config = config || {};

    // 适配最简配置
    if(us.isString(config.input) || us.isArray(config.input)){

        config.input = {
            cssSource: config.input
        };
    }
    if(!config.output){

        config.output = {};
    }else if(us.isString(config.output)){

        config.output = {
            cssDist: config.output
        };
    }

    // 对旧的配置项进行兼容
    config = adjustOldProperty(config);

    // 
    config = zTool.merge({}, constant.DEFAULT_CONFIG, config);

    var cssSource = config.input.cssSource;
    if(!cssSource){

        throw 'there is no cssSource specific!';
    }else if(us.isString(cssSource)){

        cssSource = [cssSource];
    }

    // 读取所有指定的 css 文件
    var cssFiles = [], cssPattern, queryResult;
    for(var i = 0; i < cssSource.length; i++){

        cssPattern = path.normalize(cssSource[i]).replace(/\\/g, '\\\\');

        if(zTool.endsWith(cssPattern, path.sep)){

            cssPattern += '*.css';
        }else if(!zTool.endsWith(cssPattern, '.css')){

            cssPattern += '/*.css';
        }

        queryResult = FileTool.query(config.workspace, cssPattern);
        cssFiles = cssFiles.concat(queryResult);
    }
    if(!cssFiles.length){

        throw 'there is no any css file contain!';
    }

    // 去重
    cssFiles = us.unique(cssFiles);

    config.input.cssSource = cssFiles;

    // 解析要排除的图片规则
    var ignoreImages = config.input.ignoreImages;
    if(ignoreImages){

        if(!us.isArray(ignoreImages)){

            ignoreImages = [ignoreImages];
        }
        ignoreImages.forEach(function(pattern, i){

            ignoreImages[i] = zTool.wildcardToPattern(pattern);
        });
    }

    // 确保输出路径是个目录
    if(!zTool.endsWith(config.output.cssDist, '/')){

        config.output.cssDist += '/';
    }
    config.output.cssDist = path.normalize(config.output.cssDist);

    if(!zTool.endsWith(config.output.imageDist, '/')){
        
        config.output.imageDist += '/';
    }

    // KB 换算成 B
    config.output.maxSingleSize *= 1024;

    // 确保 margin 是整数
    config.output.margin = parseInt(config.output.margin, 10);
    
    // debug(config);
    return config;
};