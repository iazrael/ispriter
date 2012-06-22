var fs = require('fs'),
    CSSOM = require('cssom'),
    Canvas = require('canvas'),
    GrowingPacker = require('./GrowingPacker'),
    bgItpreter = require('./BackgroundInterpreter');

var golbalConfig,
    globalImageMap;

var readConfig = function(configFile){
    var content = readFile(configFile);
    var config = JSON.parse(content);
    return config;
}

var readFile = function(fileName){
    return fs.readFileSync(fileName).toString();
}

var readFiles = function(dir){
    var list = fs.readdirSync(dir),
        result = [],
        cssNameReg = /\.css$/i,
        stat;
    for(var i = 0, name; name = list[i]; i++) {
        cssNameReg.test(name) && (stat = fs.statSync(dir + name)) && 
            stat.isFile() && result.push(name);
        
    };
    return result;
}

var parseCssToStyleSheet = function(cssContent){
    return CSSOM.parse(cssContent);
}

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

var mergeStyle = function(style, exStyle){// 如果 style 里面有的属性, 就不用 exStyle 的覆盖
    for(var i in exStyle){
        if(style[i]){
            continue;
        }
        style[i] = exStyle[i];
        style[style.length++] = i;
    }

}

// background: #fff url('...') repeat-x 0px top;
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
        mergeStyle(style, background);
    }
}

