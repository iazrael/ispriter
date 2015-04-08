var fs = require('fs'),
    path = require('path'),
    EventProxy = require('eventproxy'),

    us = require('underscore'),
    CSSOM = require('cssom'),
    PNG = require('pngjs').PNG,
    CleanCSS = require('clean-css'),
    GrowingPacker = require('./GrowingPacker'),
    BI = require('./BackgroundInterpreter'),
    nf = require('./node-file'),
    zTool = require('./ztool');

//****************************************************************
// 0. 声明和配置一些常量
//****************************************************************

//默认情况下的图片版本号
var DEFAULT_VERSION = Date.now();

var CURRENT_DIR = path.resolve('./');

/** 
 * 默认配置
 * 注意: 所有配置中, 跟路径有关的都必须使用 linux 的目录分隔符 "/", 不能使用 windows 的 "\".
 */
var DEFAULT_CONFIG = {

    /**
     * 调试时使用, 输出调试日志
     */
    "debug": false,

    /**
     * 精灵图合并算法, 目前只有 growingpacker
     *
     * @optional
     * @default "growingpacker"
     */
    "algorithm": "growingpacker",

    /**
     * 工作目录, 可以是相对路径或者绝对路径
     *
     * @optional
     * @default 运行 ispriter 命令时所在的目录
     * @example
     * "./": 当前运行目录, 默认值
     * "../": 当前目录的上一级
     * "/data": 根目录下的 data 目录
     * "D:\\sprite": D 盘下的 sprite 目录
     */
    "workspace": CURRENT_DIR,

    "input": {

        /**
         * 原 cssRoot
         * 需要进行精灵图合并的 css 文件路径或文件列表, 单个时使用字符串, 多个时使用数组.
         * 路径可使用 ant 风格的路径写法
         *
         * @required
         * @example
         * "cssSource": "../css/";
         * "cssSource": ["../css/style.css", "../css2/*.css"]
         */
        "cssSource": null,

        /**
         * 排除不想合并的图片, 可使用通配符
         * 也可以直接在 css 文件中, 在不想合并的图片 url 后面添加 #unsprite, iSpriter 会排除该图片, 并把 #unsprite 删除
         *
         * @optional
         * @example
         * "ignoreImages": "icons/*"
         * "ignoreImages": ["icons/*", "loading.png"]
         */
        "ignoreImages": null,

        /**
         * 输出的精灵图的格式, 目前只支持输出 png 格式,
         * 如果是其他格式, 也是以PNG格式输出, 仅仅把后缀改为所指定后缀
         *
         * @optional
         * @default "png"
         */
        "format": "png"
    },
    "output": {

        /**
         * 原 cssRoot
         * 精灵图合并之后, css 文件的输出目录
         *
         * @optional
         * @default "./sprite/css/"
         */
        "cssDist": "./sprite/css/",

        /**
         * 原 imageRoot
         * 生成的精灵图相对于 cssDist 的路径, 最终会变成合并后的的图片路径写在 css 文件中
         *
         * @optional
         * @default "./img/"
         * @example
         * 如果指定 imageDist 为 "./images/sprite/", 则在输出的 css 中会显示为
         * background: url("./images/sprite/sprite_1.png");
         *
         */
        "imageDist": "./img/",

        /**
         * 原 maxSize
         * 单个精灵图的最大大小, 单位 KB,
         * 如果合并之后图片的大小超过 maxSingleSize, 则会对图片进行拆分
         *
         * @optional
         * @default 0
         * @example
         * 如指定 "maxSingleSize": 60, 而生成的精灵图(sprite_all.png)的容量为 80KB,
         * 则会把精灵图拆分为 sprite_0.png 和 sprite_1.png 两张
         *
         */
        "maxSingleSize": 0,

        /**
         * 合成之后, 图片间的空隙, 单位 px
         *
         * @optional
         * @default 0
         */
        "margin": 0,

        /**
         * 配置生成的精灵图的前缀
         *
         * @optional
         * @default "sprite_"
         */
        "prefix": "sprite_",

        /**
         * 精灵图的输出格式
         *
         * @optional
         * @default "png"
         */
        "format": "png",

        /**
         * 配置是否要将所有精灵图合并成为一张, 当有很多 css 文件输入的时候可以使用.
         * 为 true 时将所有图片合并为一张, 同时所有 css 文件合并为一个文件.
         * 注意: 此时 maxSingleSize 仍然生效, 超过限制时也会进行图片拆分
         *
         * @optional
         * @default false
         */
        "combine": false,

        /**
         * 配置是否把合并了图片的样式整合成一条规则, 统一设置 background-image, 例如:
         * .cls1, .cls2{
         *     background-image: url(xxx);
         * }
         *
         * @optional
         * @default true
         */
        "combineCSSRule": true,

        /**
         * 配置是否压缩 css 文件, 将使用 clean-css 进行压缩, 其值如下:
         * false: 不进行压缩;
         * true: 用 clean-css 的默认配置进行压缩;
         * Object{"keepBreaks": true, ... }: 用指定的配置进行压缩.
         *
         * @optional
         * @default false
         */
        "compress": false,

        /**
         * 配置是否把没有合并的图片进行拷贝, 默认是不不会进行拷贝的
         *
         * @optional
         * @default false
         */
        "copyUnspriteImage": false
    }
};

