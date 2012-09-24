var fs = require('fs'),
    path = require('path'),
    CSSOM = require('cssom'),
    Canvas = require('canvas'),
    GrowingPacker = require('./GrowingPacker'),
    bgItpreter = require('./BackgroundInterpreter'),
    ztool = require('./ztool');

var spriteConfig, spriteCache;

/**
 * 读取配置
 * @param  {[type]} configFile [description]
 * @return {[type]}            [description]
 */
var readConfig = function(configFile){
    var content = fs.readFileSync(configFile).toString();
    var config = JSON.parse(content);

    return config;
}
//****************************************************************
// 收集需要合并的样式和图片
//****************************************************************

var ignoreNetworkRegexp = /^(https?|ftp):\/\//i;
var imageRegexp = /\(['"]?(.+\.(png|jpg|jpeg))(\?.*?)?['"]?\)/i;
var ignorePositionRegexp = /right|center|bottom/i;
var ignoreRepeatRegexp = /^(repeat-x|repeat-y|repeat)$/i;

/**
 * 收集需要合并的样式和图片
 * @param  {[type]} styleSheet [description]
 * @param  {[type]} result     [description]
 * @return {[type]}            [description]
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
    for(var i = 0, rule, style, imageUrl; rule = styleSheet.cssRules[i]; i++) {
        if(rule.cssRules && rule.cssRules.length){
            //遇到有子样式的，比如@media, @keyframes，递归收集
            collectStyleRules(rule, result);
            continue;
        }
        style = rule.style;
        if(!style) { // 有可能 `@media`  等中没有 样式， 如： `@media xxx {}`
            continue;
        };
        if(style['background-size']){//跳过有background-size的样式
            //因为backgrond-size不能简写在background里面，而且拆分background之后再组装的话
            //background就变成再background-size后面了，会导致background-size被background覆盖
            continue;
        }
        if(style.background){//有 background 就先拆分
            splitStyleBackground(style);
        }
        // background 定位是 right center bottom 的图片不合并
        // 因为这三个的定位方式比较特殊， 浏览器有个自动适应的特性
        if(ignorePositionRegexp.test(style['background-position-x']) || 
            ignorePositionRegexp.test(style['background-position-y'])){
            mergeBackgound(style);
            continue;
        }
        // 显式的使用了平铺的， 也不合并
        if(ignoreRepeatRegexp.test(style['background-repeat']) || 
            ignoreRepeatRegexp.test(style['background-repeat-x']) || 
            ignoreRepeatRegexp.test(style['background-repeat-y'])){
            mergeBackgound(style);
            continue;
        }
        if(style['background-image']){// 有背景图片, 就抽取并合并
            imageUrl = style['background-image'];
            imageUrl = imageUrl.match(imageRegexp);

            if(imageUrl && spriteConfig.input.format.indexOf(imageUrl[2]) > -1){
                imageUrl = imageUrl[1];
                //遇到写绝对路径的图片就跳过
                if(ignoreNetworkRegexp.test(imageUrl)){
                    return result;//这里直接返回了, 因为一个style里面是不会同时存在两个background-image的
                }
                // 把用了同一个文件的样式汇集在一起
                if(!result[imageUrl]){
                    result[imageUrl] = {
                        url: imageUrl,
                        cssRules: []
                    };
                    result.length++;
                }
                result[imageUrl].cssRules.push(style);
            }
        }
    }
    return result;
}

/**
 * 把background 属性拆分
 * e.g. background: #fff url('...') repeat-x 0px top;
 * @param  {[type]} style [description]
 * @return {[type]}       [description]
 */
var splitStyleBackground = function(style){
    var background, 
        value;
    // 撕裂 background-position
    if(value = style['background-position']){
        value = value.trim().replace(/\s{2}/g,'').split(' ');
        if(!value[1]){
            value[1] = value[0];
        }
        style['background-position-x'] = value[0];
        style['background-position-y'] = value[1];
    }
    background = bgItpreter.analyse(style.background);
    if(background['background-image']){
        removeStyleAttr(style, 'background');
        mergeStyleAttr(style, background);
    }
}

/**
 * 从 style 中删除属性
 * @param  {[type]} style [description]
 * @param  {[type]} attr  [description]
 * @return {[type]}       [description]
 */
var removeStyleAttr = function(style, attr){
    if(!style[attr]){
        return;
    }
    delete style[attr];
    for(var i = 0, item; item = style[i]; i++) {
        if(item === attr){
            for(var j = i; j < style.length - 1; j++){
                style[j] = style[j + 1];
            }
            delete style[style.length--];
            break;
        }
    };
}

/**
 * 合并两个style
 * 如果 style 里面有的属性, 就不用 exStyle 的覆盖
 * @param  {[type]} style   [description]
 * @param  {[type]} exStyle [description]
 * @return {[type]}         [description]
 */
var mergeStyleAttr = function(style, exStyle){
    for(var i in exStyle){
        if(style[i]){
            continue;
        }
        style[i] = exStyle[i];
        style[style.length++] = i;
    }

}

/**
 * 把 style 里面的background属性转换成简写形式
 * @param  {[type]} style [description]
 * @return {[type]}      [description]
 */
var mergeBackgound = function(style){
    var background = '';

    style['background-position'] = (('background-position-x' in style) ? style['background-position-x'] : '') + ' ' +
         (('background-position-y' in style) ? style['background-position-y'] : '');
    style['background-position'] = style['background-position'].trim();

    removeStyleAttr(style, 'background-position-x');
    removeStyleAttr(style, 'background-position-y');
    var attrList = [
        'background-color', 'background-image', 'background-position', 'background-repeat',
        'background-attachment', 'background-origin', 'background-clip'];
    for(var i = 0, item; item = attrList[i]; i++) {
        if(style[item]){
            background += style[item] + ' ';
            removeStyleAttr(style, item);
        }
    }
    style['background'] = background.trim();
    style[style.length++] = 'background';
    
}
//****************************************************************
// 主逻辑
//****************************************************************

/**
 * 主逻辑
 * @param  {[type]} configFile [description]
 * @return {[type]}            [description]
 */
exports.merge = function(configFile){
    spriteCache = {};
    var config = spriteConfig = readConfig(configFile);

    var fileList = ztool.readFileSync(config.input.cssRoot, 'css');
    if(!fileList.length){
        console.log('there is no file in ' + config.input.cssRoot);
        return;
    }
    for(var i = 0, fileObj; fileObj = fileList[i]; i++){
        var spriteObj = {};
        spriteObj.fileName = fileObj.fileName;
        //解析样式表
        spriteObj.styleSheet = CSSOM.parse(fileObj.content);
        //收集需要合并的图片信息
        var styleObjList = collectStyleRules(spriteObj.styleSheet);

    }

    for(var i = 0, fileName; fileName = cssFileNameList[i]; i++) {
        // cssContent = readFile(config.cssRoot + fileName);
        //解析样式表
        // styleSheet = parseCssToStyleSheet(cssContent);
        //收集需要合并的图片信息
        imageList = collectStyleRules(styleSheet);
        if(!imageList.length){
            continue;
        }
        //读取图片内容，以及大小
        readImages(imageList);
        //对图片进行定位
        positionResult = positionImages(imageList);
        imageList = positionResult.imageList;
        //把合并后的图片输出并修改样式表里面的background
        spriteName = config.imageOutput + config.outputPrefix + fileName.split('.')[0] 
            + '.' + config.outputFormat;
        drawImageAndPositionBackground(config.cssOutput, spriteName, positionResult.canvasWidth, 
                                       positionResult.canvasHeight, imageList);
        //输出修改后的文件
        newFileName = config.cssOutput + fileName;
        //finally at the end...
        writeFile(newFileName, styleSheet);
    };
}

