#智能合并CSS精灵图(iSpriter)

什么是智能?
=========

编写 css 文件时什么都不用管, 该用什么图片用什么图片, 该怎么定位就怎么定位, 不用改变原有的 css 编写方式

发布前执行 ispriter, 所有合并图片和定位都自动帮你完成

站在巨人的肩膀上
================

使用nodejs实现, 依赖[CSSOM](https://github.com/NV/CSSOM), [node-pngjs](https://github.com/niegowski/node-pngjs)

使用 [bin-packing](https://github.com/jakesgordon/bin-packing) 算法排列图片, 后续支持选择其他算法

在此, 感谢这些开源项目的作者, 以及给本项目贡献代码的同学


特性
====

+ 智能提取 background 的 url 和 position 等信息
+ 智能设置被合并图片的宽高
+ 智能判断使用了 background-position（使用px为单位）定位的图片并重新定位
+ 支持已经合并了的精灵图再次合并和定位
+ 支持对小图片去重
+ 支持限制合并后图片的最大大小
+ 支持设置合并后的图片间距
+ 支持将所有图片合并为一张, 同时所有 CSS 文件合并为一个文件 【新】
+ 支持读取 @import 的样式表进行处理 【新】
+ 支持将所有合并了图片的 CSS 统一输出, 减少代码量 【新】
+ 支持对输出的 CSS 进行压缩(使用 clean-css)【新】
+ 支持排除不需要合并的图片【新】
+ 跳过 background-position 是 right/center/bottom 的图片
+ 跳过显式的设置平铺方式为 repreat 的图片
+ 跳过设置了 background-size 的图片

使用方法
=======

### config 文件的配置参数

    {
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
        "workspace": "./",

        "input": {

            /**
             * 原 cssRoot
             * 需要进行精灵图合并的 css 文件路径或文件列表, 单个时使用字符串, 多个时使用数组.
             * 
             * @required 
             * @example
             * "cssSource": "../css/";
             * "cssSource": ["../css/style.css", "../css2/*.css"]
             */
            "cssSource": ["./css/style*.css"],

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
            "compress": false
        }
    };

### config 的最简配置

    {
        "input":  "./../test/css/", // input cssRoot
        "output": "./../test/sprite_output/css/" // output cssRoot
    }

### 从代码中调用

    var spriter = require('ispriter');

    spriter.merge('../src/config.example.json');

    or 

    spriter.merge({
        input: ['./css/style.css', './css/style2.css']
    });

### 从命令行调用
    
    npm install ispriter -g

    cd ./test

    ispriter -c config.example.json
    
    or

    ispriter -f style.css, style2.css ...

### 从 [Mod](https://github.com/modulejs/modjs) 中调用

    // Modfile
    module.exports = {
        plugins: {
            sprite: "ispriter"
        },
        tasks: {
            sprite: {
                page1: {
                    "input":  "./../test/css/", // input cssRoot
                    "output": "./../test/sprite_output/css/" // output cssRoot
                },
                page2: {
                    // 涉及对象类型参数需配置在options中
                    options: {

                        "input": {
                            "cssSource": ["./css/style*.css"]
                        },
                        "output": {
                            "cssDist": "./sprite/css/",
                            "imageDist": "./img/",
                            "maxSingleSize": 60,
                            "margin": 5
                        }
                    }
                }
            }
        }
    }

### 排除不需要合并的图片
只要在写样式的时候，在 background-image 的图片url加上 #unsprite 即可，例如：
    
    background: url(../images/loading.png#unsprite);

    background: url(../images/loading.png?t=123#unsprite);

    background: url(../images/loading.png#hash#unsprite);

Example
=======

具体实例请查看 examples 目录下的 demo, 进入具体目录, 执行

    ispriter -c config.json 
体验实际效果