var DEFAULT_COMBINE_CSS_NAME = 'all.css';

function debug(msg) {
    if (spriteConfig.debug) {
        console.log('>>>', +new Date, msg, '\n<<<===================');
    }
}

function info(msg) {
    console.info.apply(console, arguments);
}

//****************************************************************
// 1. 读取配置
// 把传入的配置(最简配置或者完整配置等)进行适配和整理
//****************************************************************

/**
 * 读取配置, 支持config 为配置文件名或者为配置对象
 *
 * @param  {Object|String} config 配置文件或者配置对象
 * @return {Config}        读取并解析完成的配置对象
 */
function readConfig(config) {
    if (us.isString(config)) {
        if (!fs.existsSync(config)) {
            throw 'place give in a sprite config or config file!';
        }
        var content = fs.readFileSync(config).toString();
        config = zTool.jsonParse(content);
    } else if (us.isArray(config)) {
        config = {
            input: config
        };
    }
    config = config || {};

    // 适配最简配置
    if (us.isString(config.input) || us.isArray(config.input)) {
        config.input = {
            cssSource: config.input
        };
    }
    if (!config.output) {
        config.output = {};
    } else if (us.isString(config.output)) {
        config.output = {
            cssDist: config.output
        }
    }

    // 对旧的配置项进行兼容
    config = adjustOldProperty(config);

    // 
    config = zTool.merge({}, DEFAULT_CONFIG, config);

    var cssSource = config.input.cssSource;
    if (!cssSource) {
        throw 'there is no cssSource specific!';
    } else if (us.isString(cssSource)) {
        cssSource = [cssSource];
    }

    // 读取所有指定的 css 文件
    var cssFiles = [],
        cssPattern, queryResult;
    for (var i = 0; i < cssSource.length; i++) {

        cssPattern = path.normalize(cssSource[i]).replace(/\\/g, '\\\\');

        if (zTool.endsWith(cssPattern, path.sep)) {
            cssPattern += '*.css';
        } else if (!zTool.endsWith(cssPattern, '.css')) {
            cssPattern += '/*.css';
        }

        queryResult = nf.query(config.workspace, cssPattern);
        cssFiles = cssFiles.concat(queryResult);
    }
    if (!cssFiles.length) {
        throw 'there is no any css file contain!';
    }

    // 去重
    cssFiles = us.unique(cssFiles);

    config.input.cssSource = cssFiles;

    // 解析要排除的图片规则
    var ignoreImages = config.input.ignoreImages;
    if (ignoreImages) {
        if (!us.isArray(ignoreImages)) {
            ignoreImages = [ignoreImages];
        }
        ignoreImages.forEach(function(pattern, i) {
            ignoreImages[i] = zTool.wildcardToPattern(pattern);
        });
    }

    // 确保输出路径是个目录
    if (!zTool.endsWith(config.output.cssDist, '/')) {
        config.output.cssDist += '/';
    }
    config.output.cssDist = path.normalize(config.output.cssDist);

    if (!zTool.endsWith(config.output.imageDist, '/')) {
        config.output.imageDist += '/';
    }

    // KB 换算成 B
    config.output.maxSingleSize *= 1024;

    // 确保 margin 是整数
    config.output.margin = parseInt(config.output.margin);

    // debug(config);
    return config;
}

/**
 * 对旧的配置项做兼容
 * @param  {Config} config
 * @return {Config}
 */
function adjustOldProperty(config) {
    if (!config.input.cssSource && 'cssRoot' in config.input) {
        config.input.cssSource = config.input.cssRoot;
        delete config.input.cssRoot;
    }
    if (!config.output.cssDist && 'cssRoot' in config.output) {
        config.output.cssDist = config.output.cssRoot;
        delete config.output.cssRoot;
    }
    if (!config.output.imageDist && 'imageRoot' in config.output) {
        config.output.imageDist = config.output.imageRoot;
        delete config.output.imageRoot;
    }
    if (!config.output.maxSingleSize && 'maxSize' in config.output) {
        config.output.maxSingleSize = config.output.maxSize;
        delete config.output.maxSize;
    }
    return config;
}

//****************************************************************
// 2. CSS 样式处理
//****************************************************************

/**
 * 读取并解析样式表文件
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
function readStyleSheet(fileName) {

    fileName = path.join(spriteConfig.workspace, fileName);
    if (!fs.existsSync(fileName)) {
        return null;
    }
    var content = fs.readFileSync(fileName);
    var styleSheet = CSSOM.parse(content.toString());
    return styleSheet;
};

/**
 * CSS Style Declaration 的通用方法定义
 * @type {Object}
 * @example
 * CSSStyleDeclaration: {
 *     0: "border",
 *     1: "color",
 *     length: 2,
 *     border: "none",
 *     color: "#333"
 * }
 */
