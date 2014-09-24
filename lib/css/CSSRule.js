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

/**
* @param name  classname
* @param text  cssText 例如：{width:33px background:url(...); ...}
* @param start 从classname开始，在整个css文本中的位置
* @param end   在这个class结束，在整个css文件中的位置
**/
function CSSRule(name, text, start, end) {

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

    var cssText = this.cssText;

    var preter = new Interpreter(TOKENS.concat(PROP_TOKENS));

    preter.prepare(cssText);

    var str, value, start, end, item;
    while (str = preter.eat()) {

        if (PROP_TOKENS.indexOf(str) === -1) {
            continue;
        }

        start = preter.pos - str.length;
        preter.eatUntil(':'); // 吃字符一直到遇到 : (但是不包括 :)
        preter.eat(); // 吃掉这个 token (:)
        value = preter.eatUntil([';', '}']); // : 后面的到结束都认为是 css 属性
        if (!value || !(value = value.trim())) {
            continue;
        }

        end = preter.pos;

        item = {
            value: value,
            start: start,
            end: end
        };

        // 如果有多个 background 属性都有图片, 这里还是会有前面的 background 值被后面的值覆盖的问题
        // 这里把有多个背景的情况变成数组, 其他属性如 width/height 只用最后一个值就行了
        if (this[str] && (str === 'background' || str === 'background-image')) {

            if (this[str].push) {
                this[str].push(item);

            } else {
                this[str] = [this[str], item];
            }
        } else {
            this[str] = item;
        }

    }

    Logger.debug(this);

};


CSSRule.prototype.toString = function() {

    // TODO
};

exports.CSSRule = CSSRule;