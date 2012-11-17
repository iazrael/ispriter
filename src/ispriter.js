var fs = require('fs'),
    path = require('path'),
    CSSOM = require('cssom'),
    Canvas = require('canvas'),
    GrowingPacker = require('./GrowingPacker'),
    bgItpreter = require('./BackgroundInterpreter'),
    ztool = require('./ztool'),
    nf = require('node-file');

var spriteConfig, imageInfoCache;

//****************************************************************
// 数据结构定义
//****************************************************************
/**
 * StyleObj 的属性定义, 只是为了备忘而已
 * @type {Object}
 */
var StyleObj = {
    url: '',//样式中包含的背景图片的路径
    cssRules: [],//用到了该图片的样式的集合
    imageInfo: null//图片的信息, 参看 ImageInfo
    
}

/**
 * ImageInfo 图片信息的属性定义
 * @type {Object}
 */
var ImageInfo = {
    url: '',//图片路径
    image: null,//图片内容
    size: 0,//图片的大小
    width: 0,//宽
    height: 0//高
}

//****************************************************************
// 读取配置
//****************************************************************
/**
 * 读取配置
 */
var readConfig = function(config){
    if(ztool.isString(config)){
        var content = fs.readFileSync(config).toString();
        content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.+/g, '');
        config = JSON.parse(content);
    }
    var dir;
    config.algorithm = config.algorithm || 'growingpacker';

    if(typeof config.input === 'string'){
        config.input = {
            cssRoot: config.input
        };
    }

    config.input.cssRoot = path.resolve(config.input.cssRoot) + path.sep;
    if(!config.input.imageRoot){
        config.input.imageRoot = config.input.cssRoot;
    }
    config.input.format = config.input.format || 'png';

    if(typeof config.output === 'string'){
        config.output = {
            cssRoot: config.output
        }
    }
    config.output.cssRoot = path.resolve(config.output.cssRoot) + path.sep;
    if(!config.output.imageRoot){
        config.output.imageRoot = './image/';
    }else{
        dir = config.output.imageRoot;
        if(dir.lastIndexOf(path.sep) !== dir.length - 1){
            dir += path.sep;
        }
        config.output.imageRoot = dir;
    }
    if(!config.output.maxSize){
        config.output.maxSize = 0;
    }else{
        config.output.maxSize = config.output.maxSize * 1024;
    }
    config.output.margin = parseInt(config.output.margin || 0);
    
    config.output.prefix = config.output.prefix || 'sprite_';
    config.output.format = config.output.format || 'png';

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
 * @param  {StyleSheet} styleSheet 
 * @param  {StyleObjList} result     
 * @return {StyleObjList}            
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
        // 有背景图片, 就抽取并合并
        if(style['background-image'] && 
            style['background-image'].indexOf(',') == -1 &&//TODO 忽略掉多背景的属性
            (imageUrl = getImageUrl(style['background-image']))){
            //遇到写绝对路径的图片就跳过
            if(ignoreNetworkRegexp.test(imageUrl)){
                //这里直接返回了, 因为一个style里面是不会同时存在两个background-image的
                return result;
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

/**
 * 把background 属性拆分
 * e.g. background: #fff url('...') repeat-x 0px top;
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
    if(background.length != 1){
        //TODO 暂时跳过多背景的属性
        return;
    }
    background = background[0];
    if(background['background-image']){
        removeStyleAttr(style, 'background');
        mergeStyleAttr(style, background);
    }
}

/**
 * 从 style 中删除属性
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
 * 合并两个style, 并调整下标
 * 如果 style 里面有的属性, 就不用 exStyle 的覆盖
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
 * 用于减少代码
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
// 读取图片信息
//****************************************************************

var readImageInfo = function(styleObjList){
    var styleObj, imageInfo, content, image;

    for(var url in styleObjList){
        styleObj = styleObjList[url];

        if(imageInfo = imageInfoCache[url]){

        }else{
            content = fs.readFileSync(spriteConfig.input.imageRoot + url);
            imageInfo = {};
            
            image = new Canvas.Image();
            image.src = content;
            imageInfo.image = image;
            // console.log(image.size);
            imageInfo.width = image.width;
            imageInfo.height = image.height;
            //图片本身可能是没压缩的, 有很多冗余信息, 这里要取压缩后的 size 才行
            // imageInfo.size = content.length;
            imageInfo.size = getImageSize(image);

            imageInfoCache[url] = imageInfo;
        }
        // 从所有style里面，选取图片宽高最大的作为图片宽高
        setImageWidthHeight(styleObj, imageInfo);

        styleObj.imageInfo = imageInfo;
    }
}

var tmpCanvas = new Canvas();

var getImageSize = function(image){
    tmpCanvas.width = image.width;
    tmpCanvas.height = image.height;
    var ctx = tmpCanvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return tmpCanvas.toBuffer().length;
}

var setImageWidthHeight = function(styleObj, imageInfo){
    var w = 0, h = 0, mw = imageInfo.width, mh = imageInfo.height;
    for(var i = 0, rule; rule = styleObj.cssRules[i]; i++) {
        w = getPxValue(rule.width),
        h = getPxValue(rule.height);
        if(w > mw){
            mw = w;
        }
        if(h > mh){
            mh = h;
        }
    }
    styleObj.w = mw + spriteConfig.output.margin;
    styleObj.h = mh + spriteConfig.output.margin;
}

var getPxValue = function(cssValue){
    if(cssValue && cssValue.indexOf('px') > -1){
        return parseInt(cssValue);
    }
    return 0;
}

//****************************************************************
// 对图片进行坐标定位
//****************************************************************

var positionImages = function(styleObjList){
    var styleObjArr = [], arr = [], existArr = [], styleObj, 
        maxSize = spriteConfig.output.maxSize,
        packer = new GrowingPacker();
    //把已经合并了并已输出的图片先排除掉
    for(var i in styleObjList){
        styleObj = styleObjList[i];
        if(styleObj.imageInfo.hasDrew){
            existArr.push(styleObj);
        }else{
            arr.push(styleObj);
        }
    }
    // console.log(arr);
    //如果限制了输出图片的大小, 则进行分组
    if(maxSize){
        //限制图片大小的算法是:
        //1. 先把图片按从大到小排序
        //2. 顺序叠加图片 size , 超过maxSize 时, 另起一个数组
        //3. 最终把一个数组, 拆成 N 个 总 szie 小于 maxSize 的数组
        arr.sort(function(a, b){
            return b.imageInfo.size - a.imageInfo.size;
        });
        // console.log(arr.length);
        var total = 0, ret = [];
        for(var i = 0; styleObj = arr[i]; i++) {
            total += styleObj.imageInfo.size;

            // console.log(styleObj.url, total);
            if(total > maxSize){
                // console.log('--------------');
                styleObjArr.push(ret);
                ret = [];
                total = styleObj.imageInfo.size;
            }
            ret.push(styleObj);
        }
        if(ret.length){
            styleObjArr.push(ret);
        }
        // console.log(styleObjArr);
    }else{
        styleObjArr.push(arr);
    }
    //packer 算法需要把最大的一个放在首位...
    //排序算法会对结果造成比较大的影响
    for(var j = 0; arr = styleObjArr[j]; j++) {
        arr.sort(function(a, b){
            return b.w * b.h - a.w * a.h;
        });
        //packer 定位
        packer.fit(arr);
        arr.root = packer.root;
    }
    if(existArr.length){
        styleObjArr.push(existArr);
    }
    // console.log(styleObjArr);
    return styleObjArr;
}

//****************************************************************
// 输出合并的图片 并修改样式表里面的background
//****************************************************************

var drawImageAndPositionBackground = function(styleObjArr, cssFileName){
    // console.log(styleObjArr.length);
    var canvas = new Canvas(), hasDrew, 
        imageInfo, imageName, 
        length = styleObjArr.length,
        arr;
    if(!styleObjArr[length - 1].root){
        //若最后一个元素, 没有root 属性, 表示它的样式都是复用已合并的图片的, 直接替换样式即可
        arr = styleObjArr.pop();
        length = styleObjArr.length;
        for(var j = 0, styleObj; styleObj = arr[j]; j++) {
            imageInfo = styleObj.imageInfo;
            styleObj.fit = imageInfo.fit;
            replaceAndPositionBackground(imageInfo.imageName, styleObj);
        }
    }
    for(var i = 0; arr = styleObjArr[i]; i++) {
        canvas.width = arr.root.w;
        canvas.height = arr.root.h;
        ctx = canvas.getContext('2d');
        hasDrew = false;
        imageName = getImageName(cssFileName, i, length);
        // console.log(imageName);
        // console.log('--------');
        for(var j = 0, styleObj; styleObj = arr[j]; j++) {
            imageInfo = styleObj.imageInfo;
            hasDrew = true;
            // console.log(styleObj.url);
            replaceAndPositionBackground(imageName, styleObj);
            imageInfo.fit = styleObj.fit;
            imageInfo.hasDrew = true;
            imageInfo.imageName = imageName;

            ctx.drawImage(imageInfo.image, imageInfo.fit.x, imageInfo.fit.y);
        }
        //如果 canvas 里面没图片， 调用 toBuffer 会出错
        //而且没必要输出一张空白图片
        if(hasDrew){
            imageName = path.resolve(spriteConfig.output.cssRoot + imageName);
            var buffer = canvas.toBuffer();
            // buffer.length 得到的是图片的size， 单位字节（B）
            // console.log(fileName, buffer.length);
            console.log('>>output image:', imageName);
            nf.writeFileSync(imageName, buffer);
        }

    }

}

var getImageName = function(cssFileName, index, total){
    var basename = path.basename(cssFileName);
    var extname = path.extname(basename);
    var name = basename.replace(extname, '');
    if(spriteConfig.output.maxSize && total > 1){
        name += '_' + index;
    }
    return spriteConfig.output.imageRoot + spriteConfig.output.prefix +
        name + '.' + spriteConfig.output.format;
}

var replaceAndPositionBackground = function(imageUrl, styleObj){
    for(var i = 0, rule; rule = styleObj.cssRules[i]; i++) {
        rule['background-image'] = 'url(' + imageUrl + ')';
        //set background-position-x
        setPxValue(rule, 'background-position-x', styleObj.fit.x);

        //set background-position-y
        setPxValue(rule, 'background-position-y', styleObj.fit.y);

        //mergeBackgound, 合并 background 属性, 用于减少代码量
        mergeBackgound(rule);
        // console.log(rule);
    };
}

/**
 * 调整 样式规则的像素值, 如果原来就有值, 则在原来的基础上变更
 */
var setPxValue = function(rule, attr, newValue){
    var value;
    if(rule[attr]){
        value = parseInt(rule[attr]);
    }else{
        value = 0;
        rule[rule.length++] = attr;
    }
    value = value - newValue;
    value = value ? value + 'px' : '0';
    rule[attr] = value;
}

//****************************************************************
// 输出修改后的样式表    
//****************************************************************

var writeCssFile = function(spriteObj){
    var fileName = spriteConfig.output.cssRoot + spriteObj.fileName;
    fileName = path.resolve(fileName);
    nf.writeFileSync(fileName, spriteObj.styleSheet.toString());
}

//****************************************************************
// 主逻辑
//****************************************************************

/**
 * 主逻辑
 */
exports.merge = function(configFile){
    imageInfoCache = {};
    spriteConfig = readConfig(configFile);
    var start = +new Date;
    // console.log(spriteConfig);
    var inputCssRoot = spriteConfig.input.cssRoot;
    var fileList = nf.listFilesSync(inputCssRoot, 'css');
    if(!fileList.length){
        console.log('there is no file in ' + spriteConfig.input.cssRoot);
        return;
    }
    // console.log(fileList);
    for(var i = 0, fileName, content; fileName = fileList[i]; i++){
        var spriteObj = {};
        spriteObj.fileName = fileName;
        //解析样式表
        content = fs.readFileSync(path.join(inputCssRoot,fileName));
        spriteObj.styleSheet = CSSOM.parse(content.toString());
        //收集需要合并的图片信息
        var styleObjList = collectStyleRules(spriteObj.styleSheet);
        if(!styleObjList.length){
            //这个 css 没有需要合并的图片
            continue;
        }
        delete styleObjList.length;
        // console.log(styleObjList);
        
        //读取图片信息(内容, 宽高, 大小)
        readImageInfo(styleObjList);
        // console.log(styleObjList);
        
        //对图片进行坐标定位
        var styleObjArr = positionImages(styleObjList);

        //输出合并的图片 并修改样式表里面的background
        drawImageAndPositionBackground(styleObjArr, fileName);

        //输出修改后的样式表
        writeCssFile(spriteObj);
    }
    console.log('>>all done. time use:', +new Date - start, 'ms');

}