var BaseCSSStyleDeclaration = {

    /**
     * 把background 属性拆分
     * e.g. background: #fff url('...') repeat-x 0px top;
     */
    splitBackground: function() {
        var background,
            value;

        if (!this['background']) {

            // 有 background 属性的 style 才能拆分 background 
            return;
        }

        // 撕裂 background-position
        if (value = this['background-position']) {
            value = value.trim().replace(/\s{2}/g, '').split(' ');
            if (!value[1]) {
                value[1] = value[0];
            }
            this['background-position-x'] = value[0];
            this['background-position-y'] = value[1];
        }
        background = BI.analyse(this['background']);
        if (background.length != 1) {

            // FIXME 暂时跳过多背景的属性
            return;
        }
        background = background[0];
        if (background['background-image']) {

            // 把原来缩写的 background 属性删掉
            this.removeProperty('background');

            this.extend(background);
        }
    },

    /**
     * 把 style 里面的 background 属性转换成简写形式, 用于减少代码
     */
    mergeBackgound: function() {
        var background = '',
            style = this;
        if(style.getPropertyValue('background')) {
			return;
		}
        var positionText = this.removeProperty('background-position-x') + ' ' +
            this.removeProperty('background-position-y');

        style.setProperty('background-position', positionText.trim(), null);

        var toMergeAttrs = [
            'background-color', 'background-image', 'background-position',
            'background-repeat', 'background-attachment',
            'background-origin', 'background-clip'
        ];
        for (var i = 0, item; item = toMergeAttrs[i]; i++) {
            if (style.hasOwnProperty(item)) {
                background += this.removeProperty(item) + ' ';
            }
        }
        if(background.trim()) {
            style.setProperty('background', background.trim(), null);
        }
    },

    /**
     * 把 obj 的属性和属性值扩展合并过来, 并调整下标, 方法将被忽略
     * @param  {Object} obj
     * @param  {Boolean} override 是否覆盖已有属性
     */
    extend: function(obj, override) {
        for (var i in obj) {
            if (us.isFunction(obj[i])) {
                continue;
            } else if (this[i] && !override) {
                continue;
            }
            this.setProperty(i, obj[i], null);
        }

    }

}

/**
 * 所用到的一些正则
 */
