
var Interpreter = require('./Interpreter');
var Logger = require('../Logger');

var constant = require('../constant');

var TOKENS = [
    '{', '}',
    // '/*', '*/', '//', '\n', 先不支持注释
    ':',
    ';'
];

var PROP_TOKENS = [
    'width', 'height',
    'background',
    'background-image',
    // 'background-position',
    // 'background-repeat',
    'background-size'
];

function CSSRule(name, text, start, end){
    
    this.cssName = name.trim();
    this.cssText = text;

    this.start = start;
    this.end = end;

    this.analyse();
}

/**
 * 对 cssText 进行解析, 提取 width / height / image-url 等内容
 * 
 */
CSSRule.prototype.analyse = function() {
    
    var context = this;
    var cssText = this.cssText;

    var preter = new Interpreter(TOKENS.concat(PROP_TOKENS));

    preter.prepare(cssText);

    var str, value, start, end, match, uri, ext;
    while(str = preter.eat()){

        if(PROP_TOKENS.indexOf(str) === -1){
            continue;
        }

        start = preter.pos - str.length;
        preter.eatUntil(':'); // 吃字符一直到遇到 : (但是不包括 :)
        preter.eat(); // 吃掉这个 token (:)
        value = preter.eatUntil([';', '}']); // : 后面的到结束都认为是 css 属性
        if(!value || !(value = value.trim())){
            continue;
        }

        if(str === 'background' || str === 'background-image'){
            match = value.match(constant.REGEXP_IMAGE);

            if(!match){
                continue; //这个 background 是没有图片的, 或者图片格式不对
            }

            uri = match[1];
            ext = match[2];
            Logger.debug(uri, ext);

            

        }

        end = preter.pos;

        // FIXME 如果有多个 background 属性都有图片, 这里还是会有前面的 background 值被后面的值覆盖的问题
        this[str] = {
            value: value,
            start: start,
            end: end
        };
            
    }
    
    // Logger.debug(this);
    
};


exports.CSSRule = CSSRule;