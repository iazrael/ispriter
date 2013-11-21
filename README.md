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
+ 支持图片去重
+ 支持限制合并后图片的大小
+ 支持设置合并后的图片间距
+ 支持将所有图片合并为一张, 同时所有 CSS 文件合并为一个文件 【新】
+ 支持读取 @import 的样式表进行处理 【新】
+ 支持将所有合并了图片的 CSS 统一输出, 减少代码量 【新】
+ 支持对输出的 CSS 进行压缩(使用 clean-css)【新】
+ 支持排除不需要合并的图片（在 url 后面添加 #unsprite 或者使用 config 文件来配置）【新】
+ 跳过 background-position 是 right/center/bottom 的图片
+ 跳过显式的设置平铺方式为 repreat 的图片
+ 跳过设置了 background-size 的图片

使用方法
=======

config 的详细参数说明见[CONFIG](./CONFIG.md)

### config 文件的配置参数

    {

        "input": {

            /**
             * 原 cssRoot
             */
            "cssSource": ["./css/style*.css"]
        },
        "output": {

            /**
             * 原 cssRoot
             */
            "cssDist": "./sprite/css/",

            /**
             * 原 imageRoot
             */
            "imageDist": "./img/",

            /**
             * 原 maxSize
             */
            "maxSingleSize": 60,
            
            "margin": 3
        }
    }

### config 的最简配置

    {
        "input":  "./../test/css/", // input cssSource
        "output": "./../test/sprite_output/css/" // output cssDist
    }

### 从代码中调用

    var spriter = require('ispriter');

    spriter.merge('../src/config.example.json');

    or 

    spriter.merge(['./css/style.css', './css/style2.css']);

    or

    spriter.merge({
        "input":  "./../test/css/",
        "output": "./../test/sprite_output/css/"
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
                    "input":  "./../test/css/", // input cssSource
                    "output": "./../test/sprite_output/css/" // output cssDist
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
只要在写样式的时候, 在 background-image 的图片url加上 #unsprite 即可, 例如:
    
    background: url(../images/loading.png#unsprite);

    background: url(../images/loading.png?t=123#unsprite);

    background: url(../images/loading.png#hash#unsprite);

也可以在 config 中指定 ignoreImages 来实现, 所有匹配上的图片都不会合并, 可以使用通配符, 例如: 

    "ignoreImages": "icons/*"
    
    "ignoreImages": ["icons/*", "loading.png"]

Example
=======

具体实例请查看 examples 目录下的 demo, 进入具体目录, 执行

    ispriter -c config.json 
体验实际效果

License
=======

[MIT](./LICENSE)
