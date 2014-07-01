
/**
 * 方便以后切换 CSS 解析器
 */

var fs = require('fs'),
    path = require('path'),

    CSSRule = require('./CSSRule').CSSRule,

    Logger = require('../Logger');


/*
    - CSSSheet {} css 文件信息汇总
        - filename css 文件名
        - filepath css 文件的绝对路径
        - cssRules [CSSRule] 该 css 文件的所有样式规则
        - imports [CSSSheet] @import 引入的所有样式文件
        - uri css 文件中 @import 的原始值
 */

function CSSSheet(config, uri){
    
    this.config = config;
    this.uri = uri;

    this.filename = path.basename(uri);
    this.filepath = path.resolve(path.join(config.workspace, uri));

    // TODO import 的 css 文件还没处理
    this.content = fs.readFileSync(this.filepath).toString();

    this.cssRules = [];

}

function pickupCSSRules(cssText){
    var pos = -1;
    var length = cssText.length;
    var cssRules = [];
    var index, start, end, cssStr, cssName;

    // 用于对文本进行操作
    var tmpText = cssText, tmpText2;

    while(pos++ < length){

        // 把已经处理过的文本切出来
        tmpText = cssText.substring(pos);

        // 把 background 找出来
        index = tmpText.indexOf('background');
        if(index === -1){
            break;
        }

        // 向前 / 向后找到样式闭合点和样式名字
        // 向前找 {
        tmpText2 = tmpText.substring(0, index);
        start = tmpText2.lastIndexOf('{');
        cssStr = tmpText2.substring(start);

        // 继续向前找样式名字
        tmpText2 = tmpText2.substring(0, start);
        start = tmpText2.lastIndexOf('}'); // 找到前一个样式的结束符, 中间的就是名字

        cssName = tmpText2.substring(start + 1); // +1 是为了跳过 }

        // 向后找 }
        tmpText2 = tmpText.substring(index);
        end = tmpText2.indexOf('}');
        cssStr += tmpText2.substring(0, end + 1); // +1 是为了包括 }

        // pos 是指在完整 cssText 中的位置
        cssRules.push(new CSSRule(cssName, cssStr, pos + start + 1, pos + end + 1));

        pos += index + end;

    }

    return cssRules;
}

function filterCSSRules (cssRules, config, onEach, onDone) {

    // body...
}


CSSSheet.prototype.pickup = function(callback){

    var context = this;

    // 先初步收集所有用 background 的样式
    this.cssRules = pickupCSSRules(this.content);

    // 再进行筛选, 去掉没有用到图片的, 图片格式不对的, 以及图片内容不正确的
    filterCSSRules(this.cssRules, this.config, function(){ // onEach

        callback(context);
    }, function(){ // onDone

    });

};

CSSSheet.prototype.toString = function() {
    

};



CSSSheet.parse = function(config, uri, callback){

    var sheet = new CSSSheet(config, uri);

    sheet.pickup(callback);
};


exports.CSSSheet = CSSSheet;