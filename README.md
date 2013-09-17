#智能合并CSS精灵图(iSpriter)

站在巨人的肩膀上
================

使用nodejs实现, 依赖[CSSOM](https://github.com/NV/CSSOM), [node-pngjs](https://github.com/niegowski/node-pngjs)

使用 [bin-packing](https://github.com/jakesgordon/bin-packing) 算法排列图片, 后续支持选择其他算法

在此, 感谢这些开源项目的作者, 以及给本项目贡献代码的同学

什么是智能?
=========

编写css 文件时什么都不用管, 该用什么图片用什么图片, 该怎么定位就怎么定位, 不用改变原有的 css 编写方式

发布前执行 ispriter, 所有合并图片和定位都自动帮你完成

特性
====

+ 智能提取background的url和position等信息
+ 智能判断使用了background-position（使用px为单位）定位的图片并重新定位
+ 兼容已经合并了的图片, 并重新定位
+ 多个css文件合并时，排除并重用已经合并的图片
+ 智能设置被合并图片的宽高
+ 支持设定合并后图片的最大大小
+ 支持设置合并后的图片间距

+ 支持将所有图片合并为一张, 同时所有css文件合并为一个文件 【新】
+ 支持读取 @import 的样式表进行处理 【新】

+ 跳过background-position是right/center/bottom的图片
+ 跳过显式的设置平铺方式为repreat的图片
+ 跳过设置了background-size的图片

使用方法
=======

### config 文件的配置参数

    {
        "algorithm": "growingpacker",//optional 目前只有 growingpacker
        "input": {
            "cssRoot": "./../test/css/", //required
            "imageRoot": "",//optional 默认 cssRoot
            "format": "png"//optional
        },
        "output": {
            "cssRoot": "./../test/sprite_output/css/",//required
            "imageRoot": "../images/",//optional 相对于 cssRoot 的路径, 默认 "./image/", 最终会变成合并后的的图片路径写在css文件中
            "maxSize": 60,//optional 图片容量的最大大小, 单位 KB, 默认 0
            "margin": 5,//optional 合成之后, 图片间的空隙, 默认 0
            "prefix": "sprite_",//optional 
            "format": "png",//optional 输出的图片格式
            "combine": false//optional 为true时将所有图片合并为一张, 同时所有css文件合并为一个文件
        }
    }

### config 的最简配置

    {
        "input":  "./../test/css/", // input cssRoot
        "output": "./../test/sprite_output/css/" // output cssRoot
    }

### 从代码中调用

    var spriter = require('ispriter');

    var configFile = '../src/config.example.json';

    spriter.merge(configFile);

### 从命令行调用
    
    npm install ispriter -g

    cd ./test

    ispriter -c config.example.json

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
                        "algorithm": "growingpacker",//optional 目前只有 growingpacker
                        "input": {
                            "cssRoot": "./css/", //required
                            "format": "png"//optional, 只支持输出PNG格式, 如果是其他格式, 也是以PNG格式输出, 仅仅把后缀改为其他后缀
                        },
                        "output": {
                            "cssRoot": "./sprite_output/css/",//required
                            "imageRoot": "../images/",//optional 相对于 cssRoot 的路径, 默认 "./image/", 最终会变成合并后的的图片路径写在css文件中
                            "maxSize": 60,//optional 图片容量的最大大小, 单位 KB, 默认 0
                            "margin": 5,//optional 合成之后, 图片间的空隙, 默认 0
                            "prefix": "sprite_",//optional 
                            "format": "png",//optional 输出的图片格式
                            "combine": false//optional 为true时将所有图片合并为一张, 同时所有css文件合并为一个文件
                        }
                    }   
                }
            }
        }
    }
    
Example
=======

具体实例请到项目根目录下的 test 目录, 执行 node dosprite.js 体验实际效果