var regexp = {
    ignoreNetwork: /^(https?|ftp):\/\//i,
    ignorePosition: /right|center|bottom/i,
    ignoreRepeat: /^(repeat-x|repeat-y|repeat)$/i,
    image: /\(['"]?(.+\.(png|jpg|jpeg|gif|bmp))((\?|#).*?)?['"]?\)/i,
    css: /(.+\.css).*/i,
    ignoreImage: /#unsprite\b/i

}

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
function collectStyleRules(styleSheet, result, styleSheetUrl) {
    if (!result) {
        result = { // an StyleObjList
            length: 0
        }
    }

    if (!styleSheet.cssRules.length) {
        return result;
    }

    var styleSheetDir = path.dirname(styleSheetUrl);

    // 遍历所有 css 规则收集进行图片合并的样式规则
    styleSheet.cssRules.forEach(function(rule, i) {

        // typeof rule === 'CSSStyleRule'
        if (rule.href && rule.styleSheet) {

            // @import 引入的样式表, 把 css 文件读取进来继续处理
            var fileName = rule.href;

            // 忽略掉链接到网络上的文件
            if (!fileName || regexp.ignoreNetwork.test(fileName)) {
                return;
            }
            var match = fileName.match(regexp.css);
            if (!match) {
                return;
            }
            fileName = match[1];

            var url = path.join(styleSheetDir, fileName);
            var styleSheet = readStyleSheet(url);
            debug('read import style: ' + url + ' , has styleSheet == : ' + !!styleSheet);
            if (!styleSheet) {
                return;
            }
            rule.styleSheet = styleSheet;

            debug('collect import style: ' + fileName);

            // 继续收集 import 的样式
            collectStyleRules(styleSheet, result, url);
            return;
        }

        if (rule.cssRules && rule.cssRules.length) {
            if (rule instanceof CSSOM.CSSKeyframesRule) {
                return; // FIXME 先跳过 keyframes 的属性
            }

            // 遇到有子样式的，比如 @media, 递归收集
            collectStyleRules(rule, result, styleSheetUrl);
            return;
        }

        if (!rule.style) {

            // 有可能 @media 等中没有任何样式, 如: @media xxx {}
            return;
        }

        /* 
         * typeof style === 'CSSStyleDeclaration'
         * 给 style 对象扩展基本的方法
         */
        var style = us.extend(rule.style, BaseCSSStyleDeclaration);

        if (style['background-size']) {

            /* 
             * 跳过有 background-size 的样式, 因为:
             * 1. background-size 不能简写在 background 里面, 而拆分 background 之后再组装,
             *    background 就变成在 background-size 后面了, 会导致 background-size 被 background 覆盖;
             * 2. 拥有 background-size 的背景图片一般都涉及到拉伸, 这类图片是不能合并的
             */
            return;
        }
        if (style['background']) {

            // 有 background 属性的 style 就先把 background 简写拆分出来
            style.splitBackground();
        } else if (style['background-position']) {
            var value = style['background-position'];
            value = value.trim().replace(/\s{2}/g, '').split(' ');
            if (!value[1]) {
                value[1] = value[0];
            }
            style.setProperty('background-position-x', value[0]);
            style.setProperty('background-position-y', value[1]);
        }

        if (regexp.ignorePosition.test(style['background-position-x']) ||
            regexp.ignorePosition.test(style['background-position-y'])) {

            /*
             * background 定位是 right center bottom 的图片不合并
             * 因为这三个的定位方式比较特殊, 浏览器有个自动适应的特性
             * 把刚刚拆分的 background 属性合并并返回
             */
            style.mergeBackgound();
            return;
        }

        if (regexp.ignoreRepeat.test(style['background-repeat']) ||
            regexp.ignoreRepeat.test(style['background-repeat-x']) ||
            regexp.ignoreRepeat.test(style['background-repeat-y'])) {

            // 显式的使用了平铺的图片, 也不进行合并
            style.mergeBackgound();
            return;
        }

        var imageUrl = getImageUrl(style, styleSheetDir),
            imageAbsUrl,
            fileName;

        if (imageUrl) {

            imageAbsUrl = path.join(styleSheetDir, imageUrl);
            fileName = path.join(spriteConfig.workspace, imageAbsUrl);

            if (!fs.existsSync(fileName)) {

                // 如果这个图片是不存在的, 就直接返回了, 进行容错
                info('>>Skip: "' + fileName + '" is not exist');
                return;
            }

            // 把用了同一个文件的样式汇集在一起
            if (!result[imageUrl]) {
                result[imageUrl] = { // an StyleObj
                    imageUrl: imageUrl,
                    imageAbsUrl: imageAbsUrl,
                    cssRules: []
                };
                result.length++;
            }
            result[imageUrl].cssRules.push(style);
        }
        else{
           //图片找不到css_backgound合并还原  20150405
           style.mergeBackgound();
        }
    });
    return result;
}

/**
 * 从background-image 的值中提取图片的路径
 * @return {String}       url
 */
function getImageUrl(style, dir) {
    var format = spriteConfig.input.format,
        ignoreImages = spriteConfig.input.ignoreImages,
        backgroundImage = style['background-image'],
        url = null,
        ext,
        match;

    if (!backgroundImage) {
        return null;
    }

    if (backgroundImage.indexOf(',') > -1) {

        // FIXME 暂时忽略掉多背景的属性
        // FIXME 提取 url 进行拷贝
        return null;
    }

    match = backgroundImage.match(regexp.image);

    if (match) {
        url = match[1];
        ext = match[2];

        if (format.indexOf(ext) == -1) { // 去掉非指定后缀的图片

            unspriteImageArray.push(path.join(dir, url));
            return null;
        }
        if (regexp.ignoreImage.test(backgroundImage)) { // 去掉不需要合并图片

            unspriteImageArray.push(path.join(dir, url));
            info('>>Skip: Unsprite image "' + url + '"');
            url = backgroundImage.replace(regexp.ignoreImage, '');
            style.setProperty('background-image', url, null);
            return null;
        }

    } else {
        debug('not match image bg: ' + backgroundImage);
        return null;
    }

    // 遇到网络图片就跳过
    if (regexp.ignoreNetwork.test(url)) {

        // 这里直接返回了, 因为一个style里面是不会同时存在两个 background-image 的
        info('>>Skip: Network image "' + url + '"');
        return null;
    }

    if (ignoreImages) {
        for (var i = 0; i < ignoreImages.length; i++) {

            if (ignoreImages[i].test(url)) {
                info('>>Skip: Unsprite image "' + url + '"');
                return null;
            }
        }
    }

    return url;
}
//****************************************************************
// 3. 收集图片相关信息
//****************************************************************

/**
 * 读取图片的内容和大小
 * @param  {StyleObjList}   styleObjList
 * @param  {Function} onDone
 */
function readImagesInfo(styleObjList, onDone) {

    // pngjs 没有提供同步 api, 所以只能用异步的方式读取图片信息
    zTool.forEach(styleObjList, function(styleObj, url, next) {

        if (url === 'length') {
            return next(); // 跳过 styleObjList 的 length 字段
        }
        var imageInfo = imageInfoCache[url];

        var onGetImageInfo = function(imageInfo) {
            if (imageInfo) {
                imageInfoCache[url] = imageInfo;

                // 从所有style里面，选取图片宽高最大的作为图片宽高
                setImageWidthHeight(styleObj, imageInfo);

                styleObj.imageInfo = imageInfo;

            } else { // 没有读取到图片信息, 可能是图片签名或格式不对, 读取出错了
                delete imageInfoCache[url];
                delete styleObjList[url];
                styleObj.cssRules.forEach(function(style) {
                    style.mergeBackgound();
                });
            }
            next();
        }

        if (imageInfo) {
            onGetImageInfo(imageInfo);
        } else {
            readImageInfo(styleObj.imageAbsUrl, onGetImageInfo);
        }
    }, onDone);
}


/**
 * 读取单个图片的内容和信息
 * @param {String} fileName
 * @param {Function} callback callback(ImageInfo)
 * { // ImageInfo
 *     image: null, // 图片数据
 *     width: 0,
 *     height: 0,
 *     size: 0 // 图片数据的大小
 * }
 */
function readImageInfo(fileName, callback) {
    fileName = path.join(spriteConfig.workspace, fileName);
    fs.createReadStream(fileName).pipe(new PNG())
        .on('parsed', function() {

            var imageInfo = {
                image: this,
                width: this.width,
                height: this.height
            };

            getImageSize(this, function(size) {

                imageInfo.size = size;
                callback(imageInfo);
            });
        })
        .on('error', function(e) {
            info('>>Skip: ' + e.message + ' of "' + fileName + '"');
            callback(null);
        });
}

/**
 * 读取图片内容所占硬盘空间的大小
 * @param  {PNG}   image
 * @param  {Function} callback callback(Number)
 */
function getImageSize(image, callback) {
    var size = 0;

    /*
     * 这里读取图片大小的范式比较折腾, pngjs 没有提供直接获取 size 的通用方法,
     * 同时它只提供了文件流的方式读取, 所以只能一段一段的读取数据时把长度相加
     */
    image.pack().on('data', function(chunk) {

        size += chunk.length;
    }).on('end', function() {

        callback(size);
    });
}

/**
 * 把用了同一个图片的样式里写的大小 (with, height) 跟图片的大小相比较, 取最大值,
 * 防止有些样式写的宽高比较大, 导致合并后显示到了周边的图片内容
 * @param {StyleObj} styleObj
 * @param {ImageInfo} imageInfo
 */
function setImageWidthHeight(styleObj, imageInfo) {
    var w = 0,
        h = 0,
        mw = imageInfo.width,
        mh = imageInfo.height;

    // 遍历所有规则, 取最大值
    styleObj.cssRules.forEach(function(style) {
        w = getPxValue(style.width),
        h = getPxValue(style.height);

        // TODO 这一步有必要么? // 没有设置宽高的样式, 用图片的大小来设置
        // if(!style.hasOwnProperty('width')){
        //     style.setProperty('width', imageInfo.width + 'px', null);
        // }
        // if(!style.hasOwnProperty('height')){
        //     style.setProperty('height', imageInfo.height + 'px', null);
        // }
        if (w > mw) {
            mw = w;
        }
        if (h > mh) {
            mh = h;
        }
    });

    /*
     * 最后的大小还要加上 config 中配置的 margin 值
     * 这里之所以用 w / h 来表示宽高, 而不是用 with / height
     * 是因为 packer 算法限定死了, 值读取传入元素的 w / h 值
     */
    styleObj.w = mw + spriteConfig.output.margin;
    styleObj.h = mh + spriteConfig.output.margin;
}

/**
 * 把像素值转换成数字, 如果没有该值则设置为 0,
 * 非 px 的值会忽略, 当成 0 来处理
 * @param  {String} cssValue
 */
function getPxValue(cssValue) {
    if (cssValue && cssValue.indexOf('px') > -1) {
        return parseInt(cssValue);
    }
    return 0;
}

//****************************************************************
// 4. 对图片进行坐标定位
//****************************************************************

/**
 * 对需要合并的图片进行布局定位
 * @param  {StyleObjList} styleObjList
 * @return {Array} 返回 spriteArrayay 的数组,
 * SpriteImageArray 的每个元素都是 StyleObj 数组,
 * 一个 StyleObj 数组包含了一张精灵图的所有小图片
 */
function positionImages(styleObjList) {
    var styleObj,
        spriteArray = [],
        arr = [],
        existArr = [], // 保存已经合并过的图片的样式
        maxSize = spriteConfig.output.maxSingleSize,
        packer = new GrowingPacker();

    // 把已经合并了并已输出的图片先排除掉
    for (var i in styleObjList) {
        if (i === 'length') {
            continue;
        }
        styleObj = styleObjList[i];
        if (styleObj.imageInfo.drew) {
            existArr.push(styleObj);
        } else {
            arr.push(styleObj);
        }
    }

    // 如果限制了输出图片的大小, 则进行分组
    if (maxSize) {

        /* 
         * 限制图片大小的算法是:
         * 1. 先把图片按从大到小排序
         * 2. 顺序叠加图片 size , 超过maxSize 时, 另起一个数组
         * 3. 最终把一个数组, 拆成 N 个 总 szie 小于 maxSize 的数组
         */
        arr.sort(function(a, b) {
            return b.imageInfo.size - a.imageInfo.size;
        });

        var total = 0,
            ret = [];
        arr.forEach(function(styleObj) {
            total += styleObj.imageInfo.size;

            if (total > maxSize) {
                if (ret.length) { // 避免出现空图片
                    spriteArray.push(ret);
                    ret = [];
                    total = styleObj.imageInfo.size;
                }
            }
            ret.push(styleObj);
        });

        if (ret.length) {
            spriteArray.push(ret);
        }
    } else {
        spriteArray.push(arr);
    }

    spriteArray.forEach(function(arr) {

        /* 
         * packer 算法需要把最大的一个放在首位...
         * 排序算法会对结果造成比较大的影响
         */
        arr.sort(function(a, b) {
            return b.w * b.h - a.w * a.h;
        });

        // 用 packer 对数组元素进行定位
        packer.fit(arr);

        /* 
         * root 的值就是 packer 定位的结果
         * root.w / root.h 表示图片排列后的总宽高
         * 各个小图片的坐标这在 arr 的元素中, 新增了一个 fit 属性
         * fit.x / fit.y 表示定位后元素的坐标
         */
        arr.root = packer.root;
    });
    if (existArr.length) {
        spriteArray.push(existArr);
    }
    return spriteArray;
}

//****************************************************************
// 5. 根据定位合并图片并输出, 同时修改样式表里面的background
//****************************************************************

function drawImageAndPositionBackground(spriteTask, callback) {

    var combinedCssRules,
        spriteArray = spriteTask.spriteArray,
        fileversion = spriteTask.fileversion;

    // 保存用了同一张精灵图的选择器, 用于最后输出 css 文件的时候统一设置 background-image
    combinedCssRules = {
        // './sprite_output/sprite_1.png': {imageName: '', selectors: []}
    };

    spriteTask.combinedCssRules = combinedCssRules;

    if (!spriteArray[spriteArray.length - 1].root) {

        /* 
         * 若最后一个元素, 没有root 属性, 说明它的样式都是复用已合并的图片的,
         * 直接替换样式即可
         */
        var styleObjArr = spriteArray.pop();

        styleObjArr.forEach(function(styleObj) {

            var imageInfo = styleObj.imageInfo,
                imageName = imageInfo.imageName;
            styleObj.fit = imageInfo.fit;

            if (!combinedCssRules[imageName]) {
                combinedCssRules[imageName] = [];
            }

            // 修改 background 属性
            replaceAndPositionBackground(imageName, styleObj,
                combinedCssRules[imageName], fileversion);
        });
    }

    var ep = new EventProxy();

    ep.after('drawSpriteImage', spriteArray.length, callback);

    spriteArray.forEach(function(styleObjArr, i) {
        var png,
            imageName,
            imageName2, // 用于输出 log 
            imageAbsName;

        png = createPng(styleObjArr.root.w, styleObjArr.root.h);

        imageName = createSpriteImageName(spriteTask.cssFileName, i,
            spriteArray.length);

        styleObjArr.forEach(function(styleObj) {

            var imageInfo = styleObj.imageInfo,
                image = imageInfo.image;

            imageInfo.drew = true;
            imageInfo.imageName = imageName;
            imageInfo.fit = styleObj.fit;

            if (!combinedCssRules[imageName]) {
                combinedCssRules[imageName] = [];
            }

            // 修改 background 属性
            replaceAndPositionBackground(imageName, styleObj,
                combinedCssRules[imageName], fileversion);

            // 对图片进行填充
            image.bitblt(png, 0, 0, image.width, image.height,
                imageInfo.fit.x, imageInfo.fit.y);

        });

        //  输出定位后的图片
        if (styleObjArr.length) { // 没必要输出一张空白图片
            imageName2 = path.join(spriteConfig.output.cssDist, imageName);
            imageName2 = path.normalize(imageName2);

            imageAbsName = path.join(spriteConfig.workspace, imageName2);
            imageAbsName = path.resolve(imageAbsName);
            nf.mkdirsSync(path.dirname(imageAbsName));
            png.pack().pipe(fs.createWriteStream(imageAbsName))
                .on('finish', function() {

                    info('>>Output image:', imageName2);
                    ep.emit('drawSpriteImage');
                });
        } else {
            ep.emit('drawSpriteImage');
        }
    });

}

/**
 * 创建一个 png 图片
 * @param  {Number} width
 * @param  {Number} height
 */
function createPng(width, height) {
    var png = new PNG({
        width: width,
        height: height
    });

    /*
     * 必须把图片的所有像素都设置为 0, 否则会出现一些随机的噪点
     */
    for (var y = 0; y < png.height; y++) {
        for (var x = 0; x < png.width; x++) {
            var idx = (png.width * y + x) << 2;

            png.data[idx] = 0;
            png.data[idx + 1] = 0;
            png.data[idx + 2] = 0;

            png.data[idx + 3] = 0;
        }
    }
    return png;
}

/**
 * 创建精灵图的文件名, 前缀 + css 文件名 + 文件后缀, 如果设置了 maxSingleSize,
 * 则会在文件名后面加上下标
 * @param  {String} cssFileName
 * @param  {Number} index
 * @param  {Number} total
 */
function createSpriteImageName(cssFileName, index, total) {

    var name = '';
    if (cssFileName) { // 去掉文件后缀, 提取出文件名字
        var basename = path.basename(cssFileName);
        var extname = path.extname(basename);
        name = basename.replace(extname, '');
    }

    // 设置了 maxSingleSize, 文件名会是类似 _1, _2 这种
    if (spriteConfig.output.maxSingleSize && total > 1) {
        name += '_' + index;
    }
    name = spriteConfig.output.prefix + name + '.' + spriteConfig.output.format;
    return spriteConfig.output.imageDist + name;
}

/**
 * 把合并的结果写到样式中, 修改 background-image 和 background-position 属性,
 * 并且把 background 的字属性都合并掉
 * @param  {String} imageName
 * @param  {StyleObj} styleObj
 * @param  {Array} combinedSelectors 被合并了图片的选择器
 */
function replaceAndPositionBackground(imageName, styleObj, combinedSelectors, fileversion) {
    styleObj.cssRules.forEach(function(style) {

        if (spriteConfig.output.combineCSSRule) {

            // 不分别设置 background-image, 改为统一设置, 减少 css 文件大小
            style.removeProperty('background-image');
            if (style.parentRule.selectorText) {
                combinedSelectors.push(style.parentRule.selectorText);
            }
        } else {
            if (fileversion) {
                imageName += '?' + fileversion;
            }
            style['background-image'] = 'url(' + imageName + ')';
        }

        // set background-position-x
        setPxValue(style, 'background-position-x', styleObj.fit.x);

        // set background-position-y
        setPxValue(style, 'background-position-y', styleObj.fit.y);

        // 没必要增加这个属性
        // style.setProperty('background-repeat', 'no-repeat', null);

        // mergeBackgound, 合并 background 属性, 减少代码量
        style.mergeBackgound();

    });
}

/**
 * 调整 样式规则的像素值, 如果原来就有值, 则在原来的基础上变更
 */
function setPxValue(style, attr, newValue) {
    var value;
    if (style[attr]) {
        value = parseInt(style[attr]);
    } else {
        value = 0;
        style[style.length++] = attr;
    }
    value = value - newValue;
    value = value ? value + 'px' : '0';
    style[attr] = value;
}

//****************************************************************
// 6. 合并所有 spriteTask
//****************************************************************

/**
 * 合并所有 spriteTask
 * @param  {Array} spriteTaskArray
 * @return {Array} 转换后的 SpriteTask 数组, 只会包含一个 SpriteTask
 */
function combineSpriteTasks(spriteTaskArray) {

    var combinedStyleSheetArray = [],
        combinedStyleObjList = {
            length: 0
        },
        combinedFileName,
        combinedSpriteTask;

    //combinedFileName = DEFAULT_COMBINE_CSS_NAME;
    //output.combine  扩展配置类型, 可以指定输出的文件名, 如: "combine": "exam_all.css" , 精灵图则为: sprite_exam_all.png
    combinedFileName = typeof spriteConfig.output.combine == 'string' ? spriteConfig.output.combine : DEFAULT_COMBINE_CSS_NAME;
    // combineFileName = path.resolve(combineFileName);

    spriteTaskArray.forEach(function(spriteTask) {

        // var spriteTask = { // an SpriteTask
        //     cssFileName: cssFileName, // css 文件的路径
        //     styleSheet: readStyleSheet(cssFileName), // css 文件的内容
        //     styleObjList: null, // 搜集到的需要合并图片的样式和相关图片信息(大小宽高等)
        // };

        var styleObjList = spriteTask.styleObjList,
            styleObj,
            existSObj;

        for (var url in styleObjList) {
            if (url === 'length') {
                continue;
            }
            styleObj = styleObjList[url];
            if (existSObj = combinedStyleObjList[url]) {
                existSObj.cssRules = existSObj.cssRules.concat(styleObj.cssRules);
            } else {
                combinedStyleObjList[url] = styleObj;
                combinedStyleObjList.length++;
            }
        }

        combinedStyleSheetArray.push(spriteTask.styleSheet);
    });

    combinedSpriteTask = {
        cssFileName: combinedFileName,
        styleSheetArray: combinedStyleSheetArray,
        styleObjList: combinedStyleObjList
    }

    return [combinedSpriteTask];
}

//****************************************************************
// 7. 输出修改后的样式表    
//****************************************************************

/**
 * 输出修改后的样式表
 * @param  {SpriteTask} spriteTask
 */
function exportCssFile(spriteTask) {
    var cssContentList = [],
        styleSheetArray = spriteTask.styleSheetArray,
        cssContent = '',
        compressOptions = spriteConfig.output.compress,
        fileName,
        fileName2, // 用于输出 log
        combinedCssRules,
        imageName,
        fileversion = spriteTask.fileversion;

    if (!styleSheetArray) {
        styleSheetArray = [spriteTask.styleSheet]
    }

    styleSheetArray.forEach(function(styleSheet) {
        cssContentList.push(styleSheetToString(styleSheet));
    });

    fileName = path.basename(spriteTask.cssFileName);

    fileName2 = path.join(spriteConfig.output.cssDist, fileName);
    fileName2 = path.normalize(fileName2);

    fileName = path.join(spriteConfig.workspace, fileName2);
    fileName = path.resolve(fileName);

    // 把合并了的样式统一在一起输出到文件的最后
    if (spriteConfig.output.combineCSSRule) {
        combinedCssRules = spriteTask.combinedCssRules;
        for (imageName in combinedCssRules) {
            var versionImageName = imageName;
            if (fileversion) {
                versionImageName += '?' + fileversion;
            }
            cssContent += combinedCssRules[imageName].join(',') + '{' +
                'background-image: url(' + versionImageName + ');' +
                '}\n';
        }
    }

    cssContent = cssContentList.join('\n') + cssContent;
    if (compressOptions) { // 压缩
        if (!us.isObject(compressOptions)) {
            compressOptions = null;
        }
        cssContent = new CleanCSS(compressOptions).minify(cssContent);
    }
    nf.writeFileSync(fileName, cssContent, true);
    info('>>Output css:', fileName2);
}

/**
 * 把 StyleSheet 的内容转换成 css 字符串
 * @param  {StyleSheet} styleSheet
 * @return {String} css 字符串
 */
function styleSheetToString(styleSheet) {
    var result = "";
    var rules = styleSheet.cssRules,
        rule;
    for (var i = 0; i < rules.length; i++) {
        rule = rules[i];
        if (rule instanceof CSSOM.CSSImportRule) {
            result += styleSheetToString(rule.styleSheet) + '\n';
        } else {
            result += rule.cssText + '\n';
        }
    }
    return result;
};

//****************************************************************
// 8. 拷贝不需合并的图片
//****************************************************************
function execCopyUnspriteImage() {

    // unspriteImageArray.forEach(function(url){
    // TODO 未完成
    // })
}

function copyUnspriteCss(spriteTask) {
    var fileName,
        fileName2, // 用于输出 log
        cssContent;


    fileName = path.basename(spriteTask.cssFileName);

    fileName2 = path.join(spriteConfig.output.cssDist, fileName);
    fileName2 = path.normalize(fileName2);

    fileName = path.join(spriteConfig.workspace, fileName2);
    fileName = path.resolve(fileName);

    cssContent = styleSheetToString(spriteTask.styleSheet);

    nf.writeFileSync(fileName, cssContent, true);
    info('>>Output unsprite css:', fileName2);
};



//****************************************************************
// 主逻辑
//****************************************************************

// sprite 的配置
var spriteConfig = null;

// sprite 缓存
var spriteCache = null;

// sprite 完成之后的回调
var onSpriteDone = null;

// 记录 sprite 开始的时间
var spriteStart = 0;

// 图片信息缓存
var imageInfoCache = null;

// sprite 数据的缓存, 用于需要合并所有 css 文件和图片的情况
var spriteTaskArray = null;

// 不需要合并的图片的数组, 可以配置成一起拷贝到目标 workspace
var unspriteImageArray = null;

/**
 * sprite 开始之前执行的函数
 */
function onSpriteStart() {
    spriteStart = +new Date;
}

/**
 * sprite 完成之后执行的函数
 */
function onSpriteEnd() {
    var timeUse = +new Date - spriteStart;
    info('>>All done: Time use:', timeUse, 'ms');
    onSpriteDone && onSpriteDone(timeUse);
}

/**
 * ispriter 的主要入口函数
 * @param  {Object|String} config ispriter 的配置对象或者是配置文件,
 * 如不清楚请参照 README.md
 * @param {Function} done 当精灵图合并完成后触发
 */
exports.merge = function(config, done) {
    onSpriteStart();

    spriteCache = {};
    onSpriteDone = done;

    imageInfoCache = {};
    spriteTaskArray = [];
    unspriteImageArray = [];

    // 1. 读取和处理合图配置
    spriteConfig = readConfig(config);

    // 2. 读取文件内容并解析, 读取相关图片的信息
    zTool.forEach(spriteConfig.input.cssSource, function(cssFileName, i, next) { // onEach
        // 为图片添加版本号
        var fileversion = spriteConfig.fileversion;
        if (us.isBoolean(spriteConfig.fileversion)) {
            fileversion = DEFAULT_VERSION;
        } else if (!us.isString(spriteConfig.fileversion)) {
            fileversion = '';
        }
        var spriteTask = { // an SpriteTask, 一个文件一个 SpriteTask
            cssFileName: cssFileName, // css 文件的路径
            styleSheet: readStyleSheet(cssFileName), // css 文件的内容
            styleObjList: null, // 搜集到的需要合并图片的样式和相关图片信息(大小宽高等)
            spriteArray: null, // 精灵图的所有小图片数组
            fileversion: fileversion
        };
        // debug(spriteTask.styleSheet);
        // 收集需要合并的图片信息
        var styleObjList = collectStyleRules(spriteTask.styleSheet, null, cssFileName);
        spriteTask.styleObjList = styleObjList;

        if (!styleObjList.length) { // 这个 css 没有需要合并的图片
            // 把没有处理的 css 文件也拷贝过去
            copyUnspriteCss(spriteTask);
            next();
        } else {

            // 把结果塞到列表中方便 combine 使用
            spriteTaskArray.push(spriteTask);

            // 读取图片的内容, 宽高和大小
            readImagesInfo(styleObjList, next);
        }
    }, function() { // onDone

        // 3. 对小图片进行定位排列和输出, 输出合并后的 css 文件

        if (spriteConfig.output.combine) {

            // 如果指定了 combine, 先把所有 cssRules 和 styleSheet 合并
            spriteTaskArray = combineSpriteTasks(spriteTaskArray);
        }

        var ep = new EventProxy();

        ep.after('drawImage', spriteTaskArray.length, function() {
            if (spriteConfig.output.copyUnspriteImage) {

                // 把不需要合并的图片进行拷贝
                execCopyUnspriteImage();
            }

            // 大功告成
            onSpriteEnd();
        });

        spriteTaskArray.forEach(function(spriteTask) {

            // spriteArray 的每个元素就是每张精灵图
            var spriteArray = positionImages(spriteTask.styleObjList);
            spriteTask.spriteArray = spriteArray;

            // 输出合并的图片 并修改样式表里面的background
            drawImageAndPositionBackground(spriteTask, function() {
                // 输出修改后的样式表
                exportCssFile(spriteTask);

                ep.emit('drawImage');
            });

        });

    });

}

// Task.JS Specification API https://github.com/taskjs/spec
exports.run = function(options, done) {
    exports.merge(options, done);
}
