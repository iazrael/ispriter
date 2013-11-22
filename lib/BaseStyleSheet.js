var fs = require('fs'),
    path = require('path'),

    us = require('underscore'),
    CSSOM = require('cssom'),

    constant = require('./constant');

var BaseStyleSheet = {

    /**
     * 读取并解析样式表文件, 返回一个 StyleSheet 实例
     * @return {CSSStyleSheet} 
     * @example
     * CSSStyleSheet: {
     *  cssRules: [
     *      { // CSSStyleDeclaration
     *         selectorText: "img",
     *         style: {
     *             0: "border",
     *             length: 1,
     *              border: "none"
     *          }
     *      }
     *   ]
     *  } 
     */
    createStyleSheet: function(config, cssUri){

        var cssAbsUri = path.join(config.workspace, cssUri);
        if(!fs.existsSync(cssAbsUri)){

            return null;
        }
        var content = fs.readFileSync(cssAbsUri);
        var styleSheet = CSSOM.parse(content.toString());
        styleSheet.config = config;
        styleSheet.cssUri = cssUri;
        return us.extend(styleSheet, this);
    },

    /**
     * @return {StyleObjList}               
     */
    collectStyleRules: function(){

        return collectStyleRules(this, null, this.cssUri);
    }

}

// exports.REGEXP_IGNORE_NETWORK = /^(https?|ftp):\/\//i;

// exports.REGEXP_IGNORE_POSSITION = /right|center|bottom/i;

// exports.REGEXP_IGNORE_REPEAT = /^(repeat-x|repeat-y|repeat)$/i;

// exports.REGEXP_IGNORE_IMAGE = /#unsprite\b/i;

// exports.REGEXP_IMAGE = /\(['"]?(.+\.(png|jpg|jpeg))((\?|#).*?)?['"]?\)/i;

// exports.REGEXP_CSS = /(.+\.css).*/i;

/**
 * 收集需要合并的样式和图片
 * @param  {CSSStyleSheet} styleSheet 
 * @param  {Object} result StyleObjList
 * @return {Object}     
 * @example
 * result: { // StyleObjList
 *     length: 1,
 *     "./img/icon1.png": { // StyleObj
 *         imageUrl: "./img/icon1.png",
 *         imageAbsUrl: "./img/icon1.png", //相对于 workspace 的路径
 *         cssRules: []
 *     }
 * }
 */
function collectStyleRules(styleSheet, result, styleSheetUrl){

    if(!result){

        result = { // an StyleObjList
            length: 0
        }
    }

    if(!styleSheet.cssRules.length){
        return result;
    }

    var styleSheetDir = path.dirname(styleSheetUrl);

    // 遍历所有 css 规则收集进行图片合并的样式规则
    styleSheet.cssRules.forEach(function(rule){

        // typeof rule === 'CSSStyleRule'
        if(rule.href && rule.styleSheet){

            // @import 引入的样式表, 把 css 文件读取进来继续处理
            var fileName = rule.href;

            // 忽略掉链接到网络上的文件
            if(!fileName || constant.REGEXP_IGNORE_NETWORK.test(fileName)){
                return;
            }
            var match = fileName.match(constant.REGEXP_CSS);
            if(!match){

                return;
            }
            fileName = match[1];

            var cssAbsUri = path.join(styleSheetDir, fileName);
            var styleSheet = readStyleSheet(url);
            debug('read import style: ' + url + ' , has styleSheet == : ' + !!styleSheet);
            if(!styleSheet){
                return;
            }
            rule.styleSheet = styleSheet;
            
            debug('collect import style: ' + fileName);

            // 继续收集 import 的样式
            collectStyleRules(styleSheet, result, url);
            return;
        }

        if(rule.cssRules && rule.cssRules.length){
            if(rule instanceof CSSOM.CSSKeyframesRule){
                return; // FIXME 先跳过 keyframes 的属性
            }

            // 遇到有子样式的，比如 @media, 递归收集
            collectStyleRules(rule, result, styleSheetUrl);
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
             * 1. background-size 不能简写在 background 里面, 而拆分 background 之后再组装, 
             *    background 就变成在 background-size 后面了, 会导致 background-size 被 background 覆盖;
             * 2. 拥有 background-size 的背景图片一般都涉及到拉伸, 这类图片是不能合并的
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

        var imageUrl = getImageUrl(style, styleSheetDir), 
            imageAbsUrl,
            fileName;

        if(imageUrl){

            imageAbsUrl = path.join(styleSheetDir, imageUrl);
            fileName = path.join(spriteConfig.workspace, imageAbsUrl);
            
            if(!fs.existsSync(fileName)){

                // 如果这个图片是不存在的, 就直接返回了, 进行容错
                info('>>Skip: "' + fileName + '" is not exist');
                return;
            }

            // 把用了同一个文件的样式汇集在一起
            if(!result[imageUrl]){
                result[imageUrl] = { // an StyleObj
                    imageUrl: imageUrl,
                    imageAbsUrl: imageAbsUrl,
                    cssRules: []
                };
                result.length++;
            }
            result[imageUrl].cssRules.push(style);
        }
    });
    return result;
}



