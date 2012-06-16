智能合并CSS精灵图(Sprite)
=======================

使用nodejs实现, 依赖[CSSOM](https://github.com/NV/CSSOM), [node-canvas](https://github.com/learnboost/node-canvas)

使用 [bin-packing](https://github.com/jakesgordon/bin-packing) 算法排列图片, 后续支持选择其他算法

在此, 感谢这些开源项目的作者

什么是智能?
=========

编写css 文件时什么都不用管, 该用什么图片用什么图片, 该怎么定位就怎么定位

发布前执行 sprite-merger, 所有合并图片和定位都自动帮你完成

支持情况
=======

##没有使用 background-position 定位的情况下

    div{
        background: url(../images/tips_icons.png);
    }
    =>
    div{
        background: url(../images/sprite_1.png);
    }

##background-position写在 background 属性里

    div{
        background: url(../images/tips_icons.png) -42px 0;
    }
    =>
    div{
        background: url(../images/sprite_1.png) 0 -174px;
    }

##background-image 和 background-position 不使用简写

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

    git clone https://github.com/iazrael/sprite-merger

    copy src to your project

    modify the config.example.json and rename it with any name you want

    node ./src/sprite-merger.js config.json

    that's all