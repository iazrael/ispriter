#智能合并CSS精灵图(iSpriter)

站在巨人的肩膀上
================

使用nodejs实现, 依赖[CSSOM](https://github.com/NV/CSSOM), [node-canvas](https://github.com/learnboost/node-canvas)

使用 [bin-packing](https://github.com/jakesgordon/bin-packing) 算法排列图片, 后续支持选择其他算法

在此, 感谢这些开源项目的作者

什么是智能?
=========

编写css 文件时什么都不用管, 该用什么图片用什么图片, 该怎么定位就怎么定位

发布前执行 spriter, 所有合并图片和定位都自动帮你完成

特性
====

+ 智能提取background的url和position等信息
+ 智能判断使用了background-position（使用px为单位）定位的图片并重新定位
+ 多个css文件合并时，排除并重用已经合并的图片
+ 不合并background-position是right/center/bottom的图片
+ 不合并显示的设置平铺方式为repreat的图片
+ 从所有样式里面，选取图片宽高最大的作为图片高度

Example
=======

### 没有使用 background-position 定位的情况下

    div{
        background: url(../images/tips_icons.png);
    }
    =>
    div{
        background: url(../images/sprite_1.png) -48px -48px;
    }

### background-position写在 background 属性里

    div{
        background: url(../images/tips_icons.png) -42px 0;
    }
    =>
    div{
        background: url(../images/sprite_1.png) 0 -174px;
    }

### background-image 和 background-position 不使用简写

    div{
        background-image: url(../images/tips_icons.png);
        background-position: 0 -40px;
    }
    =>
    div{
        background: url(../images/sprite_1.png) -142px -86px;
    }

使用方法
=======

    npm install ispriter

    then write your code, as example, create a file name test.js(in ./test/), add the codes like below:

        var spriter=require('ispriter');
        spriter.merge(configFileName);

    then execute "node ./test.js" in command line

    that's all