var _ = require('underscore'),

    Interpreter = require('./Interpreter'),

    Logger = require('../Logger'),

    BgInterpreter = require('./BackgroundInterpreter'),

    constant = require('../constant');

    

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
    'background-position-x',  
    'background-position-y',  
    'background-repeat',
    'background-size'
];

var REPLAEC_TOKENS =  [
    'background',
    'background-image',
    'background-position',
    'background-position-x',
    'background-position-y',
    'background-repeat',
    'background-size'
];

/**
 *
 * @param name  classname
 * @param text  cssText 例如：{width:33px background:url(...); ...}
 * @param start 从class 的 ’{‘ 开始，在整个css文本中的位置
 * @param end   在这个class结束，在整个css文件中的位置
 *
 * 而valueObj里面的start,end都是从属性key开始，并且是相对于浮层的start,end。
 * @example
 * 
 * { 
 * cssName: '.game-icon',
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

    //赋值 属性obj属性
    this.analyse();
    //赋值 __normalizeCSSRule
    this.normalizeCSSRule();
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
        preter.eatUntil(':');   // 吃字符一直到遇到 ":" , 但是不包括 ":"
        preter.eat();           // 吃掉这个 token (:)
        value = preter.eatUntil([';', '}']); // : 后面的到结束都认为是 css 属性
        if (!value || !(value = value.trim())) {
            continue;
        }

        end = preter.pos+1;  // +1 by bizai

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

};

/**
 * 把 style 里面的 background 属性转换成简写形式, 用于减少代码
 * TODO 留着看什么时候用
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


CSSRule.prototype.toString = function(){
    var cssText = this.cssText,
        outSpriteAttr = this.__outSpriteAttr,
        cssTextArray = [],
        attrArray = [],
        cursor = 0;

    //把需要更新的关键属性筛选,排序
    for(var i in REPLAEC_TOKENS){
        var key = REPLAEC_TOKENS[i];
        if( this.hasOwnProperty(key) ){
            var attrObj = _.isArray(this[key]) ? this[key][0] : this[key];
            attrObj['key'] = key;
            attrArray.push(attrObj);
        }
    }
    //start 位置排序
    attrArray.sort(function(a,b){
        return a.start - b.start;
    });

    //删除cssText中跟合图有管理的属性
    for(var j in attrArray){
        var attr = attrArray[j];
        cssTextArray.push(cssText.slice(cursor,attr.start));
        cursor = attr.end;         
    }
    //增加合图后的css属性
    for(var k in outSpriteAttr){
        cssTextArray.push( k + ': ' + outSpriteAttr[k] + ';\n    ');
    }
    //闭合这段cssText
    cssTextArray.push(cssText.slice(cursor)); //末尾最后一段str

    return cssTextArray.join('');
};


/**
 * 规整背景样式，同时过滤掉合图不需要的属性
 * @return {Object} 合图需要的关键背景样式
 *
 * {
 *         width:
 *         height:
 *         background-repeat:
 *         background-image:
 *         background-size:
 *         background-position
 * }
 */

CSSRule.prototype.normalizeCSSRule = function() {

    var normalizer = {},
        value;

    // FIXME 这里可能会有顺序问题, 如
    // background: XXX; background-image: YYY
    // background-image 会被 background 覆盖掉

    if (!this['background'] && !this['background-image']) {
        return;
    }

    if (value = this['width']) {
        normalizer['width'] = parseFloat(value.value);
    }
    if (value = this['height']) {
        normalizer['height'] = parseFloat(value.value);
    }
    if (value = this['background-repeat']) {
        normalizer['background-repeat'] = value.value;
    }
    if (value = this['background-size']) {
        value = value.value.trim().replace(/\s{2}/g, '').split(' ');

        if (!value[1]) {
            value[1] = value[0];
        }
        normalizer['background-size-x'] = parseFloat(value[0]);
        normalizer['background-size-y'] = parseFloat(value[1]);

    }
    if (value = this['background-position']) {

        value = value.value.trim().replace(/\s{2}/g, '').split(' ');
        if (!value[1]) {
            value[1] = value[0];
        }
        normalizer['background-position-x'] = parseFloat(value[0]);
        normalizer['background-position-y'] = parseFloat(value[1]);
    }
    if (value = this['background-position-x']){
        normalizer['background-position-x'] = parseFloat(value.value);
    }
    if (value = this['background-position-y']){
        normalizer['background-position-y'] = parseFloat(value.value);
    }
    if (value = this['background-image']) {
        var validBgImg, cssImg;

        // 这里的 value 是个数组, 没有任何处理的 CSS 样式,
        // 只提取最后一个有效的 background-image 来使用
        for (var a = value.length - 1; a >= 0; a--) {
            validBgImg = value[a].value;
        }
        if (validBgImg) {
            normalizer['background-image'] = validBgImg;
        }
    }

    if (value = this['background']) {
        var validBg, item;

        // 这里的 value 是个数组, 没有任何处理的 CSS 样式,
        // 只提取最后一个 background 来使用
        for (var i = value.length - 1; i >= 0; i--) {
            var bg = BgInterpreter.analyse(value[i].value);
            if (bg.length !== 1) {
                //多个background会自动获取最后一个作为可用值
                for (var j = bg.length - 1; j >= 0; j--) {
                    validBg = bg[j];
                }
            } else {
                validBg = bg[0];
            }
        }
        if (validBg) {
            normalizer = _.extend({}, normalizer, validBg);
        }
    }
    this.__normalizer = normalizer;
}

exports.CSSRule = CSSRule;


