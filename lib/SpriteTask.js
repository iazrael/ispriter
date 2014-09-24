var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    us = require('underscore'),
    EventEmitter = require('events').EventEmitter,

    Logger = require('./Logger'),
    zTool = require('./ztool'),
    constant = require('./constant'),

    CSSSheet = require('./css').CSSSheet,
    BgInterpreter = require('./css/BackgroundInterpreter');


function SpriteTask(env, cssUri) {

    EventEmitter.call(this);

    this.env = env; // ispriter 的环境相关信息, 也就是 iSpriter 的实例

    this.cssUri = cssUri;

    this.init();
}

util.inherits(SpriteTask, EventEmitter);


SpriteTask.prototype.init = function() {

    var context = this,
        config = this.env.config;

    this.cssSheet = CSSSheet.parse(config, this.cssUri);

    // TODO 这里要做的事情:
    // 1. 遍历所有 cssRules, 把里面的图片都解析出来
    // 2. 收集把需要进行合并的图片, 并读取图片 info, 同时 cache 住
    // 3. 收集不需要合并的图片, 用于合并之后统一输出

    // 为了性能, 几个步骤的事情都放到这里做
    filterCSSRules(this, function(result) {


        context.emit('inited');
    });

};

/**
 * 返回这个 task 是否是有效的, 既是否有精灵图需要合并, 如果没有这没必要进行后续的处理
 *
 * @return {Boolean}
 */
SpriteTask.prototype.isValid = function() {

    return this.cssSheet && !!this.cssSheet.cssRules.length;
};

SpriteTask.prototype.exec = function() {

    // TODO 未完成
    // 这里要做的事: 对小图片进行定位排列和输出, 输出合并后的 css 文件

    // 1. 合并 cssRules 和 cssSheet
    // 2. 定位和排列小图, 修改样式里的 background
    // 3. 输出合并的后的大图
    // 4. 输出修改后的样式表

};

/**
 * 规整背景样式
 * @param  {Config} config
 * @param  {CSSRule} cssRule
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
function normalizeCSSRule(config, cssRule) {

    var normalizer = {},
        value;

    // FIXME 这里可能会有顺序问题, 如
    // background: XXX; background-image: YYY
    // background-image 会被 background 覆盖掉

    // FIXME 这里默认了 width/height 的单位是 px
    if (value = cssRule['width']) {

        normalizer['width'] = parseFloat(value.value);
    }
    if (value = cssRule['height']) {
        normalizer['height'] = parseFloat(value.value);
    }
    if (value = cssRule['background-repeat']) {
        normalizer['background-repeat'] = value.value;
    }
    if (value = cssRule['background-size']) {
        value = value.value.trim().replace(/\s{2}/g, '').split(' ');

        if (!value[1]) {
            value[1] = value[0];
        }
        normalizer['background-size-x'] = value[0];
        normalizer['background-size-y'] = value[1];

    }
    if (value = cssRule['background-position']) {

        value = value.value.trim().replace(/\s{2}/g, '').split(' ');
        if (!value[1]) {
            value[1] = value[0];
        }
        normalizer['background-position-x'] = value[0];
        normalizer['background-position-y'] = value[1];
    }
    if (value = cssRule['background-image']) {
        var validBgImg, cssImg;

        // 这里的 value 是个数组, 没有任何处理的 CSS 样式,
        // 只提取最后一个有效的 background-image 来使用
        for (var a = value.length - 1; a >= 0; a--) {
            cssImg = value[a].value;
            var result = resolveBackgroundImage(config, cssImg);
            if (result && result.length === 2) {
                validBgImg = cssImg;
                break;
            }
        }
        if (validBgImg) {
            normalizer['background-image'] = validBgImg;
        }
    }

    if (value = cssRule['background']) {
        var validBg, item;

        // 这里的 value 是个数组, 没有任何处理的 CSS 样式,
        // 只提取最后一个 background 来使用
        for (var i = value.length - 1; i >= 0; i--) {

            var bg = BgInterpreter.analyse(value[i].value);

            if (bg.length !== 1) {

                // FIXME 暂时跳过一个 background 里面简写了多个背景的情况
                // 这种情况一般也比较少见, 如果遇到了, 就取最后一个有 background-image 而且可用的
                for (var j = bg.length - 1; j >= 0; j--) {
                    item = bg[j];
                    var result = resolveBackgroundImage(config, item['background-image']);
                    if (result && result.length === 2) {
                        validBg = item;
                        break;
                    }
                }
            } else {
                validBg = bg[0];
            }
        }
        if (validBg) {
            normalizer = us.extend({}, normalizer, validBg);

        }
    }
    return normalizer;

}

/**
 * 从 background-image 的值中提取图片的路径
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

    if (constant.REGEXP_IGNORE_IMAGE.test(uri)) { // 去掉不需要合并图片

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
/**
 * 过滤出需要合并图片的样式
 * @param  {SpriteTask}   task
 * @param  {Function} callback
 */
function filterCSSRules(task, callback) {

    var cssRules = task.cssSheet.cssRules;
    var config = task.env.config;

    var cssResult = [];

    cssRules.forEach(function(cssRule) {
        var normalizer;
        if (cssRule['background'] || cssRule['background-image']) {

            // 先规整一下属性, 把 background 拆分, 同时提取 background-position 和 background-image 等
            normalizer = normalizeCSSRule(config, cssRule);
            cssRule.__narmalizer = normalizer;
        }
        if (!normalizer || !normalizer['background-image']) {

            // 没有图片的, 滚粗
            return;
        }
        if (constant.REGEXP_IGNORE_POSSITION.test(normalizer['background-position-x']) ||
            constant.REGEXP_IGNORE_POSSITION.test(normalizer['background-position-y'])) {

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

        Logger.debug('[filterCSSRules]', normalizer);
        var match = resolveBackgroundImage(config, normalizer['background-image']);

        if (!match) {
            return;
        }
        if (match.length === 2) {
            // ok 的
            // TODO 下一步从这里开始


        } else if (match[2] === 'ext') {
            // 后缀不符合配置要求的, 只做文件拷贝
        }

    });
}

//TODO 不应该在SpriteTask类中 by bzai
SpriteTask.createTasks = function(env, callback) {

    var taskArr = [],
        config = env.config;

    zTool.forEach(config.input.cssSource, function(cssUri, index, next) { // onEach

        var task = new SpriteTask(env, cssUri);

        task.on('inited', function() {

            // 没有需要合并的图片的 task 就没必要放到 taskArr
            // if(task.isValid()){

            taskArr.push(task);
            // }
        })
            .on('inited', next);
    }, function() { //onDone

        callback && callback(taskArr);
    });
};

module.exports = SpriteTask;