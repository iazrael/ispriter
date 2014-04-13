var fs = require('fs'),
    path = require('path'),

    us = require('underscore'),
    CSSOM = require('cssom'),

    constant = require('./constant');

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
exports.readStyle = function(cssUri, env){
    var config = env.config;
    var cssAbsUri = path.join(config.workspace, cssUri);
    if(!fs.existsSync(cssAbsUri)){

        return null;
    }
    var content = fs.readFileSync(cssAbsUri);
    var styleSheet = CSSOM.parse(content.toString());
    // styleSheet.config = config;
    // styleSheet.cssUri = cssUri;
    // styleSheet.cssAbsUri = cssAbsUri;
    // return us.extend(styleSheet, this);
}

exports.applyStyle = function(){
    
}