var imageRegexp = /\(['"]?(.+\.(png|jpg|jpeg))(\?.*?)?['"]?\)/i;
var collectCSSRulesAndImages = function(styleSheet, result){
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
            collectCSSRulesAndImages(rule, result);
            continue;
        }
        style = rule.style;
        if(style.background){//有 background 就先拆分
            splitStyleBackground(style);
        }
        if(style['background-image']){// 有背景图片, 就抽取并合并
            imageUrl = style['background-image'];
            imageUrl = imageUrl.match(imageRegexp);
            if(imageUrl && golbalConfig.format.indexOf(imageUrl[2]) > -1){
                imageUrl = imageUrl[1];
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

var readImages = function(imageList){
    var len = imageList.length,
        url,
        content,
        image,
        imageObj,
        existImgObj;
    delete imageList.length;
    for(var i in imageList){
        imageObj = imageList[i];
        url = imageObj.url;
        if (globalImageMap[url]){
            //在面对多css文件的时候，如果前面已经读取并合并过一个图片，这里就重用了
            existImgObj = globalImageMap[url];
            image = existImgObj.image;

            imageObj.hasDrew = true;
            imageObj.fit = existImgObj.fit;
            imageObj.spriteName = existImgObj.spriteName;
            // console.log('has: ' + url + ', ' + existImgObj.spriteName);
        }else{
            content = fs.readFileSync(golbalConfig.cssRoot + url);
            image = new Canvas.Image();
            image.src = content;
            //cache to avoid duplicate
            globalImageMap[url] = imageObj;
        }
        imageObj.w = image.width;
        imageObj.h = image.height;
        imageObj.image = image;
    }
}

var objectToArrays = function(object){
    var array = [],
        obj,
        existArr = []
        ;
    for(var i in object){
        obj = object[i];
        if(!obj.fit){
            array.push(obj);
        }else{
            existArr.push(obj);
        }
    }
    //packer 算法需要把最大的一个放在首位...
    //排序算法会对结果造成比较大的影响
    array.sort(function(a, b){
        // if(b.w > a.w){
        //     return 1;
        // }
        // if(b.h > a.h){
        //     return 1;
        // }
        // return -1;
        // return b.h - a.h ;
        // return b.w  - a.w ;
        return b.w * b.h - a.w * a.h;
    });

    return [array, existArr];
}   

var positionImages = function(imageList){
    var packer = new GrowingPacker();
    //object to array
    var arr = objectToArrays(imageList);
    imageList = arr[0];
    packer.fit(imageList);
    imageList = imageList.concat(arr[1]);//把先前已经合并过的图片信息也存过来
    return {
        imageList: imageList,
        canvasWidth: packer.root.w,
        canvasHeight: packer.root.h
    };
}

var setBackgroundPosition = function(rule, attr, newValue){
    var value;
    if(rule[attr]){
        value = parseFloat(rule[attr]);
    }else{
        value = 0;
        rule[rule.length++] = attr;
    }
    value = value - newValue;
    value = value ? value + 'px' : '0';
    rule[attr] = value;
}

var mergeBackgound = function(rule){
    var background = '';

    rule['background-position'] = rule['background-position-x'] + ' ' + rule['background-position-y'];
    removeStyleAttr(rule, 'background-position-x');
    removeStyleAttr(rule, 'background-position-y');
    var attrList = [
        'background-color', 'background-image', 'background-position', 'background-repeat',
        'background-attachment', 'background-origin', 'background-clip'];
    for(var i = 0, item; item = attrList[i]; i++) {
        if(rule[item]){
            background += rule[item] + ' ';
            removeStyleAttr(rule, item);
        }
    }
    rule['background'] = background.trim();
    rule[rule.length++] = 'background';
    
}

var replaceAndPositionBackground = function(spriteName, imageObj){
    for(var i = 0, rule, value; rule = imageObj.cssRules[i]; i++) {
        rule['background-image'] = 'url(' + spriteName + ')';
        //set background-position-x
        setBackgroundPosition(rule, 'background-position-x', imageObj.fit.x);

        //set background-position-y
        setBackgroundPosition(rule, 'background-position-y', imageObj.fit.y);

        //mergeBackgound, 合并 background 属性, 用于减少代码量
        mergeBackgound(rule);
    };
}

var drawImageAndPositionBackground = function(dirName, fileName, width, height, imageList){
    var canvas = new Canvas(width, height),
        ctx = canvas.getContext('2d');

    for(var i = 0, item; item = imageList[i]; i++) {
        if(item.hasDrew){//如果之前已经写入过文件， 这里只要用原来的信息定位就好了
            replaceAndPositionBackground(item.spriteName, item);
        }else{
            item.spriteName = fileName;
            replaceAndPositionBackground(fileName, item);
            ctx.drawImage(item.image, item.fit.x, item.fit.y, item.w, item.h);
        }
    };
    fs.writeFileSync(dirName + fileName, canvas.toBuffer());
}

var writeFile = function(fileName, styleSheet){
    fs.writeFileSync(fileName, styleSheet.toString());
}

/**
 * as you see, it's the main function
 */
var main = function(configFile){
    var //configFile,
        config,
        cssFileNameList,
        cssContent,
        styleSheet,
        imageList,
        positionResult,
        spriteCount = 0,
        spriteName,
        newFileName;
    // if(process.argv.length < 3){
    //     console.log('missing the config file');
    //     return;
    // }
    // configFile = process.argv[2];
    globalImageMap = {};
    config = golbalConfig = readConfig(configFile);
    cssFileNameList = readFiles(config.cssRoot);
    if(!cssFileNameList.length){
        console.log('there is no file in ' + config.cssRoot);
        return;
    }
    for(var i = 0, fileName; fileName = cssFileNameList[i]; i++) {
        cssContent = readFile(config.cssRoot + fileName);
        styleSheet = parseCssToStyleSheet(cssContent);

        imageList = collectCSSRulesAndImages(styleSheet);
        if(!imageList.length){
            //TODO 是否将没有修改的文件也写到 output 里?
            continue;
        }
        readImages(imageList);

        positionResult = positionImages(imageList);
        imageList = positionResult.imageList;

        spriteName = config.imageOutput + config.outputPrefix + ++spriteCount + '.' + 
            config.outputFormat;
        drawImageAndPositionBackground(config.cssOutput, spriteName, positionResult.canvasWidth, 
                                       positionResult.canvasHeight, imageList);
        
        newFileName = config.cssOutput + fileName;
        //finally at the end...
        writeFile(newFileName, styleSheet);
    };
}

// main();

exports.merge = main;
