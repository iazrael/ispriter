/*  方便以后切换 CSS 解析器 */

var fs = require('fs'),

    path = require('path'),

    constant = require('../constant');

    CSSRule = require('./CSSRule').CSSRule,

    Logger = require('../Logger');


/*
    - CSSSheet {} css 文件信息汇总
        - filename css 文件名
        - filepath css 文件的绝对路径
        - cssRules [CSSRule] 该 css 文件的所有样式规则
        - imports [CSSSheet] @import 引入的所有样式文件 //TODO @import没有处理
        - uri css 文件中 @import 的原始值
 */

function CSSSheet(config, uri){
    
    this.config = config;

    this.uri = uri;

    this.filename = path.basename(uri);

    this.filepath = path.resolve(path.join(config.workspace, uri));

    this.content = fs.readFileSync(this.filepath).toString();

    this.cssRules = this.pickupCSSRules();

}

/**
 * 收集带有background的cssrule(相当于一个带有background的class)
 * @param  {[type]} cssText [description]
 * @return {[type]}         [description]
 */
CSSSheet.prototype.pickupCSSRules = function(cssText){
    var cssText = this.content,
        length = cssText.length,
        cssRules = [],
        cssStr,
        cssName;
    var pos = -1,   //切割游标
        bgPos,      //background 的下标
        start, end, //这个class的相对值的start,end (就是“{”，“}”的位置)
        cssStart, cssEnd,  //包括cssname的的start,end
        tmpPos;     //临时游标

    // 用于对文本进行操作
    var tmpText,    //临时文本段
        thisText, //本次循环处理的文本段

        preText,
        postText;

    while(pos++ < length){

        // 把已经处理过的文本切出来
        thisText = cssText.substring(pos); // xx .name { color: #fff; background: xxx } xx

        // 把 background 找出来
        bgPos = thisText.indexOf('background'); // xx .name { color: #fff; [i]background: xxx } xx
        if(bgPos === -1){
            break;
        }

        // 向前 / 向后找到样式闭合点和样式名字
        // 向前找 {
        preText = thisText.substring(0, bgPos); // xx .name { color: #fff; 
        start = preText.lastIndexOf('{');  // xx .name []{ color: #fff; 
        //(这个class 前半部分被接收了)
        cssStr = preText.substring(start); // { color: #fff;  


        // 继续向前找cssName
        tmpText = preText.substring(0, start);    // xx .name 
        cssStart = tmpText.lastIndexOf('}') +1;   // 找到前一个样式的结束符, 中间的就是名字( +1 是为了跳过 } )

        // 中间可能有注释, 要排除掉注释
        cssName = tmpText.substring(cssStart).replace(/\/\*.*?\*\//, '');    // .name 

        // 向后找 }
        postText = thisText.substring(bgPos); // background: xxx }
        end = postText.indexOf('}') + 1;     // background: xxx []}  (+1 是为了包括 })
        // 这个class后半部分接收 
        cssStr += postText.substring(0, end); // background: xxx }  

        //位置要相对于整个css文件（注意start end 的相对值不一样的）
        cssStart = pos + start;
        cssEnd =  pos + bgPos + end + 1;

        // pos 是指在完整 cssText 中的位置
        cssRules.push(new CSSRule(cssName, cssStr, cssStart, cssEnd ));

        pos += (bgPos + end);  //只怎这次捕捉到的长度

    }

    // Logger.debug(cssRules);
    return cssRules;
}

/**
 * 过滤出需要合并图片的样式,过滤掉不需要合图的CSSRule
 * 并且输出不行合图的图片路径数组
 * @param  {Function} callback
 * @return {Array}  unspriteImages
 */
CSSSheet.prototype.filtercssRules = function( callback) {
    var self = this,
        cssRules = this.cssRules,
        config = this.config;

    var toSpriteCssRules = [],
        unspriteImages = [];

    cssRules.forEach(function(cssRule) {
        var normalizer = cssRule.__normalizer;

        if (!normalizer || !normalizer['background-image']) {
            // 没有图片的, 走你
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

        } else if (match[2] === 'ext' || match[2] === 'ignore') {

            // 后缀不符合配置要求的, 只做文件拷贝
            var cssDirname = path.dirname(self.filepath);
            unspriteImages.push(path.join(cssDirname, match[0]));

        } else {
            // 其他不符合要求的都抛弃这个CSSRule
        }

    });
    
    //现在赋值的cssRules都是需要合图的
    this.cssRules = toSpriteCssRules

    return unspriteImages;
}


/**
 * 把 CSSSheet 的内容转换成 css 字符串 (排序，切割，替换)
 * @return {String} css 字符串
 */
CSSSheet.prototype.toString = function() {
    var cursor = 0,
        content = this.content,
        cssRules = this.cssRules,
        cssTextArray = [];

    //根据start排序
    cssRules.sort(function(a,b){
        return a.start - b.start;
    });     

    for(var i in cssRules){
        var cssRule = cssRules[i];
        cssTextArray.push(content.slice(cursor,cssRule.start));
        cssTextArray.push(cssRule.toString()+'\n');
        cursor = cssRule.end;         
    }

    //闭合这段cssText
    cssTextArray.push(content.slice(cursor)); //末尾最后一段str


    return cssTextArray.join('');
};



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

    if (constant.REGEXP_IGNORE_IMAGE.test(value)) { // 去掉不需要合并图片
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


exports.CSSSheet = CSSSheet;