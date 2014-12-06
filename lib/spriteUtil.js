var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    _ = require('underscore');


/**
 * 收集同一张图片下的所有cssRules(以图片路径为key)
 * @param  {[type]} cssRules [description]
 * @return {[type]}          [description]
 */
exports.collectImageRules = function(cssRules){

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
exports.setImageMaxWidthHeight = function(imageInfo,config){
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
 * 获取这个css文件的所有className
 **/
exports.getCSSNamesBySheet = function(spriteTask){
    var result = [],
        cssRules = [];

    if(spriteTask.cssSheetArray){ //证明是合并的task
        spriteTask.cssSheetArray.forEach(function(sheet){
            cssRules = _.union(cssRules, sheet.cssRules);
        })
    }else{
        cssRules = spriteTask.cssSheet.cssRules;
        
    }
    cssRules.forEach(function(cssRule){
        result.push(cssRule.cssName);
    })


    return result;
}


/**
 * 创建精灵图的文件名, 前缀 + css 文件名 + 文件后缀, 如果设置了 maxSingleSize, 
 * 则会在文件名后面加上下标
 * @param  {SpriteTask} spriteTask 
 * @param  {Number} index       
 * @param  {Number} total       
 */
exports.createSpriteImageName = function(spriteTask, index, total){

    var name = '',
        cssFileName = spriteTask.cssSheet.filename,
        config = spriteTask.config;

    if(cssFileName){ // 去掉文件后缀, 提取出文件名字
        var basename = path.basename(cssFileName);
        var extname = path.extname(basename);
        name = basename.replace(extname, '');
    }

    // 设置了 maxSingleSize, 文件名会是类似 _1, _2 这种
    if(config.output.maxSingleSize && total > 1){
        name += '_' + index;
    }

    name = config.output.prefix + name + '.' + config.output.format;

    return config.output.imageDist + name;
}


/**
 * 把合并的结果写到cssRule的__outSpriteAttr中
 * 经过考虑，不是采用修改属性或删除原始数据的方式，而是增加合图之后的属性方法。
 * @param  {SpriteTask} spriteTask
 * @param  {String} imageName   
 * @param  {StyleObj} imageInfo    
 * @param  {Array} combinedSelectors 被合并了图片的选择器
 */
exports.replaceAndPositionBackground = function(spriteTask,imageName, imageInfo, combinedSelectors){

    var self = this,
        config = spriteTask.config,
        cssNames = spriteTask.cssNames;

    function _getNewPosition(cssRule, attr, newValue){
        var oldvalue = cssRule['__normalizer'][attr] || 0 ;
        var result = oldvalue - newValue;     //如果原来的就有background-position，就在此基础上相减
        return result ? result + 'px' : '0';
    }

    imageInfo.cssRules.forEach(function(cssRule){

        var cssRuleSpriteAttr = cssRule['__outSpriteAttr'] = {};

        if(config.output.combineCSSRule){
            // 不分别设置 background-image, 改为统一设置, 减少 css 文件大小
            if(cssRule.cssName && (_.contains(cssNames, cssRule.cssName) || config.output.combine) ){
                combinedSelectors.push(cssRule.cssName);
            }
        }else{
            cssRuleSpriteAttr['background-image'] = 'url(' + imageName + ')';
        }

        // mergeBackgound, 合并 background 属性, 减少代码量 
        // cssRule.mergeBackgound();

        // 现在同一不支持带有repeat的背景合图
        cssRuleSpriteAttr['background-repeat'] = 'no-repeat';

        cssRuleSpriteAttr['background-position'] = _getNewPosition(cssRule,'background-position-x',imageInfo.fit.x) + ' ' + 
                                                   _getNewPosition(cssRule,'background-position-y',imageInfo.fit.y);

    });
}


