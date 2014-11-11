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
    'background-position',
    'background-repeat',
    'background-size'
];

/**
 *
 * @param name  classname
 * @param text  cssText 例如：{width:33px background:url(...); ...}
 * @param start 从classname开始，在整个css文本中的位置
 * @param end   在这个class结束，在整个css文件中的位置
 * @example
 * 
 * { 
 * cssName: 'div:nth-of-type(4)',
  cssText: '{\n    width: 15px;\n    height: 18px;\n    background: url(../images/bright-star.png);\n    background: -moz-linear-gradient(top, red, rgba(0, 0, 255, 0.5));  \n    background: -webkit-gradient(linear, 0 0, 0 bottom, from(#ff0000), to(rgba(0, 0, 255, 0.5)));  \n    background: -o-linear-gradient(top, red, rgba(0, 0, 255, 0.5)); \n\n}',
  start: 464,
  end: 751,
  width: { value: '15px', start: 6, end: 17 },
  height: { value: '18px', start: 23, end: 35 },
  background: 
   [ { 
        value: 'url(../images/bright-star.png)', 
        start: 58, 
        end: 100 
    },
     { value: '-moz-linear-gradient(top, red, rgba(0, 0, 255, 0.5))',
       start: 106,
       end: 170 },
     { value: '-webkit-gradient(linear, 0 0, 0 bottom, from(#ff0000), to(rgba(0, 0, 255, 0.5)))',
       start: 178,
       end: 270 },
     { value: '-o-linear-gradient(top, red, rgba(0, 0, 255, 0.5))',
       start: 278,
       end: 340 } ] }
 */

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

    // Interpreter 是个根据指定的 tokens 进行文本解析的引擎, 可以解析 XML,json和CSS等
    var preter = new Interpreter(TOKENS.concat(PROP_TOKENS));

    preter.prepare(cssText);

    var str, value, start, end, item;
    while (str = preter.eat()) {

        if (PROP_TOKENS.indexOf(str) === -1) {
            continue;
        }

        start = preter.pos - str.length;
        preter.eatUntil(':'); // 吃字符一直到遇到 ":" , 但是不包括 ":"
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
        if (str === 'background' || str === 'background-image') {

            if (this[str] && this[str].push) {
                this[str].push(item);

            } else {
                this[str] = [item];
            }
        } else {
            this[str] = item;
        }

    }

    // Logger.debug(this);

};

/**
 * 把 style 里面的 background 属性转换成简写形式, 用于减少代码
 */
CSSRule.prototype.mergeBackgound = function(){
    var background = '';

    var positionText = this['background-position-x'] + ' ' +
                       this['background-position-y'];
    delete this['background-position-x'];
    delete this['background-position-y'];

    this['background-position'] = positionText.trim();

    var toMergeAttrs = [
           'background-color', 'background-image', 'background-position', 
           'background-repeat','background-attachment', 
           'background-origin', 'background-clip'
    ];
    for(var i = 0, item; item = toMergeAttrs[i]; i++) {
        if(this.hasOwnProperty(item)){
            background += this[item] + ' ';
            delete this[item]
        }
    }
    this['background'] =  background.trim();
};


CSSRule.prototype.toString = function() {

    // TODO
};

exports.CSSRule = CSSRule;